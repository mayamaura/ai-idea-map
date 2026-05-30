import { create } from 'zustand'
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type EdgeMarker,
} from '@xyflow/react'
import { v4 as uuidv4 } from 'uuid'
import type { IdeaNodeData, SerializedNode, SerializedEdge } from '../types'

type IdeaNode = Node<IdeaNodeData>

const DEFAULT_NODE_COLOR = '#ffffff'
const MAX_HISTORY = 50
const EDGE_COLOR = '#94a3b8'
const ARROW: EdgeMarker = { type: MarkerType.ArrowClosed, width: 16, height: 16, color: EDGE_COLOR }
const EDGE_STYLE = { stroke: EDGE_COLOR, strokeWidth: 1.5 }

interface EdgeSeed {
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

/** 有向エッジ（矢印付き）を生成する。bidirectional のときは両端に矢印を付ける */
function makeEdge(seed: EdgeSeed, bidirectional = false): Edge {
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

interface Snapshot {
  nodes: IdeaNode[]
  edges: Edge[]
}

interface MapState {
  nodes: IdeaNode[]
  edges: Edge[]
  past: Snapshot[]
  future: Snapshot[]
  clipboard: IdeaNode[]
  onNodesChange: (changes: NodeChange<IdeaNode>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  addNode: (text: string, x: number, y: number, createdBy?: 'user' | 'ai', color?: string) => string
  addConnectedNode: (parentId: string, text?: string) => string | null
  updateNodeText: (id: string, text: string) => void
  updateNodeColor: (id: string, color: string) => void
  deleteNode: (id: string) => void
  deleteNodes: (ids: string[]) => void
  deleteSelected: () => void
  deleteNodeEdges: (nodeId: string) => void
  deleteEdge: (id: string) => void
  reverseEdge: (id: string) => void
  toggleEdgeDirection: (id: string) => void
  updateEdgeLabel: (id: string, label: string) => void
  copyNodes: (ids: string[]) => void
  paste: (position?: { x: number; y: number }) => void
  hasConnectedEdges: (nodeId: string) => boolean
  setNodes: (nodes: IdeaNode[]) => void
  loadFromSerialized: (nodes: SerializedNode[], edges: SerializedEdge[]) => void
  getSerializedNodes: () => SerializedNode[]
  getSerializedEdges: () => SerializedEdge[]
  undo: () => void
  redo: () => void
  reset: () => void
}

const initialNodes: IdeaNode[] = [
  {
    id: 'root',
    type: 'ideaNode',
    position: { x: 0, y: 0 },
    data: { text: 'メインアイデア', color: '#e0e7ff', createdBy: 'user' },
  },
]

function snapshot(nodes: IdeaNode[], edges: Edge[]): Snapshot {
  return { nodes: [...nodes], edges: [...edges] }
}

function pushPast(past: Snapshot[], snap: Snapshot): Snapshot[] {
  return [...past.slice(-MAX_HISTORY + 1), snap]
}

export const useMapStore = create<MapState>((set, get) => ({
  nodes: initialNodes,
  edges: [],
  past: [],
  future: [],
  clipboard: [],

  onNodesChange: (changes) => {
    // 履歴に積むべき確定的な変更（ドラッグ終了・削除）を検出
    const isHistoric = changes.some(
      (c) =>
        (c.type === 'position' && !(c as { dragging?: boolean }).dragging) ||
        c.type === 'remove'
    )
    set((state) => {
      const newNodes = applyNodeChanges(changes, state.nodes) as IdeaNode[]
      if (isHistoric) {
        return {
          nodes: newNodes,
          past: pushPast(state.past, snapshot(state.nodes, state.edges)),
          future: [],
        }
      }
      return { nodes: newNodes }
    })
  },

  onEdgesChange: (changes) => {
    const isHistoric = changes.some((c) => c.type === 'remove')
    set((state) => {
      const newEdges = applyEdgeChanges(changes, state.edges)
      if (isHistoric) {
        return {
          edges: newEdges,
          past: pushPast(state.past, snapshot(state.nodes, state.edges)),
          future: [],
        }
      }
      return { edges: newEdges }
    })
  },

  onConnect: (connection) =>
    set((state) => ({
      edges: addEdge(makeEdge(connection), state.edges),
      past: pushPast(state.past, snapshot(state.nodes, state.edges)),
      future: [],
    })),

  addNode: (text, x, y, createdBy = 'user', color = DEFAULT_NODE_COLOR) => {
    const id = uuidv4()
    const newNode: IdeaNode = {
      id,
      type: 'ideaNode',
      position: { x, y },
      data: { text, color, createdBy },
    }
    set((state) => ({
      nodes: [...state.nodes, newNode],
      past: pushPast(state.past, snapshot(state.nodes, state.edges)),
      future: [],
    }))
    return id
  },

  addConnectedNode: (parentId, text = '新しいアイデア') => {
    const state = get()
    const parent = state.nodes.find((n) => n.id === parentId)
    if (!parent) return null
    // 既存の子の数だけ縦にずらして重なりを避ける
    const childCount = state.edges.filter((e) => e.source === parentId).length
    const id = uuidv4()
    const newNode: IdeaNode = {
      id,
      type: 'ideaNode',
      position: {
        x: parent.position.x + 280,
        y: parent.position.y + childCount * 90,
      },
      data: { text, color: DEFAULT_NODE_COLOR, createdBy: 'user' },
    }
    const edge = makeEdge({
      source: parentId,
      target: id,
      sourceHandle: 'right',
      targetHandle: 'left',
    })
    set((s) => ({
      nodes: [...s.nodes, newNode],
      edges: [...s.edges, edge],
      past: pushPast(s.past, snapshot(s.nodes, s.edges)),
      future: [],
    }))
    return id
  },

  updateNodeText: (id, text) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, text } } : n
      ),
      past: pushPast(state.past, snapshot(state.nodes, state.edges)),
      future: [],
    })),

  updateNodeColor: (id, color) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, color } } : n
      ),
      past: pushPast(state.past, snapshot(state.nodes, state.edges)),
      future: [],
    })),

  deleteNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      past: pushPast(state.past, snapshot(state.nodes, state.edges)),
      future: [],
    })),

  deleteNodes: (ids) =>
    set((state) => {
      if (ids.length === 0) return {}
      const idSet = new Set(ids)
      return {
        nodes: state.nodes.filter((n) => !idSet.has(n.id)),
        edges: state.edges.filter(
          (e) => !idSet.has(e.source) && !idSet.has(e.target)
        ),
        past: pushPast(state.past, snapshot(state.nodes, state.edges)),
        future: [],
      }
    }),

  deleteSelected: () =>
    set((state) => {
      const selNodeIds = new Set(
        state.nodes.filter((n) => n.selected).map((n) => n.id)
      )
      const hasSelEdges = state.edges.some((e) => e.selected)
      if (selNodeIds.size === 0 && !hasSelEdges) return {}
      return {
        nodes: state.nodes.filter((n) => !n.selected),
        edges: state.edges.filter(
          (e) =>
            !e.selected &&
            !selNodeIds.has(e.source) &&
            !selNodeIds.has(e.target)
        ),
        past: pushPast(state.past, snapshot(state.nodes, state.edges)),
        future: [],
      }
    }),

  deleteNodeEdges: (nodeId) =>
    set((state) => {
      const target = state.edges.filter(
        (e) => e.source === nodeId || e.target === nodeId
      )
      if (target.length === 0) return {}
      return {
        edges: state.edges.filter(
          (e) => e.source !== nodeId && e.target !== nodeId
        ),
        past: pushPast(state.past, snapshot(state.nodes, state.edges)),
        future: [],
      }
    }),

  deleteEdge: (id) =>
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== id),
      past: pushPast(state.past, snapshot(state.nodes, state.edges)),
      future: [],
    })),

  reverseEdge: (id) =>
    set((state) => ({
      edges: state.edges.map((e) =>
        e.id === id
          ? {
              ...e,
              source: e.target,
              target: e.source,
              sourceHandle: e.targetHandle,
              targetHandle: e.sourceHandle,
            }
          : e
      ),
      past: pushPast(state.past, snapshot(state.nodes, state.edges)),
      future: [],
    })),

  toggleEdgeDirection: (id) =>
    set((state) => ({
      edges: state.edges.map((e) =>
        e.id === id
          ? { ...e, markerStart: e.markerStart ? undefined : ARROW }
          : e
      ),
      past: pushPast(state.past, snapshot(state.nodes, state.edges)),
      future: [],
    })),

  updateEdgeLabel: (id, label) =>
    set((state) => ({
      edges: state.edges.map((e) =>
        e.id === id ? { ...e, label: label || undefined } : e
      ),
      past: pushPast(state.past, snapshot(state.nodes, state.edges)),
      future: [],
    })),

  copyNodes: (ids) => {
    const idSet = new Set(ids)
    const copied = get().nodes.filter((n) => idSet.has(n.id))
    set({ clipboard: copied.map((n) => ({ ...n, data: { ...n.data } })) })
  },

  paste: (position) => {
    const clip = get().clipboard
    if (clip.length === 0) return
    // position 指定時は先頭ノードをその座標に合わせ、残りは相対位置を維持する
    const dx = position ? position.x - clip[0].position.x : 36
    const dy = position ? position.y - clip[0].position.y : 36
    const pasted: IdeaNode[] = clip.map((n) => ({
      ...n,
      id: uuidv4(),
      position: { x: n.position.x + dx, y: n.position.y + dy },
      selected: true,
      data: { ...n.data },
    }))
    set((state) => ({
      nodes: [
        ...state.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
        ...pasted,
      ],
      past: pushPast(state.past, snapshot(state.nodes, state.edges)),
      future: [],
    }))
  },

  hasConnectedEdges: (nodeId) =>
    get().edges.some((e) => e.source === nodeId || e.target === nodeId),

  setNodes: (nodes) =>
    set((state) => ({
      nodes,
      past: pushPast(state.past, snapshot(state.nodes, state.edges)),
      future: [],
    })),

  loadFromSerialized: (nodes, edges) => {
    const flowNodes: IdeaNode[] = nodes.map((n) => ({
      id: n.id,
      type: 'ideaNode',
      position: { x: n.x, y: n.y },
      data: { text: n.text, color: n.color, createdBy: n.createdBy },
    }))
    const flowEdges: Edge[] = edges.map((e) => ({
      id: e.id,
      type: 'floating',
      source: e.source,
      target: e.target,
      // ハンドルID未指定の旧データは右→左をデフォルトにして必ず描画されるようにする
      sourceHandle: e.sourceHandle ?? 'right',
      targetHandle: e.targetHandle ?? 'left',
      label: e.label || undefined,
      markerEnd: ARROW,
      markerStart: e.bidirectional ? ARROW : undefined,
      style: EDGE_STYLE,
    }))
    set({ nodes: flowNodes, edges: flowEdges, past: [], future: [] })
  },

  getSerializedNodes: () =>
    get().nodes.map((n) => ({
      id: n.id,
      text: n.data.text,
      x: n.position.x,
      y: n.position.y,
      color: n.data.color,
      createdBy: n.data.createdBy,
    })),

  getSerializedEdges: () =>
    get().edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
      label: typeof e.label === 'string' ? e.label : '',
      bidirectional: Boolean(e.markerStart),
    })),

  undo: () =>
    set((state) => {
      if (state.past.length === 0) return {}
      const prev = state.past[state.past.length - 1]
      return {
        nodes: prev.nodes,
        edges: prev.edges,
        past: state.past.slice(0, -1),
        future: [snapshot(state.nodes, state.edges), ...state.future.slice(0, MAX_HISTORY - 1)],
      }
    }),

  redo: () =>
    set((state) => {
      if (state.future.length === 0) return {}
      const next = state.future[0]
      return {
        nodes: next.nodes,
        edges: next.edges,
        past: pushPast(state.past, snapshot(state.nodes, state.edges)),
        future: state.future.slice(1),
      }
    }),

  reset: () => set({ nodes: initialNodes, edges: [], past: [], future: [], clipboard: [] }),
}))
