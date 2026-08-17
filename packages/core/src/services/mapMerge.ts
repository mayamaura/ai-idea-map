/**
 * マップの3方向マージ（Phase 53）。
 *
 * Drive 共有フォルダ経由の非同期共同編集では、保存前チェックで mapId 不一致（＝他人が
 * 先に保存した）を検出した後、素朴な「上書き」か「読み直し」の二択だけでは自分か相手の
 * 編集内容がまるごと失われる。base（前回読み込み/保存時点）・mine（自分の現在編集）・
 * theirs（保存先の最新版）の3つを比較し、片方だけが変更した箇所は自動採用、
 * 両方が違う変更をした箇所だけを衝突として返す。
 */
import type { MapFile, SerializedNode, SerializedEdge } from '../types'

export type MergeConflict =
  | { kind: 'node'; id: string; base: SerializedNode | null; mine: SerializedNode | null; theirs: SerializedNode | null }
  | { kind: 'edge'; id: string; base: SerializedEdge | null; mine: SerializedEdge | null; theirs: SerializedEdge | null }

// updatedAt は編集のたびに変わるため一致判定から除く（毎回「変更あり」と誤検出してしまう）
function nodeEqual(a: SerializedNode | null, b: SerializedNode | null): boolean {
  if (a === null || b === null) return a === b
  return (
    a.title === b.title &&
    a.body === b.body &&
    a.color === b.color &&
    a.categoryId === b.categoryId &&
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.parentId === b.parentId &&
    a.url === b.url &&
    a.image === b.image &&
    a.linkedMapId === b.linkedMapId &&
    a.linkedMapOrigin === b.linkedMapOrigin
  )
}

function edgeEqual(a: SerializedEdge | null, b: SerializedEdge | null): boolean {
  if (a === null || b === null) return a === b
  return (
    a.source === b.source &&
    a.target === b.target &&
    a.sourceHandle === b.sourceHandle &&
    a.targetHandle === b.targetHandle &&
    a.label === b.label &&
    a.bidirectional === b.bidirectional
  )
}

interface RawConflict<T> {
  id: string
  base: T | null
  mine: T | null
  theirs: T | null
}

/**
 * id 単位の3方向マージ本体。ノード・エッジで共通のため型パラメータ化している。
 *
 * - base と比べて mine/theirs どちらも無変更 → base のまま
 * - 片方だけが base と異なる（追加・編集・削除いずれも含む）→ その内容を採用
 * - 双方が base と異なるが内容が一致（同じ編集・同じ削除・同じ追加）→ 衝突なしで採用
 * - 双方が base と異なり内容も食い違う → 衝突として積み、暫定的に mine を採用
 */
function mergeById<T extends { id: string }>(
  base: T[],
  mine: T[],
  theirs: T[],
  equal: (a: T | null, b: T | null) => boolean
): { merged: T[]; conflicts: RawConflict<T>[] } {
  const baseMap = new Map(base.map((v) => [v.id, v]))
  const mineMap = new Map(mine.map((v) => [v.id, v]))
  const theirsMap = new Map(theirs.map((v) => [v.id, v]))
  const ids = new Set<string>([...baseMap.keys(), ...mineMap.keys(), ...theirsMap.keys()])

  const merged: T[] = []
  const conflicts: RawConflict<T>[] = []

  for (const id of ids) {
    const baseVal = baseMap.get(id) ?? null
    const mineVal = mineMap.get(id) ?? null
    const theirsVal = theirsMap.get(id) ?? null

    const mineChanged = !equal(mineVal, baseVal)
    const theirsChanged = !equal(theirsVal, baseVal)

    let resolved: T | null
    if (!mineChanged && !theirsChanged) {
      resolved = baseVal
    } else if (mineChanged && !theirsChanged) {
      resolved = mineVal
    } else if (!mineChanged && theirsChanged) {
      resolved = theirsVal
    } else if (equal(mineVal, theirsVal)) {
      resolved = mineVal
    } else {
      conflicts.push({ id, base: baseVal, mine: mineVal, theirs: theirsVal })
      resolved = mineVal
    }

    if (resolved) merged.push(resolved)
  }

  return { merged, conflicts }
}

/**
 * base/mine/theirs の3つの MapFile をマージする。title・mapId・presentationNodeIds 等の
 * マップ全体のメタ情報は mine（自分側）をそのまま引き継ぐ（起票 E: 自分側を優先し変更しない）。
 */
export function mergeMapFiles(
  base: MapFile,
  mine: MapFile,
  theirs: MapFile
): { merged: MapFile; conflicts: MergeConflict[] } {
  const nodeResult = mergeById(base.nodes, mine.nodes, theirs.nodes, nodeEqual)
  const edgeResult = mergeById(base.edges, mine.edges, theirs.edges, edgeEqual)

  const conflicts: MergeConflict[] = [
    ...nodeResult.conflicts.map((c): MergeConflict => ({ kind: 'node', ...c })),
    ...edgeResult.conflicts.map((c): MergeConflict => ({ kind: 'edge', ...c })),
  ]

  return {
    merged: {
      ...mine,
      nodes: nodeResult.merged,
      edges: edgeResult.merged,
      updatedAt: new Date().toISOString(),
    },
    conflicts,
  }
}

/** id が一致する要素を resolved で置き換える／無ければ追加する／resolved が null なら取り除く */
function applySingle<T extends { id: string }>(list: T[], id: string, resolved: T | null): T[] {
  const idx = list.findIndex((v) => v.id === id)
  if (resolved) {
    if (idx < 0) return [...list, resolved]
    const copy = [...list]
    copy[idx] = resolved
    return copy
  }
  return idx < 0 ? list : list.filter((v) => v.id !== id)
}

/**
 * 衝突解決ダイアログでの選択結果を merged に反映する。conflicts に無い id は素通りする。
 * choice が指す側の値が null（削除）なら merged から取り除く。
 */
export function applyConflictResolutions(
  merged: MapFile,
  conflicts: MergeConflict[],
  choices: Record<string, 'mine' | 'theirs'>
): MapFile {
  let nodes = merged.nodes
  let edges = merged.edges

  for (const conflict of conflicts) {
    const choice = choices[conflict.id] ?? 'mine'
    if (conflict.kind === 'node') {
      nodes = applySingle(nodes, conflict.id, choice === 'mine' ? conflict.mine : conflict.theirs)
    } else {
      edges = applySingle(edges, conflict.id, choice === 'mine' ? conflict.mine : conflict.theirs)
    }
  }

  return { ...merged, nodes, edges }
}
