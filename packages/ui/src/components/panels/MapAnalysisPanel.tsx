import { useState, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { getPlatform } from '@ideamap/platform'
import { useUIStore, useMapStore, useSettingsStore, analyzeMap, suggestConnections, suggestClusters, reviewMap, calcSuggestionPositions, findFreePosition, toFriendlyAIError, LLMError, type ConnectionSuggestion, type ClusterSuggestion, type GardenerSuggestion, type WebSearchResult } from '@ideamap/core'
import { ApiKeyRequired } from '../common/ApiKeyRequired'
import { PanelHeader } from '../common/PanelHeader'
import { useActiveProvider } from '../../hooks/useActiveProvider'
import { useWebSearch } from '../../hooks/useWebSearch'
import { useCancellableAIRequest } from '../../hooks/useCancellableAIRequest'
import { AnalysisTab } from './mapAnalysis/AnalysisTab'
import { ConnectionsTab } from './mapAnalysis/ConnectionsTab'
import { ClustersTab } from './mapAnalysis/ClustersTab'
import { GardenerTab } from './mapAnalysis/GardenerTab'

type TabKey = 'analysis' | 'connections' | 'clusters' | 'gardener'

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
  // ローカルLLMは応答が長くかかりうるので4機能とも中断できるようにする（Phase 32 からの積み残し）
  const { run, cancel } = useCancellableAIRequest(setAnalysisLoading)

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
    setMapAnalysis(null)
    setRawErrorResponse(null)
    setSearchSources([])
    try {
      await run(async (signal) => {
        const { nodes, edges } = useMapStore.getState()
        const result = await analyzeMap({
          provider,
          webSearch: webSearch.client,
          onWebSearchResults: setSearchSources,
          nodes: nodes.map((n) => ({ id: n.id, title: n.data.title, body: n.data.body, categoryId: n.data.categoryId })),
          edges: edges.map((e) => ({ source: e.source, target: e.target })),
          categories,
        }, signal)
        setMapAnalysis(result)
      })
    } catch (e) {
      addToast(toFriendlyAIError(e), 'error')
      if (e instanceof LLMError && e.rawResponse) setRawErrorResponse(e.rawResponse)
    }
  }, [isReady, notReadyMessage, provider, webSearch.client, categories, run, setMapAnalysis, addToast])

  const handleFindConnections = useCallback(async () => {
    if (!isReady) {
      addToast(notReadyMessage, 'error')
      return
    }
    setConnectionSuggestions([])
    setDismissedConnections(new Set())
    setRawErrorResponse(null)
    try {
      await run(async (signal) => {
        const { nodes, edges } = useMapStore.getState()
        const result = await suggestConnections({
          provider,
          nodes: nodes.map((n) => ({ id: n.id, title: n.data.title, body: n.data.body })),
          existingEdges: edges.map((e) => ({ source: e.source, target: e.target })),
        }, signal)
        setConnectionSuggestions(result)
        if (result.length === 0) addToast('新しい接続候補は見つかりませんでした', 'info')
      })
    } catch (e) {
      addToast(toFriendlyAIError(e), 'error')
      if (e instanceof LLMError && e.rawResponse) setRawErrorResponse(e.rawResponse)
    }
  }, [isReady, notReadyMessage, provider, run, setConnectionSuggestions, addToast])

  const handleSuggestClusters = useCallback(async () => {
    if (!isReady) {
      addToast(notReadyMessage, 'error')
      return
    }
    setClusterSuggestions([])
    setAppliedClusters(new Set())
    setRawErrorResponse(null)
    try {
      await run(async (signal) => {
        const { nodes } = useMapStore.getState()
        const result = await suggestClusters({
          provider,
          nodes: nodes.map((n) => ({ id: n.id, title: n.data.title, body: n.data.body })),
          categories,
        }, signal)
        setClusterSuggestions(result)
        if (result.length === 0) addToast('グループ化の提案がありませんでした', 'info')
      })
    } catch (e) {
      addToast(toFriendlyAIError(e), 'error')
      if (e instanceof LLMError && e.rawResponse) setRawErrorResponse(e.rawResponse)
    }
  }, [isReady, notReadyMessage, provider, categories, run, setClusterSuggestions, addToast])

  const handleReviewMap = useCallback(async () => {
    if (!isReady) {
      addToast(notReadyMessage, 'error')
      return
    }
    setGardenerSuggestions([])
    setAppliedGardener(new Set())
    setRawErrorResponse(null)
    try {
      await run(async (signal) => {
        const { nodes, edges } = useMapStore.getState()
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
        }, signal)
        setGardenerSuggestions(result)
        if (result.length === 0) addToast('提案はありませんでした', 'info')
      })
    } catch (e) {
      addToast(toFriendlyAIError(e), 'error')
      if (e instanceof LLMError && e.rawResponse) setRawErrorResponse(e.rawResponse)
    }
  }, [isReady, notReadyMessage, provider, categories, run, setGardenerSuggestions, addToast])

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

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setAnalysisPanelOpen(false)} />
      <div className="relative ml-auto w-full sm:max-w-md h-full bg-white dark:bg-gray-800 shadow-2xl flex flex-col overflow-hidden">
        <PanelHeader
          icon="🧠"
          title="AIマップ分析"
          onClose={() => setAnalysisPanelOpen(false)}
          closeAriaLabel="閉じる"
        />

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
              {activeTab === 'analysis' && (
                <AnalysisTab
                  webSearch={webSearch}
                  isLoading={isAnalysisLoading}
                  mapAnalysis={mapAnalysis}
                  searchSources={searchSources}
                  onAnalyze={handleAnalyze}
                  onCancel={cancel}
                  onOpenSettings={() => {
                    setAnalysisPanelOpen(false)
                    setSettingsOpen(true)
                  }}
                  copyToClipboard={copyToClipboard}
                />
              )}

              {activeTab === 'connections' && (
                <ConnectionsTab
                  isLoading={isAnalysisLoading}
                  connectionSuggestions={connectionSuggestions}
                  dismissedConnections={dismissedConnections}
                  onFindConnections={handleFindConnections}
                  onCancel={cancel}
                  onApprove={handleApproveConnection}
                  onReject={handleRejectConnection}
                />
              )}

              {activeTab === 'clusters' && (
                <ClustersTab
                  isLoading={isAnalysisLoading}
                  clusterSuggestions={clusterSuggestions}
                  appliedClusters={appliedClusters}
                  getCategoryById={getCategoryById}
                  onSuggestClusters={handleSuggestClusters}
                  onCancel={cancel}
                  onApply={handleApplyCluster}
                />
              )}

              {activeTab === 'gardener' && (
                <GardenerTab
                  isLoading={isAnalysisLoading}
                  gardenerSuggestions={gardenerSuggestions}
                  appliedGardener={appliedGardener}
                  getTitle={getNodeTitle}
                  onReviewMap={handleReviewMap}
                  onCancel={cancel}
                  onApply={handleApplyGardener}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
