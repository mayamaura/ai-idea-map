import { useEffect, useRef, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { useReactFlow } from '@xyflow/react'
import { useMapStore } from '../../stores/mapStore'
import { useUIStore } from '../../stores/uiStore'
import type { IdeaNodeData } from '../../types'
import type { Node } from '@xyflow/react'

function matchesQuery(node: Node<IdeaNodeData>, query: string): boolean {
  const q = query.toLowerCase()
  const title = (node.data as IdeaNodeData).title?.toLowerCase() ?? ''
  const body = (node.data as IdeaNodeData).body?.toLowerCase() ?? ''
  return title.includes(q) || body.includes(q)
}

export function SearchBar() {
  const { isSearchOpen, searchQuery, setSearchOpen, setSearchQuery, setSelectedNodeId, recentNodeIds } =
    useUIStore()
  const { nodes } = useMapStore()
  const { fitView } = useReactFlow()
  const inputRef = useRef<HTMLInputElement>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  const matchedNodes = searchQuery.trim()
    ? (nodes as Node<IdeaNodeData>[]).filter((n) => matchesQuery(n, searchQuery))
    : []

  const recentNodes = recentNodeIds
    .map((id) => (nodes as Node<IdeaNodeData>[]).find((n) => n.id === id))
    .filter((n): n is Node<IdeaNodeData> => n !== undefined)
    .slice(0, 5)

  useEffect(() => {
    setCurrentIndex(0)
  }, [searchQuery])

  // 開いたら即フォーカス
  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isSearchOpen])

  const jumpToNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId)
      fitView({ nodes: [{ id: nodeId }], duration: 300, padding: 0.3 })
    },
    [setSelectedNodeId, fitView]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        setSearchOpen(false)
        return
      }
      if (matchedNodes.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = (currentIndex + 1) % matchedNodes.length
        setCurrentIndex(next)
        jumpToNode(matchedNodes[next].id)
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = (currentIndex - 1 + matchedNodes.length) % matchedNodes.length
        setCurrentIndex(prev)
        jumpToNode(matchedNodes[prev].id)
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (matchedNodes[currentIndex]) {
          jumpToNode(matchedNodes[currentIndex].id)
        }
      }
    },
    [matchedNodes, currentIndex, jumpToNode, setSearchOpen]
  )

  const handleNext = () => {
    if (matchedNodes.length === 0) return
    const next = (currentIndex + 1) % matchedNodes.length
    setCurrentIndex(next)
    jumpToNode(matchedNodes[next].id)
  }

  const handlePrev = () => {
    if (matchedNodes.length === 0) return
    const prev = (currentIndex - 1 + matchedNodes.length) % matchedNodes.length
    setCurrentIndex(prev)
    jumpToNode(matchedNodes[prev].id)
  }

  if (!isSearchOpen) return null

  const showResults = searchQuery.trim() !== ''
  const showRecent = !showResults && recentNodes.length > 0

  return createPortal(
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* オーバーレイ（クリックで閉じる） */}
      <div
        className="absolute inset-0 pointer-events-auto"
        onClick={() => setSearchOpen(false)}
      />

      {/* 検索パネル（キャンバス上部中央） */}
      <div
        className="absolute top-[60px] left-1/2 -translate-x-1/2 w-full max-w-md pointer-events-auto animate-context-menu"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* 入力エリア */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <svg
              className="w-4 h-4 text-gray-400 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <circle cx="11" cy="11" r="8" strokeWidth="2" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="ノードを検索..."
              className="flex-1 text-sm bg-transparent outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400"
            />
            {showResults && (
              <span className="text-xs text-gray-400 flex-shrink-0">
                {matchedNodes.length > 0 ? `${currentIndex + 1} / ${matchedNodes.length}件` : '0件'}
              </span>
            )}
            {showResults && matchedNodes.length > 1 && (
              <div className="flex gap-1">
                <button
                  onClick={handlePrev}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
                  title="前へ (↑)"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={handleNext}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
                  title="次へ (↓)"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            )}
            <button
              onClick={() => setSearchOpen(false)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition-colors"
              title="閉じる (Esc)"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 検索結果リスト */}
          {showResults && (
            <ul className="max-h-64 overflow-y-auto py-1">
              {matchedNodes.length === 0 ? (
                <li className="px-4 py-3 text-sm text-gray-400 text-center">一致するノードがありません</li>
              ) : (
                matchedNodes.map((node, idx) => {
                  const data = node.data as IdeaNodeData
                  const isActive = idx === currentIndex
                  return (
                    <li key={node.id}>
                      <button
                        onClick={() => {
                          setCurrentIndex(idx)
                          jumpToNode(node.id)
                        }}
                        className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                          isActive
                            ? 'bg-primary-50 dark:bg-primary-900/30'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5 border border-gray-200"
                          style={{ backgroundColor: data.color }}
                        />
                        <div className="min-w-0">
                          <p className="text-sm text-gray-800 dark:text-gray-100 font-medium truncate">
                            <HighlightText text={data.title} query={searchQuery} />
                          </p>
                          {data.body && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                              <HighlightText text={data.body} query={searchQuery} />
                            </p>
                          )}
                        </div>
                        {data.createdBy === 'ai' && (
                          <span className="text-xs text-primary-500 flex-shrink-0 mt-0.5">✦</span>
                        )}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          )}

          {/* 最近使ったノード */}
          {showRecent && (
            <>
              <div className="px-4 py-2 text-xs text-gray-400 font-medium border-b border-gray-50 dark:border-gray-700">
                最近使ったノード
              </div>
              <ul className="py-1">
                {recentNodes.map((node) => {
                  const data = node.data as IdeaNodeData
                  return (
                    <li key={node.id}>
                      <button
                        onClick={() => jumpToNode(node.id)}
                        className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-200"
                          style={{ backgroundColor: data.color }}
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-200 truncate">
                          {data.title}
                        </span>
                        {data.createdBy === 'ai' && (
                          <span className="text-xs text-primary-500 ml-auto flex-shrink-0">✦</span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          {!showResults && !showRecent && (
            <div className="px-4 py-3 text-xs text-gray-400 text-center">
              タイトルや本文でノードを検索 · ↑↓で移動
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-600/50 text-inherit rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}
