import { useCallback, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
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
import { useMapStore } from '../../stores/mapStore'
import { useUIStore } from '../../stores/uiStore'
import { IdeaNode } from './IdeaNode'
import { GroupNode } from './GroupNode'
import { FloatingEdge } from './FloatingEdge'
import { Toolbar } from '../toolbar/Toolbar'
import { BottomNav } from '../toolbar/BottomNav'
import type { IdeaNodeData } from '../../types'

function NodeActionBar() {
  const { selectedNodeId, setAIPanelOpen, openNodeDetail, setSelectedNodeId } = useUIStore()
  const { deleteNode, nodes } = useMapStore()
  useViewport() // ズーム・パン変化時に再レンダリングしてバーを再配置
  const { flowToScreenPosition, getNode } = useReactFlow()

  if (!selectedNodeId) return null

  // mapStore の nodes を参照することでドラッグ後の位置変化にも追従
  const storeNode = nodes.find((n) => n.id === selectedNodeId)
  if (!storeNode) return null

  const rfNode = getNode(selectedNodeId)
  const nodeWidth = rfNode?.measured?.width ?? 150
  const nodeHeight = rfNode?.measured?.height ?? 60

  const parentNode = storeNode.parentId ? nodes.find((n) => n.id === storeNode.parentId) : null
  const absX = storeNode.position.x + (parentNode?.position.x ?? 0)
  const absY = storeNode.position.y + (parentNode?.position.y ?? 0)
  const { x: screenX, y: screenY } = flowToScreenPosition({
    x: absX + nodeWidth / 2,
    y: absY + nodeHeight,
  })

  return createPortal(
    <div
      className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-lg px-1 py-1 whitespace-nowrap"
      style={{ position: 'fixed', left: screenX, top: screenY + 8, transform: 'translateX(-50%)', zIndex: 40 }}
    >
      <button
        onClick={() => { setSelectedNodeId(selectedNodeId); setAIPanelOpen(true) }}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-primary-600 font-medium hover:bg-primary-50 rounded-md transition-colors"
        title="AIに拡張を依頼"
      >
        <span>✦</span>
        <span>AI拡張</span>
      </button>
      <div className="w-px h-4 bg-gray-200" />
      <button
        onClick={() => openNodeDetail(selectedNodeId)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 font-medium hover:bg-gray-100 rounded-md transition-colors"
        title="詳細を開く"
      >
        <span>📝</span>
        <span>詳細</span>
      </button>
      <div className="w-px h-4 bg-gray-200" />
      <button
        onClick={() => { deleteNode(selectedNodeId); setSelectedNodeId(null) }}
        className="px-3 py-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
        title="削除"
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
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, pendingFitView, clearPendingFitView } = useMapStore()
  const { selectedNodeId, setSelectedNodeId, openContextMenu, closeContextMenu, setDragOverGroupId } = useUIStore()
  const { screenToFlowPosition, fitView } = useReactFlow()

  useEffect(() => {
    if (!pendingFitView) return
    // ノードがDOMに反映されるのを待ってからfitViewを実行
    const id = setTimeout(() => {
      fitView({ padding: 0.2, duration: 400 })
      clearPendingFitView()
    }, 50)
    return () => clearTimeout(id)
  }, [pendingFitView, fitView, clearPendingFitView])

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id)
    },
    [setSelectedNodeId]
  )

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null)
    closeContextMenu()
  }, [setSelectedNodeId, closeContextMenu])

  const handleDoubleClickOnPane = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.react-flow__node')) {
        const { x, y } = screenToFlowPosition({ x: e.clientX, y: e.clientY })
        addNode('新しいアイデア', x - 60, y - 20)
      }
    },
    [addNode, screenToFlowPosition]
  )

  const handleNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: Node) => {
      e.preventDefault()
      setSelectedNodeId(node.id)
      const menuType = node.type === 'groupNode' ? 'group' : 'node'
      openContextMenu({ type: menuType, x: e.clientX, y: e.clientY, targetId: node.id })
    },
    [openContextMenu, setSelectedNodeId]
  )

  const handleEdgeContextMenu = useCallback(
    (e: React.MouseEvent, edge: Edge) => {
      e.preventDefault()
      openContextMenu({ type: 'edge', x: e.clientX, y: e.clientY, targetId: edge.id })
    },
    [openContextMenu]
  )

  const handleNodeDrag = useCallback(
    (_: React.MouseEvent, draggedNode: Node) => {
      if (draggedNode.parentId) {
        setDragOverGroupId(null)
        return
      }
      const nodeW = draggedNode.measured?.width ?? 160
      const nodeH = draggedNode.measured?.height ?? 60
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
    [nodes, setDragOverGroupId]
  )

  const handleNodeDragStop = useCallback(() => {
    setDragOverGroupId(null)
  }, [setDragOverGroupId])

  const handlePaneContextMenu = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      e.preventDefault()
      const flowPosition = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      openContextMenu({ type: 'pane', x: e.clientX, y: e.clientY, flowPosition })
    },
    [openContextMenu, screenToFlowPosition]
  )

  // フォーカスモード: 選択ノードとその直接接続だけを明るく表示
  const displayNodes = useMemo(() => {
    if (!selectedNodeId) return nodes
    const highlightIds = new Set<string>([selectedNodeId])
    edges.forEach((e) => {
      if (e.source === selectedNodeId) highlightIds.add(e.target)
      if (e.target === selectedNodeId) highlightIds.add(e.source)
    })
    // グループが選択されている場合は子ノードもハイライト
    nodes.forEach((n) => {
      if (n.parentId && highlightIds.has(n.parentId)) highlightIds.add(n.id)
    })
    return nodes.map((n) =>
      highlightIds.has(n.id) ? n : { ...n, style: { ...n.style, opacity: 0.15 } }
    )
  }, [nodes, edges, selectedNodeId])

  const displayEdges = useMemo(() => {
    if (!selectedNodeId) return edges
    return edges.map((e) =>
      e.source === selectedNodeId || e.target === selectedNodeId
        ? e
        : { ...e, style: { ...e.style, opacity: 0.1 } }
    )
  }, [edges, selectedNodeId])

  const isEmpty = nodes.length === 0

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 relative" onDoubleClick={handleDoubleClickOnPane}>
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
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
          fitView
          fitViewOptions={{ padding: 0.2 }}
          panOnScroll
          minZoom={0.1}
          maxZoom={3}
        >
          <Background color="#e5e7eb" gap={20} size={1} />
          <Controls showInteractive={false} className="!shadow-md !rounded-xl !border !border-gray-200" />
          <MiniMap
            nodeColor={(node) => (node.data as IdeaNodeData).color ?? '#e5e7eb'}
            className="!border !border-gray-200 !rounded-xl !shadow-md"
            zoomable
            pannable
          />
        </ReactFlow>

        {/* エンプティ状態: ノードが0件のときガイドを表示 */}
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="text-center select-none">
              <div className="text-6xl mb-4 opacity-30">💡</div>
              <p className="text-gray-400 text-base font-medium mb-1">マップが空です</p>
              <p className="text-gray-300 text-sm">ダブルクリックしてアイデアを追加</p>
            </div>
          </div>
        )}
      </div>
      <Toolbar />
      <BottomNav />
      <NodeActionBar />
    </div>
  )
}
