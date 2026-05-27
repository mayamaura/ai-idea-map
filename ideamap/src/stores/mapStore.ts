import { create } from 'zustand'
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react'
import { v4 as uuidv4 } from 'uuid'
import type { IdeaNodeData, SerializedNode, SerializedEdge } from '../types'

type IdeaNode = Node<IdeaNodeData>

const DEFAULT_NODE_COLOR = '#ffffff'
const MAX_HISTORY = 50

interface Snapshot {
  nodes: IdeaNode[]
  edges: Edge[]
}

interface MapState {
  nodes: IdeaNode[]
  edges: Edge[]
  past: Snapshot[]
  future: Snapshot[]
  onNodesChange: (changes: NodeChange<IdeaNode>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  addNode: (text: string, x: number, y: number, createdBy?: 'user' | 'ai', color?: string) => string
  updateNodeText: (id: string, text: string) => void
  updateNodeColor: (id: string, color: string) => void
  deleteNode: (id: string) => void
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

  onNodesChange: (changes) => {
    const hasDragEnd = changes.some(
      (c) => c.type === 'position' && !(c as { dragging?: boolean }).dragging
    )
    set((state) => {
      const newNodes = applyNodeChanges(changes, state.nodes) as IdeaNode[]
      if (hasDragEnd) {
        return {
          nodes: newNodes,
          past: pushPast(state.past, snapshot(state.nodes, state.edges)),
          future: [],
        }
      }
      return { nodes: newNodes }
    })
  },

  onEdgesChange: (changes) =>
    set((state) => ({ edges: applyEdgeChanges(changes, state.edges) })),

  onConnect: (connection) =>
    set((state) => ({
      edges: addEdge({ ...connection, id: uuidv4() }, state.edges),
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
      source: e.source,
      target: e.target,
      label: e.label || undefined,
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
      label: typeof e.label === 'string' ? e.label : '',
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

  reset: () => set({ nodes: initialNodes, edges: [], past: [], future: [] }),
}))
