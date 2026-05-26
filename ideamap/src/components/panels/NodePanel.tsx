import { useState, useEffect, useCallback } from 'react'
import { useUIStore } from '../../stores/uiStore'
import { useMapStore } from '../../stores/mapStore'
import type { IdeaNodeData } from '../../types'

const NODE_COLORS = [
  { hex: '#ffffff', name: '白' },
  { hex: '#e0e7ff', name: '紫' },
  { hex: '#dbeafe', name: '青' },
  { hex: '#d1fae5', name: '緑' },
  { hex: '#fef3c7', name: '黄' },
  { hex: '#fce7f3', name: 'ピンク' },
  { hex: '#ffe4e6', name: '赤' },
  { hex: '#f3f4f6', name: 'グレー' },
]

export function NodePanel() {
  const { selectedNodeId, setSelectedNodeId, setAIPanelOpen } = useUIStore()
  const { nodes, updateNodeText, updateNodeColor, deleteNode } = useMapStore()

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)
  const nodeData = selectedNode?.data as IdeaNodeData | undefined

  const [editText, setEditText] = useState('')

  useEffect(() => {
    setEditText(nodeData?.text ?? '')
  }, [nodeData?.text])

  const handleBlur = useCallback(() => {
    if (selectedNodeId && editText.trim()) {
      updateNodeText(selectedNodeId, editText.trim())
    }
  }, [selectedNodeId, editText, updateNodeText])

  const handleDelete = useCallback(() => {
    if (selectedNodeId) {
      deleteNode(selectedNodeId)
      setSelectedNodeId(null)
    }
  }, [selectedNodeId, deleteNode, setSelectedNodeId])

  if (!selectedNode || !nodeData) return null

  return (
    <div className="hidden sm:flex flex-col w-60 bg-white border-l border-gray-200 flex-shrink-0 z-10">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">
          {nodeData.createdBy === 'ai' ? (
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">AI</span>
              AIノード
            </span>
          ) : 'ノード編集'}
        </h3>
        <button
          onClick={() => setSelectedNodeId(null)}
          className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">テキスト</label>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleBlur()
              }
            }}
            rows={3}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-2">背景色</label>
          <div className="grid grid-cols-4 gap-2">
            {NODE_COLORS.map((c) => (
              <button
                key={c.hex}
                title={c.name}
                onClick={() => updateNodeColor(selectedNodeId!, c.hex)}
                className={`h-7 rounded-lg border-2 transition-transform hover:scale-105 ${
                  nodeData.color === c.hex ? 'border-primary-500 shadow-sm' : 'border-gray-200'
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        </div>

        <button
          onClick={() => setAIPanelOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors"
        >
          <span className="text-base">🤖</span>
          AIでアイデアを拡張
        </button>
      </div>

      <div className="p-4 border-t border-gray-100">
        <button
          onClick={handleDelete}
          className="w-full py-2 flex items-center justify-center gap-2 text-sm text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          削除
        </button>
      </div>
    </div>
  )
}
