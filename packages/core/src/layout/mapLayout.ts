import type { Node, Edge } from '@xyflow/react'
import type { IdeaNodeData } from '../types'
import { computePushOut, type Size } from './groupGeometry'

type DagreModule = typeof import('@dagrejs/dagre').default

// dagre は「整列」実行時にしか使わないため初回ロードから外し、実行時に一度だけ取得する
let dagrePromise: Promise<DagreModule> | null = null

function loadDagre(): Promise<DagreModule> {
  if (!dagrePromise) {
    dagrePromise = import('@dagrejs/dagre').then((m) => m.default)
  }
  return dagrePromise
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * from→to の位置変化を requestAnimationFrame でアニメーションする。
 * 各フレームで onFrame を呼び、完了時に onDone を呼ぶ。
 * 返すキャンセル関数を呼ぶと途中でアニメーションを停止する。
 */
export function animateNodePositions(
  from: Node<IdeaNodeData>[],
  to: Node<IdeaNodeData>[],
  onFrame: (nodes: Node<IdeaNodeData>[]) => void,
  onDone: () => void,
  duration = 400
): () => void {
  const fromMap = new Map<string, { x: number; y: number }>()
  from.forEach((n) => fromMap.set(n.id, n.position))

  let rafId: number
  let startTime: number | null = null

  function tick(now: number) {
    if (startTime === null) startTime = now
    const elapsed = now - startTime
    const t = Math.min(elapsed / duration, 1)
    const eased = easeInOutCubic(t)

    const interpolated = to.map((n) => {
      const fromPos = fromMap.get(n.id)
      if (!fromPos) return n
      return {
        ...n,
        position: {
          x: fromPos.x + (n.position.x - fromPos.x) * eased,
          y: fromPos.y + (n.position.y - fromPos.y) * eased,
        },
      }
    })

    onFrame(interpolated)

    if (t < 1) {
      rafId = requestAnimationFrame(tick)
    } else {
      onDone()
    }
  }

  rafId = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(rafId)
}

/**
 * desired 位置を起点に、既存ノードと重ならない位置を探す。
 * フリーノード同士の重なりのみ対象（groupNode・parentId 付きは除外）。
 * 最大10回試行して候補を返す。
 */
export function findFreePosition(
  desired: { x: number; y: number },
  existingNodes: Node<IdeaNodeData>[]
): { x: number; y: number } {
  const freeNodes = existingNodes.filter((n) => n.type !== 'groupNode' && !n.parentId)
  let candidate = { ...desired }

  for (let i = 0; i < 10; i++) {
    const overlaps = freeNodes.some((n) => {
      const dx = n.position.x - candidate.x
      const dy = n.position.y - candidate.y
      return Math.abs(dx) < 200 && Math.abs(dy) < 80
    })
    if (!overlaps) break
    candidate = { x: candidate.x, y: candidate.y + 90 }
  }

  return candidate
}

const RADIUS = 220
const NODE_WIDTH = 192
const NODE_HEIGHT = 64
const LAYOUT_NODE_SIZE: Size = { width: NODE_WIDTH, height: NODE_HEIGHT }

const RADIAL_MIN_STEP = 240 // 親→子の最短距離
const RADIAL_GAP = 48 // サブツリー同士にあけるすき間
// ルート以外が子を広げてよい最大角。実際の扇は「必要な角度の1.25倍」までしか使わないので、
// 上限まで広がるのは子が多くて詰まっているときだけ。狭くすると代わりに子が遠くへ押し出される
const RADIAL_SPREAD = (Math.PI * 4) / 3

const GROUP_PADDING = 40
const GROUP_LABEL_AREA = 36 // ラベルバッジ用の上部スペース

export function calcSuggestionPositions(
  parentX: number,
  parentY: number,
  count: number,
  existingNodes: Node<IdeaNodeData>[]
): Array<{ x: number; y: number }> {
  return Array.from({ length: count }, (_, idx) => {
    const angle = (idx / count) * Math.PI * 2 - Math.PI / 2
    let x = parentX + Math.cos(angle) * RADIUS
    let y = parentY + Math.sin(angle) * RADIUS

    for (let attempt = 0; attempt < 5; attempt++) {
      const overlaps = existingNodes.some((n) => {
        const dx = Math.abs(n.position.x - x)
        const dy = Math.abs(n.position.y - y)
        return dx < NODE_WIDTH && dy < NODE_HEIGHT
      })
      if (!overlaps) break
      x += Math.cos(angle) * 60
      y += Math.sin(angle) * 60
    }

    return { x, y }
  })
}

/** グループ内の子ノードを整列し、フィットするグループサイズを返す */
function layoutGroupChildren(
  children: Node<IdeaNodeData>[],
  edges: Edge[],
  rankdir: 'LR' | 'TB',
  Dagre: DagreModule
): { children: Node<IdeaNodeData>[]; width: number; height: number } {
  if (children.length === 0) return { children, width: 200, height: 150 }

  if (children.length === 1) {
    const positioned = [
      { ...children[0], position: { x: GROUP_PADDING, y: GROUP_LABEL_AREA + GROUP_PADDING } },
    ]
    return {
      children: positioned,
      width: NODE_WIDTH + GROUP_PADDING * 2,
      height: NODE_HEIGHT + GROUP_LABEL_AREA + GROUP_PADDING * 2,
    }
  }

  const childIds = new Set(children.map((n) => n.id))
  const innerEdges = edges.filter((e) => childIds.has(e.source) && childIds.has(e.target))

  const g = new Dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir, ranksep: 60, nodesep: 40, marginx: 0, marginy: 0 })

  children.forEach((node) => g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT }))
  innerEdges.forEach((edge) => g.setEdge(edge.source, edge.target))

  Dagre.layout(g)

  const laidChildren = children.map((node) => {
    const pos = g.node(node.id)
    if (!pos) return { ...node, position: { x: 0, y: 0 } }
    return {
      ...node,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
    }
  })

  const minX = Math.min(...laidChildren.map((n) => n.position.x))
  const minY = Math.min(...laidChildren.map((n) => n.position.y))
  const maxX = Math.max(...laidChildren.map((n) => n.position.x + NODE_WIDTH))
  const maxY = Math.max(...laidChildren.map((n) => n.position.y + NODE_HEIGHT))

  // 子ノードをグループ左上からオフセット（ラベル領域＋パディング分）
  const dx = GROUP_PADDING - minX
  const dy = GROUP_LABEL_AREA + GROUP_PADDING - minY

  const positioned = laidChildren.map((n) => ({
    ...n,
    position: { x: n.position.x + dx, y: n.position.y + dy },
  }))

  return {
    children: positioned,
    width: Math.max(maxX - minX + GROUP_PADDING * 2, 200),
    height: Math.max(maxY - minY + GROUP_LABEL_AREA + GROUP_PADDING * 2, 150),
  }
}

/**
 * 各グループの子ノードを内部整列し、グループサイズを更新する。
 * 返す topLevel にはサイズ更新済みのグループノードが含まれ、
 * 子ノードは新しい相対座標で childNodes に入る。
 */
function prepareGroupLayouts(
  nodes: Node<IdeaNodeData>[],
  edges: Edge[],
  rankdir: 'LR' | 'TB',
  Dagre: DagreModule
): { topLevel: Node<IdeaNodeData>[]; childNodes: Node<IdeaNodeData>[] } {
  const childNodes: Node<IdeaNodeData>[] = []

  const topLevel = nodes
    .filter((n) => !n.parentId)
    .map((node) => {
      if (node.type !== 'groupNode') return node

      const children = nodes.filter((c) => c.parentId === node.id)
      if (children.length === 0) return node

      const { children: laid, width, height } = layoutGroupChildren(children, edges, rankdir, Dagre)
      childNodes.push(...laid)
      return { ...node, style: { ...node.style, width, height } }
    })

  return { topLevel, childNodes }
}

/** レイアウト後にフリーノードがグループ枠と重なっていたら押し出す */
function applyGroupPushOut(nodes: Node<IdeaNodeData>[]): Node<IdeaNodeData>[] {
  const groupNodes = nodes.filter((n) => n.type === 'groupNode')
  if (groupNodes.length === 0) return nodes

  return nodes.map((node) => {
    if (node.type === 'groupNode' || node.parentId) return node
    // 整列直後は measured が未確定なことがあるためレイアウト用の想定サイズを使う
    const pushed = computePushOut(node.position, node.measured, groupNodes, LAYOUT_NODE_SIZE)
    return pushed.x === node.position.x && pushed.y === node.position.y
      ? node
      : { ...node, position: pushed }
  })
}

/** ルートノード（入力エッジなし）を中心に放射状に配置するレイアウト */
export async function applyRadialLayout(
  nodes: Node<IdeaNodeData>[],
  edges: Edge[]
): Promise<Node<IdeaNodeData>[]> {
  const Dagre = await loadDagre()
  const { topLevel, childNodes } = prepareGroupLayouts(nodes, edges, 'LR', Dagre)

  if (topLevel.length === 0) return nodes

  const sizeOf = (n: Node<IdeaNodeData>): Size =>
    n.type === 'groupNode' &&
    typeof n.style?.width === 'number' &&
    typeof n.style?.height === 'number'
      ? { width: n.style.width, height: n.style.height }
      : LAYOUT_NODE_SIZE
  // 座標は中心基準で計算し、最後に左上へ直す
  const toTopLeft = (n: Node<IdeaNodeData>, p: { x: number; y: number }) => {
    const { width, height } = sizeOf(n)
    return { x: p.x - width / 2, y: p.y - height / 2 }
  }

  if (topLevel.length === 1) {
    return [
      ...topLevel.map((n) => ({ ...n, position: toTopLeft(n, { x: 0, y: 0 }) })),
      ...childNodes,
    ]
  }

  // 子ノード→親グループのマップ（グループをまたぐエッジを親グループIDに解決するため）
  const topLevelIds = new Set(topLevel.map((n) => n.id))
  const childToGroup = new Map<string, string>()
  nodes.forEach((n) => {
    if (n.parentId && topLevelIds.has(n.parentId)) childToGroup.set(n.id, n.parentId)
  })
  const resolveId = (id: string) => childToGroup.get(id) ?? id

  // エッジから親→子マップを構築（子ノードのエッジは親グループに解決してから追加）
  const childrenOf = new Map<string, string[]>()
  const hasParent = new Set<string>()
  topLevel.forEach((n) => childrenOf.set(n.id, []))
  const addedEdgeKeys = new Set<string>()
  edges.forEach((e) => {
    const src = resolveId(e.source)
    const tgt = resolveId(e.target)
    if (src === tgt) return // 同グループ内エッジはスキップ
    if (!childrenOf.has(src) || !childrenOf.has(tgt)) return
    const key = `${src}→${tgt}`
    if (addedEdgeKeys.has(key)) return
    addedEdgeKeys.add(key)
    childrenOf.get(src)!.push(tgt)
    hasParent.add(tgt)
  })

  // ルート（入力エッジなし）を選択
  const rootId = topLevel.find((n) => !hasParent.has(n.id))?.id ?? topLevel[0].id

  // balloon レイアウト。各ノードは「自分のサブツリー全体を包む円」の半径を持ち、
  // 子はその親を中心とするリング上に、円同士が重ならない角度間隔で並ぶ。
  // 子が親のすぐ近くに固まるので、末端が親から離れすぎない。
  const nodeById = new Map(topLevel.map((n) => [n.id, n]))
  const enclosingRadius = (id: string) => {
    const { width, height } = sizeOf(nodeById.get(id)!)
    return Math.hypot(width, height) / 2
  }

  /**
   * 距離 ra・rb に置いた2つの子サブツリー（円の半径 sa・sb）の円が触れ合わないために
   * 要る角度。余弦定理を距離の条件 `chord ≧ sa + sb + GAP` について解いたもの。
   */
  const separation = (ra: number, rb: number, sa: number, sb: number) => {
    const need = sa + sb + RADIAL_GAP
    return Math.acos(Math.max(-1, Math.min(1, (ra * ra + rb * rb - need * need) / (2 * ra * rb))))
  }

  /** 隣り合う子のあいだに要る角度。ルートは円周を一周するので末尾→先頭のぶんも要る */
  const gapsBetween = (rings: number[], subRadii: number[], isRoot: boolean) => {
    const gaps: number[] = []
    for (let i = 0; i + 1 < rings.length; i++) {
      gaps.push(separation(rings[i], rings[i + 1], subRadii[i], subRadii[i + 1]))
    }
    const last = rings.length - 1
    if (isRoot && last > 0) gaps.push(separation(rings[last], rings[0], subRadii[last], subRadii[0]))
    return gaps
  }

  const ringsOf = new Map<string, number[]>()
  const subtreeRadius = new Map<string, number>()
  const kidsOf = new Map<string, string[]>()
  const measured = new Set<string>([rootId])

  function measure(id: string, isRoot: boolean): number {
    const found = (childrenOf.get(id) ?? []).filter((c) => !measured.has(c))
    found.forEach((c) => measured.add(c)) // 同じノードが複数の親にぶら下がるのを防ぐ

    const selfRadius = enclosingRadius(id)
    if (found.length === 0) {
      kidsOf.set(id, found)
      subtreeRadius.set(id, selfRadius)
      return selfRadius
    }

    // 大きいサブツリーを扇の中央（＝親の真正面）に、小さいものを端に寄せる。
    // 端の子は親の横に回り込むので、そこに大きな枝が来ると全体が親の背後へはみ出す
    const measuredRadii = found.map((c) => measure(c, false))
    const order = found
      .map((_, i) => i)
      .sort((a, b) => measuredRadii[b] - measuredRadii[a])
      .reduce<number[]>((acc, i, rank) => (rank % 2 === 0 ? [...acc, i] : [i, ...acc]), [])
    const kids = order.map((i) => found[i])
    kidsOf.set(id, kids)

    // 子ごとに距離を変える。小さい枝は親のすぐそば、大きい枝だけ遠くに置ける
    const subRadii = order.map((i) => measuredRadii[i])
    let rings = subRadii.map((s) => Math.max(RADIAL_MIN_STEP, selfRadius + s + RADIAL_GAP))
    const arc = isRoot ? Math.PI * 2 : RADIAL_SPREAD
    const fits = () => gapsBetween(rings, subRadii, isRoot).reduce((s, g) => s + g, 0) <= arc
    for (let i = 0; i < 100 && !fits(); i++) rings = rings.map((r) => r * 1.12)

    ringsOf.set(id, rings)
    const radius = Math.max(...rings.map((r, i) => r + subRadii[i]))
    subtreeRadius.set(id, radius)
    return radius
  }
  measure(rootId, true)

  const positions = new Map<string, { x: number; y: number }>()

  function place(
    id: string,
    pos: { x: number; y: number },
    awayAngle: number,
    isRoot: boolean
  ): void {
    positions.set(id, pos)
    const kids = kidsOf.get(id) ?? []
    if (kids.length === 0) return

    const rings = ringsOf.get(id)!
    const subRadii = kids.map((c) => subtreeRadius.get(c)!)
    const gaps = gapsBetween(rings, subRadii, isRoot)
    const needed = gaps.reduce((s, g) => s + g, 0)

    // ルートは円周いっぱいに散らす。それ以外は必要角の1.25倍までに留めて、
    // サブツリーを親の反対方向にまとまった扇として広げる
    const spread = isRoot ? Math.PI * 2 : Math.min(RADIAL_SPREAD, needed * 1.25)
    const scale = needed > 0 ? spread / needed : 0
    let angle = isRoot ? -Math.PI / 2 : awayAngle - spread / 2

    kids.forEach((kid, i) => {
      const childPos = {
        x: pos.x + Math.cos(angle) * rings[i],
        y: pos.y + Math.sin(angle) * rings[i],
      }
      place(kid, childPos, angle, false)
      if (i < gaps.length) angle += gaps[i] * scale
    })
  }
  place(rootId, { x: 0, y: 0 }, 0, true)

  // 到達できなかったノード（非連結・孤立）は木全体の外側に並べる
  const extent = subtreeRadius.get(rootId)! + RADIAL_GAP
  let floatX = extent + NODE_WIDTH
  for (const node of topLevel) {
    if (!positions.has(node.id)) {
      positions.set(node.id, { x: floatX, y: 0 })
      floatX += sizeOf(node).width + RADIAL_GAP
    }
  }

  const laid = topLevel.map((n) => {
    const p = positions.get(n.id)
    return p ? { ...n, position: toTopLeft(n, p) } : n
  })
  return [...applyGroupPushOut(laid), ...childNodes]
}

export async function applyDagreLayout(
  nodes: Node<IdeaNodeData>[],
  edges: Edge[],
  rankdir: 'LR' | 'TB' = 'LR'
): Promise<Node<IdeaNodeData>[]> {
  const Dagre = await loadDagre()
  const { topLevel, childNodes } = prepareGroupLayouts(nodes, edges, rankdir, Dagre)

  if (topLevel.length === 0) return nodes

  const topLevelIds = new Set(topLevel.map((n) => n.id))

  // 子ノード→親グループのマップ（グループをまたぐエッジを親グループIDに解決するため）
  const childToGroup = new Map<string, string>()
  nodes.forEach((n) => {
    if (n.parentId && topLevelIds.has(n.parentId)) childToGroup.set(n.id, n.parentId)
  })
  const resolveId = (id: string) => childToGroup.get(id) ?? id

  const g = new Dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir, ranksep: 100, nodesep: 60, marginx: 40, marginy: 40 })

  topLevel.forEach((node) => {
    // グループノードは内部整列後の実サイズを使う
    const w =
      node.type === 'groupNode' && typeof node.style?.width === 'number'
        ? node.style.width
        : NODE_WIDTH
    const h =
      node.type === 'groupNode' && typeof node.style?.height === 'number'
        ? node.style.height
        : NODE_HEIGHT
    g.setNode(node.id, { width: w, height: h })
  })

  // 子ノードのエッジも親グループIDに解決してトップレベル間エッジとして追加
  const addedEdgeKeys = new Set<string>()
  edges.forEach((edge) => {
    const src = resolveId(edge.source)
    const tgt = resolveId(edge.target)
    if (src === tgt) return // 同グループ内エッジはスキップ
    if (!topLevelIds.has(src) || !topLevelIds.has(tgt)) return
    const key = `${src}→${tgt}`
    if (addedEdgeKeys.has(key)) return
    addedEdgeKeys.add(key)
    g.setEdge(src, tgt)
  })

  Dagre.layout(g)

  const laid = topLevel.map((node) => {
    const pos = g.node(node.id)
    if (!pos) return node
    const w =
      node.type === 'groupNode' && typeof node.style?.width === 'number'
        ? node.style.width
        : NODE_WIDTH
    const h =
      node.type === 'groupNode' && typeof node.style?.height === 'number'
        ? node.style.height
        : NODE_HEIGHT
    return {
      ...node,
      position: { x: pos.x - w / 2, y: pos.y - h / 2 },
    }
  })

  return [...applyGroupPushOut(laid), ...childNodes]
}
