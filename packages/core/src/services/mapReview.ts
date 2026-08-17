/**
 * AIガーデナー（マップレビュー、Phase 47）が使う「放置ノード」の構造的指標による検出。
 * IdeaNodeData/SerializedNode に updatedAt 等の時刻フィールドがないため、正確な放置期間の判定はできない。
 * 代わりに「葉ノード（子を持たない）かつ本文が空、または AI が作ってから誰も手を入れていない
 * （createdBy: 'ai' のまま）」という構造的なヒューリスティックで代替する。LLM 呼び出しは行わない純粋関数。
 */
export function findNeglectedNodeIds(
  nodes: { id: string; body?: string; createdBy: 'user' | 'ai' }[],
  edges: { source: string; target: string }[],
): string[] {
  const parentIds = new Set(edges.map((e) => e.source))
  return nodes
    .filter((n) => !parentIds.has(n.id) && (!n.body?.trim() || n.createdBy === 'ai'))
    .map((n) => n.id)
}
