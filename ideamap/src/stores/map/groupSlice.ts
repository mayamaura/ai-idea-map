import { v4 as uuidv4 } from 'uuid'
import { useUIStore } from '../uiStore'
import {
  clampInsideParent,
  computePushOut,
  expandGroupIds,
  DEFAULT_NODE_SIZE,
} from '../../utils/groupGeometry'
import { pushPast, snapshot } from './history'
import { GROUP_NODE_COLOR } from './constants'
import type { GroupSlice, IdeaNode, MapSliceCreator } from './types'

/** グループ作成時に選択ノードの外接矩形へ足す余白 */
const GROUP_PADDING = 40

export const createGroupSlice: MapSliceCreator<GroupSlice> = (set, get) => ({
  addGroupNode: (label, x, y, width = 400, height = 300) => {
    const id = uuidv4()
    const groupNode: IdeaNode = {
      id,
      type: 'groupNode',
      position: { x, y },
      style: { width, height },
      data: { title: label, color: GROUP_NODE_COLOR, createdBy: 'user' },
      zIndex: -1,
    }
    set((state) => ({
      nodes: [groupNode, ...state.nodes],
      past: pushPast(state.past, snapshot(state.nodes, state.edges)),
      future: [],
    }))
    return id
  },

  groupSelectedNodes: () => {
    const state = get()
    const selected = state.nodes.filter(
      (n) => n.selected && n.type !== 'groupNode' && !n.parentId
    )
    if (selected.length < 2) return

    const minX = Math.min(...selected.map((n) => n.position.x)) - GROUP_PADDING
    const minY = Math.min(...selected.map((n) => n.position.y)) - GROUP_PADDING
    const maxX = Math.max(...selected.map((n) => n.position.x + (n.measured?.width ?? DEFAULT_NODE_SIZE.width))) + GROUP_PADDING
    const maxY = Math.max(...selected.map((n) => n.position.y + (n.measured?.height ?? DEFAULT_NODE_SIZE.height))) + GROUP_PADDING

    const groupId = uuidv4()
    const groupNode: IdeaNode = {
      id: groupId,
      type: 'groupNode',
      position: { x: minX, y: minY },
      style: { width: maxX - minX, height: maxY - minY },
      data: { title: 'グループ', color: GROUP_NODE_COLOR, createdBy: 'user' },
      zIndex: -1,
    }

    const selectedIds = new Set(selected.map((n) => n.id))
    const updatedSelected = selected.map((n) => ({
      ...n,
      parentId: groupId,
      position: { x: n.position.x - minX, y: n.position.y - minY },
      selected: false,
    }))
    const otherNodes = state.nodes.filter((n) => !selectedIds.has(n.id))

    set({
      nodes: [groupNode, ...otherNodes, ...updatedSelected],
      past: pushPast(state.past, snapshot(state.nodes, state.edges)),
      future: [],
    })
  },

  ungroupNodes: (groupId) => {
    const state = get()
    const groupNode = state.nodes.find((n) => n.id === groupId)
    if (!groupNode) return

    const children = state.nodes.filter((n) => n.parentId === groupId)
    const updatedChildren = children.map((n) => ({
      ...n,
      parentId: undefined,
      extent: undefined,
      position: {
        x: groupNode.position.x + n.position.x,
        y: groupNode.position.y + n.position.y,
      },
    }))
    const otherNodes = state.nodes.filter((n) => n.id !== groupId && n.parentId !== groupId)

    set({
      nodes: [...otherNodes, ...updatedChildren],
      past: pushPast(state.past, snapshot(state.nodes, state.edges)),
      future: [],
    })
  },

  deleteGroupWithChildren: (groupId) =>
    set((state) => {
      const removeIds = expandGroupIds([groupId], state.nodes)
      return {
        nodes: state.nodes.filter((n) => !removeIds.has(n.id)),
        edges: state.edges.filter((e) => !removeIds.has(e.source) && !removeIds.has(e.target)),
        past: pushPast(state.past, snapshot(state.nodes, state.edges)),
        future: [],
      }
    }),

  addNodeToGroup: (nodeId, groupId) => {
    set((state) => {
      const node = state.nodes.find((n) => n.id === nodeId)
      const groupNode = state.nodes.find((n) => n.id === groupId)
      if (!node || !groupNode) return {}
      const relativePos = {
        x: node.position.x - groupNode.position.x,
        y: node.position.y - groupNode.position.y,
      }
      return {
        nodes: state.nodes.map((n) =>
          n.id === nodeId ? { ...n, parentId: groupId, position: relativePos } : n
        ),
        past: pushPast(state.past, snapshot(state.nodes, state.edges)),
        future: [],
      }
    })
    useUIStore.getState().addToast('グループに追加しました', 'success')
  },

  removeNodeFromGroup: (nodeId) => {
    set((state) => {
      const node = state.nodes.find((n) => n.id === nodeId)
      if (!node?.parentId) return {}
      const groupNode = state.nodes.find((n) => n.id === node.parentId)
      if (!groupNode) return {}
      const absolutePos = {
        x: groupNode.position.x + node.position.x,
        y: groupNode.position.y + node.position.y,
      }
      return {
        nodes: state.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, parentId: undefined, extent: undefined, position: absolutePos }
            : n
        ),
        past: pushPast(state.past, snapshot(state.nodes, state.edges)),
        future: [],
      }
    })
    useUIStore.getState().addToast('グループから外しました', 'success')
  },

  pushNodeOutOfGroups: (nodeId) => {
    const state = get()
    const node = state.nodes.find((n) => n.id === nodeId)
    if (!node) return
    const groupNodes = state.nodes.filter((n) => n.type === 'groupNode')
    const corrected = computePushOut(node.position, node.measured, groupNodes)
    if (corrected.x !== node.position.x || corrected.y !== node.position.y) {
      set((s) => ({
        nodes: s.nodes.map((n) => (n.id === nodeId ? { ...n, position: corrected } : n)),
      }))
    }
  },

  clampNodeInsideParent: (nodeId) => {
    const state = get()
    const node = state.nodes.find((n) => n.id === nodeId)
    if (!node?.parentId) return
    const groupNode = state.nodes.find((n) => n.id === node.parentId)
    if (!groupNode) return
    const clampedPos = clampInsideParent(node.position, node.measured, groupNode)
    if (clampedPos.x !== node.position.x || clampedPos.y !== node.position.y) {
      set((s) => ({
        nodes: s.nodes.map((n) => (n.id === nodeId ? { ...n, position: clampedPos } : n)),
      }))
    }
  },
})
