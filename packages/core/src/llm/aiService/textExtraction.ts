// Phase 44: ブレインダンプ→マップ生成
import type { JsonSchema, LLMProvider } from '../types'
import { completeJsonWithRetry, jsonInstructionSuffix } from './shared'

export interface ExtractedNode {
  tempId: string
  title: string
  body?: string
  categoryId?: string
  /** 新規ノード同士の親子（ExtractedNode.tempId を指す） */
  parentTempId?: string
  /** 既存マップへの追記時、既存ノードにぶら下げる場合の実ノードID */
  parentNodeId?: string
}

export interface ExtractMapRequest {
  provider: LLMProvider
  text: string
  categories: { id: string; name: string }[]
  /** 追記モードのとき渡す。AI はここにある id を parentNodeId に使ってよい */
  existingNodes?: { id: string; title: string }[]
}

const EXTRACT_MAP_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tempId: { type: 'string', description: 'このレスポンス内でユニークな一時ID' },
          title: { type: 'string', description: '簡潔なタイトル（20字目安）' },
          body: { type: 'string', description: '詳細・補足' },
          categoryId: { type: 'string', description: 'カテゴリID' },
          parentTempId: { type: 'string', description: '新規ノード同士の親子関係。親ノードの tempId' },
          parentNodeId: { type: 'string', description: '既存マップのノードに接続する場合、その実ノードID' },
        },
        required: ['tempId', 'title'],
      },
    },
  },
  required: ['nodes'],
}

// 貼り付けテキストが極端に長いとコンテキストを圧迫するため、先頭からこの文字数で切る
// （議事録・メモの用途では要点が前半に出やすいため、先頭優先で妥当という判断）
const EXTRACT_MAP_MAX_TEXT_LENGTH = 8000

/**
 * AI応答の防御的検証。小型モデルほど tempId の重複・存在しない親・循環参照を作りやすいため、
 * ここで壊れた構造を「ルート扱い」に落として後段（textToMap）が安全に木構造を組めるようにする。
 * buildMapFragmentFromExtracted からも直接呼べるよう export する（不正な入力を単体で検証するため）。
 */
export function sanitizeExtractedNodes(raw: ExtractedNode[]): ExtractedNode[] {
  // tempId 重複は Map の上書きで自然に「後勝ち」になる
  const byTempId = new Map<string, ExtractedNode>()
  for (const n of raw) {
    if (!n?.tempId || !n.title?.trim()) continue
    byTempId.set(n.tempId, n)
  }

  const tempIds = new Set(byTempId.keys())
  const dropParent = (n: ExtractedNode): ExtractedNode => ({ ...n, parentTempId: undefined })

  // 存在しない tempId を指す parentTempId はルート扱い
  const withValidParents = [...byTempId.values()].map((n) =>
    n.parentTempId && !tempIds.has(n.parentTempId) ? dropParent(n) : n
  )

  // 循環参照検出: parentTempId を辿って同じノードを2回踏んだら、その連鎖はどこにもルートに到達しない
  // ＝循環に巻き込まれている。巻き込まれた側はすべてルート扱いに落とす
  const parentOf = new Map(withValidParents.map((n) => [n.tempId, n.parentTempId]))
  const isInCycle = (startId: string): boolean => {
    const seen = new Set<string>()
    let cur: string | undefined = startId
    while (cur) {
      if (seen.has(cur)) return true
      seen.add(cur)
      cur = parentOf.get(cur)
    }
    return false
  }

  return withValidParents.map((n) => (n.parentTempId && isInCycle(n.tempId) ? dropParent(n) : n))
}

/** 貼り付けたテキスト（議事録・メモ・箇条書き等）から階層的なアイデア構造を抽出する */
export async function extractMapFromText(req: ExtractMapRequest, signal?: AbortSignal): Promise<ExtractedNode[]> {
  const { provider } = req
  const text = req.text.length > EXTRACT_MAP_MAX_TEXT_LENGTH
    ? req.text.slice(0, EXTRACT_MAP_MAX_TEXT_LENGTH)
    : req.text

  const categoryList = req.categories.map((c) => `  "${c.id}": ${c.name}`).join('\n')

  const existingSection = req.existingNodes && req.existingNodes.length > 0
    ? `\n【追記先の既存マップのノード】\n${req.existingNodes.map((n) => `- [${n.id}] ${n.title}`).join('\n')}\n関連が明確なときだけ、新規ノードの parentNodeId に上記の id を指定して既存ノードにぶら下げてよい。無理に繋げず独立したツリーのままでもよい。`
    : ''

  const prompt = `あなたは議事録・メモ・箇条書きなどの雑多なテキストから、構造化されたアイデアマップを抽出する専門家です。
以下のテキストを読み、階層的なアイデア構造として整理してください。

【テキスト】
${text}

抽出のルール:
- タイトルは簡潔に（20字目安）。長い説明や具体例は body に書く
- 意味のあるまとまりごとに親子関係を作る。1つのテーマに限定する必要はなく、独立した複数のトピックがあれば複数のツリーを作ってよい
- 各ノードに、このレスポンス内でユニークな tempId を振る。子ノードは parentTempId に親ノードの tempId を指定する。ルート（トップレベル）のノードは parentTempId を省略する
- 最も適したカテゴリIDがあれば categoryId に設定する（任意・無理に当てはめなくてよい）。カテゴリ一覧:
${categoryList}${existingSection}

必ず以下のJSON形式のみで回答してください（説明文は不要）:
{
  "nodes": [
    {"tempId": "n1", "title": "簡潔なタイトル", "body": "詳細（省略可）", "categoryId": "cat-main"},
    {"tempId": "n2", "title": "子アイデア", "parentTempId": "n1"}
  ]
}${jsonInstructionSuffix(provider, EXTRACT_MAP_SCHEMA)}`

  const parsed = await completeJsonWithRetry<{ nodes: ExtractedNode[] }>(
    provider,
    { messages: [{ role: 'user', content: prompt }], maxTokens: 4096 },
    EXTRACT_MAP_SCHEMA,
    signal,
  )
  if (!Array.isArray(parsed.nodes)) throw new Error('AIからの応答形式が正しくありません')

  return sanitizeExtractedNodes(parsed.nodes)
}
