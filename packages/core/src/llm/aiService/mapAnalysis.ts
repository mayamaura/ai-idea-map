import type { Category, ClusterSuggestion, ConnectionSuggestion, MapAnalysis } from '../../types'
import type { JsonSchema, LLMProvider } from '../types'
import { buildWebContext, completeJsonWithRetry, jsonInstructionSuffix, type WebSearchOptions } from './shared'

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
