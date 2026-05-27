import { useReactFlow } from '@xyflow/react'
import { useMapStore } from '../../stores/mapStore'
import { applyDagreLayout } from '../../utils/mapLayout'
import type { IdeaNodeData } from '../../types'
import type { Node } from '@xyflow/react'

export function Toolbar() {
  const { fitView, zoomIn, zoomOut, getViewport } = useReactFlow()
  const { addNode, nodes, edges, setNodes, undo, redo, past, future } = useMapStore()

  const handleAddNode = () => {
    const { x, y, zoom } = getViewport()
    addNode('新しいアイデア', (-x + 200) / zoom, (-y + 200) / zoom)
  }

  const handleAutoLayout = () => {
    const laid = applyDagreLayout(nodes as Node<IdeaNodeData>[], edges)
    setNodes(laid as Node<IdeaNodeData>[])
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50)
  }

  const canUndo = past.length > 0
  const canRedo = future.length > 0

  return (
    <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white border-t border-gray-200 z-10 flex-shrink-0">
      <AddNodeButton onClick={handleAddNode} />
      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Undo / Redo */}
      <button
        onClick={undo}
        disabled={!canUndo}
        className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="元に戻す (Ctrl+Z)"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="やり直し (Ctrl+Y)"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 10H11a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
        </svg>
      </button>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* 自動整列 */}
      <button
        onClick={handleAutoLayout}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        title="ノードを自動整列"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
        整列
      </button>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Zoom controls */}
      <button
        onClick={() => zoomIn()}
        className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        title="ズームイン"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="11" cy="11" r="8" strokeWidth="2" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" />
          <line x1="11" y1="8" x2="11" y2="14" strokeWidth="2" />
          <line x1="8" y1="11" x2="14" y2="11" strokeWidth="2" />
        </svg>
      </button>
      <button
        onClick={() => zoomOut()}
        className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        title="ズームアウト"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="11" cy="11" r="8" strokeWidth="2" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" />
          <line x1="8" y1="11" x2="14" y2="11" strokeWidth="2" />
        </svg>
      </button>
      <button
        onClick={() => fitView({ padding: 0.1, duration: 300 })}
        className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        title="全体表示"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>
    </div>
  )
}

export function AddNodeButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <line x1="12" y1="5" x2="12" y2="19" strokeWidth="2" strokeLinecap="round" />
        <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2" strokeLinecap="round" />
      </svg>
      ノード追加
    </button>
  )
}
