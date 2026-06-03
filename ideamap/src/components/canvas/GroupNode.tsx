import { memo, useState, useRef, useCallback, useEffect } from 'react'
import { NodeResizer, type NodeProps, type Node } from '@xyflow/react'
import { useMapStore } from '../../stores/mapStore'
import type { IdeaNodeData } from '../../types'

function GroupNodeComponent({ id, data, selected }: NodeProps<Node<IdeaNodeData>>) {
  const nodeData = data as IdeaNodeData
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(nodeData.title)
  const inputRef = useRef<HTMLInputElement>(null)
  const { updateNodeTitle } = useMapStore()

  useEffect(() => {
    setEditText(nodeData.title)
  }, [nodeData.title])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(true)
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
  }, [])

  const commitEdit = useCallback(() => {
    const trimmed = editText.trim() || 'グループ'
    setIsEditing(false)
    setEditText(trimmed)
    updateNodeTitle(id, trimmed)
  }, [id, editText, updateNodeTitle])

  const borderColor = selected ? '#3b82f6' : '#94a3b8'
  const bgColor = nodeData.color || 'rgba(147, 197, 253, 0.15)'

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: bgColor,
        border: `2px dashed ${borderColor}`,
        borderRadius: 12,
        position: 'relative',
        boxSizing: 'border-box',
        transition: 'border-color 0.15s',
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={150}
        handleStyle={{
          width: 10,
          height: 10,
          borderRadius: 3,
          border: '2px solid #3b82f6',
          backgroundColor: 'white',
        }}
        lineStyle={{ border: '1px dashed #3b82f6' }}
      />

      <div
        className="absolute top-2 left-3"
        onDoubleClick={handleDoubleClick}
        style={{ pointerEvents: 'auto' }}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault()
                commitEdit()
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-semibold bg-white/80 border border-blue-400 rounded px-1.5 py-0.5 outline-none text-gray-700"
            style={{ width: Math.max(80, editText.length * 8 + 24) }}
          />
        ) : (
          <span
            className="text-xs font-semibold text-gray-500 select-none cursor-text bg-white/60 px-2 py-0.5 rounded"
            title="ダブルクリックでラベルを編集"
          >
            📁 {nodeData.title}
          </span>
        )}
      </div>
    </div>
  )
}

export const GroupNode = memo(GroupNodeComponent)
