import { applyNodeChanges, type Edge, type NodeChange } from '@xyflow/react'
import { v4 as uuidv4 } from 'uuid'
import {
  computePushOut,
  expandGroupIds,
  findOverlappingGroup,
  getGroupSize,
  isOutsideParent,
  syncGroupMeasured,
  DEFAULT_NODE_SIZE,
} from '../../layout/groupGeometry'
import { findFreePosition } from '../../layout/mapLayout'
import type { IdeaNodeData } from '../../types'
import { useUIStore } from '../uiStore'
import { pushPast, snapshot } from './history'
import { DEFAULT_NODE_COLOR, initialNodes, makeEdge } from './constants'
import type { IdeaNode, MapSliceCreator, NodeSlice } from './types'

/** 整列・分配で使うノードサイズ（measured 未確定時はフォールバック） */
function getSize(n: IdeaNode): { width: number; height: number } {
  return {
    width: n.measured?.width ?? DEFAULT_NODE_SIZE.width,
    height: n.measured?.height ?? DEFAULT_NODE_SIZE.height,
  }
}

export const createNodeSlice: MapSliceCreator<NodeSlice> = (set, get) => ({
  nodes: initialNodes,
  clipboard: { nodes: [], edges: [] },

  onNodesChange: (changes) => {
    const currentNodes = get().nodes
    const groupNodes = currentNodes.filter((n) => n.type === 'groupNode')

    let pendingDragIn: { nodeId: string; groupId: string; groupName: string } | null = null
    let pendingDragOut: { nodeId: string; groupName: string } | null = null

    const processedChanges: NodeChange<IdeaNode>[] =
      groupNodes.length > 0
        ? changes.map((c) => {
            if (c.type !== 'position' || c.dragging !== false || !c.position) return c
            // ドロップ接続のターゲットに重なったままのドロップは直後に開始位置へ戻されるため、
            // ドロップ位置でのグループ出入り判定（ダイアログ・押し出し）を行わない
            if (useUIStore.getState().dragOverNodeId) return c
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

  addSiblingNode: (nodeId) => {
    const state = get()
    const node = state.nodes.find((n) => n.id === nodeId)
    if (!node) return null

    // 親エッジを探す（このノードが target になっているエッジ）
    const parentEdge = state.edges.find((e) => e.target === nodeId)
    if (parentEdge) {
      // 親があれば親に接続した子ノードとして作成
      return get().addConnectedNode(parentEdge.source)
    }

    // 親がない独立ノード: 選択ノードの下に配置
    const nodeH = node.measured?.height ?? DEFAULT_NODE_SIZE.height
    const id = uuidv4()
    const pos = { x: node.position.x, y: node.position.y + nodeH + 30 }
    const groupNodes = state.nodes.filter((n) => n.type === 'groupNode')
    const finalPos = computePushOut(pos, node.measured, groupNodes)
    const newNode: IdeaNode = {
      id,
      type: 'ideaNode',
      position: finalPos,
      data: { title: '新しいアイデア', color: DEFAULT_NODE_COLOR, createdBy: 'user' },
    }
    set((s) => ({
      nodes: [...s.nodes, newNode],
      past: pushPast(s.past, snapshot(s.nodes, s.edges)),
      future: [],
    }))
    return id
  },

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
      const { width: gW, height: gH } = groupNode
        ? getGroupSize(groupNode)
        : { width: 400, height: 300 }

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
      finalPosition = findFreePosition(
        {
          x: parent.position.x + 280,
          y: parent.position.y + childCount * 90,
        },
        state.nodes
      )
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
      // グループノードを消すときは中身の子ノードも一緒に消す
      const idSet = expandGroupIds(ids, state.nodes)
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
      const deleteIds = expandGroupIds(selNodes.map((n) => n.id), state.nodes)
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

  setNodes: (nodes) =>
    set((state) => ({
      nodes: syncGroupMeasured(nodes),
      past: pushPast(state.past, snapshot(state.nodes, state.edges)),
      future: [],
    })),

  setNodesNoHistory: (nodes) =>
    set({ nodes: syncGroupMeasured(nodes) }),

  commitNodesWithHistory: (originalNodes, finalNodes) =>
    set((state) => ({
      nodes: syncGroupMeasured(finalNodes),
      past: pushPast(state.past, snapshot(originalNodes, state.edges)),
      future: [],
    })),

  selectOnlyNode: (id) =>
    set((state) => ({
      nodes: state.nodes.map((n) => ({ ...n, selected: n.id === id })),
    })),
})
