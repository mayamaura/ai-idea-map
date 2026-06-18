import Anthropic from '@anthropic-ai/sdk'
import type { AISuggestion, AIModel, Category, MapAnalysis, ConnectionSuggestion, ClusterSuggestion, ChatAction, ChatWithMapRequest } from '../types'

interface SuggestionRequest {
  apiKey: string
  model: AIModel
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
  const client = new Anthropic({ apiKey: req.apiKey, dangerouslyAllowBrowser: true })

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

  const prompt = `あなたはアイデア発想を助ける専門家です。
以下のアイデアを起点に、創造的で具体的なアイデアを${req.count}個提案してください。${connectedSection}${contextSection}${instructionSection}${excludedSection}${siblingSection}

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
title は短く端的に。詳細・補足・具体例は body に記述してください。body が不要なら省略できます。`

  const message = await client.messages.create({
    model: req.model,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  }, { signal })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('予期しないレスポンス形式です')

  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AIからの応答を解析できませんでした。もう一度お試しください。')

  let parsed: { suggestions: AISuggestion[] }
  try {
    parsed = JSON.parse(jsonMatch[0]) as { suggestions: AISuggestion[] }
  } catch (e) {
    throw new Error(
      `AIの応答形式が不正でした。もう一度お試しください。\n詳細: ${e instanceof Error ? e.message : String(e)}`,
      { cause: e },
    )
  }
  if (!Array.isArray(parsed.suggestions)) throw new Error('AIからの応答形式が正しくありません')

  return parsed.suggestions.slice(0, req.count)
}

interface AnalyzeMapRequest {
  apiKey: string
  model: AIModel
  nodes: { id: string; title: string; body?: string; categoryId?: string }[]
  edges: { source: string; target: string }[]
  categories: Category[]
}

export async function analyzeMap(req: AnalyzeMapRequest): Promise<MapAnalysis> {
  const client = new Anthropic({ apiKey: req.apiKey, dangerouslyAllowBrowser: true })

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

  const prompt = `あなたはアイデアマップ分析の専門家です。以下のアイデアマップを分析してください。

【ノード一覧】
${nodeList}

【接続関係】
${edgeList || '（接続なし）'}

以下の3点を分析して、JSON形式のみで回答してください：
1. マップの主要テーマを1〜2文で要約（summary）
2. 見落としているアイデア領域（missingAreas: 最大4個の文字列配列）
3. 最も重要と思われるノードのID（importantNodeIds: 最大3個のID配列）と対応するタイトル（importantNodeTitles）

{
  "summary": "マップの主要テーマの要約文",
  "missingAreas": ["見落としている領域1", "見落としている領域2"],
  "importantNodeIds": ["node-id-1", "node-id-2"],
  "importantNodeTitles": ["タイトル1", "タイトル2"]
}`

  const message = await client.messages.create({
    model: req.model,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('予期しないレスポンス形式です')

  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AIからの応答を解析できませんでした')

  const parsed = JSON.parse(jsonMatch[0]) as MapAnalysis
  return parsed
}

interface SuggestConnectionsRequest {
  apiKey: string
  model: AIModel
  nodes: { id: string; title: string; body?: string }[]
  existingEdges: { source: string; target: string }[]
}

export async function suggestConnections(req: SuggestConnectionsRequest): Promise<ConnectionSuggestion[]> {
  const client = new Anthropic({ apiKey: req.apiKey, dangerouslyAllowBrowser: true })

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
}`

  const message = await client.messages.create({
    model: req.model,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('予期しないレスポンス形式です')

  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AIからの応答を解析できませんでした')

  const parsed = JSON.parse(jsonMatch[0]) as { suggestions: ConnectionSuggestion[] }
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
  apiKey: string
  model: AIModel
  nodes: { id: string; title: string; body?: string }[]
  categories: Category[]
}

export async function suggestClusters(req: SuggestClustersRequest): Promise<ClusterSuggestion[]> {
  const client = new Anthropic({ apiKey: req.apiKey, dangerouslyAllowBrowser: true })

  if (req.nodes.length < 3) return []

  const nodeList = req.nodes.map((n) => `- [${n.id}] ${n.title}`).join('\n')
  const categoryList = req.categories
    .map((c) => `  "${c.id}": ${c.name}`)
    .join('\n')

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
      "nodeIds": ["id1", "id2"],
      "nodeTitles": ["タイトル1", "タイトル2"]
    }
  ]
}`

  const message = await client.messages.create({
    model: req.model,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('予期しないレスポンス形式です')

  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AIからの応答を解析できませんでした')

  const parsed = JSON.parse(jsonMatch[0]) as { clusters: ClusterSuggestion[] }
  if (!Array.isArray(parsed.clusters)) return []

  return parsed.clusters
}

export async function chatWithMap(
  req: ChatWithMapRequest,
  onText?: (partialText: string) => void,
  signal?: AbortSignal,
): Promise<{ content: string; actions: ChatAction[] }> {
  const client = new Anthropic({ apiKey: req.apiKey, dangerouslyAllowBrowser: true })

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

  const systemContext = `あなたは「IdeaMap」のAIアシスタントです。ユーザーのアイデアマップを文脈として理解した上で自由に会話してください。

【現在のマップ: ${req.mapContext.mapTitle}】
ノード数: ${req.mapContext.nodes.length}件

【ノード一覧】
${nodeList}

【接続関係】
${edgeList}${mentionedBlock}

マップ操作を提案したい場合のみ、回答の末尾に以下のJSONブロックを含めてください（アクションがなければ省略）:
\`\`\`actions
{"actions": [{"type": "addNode", "label": "ノードタイトル", "sourceNodeId": "parent-id", "categoryId": "cat-main", "reason": "理由"}]}
\`\`\``

  const apiMessages = req.messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  let accumulated = ''

  try {
    const stream = client.messages.stream(
      {
        model: req.model,
        max_tokens: 2048,
        system: systemContext,
        messages: apiMessages,
      },
      { signal },
    )

    stream.on('text', (delta) => {
      accumulated += delta
      if (onText) {
        // actions ブロックの途中露出を防ぐため除去してから渡す
        onText(accumulated.replace(/```actions[\s\S]*$/, ''))
      }
    })

    await stream.finalMessage()
  } catch (e) {
    // Abort 時はそれまでの累積テキストを返す（エラーとして扱わない）
    if (
      e instanceof Anthropic.APIUserAbortError ||
      (signal?.aborted)
    ) {
      const content = accumulated.replace(/```actions[\s\S]*$/, '').trim()
      return { content, actions: [] }
    }
    throw e
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
  // APIConnectionError は APIError のサブクラスの場合があるため先に判定する
  if (e instanceof Anthropic.APIConnectionError) {
    return 'ネットワークエラーです。接続を確認してください'
  }
  if (e instanceof Anthropic.APIError) {
    if (e.status === 401) return 'APIキーが無効です。設定画面で確認してください'
    if (e.status === 429) return 'レート制限に達しました。1分ほど待ってから再試行してください'
    if (e.status === 529) return 'Claude APIが混雑しています。しばらく待ってから再試行してください'
    return e.message
  }
  return e instanceof Error ? e.message : 'エラーが発生しました'
}
