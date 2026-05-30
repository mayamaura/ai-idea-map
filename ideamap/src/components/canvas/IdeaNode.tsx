import { memo, useState, useRef, useEffect, useCallback } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { useMapStore } from '../../stores/mapStore'
import { useUIStore } from '../../stores/uiStore'
import type { IdeaNodeData } from '../../types'

const NODE_COLORS = [
  '#ffffff', '#e0e7ff', '#dbeafe', '#d1fae5',
  '#fef3c7', '#fce7f3', '#ffe4e6', '#f3f4f6',
]

function IdeaNodeComponent({ id, data, selected }: NodeProps<Node<IdeaNodeData>>) {
  const nodeData = data as IdeaNodeData
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(nodeData.text)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { updateNodeText, updateNodeColor, deleteNode } = useMapStore()
  const { setSelectedNodeId, setAIPanelOpen } = useUIStore()

  useEffect(() => {
    setEditText(nodeData.text)
  }, [nodeData.text])

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [isEditing])

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true)
  }, [])

  const handleBlur = useCallback(() => {
    setIsEditing(false)
    const trimmed = editText.trim()
    if (trimmed) {
      updateNodeText(id, trimmed)
    } else {
      setEditText(nodeData.text)
    }
  }, [editText, id, nodeData.text, updateNodeText])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleBlur()
      }
      if (e.key === 'Escape') {
        setEditText(nodeData.text)
        setIsEditing(false)
      }
    },
    [handleBlur, nodeData.text]
  )

  const handleAIExpand = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setSelectedNodeId(id)
      setAIPanelOpen(true)
    },
    [id, setSelectedNodeId, setAIPanelOpen]
  )

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      deleteNode(id)
    },
    [id, deleteNode]
  )

  // Long press for mobile: select node and open AI panel after 500ms
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

  return (
    <div
      className={`
        relative group min-w-24 max-w-48 rounded-xl border-2 shadow-sm
        transition-all duration-150 cursor-default
        ${selected
          ? 'border-primary-500 shadow-md shadow-primary-100'
          : 'border-gray-200 hover:border-gray-300'
        }
        ${isAI ? 'node-ai-generated' : ''}
      `}
      style={{ backgroundColor: nodeData.color }}
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

      {/* テキスト */}
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
          <p className="text-sm text-gray-800 leading-snug break-words select-none">
            {nodeData.text}
          </p>
        )}
      </div>

      {/* 選択時アクションバー */}
      {selected && !isEditing && (
        <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-lg px-1 py-1 z-20 whitespace-nowrap">
          <button
            onClick={handleAIExpand}
            className="flex items-center gap-1 px-2 py-1 text-xs text-primary-600 font-medium hover:bg-primary-50 rounded-md transition-colors"
            title="AIに拡張を依頼"
          >
            <span>✦</span>
            <span>AI拡張</span>
          </button>
          <div className="w-px h-4 bg-gray-200" />
          <button
            onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker) }}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            title="色を変更"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486z" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
            title="削除"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}

      {/* カラーピッカー */}
      {showColorPicker && (
        <div
          className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex gap-1.5 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-30"
          onClick={(e) => e.stopPropagation()}
        >
          {NODE_COLORS.map((color) => (
            <button
              key={color}
              className="w-5 h-5 rounded-full border border-gray-300 hover:scale-110 transition-transform"
              style={{ backgroundColor: color }}
              onClick={() => {
                updateNodeColor(id, color)
                setShowColorPicker(false)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export const IdeaNode = memo(IdeaNodeComponent)
