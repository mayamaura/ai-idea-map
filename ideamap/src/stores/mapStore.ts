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
import { useUIStore } from './uiStore'

type IdeaNode = Node<IdeaNodeData>

const DEFAULT_NODE_COLOR = '#ffffff'

/** フリーノードをグループノードの外側へ押し出す位置を計算する */
function computePushOut(
  pos: { x: number; y: number },
  measured: { width?: number; height?: number } | undefined,
  groupNodes: IdeaNode[]
): { x: number; y: number } {
  const nodeW = measured?.width ?? 160
  const nodeH = measured?.height ?? 60
  let { x, y } = pos

  for (const group of groupNodes) {
    const gW = typeof group.style?.width === 'number' ? group.style.width : 400
    const gH = typeof group.style?.height === 'number' ? group.style.height : 300
    const gx = group.position.x
    const gy = group.position.y

    const overlapX = x < gx + gW && x + nodeW > gx
    const overlapY = y < gy + gH && y + nodeH > gy
    if (!overlapX || !overlapY) continue

    // 各方向への押し出し距離を計算し、最小コストの方向へ移動
    const dLeft = x + nodeW - gx
    const dRight = gx + gW - x
    const dUp = y + nodeH - gy
    const dDown = gy + gH - y

    const min = Math.min(dLeft, dRight, dUp, dDown)
    if (min === dLeft) x = gx - nodeW
    else if (min === dRight) x = gx + gW
    else if (min === dUp) y = gy - nodeH
    else y = gy + gH
  }

  return { x, y }
}

/** フリーノードの位置がいずれかのグループと重なるか判定し、最初にヒットしたグループを返す */
function findOverlappingGroup(
  pos: { x: number; y: number },
  measured: { width?: number; height?: number } | undefined,
  groupNodes: IdeaNode[]
): IdeaNode | null {
  const nodeW = measured?.width ?? 160
  const nodeH = measured?.height ?? 60
  const { x, y } = pos
  for (const group of groupNodes) {
    const gW = typeof group.style?.width === 'number' ? group.style.width : 400
    const gH = typeof group.style?.height === 'number' ? group.style.height : 300
    const gx = group.position.x
    const gy = group.position.y
    if (x < gx + gW && x + nodeW > gx && y < gy + gH && y + nodeH > gy) return group
  }
  return null
}

/** 子ノードの相対座標が親グループ枠の外に出ているか判定 */
function isOutsideParent(
  pos: { x: number; y: number },
  measured: { width?: number; height?: number } | undefined,
  parentGroup: IdeaNode
): boolean {
  const nodeW = measured?.width ?? 160
  const nodeH = measured?.height ?? 60
  const centerX = pos.x + nodeW / 2
  const centerY = pos.y + nodeH / 2
  const gW = typeof parentGroup.style?.width === 'number' ? parentGroup.style.width : 400
  const gH = typeof parentGroup.style?.height === 'number' ? parentGroup.style.height : 300
  return centerX < 0 || centerY < 0 || centerX > gW || centerY > gH
}

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
  addNode: (title: string, x: number, y: number, createdBy?: 'user' | 'ai', color?: string, categoryId?: string, body?: string) => string
  addConnectedNode: (parentId: string, title?: string) => string | null
  addGroupNode: (label: string, x: number, y: number, width?: number, height?: number) => string
  groupSelectedNodes: () => void
  ungroupNodes: (groupId: string) => void
  deleteGroupWithChildren: (groupId: string) => void
  addNodeToGroup: (nodeId: string, groupId: string) => void
  removeNodeFromGroup: (nodeId: string) => void
  pushNodeOutOfGroups: (nodeId: string) => void
  clampNodeInsideParent: (nodeId: string) => void
  updateNodeTitle: (id: string, title: string) => void
  updateNodeBody: (id: string, body: string) => void
  updateNodeColor: (id: string, color: string) => void
  updateNodeCategory: (id: string, categoryId: string, color: string) => void
  deleteNode: (id: string) => void
  deleteNodes: (ids: string[]) => void
  deleteSelected: () => void
  deleteNodeEdges: (nodeId: string) => void
  deleteEdge: (id: string) => void
  reverseEdge: (id: string) => void
  toggleEdgeDirection: (id: string) => void
  updateEdgeLabel: (id: string, label: string) => void
  addSuggestedEdge: (sourceId: string, targetId: string) => void
  applyClusterCategory: (nodeIds: string[], categoryId: string, color: string) => void
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
  pendingFitView: boolean
  clearPendingFitView: () => void
}

const initialNodes: IdeaNode[] = [
  {
    id: 'root',
    type: 'ideaNode',
    position: { x: 0, y: 0 },
    data: { title: 'メインアイデア', color: '#e0e7ff', createdBy: 'user', categoryId: 'cat-main' },
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
  pendingFitView: false,

  onNodesChange: (changes) => {
    const currentNodes = get().nodes
    const groupNodes = currentNodes.filter((n) => n.type === 'groupNode')

    let pendingDragIn: { nodeId: string; groupId: string; groupName: string } | null = null
    let pendingDragOut: { nodeId: string; groupName: string } | null = null

    const processedChanges: NodeChange<IdeaNode>[] =
      groupNodes.length > 0
        ? changes.map((c) => {
            if (c.type !== 'position' || c.dragging !== false || !c.position) return c
            const node = currentNodes.find((n) => n.id === c.id)
            if (!node || node.type === 'groupNode') return c

            if (!node.parentId) {
              // フリーノード: グループとの重なりを検出してダイアログ予約、重なりなければ押し出し
              const overlapping = findOverlappingGroup(c.position, node.measured, groupNodes)
              if (overlapping && !pendingDragIn) {
                pendingDragIn = {
                  nodeId: c.id,
                  groupId: overlapping.id,
                  groupName: (overlapping.data as IdeaNodeData).title || 'グループ',
                }
                return c // 現在位置をそのまま適用（ダイアログで確定/キャンセル）
              }
              const corrected = computePushOut(c.position, node.measured, groupNodes)
              if (corrected.x === c.position.x && corrected.y === c.position.y) return c
              return { ...c, position: corrected } as NodeChange<IdeaNode>
            } else {
              // 子ノード: 親グループ枠外に出ていたらダイアログ予約
              const parentGroup = groupNodes.find((g) => g.id === node.parentId)
              if (parentGroup && isOutsideParent(c.position, node.measured, parentGroup) && !pendingDragOut) {
                pendingDragOut = {
                  nodeId: c.id,
                  groupName: (parentGroup.data as IdeaNodeData).title || 'グループ',
                }
                return c // 現在位置をそのまま適用（ダイアログで確定/キャンセル）
              }
              return c
            }
          })
        : changes

    // グループの resize-end を検出し、style.width/height を同期する
    // applyNodeChanges は dimensions change で measured のみ更新し style を更新しないため、
    // isOutsideParent・findOverlappingGroup・シリアライズが正しいサイズを参照できるよう手動で同期する
    const groupResizeEnds = changes.filter((c) => {
      if (c.type !== 'dimensions') return false
      const dc = c as { id: string; resizing?: boolean; dimensions?: { width: number; height: number } }
      return dc.resizing === false && dc.dimensions != null && groupNodes.some((g) => g.id === dc.id)
    }) as Array<{ id: string; dimensions: { width: number; height: number } }>

    const isHistoric = processedChanges.some(
      (c) =>
        (c.type === 'position' && !(c as { dragging?: boolean }).dragging) ||
        c.type === 'remove'
    )
    set((state) => {
      let newNodes = applyNodeChanges(processedChanges, state.nodes) as IdeaNode[]
      if (groupResizeEnds.length > 0) {
        newNodes = newNodes.map((n) => {
          const rc = groupResizeEnds.find((c) => c.id === n.id)
          if (!rc) return n
          return { ...n, style: { ...n.style, width: rc.dimensions.width, height: rc.dimensions.height } }
        })
      }
      if (isHistoric) {
        return {
          nodes: newNodes,
          past: pushPast(state.past, snapshot(state.nodes, state.edges)),
          future: [],
        }
      }
      return { nodes: newNodes }
    })

    // set() の後でダイアログを表示（React の次レンダーで反映）
    if (pendingDragIn) {
      const { nodeId, groupId, groupName } = pendingDragIn
      useUIStore.getState().openConfirmDialog({
        title: 'グループに追加',
        message: `"${groupName}" にこのノードを追加しますか？`,
        confirmLabel: '追加',
        danger: false,
        onConfirm: () => get().addNodeToGroup(nodeId, groupId),
        onCancel: () => get().pushNodeOutOfGroups(nodeId),
      })
    } else if (pendingDragOut) {
      const { nodeId, groupName } = pendingDragOut
      useUIStore.getState().openConfirmDialog({
        title: 'グループから外す',
        message: `このノードを "${groupName}" から外しますか？`,
        confirmLabel: '外す',
        danger: false,
        onConfirm: () => get().removeNodeFromGroup(nodeId),
        onCancel: () => get().clampNodeInsideParent(nodeId),
      })
    }
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

  addNode: (title, x, y, createdBy = 'user', color = DEFAULT_NODE_COLOR, categoryId, body) => {
    const id = uuidv4()
    const newNode: IdeaNode = {
      id,
      type: 'ideaNode',
      position: { x, y },
      data: { title, color, createdBy, categoryId, body: body || undefined },
    }
    set((state) => ({
      nodes: [...state.nodes, newNode],
      past: pushPast(state.past, snapshot(state.nodes, state.edges)),
      future: [],
    }))
    return id
  },

  addGroupNode: (label, x, y, width = 400, height = 300) => {
    const id = uuidv4()
    const groupNode: IdeaNode = {
      id,
      type: 'groupNode',
      position: { x, y },
      style: { width, height },
      data: { title: label, color: 'rgba(147, 197, 253, 0.15)', createdBy: 'user' },
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

    const PADDING = 40
    const DEFAULT_W = 160
    const DEFAULT_H = 60

    const minX = Math.min(...selected.map((n) => n.position.x)) - PADDING
    const minY = Math.min(...selected.map((n) => n.position.y)) - PADDING
    const maxX = Math.max(...selected.map((n) => n.position.x + (n.measured?.width ?? DEFAULT_W))) + PADDING
    const maxY = Math.max(...selected.map((n) => n.position.y + (n.measured?.height ?? DEFAULT_H))) + PADDING

    const groupId = uuidv4()
    const groupNode: IdeaNode = {
      id: groupId,
      type: 'groupNode',
      position: { x: minX, y: minY },
      style: { width: maxX - minX, height: maxY - minY },
      data: { title: 'グループ', color: 'rgba(147, 197, 253, 0.15)', createdBy: 'user' },
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
    const gW = typeof groupNode.style?.width === 'number' ? groupNode.style.width : 400
    const gH = typeof groupNode.style?.height === 'number' ? groupNode.style.height : 300
    const nodeW = node.measured?.width ?? 160
    const nodeH = node.measured?.height ?? 60
    const clampedPos = {
      x: Math.max(0, Math.min(node.position.x, gW - nodeW)),
      y: Math.max(0, Math.min(node.position.y, gH - nodeH)),
    }
    if (clampedPos.x !== node.position.x || clampedPos.y !== node.position.y) {
      set((s) => ({
        nodes: s.nodes.map((n) => (n.id === nodeId ? { ...n, position: clampedPos } : n)),
      }))
    }
  },

  deleteGroupWithChildren: (groupId) =>
    set((state) => {
      const childIds = new Set(
        state.nodes.filter((n) => n.parentId === groupId).map((n) => n.id)
      )
      childIds.add(groupId)
      return {
        nodes: state.nodes.filter((n) => !childIds.has(n.id)),
        edges: state.edges.filter((e) => !childIds.has(e.source) && !childIds.has(e.target)),
        past: pushPast(state.past, snapshot(state.nodes, state.edges)),
        future: [],
      }
    }),

  addConnectedNode: (parentId, title = '新しいアイデア') => {
    const state = get()
    const parent = state.nodes.find((n) => n.id === parentId)
    if (!parent) return null
    const childCount = state.edges.filter((e) => e.source === parentId).length
    const id = uuidv4()

    const NODE_W = 160
    const NODE_H = 60
    const MARGIN = 20

    let finalPosition: { x: number; y: number }

    if (parent.parentId) {
      // グループ内の子ノードが親の場合: 右→下→左→上の順で収まる位置を探す
      const groupNode = state.nodes.find((n) => n.id === parent.parentId)
      const gW = typeof groupNode?.style?.width === 'number' ? groupNode.style.width : 400
      const gH = typeof groupNode?.style?.height === 'number' ? groupNode.style.height : 300

      const parentW = parent.measured?.width ?? NODE_W
      const parentH = parent.measured?.height ?? NODE_H
      const px = parent.position.x
      const py = parent.position.y

      const candidates: Array<{ x: number; y: number }> = [
        { x: px + parentW + MARGIN, y: py },
        { x: px, y: py + parentH + MARGIN + childCount * (NODE_H + MARGIN) },
        { x: px - NODE_W - MARGIN, y: py },
        { x: px, y: py - NODE_H - MARGIN },
      ]

      const fitsInside = (pos: { x: number; y: number }) =>
        pos.x >= 0 && pos.y >= 0 && pos.x + NODE_W <= gW && pos.y + NODE_H <= gH

      const overflow = (pos: { x: number; y: number }) =>
        Math.max(0, -pos.x) + Math.max(0, pos.x + NODE_W - gW) +
        Math.max(0, -pos.y) + Math.max(0, pos.y + NODE_H - gH)

      const clamp = (pos: { x: number; y: number }) => ({
        x: Math.max(0, Math.min(pos.x, gW - NODE_W)),
        y: Math.max(0, Math.min(pos.y, gH - NODE_H)),
      })

      const fitCandidate = candidates.find(fitsInside)
      if (fitCandidate) {
        finalPosition = fitCandidate
      } else {
        const best = candidates.reduce((a, b) => (overflow(a) <= overflow(b) ? a : b))
        finalPosition = clamp(best)
      }
    } else {
      finalPosition = {
        x: parent.position.x + 280,
        y: parent.position.y + childCount * 90,
      }
    }

    const newNode: IdeaNode = {
      id,
      type: 'ideaNode',
      position: finalPosition,
      data: { title, color: DEFAULT_NODE_COLOR, createdBy: 'user' },
      // 親ノードがグループ内にある場合は同じグループに属させる
      ...(parent.parentId ? { parentId: parent.parentId } : {}),
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

  updateNodeTitle: (id, title) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, title } } : n
      ),
      past: pushPast(state.past, snapshot(state.nodes, state.edges)),
      future: [],
    })),

  updateNodeBody: (id, body) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, body: body || undefined } } : n
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

  updateNodeCategory: (id, categoryId, color) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, categoryId, color } } : n
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
      // Also delete children of any group nodes being deleted
      state.nodes.filter((n) => idSet.has(n.id) && n.type === 'groupNode').forEach((g) => {
        state.nodes.filter((n) => n.parentId === g.id).forEach((n) => idSet.add(n.id))
      })
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
      const selNodes = state.nodes.filter((n) => n.selected)
      const hasSelEdges = state.edges.some((e) => e.selected)
      if (selNodes.length === 0 && !hasSelEdges) return {}
      const deleteIds = new Set(selNodes.map((n) => n.id))
      // Delete children of selected group nodes
      selNodes.filter((n) => n.type === 'groupNode').forEach((g) => {
        state.nodes.filter((n) => n.parentId === g.id).forEach((n) => deleteIds.add(n.id))
      })
      return {
        nodes: state.nodes.filter((n) => !deleteIds.has(n.id)),
        edges: state.edges.filter(
          (e) =>
            !e.selected &&
            !deleteIds.has(e.source) &&
            !deleteIds.has(e.target)
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

  applyClusterCategory: (nodeIds, categoryId, color) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        nodeIds.includes(n.id) ? { ...n, data: { ...n.data, categoryId, color } } : n
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
      // グループノードは style.width/height を measured にも反映させておく
      // レイアウト後に React Flow の ResizeObserver が古い measured と比較して
      // 誤った dimensions change を発火するのを防ぐため
      nodes: nodes.map((n) => {
        if (
          n.type === 'groupNode' &&
          typeof n.style?.width === 'number' &&
          typeof n.style?.height === 'number'
        ) {
          return { ...n, measured: { width: n.style.width, height: n.style.height } }
        }
        return n
      }),
      past: pushPast(state.past, snapshot(state.nodes, state.edges)),
      future: [],
    })),

  loadFromSerialized: (nodes, edges) => {
    const flowNodes: IdeaNode[] = nodes.map((n) => {
      if (n.nodeType === 'group') {
        return {
          id: n.id,
          type: 'groupNode',
          position: { x: n.x, y: n.y },
          style: { width: n.width ?? 400, height: n.height ?? 300 },
          data: { title: n.title, color: n.color || 'rgba(147, 197, 253, 0.15)', createdBy: 'user' as const },
          zIndex: -1,
        }
      }
      return {
        id: n.id,
        type: 'ideaNode',
        position: { x: n.x, y: n.y },
        parentId: n.parentId || undefined,
        data: {
          // 旧フォーマット（text フィールド）との互換処理
          title: n.title ?? (n as unknown as { text?: string }).text ?? '',
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
      sourceHandle: e.sourceHandle ?? 'right',
      targetHandle: e.targetHandle ?? 'left',
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
        return {
          id: n.id,
          nodeType: 'group' as const,
          title: n.data.title,
          x: n.position.x,
          y: n.position.y,
          color: n.data.color,
          createdBy: 'user' as const,
          width: typeof n.style?.width === 'number' ? n.style.width : 400,
          height: typeof n.style?.height === 'number' ? n.style.height : 300,
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

  clearPendingFitView: () => set({ pendingFitView: false }),
}))
