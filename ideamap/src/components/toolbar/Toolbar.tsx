import { useState, useRef, useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useMapStore } from '../../stores/mapStore'
import { useUIStore } from '../../stores/uiStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { applyDagreLayout, applyRadialLayout } from '../../utils/mapLayout'
import type { IdeaNodeData } from '../../types'
import type { Node } from '@xyflow/react'

export function Toolbar() {
  const { fitView, zoomIn, zoomOut, getViewport } = useReactFlow()
  const { addNode, nodes, edges, setNodes, undo, redo, past, future, deleteSelected } = useMapStore()
  const { selectedNodeId, setSelectedNodeId, setSearchOpen, activeCategoryFilters, toggleCategoryFilter, clearCategoryFilters, setExportPanelOpen, presentationNodeIds, setPresentationOrderOpen, startPresentation } = useUIStore()
  const { categories } = useSettingsStore()
  const [showLayoutMenu, setShowLayoutMenu] = useState(false)
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showPresentMenu, setShowPresentMenu] = useState(false)
  const layoutMenuRef = useRef<HTMLDivElement>(null)
  const filterMenuRef = useRef<HTMLDivElement>(null)
  const presentMenuRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!showFilterMenu) return
    const handler = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Element)) {
        setShowFilterMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showFilterMenu])

  useEffect(() => {
    if (!showPresentMenu) return
    const handler = (e: MouseEvent) => {
      if (presentMenuRef.current && !presentMenuRef.current.contains(e.target as Element)) {
        setShowPresentMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showPresentMenu])

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

      {/* 検索ボタン */}
      <button
        onClick={() => setSearchOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        title="ノードを検索 (Ctrl+F)"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="11" cy="11" r="8" strokeWidth="2" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" />
        </svg>
        検索
      </button>

      {/* カテゴリフィルター */}
      <div className="relative" ref={filterMenuRef}>
        <button
          onClick={() => setShowFilterMenu((v) => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs border rounded-lg transition-colors ${
            activeCategoryFilters.length > 0
              ? 'text-primary-600 border-primary-300 bg-primary-50'
              : 'text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
          title="カテゴリでフィルター"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          フィルター
          {activeCategoryFilters.length > 0 && (
            <span className="bg-primary-500 text-white rounded-full text-[10px] w-4 h-4 flex items-center justify-center leading-none">
              {activeCategoryFilters.length}
            </span>
          )}
        </button>

        {showFilterMenu && (
          <div className="absolute bottom-full mb-1 left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-50 min-w-56 animate-context-menu">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600">カテゴリフィルター</span>
              {activeCategoryFilters.length > 0 && (
                <button
                  onClick={clearCategoryFilters}
                  className="text-xs text-primary-500 hover:text-primary-700 transition-colors"
                >
                  すべてクリア
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => {
                const active = activeCategoryFilters.includes(cat.id)
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleCategoryFilter(cat.id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all border ${
                      active
                        ? 'shadow-sm ring-1 ring-offset-1 ring-gray-400'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: cat.color, borderColor: `${cat.color}` }}
                  >
                    <span className="text-sm leading-none">{cat.icon}</span>
                    <span className="text-gray-700">{cat.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* 発表モード — スプリットボタン */}
      <div className="relative flex" ref={presentMenuRef}>
        {/* 左: 直接発表開始 */}
        <button
          onClick={() => startPresentation()}
          disabled={presentationNodeIds.length === 0}
          title={
            presentationNodeIds.length === 0
              ? '右クリックメニューからノードを発表リストに追加してください'
              : `発表開始 (Ctrl+P) — ${presentationNodeIds.length}件`
          }
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs border rounded-l-lg transition-colors border-r-0 ${
            presentationNodeIds.length > 0
              ? 'text-indigo-600 border-indigo-300 bg-indigo-50 hover:bg-indigo-100'
              : 'text-gray-400 border-gray-200 cursor-not-allowed'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          発表
          {presentationNodeIds.length > 0 && (
            <span className="bg-indigo-500 text-white rounded-full text-[10px] w-4 h-4 flex items-center justify-center leading-none">
              {presentationNodeIds.length}
            </span>
          )}
        </button>
        {/* 右: オプションドロップダウン */}
        <button
          onClick={() => setShowPresentMenu((v) => !v)}
          disabled={presentationNodeIds.length === 0}
          title="発表オプション"
          className={`px-1.5 py-1.5 text-xs border rounded-r-lg transition-colors ${
            presentationNodeIds.length > 0
              ? 'text-indigo-600 border-indigo-300 bg-indigo-50 hover:bg-indigo-100'
              : 'text-gray-400 border-gray-200 cursor-not-allowed'
          }`}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showPresentMenu && (
          <div className="absolute bottom-full mb-1 right-0 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50 min-w-52 animate-context-menu">
            <button
              onClick={() => {
                setShowPresentMenu(false)
                startPresentation()
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
            >
              <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              このまま発表開始
            </button>
            <button
              onClick={() => {
                setShowPresentMenu(false)
                setPresentationOrderOpen(true)
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
            >
              <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10" />
              </svg>
              発表順を編集してから発表
            </button>
          </div>
        )}
      </div>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* エクスポート / インポート */}
      <button
        onClick={() => setExportPanelOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        title="エクスポート / インポート"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        書き出し
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
