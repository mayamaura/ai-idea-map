import { useState, useCallback } from 'react'
import { useUIStore } from '../../stores/uiStore'
import { useMapStore } from '../../stores/mapStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { generateSuggestions } from '../../services/claudeService'
import { calcSuggestionPositions } from '../../utils/mapLayout'
import type { AISuggestion } from '../../types'

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
  } = useUIStore()
  const { nodes, edges, addNode, onConnect } = useMapStore()
  const { apiKey, aiModel, suggestionCount, setSuggestionCount, categories, getCategoryById } =
    useSettingsStore()

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [userInstruction, setUserInstruction] = useState('')
  const [addMode, setAddMode] = useState<'child' | 'sibling'>('child')
  const [regeneratingIdx, setRegeneratingIdx] = useState<number | null>(null)

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)

  // 選択ノードの親ノード ID 一覧（兄弟モードの有効判定と追加処理に使用）
  const parentNodeIds = edges
    .filter((e) => selectedNode && e.target === selectedNode.id)
    .map((e) => e.source)
  const hasParent = parentNodeIds.length > 0

  /** generateSuggestions に渡す共通引数を組み立てる */
  const buildBaseRequest = useCallback(() => {
    if (!selectedNode) return null

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

    return {
      apiKey,
      model: aiModel,
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
    nodes,
    parentNodeIds,
    apiKey,
    aiModel,
    suggestionCount,
    categories,
    userInstruction,
    addMode,
  ])

  const handleFetch = useCallback(async () => {
    if (!selectedNode || !apiKey) {
      setError(
        apiKey ? 'ノードが選択されていません' : 'APIキーが設定されていません。設定画面から入力してください。',
      )
      return
    }
    setError(null)
    setAILoading(true)
    setAISuggestions([])
    setSelected(new Set())
    try {
      const req = buildBaseRequest()
      if (!req) return
      const suggestions = await generateSuggestions(req)
      const existingTitles = new Set(nodes.map((n) => n.data.title.trim().toLowerCase()))
      const newSuggestions = suggestions.filter(
        (s) => !existingTitles.has(s.text.trim().toLowerCase()),
      )
      setAISuggestions(newSuggestions)
      setSelected(new Set(newSuggestions.map((_, i) => i)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました')
    } finally {
      setAILoading(false)
    }
  }, [selectedNode, apiKey, nodes, buildBaseRequest, setAILoading, setAISuggestions])

  /** 指定インデックスの提案だけを再生成する */
  const handleRegenerate = useCallback(
    async (idx: number) => {
      if (!selectedNode || !apiKey || regeneratingIdx !== null) return
      setRegeneratingIdx(idx)
      try {
        const baseReq = buildBaseRequest()
        if (!baseReq) return
        const excludedTexts = aiSuggestions.filter((_, i) => i !== idx).map((s) => s.text)
        const newSuggestions = await generateSuggestions({
          ...baseReq,
          count: 1,
          excludedTexts,
        })
        if (newSuggestions.length > 0) {
          setAISuggestions(aiSuggestions.map((s, i) => (i === idx ? newSuggestions[0] : s)))
        }
      } catch (e) {
        addToast(e instanceof Error ? e.message : '再生成に失敗しました', 'error')
      } finally {
        setRegeneratingIdx(null)
      }
    },
    [selectedNode, apiKey, aiSuggestions, regeneratingIdx, buildBaseRequest, setAISuggestions, addToast],
  )

  const handleAddSelected = useCallback(() => {
    if (!selectedNode) return
    const selectedSuggestions = aiSuggestions.filter((_, i) => selected.has(i))
    if (selectedSuggestions.length === 0) return

    // 位置計算の基準ノード：兄弟モードは最初の親、子モードは選択ノード
    const anchorId = addMode === 'sibling' && parentNodeIds.length > 0 ? parentNodeIds[0] : null
    const anchorNode =
      anchorId ? (nodes.find((n) => n.id === anchorId) ?? selectedNode) : selectedNode

    const positions = calcSuggestionPositions(
      anchorNode.position.x,
      anchorNode.position.y,
      selectedSuggestions.length,
      nodes,
    )

    selectedSuggestions.forEach((suggestion, idx) => {
      const { x, y } = positions[idx]
      const cat = suggestion.categoryId ? getCategoryById(suggestion.categoryId) : undefined
      const nodeColor = cat?.color ?? '#f3f4ff'
      const newId = addNode(suggestion.text, x, y, 'ai', nodeColor, suggestion.categoryId)

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

    const addedTexts = new Set(selectedSuggestions.map((s) => s.text))
    setAISuggestions(aiSuggestions.filter((s) => !addedTexts.has(s.text)))
    setAIPanelOpen(false)
    setSelected(new Set())
  }, [
    selectedNode,
    aiSuggestions,
    selected,
    nodes,
    addMode,
    parentNodeIds,
    addNode,
    onConnect,
    getCategoryById,
    setAIPanelOpen,
    setAISuggestions,
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <div>
              <h2 className="text-sm font-semibold text-gray-800">AIアイデア拡張</h2>
              {selectedNode && (
                <p className="text-xs text-gray-400 truncate max-w-48">
                  "{selectedNode.data.title}"
                </p>
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
          {/* 選択ノードの内容 */}
          {selectedNode && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs space-y-1">
              <p className="font-semibold text-gray-700 leading-snug">{selectedNode.data.title}</p>
              {selectedNode.data.body && (
                <p className="text-gray-500 whitespace-pre-wrap leading-relaxed max-h-24 overflow-y-auto">
                  {selectedNode.data.body}
                </p>
              )}
            </div>
          )}

          {/* 追加先モード切替 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 flex-shrink-0">追加先</span>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              <button
                onClick={() => setAddMode('child')}
                className={`px-3 py-1.5 transition-colors ${
                  addMode === 'child'
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                子ノード
              </button>
              <button
                onClick={() => setAddMode('sibling')}
                disabled={!hasParent}
                title={!hasParent ? 'このノードは親を持ちません' : undefined}
                className={`px-3 py-1.5 transition-colors border-l border-gray-200 ${
                  addMode === 'sibling'
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                兄弟ノード
              </button>
            </div>
          </div>

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
            <span className="text-xs font-medium text-gray-700 w-5 text-right">
              {suggestionCount}
            </span>
          </div>

          {/* フリーテキスト指示入力 */}
          <textarea
            value={userInstruction}
            onChange={(e) => setUserInstruction(e.target.value)}
            placeholder="どのようなアイデアが欲しいですか？（例: 実装コストが低いもの）"
            rows={2}
            className="w-full text-xs p-2.5 border border-gray-200 rounded-lg resize-none placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-400 focus:border-primary-400"
          />

          {/* エラー */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 whitespace-pre-wrap">
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
          {!isAILoading && aiSuggestions.length > 0 && (
            <>
              <p className="text-xs text-gray-400">
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
                          ? 'border-primary-300 bg-primary-50'
                          : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(idx)}
                        onChange={() => {}}
                        className="mt-0.5 accent-primary-600 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700">{suggestion.text}</p>
                        {cat && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span
                              className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full border border-gray-200"
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
                        className="p-1 mt-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 transition-colors"
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
            <div className="text-center py-8 text-sm text-gray-400">
              <span className="text-3xl mb-2 block">💡</span>
              ボタンを押してAIにアイデアを提案してもらいましょう
            </div>
          )}
        </div>

        {/* フッターボタン */}
        <div className="px-5 py-4 border-t border-gray-100 space-y-2">
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
            className="w-full py-2.5 border border-primary-300 text-primary-600 text-sm font-medium rounded-xl hover:bg-primary-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {aiSuggestions.length > 0 ? '再生成' : 'AIに提案してもらう'}
          </button>
        </div>
      </div>
    </div>
  )
}
