import type { Category, GardenerSuggestion } from '../../types'
import type { JsonSchema, LLMProvider } from '../types'
import { findNeglectedNodeIds } from '../../services/mapReview'
import { completeJsonWithRetry, jsonInstructionSuffix } from './shared'

const GARDENER_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', description: 'deepen | merge | bridge | question のいずれか' },
          reason: { type: 'string', description: '提案理由（1文）' },
          targetNodeIds: { type: 'array', items: { type: 'string' } },
          title: { type: 'string', description: 'deepen・question で新規追加するノードのタイトル' },
          body: { type: 'string', description: 'deepen・question で新規追加するノードの本文（省略可）' },
        },
        required: ['kind', 'reason', 'targetNodeIds'],
      },
    },
  },
  required: ['suggestions'],
}

interface ReviewMapRequest {
  provider: LLMProvider
  nodes: { id: string; title: string; body?: string; categoryId?: string; createdBy: 'user' | 'ai'; updatedAt?: string }[]
  edges: { source: string; target: string }[]
  categories: Category[]
}

/**
 * AIガーデナー（マップレビュー、Phase 47）。マップ全体を「深掘り」「統合」「橋渡し」「問いかけ」の
 * 4種の観点でレビューする。findNeglectedNodeIds（構造的指標、LLM呼び出しなし）の結果を
 * 「放置されている可能性のあるノード」としてプロンプトに埋め込み、deepen 候補のヒントにする。
 */
export async function reviewMap(req: ReviewMapRequest, signal?: AbortSignal): Promise<GardenerSuggestion[]> {
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

  const neglectedIds = findNeglectedNodeIds(req.nodes, req.edges)
  const neglectedSection = neglectedIds.length > 0
    ? `\n【放置されている可能性のあるノード（参考）】\n${neglectedIds
        .map((id) => `- [${id}] ${req.nodes.find((n) => n.id === id)?.title ?? id}`)
        .join('\n')}`
    : ''

  const prompt = `あなたは庭師のようにアイデアマップを育てる専門家です。以下のアイデアマップをレビューし、次の4種類の提案をしてください。

【ノード一覧】
${nodeList}

【接続関係】
${edgeList || '（接続なし）'}${neglectedSection}

提案の種類（該当するものだけ、合計最大6件まで。無理に全種類出す必要はない）:
- deepen（深掘り）: 放置されている、または内容が薄いノードを1件選び、掘り下げる子アイデアを提案する。targetNodeIds に対象ノードのIDを1件、title/body に深掘り案の内容を入れる
- merge（統合）: 内容が重複・類似しているノードが2件あれば統合を提案する。targetNodeIds に統合対象の2件を入れる
- bridge（橋渡し）: つながっていない離れたノード同士に関連があれば接続を提案する。targetNodeIds に橋渡しする2件を入れる
- question（問いかけ）: マップ全体で抜けている観点があれば、問いかけとして新しいノードを提案する。関連する既存ノードがあれば targetNodeIds に1件、なければ空配列にし、title/body に問いかけの内容を入れる

各提案の reason に判断理由を1文で入れてください。
必ず以下のJSON形式のみで回答してください（説明文は不要）:
{
  "suggestions": [
    {"kind": "deepen", "reason": "判断理由（1文）", "targetNodeIds": ["node-id"], "title": "深掘り案のタイトル", "body": "詳細（省略可）"}
  ]
}${jsonInstructionSuffix(provider, GARDENER_SCHEMA)}`

  const parsed = await completeJsonWithRetry<{ suggestions: GardenerSuggestion[] }>(
    provider,
    { messages: [{ role: 'user', content: prompt }], maxTokens: 3072 },
    GARDENER_SCHEMA,
    signal,
  )
  if (!Array.isArray(parsed.suggestions)) return []

  return parsed.suggestions.map((s) => ({
    ...s,
    // 小型モデルは targetNodeIds を単一文字列で返すことがあるため、欠けても後段の UI が落ちないようにする
    targetNodeIds: Array.isArray(s.targetNodeIds) ? s.targetNodeIds : [],
  }))
}
