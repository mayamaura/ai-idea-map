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

/** ルートノード（入力エッジなし）を中心に放射状に配置するレイアウト */
export function applyRadialLayout(
  nodes: Node<IdeaNodeData>[],
  edges: Edge[]
): Node<IdeaNodeData>[] {
  if (nodes.length === 0) return nodes
  if (nodes.length === 1) return [{ ...nodes[0], position: { x: 0, y: 0 } }]

  // エッジから親→子マップを構築
  const childrenOf = new Map<string, string[]>()
  const hasParent = new Set<string>()
  nodes.forEach((n) => childrenOf.set(n.id, []))
  edges.forEach((e) => {
    if (childrenOf.has(e.source) && childrenOf.has(e.target)) {
      childrenOf.get(e.source)!.push(e.target)
      hasParent.add(e.target)
    }
  })

  // ルート（入力エッジなし）を選択
  const rootId = nodes.find((n) => !hasParent.has(n.id))?.id ?? nodes[0].id

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
  for (const node of nodes) {
    if (!positions.has(node.id)) {
      positions.set(node.id, { x: floatX, y: 0 })
      floatX += NODE_WIDTH + 40
    }
  }

  return nodes.map((n) => ({ ...n, position: positions.get(n.id) ?? n.position }))
}

export function applyDagreLayout(
  nodes: Node<IdeaNodeData>[],
  edges: Edge[],
  rankdir: 'LR' | 'TB' = 'LR'
): Node<IdeaNodeData>[] {
  if (nodes.length === 0) return nodes

  const g = new Dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir, ranksep: 100, nodesep: 60, marginx: 40, marginy: 40 })

  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  })
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target)
  })

  Dagre.layout(g)

  return nodes.map((node) => {
    const pos = g.node(node.id)
    if (!pos) return node
    return {
      ...node,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
    }
  })
}
