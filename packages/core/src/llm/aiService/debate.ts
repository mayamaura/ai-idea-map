// Phase 48: ペルソナ壁打ち会議
import type { MapContext, PersonaOpinion } from '../../types'
import type { JsonSchema, LLMProvider } from '../types'
import { completeJsonWithRetry, jsonInstructionSuffix } from './shared'

const DEBATE_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    personas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          persona: { type: 'string', description: 'ペルソナ名' },
          opinions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: '意見の簡潔なタイトル（20字以内）' },
                body: { type: 'string', description: '意見の詳細' },
              },
              required: ['title', 'body'],
            },
          },
        },
        required: ['persona', 'opinions'],
      },
    },
  },
  required: ['personas'],
}

interface DebateNodeRequest {
  provider: LLMProvider
  mapContext: MapContext
  nodeId: string
  personas: string[]
}

/**
 * 指定ノードについて複数ペルソナの意見をまとめて生成する。
 * ペルソナごとに個別に呼ぶとコストが人数倍になるため、1回の completeJsonWithRetry で
 * 全員分を構造化出力させる（generateSuggestions が1回で複数件出す設計と同じ考え方）。
 */
export async function debateNode(req: DebateNodeRequest, signal?: AbortSignal): Promise<PersonaOpinion[]> {
  const { provider } = req
  const targetNode = req.mapContext.nodes.find((n) => n.id === req.nodeId)
  if (!targetNode) throw new Error('対象ノードが見つかりません')

  const bodySection = targetNode.body ? `\n【対象アイデアの詳細メモ】\n${targetNode.body}` : ''

  const connectedIds = new Set<string>()
  req.mapContext.edges.forEach((e) => {
    if (e.source === req.nodeId) connectedIds.add(e.target)
    if (e.target === req.nodeId) connectedIds.add(e.source)
  })
  const connectedNodes = req.mapContext.nodes.filter((n) => connectedIds.has(n.id))
  const connectedSection = connectedNodes.length > 0
    ? `\n【つながっているアイデア】\n${connectedNodes.map((n) => {
        const bodyPreview = n.body ? `（メモ: ${n.body.slice(0, 80)}）` : ''
        return `- ${n.title}${bodyPreview}`
      }).join('\n')}`
    : ''

  const personaList = req.personas.map((p) => `- ${p}`).join('\n')

  const prompt = `あなたは複数のペルソナになりきってアイデアを検討する壁打ち相手です。以下のアイデアについて、指定された各ペルソナの立場から率直な意見を出してください。

【検討するアイデア】
${targetNode.title}${bodySection}${connectedSection}

【ペルソナ】
${personaList}

各ペルソナごとに1〜3件の意見を出してください。それぞれ簡潔なタイトルと詳細な本文をつけてください。
必ず以下のJSON形式のみで回答してください（説明文は不要）:
{
  "personas": [
    {
      "persona": "ペルソナ名（【ペルソナ】の一覧と同じ表記）",
      "opinions": [
        {"title": "簡潔なタイトル（20字以内）", "body": "意見の詳細"}
      ]
    }
  ]
}${jsonInstructionSuffix(provider, DEBATE_SCHEMA)}`

  const parsed = await completeJsonWithRetry<{ personas: PersonaOpinion[] }>(
    provider,
    { messages: [{ role: 'user', content: prompt }], maxTokens: 3072 },
    DEBATE_SCHEMA,
    signal,
  )
  if (!Array.isArray(parsed.personas)) throw new Error('AIからの応答形式が正しくありません')

  return parsed.personas.map((p) => ({
    persona: p.persona,
    // 小型モデルは opinions を欠かすことがあるため、欠けても後段の UI が落ちないようにする
    opinions: Array.isArray(p.opinions) ? p.opinions : [],
  }))
}
