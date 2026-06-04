import type { Node, Edge } from '@xyflow/react'
import Dagre from '@dagrejs/dagre'
import type { IdeaNodeData } from '../types'

const RADIUS = 220
const NODE_WIDTH = 192
const NODE_HEIGHT = 64

const RADIAL_BASE_RADIUS = 220
const RADIAL_RADIUS_INCREMENT = 190

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
  rankdir: 'LR' | 'TB'
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
  rankdir: 'LR' | 'TB'
): { topLevel: Node<IdeaNodeData>[]; childNodes: Node<IdeaNodeData>[] } {
  const childNodes: Node<IdeaNodeData>[] = []

  const topLevel = nodes
    .filter((n) => !n.parentId)
    .map((node) => {
      if (node.type !== 'groupNode') return node

      const children = nodes.filter((c) => c.parentId === node.id)
      if (children.length === 0) return node

      const { children: laid, width, height } = layoutGroupChildren(children, edges, rankdir)
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
    let { x, y } = node.position
    const nodeW = node.measured?.width ?? NODE_WIDTH
    const nodeH = node.measured?.height ?? NODE_HEIGHT

    for (const group of groupNodes) {
      const gW = typeof group.style?.width === 'number' ? group.style.width : 400
      const gH = typeof group.style?.height === 'number' ? group.style.height : 300
      const gx = group.position.x
      const gy = group.position.y

      if (!(x < gx + gW && x + nodeW > gx && y < gy + gH && y + nodeH > gy)) continue

      const dLeft = x + nodeW - gx
      const dRight = gx + gW - x
      const dUp = y + nodeH - gy
      const dDown = gy + gH - y
      const min = Math.min(dLeft, dRight, dUp, dDown)

      if (min === dLeft) x = gx - nodeW
      else if (min === dRight) x = gx + gW
      else if (min === dUp) y = gy - nodeH
      else y = gy + gH
    }

    return x === node.position.x && y === node.position.y
      ? node
      : { ...node, position: { x, y } }
  })
}

/** ルートノード（入力エッジなし）を中心に放射状に配置するレイアウト */
export function applyRadialLayout(
  nodes: Node<IdeaNodeData>[],
  edges: Edge[]
): Node<IdeaNodeData>[] {
  const { topLevel, childNodes } = prepareGroupLayouts(nodes, edges, 'LR')

  if (topLevel.length === 0) return nodes
  if (topLevel.length === 1) {
    return [...topLevel.map((n) => ({ ...n, position: { x: 0, y: 0 } })), ...childNodes]
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

  // サブツリーサイズを計算（角度配分に使用）
  const subtreeSize = new Map<string, number>()
  const sizeVisited = new Set<string>()
  function calcSize(id: string): number {
    if (sizeVisited.has(id)) return 1
    sizeVisited.add(id)
    const children = childrenOf.get(id) ?? []
    const size = children.reduce((s, c) => s + calcSize(c), 1)
    subtreeSize.set(id, size)
    return size
  }
  calcSize(rootId)

  // 再帰的に子を配置
  const positions = new Map<string, { x: number; y: number }>()
  positions.set(rootId, { x: 0, y: 0 })

  function layout(
    parentId: string,
    parentPos: { x: number; y: number },
    startAngle: number,
    totalAngle: number,
    radius: number
  ) {
    const children = (childrenOf.get(parentId) ?? []).filter((c) => !positions.has(c))
    if (children.length === 0) return
    const totalSize = children.reduce((s, c) => s + (subtreeSize.get(c) ?? 1), 0)
    let angle = startAngle
    for (const childId of children) {
      const size = subtreeSize.get(childId) ?? 1
      const span = (size / totalSize) * totalAngle
      const mid = angle + span / 2
      const pos = {
        x: parentPos.x + Math.cos(mid) * radius,
        y: parentPos.y + Math.sin(mid) * radius,
      }
      positions.set(childId, pos)
      layout(childId, pos, angle, span, RADIAL_RADIUS_INCREMENT)
      angle += span
    }
  }

  layout(rootId, { x: 0, y: 0 }, -Math.PI, 2 * Math.PI, RADIAL_BASE_RADIUS)

  // 到達できなかったノード（非連結・孤立）を右側に並べる
  let floatX = RADIAL_BASE_RADIUS * 2 + 100
  for (const node of topLevel) {
    if (!positions.has(node.id)) {
      positions.set(node.id, { x: floatX, y: 0 })
      floatX += NODE_WIDTH + 40
    }
  }

  const laid = topLevel.map((n) => ({ ...n, position: positions.get(n.id) ?? n.position }))
  return [...applyGroupPushOut(laid), ...childNodes]
}

export function applyDagreLayout(
  nodes: Node<IdeaNodeData>[],
  edges: Edge[],
  rankdir: 'LR' | 'TB' = 'LR'
): Node<IdeaNodeData>[] {
  const { topLevel, childNodes } = prepareGroupLayouts(nodes, edges, rankdir)

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
