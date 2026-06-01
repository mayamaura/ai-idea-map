import Anthropic from '@anthropic-ai/sdk'
import type { AISuggestion, AIModel, Category, MapAnalysis, ConnectionSuggestion, ClusterSuggestion } from '../types'

interface SuggestionRequest {
  apiKey: string
  model: AIModel
  selectedNodeTitle: string
  selectedNodeBody?: string
  connectedNodeTitles: string[]
  allNodeTitles: string[]
  count: number
  categories: Category[]
}

export async function generateSuggestions(req: SuggestionRequest): Promise<AISuggestion[]> {
  const client = new Anthropic({ apiKey: req.apiKey, dangerouslyAllowBrowser: true })

  const connectedSection = req.connectedNodeTitles.length > 0
    ? `\n【つながっているアイデア】\n${req.connectedNodeTitles.map((t) => `- ${t}`).join('\n')}`
    : ''

  const contextSection = req.allNodeTitles.length > 0
    ? `\n【マップ全体の文脈（参考）】\n${req.allNodeTitles.slice(0, 10).map((t) => `- ${t}`).join('\n')}`
    : ''

  const bodySection = req.selectedNodeBody
    ? `\n【選択ノードの詳細メモ】\n${req.selectedNodeBody}`
    : ''

  const categoryList = req.categories
    .map((c) => `  "${c.id}": ${c.name}（${c.description ?? ''}）`)
    .join('\n')

  const prompt = `あなたはアイデア発想を助ける専門家です。
以下のアイデアを起点に、創造的で具体的な関連アイデアを${req.count}個提案してください。${connectedSection}${contextSection}

【選択されたアイデア】
${req.selectedNodeTitle}${bodySection}

提案は多様性を持たせ、以下のタイプを組み合わせてください：
- 関連：直接関連する概念や要素
- 深掘り：より詳細に分解したアイデア
- 対比：反対意見や別の視点
- 応用：実際の活用方法や事例

また、各提案に最も適したカテゴリIDを以下から選んでください：
${categoryList}

必ず以下のJSON形式のみで回答してください（説明文は不要）:
{
  "suggestions": [
    {"text": "アイデアのテキスト", "type": "関連", "categoryId": "cat-main"},
    ...
  ]
}`

  const message = await client.messages.create({
    model: req.model,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('予期しないレスポンス形式です')

  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AIからの応答を解析できませんでした')

  const parsed = JSON.parse(jsonMatch[0]) as { suggestions: AISuggestion[] }
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
    max_tokens: 1024,
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
    max_tokens: 1024,
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
    max_tokens: 1024,
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
