import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useShallow } from 'zustand/react/shallow'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ConnectionMode,
  useReactFlow,
  useViewport,
  type NodeTypes,
  type EdgeTypes,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useMapStore, useUIStore, useSettingsStore, type IdeaNodeData } from '@ideamap/core'
import { stopTimelapse } from '../../services/timelapsePlayer'
import { IdeaNode } from './IdeaNode'
import { GroupNode } from './GroupNode'
import { FloatingEdge } from './FloatingEdge'
import { Toolbar } from '../toolbar/Toolbar'
import { BottomNav } from '../toolbar/BottomNav'
import { FocusStateContext, type FocusState } from '../../hooks/useNodeFocus'

/** 実寸を測るまでのフォールバック値 */
const BAR_HALF_WIDTH_ESTIMATE = 120

function NodeActionBar() {
  const { selectedNodeId, setAIPanelOpen, openNodeDetail, setSelectedNodeId, connectingFromNodeId, setConnectingFromNodeId, openConfirmDialog } = useUIStore(
    useShallow((s) => ({
      selectedNodeId: s.selectedNodeId,
      setAIPanelOpen: s.setAIPanelOpen,
      openNodeDetail: s.openNodeDetail,
      setSelectedNodeId: s.setSelectedNodeId,
      connectingFromNodeId: s.connectingFromNodeId,
      setConnectingFromNodeId: s.setConnectingFromNodeId,
      openConfirmDialog: s.openConfirmDialog,
    }))
  )
  const deleteNode = useMapStore((s) => s.deleteNode)

  // 接続線のあるノードは削除の影響が大きいため、右クリックメニューと同じ確認を挟む
  const handleDelete = useCallback(() => {
    if (!selectedNodeId) return
    const removeNode = () => {
      deleteNode(selectedNodeId)
      setSelectedNodeId(null)
    }
    if (useMapStore.getState().hasConnectedEdges(selectedNodeId)) {
      openConfirmDialog({
        title: 'ノードを削除しますか？',
        message:
          'このノードには接続された線があります。削除すると、つながっている線もすべて削除されます。',
        confirmLabel: '削除する',
        danger: true,
        onConfirm: removeNode,
      })
    } else {
      removeNode()
    }
  }, [selectedNodeId, deleteNode, setSelectedNodeId, openConfirmDialog])
  // mapStore の nodes を参照することでドラッグ後の位置変化にも追従する。
  // 座標だけを useShallow で取り出し、無関係なストア更新では再描画しない
  const absPosition = useMapStore(
    useShallow((s) => {
      if (!selectedNodeId) return null
      const node = s.nodes.find((n) => n.id === selectedNodeId)
      if (!node) return null
      const parent = node.parentId ? s.nodes.find((n) => n.id === node.parentId) : undefined
      return {
        x: node.position.x + (parent?.position.x ?? 0),
        y: node.position.y + (parent?.position.y ?? 0),
      }
    })
  )
  useViewport() // ズーム・パン変化時に再レンダリングしてバーを再配置
  const { flowToScreenPosition, getNode } = useReactFlow()

  // 推定半幅ではスマホ幅で右端がはみ出すため、描画後に実寸を測ってクランプに使う
  const barRef = useRef<HTMLDivElement>(null)
  const [halfWidth, setHalfWidth] = useState(BAR_HALF_WIDTH_ESTIMATE)
  useLayoutEffect(() => {
    const w = barRef.current?.offsetWidth
    if (w && Math.abs(w / 2 - halfWidth) > 0.5) setHalfWidth(w / 2)
  }, [selectedNodeId, halfWidth])

  // 接続モード中はバナーが主役なので非表示
  if (!selectedNodeId || connectingFromNodeId) return null
  if (!absPosition) return null

  const rfNode = getNode(selectedNodeId)
  const nodeWidth = rfNode?.measured?.width ?? 150
  const nodeHeight = rfNode?.measured?.height ?? 60

  const { x: screenX, y: screenY } = flowToScreenPosition({
    x: absPosition.x + nodeWidth / 2,
    y: absPosition.y + nodeHeight,
  })

  const clampedLeft = Math.max(halfWidth + 8, Math.min(screenX, window.innerWidth - halfWidth - 8))

  return createPortal(
    <div
      ref={barRef}
      className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-1 py-1 whitespace-nowrap"
      style={{ position: 'fixed', left: clampedLeft, top: screenY + 8, transform: 'translateX(-50%)', zIndex: 40 }}
    >
      <button
        onClick={() => { setSelectedNodeId(selectedNodeId); setAIPanelOpen(true) }}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 font-medium hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-md transition-colors"
        title="AIに拡張を依頼"
      >
        <span>✦</span>
        <span>AI拡張</span>
      </button>
      <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
      <button
        onClick={() => setConnectingFromNodeId(selectedNodeId)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors"
        title="接続モード（スマホ用エッジ作成）"
      >
        <span>🔗</span>
        <span>接続</span>
      </button>
      <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
      <button
        onClick={() => openNodeDetail(selectedNodeId)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
        title="詳細を開く"
      >
        <span>📝</span>
        <span>詳細</span>
      </button>
      <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
      <button
        onClick={handleDelete}
        className="px-3 py-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors"
        title="削除"
        aria-label="ノードを削除"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>,
    document.body
  )
}

const nodeTypes: NodeTypes = {
  ideaNode: IdeaNode as NodeTypes['ideaNode'],
  groupNode: GroupNode as NodeTypes['groupNode'],
}

const edgeTypes: EdgeTypes = {
  floating: FloatingEdge,
}

export function IdeaCanvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, connectNodes, connectDroppedNode, pendingFitView, clearPendingFitView } = useMapStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      onNodesChange: s.onNodesChange,
      onEdgesChange: s.onEdgesChange,
      onConnect: s.onConnect,
      addNode: s.addNode,
      connectNodes: s.connectNodes,
      connectDroppedNode: s.connectDroppedNode,
      pendingFitView: s.pendingFitView,
      clearPendingFitView: s.clearPendingFitView,
    }))
  )
  // グループの子ノードもハイライト対象にするための親子関係。ドラッグ中に配列内容が変わらないよう
  // 文字列化して useShallow で比較し、フォーカス状態の再計算が毎フレーム走らないようにする
  const groupChildPairs = useMapStore(
    useShallow((s) => s.nodes.filter((n) => n.parentId).map((n) => `${n.id}|${n.parentId}`))
  )
  const { snapToGrid, theme } = useSettingsStore(
    useShallow((s) => ({ snapToGrid: s.snapToGrid, theme: s.theme }))
  )
  const {
    selectedNodeId,
    setSelectedNodeId,
    setEditingNodeId,
    openContextMenu,
    closeContextMenu,
    setDragOverGroupId,
    setDragOverNodeId,
    isPresentationMode,
    presentationNodeIds,
    presentationCurrentIndex,
    renderAllNodes,
    connectingFromNodeId,
    setConnectingFromNodeId,
    addToast,
    isTimelapsePlaying,
  } = useUIStore(
    useShallow((s) => ({
      selectedNodeId: s.selectedNodeId,
      setSelectedNodeId: s.setSelectedNodeId,
      setEditingNodeId: s.setEditingNodeId,
      openContextMenu: s.openContextMenu,
      closeContextMenu: s.closeContextMenu,
      setDragOverGroupId: s.setDragOverGroupId,
      setDragOverNodeId: s.setDragOverNodeId,
      isPresentationMode: s.isPresentationMode,
      presentationNodeIds: s.presentationNodeIds,
      presentationCurrentIndex: s.presentationCurrentIndex,
      renderAllNodes: s.renderAllNodes,
      connectingFromNodeId: s.connectingFromNodeId,
      setConnectingFromNodeId: s.setConnectingFromNodeId,
      addToast: s.addToast,
      isTimelapsePlaying: s.isTimelapsePlaying,
    }))
  )
  const { screenToFlowPosition, fitView } = useReactFlow()
  // pane 長押し用タイマー
  const paneLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!pendingFitView) return
    // ノードがDOMに反映されるのを待ってからfitViewを実行
    const id = setTimeout(() => {
      // マップ横断リンク・検索からの遷移（Phase 52）はジャンプ先ノードを指定していることがある。
      // 通常のマップ読み込み（pendingFitView のみ）は全体表示のまま
      const jumpNodeId = useUIStore.getState().pendingJumpNodeId
      if (jumpNodeId) {
        setSelectedNodeId(jumpNodeId)
        fitView({ nodes: [{ id: jumpNodeId }], duration: 400, padding: 0.3 })
        useUIStore.getState().setPendingJumpNodeId(null)
      } else {
        fitView({ padding: 0.2, duration: 400 })
      }
      clearPendingFitView()
    }, 50)
    return () => clearTimeout(id)
  }, [pendingFitView, fitView, clearPendingFitView, setSelectedNodeId])

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (isTimelapsePlaying) return
      if (connectingFromNodeId) {
        if (connectingFromNodeId === node.id) {
          // 同ノードをタップしたら接続モードのみキャンセル
          setConnectingFromNodeId(null)
        } else {
          connectNodes(connectingFromNodeId, node.id)
          setConnectingFromNodeId(null)
          addToast('接続しました', 'success')
        }
        return
      }
      setSelectedNodeId(node.id)
    },
    [connectingFromNodeId, connectNodes, setConnectingFromNodeId, addToast, setSelectedNodeId, isTimelapsePlaying]
  )

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null)
    closeContextMenu()
    // 接続モード中に空白タップでキャンセル
    setConnectingFromNodeId(null)
  }, [setSelectedNodeId, closeContextMenu, setConnectingFromNodeId])

  const handleDoubleClickOnPane = useCallback(
    (e: React.MouseEvent) => {
      // タイムラプス再生中はキャンバスの内容がスナップショットに置き換わり続けるため編集不可にする
      if (isTimelapsePlaying) return
      const target = e.target as HTMLElement
      if (!target.closest('.react-flow__node')) {
        const { x, y } = screenToFlowPosition({ x: e.clientX, y: e.clientY })
        const newId = addNode('新しいアイデア', x - 60, y - 20)
        setSelectedNodeId(newId)
        setEditingNodeId(newId)
      }
    },
    [addNode, screenToFlowPosition, setSelectedNodeId, setEditingNodeId, isTimelapsePlaying]
  )

  const handleNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: Node) => {
      e.preventDefault()
      if (isTimelapsePlaying) return
      // 接続モード中は接続先の選択が目的。スマホの長押しはブラウザの contextmenu も発火させるため、
      // ここを塞がないとタップ操作の裏でメニューが開いてしまう
      if (connectingFromNodeId) return
      setSelectedNodeId(node.id)
      const menuType = node.type === 'groupNode' ? 'group' : 'node'
      openContextMenu({ type: menuType, x: e.clientX, y: e.clientY, targetId: node.id })
    },
    [openContextMenu, setSelectedNodeId, connectingFromNodeId, isTimelapsePlaying]
  )

  const handleEdgeContextMenu = useCallback(
    (e: React.MouseEvent, edge: Edge) => {
      e.preventDefault()
      if (isTimelapsePlaying) return
      openContextMenu({ type: 'edge', x: e.clientX, y: e.clientY, targetId: edge.id })
    },
    [openContextMenu, isTimelapsePlaying]
  )

  // ドロップ接続: ドラッグ開始位置（親相対座標）と現在の重なり先。
  // handleNodeDragStop で uiStore を購読せずに参照できるよう ref にミラーする
  const dragStartPosRef = useRef<{ id: string; position: { x: number; y: number } } | null>(null)
  const dropTargetRef = useRef<string | null>(null)

  const handleNodeDragStart = useCallback((_: React.MouseEvent, node: Node) => {
    dragStartPosRef.current = { id: node.id, position: { ...node.position } }
  }, [])

  const handleNodeDrag = useCallback(
    (_: React.MouseEvent, draggedNode: Node) => {
      // --- ドロップ接続: ドラッグノードの中心が重なった未接続 ideaNode をハイライト ---
      // 子ノードの position は親相対のため、判定は絶対座標に直してから行う
      const absOf = (n: Node): { x: number; y: number } => {
        if (!n.parentId) return n.position
        const parent = nodes.find((p) => p.id === n.parentId)
        return parent
          ? { x: parent.position.x + n.position.x, y: parent.position.y + n.position.y }
          : n.position
      }
      const nodeW = draggedNode.measured?.width ?? 160
      const nodeH = draggedNode.measured?.height ?? 60
      // 複数選択ドラッグは戻す位置が掴んだノードにしか効かず挙動が崩れるため対象外
      const multiDrag = nodes.some((n) => n.selected && n.id !== draggedNode.id)
      let dropTargetId: string | null = null
      if (!multiDrag) {
        const dragPos = absOf(draggedNode)
        const cx = dragPos.x + nodeW / 2
        const cy = dragPos.y + nodeH / 2
        const target = nodes.find((n) => {
          if (n.type !== 'ideaNode' || n.id === draggedNode.id) return false
          const tPos = absOf(n)
          const tW = n.measured?.width ?? 160
          const tH = n.measured?.height ?? 60
          return cx >= tPos.x && cx <= tPos.x + tW && cy >= tPos.y && cy <= tPos.y + tH
        })
        // 既に接続済み（向き・双方向を問わず）の相手は対象外 = 通常の移動として扱う
        if (target) {
          const already = edges.some(
            (e) =>
              (e.source === draggedNode.id && e.target === target.id) ||
              (e.source === target.id && e.target === draggedNode.id)
          )
          if (!already) dropTargetId = target.id
        }
      }
      dropTargetRef.current = dropTargetId
      setDragOverNodeId(dropTargetId)

      // --- グループハイライト: 接続先ノードがあるときはそちらを優先して消す ---
      if (dropTargetId || draggedNode.parentId) {
        setDragOverGroupId(null)
        return
      }
      const { x, y } = draggedNode.position
      const groupNodes = nodes.filter((n) => n.type === 'groupNode')
      const overlapping = groupNodes.find((g) => {
        const gW = typeof g.style?.width === 'number' ? g.style.width : 400
        const gH = typeof g.style?.height === 'number' ? g.style.height : 300
        return x < g.position.x + gW && x + nodeW > g.position.x &&
               y < g.position.y + gH && y + nodeH > g.position.y
      })
      setDragOverGroupId(overlapping?.id ?? null)
    },
    [nodes, edges, setDragOverGroupId, setDragOverNodeId]
  )

  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const targetId = dropTargetRef.current
      const start = dragStartPosRef.current
      if (targetId && start && start.id === node.id) {
        connectDroppedNode(node.id, targetId, start.position)
        addToast('接続しました', 'success')
      }
      dropTargetRef.current = null
      dragStartPosRef.current = null
      setDragOverNodeId(null)
      setDragOverGroupId(null)
    },
    [connectDroppedNode, addToast, setDragOverNodeId, setDragOverGroupId]
  )

  const handlePaneContextMenu = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      e.preventDefault()
      if (isTimelapsePlaying) return
      const flowPosition = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      openContextMenu({ type: 'pane', x: e.clientX, y: e.clientY, flowPosition })
    },
    [openContextMenu, screenToFlowPosition, isTimelapsePlaying]
  )

  // フォーカスモード: 選択ノードとその直接接続だけを明るく表示
  // 発表モード: カレントノードのみフル表示、他は薄く表示
  // 接続モード: 接続元ノードに強調リングを付与
  //
  // ノード配列に style を差し込むと選択のたび全ノードが新オブジェクトになり React Flow が
  // 全ノードを再描画するため、状態だけを Context で配って各ノード／エッジに判定させる
  const highlightNodeIds = useMemo(() => {
    if (isPresentationMode || connectingFromNodeId || !selectedNodeId) return null
    const ids = new Set<string>([selectedNodeId])
    edges.forEach((e) => {
      if (e.source === selectedNodeId) ids.add(e.target)
      if (e.target === selectedNodeId) ids.add(e.source)
    })
    // グループが選択されている場合は子ノードもハイライト
    groupChildPairs.forEach((pair) => {
      const [childId, parentId] = pair.split('|')
      if (ids.has(parentId)) ids.add(childId)
    })
    return ids
  }, [edges, groupChildPairs, selectedNodeId, isPresentationMode, connectingFromNodeId])

  const focusState = useMemo<FocusState>(
    () => ({
      selectedNodeId,
      highlightNodeIds,
      presentationNodeId: isPresentationMode
        ? presentationNodeIds[presentationCurrentIndex] ?? null
        : null,
      isPresentationMode,
      connectingFromNodeId,
    }),
    [
      selectedNodeId,
      highlightNodeIds,
      isPresentationMode,
      presentationNodeIds,
      presentationCurrentIndex,
      connectingFromNodeId,
    ]
  )

  // pane 長押し: 空白 500ms で pane 用コンテキストメニューを開く
  const handlePaneTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return
      const el = e.target as HTMLElement
      // ノード上の長押しは IdeaNode 側が処理するのでスキップ（二重発火防止）
      if (!el.closest('.react-flow__pane') || el.closest('.react-flow__node')) return
      const touch = e.touches[0]
      const x = touch.clientX
      const y = touch.clientY
      paneLongPressTimer.current = setTimeout(() => {
        const flowPosition = screenToFlowPosition({ x, y })
        openContextMenu({ type: 'pane', x, y, flowPosition })
        navigator.vibrate?.(10)
      }, 500)
    },
    [screenToFlowPosition, openContextMenu]
  )

  const handlePaneTouchEnd = useCallback(() => {
    if (paneLongPressTimer.current) {
      clearTimeout(paneLongPressTimer.current)
      paneLongPressTimer.current = null
    }
  }, [])

  const isEmpty = nodes.length === 0

  // Controls / MiniMap のボーダー色はダークで浮きが出るため theme で最小限の上書きをする
  const controlsClass = theme === 'dark'
    ? '!shadow-md !rounded-xl !border !border-gray-700 !bg-gray-800'
    : '!shadow-md !rounded-xl !border !border-gray-200'
  const minimapClass = theme === 'dark'
    ? '!border !border-gray-700 !rounded-xl !shadow-md !bg-gray-800'
    : '!border !border-gray-200 !rounded-xl !shadow-md'

  return (
    <FocusStateContext.Provider value={focusState}>
      {/* min-w-0: BottomNav の min-content 幅（横スクロールする9〜10ボタン）がフレックスアイテムの
          自動最小幅になり、キャンバス列がビューポートより広くなって右端が見切れるのを防ぐ */}
      <div className="flex flex-col flex-1 min-h-0 min-w-0">
        {/* 接続モードバナー: 接続先のノードをタップするよう促す（スマホ用） */}
        {connectingFromNodeId && createPortal(
          <div
            style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 45, pointerEvents: 'auto' }}
            className="flex items-center justify-between px-4 py-3 bg-indigo-600 text-white shadow-lg"
          >
            <span className="text-sm font-medium">🔗 接続先のノードをタップ</span>
            <button
              onClick={() => setConnectingFromNodeId(null)}
              className="text-sm font-medium px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md transition-colors"
            >
              キャンセル
            </button>
          </div>,
          document.body
        )}
        {/* タイムラプス再生中オーバーレイ: PresentationMode と違いキャンバス描画自体は使い回すため、
            全面を覆う代わりにバナーだけを重ねる。pointer-events-none で下のキャンバスの操作を妨げず、
            編集の無効化は ReactFlow 側の nodesDraggable 等のフラグ・ツールバー非表示・キーボード
            ショートカット抑制で行う。
            ponytail: NodePanel/NodeDetailPanel など再生中も残る他パネル経由の編集は塞いでいない
            （選択ノードIDがスナップショット間で解決できる限り開き続けられる）。実運用で問題が出たら
            isTimelapsePlaying を各パネルの編集操作にもガードとして追加する */}
        {isTimelapsePlaying && createPortal(
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 45 }}
            className="pointer-events-none flex flex-col items-center gap-2 pt-4"
          >
            <div className="px-4 py-2 bg-black/70 text-white text-sm font-medium rounded-full shadow-lg">
              ⏱ タイムラプス再生中
            </div>
            <button
              onClick={() => stopTimelapse()}
              className="pointer-events-auto px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-medium rounded-full shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              停止
            </button>
          </div>,
          document.body
        )}
        <div
          className="flex-1 relative"
          onDoubleClick={handleDoubleClickOnPane}
          onTouchStart={handlePaneTouchStart}
          onTouchEnd={handlePaneTouchEnd}
          onTouchMove={handlePaneTouchEnd}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            className={connectingFromNodeId ? 'tap-connect' : undefined}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            onNodeDragStart={handleNodeDragStart}
            onNodeDrag={handleNodeDrag}
            onNodeDragStop={handleNodeDragStop}
            onPaneClick={handlePaneClick}
            onNodeContextMenu={handleNodeContextMenu}
            onEdgeContextMenu={handleEdgeContextMenu}
            onPaneContextMenu={handlePaneContextMenu}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionMode={ConnectionMode.Loose}
            deleteKeyCode={null}
            snapToGrid={snapToGrid}
            snapGrid={[20, 20]}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            panOnScroll
            minZoom={0.1}
            maxZoom={3}
            nodesDraggable={!isPresentationMode && !isTimelapsePlaying}
            nodesConnectable={!isPresentationMode && !isTimelapsePlaying}
            elementsSelectable={!isPresentationMode && !isTimelapsePlaying}
            panOnDrag={!isPresentationMode}
            // colorMode で Controls / MiniMap / 組み込みUIをテーマに合わせる
            colorMode={theme}
            // 画面外ノードの DOM 描画をスキップして大規模マップのパフォーマンスを改善する。
            // エクスポート時のみ renderAllNodes フラグで一時的に全描画に切り替える
            onlyRenderVisibleElements={!renderAllNodes}
          >
            {/* ダークではドット色を暗い配色に変える（背景色は index.css の .dark .react-flow__background で対応） */}
            <Background color={theme === 'dark' ? '#374151' : '#e5e7eb'} gap={20} size={1} />
            <Controls showInteractive={false} className={controlsClass} />
            <MiniMap
              nodeColor={(node) => (node.data as IdeaNodeData).color ?? '#e5e7eb'}
              className={minimapClass}
              zoomable
              pannable
            />
          </ReactFlow>

          {/* エンプティ状態: ノードが0件のときガイドを表示 */}
          {isEmpty && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="text-center select-none">
                <div className="text-6xl mb-4 opacity-30">💡</div>
                <p className="text-gray-400 dark:text-gray-500 text-base font-medium mb-1">マップが空です</p>
                <p className="text-gray-300 dark:text-gray-600 text-sm">ダブルクリックしてアイデアを追加</p>
              </div>
            </div>
          )}
        </div>
        {/* タイムラプス再生中はツールバー類の編集操作（Undo/Redo・整列・追加）も塞ぐ。
            画面遷移はせずキャンバス描画を使い回すため、発表モードと同じ非表示切り替えで済ませる */}
        {!isPresentationMode && !isTimelapsePlaying && <Toolbar />}
        {!isPresentationMode && !isTimelapsePlaying && <BottomNav />}
        {!isPresentationMode && !isTimelapsePlaying && <NodeActionBar />}
      </div>
    </FocusStateContext.Provider>
  )
}
