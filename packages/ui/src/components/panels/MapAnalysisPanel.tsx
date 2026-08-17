import { useState, useCallback, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { getPlatform } from '@ideamap/platform'
import { useUIStore, useMapStore, useSettingsStore, analyzeMap, suggestConnections, suggestClusters, reviewMap, calcSuggestionPositions, findFreePosition, toFriendlyAIError, isAbortError, LLMError, type ConnectionSuggestion, type ClusterSuggestion, type GardenerSuggestion, type WebSearchResult } from '@ideamap/core'
import { ApiKeyRequired } from '../common/ApiKeyRequired'
import { WebSearchToggle, WebSearchSources } from '../common/WebSearchToggle'
import { useActiveProvider } from '../../hooks/useActiveProvider'
import { useWebSearch } from '../../hooks/useWebSearch'

type TabKey = 'analysis' | 'connections' | 'clusters' | 'gardener'

/** ガーデナー提案の見た目・ラベルを kind ごとに出し分ける提案カード */
function GardenerCard({
  suggestion,
  applied,
  getTitle,
  onApply,
}: {
  suggestion: GardenerSuggestion
  applied: boolean
  getTitle: (id: string) => string
  onApply: () => void
}) {
  const KIND_LABEL: Record<GardenerSuggestion['kind'], string> = {
    deepen: '🌱 深掘り',
    merge: '🔗 統合',
    bridge: '🌉 橋渡し',
    question: '❓ 問いかけ',
  }

  return (
    <div
      className={`p-3 rounded-xl border border-emerald-100 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 space-y-2 transition-opacity ${
        applied ? 'opacity-50' : ''
      }`}
    >
      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{KIND_LABEL[suggestion.kind]}</p>

      {suggestion.kind === 'merge' ? (
        <div className="space-y-1">
          {suggestion.targetNodeIds.map((id) => (
            <p key={id} className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
              {getTitle(id)}
            </p>
          ))}
        </div>
      ) : suggestion.kind === 'bridge' ? (
        <div className="flex items-center gap-1.5 text-sm">
          <span className="font-medium text-gray-800 dark:text-gray-100 truncate max-w-[120px]">
            {getTitle(suggestion.targetNodeIds[0] ?? '')}
          </span>
          <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
          <span className="font-medium text-gray-800 dark:text-gray-100 truncate max-w-[120px]">
            {getTitle(suggestion.targetNodeIds[1] ?? '')}
          </span>
        </div>
      ) : (
        <div className="space-y-1">
          {suggestion.targetNodeIds[0] && (
            <p className="text-xs text-gray-500 dark:text-gray-400">対象: {getTitle(suggestion.targetNodeIds[0])}</p>
          )}
          {suggestion.title && (
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{suggestion.title}</p>
          )}
          {suggestion.body && (
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3">{suggestion.body}</p>
          )}
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400">{suggestion.reason}</p>

      <button
        onClick={onApply}
        disabled={applied}
        className="w-full py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {applied ? '適用済み' : '適用する'}
      </button>
    </div>
  )
}

/** 実行中の分析を中断するボタン。3タブとも同じ見た目で出す */
function CancelButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
    >
      キャンセル
    </button>
  )
}

export function MapAnalysisPanel() {
  const {
    isAnalysisPanelOpen,
    setAnalysisPanelOpen,
    isAnalysisLoading,
    setAnalysisLoading,
    mapAnalysis,
    setMapAnalysis,
    connectionSuggestions,
    setConnectionSuggestions,
    clusterSuggestions,
    setClusterSuggestions,
    gardenerSuggestions,
    setGardenerSuggestions,
    addToast,
    setSettingsOpen,
  } = useUIStore(
    useShallow((s) => ({
      isAnalysisPanelOpen: s.isAnalysisPanelOpen,
      setAnalysisPanelOpen: s.setAnalysisPanelOpen,
      isAnalysisLoading: s.isAnalysisLoading,
      setAnalysisLoading: s.setAnalysisLoading,
      mapAnalysis: s.mapAnalysis,
      setMapAnalysis: s.setMapAnalysis,
      connectionSuggestions: s.connectionSuggestions,
      setConnectionSuggestions: s.setConnectionSuggestions,
      clusterSuggestions: s.clusterSuggestions,
      setClusterSuggestions: s.setClusterSuggestions,
      gardenerSuggestions: s.gardenerSuggestions,
      setGardenerSuggestions: s.setGardenerSuggestions,
      addToast: s.addToast,
      setSettingsOpen: s.setSettingsOpen,
    }))
  )

  // nodes / edges は解析実行時にしか使わないため購読せず getState() から読む
  const { addSuggestedEdge, applyClusterCategory, mergeNodes, addNode, onConnect } = useMapStore(
    useShallow((s) => ({
      addSuggestedEdge: s.addSuggestedEdge,
      applyClusterCategory: s.applyClusterCategory,
      mergeNodes: s.mergeNodes,
      addNode: s.addNode,
      onConnect: s.onConnect,
    }))
  )
  // ガーデナータブの提案カードはノードタイトル表示のため購読する。
  // このパネルはバックドロップでキャンバス操作をブロックするモーダルなので、ドラッグ中の再レンダーは発生しない
  const nodes = useMapStore((s) => s.nodes)
  const { categories, getCategoryById } = useSettingsStore(
    useShallow((s) => ({
      categories: s.categories,
      getCategoryById: s.getCategoryById,
    }))
  )
  const { provider, isReady, providerId } = useActiveProvider()
  const webSearch = useWebSearch()

  const [activeTab, setActiveTab] = useState<TabKey>('analysis')
  const [dismissedConnections, setDismissedConnections] = useState<Set<string>>(new Set())
  const [appliedClusters, setAppliedClusters] = useState<Set<number>>(new Set())
  const [appliedGardener, setAppliedGardener] = useState<Set<number>>(new Set())
  const [rawErrorResponse, setRawErrorResponse] = useState<string | null>(null)
  const [searchSources, setSearchSources] = useState<WebSearchResult[]>([])
  // ローカルLLMは応答が長くかかりうるので3機能とも中断できるようにする（Phase 32 からの積み残し）
  const abortRef = useRef<AbortController | null>(null)

  const handleCancel = () => abortRef.current?.abort()

  /** AI実行の前提（Claude=APIキー / Ollama=モデル選択）が欠けているときの文言 */
  const notReadyMessage =
    providerId === 'ollama'
      ? '使用するOllamaモデルが選択されていません'
      : 'APIキーが設定されていません'

  const handleAnalyze = useCallback(async () => {
    if (!isReady) {
      addToast(notReadyMessage, 'error')
      return
    }
    setAnalysisLoading(true)
    setMapAnalysis(null)
    setRawErrorResponse(null)
    setSearchSources([])
    const { nodes, edges } = useMapStore.getState()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const result = await analyzeMap({
        provider,
        webSearch: webSearch.client,
        onWebSearchResults: setSearchSources,
        nodes: nodes.map((n) => ({ id: n.id, title: n.data.title, body: n.data.body, categoryId: n.data.categoryId })),
        edges: edges.map((e) => ({ source: e.source, target: e.target })),
        categories,
      }, ctrl.signal)
      setMapAnalysis(result)
    } catch (e) {
      if (isAbortError(e)) return
      addToast(toFriendlyAIError(e), 'error')
      if (e instanceof LLMError && e.rawResponse) setRawErrorResponse(e.rawResponse)
    } finally {
      setAnalysisLoading(false)
      abortRef.current = null
    }
  }, [isReady, notReadyMessage, provider, webSearch.client, categories, setAnalysisLoading, setMapAnalysis, addToast])

  const handleFindConnections = useCallback(async () => {
    if (!isReady) {
      addToast(notReadyMessage, 'error')
      return
    }
    setAnalysisLoading(true)
    setConnectionSuggestions([])
    setDismissedConnections(new Set())
    setRawErrorResponse(null)
    const { nodes, edges } = useMapStore.getState()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const result = await suggestConnections({
        provider,
        nodes: nodes.map((n) => ({ id: n.id, title: n.data.title, body: n.data.body })),
        existingEdges: edges.map((e) => ({ source: e.source, target: e.target })),
      }, ctrl.signal)
      setConnectionSuggestions(result)
      if (result.length === 0) addToast('新しい接続候補は見つかりませんでした', 'info')
    } catch (e) {
      if (isAbortError(e)) return
      addToast(toFriendlyAIError(e), 'error')
      if (e instanceof LLMError && e.rawResponse) setRawErrorResponse(e.rawResponse)
    } finally {
      setAnalysisLoading(false)
      abortRef.current = null
    }
  }, [isReady, notReadyMessage, provider, setAnalysisLoading, setConnectionSuggestions, addToast])

  const handleSuggestClusters = useCallback(async () => {
    if (!isReady) {
      addToast(notReadyMessage, 'error')
      return
    }
    setAnalysisLoading(true)
    setClusterSuggestions([])
    setAppliedClusters(new Set())
    setRawErrorResponse(null)
    const { nodes } = useMapStore.getState()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const result = await suggestClusters({
        provider,
        nodes: nodes.map((n) => ({ id: n.id, title: n.data.title, body: n.data.body })),
        categories,
      }, ctrl.signal)
      setClusterSuggestions(result)
      if (result.length === 0) addToast('グループ化の提案がありませんでした', 'info')
    } catch (e) {
      if (isAbortError(e)) return
      addToast(toFriendlyAIError(e), 'error')
      if (e instanceof LLMError && e.rawResponse) setRawErrorResponse(e.rawResponse)
    } finally {
      setAnalysisLoading(false)
      abortRef.current = null
    }
  }, [isReady, notReadyMessage, provider, categories, setAnalysisLoading, setClusterSuggestions, addToast])

  const handleReviewMap = useCallback(async () => {
    if (!isReady) {
      addToast(notReadyMessage, 'error')
      return
    }
    setAnalysisLoading(true)
    setGardenerSuggestions([])
    setAppliedGardener(new Set())
    setRawErrorResponse(null)
    const { nodes, edges } = useMapStore.getState()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const result = await reviewMap({
        provider,
        nodes: nodes.map((n) => ({
          id: n.id,
          title: n.data.title,
          body: n.data.body,
          categoryId: n.data.categoryId,
          createdBy: n.data.createdBy,
          updatedAt: n.data.updatedAt,
        })),
        edges: edges.map((e) => ({ source: e.source, target: e.target })),
        categories,
      }, ctrl.signal)
      setGardenerSuggestions(result)
      if (result.length === 0) addToast('提案はありませんでした', 'info')
    } catch (e) {
      if (isAbortError(e)) return
      addToast(toFriendlyAIError(e), 'error')
      if (e instanceof LLMError && e.rawResponse) setRawErrorResponse(e.rawResponse)
    } finally {
      setAnalysisLoading(false)
      abortRef.current = null
    }
  }, [isReady, notReadyMessage, provider, categories, setAnalysisLoading, setGardenerSuggestions, addToast])

  /** 対象ノードのタイトルを解決する。マップから消えている場合のフォールバック文言も返す */
  const getNodeTitle = useCallback(
    (id: string) => nodes.find((n) => n.id === id)?.data.title ?? '(不明なノード)',
    [nodes],
  )

  /**
   * kind ごとの適用処理。deepen/question は「新規ノードを追加し、対象ノードがあれば接続する」という
   * 共通の形なのでまとめて扱う（deepen は常に対象あり、question は対象なしのとき独立ノードになる）
   */
  const handleApplyGardener = useCallback(
    (suggestion: GardenerSuggestion, idx: number) => {
      const { nodes: currentNodes } = useMapStore.getState()

      if (suggestion.kind === 'merge') {
        if (suggestion.targetNodeIds.length < 2) return
        mergeNodes(suggestion.targetNodeIds[0], suggestion.targetNodeIds[1])
        addToast('ノードを統合しました', 'success')
      } else if (suggestion.kind === 'bridge') {
        if (suggestion.targetNodeIds.length < 2) return
        addSuggestedEdge(suggestion.targetNodeIds[0], suggestion.targetNodeIds[1])
        addToast('ノードを接続しました', 'success')
      } else {
        if (!suggestion.title) return
        const targetId = suggestion.targetNodeIds[0]
        const targetNode = targetId ? currentNodes.find((n) => n.id === targetId) : undefined
        const pos = targetNode
          ? calcSuggestionPositions(targetNode.position.x, targetNode.position.y, 1, currentNodes)[0]
          : findFreePosition({ x: 0, y: 0 }, currentNodes)
        const newId = addNode(suggestion.title, pos.x, pos.y, 'ai', '#f3f4ff', undefined, suggestion.body)
        if (targetNode) onConnect({ source: targetNode.id, target: newId, sourceHandle: null, targetHandle: null })
        addToast(`「${suggestion.title}」を追加しました`, 'success')
      }

      setAppliedGardener((prev) => new Set([...prev, idx]))
    },
    [mergeNodes, addSuggestedEdge, addNode, onConnect, addToast],
  )

  const handleApproveConnection = useCallback(
    (suggestion: ConnectionSuggestion) => {
      addSuggestedEdge(suggestion.sourceId, suggestion.targetId)
      addToast(`「${suggestion.sourceTitle}」→「${suggestion.targetTitle}」を接続しました`, 'success')
      setDismissedConnections((prev) => new Set([...prev, `${suggestion.sourceId}:${suggestion.targetId}`]))
    },
    [addSuggestedEdge, addToast]
  )

  const handleRejectConnection = useCallback((key: string) => {
    setDismissedConnections((prev) => new Set([...prev, key]))
  }, [])

  const handleApplyCluster = useCallback(
    (cluster: ClusterSuggestion, idx: number) => {
      const cat = getCategoryById(cluster.categoryId)
      const color = cat?.color ?? '#f3f4f6'
      applyClusterCategory(cluster.nodeIds, cluster.categoryId, color)
      setAppliedClusters((prev) => new Set([...prev, idx]))
      addToast(`「${cluster.groupName}」グループに${cluster.nodeIds.length}件のカテゴリを適用しました`, 'success')
    },
    [applyClusterCategory, getCategoryById, addToast]
  )

  const copyToClipboard = useCallback(async (text: string) => {
    await getPlatform().system.copyToClipboard(text)
    addToast('コピーしました', 'success')
  }, [addToast])

  if (!isAnalysisPanelOpen) return null

  const analysisText = mapAnalysis
    ? [
        `【主要テーマ】\n${mapAnalysis.summary}`,
        mapAnalysis.missingAreas.length > 0
          ? `【見落としているかもしれない領域】\n${mapAnalysis.missingAreas.map((a) => `・${a}`).join('\n')}`
          : null,
        mapAnalysis.importantNodeTitles.length > 0
          ? `【重要度の高いノード】\n${mapAnalysis.importantNodeTitles.map((t) => `・${t}`).join('\n')}`
          : null,
      ]
        .filter(Boolean)
        .join('\n\n')
    : ''

  const visibleConnections = connectionSuggestions.filter(
    (s) => !dismissedConnections.has(`${s.sourceId}:${s.targetId}`)
  )

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setAnalysisPanelOpen(false)} />
      <div className="relative ml-auto w-full sm:max-w-md h-full bg-white dark:bg-gray-800 shadow-2xl flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">🧠</span>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">AIマップ分析</h2>
          </div>
          <button
            onClick={() => setAnalysisPanelOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!isReady ? (
          <ApiKeyRequired
            providerId={providerId}
            onOpenSettings={() => {
              setAnalysisPanelOpen(false)
              setSettingsOpen(true)
            }}
          />
        ) : (
          <>
            {/* タブ */}
            <div className="flex border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
              {(['analysis', 'connections', 'clusters', 'gardener'] as TabKey[]).map((tab) => {
                const labels: Record<TabKey, string> = {
                  analysis: '📊 全体分析',
                  connections: '🔗 つながり',
                  clusters: '🗂 グループ',
                  gardener: '🌱 ガーデナー',
                }
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                      activeTab === tab
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    {labels[tab]}
                  </button>
                )
              })}
            </div>

            {rawErrorResponse !== null && (
              <div className="mx-5 mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2 flex-shrink-0">
                <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-red-700 dark:text-red-300 font-medium mb-1">AIの応答をJSONとして解析できませんでした</p>
                  <button
                    onClick={() => void copyToClipboard(rawErrorResponse)}
                    className="text-xs text-red-600 dark:text-red-400 underline hover:no-underline"
                  >
                    AIの生レスポンスをコピー
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {/* 全体分析タブ */}
              {activeTab === 'analysis' && (
                <div className="p-5 space-y-4">
                  {/* Web検索は「見落としている領域」の指摘に効くので全体分析タブにだけ置く */}
                  <WebSearchToggle
                    state={webSearch}
                    disabled={isAnalysisLoading}
                    onOpenSettings={() => {
                      setAnalysisPanelOpen(false)
                      setSettingsOpen(true)
                    }}
                  />
                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalysisLoading}
                    className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isAnalysisLoading ? 'AI が分析中...' : 'マップ全体を分析'}
                  </button>

                  {isAnalysisLoading && (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">マップを読み取っています...</p>
                      <CancelButton onClick={handleCancel} />
                    </div>
                  )}

                  {mapAnalysis && !isAnalysisLoading && (
                    <div className="space-y-4">
                      <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                        <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-1">主要テーマ</p>
                        <p className="text-sm text-gray-700 dark:text-gray-200">{mapAnalysis.summary}</p>
                      </div>

                      {mapAnalysis.missingAreas.length > 0 && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800">
                          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-2">見落としているかもしれない領域</p>
                          <ul className="space-y-1">
                            {mapAnalysis.missingAreas.map((area, i) => (
                              <li key={i} className="text-sm text-gray-700 dark:text-gray-200 flex items-start gap-1.5">
                                <span className="text-amber-400 mt-0.5">•</span>
                                <span>{area}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {mapAnalysis.importantNodeTitles.length > 0 && (
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800">
                          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-2">重要度の高いノード</p>
                          <ul className="space-y-1">
                            {mapAnalysis.importantNodeTitles.map((title, i) => (
                              <li key={i} className="text-sm text-gray-700 dark:text-gray-200 flex items-start gap-1.5">
                                <span className="text-emerald-400 mt-0.5">★</span>
                                <span>{title}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <button
                        onClick={() => void copyToClipboard(analysisText)}
                        className="w-full py-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        分析結果をコピー
                      </button>

                      <WebSearchSources results={searchSources} />
                    </div>
                  )}

                  {!mapAnalysis && !isAnalysisLoading && (
                    <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
                      <span className="text-3xl mb-3 block">📊</span>
                      ボタンを押してマップ全体を分析します
                    </div>
                  )}
                </div>
              )}

              {/* つながりタブ */}
              {activeTab === 'connections' && (
                <div className="p-5 space-y-4">
                  <button
                    onClick={handleFindConnections}
                    disabled={isAnalysisLoading}
                    className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isAnalysisLoading ? 'AI が探索中...' : 'つながりを探す'}
                  </button>

                  {isAnalysisLoading && (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">関連するノードを探しています...</p>
                      <CancelButton onClick={handleCancel} />
                    </div>
                  )}

                  {!isAnalysisLoading && visibleConnections.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {visibleConnections.length}件の接続候補が見つかりました
                      </p>
                      {visibleConnections.map((suggestion) => {
                        const key = `${suggestion.sourceId}:${suggestion.targetId}`
                        return (
                          <div
                            key={key}
                            className="p-3 rounded-xl border border-purple-100 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 space-y-2"
                          >
                            <div className="flex items-center gap-1.5 text-sm">
                              <span className="font-medium text-gray-800 dark:text-gray-100 truncate max-w-[120px]">
                                {suggestion.sourceTitle}
                              </span>
                              <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                              </svg>
                              <span className="font-medium text-gray-800 dark:text-gray-100 truncate max-w-[120px]">
                                {suggestion.targetTitle}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{suggestion.reason}</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApproveConnection(suggestion)}
                                className="flex-1 py-1.5 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 transition-colors"
                              >
                                接続する
                              </button>
                              <button
                                onClick={() => handleRejectConnection(key)}
                                className="flex-1 py-1.5 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                              >
                                却下
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {!isAnalysisLoading && connectionSuggestions.length > 0 && visibleConnections.length === 0 && (
                    <div className="text-center py-6 text-sm text-gray-400 dark:text-gray-500">
                      すべての提案を処理しました
                    </div>
                  )}

                  {!isAnalysisLoading && connectionSuggestions.length === 0 && (
                    <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
                      <span className="text-3xl mb-3 block">🔗</span>
                      ノード間の隠れたつながりをAIが探します
                    </div>
                  )}
                </div>
              )}

              {/* グループ化タブ */}
              {activeTab === 'clusters' && (
                <div className="p-5 space-y-4">
                  <button
                    onClick={handleSuggestClusters}
                    disabled={isAnalysisLoading}
                    className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isAnalysisLoading ? 'AI が分類中...' : 'グループ化を提案'}
                  </button>

                  {isAnalysisLoading && (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">ノードを分類しています...</p>
                      <CancelButton onClick={handleCancel} />
                    </div>
                  )}

                  {!isAnalysisLoading && clusterSuggestions.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {clusterSuggestions.length}グループの提案があります。カテゴリを一括適用できます。
                      </p>
                      {clusterSuggestions.map((cluster, idx) => {
                        const cat = getCategoryById(cluster.categoryId)
                        const applied = appliedClusters.has(idx)
                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border space-y-2 transition-opacity ${
                              applied ? 'opacity-50' : ''
                            }`}
                            style={{ borderColor: cat?.color ?? '#e5e7eb', backgroundColor: `${cat?.color ?? '#f9fafb'}40` }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                {cat && <span className="text-base leading-none">{cat.icon}</span>}
                                <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{cluster.groupName}</span>
                                {cat && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">→ {cat.name}</span>
                                )}
                              </div>
                              <span className="text-xs text-gray-400 dark:text-gray-500">{cluster.nodeIds.length}件</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {cluster.nodeTitles.map((title, i) => (
                                <span
                                  key={i}
                                  className="inline-block text-xs px-2 py-0.5 bg-white dark:bg-gray-700 rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                                >
                                  {title}
                                </span>
                              ))}
                            </div>
                            <button
                              onClick={() => handleApplyCluster(cluster, idx)}
                              disabled={applied}
                              className="w-full py-1.5 bg-gray-700 text-white text-xs rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              {applied ? '適用済み' : 'カテゴリを一括適用'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {!isAnalysisLoading && clusterSuggestions.length === 0 && (
                    <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
                      <span className="text-3xl mb-3 block">🗂</span>
                      AIがノードをテーマ別にグループ分けして、カテゴリを提案します
                    </div>
                  )}
                </div>
              )}

              {/* ガーデナータブ */}
              {activeTab === 'gardener' && (
                <div className="p-5 space-y-4">
                  <button
                    onClick={handleReviewMap}
                    disabled={isAnalysisLoading}
                    className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isAnalysisLoading ? 'AI がレビュー中...' : 'マップをレビュー'}
                  </button>

                  {isAnalysisLoading && (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">庭師の目でマップを見ています...</p>
                      <CancelButton onClick={handleCancel} />
                    </div>
                  )}

                  {!isAnalysisLoading && gardenerSuggestions.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {gardenerSuggestions.length}件の提案があります
                      </p>
                      {gardenerSuggestions.map((suggestion, idx) => (
                        <GardenerCard
                          key={idx}
                          suggestion={suggestion}
                          applied={appliedGardener.has(idx)}
                          getTitle={getNodeTitle}
                          onApply={() => handleApplyGardener(suggestion, idx)}
                        />
                      ))}
                    </div>
                  )}

                  {!isAnalysisLoading && gardenerSuggestions.length === 0 && (
                    <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
                      <span className="text-3xl mb-3 block">🌱</span>
                      AIが庭師のようにマップを見て、深掘り・統合・橋渡し・問いかけを提案します
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
