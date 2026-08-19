import { useState, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactFlow } from '@xyflow/react'
import { useUIStore, useMapStore, calcSuggestionPositions, useSettingsStore, generateSuggestions, toFriendlyAIError, type AISuggestion, type WebSearchResult } from '@ideamap/core'
import { ApiKeyRequired } from '../common/ApiKeyRequired'
import { WebSearchToggle, WebSearchSources } from '../common/WebSearchToggle'
import { AILoadingIndicator } from '../common/AILoadingIndicator'
import { PanelHeader } from '../common/PanelHeader'
import { useActiveProvider } from '../../hooks/useActiveProvider'
import { useWebSearch } from '../../hooks/useWebSearch'
import { useCancellableAIRequest } from '../../hooks/useCancellableAIRequest'

export function AISuggestionPanel() {
  const {
    isAIPanelOpen,
    setAIPanelOpen,
    selectedNodeId,
    aiSuggestions,
    setAISuggestions,
    isAILoading,
    setAILoading,
    addToast,
    setSettingsOpen,
  } = useUIStore(
    useShallow((s) => ({
      isAIPanelOpen: s.isAIPanelOpen,
      setAIPanelOpen: s.setAIPanelOpen,
      selectedNodeId: s.selectedNodeId,
      aiSuggestions: s.aiSuggestions,
      setAISuggestions: s.setAISuggestions,
      isAILoading: s.isAILoading,
      setAILoading: s.setAILoading,
      addToast: s.addToast,
      setSettingsOpen: s.setSettingsOpen,
    }))
  )
  // nodes 全体はドラッグ中に毎フレーム更新されるため購読せず、必要なときに getState() から読む
  // （edges はノードのドラッグでは変化しないため描画に使う分を購読して問題ない）
  const { edges, addNode, onConnect } = useMapStore(
    useShallow((s) => ({ edges: s.edges, addNode: s.addNode, onConnect: s.onConnect }))
  )
  const selectedNode = useMapStore((s) => s.nodes.find((n) => n.id === selectedNodeId))
  const { suggestionCount, setSuggestionCount, categories, getCategoryById } =
    useSettingsStore(
      useShallow((s) => ({
        suggestionCount: s.suggestionCount,
        setSuggestionCount: s.setSuggestionCount,
        categories: s.categories,
        getCategoryById: s.getCategoryById,
      }))
    )
  const { provider, isReady, providerId } = useActiveProvider()
  const webSearch = useWebSearch()
  const { fitView } = useReactFlow()

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [userInstruction, setUserInstruction] = useState('')
  const [addMode, setAddMode] = useState<'child' | 'sibling'>('child')
  const [regeneratingIdx, setRegeneratingIdx] = useState<number | null>(null)
  const [searchSources, setSearchSources] = useState<WebSearchResult[]>([])
  const { run, cancel } = useCancellableAIRequest(setAILoading)

  // 選択ノードの親ノード ID 一覧（兄弟モードの有効判定と追加処理に使用）
  const parentNodeIds = edges
    .filter((e) => selectedNode && e.target === selectedNode.id)
    .map((e) => e.source)
  const hasParent = parentNodeIds.length > 0

  /** generateSuggestions に渡す共通引数を組み立てる */
  const buildBaseRequest = useCallback(() => {
    if (!selectedNode) return null

    const { nodes } = useMapStore.getState()
    const connectedNodeIdSet = new Set<string>()
    edges.forEach((e) => {
      if (e.source === selectedNode.id) connectedNodeIdSet.add(e.target)
      if (e.target === selectedNode.id) connectedNodeIdSet.add(e.source)
    })
    const connectedNodeObjects = nodes.filter((n) => connectedNodeIdSet.has(n.id))

    const parentNodeObjects = nodes.filter((n) => parentNodeIds.includes(n.id))
    const siblingNodeIdSet = new Set(
      edges
        .filter((e) => parentNodeIds.includes(e.source) && e.target !== selectedNode.id)
        .map((e) => e.target),
    )
    const siblingNodeObjects = nodes.filter((n) => siblingNodeIdSet.has(n.id))

    // 子モードの重複相手は選択ノードの既存の子。connectedNodes にも含まれるが、
    // そこでは親や無関係な接続先と混ざるため重複禁止の対象として明示し直す
    const existingChildTitles =
      addMode === 'child'
        ? nodes
            .filter((n) => edges.some((e) => e.source === selectedNode.id && e.target === n.id))
            .map((n) => n.data.title)
        : []

    return {
      provider,
      webSearch: webSearch.client,
      onWebSearchResults: setSearchSources,
      selectedNodeTitle: selectedNode.data.title,
      selectedNodeBody: selectedNode.data.body,
      connectedNodes: connectedNodeObjects.map((n) => ({
        title: n.data.title,
        body: n.data.body,
      })),
      allNodeTitles: nodes.slice(0, 15).map((n) => n.data.title),
      count: suggestionCount,
      categories,
      userInstruction: userInstruction || undefined,
      excludedTexts: existingChildTitles.length > 0 ? existingChildTitles : undefined,
      mode: addMode,
      parentNodes:
        addMode === 'sibling'
          ? parentNodeObjects.map((n) => ({ id: n.id, title: n.data.title, body: n.data.body }))
          : undefined,
      siblingNodes:
        addMode === 'sibling'
          ? siblingNodeObjects.map((n) => ({ title: n.data.title, body: n.data.body }))
          : undefined,
    }
  }, [
    selectedNode,
    edges,
    parentNodeIds,
    provider,
    webSearch.client,
    suggestionCount,
    categories,
    userInstruction,
    addMode,
  ])

  const handleFetch = useCallback(async () => {
    if (!selectedNode || !isReady) {
      setError(
        isReady
          ? 'ノードが選択されていません'
          : providerId === 'ollama'
            ? '使用するOllamaモデルが選択されていません。設定画面で選んでください。'
            : 'APIキーが設定されていません。設定画面から入力してください。',
      )
      return
    }
    setError(null)
    setAISuggestions([])
    setSelected(new Set())
    setSearchSources([])

    try {
      await run(async (signal) => {
        const req = buildBaseRequest()
        if (!req) return
        const suggestions = await generateSuggestions(req, signal)
        const existingTitles = new Set(
          useMapStore.getState().nodes.map((n) => n.data.title.trim().toLowerCase()),
        )
        const newSuggestions = suggestions.filter(
          (s) => !existingTitles.has(s.title.trim().toLowerCase()),
        )
        setAISuggestions(newSuggestions)
        setSelected(new Set(newSuggestions.map((_, i) => i)))
        setUserInstruction('')
      })
    } catch (e) {
      setError(toFriendlyAIError(e))
    }
  }, [selectedNode, isReady, providerId, buildBaseRequest, run, setAISuggestions])

  /** 指定インデックスの提案だけを再生成する */
  const handleRegenerate = useCallback(
    async (idx: number) => {
      if (!selectedNode || !isReady || regeneratingIdx !== null) return
      setRegeneratingIdx(idx)
      try {
        const baseReq = buildBaseRequest()
        if (!baseReq) return
        // 既存の子（baseReq 由来）を落とさないよう、他の提案タイトルは上書きではなく追加する
        const excludedTexts = [
          ...(baseReq.excludedTexts ?? []),
          ...aiSuggestions.filter((_, i) => i !== idx).map((s) => s.title),
        ]
        const newSuggestions = await generateSuggestions({
          ...baseReq,
          count: 1,
          excludedTexts,
        })
        if (newSuggestions.length > 0) {
          setAISuggestions(aiSuggestions.map((s, i) => (i === idx ? newSuggestions[0] : s)))
        }
      } catch (e) {
        addToast(toFriendlyAIError(e), 'error')
      } finally {
        setRegeneratingIdx(null)
      }
    },
    [selectedNode, isReady, aiSuggestions, regeneratingIdx, buildBaseRequest, setAISuggestions, addToast],
  )

  const handleAddSelected = useCallback(() => {
    if (!selectedNode) return
    const selectedSuggestions = aiSuggestions.filter((_, i) => selected.has(i))
    if (selectedSuggestions.length === 0) return

    // 位置計算の基準ノード：兄弟モードは最初の親、子モードは選択ノード
    const { nodes } = useMapStore.getState()
    const anchorId = addMode === 'sibling' && parentNodeIds.length > 0 ? parentNodeIds[0] : null
    const anchorNode =
      anchorId ? (nodes.find((n) => n.id === anchorId) ?? selectedNode) : selectedNode

    const positions = calcSuggestionPositions(
      anchorNode.position.x,
      anchorNode.position.y,
      selectedSuggestions.length,
      nodes,
    )

    const addedIds: string[] = []

    selectedSuggestions.forEach((suggestion, idx) => {
      const { x, y } = positions[idx]
      const cat = suggestion.categoryId ? getCategoryById(suggestion.categoryId) : undefined
      const nodeColor = cat?.color ?? '#f3f4ff'
      const newId = addNode(suggestion.title, x, y, 'ai', nodeColor, suggestion.categoryId, suggestion.body)
      addedIds.push(newId)

      if (addMode === 'sibling' && parentNodeIds.length > 0) {
        // 複数親のとき AI が parentNodeId を返すのでそれを使う。なければ最初の親へ
        const targetParentId =
          parentNodeIds.length === 1
            ? parentNodeIds[0]
            : (suggestion.parentNodeId ?? parentNodeIds[0])
        onConnect({ source: targetParentId, target: newId, sourceHandle: null, targetHandle: null })
      } else {
        onConnect({ source: selectedNode.id, target: newId, sourceHandle: null, targetHandle: null })
      }
    })

    const addedTitles = new Set(selectedSuggestions.map((s) => s.title))
    setAISuggestions(aiSuggestions.filter((s) => !addedTitles.has(s.title)))
    setAIPanelOpen(false)
    setSelected(new Set())

    // 追加後に追加先ノードへ視点を移動する
    // addNode は Zustand を更新するが React Flow への反映は次フレームになるため rAF でラップ
    const focusIds =
      addMode === 'sibling'
        ? [...parentNodeIds, ...addedIds]
        : [selectedNode.id, ...addedIds]

    requestAnimationFrame(() => {
      fitView({
        nodes: focusIds.map((id) => ({ id })),
        padding: 0.3,
        duration: 500,
      })
    })
  }, [
    selectedNode,
    aiSuggestions,
    selected,
    addMode,
    parentNodeIds,
    addNode,
    onConnect,
    getCategoryById,
    setAIPanelOpen,
    setAISuggestions,
    fitView,
  ])

  const toggleSelect = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  if (!isAIPanelOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto">
        <PanelHeader
          icon="🤖"
          title="AIアイデア拡張"
          subtitle={selectedNode ? `"${selectedNode.data.title}"` : undefined}
          onClose={() => setAIPanelOpen(false)}
          closeAriaLabel="閉じる"
        />

        {!isReady ? (
          <ApiKeyRequired
            className="px-5 py-10"
            providerId={providerId}
            onOpenSettings={() => {
              setAIPanelOpen(false)
              setSettingsOpen(true)
            }}
          />
        ) : (
          <>
            <div className="px-5 py-4 space-y-3">
              {/* 選択ノードの内容 */}
              {selectedNode && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-xs space-y-1">
                  <p className="font-semibold text-gray-700 dark:text-gray-200 leading-snug">{selectedNode.data.title}</p>
                  {selectedNode.data.body && (
                    <p className="text-gray-500 dark:text-gray-400 whitespace-pre-wrap leading-relaxed max-h-24 overflow-y-auto">
                      {selectedNode.data.body}
                    </p>
                  )}
                </div>
              )}

              {/* 追加先モード切替 */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">追加先</span>
                <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-xs">
                  <button
                    onClick={() => setAddMode('child')}
                    className={`px-3 py-1.5 transition-colors ${
                      addMode === 'child'
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    子ノード
                  </button>
                  <button
                    onClick={() => setAddMode('sibling')}
                    disabled={!hasParent}
                    title={!hasParent ? 'このノードは親を持ちません' : undefined}
                    className={`px-3 py-1.5 transition-colors border-l border-gray-200 dark:border-gray-600 ${
                      addMode === 'sibling'
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    兄弟ノード
                  </button>
                </div>
              </div>

              {/* 提案数スライダー */}
              <div className="flex items-center gap-3">
                <label htmlFor="suggestion-count" className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                  提案数
                </label>
                <input
                  id="suggestion-count"
                  type="range"
                  min={3}
                  max={10}
                  value={suggestionCount}
                  onChange={(e) => setSuggestionCount(Number(e.target.value))}
                  className="flex-1 accent-primary-600"
                />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-200 w-5 text-right">
                  {suggestionCount}
                </span>
              </div>

              {/* Web検索トグル（デスクトップ版のみ） */}
              <WebSearchToggle
                state={webSearch}
                disabled={isAILoading}
                onOpenSettings={() => {
                  setAIPanelOpen(false)
                  setSettingsOpen(true)
                }}
              />

              {/* フリーテキスト指示入力 */}
              <textarea
                value={userInstruction}
                onChange={(e) => setUserInstruction(e.target.value)}
                placeholder="どのようなアイデアが欲しいですか？（例: 実装コストが低いもの）"
                rows={2}
                className="w-full text-xs p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg resize-none placeholder-gray-400 dark:placeholder-gray-500 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-400 focus:border-primary-400"
              />

              {/* エラー */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap">
                  {error}
                </div>
              )}

              {/* ローディング */}
              {isAILoading && (
                <AILoadingIndicator message="アイデアを生成中..." onCancel={cancel} layout="inline" />
              )}

              {/* 提案リスト */}
              {!isAILoading && aiSuggestions.length > 0 && (
                <>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    採用するアイデアを選択してください（{aiSuggestions.length}件）
                  </p>
                  <div className="space-y-2">
                    {aiSuggestions.map((suggestion: AISuggestion, idx) => {
                      const cat = suggestion.categoryId
                        ? getCategoryById(suggestion.categoryId)
                        : undefined
                      return (
                        <div
                          key={idx}
                          onClick={() => toggleSelect(idx)}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                            selected.has(idx)
                              ? 'border-primary-300 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/30'
                              : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(idx)}
                            // 行クリックでも切り替わるため、チェックボックス自身のクリックは伝播を止めて二重トグルを防ぐ
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleSelect(idx)}
                            aria-label={`「${suggestion.title}」を採用する`}
                            className="mt-0.5 accent-primary-600 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{suggestion.title}</p>
                            {suggestion.body && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{suggestion.body}</p>
                            )}
                            {cat && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <span
                                  className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full border border-gray-200 dark:border-gray-500"
                                  style={{ backgroundColor: cat.color }}
                                >
                                  <span className="text-[11px] leading-none">{cat.icon}</span>
                                  <span className="text-gray-700">{cat.name}</span>
                                </span>
                              </div>
                            )}
                          </div>
                          {/* 個別再生成ボタン */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRegenerate(idx)
                            }}
                            disabled={regeneratingIdx !== null || isAILoading}
                            title="この提案を再生成"
                            className="p-1 mt-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 transition-colors"
                          >
                            {regeneratingIdx === idx ? (
                              <svg
                                className="w-3.5 h-3.5 animate-spin"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                            ) : (
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                            )}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {/* 初期状態 */}
              {!isAILoading && aiSuggestions.length === 0 && !error && (
                <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
                  <span className="text-3xl mb-2 block">💡</span>
                  ボタンを押してAIにアイデアを提案してもらいましょう
                </div>
              )}

              {!isAILoading && <WebSearchSources results={searchSources} />}
            </div>

            {/* フッターボタン */}
            <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
              {aiSuggestions.length > 0 && !isAILoading && (
                <button
                  onClick={handleAddSelected}
                  disabled={selected.size === 0}
                  className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  選択した{selected.size}個を追加
                </button>
              )}
              <button
                onClick={handleFetch}
                disabled={isAILoading || regeneratingIdx !== null}
                className="w-full py-2.5 border border-primary-300 dark:border-primary-600 text-primary-600 dark:text-primary-400 text-sm font-medium rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {aiSuggestions.length > 0 ? '再生成' : 'AIに提案してもらう'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
