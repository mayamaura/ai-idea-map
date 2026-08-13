import { addEdge, applyEdgeChanges, type Edge } from '@xyflow/react'
import { v4 as uuidv4 } from 'uuid'
import { pushPast, snapshot } from './history'
import { ARROW, makeEdge } from './constants'
import type { EdgeSlice, MapSliceCreator } from './types'

export const createEdgeSlice: MapSliceCreator<EdgeSlice> = (set, get) => ({
  edges: [],

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

  // FloatingEdge はハンドルIDを無視してノード中心座標で描画するため null で問題ない
  connectNodes: (source, target) => {
    if (source === target) return
    get().onConnect({ source, target, sourceHandle: null, targetHandle: null })
  },

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

  addSuggestedEdge: (sourceId, targetId) =>
    set((state) => {
      const already = state.edges.some(
        (e) =>
          (e.source === sourceId && e.target === targetId) ||
          (e.source === targetId && e.target === sourceId)
      )
      if (already) return {}
      const edge: Edge = {
        id: uuidv4(),
        type: 'floating',
        source: sourceId,
        target: targetId,
        markerEnd: ARROW,
        style: { stroke: '#a78bfa', strokeWidth: 1.5, strokeDasharray: '6 3' },
        data: { aiSuggested: true },
      }
      return {
        edges: [...state.edges, edge],
        past: pushPast(state.past, snapshot(state.nodes, state.edges)),
        future: [],
      }
    }),

  // pushPast しない: このアクションは onNodeDragStop から呼ばれ、直前の onNodesChange(dragging:false) が
  // ドロップ直前のスナップショットを履歴に積み終えている。ここで積むと Undo 1回目が
  // 「エッジだけ消えて重なった位置に戻る」中間状態になるため、相乗りさせて1回で丸ごと戻す
  connectDroppedNode: (sourceId, targetId, returnPosition) =>
    set((state) => {
      if (sourceId === targetId) return {}
      const already = state.edges.some(
        (e) =>
          (e.source === sourceId && e.target === targetId) ||
          (e.source === targetId && e.target === sourceId)
      )
      if (already) return {}
      return {
        edges: addEdge(
          makeEdge({ source: sourceId, target: targetId, sourceHandle: null, targetHandle: null }),
          state.edges
        ),
        nodes: state.nodes.map((n) =>
          n.id === sourceId ? { ...n, position: returnPosition } : n
        ),
      }
    }),

  hasConnectedEdges: (nodeId) =>
    get().edges.some((e) => e.source === nodeId || e.target === nodeId),
})
