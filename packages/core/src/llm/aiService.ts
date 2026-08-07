import type { AISuggestion, Category, MapAnalysis, ConnectionSuggestion, ClusterSuggestion, ChatAction, ChatWithMapRequest } from '../types'
import type { JsonSchema, LLMProvider, LLMRequest } from './types'
import { LLMError } from './types'
import { AIParseError } from './jsonUtils'
import { formatWebSearchBlock, type WebSearchClient, type WebSearchResult } from './webSearch'

// 生レスポンスのコピー導線（MapAnalysisPanel）が型判定に使うため再エクスポートする
export { AIParseError }

/**
 * AIに聞く前のWeb検索。使うかどうかは呼び出し側（各パネルのトグル）が決め、
 * `webSearch` が未指定なら検索は一切走らずプロンプトも Phase 35 以前と同一になる。
 */
export interface WebSearchOptions {
  webSearch?: WebSearchClient
  /** 実際に参照した検索結果。UIの出典表示に使う */
  onWebSearchResults?: (results: WebSearchResult[]) => void
}

async function buildWebContext(
  opts: WebSearchOptions,
  query: string,
  signal?: AbortSignal,
): Promise<string> {
  if (!opts.webSearch) return ''
  const results = await opts.webSearch.search(query, signal)
  opts.onWebSearchResults?.(results)
  return formatWebSearchBlock(results)
}

/**
 * JSON出力を要求する指示文の末尾に付けるスキーマ提示。
 *
 * Ollama は format にスキーマを渡すのに加えてプロンプトにも埋め込むと追従率が上がる（公式ドキュメント推奨）。
 * Claude はプロンプト内の「JSON形式のみで回答」指示だけで十分なため何も足さない
 * ＝ Claude に送るプロンプトは Phase 34 以前と1文字も変わらない。
 */
function jsonInstructionSuffix(provider: LLMProvider, schema: JsonSchema): string {
  if (provider.capabilities.structuredOutput !== 'json-schema') return ''
  return `\n\n出力は以下のJSON Schemaに厳密に従ってください:\n${JSON.stringify(schema)}`
}

/**
 * 構造化出力のパースに失敗したら1回だけ修復を促して再試行する。
 * 小型ローカルモデルはJSONの逸脱が起きやすく、この1回で大半は回復する。
 * 2回目の失敗はそのまま呼び出し元（＝UIの「生レスポンスをコピー」導線）に渡す。
 */
async function completeJsonWithRetry<T>(
  provider: LLMProvider,
  req: LLMRequest,
  schema: JsonSchema,
  signal?: AbortSignal,
): Promise<T> {
  try {
    return await provider.completeJson<T>(req, schema, signal)
  } catch (e) {
    if (!(e instanceof LLMError) || e.kind !== 'parse') throw e
    // Claude API は空の content ブロックを拒否するため、生レスポンスが取れたときだけ差し戻す
    const previous: LLMRequest['messages'] = e.rawResponse
      ? [{ role: 'assistant', content: e.rawResponse }]
      : []
    const repairReq: LLMRequest = {
      ...req,
      messages: [
        ...req.messages,
        ...previous,
        {
          role: 'user',
          content: `直前の応答はJSONとして解析できませんでした（エラー: ${e.message}）。同じ内容をJSON形式で出力し直してください。説明文は不要です。`,
        },
      ],
    }
    return provider.completeJson<T>(repairReq, schema, signal)
  }
}

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

const MAP_ANALYSIS_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    missingAreas: { type: 'array', items: { type: 'string' } },
    importantNodeIds: { type: 'array', items: { type: 'string' } },
    importantNodeTitles: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'missingAreas', 'importantNodeIds', 'importantNodeTitles'],
}

const CONNECTIONS_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sourceId: { type: 'string' },
          targetId: { type: 'string' },
          sourceTitle: { type: 'string' },
          targetTitle: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['sourceId', 'targetId', 'sourceTitle', 'targetTitle', 'reason'],
      },
    },
  },
  required: ['suggestions'],
}

const CLUSTERS_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    clusters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          groupName: { type: 'string' },
          categoryId: { type: 'string' },
          nodeIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['groupName', 'categoryId', 'nodeIds'],
      },
    },
  },
  required: ['clusters'],
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

interface AnalyzeMapRequest extends WebSearchOptions {
  provider: LLMProvider
  nodes: { id: string; title: string; body?: string; categoryId?: string }[]
  edges: { source: string; target: string }[]
  categories: Category[]
}

export async function analyzeMap(req: AnalyzeMapRequest, signal?: AbortSignal): Promise<MapAnalysis> {
  const { provider } = req

  const nodeList = req.nodes
    .map((n) => {
      const cat = req.categories.find((c) => c.id === n.categoryId)
      const bodyPreview = n.body ? `\n  本文: ${n.body.slice(0, 100)}` : ''
      return `- [${n.id}] ${n.title}（カテゴリ: ${cat?.name ?? '未分類'}）${bodyPreview}`
    })
    .join('\n')

  const edgeList = req.edges
    .map((e) => {
      const src = req.nodes.find((n) => n.id === e.source)?.title ?? e.source
      const tgt = req.nodes.find((n) => n.id === e.target)?.title ?? e.target
      return `- ${src} → ${tgt}`
    })
    .join('\n')

  // 検索クエリはマップの主要ノード（先頭5件）。「見落としている領域」の指摘に外部情報が効く
  const webContext = await buildWebContext(
    req,
    req.nodes.slice(0, 5).map((n) => n.title).join(' '),
    signal,
  )

  const prompt = `あなたはアイデアマップ分析の専門家です。以下のアイデアマップを分析してください。

【ノード一覧】
${nodeList}

【接続関係】
${edgeList || '（接続なし）'}${webContext}

以下の3点を分析して、JSON形式のみで回答してください：
1. マップの主要テーマを1〜2文で要約（summary）
2. 見落としているアイデア領域（missingAreas: 最大4個の文字列配列）
3. 最も重要と思われるノードのID（importantNodeIds: 最大3個のID配列）と対応するタイトル（importantNodeTitles）

{
  "summary": "マップの主要テーマの要約文",
  "missingAreas": ["見落としている領域1", "見落としている領域2"],
  "importantNodeIds": ["node-id-1", "node-id-2"],
  "importantNodeTitles": ["タイトル1", "タイトル2"]
}${jsonInstructionSuffix(provider, MAP_ANALYSIS_SCHEMA)}`

  return completeJsonWithRetry<MapAnalysis>(
    provider,
    { messages: [{ role: 'user', content: prompt }], maxTokens: 2048 },
    MAP_ANALYSIS_SCHEMA,
    signal,
  )
}

interface SuggestConnectionsRequest {
  provider: LLMProvider
  nodes: { id: string; title: string; body?: string }[]
  existingEdges: { source: string; target: string }[]
}

export async function suggestConnections(req: SuggestConnectionsRequest, signal?: AbortSignal): Promise<ConnectionSuggestion[]> {
  const { provider } = req

  if (req.nodes.length < 2) return []

  const connectedPairs = new Set(
    req.existingEdges.flatMap((e) => [`${e.source}:${e.target}`, `${e.target}:${e.source}`])
  )

  const nodeList = req.nodes.map((n) => `- [${n.id}] ${n.title}`).join('\n')

  const prompt = `あなたはアイデアの関連性を見つける専門家です。以下のノード一覧を見て、まだ接続されていないが関連性の高いペアを最大5組提案してください。

【ノード一覧】
${nodeList}

【既存の接続】
${req.existingEdges.map((e) => `${e.source} → ${e.target}`).join('\n') || '（なし）'}

新たな接続候補をJSON形式のみで回答してください（説明文不要）:
{
  "suggestions": [
    {
      "sourceId": "ノードID",
      "targetId": "ノードID",
      "sourceTitle": "ソースノードのタイトル",
      "targetTitle": "ターゲットノードのタイトル",
      "reason": "なぜこの2つが関連するかの理由（1文）"
    }
  ]
}${jsonInstructionSuffix(provider, CONNECTIONS_SCHEMA)}`

  const parsed = await completeJsonWithRetry<{ suggestions: ConnectionSuggestion[] }>(
    provider,
    { messages: [{ role: 'user', content: prompt }], maxTokens: 2048 },
    CONNECTIONS_SCHEMA,
    signal,
  )
  if (!Array.isArray(parsed.suggestions)) return []

  return parsed.suggestions.filter(
    (s) =>
      s.sourceId &&
      s.targetId &&
      s.sourceId !== s.targetId &&
      !connectedPairs.has(`${s.sourceId}:${s.targetId}`)
  )
}

interface SuggestClustersRequest {
  provider: LLMProvider
  nodes: { id: string; title: string; body?: string }[]
  categories: Category[]
}

export async function suggestClusters(req: SuggestClustersRequest, signal?: AbortSignal): Promise<ClusterSuggestion[]> {
  const { provider } = req

  if (req.nodes.length < 3) return []

  const nodeList = req.nodes.map((n) => `- [${n.id}] ${n.title}`).join('\n')
  const categoryList = req.categories
    .map((c) => `  "${c.id}": ${c.name}`)
    .join('\n')

  const nodeMap = new Map(req.nodes.map((n) => [n.id, n.title]))

  const prompt = `あなたはアイデアを整理するコンサルタントです。以下のノード一覧をテーマ別にグループ分けしてください。

【ノード一覧】
${nodeList}

【利用可能なカテゴリ】
${categoryList}

各ノードを意味的に近いものでグループ化し、最適なカテゴリIDを割り当ててください。最大4グループで提案してください。
JSON形式のみで回答してください（説明文不要）:
{
  "clusters": [
    {
      "groupName": "グループ名",
      "categoryId": "cat-main",
      "nodeIds": ["id1", "id2"]
    }
  ]
}${jsonInstructionSuffix(provider, CLUSTERS_SCHEMA)}`

  const parsed = await completeJsonWithRetry<{ clusters: Array<Omit<ClusterSuggestion, 'nodeTitles'>> }>(
    provider,
    { messages: [{ role: 'user', content: prompt }], maxTokens: 4096 },
    CLUSTERS_SCHEMA,
    signal,
  )
  if (!Array.isArray(parsed.clusters)) return []

  return parsed.clusters.map((c) => ({
    ...c,
    // 小型モデルは nodeIds を返さないことがあるため、欠けても後段の map で落ちないようにする
    nodeIds: Array.isArray(c.nodeIds) ? c.nodeIds : [],
    nodeTitles: (Array.isArray(c.nodeIds) ? c.nodeIds : []).map((id) => nodeMap.get(id) ?? id),
  }))
}

export async function chatWithMap(
  req: ChatWithMapRequest,
  onText?: (partialText: string) => void,
  signal?: AbortSignal,
): Promise<{ content: string; actions: ChatAction[] }> {
  const { provider } = req

  const prioritizedNodeIds = new Set(req.mentionedNodeIds ?? [])
  const orderedNodes = [
    ...req.mapContext.nodes.filter((n) => prioritizedNodeIds.has(n.id)),
    ...req.mapContext.nodes.filter((n) => !prioritizedNodeIds.has(n.id)),
  ].slice(0, 50)

  const nodeList = orderedNodes
    .map((n) => {
      const bodyPreview = n.body ? `\n  本文: ${n.body.slice(0, 100)}` : ''
      return `- [${n.id}] ${n.title}${bodyPreview}`
    })
    .join('\n')

  const edgeList =
    req.mapContext.edges
      .map((e) => `- ${e.source} → ${e.target}${e.label ? ` (${e.label})` : ''}`)
      .join('\n') || '（接続なし）'

  const mentionedBlock =
    prioritizedNodeIds.size > 0
      ? `\n【@メンションされたノード】\n${[...prioritizedNodeIds]
          .map((id) => {
            const node = req.mapContext.nodes.find((n) => n.id === id)
            return node ? `- [${id}] ${node.title}` : ''
          })
          .filter(Boolean)
          .join('\n')}`
      : ''

  // 検索クエリは直近のユーザー発言。会話の話題がそのまま検索したい内容になる
  const lastUserMessage = [...req.messages].reverse().find((m) => m.role === 'user')?.content ?? ''
  const webContext = await buildWebContext(req, lastUserMessage, signal)

  const systemContext = `あなたは「IdeaMap」のAIアシスタントです。ユーザーのアイデアマップを文脈として理解した上で自由に会話してください。

【現在のマップ: ${req.mapContext.mapTitle}】
ノード数: ${req.mapContext.nodes.length}件

【ノード一覧】
${nodeList}

【接続関係】
${edgeList}${mentionedBlock}${webContext}

マップ操作を提案したい場合のみ、回答の末尾に以下のJSONブロックを含めてください（アクションがなければ省略）:
\`\`\`actions
{"actions": [{"type": "addNode", "label": "ノードタイトル", "sourceNodeId": "parent-id", "categoryId": "cat-main", "reason": "理由"}]}
\`\`\``

  const apiMessages = req.messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const accumulated = await provider.stream(
    { system: systemContext, messages: apiMessages, maxTokens: 2048 },
    (partial) => {
      // actions ブロックの途中露出を防ぐため除去してから渡す
      if (onText) onText(partial.replace(/```actions[\s\S]*$/, ''))
    },
    signal,
  )

  // Abort 時はそれまでの累積テキストを返す（エラーとして扱わない）
  if (signal?.aborted) {
    return { content: accumulated.replace(/```actions[\s\S]*$/, '').trim(), actions: [] }
  }

  const actionsMatch = accumulated.match(/```actions\n([\s\S]*?)\n```/)
  let actions: ChatAction[] = []
  if (actionsMatch) {
    try {
      const parsed = JSON.parse(actionsMatch[1]) as { actions: ChatAction[] }
      actions = Array.isArray(parsed.actions) ? parsed.actions : []
    } catch {
      // graceful degradation: パース失敗時はアクションなし
    }
  }

  const content = accumulated.replace(/```actions\n[\s\S]*?\n```/, '').trim()
  return { content, actions }
}

export function toFriendlyAIError(e: unknown): string {
  if (e instanceof LLMError) {
    // kind ごとの日本語文言は Provider が設定する（同じ kind でも Claude と Ollama で案内が変わるため）。
    // キャンセルは呼び出し側が握り潰す前提だが、保険として無害な文言を返す。
    return e.kind === 'aborted' ? 'キャンセルされました' : e.message
  }
  return e instanceof Error ? e.message : 'エラーが発生しました'
}
