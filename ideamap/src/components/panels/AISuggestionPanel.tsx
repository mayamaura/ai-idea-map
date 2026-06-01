import { useState, useCallback } from 'react'
import { useUIStore } from '../../stores/uiStore'
import { useMapStore } from '../../stores/mapStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { generateSuggestions } from '../../services/claudeService'
import { calcSuggestionPositions } from '../../utils/mapLayout'
import type { AISuggestion, SuggestionType } from '../../types'

const typeColors: Record<string, string> = {
  '関連': 'bg-blue-100 text-blue-700',
  '深掘り': 'bg-green-100 text-green-700',
  '対比': 'bg-orange-100 text-orange-700',
  '応用': 'bg-purple-100 text-purple-700',
}

const ALL_TYPES: SuggestionType[] = ['関連', '深掘り', '対比', '応用']

export function AISuggestionPanel() {
  const { isAIPanelOpen, setAIPanelOpen, selectedNodeId, aiSuggestions, setAISuggestions, isAILoading, setAILoading, suggestionTypeFilter, toggleSuggestionTypeFilter } = useUIStore()
  const { nodes, edges, addNode, onConnect } = useMapStore()
  const { apiKey, aiModel, suggestionCount, setSuggestionCount, categories, getCategoryById } = useSettingsStore()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)

  const filteredSuggestions = suggestionTypeFilter.length > 0
    ? aiSuggestions.filter((s) => suggestionTypeFilter.includes(s.type))
    : aiSuggestions

  const handleFetch = useCallback(async () => {
    if (!selectedNode || !apiKey) {
      setError(apiKey ? 'ノードが選択されていません' : 'APIキーが設定されていません。設定画面から入力してください。')
      return
    }
    setError(null)
    setAILoading(true)
    setAISuggestions([])
    setSelected(new Set())
    try {
      const connectedNodeIds = new Set<string>()
      edges.forEach((e) => {
        if (e.source === selectedNode.id) connectedNodeIds.add(e.target)
        if (e.target === selectedNode.id) connectedNodeIds.add(e.source)
      })
      const connectedNodes = nodes.filter((n) => connectedNodeIds.has(n.id))

      const suggestions = await generateSuggestions({
        apiKey,
        model: aiModel,
        selectedNodeTitle: selectedNode.data.title,
        selectedNodeBody: selectedNode.data.body,
        connectedNodeTitles: connectedNodes.map((n) => n.data.title),
        allNodeTitles: nodes.slice(0, 15).map((n) => n.data.title),
        count: suggestionCount,
        categories,
      })
      setAISuggestions(suggestions)
      const visible = suggestionTypeFilter.length > 0
      ? suggestions.filter((s) => suggestionTypeFilter.includes(s.type))
      : suggestions
    setSelected(new Set(visible.map((_, i) => i)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました')
    } finally {
      setAILoading(false)
    }
  }, [selectedNode, apiKey, aiModel, suggestionCount, nodes, edges, categories, suggestionTypeFilter, setAILoading, setAISuggestions])

  const handleAddSelected = useCallback(() => {
    if (!selectedNode) return
    const selectedSuggestions = filteredSuggestions.filter((_, i) => selected.has(i))
    const positions = calcSuggestionPositions(
      selectedNode.position.x,
      selectedNode.position.y,
      selectedSuggestions.length,
      nodes
    )

    selectedSuggestions.forEach((suggestion, idx) => {
      const { x, y } = positions[idx]
      const cat = suggestion.categoryId ? getCategoryById(suggestion.categoryId) : undefined
      const nodeColor = cat?.color ?? '#f3f4ff'
      const newId = addNode(suggestion.text, x, y, 'ai', nodeColor, suggestion.categoryId)
      onConnect({ source: selectedNode.id, target: newId, sourceHandle: null, targetHandle: null })
      // categoryId が設定されている場合は updateNodeCategory を呼ぶ必要はない（addNode で設定済み）
    })
    setAIPanelOpen(false)
    setSelected(new Set())
  }, [selectedNode, filteredSuggestions, selected, nodes, addNode, onConnect, getCategoryById, setAIPanelOpen])

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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <div>
              <h2 className="text-sm font-semibold text-gray-800">AIアイデア拡張</h2>
              {selectedNode && (
                <p className="text-xs text-gray-400 truncate max-w-48">"{selectedNode.data.title}"</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setAIPanelOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* 提案数スライダー */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 flex-shrink-0">提案数</span>
            <input
              type="range"
              min={3}
              max={10}
              value={suggestionCount}
              onChange={(e) => setSuggestionCount(Number(e.target.value))}
              className="flex-1 accent-primary-600"
            />
            <span className="text-xs font-medium text-gray-700 w-5 text-right">{suggestionCount}</span>
          </div>

          {/* 種別フィルタ */}
          <div className="flex flex-wrap gap-1.5">
            {ALL_TYPES.map((type) => {
              const active = suggestionTypeFilter.length === 0 || suggestionTypeFilter.includes(type)
              return (
                <button
                  key={type}
                  onClick={() => toggleSuggestionTypeFilter(type)}
                  className={`text-xs px-2 py-1 rounded-full border transition-all ${
                    typeColors[type] ?? 'bg-gray-100 text-gray-600'
                  } ${active ? 'opacity-100 ring-1 ring-offset-1 ring-gray-300' : 'opacity-40'}`}
                >
                  {type}
                </button>
              )
            })}
          </div>

          {/* エラー */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          {/* ローディング */}
          {isAILoading && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-500">アイデアを生成中...</p>
            </div>
          )}

          {/* 提案リスト */}
          {!isAILoading && filteredSuggestions.length > 0 && (
            <>
              <p className="text-xs text-gray-400">採用するアイデアを選択してください（{filteredSuggestions.length}件）</p>
              <div className="space-y-2">
                {filteredSuggestions.map((suggestion: AISuggestion, idx) => {
                  const cat = suggestion.categoryId ? getCategoryById(suggestion.categoryId) : undefined
                  return (
                    <label
                      key={idx}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        selected.has(idx)
                          ? 'border-primary-300 bg-primary-50'
                          : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(idx)}
                        onChange={() => toggleSelect(idx)}
                        className="mt-0.5 accent-primary-600 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700">{suggestion.text}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={`inline-block text-xs px-1.5 py-0.5 rounded-full ${typeColors[suggestion.type] ?? 'bg-gray-100 text-gray-600'}`}>
                            {suggestion.type}
                          </span>
                          {cat && (
                            <span
                              className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full border border-gray-200"
                              style={{ backgroundColor: cat.color }}
                            >
                              <span className="text-[11px] leading-none">{cat.icon}</span>
                              <span className="text-gray-700">{cat.name}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </>
          )}

          {/* フィルタが絞りすぎで空になった場合 */}
          {!isAILoading && aiSuggestions.length > 0 && filteredSuggestions.length === 0 && (
            <p className="text-xs text-center text-gray-400 py-4">フィルター条件に一致する提案がありません</p>
          )}

          {/* 初期状態 */}
          {!isAILoading && aiSuggestions.length === 0 && !error && (
            <div className="text-center py-8 text-sm text-gray-400">
              <span className="text-3xl mb-2 block">💡</span>
              ボタンを押してAIにアイデアを提案してもらいましょう
            </div>
          )}
        </div>

        {/* フッターボタン */}
        <div className="px-5 py-4 border-t border-gray-100 space-y-2">
          {filteredSuggestions.length > 0 && !isAILoading && (
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
            disabled={isAILoading}
            className="w-full py-2.5 border border-primary-300 text-primary-600 text-sm font-medium rounded-xl hover:bg-primary-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {aiSuggestions.length > 0 ? '再生成' : 'AIに提案してもらう'}
          </button>
        </div>
      </div>
    </div>
  )
}
