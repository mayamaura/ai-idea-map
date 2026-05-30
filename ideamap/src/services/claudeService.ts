import Anthropic from '@anthropic-ai/sdk'
import type { AISuggestion, AIModel, Category } from '../types'

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
