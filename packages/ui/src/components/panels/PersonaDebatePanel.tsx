import { useCallback, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { v4 as uuidv4 } from 'uuid'
import { useReactFlow } from '@xyflow/react'
import {
  useUIStore,
  useMapStore,
  calcSuggestionPositions,
  makeEdge,
  DEFAULT_NODE_COLOR,
  debateNode,
  toFriendlyAIError,
  type IdeaNode,
  type MapContext,
} from '@ideamap/core'
import { ApiKeyRequired } from '../common/ApiKeyRequired'
import { AILoadingIndicator } from '../common/AILoadingIndicator'
import { PanelHeader } from '../common/PanelHeader'
import { useActiveProvider } from '../../hooks/useActiveProvider'
import { useCancellableAIRequest } from '../../hooks/useCancellableAIRequest'

const PRESET_PERSONAS = ['楽観家', '批評家', '顧客', '投資家']

/** 選択されたオピニオンを一意に指すキー（personaIdx-opinionIdx） */
function opinionKey(personaIdx: number, opinionIdx: number): string {
  return `${personaIdx}-${opinionIdx}`
}

export function PersonaDebatePanel() {
  const {
    isPersonaDebatePanelOpen,
    setPersonaDebatePanelOpen,
    selectedNodeId,
    personaDebateResult,
    setPersonaDebateResult,
    personaDebateTargetId,
    setPersonaDebateTargetId,
    isPersonaDebateLoading,
    setPersonaDebateLoading,
    mapTitle,
    setSettingsOpen,
  } = useUIStore(
    useShallow((s) => ({
      isPersonaDebatePanelOpen: s.isPersonaDebatePanelOpen,
      setPersonaDebatePanelOpen: s.setPersonaDebatePanelOpen,
      selectedNodeId: s.selectedNodeId,
      personaDebateResult: s.personaDebateResult,
      setPersonaDebateResult: s.setPersonaDebateResult,
      personaDebateTargetId: s.personaDebateTargetId,
      setPersonaDebateTargetId: s.setPersonaDebateTargetId,
      isPersonaDebateLoading: s.isPersonaDebateLoading,
      setPersonaDebateLoading: s.setPersonaDebateLoading,
      mapTitle: s.mapTitle,
      setSettingsOpen: s.setSettingsOpen,
    }))
  )
  const addNodesWithEdges = useMapStore((s) => s.addNodesWithEdges)
  const selectedNode = useMapStore((s) => s.nodes.find((n) => n.id === selectedNodeId))
  const { provider, isReady, providerId } = useActiveProvider()
  const { fitView } = useReactFlow()

  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set())
  const [customPersonas, setCustomPersonas] = useState<string[]>([])
  const [customInput, setCustomInput] = useState('')
  const [selectedOpinions, setSelectedOpinions] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const { run, cancel } = useCancellableAIRequest(setPersonaDebateLoading)

  const activePersonas = useMemo(
    () => [...selectedPresets, ...customPersonas],
    [selectedPresets, customPersonas],
  )

  const togglePreset = (persona: string) => {
    setSelectedPresets((prev) => {
      const next = new Set(prev)
      if (next.has(persona)) next.delete(persona)
      else next.add(persona)
      return next
    })
  }

  const handleAddCustom = () => {
    const value = customInput.trim()
    if (!value || activePersonas.includes(value)) return
    setCustomPersonas((prev) => [...prev, value])
    setCustomInput('')
  }

  const removeCustom = (persona: string) => {
    setCustomPersonas((prev) => prev.filter((p) => p !== persona))
  }

  const toggleOpinion = (key: string) => {
    setSelectedOpinions((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleDebate = useCallback(async () => {
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
    if (activePersonas.length === 0) {
      setError('ペルソナを1つ以上選んでください')
      return
    }
    setError(null)
    setPersonaDebateResult([])
    setPersonaDebateTargetId(selectedNode.id)
    setSelectedOpinions(new Set())

    try {
      await run(async (signal) => {
        const { nodes, edges } = useMapStore.getState()
        const mapContext: MapContext = {
          mapTitle,
          nodes: nodes.map((n) => ({ id: n.id, title: n.data.title, body: n.data.body, categoryId: n.data.categoryId })),
          edges: edges.map((e) => ({ source: e.source, target: e.target, label: typeof e.label === 'string' ? e.label : undefined })),
          categories: [],
        }
        const result = await debateNode(
          { provider, mapContext, nodeId: selectedNode.id, personas: activePersonas },
          signal,
        )
        setPersonaDebateResult(result)
        const allKeys = new Set<string>()
        result.forEach((p, pi) => p.opinions.forEach((_, oi) => allKeys.add(opinionKey(pi, oi))))
        setSelectedOpinions(allKeys)
      })
    } catch (e) {
      setError(toFriendlyAIError(e))
    }
  }, [selectedNode, isReady, providerId, activePersonas, provider, mapTitle, run, setPersonaDebateResult, setPersonaDebateTargetId])

  const handleAddSelected = useCallback(() => {
    // エッジの接続元は議論を実行したノード。追加時点の選択状態には依存しない
    const { nodes } = useMapStore.getState()
    const targetNode = nodes.find((n) => n.id === personaDebateTargetId)
    if (!targetNode) return
    const chosen: { title: string; body: string }[] = []
    personaDebateResult.forEach((p, pi) => {
      p.opinions.forEach((o, oi) => {
        if (selectedOpinions.has(opinionKey(pi, oi))) chosen.push(o)
      })
    })
    if (chosen.length === 0) return

    const positions = calcSuggestionPositions(targetNode.position.x, targetNode.position.y, chosen.length, nodes)

    const newNodes: IdeaNode[] = chosen.map((op, idx) => ({
      id: uuidv4(),
      type: 'ideaNode',
      position: positions[idx],
      data: { title: op.title, body: op.body || undefined, color: DEFAULT_NODE_COLOR, createdBy: 'ai' },
    }))
    const newEdges = newNodes.map((n) =>
      makeEdge({ source: targetNode.id, target: n.id, sourceHandle: 'right', targetHandle: 'left' })
    )

    addNodesWithEdges(newNodes, newEdges)
    setPersonaDebatePanelOpen(false)
    setPersonaDebateResult([])
    setPersonaDebateTargetId(null)
    setSelectedOpinions(new Set())

    const focusIds = [targetNode.id, ...newNodes.map((n) => n.id)]
    requestAnimationFrame(() => {
      fitView({ nodes: focusIds.map((id) => ({ id })), padding: 0.3, duration: 500 })
    })
  }, [personaDebateTargetId, personaDebateResult, selectedOpinions, addNodesWithEdges, setPersonaDebatePanelOpen, setPersonaDebateResult, setPersonaDebateTargetId, fitView])

  if (!isPersonaDebatePanelOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto">
        <PanelHeader
          icon="🎭"
          title="ペルソナ壁打ち会議"
          subtitle={selectedNode ? `"${selectedNode.data.title}"` : undefined}
          onClose={() => setPersonaDebatePanelOpen(false)}
          closeAriaLabel="閉じる"
        />

        {!isReady ? (
          <ApiKeyRequired
            className="px-5 py-10"
            providerId={providerId}
            onOpenSettings={() => {
              setPersonaDebatePanelOpen(false)
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

              {/* ペルソナ選択 */}
              <div className="space-y-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">ペルソナを選択</p>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_PERSONAS.map((persona) => (
                    <button
                      key={persona}
                      onClick={() => togglePreset(persona)}
                      disabled={isPersonaDebateLoading}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        selectedPresets.has(persona)
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {persona}
                    </button>
                  ))}
                  {customPersonas.map((persona) => (
                    <button
                      key={persona}
                      onClick={() => removeCustom(persona)}
                      disabled={isPersonaDebateLoading}
                      title="削除"
                      className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-full bg-primary-600 text-white border border-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {persona}
                      <span aria-hidden>×</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddCustom()
                      }
                    }}
                    disabled={isPersonaDebateLoading}
                    placeholder="自由入力（例: 高齢のユーザー）"
                    className="flex-1 text-xs p-2 border border-gray-200 dark:border-gray-600 rounded-lg placeholder-gray-400 dark:placeholder-gray-500 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-400 focus:border-primary-400 disabled:opacity-50"
                  />
                  <button
                    onClick={handleAddCustom}
                    disabled={!customInput.trim() || isPersonaDebateLoading}
                    className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    追加
                  </button>
                </div>
              </div>

              {/* エラー */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap">
                  {error}
                </div>
              )}

              {/* ローディング */}
              {isPersonaDebateLoading && (
                <AILoadingIndicator message="意見を集めています..." onCancel={cancel} layout="inline" />
              )}

              {/* 意見リスト */}
              {!isPersonaDebateLoading && personaDebateResult.length > 0 && (
                <>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    採用する意見を選択してください（{selectedOpinions.size}件）
                  </p>
                  <div className="space-y-3">
                    {personaDebateResult.map((p, pi) => (
                      <div key={pi} className="space-y-1.5">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">🎭 {p.persona}</p>
                        {p.opinions.map((o, oi) => {
                          const key = opinionKey(pi, oi)
                          return (
                            <div
                              key={key}
                              onClick={() => toggleOpinion(key)}
                              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                                selectedOpinions.has(key)
                                  ? 'border-primary-300 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/30'
                                  : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedOpinions.has(key)}
                                // 行クリックでも切り替わるため、チェックボックス自身のクリックは伝播を止めて二重トグルを防ぐ
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => toggleOpinion(key)}
                                aria-label={`「${o.title}」を採用する`}
                                className="mt-0.5 accent-primary-600 flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{o.title}</p>
                                {o.body && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{o.body}</p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* 初期状態 */}
              {!isPersonaDebateLoading && personaDebateResult.length === 0 && !error && (
                <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
                  <span className="text-3xl mb-2 block">🎭</span>
                  ペルソナを選んで議論を始めましょう
                </div>
              )}
            </div>

            {/* フッターボタン */}
            <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
              {personaDebateResult.length > 0 && !isPersonaDebateLoading && (
                <button
                  onClick={handleAddSelected}
                  disabled={selectedOpinions.size === 0}
                  className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  選択した意見を子ノードとして追加（{selectedOpinions.size}件）
                </button>
              )}
              <button
                onClick={() => void handleDebate()}
                disabled={isPersonaDebateLoading}
                className="w-full py-2.5 border border-primary-300 dark:border-primary-600 text-primary-600 dark:text-primary-400 text-sm font-medium rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {personaDebateResult.length > 0 ? '議論をやり直す' : '議論を始める'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
