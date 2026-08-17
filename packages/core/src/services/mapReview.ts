/** この日数以上更新がなければ放置ノードとみなす（updatedAt を持つノードの判定基準） */
const NEGLECTED_DAYS_THRESHOLD = 30
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * AIガーデナー（マップレビュー、Phase 47）が使う「放置ノード」の検出。
 * Phase 49 でノード単位の updatedAt を追加したため、それを持つノードは経過日数（既定30日）で
 * 判定する。旧ファイル由来で updatedAt を持たないノードは、従来どおり「葉ノード（子を持たない）
 * かつ本文が空、または AI が作ってから誰も手を入れていない（createdBy: 'ai' のまま）」という
 * 構造的なヒューリスティックにフォールバックする。LLM 呼び出しは行わない純粋関数。
 */
export function findNeglectedNodeIds(
  nodes: { id: string; body?: string; createdBy: 'user' | 'ai'; updatedAt?: string }[],
  edges: { source: string; target: string }[],
): string[] {
  const parentIds = new Set(edges.map((e) => e.source))
  const now = Date.now()
  return nodes
    .filter((n) => {
      if (parentIds.has(n.id)) return false
      if (n.updatedAt) {
        const elapsedDays = (now - new Date(n.updatedAt).getTime()) / DAY_MS
        return elapsedDays >= NEGLECTED_DAYS_THRESHOLD
      }
      return !n.body?.trim() || n.createdBy === 'ai'
    })
    .map((n) => n.id)
}
