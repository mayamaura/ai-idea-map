import { applyNodeChanges, type NodeChange } from '@xyflow/react'
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

/**
 * ドラッグ開始時点のスナップショット。
 * dragging=true の中間フレームは非履歴更新で state.nodes を直接動かすため、
 * 確定（dragging=false）時に state から取ったスナップショットは「最後の中間位置」になってしまい
 * Undo でドラッグ開始位置に戻れない。最初の dragging=true でここに控え、確定時にこれを past に積む。
 * 確定されないまま終わったドラッグ（コンポーネント破棄等）が残っても、その移動は履歴に積まれて
 * いないので、次の確定時にこれを使うことは「最後に確定した状態へ戻す」という点で正しい。
 */
let dragStartSnapshot: ReturnType<typeof snapshot> | null = null

export const createNodeSlice: MapSliceCreator<NodeSlice> = (set, get) => ({
  nodes: initialNodes,

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
    const isDragging = processedChanges.some(
      (c) => c.type === 'position' && (c as { dragging?: boolean }).dragging === true
    )
    set((state) => {
      if (isDragging && dragStartSnapshot === null) {
        dragStartSnapshot = snapshot(state.nodes, state.edges)
      }
      let newNodes = applyNodeChanges(processedChanges, state.nodes) as IdeaNode[]
      if (groupResizeEnds.length > 0) {
        newNodes = newNodes.map((n) => {
          const rc = groupResizeEnds.find((c) => c.id === n.id)
          if (!rc) return n
          return { ...n, style: { ...n.style, width: rc.dimensions.width, height: rc.dimensions.height } }
        })
      }
      if (isHistoric) {
        const before = dragStartSnapshot ?? snapshot(state.nodes, state.edges)
        dragStartSnapshot = null
        return {
          nodes: newNodes,
          past: pushPast(state.past, before),
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
        n.id === id ? { ...n, data: { ...n.data, title, updatedAt: new Date().toISOString() } } : n
      ),
      past: pushPast(state.past, snapshot(state.nodes, state.edges)),
      future: [],
    })),

  updateNodeBody: (id, body) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, body: body || undefined, updatedAt: new Date().toISOString() } }
          : n
      ),
      past: pushPast(state.past, snapshot(state.nodes, state.edges)),
      future: [],
    })),

  updateNodeColor: (id, color) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, color, updatedAt: new Date().toISOString() } } : n
      ),
      past: pushPast(state.past, snapshot(state.nodes, state.edges)),
      future: [],
    })),

  updateNodeCategory: (id, categoryId, color) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, categoryId, color, updatedAt: new Date().toISOString() } }
          : n
      ),
      past: pushPast(state.past, snapshot(state.nodes, state.edges)),
      future: [],
    })),

  updateNodeUrl: (id, url) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, url: url || undefined, updatedAt: new Date().toISOString() } }
          : n
      ),
      past: pushPast(state.past, snapshot(state.nodes, state.edges)),
      future: [],
    })),

  updateNodeImage: (id, image) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, image, updatedAt: new Date().toISOString() } } : n
      ),
      past: pushPast(state.past, snapshot(state.nodes, state.edges)),
      future: [],
    })),

  updateNodeLinkedMap: (id, link) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id
          ? {
              ...n,
              data: {
                ...n.data,
                linkedMapId: link?.mapId,
                linkedMapOrigin: link?.origin,
                updatedAt: new Date().toISOString(),
              },
            }
          : n
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

  mergeNodes: (keepId, mergeId) => {
    const state = get()
    const keep = state.nodes.find((n) => n.id === keepId)
    const merge = state.nodes.find((n) => n.id === mergeId)
    if (!keep || !merge || keepId === mergeId) return

    const mergedBody = [keep.data.body, merge.data.body].filter((b) => b?.trim()).join('\n\n')

    // mergeId 宛のエッジを keepId へ張り替える。張替えで自己ループになるものは除外し、
    // 既存エッジと向きを問わず同じペアになったものは重複として1本に絞る
    const retargeted = state.edges
      .map((e) => ({
        ...e,
        source: e.source === mergeId ? keepId : e.source,
        target: e.target === mergeId ? keepId : e.target,
      }))
      .filter((e) => e.source !== e.target)

    const seenPairs = new Set<string>()
    const dedupedEdges = retargeted.filter((e) => {
      const key = [e.source, e.target].sort().join(':')
      if (seenPairs.has(key)) return false
      seenPairs.add(key)
      return true
    })

    set({
      nodes: state.nodes
        .filter((n) => n.id !== mergeId)
        .map((n) =>
          n.id === keepId
            ? { ...n, data: { ...n.data, body: mergedBody || undefined, updatedAt: new Date().toISOString() } }
            : n
        ),
      edges: dedupedEdges,
      past: pushPast(state.past, snapshot(state.nodes, state.edges)),
      future: [],
    })
  },

  applyClusterCategory: (nodeIds, categoryId, color) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        nodeIds.includes(n.id)
          ? { ...n, data: { ...n.data, categoryId, color, updatedAt: new Date().toISOString() } }
          : n
      ),
      past: pushPast(state.past, snapshot(state.nodes, state.edges)),
      future: [],
    })),

  setNodes: (nodes) =>
    set((state) => ({
      nodes: syncGroupMeasured(nodes),
      past: pushPast(state.past, snapshot(state.nodes, state.edges)),
      future: [],
    })),

  addNodesWithEdges: (nodes, edges) =>
    set((state) => ({
      nodes: [...state.nodes, ...nodes],
      edges: [...state.edges, ...edges],
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
