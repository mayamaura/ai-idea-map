import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useUIStore } from '../../stores/uiStore'
import { useMapStore } from '../../stores/mapStore'

export function PresentationOrderPanel() {
  const {
    isPresentationOrderOpen,
    setPresentationOrderOpen,
    presentationNodeIds,
    removeNodeFromPresentation,
    reorderPresentationNodes,
    clearPresentationNodes,
    startPresentation,
  } = useUIStore()
  const { nodes } = useMapStore()
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const dragNode = useRef<number | null>(null)

  if (!isPresentationOrderOpen) return null

  const getTitle = (id: string) =>
    nodes.find((n) => n.id === id)?.data.title ?? '（削除済みノード）'

  const handleDragStart = (idx: number) => {
    setDragIndex(idx)
    dragNode.current = idx
  }

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (dragNode.current !== idx) setDragOverIndex(idx)
  }

  const handleDrop = (idx: number) => {
    if (dragNode.current !== null && dragNode.current !== idx) {
      reorderPresentationNodes(dragNode.current, idx)
    }
    setDragIndex(null)
    setDragOverIndex(null)
    dragNode.current = null
  }

  const handleDragEnd = () => {
    setDragIndex(null)
    setDragOverIndex(null)
    dragNode.current = null
  }

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
            発表順序の編集
          </h2>
          <button
            onClick={() => setPresentationOrderOpen(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* リスト */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {presentationNodeIds.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              発表に追加されたノードがありません。
              <br />
              ノードを右クリックして「発表に追加」してください。
            </p>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-2">
                ドラッグして順番を変更できます
              </p>
              <ol className="space-y-2">
                {presentationNodeIds.map((id, idx) => (
                  <li
                    key={id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={() => handleDrop(idx)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors select-none ${
                      dragIndex === idx
                        ? 'opacity-40 bg-gray-100 dark:bg-gray-600/50'
                        : dragOverIndex === idx
                        ? 'bg-indigo-50 dark:bg-indigo-900/40 ring-2 ring-indigo-300 dark:ring-indigo-600'
                        : 'bg-gray-50 dark:bg-gray-700/50'
                    }`}
                  >
                    {/* ドラッグハンドル */}
                    <span
                      className="text-gray-300 dark:text-gray-500 cursor-grab active:cursor-grabbing flex-shrink-0"
                      title="ドラッグして並び替え"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="9" cy="6" r="1.5" />
                        <circle cx="15" cy="6" r="1.5" />
                        <circle cx="9" cy="12" r="1.5" />
                        <circle cx="15" cy="12" r="1.5" />
                        <circle cx="9" cy="18" r="1.5" />
                        <circle cx="15" cy="18" r="1.5" />
                      </svg>
                    </span>
                    <span className="w-6 h-6 flex-shrink-0 rounded-full bg-primary-500 text-white text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="flex-1 text-sm text-gray-700 dark:text-gray-200 truncate">
                      {getTitle(id)}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => reorderPresentationNodes(idx, idx - 1)}
                        disabled={idx === 0}
                        className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20"
                        title="上へ"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => reorderPresentationNodes(idx, idx + 1)}
                        disabled={idx === presentationNodeIds.length - 1}
                        className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20"
                        title="下へ"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => removeNodeFromPresentation(id)}
                        className="w-6 h-6 flex items-center justify-center text-red-400 hover:text-red-600"
                        title="発表から除外"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>

        {/* フッター */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 gap-3">
          <button
            onClick={() => {
              clearPresentationNodes()
            }}
            disabled={presentationNodeIds.length === 0}
            className="text-sm text-red-500 hover:text-red-700 disabled:opacity-30"
          >
            すべてクリア
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setPresentationOrderOpen(false)}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              閉じる
            </button>
            <button
              onClick={() => {
                setPresentationOrderOpen(false)
                startPresentation()
              }}
              disabled={presentationNodeIds.length === 0}
              className="px-4 py-2 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-30"
            >
              発表開始
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
