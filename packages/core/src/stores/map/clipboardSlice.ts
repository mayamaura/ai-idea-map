import { v4 as uuidv4 } from 'uuid'
import type { Edge } from '@xyflow/react'
import { pushPast, snapshot } from './history'
import { makeEdge } from './constants'
import type { ClipboardSlice, IdeaNode, MapSliceCreator } from './types'

export const createClipboardSlice: MapSliceCreator<ClipboardSlice> = (set, get) => ({
  clipboard: { nodes: [], edges: [] },

  copyNodes: (ids) => {
    const idSet = new Set(ids)
    const state = get()
    const copiedNodes = state.nodes.filter((n) => idSet.has(n.id))
    // 選択ノード集合の両端を含むエッジのみコピー
    const copiedEdges = state.edges.filter(
      (e) => idSet.has(e.source) && idSet.has(e.target)
    )
    set({
      clipboard: {
        nodes: copiedNodes.map((n) => ({ ...n, data: { ...n.data } })),
        edges: copiedEdges.map((e) => ({ ...e })),
      },
    })
  },

  paste: (position) => {
    const clip = get().clipboard
    if (clip.nodes.length === 0) return
    const firstNode = clip.nodes[0]
    const dx = position ? position.x - firstNode.position.x : 36
    const dy = position ? position.y - firstNode.position.y : 36

    // 旧ID→新IDのマップを構築
    const idMap = new Map<string, string>()
    const pastedNodes: IdeaNode[] = clip.nodes.map((n) => {
      const newId = uuidv4()
      idMap.set(n.id, newId)
      return {
        ...n,
        id: newId,
        position: { x: n.position.x + dx, y: n.position.y + dy },
        selected: true,
        data: { ...n.data },
      }
    })

    // エッジを新IDで再生成
    const pastedEdges: Edge[] = clip.edges.reduce<Edge[]>((acc, e) => {
      const newSource = idMap.get(e.source)
      const newTarget = idMap.get(e.target)
      if (!newSource || !newTarget) return acc
      const newEdge: Edge = {
        ...makeEdge(
          { source: newSource, target: newTarget, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle },
          Boolean(e.markerStart)
        ),
        label: e.label,
      }
      acc.push(newEdge)
      return acc
    }, [])

    set((state) => ({
      nodes: [
        ...state.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
        ...pastedNodes,
      ],
      edges: [...state.edges, ...pastedEdges],
      past: pushPast(state.past, snapshot(state.nodes, state.edges)),
      future: [],
    }))
  },
})
