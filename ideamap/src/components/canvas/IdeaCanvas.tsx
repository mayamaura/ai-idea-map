import { useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ConnectionMode,
  useReactFlow,
  type NodeTypes,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useMapStore } from '../../stores/mapStore'
import { useUIStore } from '../../stores/uiStore'
import { IdeaNode } from './IdeaNode'
import { Toolbar } from '../toolbar/Toolbar'
import { BottomNav } from '../toolbar/BottomNav'
import type { IdeaNodeData } from '../../types'

const nodeTypes: NodeTypes = {
  ideaNode: IdeaNode as NodeTypes['ideaNode'],
}

export function IdeaCanvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode } = useMapStore()
  const { setSelectedNodeId, openContextMenu, closeContextMenu } = useUIStore()
  const { screenToFlowPosition } = useReactFlow()

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
      openContextMenu({ type: 'node', x: e.clientX, y: e.clientY, targetId: node.id })
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

  const handlePaneContextMenu = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      e.preventDefault()
      const flowPosition = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      openContextMenu({ type: 'pane', x: e.clientX, y: e.clientY, flowPosition })
    },
    [openContextMenu, screenToFlowPosition]
  )

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 relative" onDoubleClick={handleDoubleClickOnPane}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onNodeContextMenu={handleNodeContextMenu}
          onEdgeContextMenu={handleEdgeContextMenu}
          onPaneContextMenu={handlePaneContextMenu}
          nodeTypes={nodeTypes}
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
      </div>
      <Toolbar />
      <BottomNav />
    </div>
  )
}
