import { useState, useRef, useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useMapStore } from '../../stores/mapStore'
import { useUIStore } from '../../stores/uiStore'
import { applyDagreLayout, applyRadialLayout } from '../../utils/mapLayout'
import type { IdeaNodeData } from '../../types'
import type { Node } from '@xyflow/react'

export function Toolbar() {
  const { fitView, zoomIn, zoomOut, getViewport } = useReactFlow()
  const { addNode, nodes, edges, setNodes, undo, redo, past, future, deleteSelected } = useMapStore()
  const { selectedNodeId, setSelectedNodeId } = useUIStore()
  const [showLayoutMenu, setShowLayoutMenu] = useState(false)
  const layoutMenuRef = useRef<HTMLDivElement>(null)

  // メニュー外クリックで閉じる
  useEffect(() => {
    if (!showLayoutMenu) return
    const handler = (e: MouseEvent) => {
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(e.target as Element)) {
        setShowLayoutMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showLayoutMenu])

  const handleAddNode = () => {
    const { x, y, zoom } = getViewport()
    addNode('新しいアイデア', (-x + 200) / zoom, (-y + 200) / zoom)
  }

  const handleDelete = () => {
    deleteSelected()
    setSelectedNodeId(null)
  }

  const handleRadialLayout = () => {
    const laid = applyRadialLayout(nodes as Node<IdeaNodeData>[], edges)
    setNodes(laid as Node<IdeaNodeData>[])
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50)
    setShowLayoutMenu(false)
  }

  const handleDagreLayout = (rankdir: 'LR' | 'TB') => {
    const laid = applyDagreLayout(nodes as Node<IdeaNodeData>[], edges, rankdir)
    setNodes(laid as Node<IdeaNodeData>[])
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50)
    setShowLayoutMenu(false)
  }

  const canUndo = past.length > 0
  const canRedo = future.length > 0

  return (
    <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white border-t border-gray-200 z-10 flex-shrink-0">
      <AddNodeButton onClick={handleAddNode} />
      <button
        onClick={handleDelete}
        disabled={!selectedNodeId}
        title="選択中のノードを削除 (Delete)"
        className="p-2 rounded-lg text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
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

      {/* 自動整列: 3択ドロップダウン */}
      <div className="relative" ref={layoutMenuRef}>
        <button
          onClick={() => setShowLayoutMenu((v) => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          title="ノードを自動整列"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          整列
          <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showLayoutMenu && (
          <div className="absolute bottom-full mb-1 left-0 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50 min-w-36 animate-context-menu">
            <button
              onClick={handleRadialLayout}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <span className="text-base leading-none">◎</span>
              <span>放射状（デフォルト）</span>
            </button>
            <button
              onClick={() => handleDagreLayout('LR')}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <span className="text-base leading-none">→</span>
              <span>左→右 (dagre)</span>
            </button>
            <button
              onClick={() => handleDagreLayout('TB')}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <span className="text-base leading-none">↓</span>
              <span>上→下 (dagre)</span>
            </button>
          </div>
        )}
      </div>

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
