import { DEFAULT_NODE_SIZE } from '../../layout/groupGeometry'
import { pushPast, snapshot } from './history'
import type { AlignmentSlice, IdeaNode, MapSliceCreator } from './types'

/** 整列・分配で使うノードサイズ（measured 未確定時はフォールバック） */
function getSize(n: IdeaNode): { width: number; height: number } {
  return {
    width: n.measured?.width ?? DEFAULT_NODE_SIZE.width,
    height: n.measured?.height ?? DEFAULT_NODE_SIZE.height,
  }
}

export const createAlignmentSlice: MapSliceCreator<AlignmentSlice> = (set, get) => ({
  alignSelectedNodes: (alignType) => {
    const state = get()
    const targets = state.nodes.filter(
      (n) => n.selected && n.type !== 'groupNode' && !n.parentId
    )
    if (targets.length < 2) return

    let updatedPositions: Map<string, { x: number; y: number }>

    if (alignType === 'left') {
      const minX = Math.min(...targets.map((n) => n.position.x))
      updatedPositions = new Map(targets.map((n) => [n.id, { x: minX, y: n.position.y }]))
    } else if (alignType === 'right') {
      const maxRight = Math.max(...targets.map((n) => n.position.x + getSize(n).width))
      updatedPositions = new Map(targets.map((n) => [n.id, { x: maxRight - getSize(n).width, y: n.position.y }]))
    } else if (alignType === 'center-h') {
      const avgCenterX = targets.reduce((sum, n) => sum + n.position.x + getSize(n).width / 2, 0) / targets.length
      updatedPositions = new Map(targets.map((n) => [n.id, { x: avgCenterX - getSize(n).width / 2, y: n.position.y }]))
    } else if (alignType === 'top') {
      const minY = Math.min(...targets.map((n) => n.position.y))
      updatedPositions = new Map(targets.map((n) => [n.id, { x: n.position.x, y: minY }]))
    } else if (alignType === 'bottom') {
      const maxBottom = Math.max(...targets.map((n) => n.position.y + getSize(n).height))
      updatedPositions = new Map(targets.map((n) => [n.id, { x: n.position.x, y: maxBottom - getSize(n).height }]))
    } else {
      // center-v
      const avgCenterY = targets.reduce((sum, n) => sum + n.position.y + getSize(n).height / 2, 0) / targets.length
      updatedPositions = new Map(targets.map((n) => [n.id, { x: n.position.x, y: avgCenterY - getSize(n).height / 2 }]))
    }

    set((s) => ({
      nodes: s.nodes.map((n) => {
        const pos = updatedPositions.get(n.id)
        return pos ? { ...n, position: pos } : n
      }),
      past: pushPast(s.past, snapshot(state.nodes, state.edges)),
      future: [],
    }))
  },

  distributeSelectedNodes: (direction) => {
    const state = get()
    const targets = state.nodes.filter(
      (n) => n.selected && n.type !== 'groupNode' && !n.parentId
    )
    if (targets.length < 3) return

    // 中心座標でソート
    const sorted = [...targets].sort((a, b) => {
      if (direction === 'horizontal') {
        return (a.position.x + getSize(a).width / 2) - (b.position.x + getSize(b).width / 2)
      }
      return (a.position.y + getSize(a).height / 2) - (b.position.y + getSize(b).height / 2)
    })

    // sorted.length >= 3 は上のガードで保証済み
    const first = sorted[0]!
    const last = sorted[sorted.length - 1]!
    const firstCenter = direction === 'horizontal'
      ? first.position.x + getSize(first).width / 2
      : first.position.y + getSize(first).height / 2
    const lastCenter = direction === 'horizontal'
      ? last.position.x + getSize(last).width / 2
      : last.position.y + getSize(last).height / 2
    const n = sorted.length

    const updatedPositions = new Map<string, { x: number; y: number }>()
    sorted.forEach((node, i) => {
      const center = firstCenter + (lastCenter - firstCenter) * i / (n - 1)
      if (direction === 'horizontal') {
        updatedPositions.set(node.id, { x: center - getSize(node).width / 2, y: node.position.y })
      } else {
        updatedPositions.set(node.id, { x: node.position.x, y: center - getSize(node).height / 2 })
      }
    })

    set((s) => ({
      nodes: s.nodes.map((node) => {
        const pos = updatedPositions.get(node.id)
        return pos ? { ...node, position: pos } : node
      }),
      past: pushPast(s.past, snapshot(state.nodes, state.edges)),
      future: [],
    }))
  },
})
