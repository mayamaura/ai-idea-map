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

interface MapState {
  nodes: IdeaNode[]
  edges: Edge[]
  onNodesChange: (changes: NodeChange<IdeaNode>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  addNode: (text: string, x: number, y: number, createdBy?: 'user' | 'ai', color?: string) => string
  updateNodeText: (id: string, text: string) => void
  updateNodeColor: (id: string, color: string) => void
  deleteNode: (id: string) => void
  loadFromSerialized: (nodes: SerializedNode[], edges: SerializedEdge[]) => void
  getSerializedNodes: () => SerializedNode[]
  getSerializedEdges: () => SerializedEdge[]
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

export const useMapStore = create<MapState>((set, get) => ({
  nodes: initialNodes,
  edges: [],

  onNodesChange: (changes) =>
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes) as IdeaNode[],
    })),

  onEdgesChange: (changes) =>
    set((state) => ({ edges: applyEdgeChanges(changes, state.edges) })),

  onConnect: (connection) =>
    set((state) => ({
      edges: addEdge({ ...connection, id: uuidv4() }, state.edges),
    })),

  addNode: (text, x, y, createdBy = 'user', color = DEFAULT_NODE_COLOR) => {
    const id = uuidv4()
    const newNode: IdeaNode = {
      id,
      type: 'ideaNode',
      position: { x, y },
      data: { text, color, createdBy },
    }
    set((state) => ({ nodes: [...state.nodes, newNode] }))
    return id
  },

  updateNodeText: (id, text) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, text } } : n
      ),
    })),

  updateNodeColor: (id, color) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, color } } : n
      ),
    })),

  deleteNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
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
    set({ nodes: flowNodes, edges: flowEdges })
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

  reset: () => set({ nodes: initialNodes, edges: [] }),
}))
