import { useReactFlow } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { useMapStore } from '../../stores/mapStore'
import { useUIStore } from '../../stores/uiStore'
import { findFreePosition } from '../../utils/mapLayout'
import type { IdeaNodeData } from '../../types'

export function BottomNav() {
  const { fitView, zoomIn, zoomOut, screenToFlowPosition } = useReactFlow()
  const { nodes, addNode, undo, redo, past, future } = useMapStore()
  const { setSettingsOpen, setShortcutsModalOpen, setSelectedNodeId, setEditingNodeId, setSearchOpen } = useUIStore()

  // Toolbar と同じ実装: 画面中央のフロー座標を起点に空きスペースへ追加
  const handleAddNode = () => {
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    const pos = findFreePosition(center, nodes as Node<IdeaNodeData>[])
    const newId = addNode('新しいアイデア', pos.x, pos.y)
    setSelectedNodeId(newId)
    setEditingNodeId(newId)
  }

  return (
    <nav className="sm:hidden flex items-center overflow-x-auto justify-start gap-1 px-2 py-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-10 flex-shrink-0 pb-[env(safe-area-inset-bottom)]">
      <button
        onClick={handleAddNode}
        className="flex flex-col items-center gap-0.5 p-2 text-primary-600 flex-shrink-0"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="12" cy="12" r="9" strokeWidth="2" />
          <line x1="12" y1="8" x2="12" y2="16" strokeWidth="2" strokeLinecap="round" />
          <line x1="8" y1="12" x2="16" y2="12" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="text-xs">追加</span>
      </button>
      <button
        onClick={() => undo()}
        disabled={past.length === 0}
        className="flex flex-col items-center gap-0.5 p-2 text-gray-500 dark:text-gray-400 disabled:opacity-40 flex-shrink-0"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
        <span className="text-xs">元に戻す</span>
      </button>
      <button
        onClick={() => redo()}
        disabled={future.length === 0}
        className="flex flex-col items-center gap-0.5 p-2 text-gray-500 dark:text-gray-400 disabled:opacity-40 flex-shrink-0"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
        </svg>
        <span className="text-xs">やり直し</span>
      </button>
      <button
        onClick={() => setSearchOpen(true)}
        className="flex flex-col items-center gap-0.5 p-2 text-gray-500 dark:text-gray-400 flex-shrink-0"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="11" cy="11" r="7" strokeWidth="2" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" />
        </svg>
        <span className="text-xs">検索</span>
      </button>
      <button
        onClick={() => zoomIn()}
        className="flex flex-col items-center gap-0.5 p-2 text-gray-500 dark:text-gray-400 flex-shrink-0"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="11" cy="11" r="7" strokeWidth="2" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" />
          <line x1="11" y1="8" x2="11" y2="14" strokeWidth="2" />
          <line x1="8" y1="11" x2="14" y2="11" strokeWidth="2" />
        </svg>
        <span className="text-xs">拡大</span>
      </button>
      <button
        onClick={() => fitView({ padding: 0.1, duration: 300 })}
        className="flex flex-col items-center gap-0.5 p-2 text-gray-500 dark:text-gray-400 flex-shrink-0"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
        <span className="text-xs">全体</span>
      </button>
      <button
        onClick={() => zoomOut()}
        className="flex flex-col items-center gap-0.5 p-2 text-gray-500 dark:text-gray-400 flex-shrink-0"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="11" cy="11" r="7" strokeWidth="2" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" />
          <line x1="8" y1="11" x2="14" y2="11" strokeWidth="2" />
        </svg>
        <span className="text-xs">縮小</span>
      </button>
      <button
        onClick={() => setSettingsOpen(true)}
        className="flex flex-col items-center gap-0.5 p-2 text-gray-500 dark:text-gray-400 flex-shrink-0"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="text-xs">設定</span>
      </button>
      {/* ヘルプ: 操作ガイドへの常時入口 */}
      <button
        onClick={() => setShortcutsModalOpen(true)}
        className="flex flex-col items-center gap-0.5 p-2 text-gray-500 dark:text-gray-400 flex-shrink-0"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="12" cy="12" r="9" strokeWidth="2" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
          <circle cx="12" cy="17" r="0.5" fill="currentColor" strokeWidth="0" />
        </svg>
        <span className="text-xs">ヘルプ</span>
      </button>
    </nav>
  )
}
