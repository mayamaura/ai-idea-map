import type { Node, Edge } from '@xyflow/react'
import Dagre from '@dagrejs/dagre'
import type { IdeaNodeData } from '../types'

const RADIUS = 220
const NODE_WIDTH = 192
const NODE_HEIGHT = 64

const RADIAL_BASE_RADIUS = 220
const RADIAL_RADIUS_INCREMENT = 190

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
  // 子ノード（parentId あり）はレイアウト対象外。グループ移動で自動追従する
  const childNodes = nodes.filter((n) => n.parentId)
  const topLevel = nodes.filter((n) => !n.parentId)

  if (topLevel.length === 0) return nodes
  if (topLevel.length === 1) {
    return [...topLevel.map((n) => ({ ...n, position: { x: 0, y: 0 } })), ...childNodes]
  }

  // エッジから親→子マップを構築（トップレベルノード間のみ）
  const childrenOf = new Map<string, string[]>()
  const hasParent = new Set<string>()
  topLevel.forEach((n) => childrenOf.set(n.id, []))
  edges.forEach((e) => {
    if (childrenOf.has(e.source) && childrenOf.has(e.target)) {
      childrenOf.get(e.source)!.push(e.target)
      hasParent.add(e.target)
    }
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
  // 子ノード（parentId あり）はレイアウト対象外。グループ移動で自動追従する
  const childNodes = nodes.filter((n) => n.parentId)
  const topLevel = nodes.filter((n) => !n.parentId)

  if (topLevel.length === 0) return nodes

  const topLevelIds = new Set(topLevel.map((n) => n.id))

  const g = new Dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir, ranksep: 100, nodesep: 60, marginx: 40, marginy: 40 })

  topLevel.forEach((node) => {
    // グループノードは実際のサイズを使う
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

  // 子ノードを含むエッジは除外（トップレベル間のエッジのみ）
  edges
    .filter((e) => topLevelIds.has(e.source) && topLevelIds.has(e.target))
    .forEach((edge) => g.setEdge(edge.source, edge.target))

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
