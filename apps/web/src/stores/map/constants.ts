import { MarkerType, type Edge, type EdgeMarker } from '@xyflow/react'
import { v4 as uuidv4 } from 'uuid'
import type { IdeaNode } from './types'

export const DEFAULT_NODE_COLOR = '#ffffff'
export const GROUP_NODE_COLOR = 'rgba(147, 197, 253, 0.15)'

const EDGE_COLOR = '#94a3b8'
export const ARROW: EdgeMarker = { type: MarkerType.ArrowClosed, width: 16, height: 16, color: EDGE_COLOR }
export const EDGE_STYLE = { stroke: EDGE_COLOR, strokeWidth: 1.5 }

export const initialNodes: IdeaNode[] = [
  {
    id: 'root',
    type: 'ideaNode',
    position: { x: 0, y: 0 },
    data: { title: 'メインアイデア', color: '#e0e7ff', createdBy: 'user', categoryId: 'cat-main' },
  },
]

export interface EdgeSeed {
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

/** 有向エッジ（矢印付き）を生成する。bidirectional のときは両端に矢印を付ける */
export function makeEdge(seed: EdgeSeed, bidirectional = false): Edge {
  return {
    id: uuidv4(),
    type: 'floating',
    source: seed.source,
    target: seed.target,
    sourceHandle: seed.sourceHandle ?? undefined,
    targetHandle: seed.targetHandle ?? undefined,
    markerEnd: ARROW,
    markerStart: bidirectional ? ARROW : undefined,
    style: EDGE_STYLE,
  }
}
