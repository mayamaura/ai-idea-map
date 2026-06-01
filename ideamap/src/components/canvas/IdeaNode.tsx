import { memo, useState, useRef, useEffect, useCallback } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { useMapStore } from '../../stores/mapStore'
import { useUIStore } from '../../stores/uiStore'
import { useSettingsStore } from '../../stores/settingsStore'
import type { IdeaNodeData } from '../../types'

function shapeClass(shape: string): string {
  if (shape === 'ellipse') return 'rounded-full'
  if (shape === 'hexagon') return 'node-shape-hexagon'
  return 'rounded-xl'
}

function widthClass(text: string): string {
  if (text.length < 20) return 'min-w-20 max-w-32'
  if (text.length > 60) return 'min-w-32 max-w-64'
  return 'min-w-24 max-w-48'
}

function IdeaNodeComponent({ id, data, selected }: NodeProps<Node<IdeaNodeData>>) {
  const nodeData = data as IdeaNodeData
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(nodeData.title)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { updateNodeTitle } = useMapStore()
  const { setSelectedNodeId, setAIPanelOpen, openNodeDetail, searchQuery, activeCategoryFilters } = useUIStore()
  const nodeShape = useSettingsStore((s) => s.nodeShape)

  // 検索・フィルター状態に応じた表示制御
  const isSearchActive = searchQuery.trim() !== ''
  const matchesSearch = isSearchActive
    ? nodeData.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (nodeData.body?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    : true
  const matchesFilter =
    activeCategoryFilters.length === 0 ||
    activeCategoryFilters.includes(nodeData.categoryId ?? 'cat-none')
  const isDimmed = (isSearchActive && !matchesSearch) || (activeCategoryFilters.length > 0 && !matchesFilter)
  const isHighlighted = isSearchActive && matchesSearch

  useEffect(() => {
    setEditText(nodeData.title)
  }, [nodeData.title])

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [isEditing])

  const handleDoubleClick = useCallback(() => {
    openNodeDetail(id)
  }, [id, openNodeDetail])

  const handleBlur = useCallback(() => {
    setIsEditing(false)
    const trimmed = editText.trim()
    if (trimmed) {
      updateNodeTitle(id, trimmed)
    } else {
      setEditText(nodeData.title)
    }
  }, [editText, id, nodeData.title, updateNodeTitle])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleBlur()
      }
      if (e.key === 'Escape') {
        setEditText(nodeData.title)
        setIsEditing(false)
      }
    },
    [handleBlur, nodeData.title]
  )

  const handleTouchStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      setSelectedNodeId(id)
      setAIPanelOpen(true)
    }, 500)
  }, [id, setSelectedNodeId, setAIPanelOpen])

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const isAI = nodeData.createdBy === 'ai'
  const hasBody = Boolean(nodeData.body)
  const shape = shapeClass(nodeShape)
  const width = widthClass(nodeData.title)

  return (
    <div
      className={`relative group animate-node-enter transition-opacity duration-200 ${
        isDimmed ? 'opacity-20' : isHighlighted ? 'opacity-100' : ''
      }`}
      onDoubleClick={handleDoubleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
    >
      {/* AI badge */}
      {isAI && (
        <div className="absolute -top-2 -right-2 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center z-10 shadow-sm">
          <span className="text-white text-xs font-bold leading-none">✦</span>
        </div>
      )}

      {/* 本文インジケーター */}
      {hasBody && (
        <div className="absolute -top-2 -left-2 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center z-10 shadow-sm text-[10px] leading-none">
          📝
        </div>
      )}

      {/* ハンドル: 全方向を source/target 兼用にして任意方向から接続できる（ConnectionMode.Loose） */}
      {(['Top', 'Right', 'Bottom', 'Left'] as const).map((pos) => (
        <Handle
          key={pos}
          id={pos.toLowerCase()}
          type="source"
          position={Position[pos]}
          className="!bg-primary-400 !border-white !border-2"
        />
      ))}

      {/* 形状コンテナ */}
      <div
        className={`
          ${width} ${shape} border-2 shadow-sm
          transition-all duration-150 cursor-default
          ${isAI ? 'node-ai-generated' : ''}
          ${selected
            ? 'border-primary-500 shadow-md shadow-primary-100'
            : isHighlighted
            ? 'border-yellow-400 shadow-md shadow-yellow-100'
            : 'border-gray-200 hover:border-gray-300'
          }
        `}
        style={{ backgroundColor: nodeData.color }}
      >
        <div className="px-3 py-2">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="w-full text-sm text-gray-800 bg-transparent resize-none outline-none leading-snug"
              rows={2}
              style={{ minWidth: '80px' }}
            />
          ) : (
            <>
              <p className="text-sm text-gray-800 leading-snug break-words select-none">
                {nodeData.title}
              </p>
              {/* 本文プレビュー（先頭2行） */}
              {hasBody && (
                <p className="text-xs text-gray-500 leading-snug break-words select-none mt-1 line-clamp-2 opacity-75">
                  {nodeData.body}
                </p>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  )
}

export const IdeaNode = memo(IdeaNodeComponent)
