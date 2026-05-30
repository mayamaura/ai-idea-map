import { useUIStore } from '../../stores/uiStore'
import { useMapStore } from '../../stores/mapStore'
import type { IdeaNodeData } from '../../types'

export function NodePanel() {
  const { selectedNodeId, setSelectedNodeId, openNodeDetail, setAIPanelOpen } = useUIStore()
  const { nodes } = useMapStore()

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)
  const nodeData = selectedNode?.data as IdeaNodeData | undefined

  if (!selectedNode || !nodeData) return null

  return (
    <div className="hidden sm:flex flex-col w-60 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex-shrink-0 z-10">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          {nodeData.createdBy === 'ai' ? (
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">AI</span>
              AIノード
            </span>
          ) : 'ノード'}
        </h3>
        <button
          onClick={() => setSelectedNodeId(null)}
          className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* タイトル表示（クリックで詳細パネルへ） */}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">タイトル</p>
          <p className="text-sm text-gray-800 dark:text-gray-100 font-medium leading-snug">
            {nodeData.title}
          </p>
        </div>

        {/* 本文プレビュー */}
        {nodeData.body && (
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">メモ</p>
            <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-3 leading-relaxed">
              {nodeData.body}
            </p>
          </div>
        )}

        <button
          onClick={() => selectedNodeId && openNodeDetail(selectedNodeId)}
          className="w-full flex items-center justify-center gap-2 py-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <span>📝</span>
          詳細を編集
        </button>

        <button
          onClick={() => setAIPanelOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors"
        >
          <span className="text-base">🤖</span>
          AIでアイデアを拡張
        </button>
      </div>
    </div>
  )
}
