import type { Edge } from '@xyflow/react'
import { getGroupSize } from '../../layout/groupGeometry'
import { readEdgeHandles, readNodeTitle } from '../../utils/mapFileCompat'
import { ARROW, EDGE_STYLE, GROUP_NODE_COLOR, initialNodes } from './constants'
import type { DocumentSlice, IdeaNode, MapSliceCreator } from './types'

export const createDocumentSlice: MapSliceCreator<DocumentSlice> = (set, get) => ({
  pendingFitView: false,

  clearPendingFitView: () => set({ pendingFitView: false }),

  loadFromSerialized: (nodes, edges) => {
    const flowNodes: IdeaNode[] = nodes.map((n) => {
      if (n.nodeType === 'group') {
        return {
          id: n.id,
          type: 'groupNode',
          position: { x: n.x, y: n.y },
          style: { width: n.width ?? 400, height: n.height ?? 300 },
          data: { title: n.title, color: n.color || GROUP_NODE_COLOR, createdBy: 'user' as const },
          zIndex: -1,
        }
      }
      return {
        id: n.id,
        type: 'ideaNode',
        position: { x: n.x, y: n.y },
        parentId: n.parentId || undefined,
        data: {
          title: readNodeTitle(n),
          body: n.body,
          color: n.color,
          createdBy: n.createdBy,
          categoryId: n.categoryId,
        },
      }
    })
    const flowEdges: Edge[] = edges.map((e) => ({
      id: e.id,
      type: 'floating',
      source: e.source,
      target: e.target,
      ...readEdgeHandles(e),
      label: e.label || undefined,
      markerEnd: ARROW,
      markerStart: e.bidirectional ? ARROW : undefined,
      style: EDGE_STYLE,
    }))
    set({ nodes: flowNodes, edges: flowEdges, past: [], future: [], pendingFitView: true })
  },

  getSerializedNodes: () =>
    get().nodes.map((n) => {
      if (n.type === 'groupNode') {
        const { width, height } = getGroupSize(n)
        return {
          id: n.id,
          nodeType: 'group' as const,
          title: n.data.title,
          x: n.position.x,
          y: n.position.y,
          color: n.data.color,
          createdBy: 'user' as const,
          width,
          height,
        }
      }
      return {
        id: n.id,
        nodeType: 'idea' as const,
        title: n.data.title,
        body: n.data.body,
        x: n.position.x,
        y: n.position.y,
        color: n.data.color,
        createdBy: n.data.createdBy,
        categoryId: n.data.categoryId,
        parentId: n.parentId || undefined,
      }
    }),

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

  reset: () =>
    set({ nodes: initialNodes, edges: [], past: [], future: [], clipboard: { nodes: [], edges: [] } }),
})
