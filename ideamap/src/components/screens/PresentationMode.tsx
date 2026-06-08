import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useReactFlow } from '@xyflow/react'
import { useUIStore } from '../../stores/uiStore'
import { useMapStore } from '../../stores/mapStore'
import { useSettingsStore } from '../../stores/settingsStore'
import type { IdeaNodeData } from '../../types'
import { renderMarkdownSimple } from '../../utils/markdown'

export function PresentationMode() {
  const {
    isPresentationMode,
    presentationNodeIds,
    presentationCurrentIndex,
    goToNextPresentation,
    goToPrevPresentation,
    exitPresentation,
  } = useUIStore()
  const { nodes } = useMapStore()
  const { getCategoryById } = useSettingsStore()
  const { fitView } = useReactFlow()

  // インデックスが変わるたびに該当ノードへズームアニメーション
  useEffect(() => {
    if (!isPresentationMode) return
    const currentNodeId = presentationNodeIds[presentationCurrentIndex]
    if (!currentNodeId) return
    const timer = setTimeout(() => {
      fitView({ nodes: [{ id: currentNodeId }], duration: 600, padding: 0.4, maxZoom: 1.5 })
    }, 50)
    return () => clearTimeout(timer)
  }, [presentationCurrentIndex, isPresentationMode, presentationNodeIds, fitView])

  if (!isPresentationMode || presentationNodeIds.length === 0) return null

  const currentNodeId = presentationNodeIds[presentationCurrentIndex]
  const currentNode = nodes.find((n) => n.id === currentNodeId)
  const nodeData = currentNode?.data as IdeaNodeData | undefined
  const category = nodeData?.categoryId ? getCategoryById(nodeData.categoryId) : undefined
  const total = presentationNodeIds.length
  const index = presentationCurrentIndex
  const isFirst = index === 0
  const isLast = index === total - 1

  return createPortal(
    <div className="fixed inset-0 z-[100] flex" style={{ pointerEvents: 'none' }}>
      {/* 左エリア: キャンバスをそのまま見せる（クリックはスルー） */}
      <div className="flex-1" />

      {/* 右スライドパネル */}
      <div
        className="w-[480px] flex flex-col bg-gray-900/95 backdrop-blur-xl border-l border-white/10"
        style={{ pointerEvents: 'auto' }}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-8 pt-8 pb-4 flex-shrink-0">
          <span className="text-white/40 text-sm font-mono tabular-nums">
            {index + 1} / {total}
          </span>
          {category && category.id !== 'cat-none' && (
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
              style={{ backgroundColor: category.color + '33', color: category.color }}
            >
              <span>{category.icon}</span>
              <span>{category.name}</span>
            </div>
          )}
        </div>

        {/* タイトル */}
        <div className="px-8 pb-6 flex-shrink-0">
          <h1 className="text-4xl font-bold text-white leading-tight break-words">
            {nodeData?.title ?? ''}
          </h1>
        </div>

        {/* 本文 */}
        <div className="flex-1 overflow-y-auto px-8 pb-6">
          {nodeData?.body ? (
            <div
              className="text-xl text-white/70 leading-relaxed break-words presentation-body"
              dangerouslySetInnerHTML={{ __html: renderMarkdownSimple(nodeData.body) }}
            />
          ) : (
            <p className="text-lg text-white/20 italic">本文なし</p>
          )}
        </div>

        {/* ドットインジケーター */}
        <div className="flex items-center justify-center gap-1.5 px-8 py-4 flex-shrink-0">
          {presentationNodeIds.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === index ? 'w-3 h-3 bg-white' : 'w-2 h-2 bg-white/25'
              }`}
            />
          ))}
        </div>
      </div>

      {/* 下部ナビゲーションバー */}
      <div
        className="fixed bottom-0 left-0 right-0 flex items-center px-6 py-3 bg-gray-950/90 backdrop-blur-sm border-t border-white/5"
        style={{ pointerEvents: 'auto' }}
      >
        {/* 終了ボタン */}
        <button
          onClick={exitPresentation}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white/50 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          終了
          <span className="text-xs text-white/30 ml-1">Esc</span>
        </button>

        {/* 中央: 前へ・インジケーター・次へ */}
        <div className="flex items-center gap-3 mx-auto">
          <button
            onClick={goToPrevPresentation}
            disabled={isFirst}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            前へ
          </button>

          <span className="text-white/50 text-sm font-mono tabular-nums w-16 text-center">
            {index + 1} / {total}
          </span>

          <button
            onClick={goToNextPresentation}
            disabled={isLast}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            次へ
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* 右端: キーボードヒント */}
        <div className="text-xs text-white/25 flex items-center gap-2">
          <span>← →</span>
          <span>/</span>
          <span>Space</span>
          <span>で操作</span>
        </div>
      </div>
    </div>,
    document.body
  )
}
