import type { Edge } from '@xyflow/react'
import type { HistorySlice, IdeaNode, MapSliceCreator, Snapshot } from './types'

const MAX_HISTORY = 50

export function snapshot(nodes: IdeaNode[], edges: Edge[]): Snapshot {
  return { nodes: [...nodes], edges: [...edges] }
}

export function pushPast(past: Snapshot[], snap: Snapshot): Snapshot[] {
  return [...past.slice(-MAX_HISTORY + 1), snap]
}

export const createHistorySlice: MapSliceCreator<HistorySlice> = (set) => ({
  past: [],
  future: [],

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
})
