import { useState, useCallback } from 'react'
import { useUIStore } from '../../stores/uiStore'
import { useMapStore } from '../../stores/mapStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { analyzeMap, suggestConnections, suggestClusters } from '../../services/claudeService'
import type { ConnectionSuggestion, ClusterSuggestion } from '../../types'

type TabKey = 'analysis' | 'connections' | 'clusters'

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
    addToast,
  } = useUIStore()

  const { nodes, edges, addSuggestedEdge, applyClusterCategory } = useMapStore()
  const { apiKey, aiModel, categories, getCategoryById } = useSettingsStore()

  const [activeTab, setActiveTab] = useState<TabKey>('analysis')
  const [rejectedConnections, setRejectedConnections] = useState<Set<string>>(new Set())
  const [appliedClusters, setAppliedClusters] = useState<Set<number>>(new Set())

  const handleAnalyze = useCallback(async () => {
    if (!apiKey) {
      addToast('APIキーが設定されていません', 'error')
      return
    }
    setAnalysisLoading(true)
    setMapAnalysis(null)
    try {
      const result = await analyzeMap({
        apiKey,
        model: aiModel,
        nodes: nodes.map((n) => ({ id: n.id, title: n.data.title, body: n.data.body, categoryId: n.data.categoryId })),
        edges: edges.map((e) => ({ source: e.source, target: e.target })),
        categories,
      })
      setMapAnalysis(result)
    } catch (e) {
      addToast(e instanceof Error ? e.message : '分析中にエラーが発生しました', 'error')
    } finally {
      setAnalysisLoading(false)
    }
  }, [apiKey, aiModel, nodes, edges, categories, setAnalysisLoading, setMapAnalysis, addToast])

  const handleFindConnections = useCallback(async () => {
    if (!apiKey) {
      addToast('APIキーが設定されていません', 'error')
      return
    }
    setAnalysisLoading(true)
    setConnectionSuggestions([])
    setRejectedConnections(new Set())
    try {
      const result = await suggestConnections({
        apiKey,
        model: aiModel,
        nodes: nodes.map((n) => ({ id: n.id, title: n.data.title, body: n.data.body })),
        existingEdges: edges.map((e) => ({ source: e.source, target: e.target })),
      })
      setConnectionSuggestions(result)
      if (result.length === 0) addToast('新しい接続候補は見つかりませんでした', 'info')
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'つながり探索中にエラーが発生しました', 'error')
    } finally {
      setAnalysisLoading(false)
    }
  }, [apiKey, aiModel, nodes, edges, setAnalysisLoading, setConnectionSuggestions, addToast])

  const handleSuggestClusters = useCallback(async () => {
    if (!apiKey) {
      addToast('APIキーが設定されていません', 'error')
      return
    }
    setAnalysisLoading(true)
    setClusterSuggestions([])
    setAppliedClusters(new Set())
    try {
      const result = await suggestClusters({
        apiKey,
        model: aiModel,
        nodes: nodes.map((n) => ({ id: n.id, title: n.data.title, body: n.data.body })),
        categories,
      })
      setClusterSuggestions(result)
      if (result.length === 0) addToast('グループ化の提案がありませんでした', 'info')
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'クラスタリング中にエラーが発生しました', 'error')
    } finally {
      setAnalysisLoading(false)
    }
  }, [apiKey, aiModel, nodes, categories, setAnalysisLoading, setClusterSuggestions, addToast])

  const handleApproveConnection = useCallback(
    (suggestion: ConnectionSuggestion) => {
      addSuggestedEdge(suggestion.sourceId, suggestion.targetId)
      addToast(`「${suggestion.sourceTitle}」→「${suggestion.targetTitle}」を接続しました`, 'success')
    },
    [addSuggestedEdge, addToast]
  )

  const handleRejectConnection = useCallback((key: string) => {
    setRejectedConnections((prev) => new Set([...prev, key]))
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
    await navigator.clipboard.writeText(text)
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
    (s) => !rejectedConnections.has(`${s.sourceId}:${s.targetId}`)
  )

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setAnalysisPanelOpen(false)} />
      <div className="relative ml-auto w-full max-w-md h-full bg-white dark:bg-gray-800 shadow-2xl flex flex-col overflow-hidden">
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

        {/* タブ */}
        <div className="flex border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          {(['analysis', 'connections', 'clusters'] as TabKey[]).map((tab) => {
            const labels: Record<TabKey, string> = { analysis: '📊 全体分析', connections: '🔗 つながり', clusters: '🗂 グループ' }
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

        <div className="flex-1 overflow-y-auto">
          {/* 全体分析タブ */}
          {activeTab === 'analysis' && (
            <div className="p-5 space-y-4">
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
        </div>
      </div>
    </div>
  )
}
