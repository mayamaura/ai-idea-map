import type { Node, Edge } from '@xyflow/react'
import Dagre from '@dagrejs/dagre'
import type { IdeaNodeData } from '../types'

const RADIUS = 220
const NODE_WIDTH = 192
const NODE_HEIGHT = 64

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

export function applyDagreLayout(
  nodes: Node<IdeaNodeData>[],
  edges: Edge[]
): Node<IdeaNodeData>[] {
  if (nodes.length === 0) return nodes

  const g = new Dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', ranksep: 100, nodesep: 60, marginx: 40, marginy: 40 })

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
