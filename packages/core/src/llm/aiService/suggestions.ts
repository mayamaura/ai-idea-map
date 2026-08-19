import type { AISuggestion, Category } from '../../types'
import type { JsonSchema, LLMProvider } from '../types'
import { buildWebContext, completeJsonWithRetry, jsonInstructionSuffix, type WebSearchOptions } from './shared'

const SUGGESTIONS_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '簡潔なタイトル（20字以内）' },
          body: { type: 'string', description: '補足説明・詳細' },
          categoryId: { type: 'string', description: 'カテゴリID' },
          parentNodeId: { type: 'string', description: '兄弟モードで複数親があるときの接続先ノードID' },
        },
        required: ['title'],
      },
    },
  },
  required: ['suggestions'],
}

interface SuggestionRequest extends WebSearchOptions {
  provider: LLMProvider
  selectedNodeTitle: string
  selectedNodeBody?: string
  /** 接続ノードのタイトルと本文（1ホップ隣接ノード） */
  connectedNodes: Array<{ title: string; body?: string }>
  allNodeTitles: string[]
  count: number
  categories: Category[]
  /** ユーザーが自由記述で添えた指示（省略可） */
  userInstruction?: string
  /** 個別再生成時に渡す除外テキスト（重複回避） */
  excludedTexts?: string[]
  /** 'child'=選択ノードの子として追加 / 'sibling'=選択ノードの兄弟として追加 */
  mode: 'child' | 'sibling'
  /** 兄弟モード時の候補親ノード情報 */
  parentNodes?: Array<{ id: string; title: string; body?: string }>
  /** 兄弟モード時の既存兄弟ノード（重複回避＆文脈提供） */
  siblingNodes?: Array<{ title: string; body?: string }>
}

export async function generateSuggestions(req: SuggestionRequest, signal?: AbortSignal): Promise<AISuggestion[]> {
  const { provider } = req

  const bodySection = req.selectedNodeBody
    ? `\n【選択ノードの詳細メモ】\n${req.selectedNodeBody}`
    : ''

  const connectedSection = req.connectedNodes.length > 0
    ? `\n【つながっているアイデア】\n${req.connectedNodes.map((n) => {
        const bodyPreview = n.body ? `（メモ: ${n.body.slice(0, 80)}）` : ''
        return `- ${n.title}${bodyPreview}`
      }).join('\n')}`
    : ''

  const contextSection = req.allNodeTitles.length > 0
    ? `\n【マップ全体の文脈（参考）】\n${req.allNodeTitles.slice(0, 10).map((t) => `- ${t}`).join('\n')}`
    : ''

  const instructionSection = req.userInstruction
    ? `\n【あなたへの指示】\n${req.userInstruction}`
    : ''

  const excludedSection = req.excludedTexts && req.excludedTexts.length > 0
    ? `\n【除外してほしいアイデア（重複禁止）】\n${req.excludedTexts.map((t) => `- ${t}`).join('\n')}`
    : ''

  const siblingSection = (() => {
    if (req.mode !== 'sibling' || !req.parentNodes || req.parentNodes.length === 0) return ''
    const parentList = req.parentNodes
      .map((p) => {
        const bodyPreview = p.body ? `（メモ: ${p.body.slice(0, 80)}）` : ''
        return `- [${p.id}] ${p.title}${bodyPreview}`
      })
      .join('\n')
    const multiParentNote = req.parentNodes.length > 1
      ? '\n最も適切な親ノードを1つ選び、各提案の parentNodeId フィールドに選んだノードの id を入れてください。'
      : ''
    const siblingList = req.siblingNodes && req.siblingNodes.length > 0
      ? `\n【既存の兄弟アイデア（重複禁止）】\n${req.siblingNodes.map((n) => `- ${n.title}`).join('\n')}`
      : ''
    return `\n【このアイデアは以下の親ノードの子として追加されます】\n${parentList}${multiParentNote}${siblingList}`
  })()

  const categoryList = req.categories
    .map((c) => `  "${c.id}": ${c.name}（${c.description ?? ''}）`)
    .join('\n')

  // 検索クエリは「起点ノードのタイトル＋ユーザーの追加指示」。マップ全体を混ぜると焦点がぼやける
  const webContext = await buildWebContext(
    req,
    [req.selectedNodeTitle, req.userInstruction].filter(Boolean).join(' '),
    signal,
  )

  const prompt = `あなたはアイデア発想を助ける専門家です。
以下のアイデアを起点に、創造的で具体的なアイデアを${req.count}個提案してください。${connectedSection}${contextSection}${instructionSection}${excludedSection}${siblingSection}${webContext}

【選択されたアイデア】
${req.selectedNodeTitle}${bodySection}

各提案に最も適したカテゴリIDを以下から選んでください：
${categoryList}

必ず以下のJSON形式のみで回答してください（説明文は不要）:
{
  "suggestions": [
    {"title": "簡潔なタイトル（20字以内）", "body": "補足説明・詳細（省略可）", "categoryId": "cat-main"},
    ...
  ]
}
title は短く端的に。詳細・補足・具体例は body に記述してください。body が不要なら省略できます。${jsonInstructionSuffix(provider, SUGGESTIONS_SCHEMA)}`

  const parsed = await completeJsonWithRetry<{ suggestions: AISuggestion[] }>(
    provider,
    { messages: [{ role: 'user', content: prompt }], maxTokens: 2048 },
    SUGGESTIONS_SCHEMA,
    signal,
  )
  if (!Array.isArray(parsed.suggestions)) throw new Error('AIからの応答形式が正しくありません')

  return parsed.suggestions.slice(0, req.count)
}
