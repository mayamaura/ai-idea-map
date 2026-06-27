import { useState, useRef, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useUIStore } from '../../stores/uiStore'
import { useMapStore } from '../../stores/mapStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { chatWithMap, toFriendlyAIError } from '../../services/claudeService'
import type { ChatMessage, ChatAction, MapContext } from '../../types'
import type { Node } from '@xyflow/react'
import type { IdeaNodeData } from '../../types'

const QUICK_QUESTIONS = [
  { label: '深掘り', template: (t: string) => `「${t}」をもっと深掘りして` },
  { label: '反論', template: (t: string) => `「${t}」の反論や懸念点を挙げて` },
  { label: 'アクション化', template: (t: string) => `「${t}」を具体的なアクションに落とし込んで` },
  { label: '関連提案', template: (t: string) => `「${t}」に関連するアイデアを提案して` },
  { label: '次のステップ', template: (t: string) => `「${t}」の次のステップは？` },
]

function detectMention(
  text: string,
  cursorPos: number,
): { query: string; startIndex: number } | null {
  const textBefore = text.slice(0, cursorPos)
  const match = textBefore.match(/@(\S*)$/)
  if (!match) return null
  return { query: match[1], startIndex: textBefore.length - match[0].length }
}

export function AIChatPanel() {
  const {
    isChatPanelOpen,
    setChatPanelOpen,
    chatMessages,
    addChatMessage,
    isChatLoading,
    setChatLoading,
    clearChatHistory,
    updateLastChatMessage,
    selectedNodeId,
    addToast,
    mapTitle,
    setSettingsOpen,
  } = useUIStore()
  const { nodes, edges, addNode, onConnect, updateNodeTitle } = useMapStore()
  const { apiKey, aiModel, categories, getCategoryById } = useSettingsStore()

  const [input, setInput] = useState('')
  const [mentionState, setMentionState] = useState<{ query: string; startIndex: number } | null>(
    null,
  )
  const [mentionedNodeIds, setMentionedNodeIds] = useState<string[]>([])
  const [selectedMentionIdx, setSelectedMentionIdx] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) as
    | Node<IdeaNodeData>
    | undefined

  const filteredNodes = mentionState
    ? (nodes as Node<IdeaNodeData>[]).filter((n) =>
        n.data.title.toLowerCase().includes(mentionState.query.toLowerCase()),
      )
    : []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, isChatLoading])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInput(val)
    const cursor = e.target.selectionStart ?? val.length
    const mention = detectMention(val, cursor)
    setMentionState(mention)
    setSelectedMentionIdx(0)
  }

  const insertMention = (node: Node<IdeaNodeData>) => {
    if (!mentionState) return
    const before = input.slice(0, mentionState.startIndex)
    const after = input.slice(mentionState.startIndex + 1 + mentionState.query.length)
    setInput(`${before}@${node.data.title}${after}`)
    setMentionState(null)
    setMentionedNodeIds((prev) => [...prev.filter((id) => id !== node.id), node.id])
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionState && filteredNodes.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedMentionIdx((i) => Math.min(i + 1, filteredNodes.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedMentionIdx((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(filteredNodes[selectedMentionIdx])
        return
      }
      if (e.key === 'Escape') {
        setMentionState(null)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !mentionState) {
      e.preventDefault()
      void handleSend()
    }
  }

  const buildMapContext = (): MapContext => ({
    mapTitle,
    nodes: (nodes as Node<IdeaNodeData>[]).map((n) => ({
      id: n.id,
      title: n.data.title,
      body: n.data.body,
      categoryId: n.data.categoryId,
    })),
    edges: edges.map((e) => ({
      source: e.source,
      target: e.target,
      label: typeof e.label === 'string' ? e.label : undefined,
    })),
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
  })

  const handleStop = () => {
    abortRef.current?.abort()
    setChatLoading(false)
  }

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || isChatLoading || !apiKey) return

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    }
    addChatMessage(userMsg)
    setInput('')
    setMentionState(null)
    const currentMentionedIds = [...mentionedNodeIds]
    setMentionedNodeIds([])

    // 空 assistant メッセージを先行追加してストリーミング中に内容を差し替える
    const assistantMsgId = uuidv4()
    addChatMessage({
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    })
    setChatLoading(true)

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const { content: aiContent, actions } = await chatWithMap(
        {
          apiKey,
          model: aiModel,
          messages: [...chatMessages, userMsg],
          mapContext: buildMapContext(),
          mentionedNodeIds: currentMentionedIds,
        },
        (partial) => {
          updateLastChatMessage(partial)
        },
        ctrl.signal,
      )

      // 最終 content と actions を末尾 assistant メッセージへ反映する
      // actions はストリーミングコールバックでは渡せないため完了後にまとめてセット
      useUIStore.setState((state) => {
        const msgs = state.chatMessages
        if (msgs.length === 0 || msgs[msgs.length - 1].role !== 'assistant') return {}
        const updated = [...msgs]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: aiContent,
          actions,
        }
        return { chatMessages: updated }
      })
    } catch (e) {
      // abort は正常操作なのでトーストを出さない
      if (ctrl.signal.aborted) {
        // nothing – message already has partial content
      } else {
        addToast(toFriendlyAIError(e), 'error')
      }
    } finally {
      setChatLoading(false)
      abortRef.current = null
    }
  }

  const handleAction = (action: ChatAction) => {
    if (action.type === 'addNode') {
      const parent = action.sourceNodeId
        ? nodes.find((n) => n.id === action.sourceNodeId)
        : null
      const x = parent ? parent.position.x + 220 : 100
      const y = parent ? parent.position.y : 100
      const cat = action.categoryId ? getCategoryById(action.categoryId) : undefined
      const newId = addNode(action.label, x, y, 'ai', cat?.color ?? '#ffffff', action.categoryId, action.body)
      if (action.sourceNodeId) {
        onConnect({ source: action.sourceNodeId, target: newId, sourceHandle: null, targetHandle: null })
      }
      addToast(`「${action.label}」を追加しました`, 'success')
    } else if (action.type === 'connectNodes' && action.sourceNodeId && action.targetNodeId) {
      onConnect({
        source: action.sourceNodeId,
        target: action.targetNodeId,
        sourceHandle: null,
        targetHandle: null,
      })
      addToast('ノードを接続しました', 'success')
    } else if (action.type === 'updateNode' && action.sourceNodeId) {
      updateNodeTitle(action.sourceNodeId, action.label)
      addToast('ノードを更新しました', 'success')
    }
  }

  if (!isChatPanelOpen) return null

  return (
    <>
      {/* モバイル限定の背景マスク。PC ではキャンバス操作を妨げないよう非表示にする */}
      <div className="sm:hidden fixed inset-0 bg-black/30 z-30" onClick={() => setChatPanelOpen(false)} />
      <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl z-40 flex flex-col">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">AIチャット</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            ({nodes.length}ノード)
          </span>
        </div>
        <div className="flex items-center gap-1">
          {chatMessages.length > 0 && (
            <button
              onClick={clearChatHistory}
              className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="会話履歴をクリア"
            >
              クリア
            </button>
          )}
          <button
            onClick={() => setChatPanelOpen(false)}
            className="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* APIキー未設定時の空状態 */}
      {!apiKey && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
          <span className="text-4xl">🔑</span>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            Claude APIキーが必要です
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            AI機能を使うには Anthropic の APIキーを設定してください
          </p>
          <button
            onClick={() => {
              setChatPanelOpen(false)
              setSettingsOpen(true)
            }}
            className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
          >
            設定を開く
          </button>
        </div>
      )}

      {/* APIキー設定済み時の通常UI */}
      {apiKey && (
        <>
          {/* クイック質問チップ */}
          {selectedNode && (
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
              <p className="text-xs text-blue-600 dark:text-blue-400 mb-1.5 font-medium truncate">
                「{selectedNode.data.title}」について:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q.label}
                    onClick={() => void handleSend(q.template(selectedNode.data.title))}
                    disabled={isChatLoading}
                    className="px-2.5 py-1 text-xs bg-white dark:bg-gray-700 border border-blue-200 dark:border-blue-600 text-blue-600 dark:text-blue-300 rounded-full hover:bg-blue-50 dark:hover:bg-blue-800 transition-colors disabled:opacity-50"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* メッセージ一覧 */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {chatMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 dark:text-gray-500 py-8">
                <svg
                  className="w-10 h-10 mb-3 opacity-40"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <p className="text-sm">マップについて何でも聞いてください</p>
                <p className="text-xs mt-1 opacity-70">@ノード名 で特定ノードを参照できます</p>
              </div>
            )}

            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white rounded-tr-sm'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-tl-sm'
                  }`}
                >
                  {msg.content || (
                    // 最初のトークンが届くまでのローディングドット
                    <div className="flex gap-1 items-center py-0.5">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                </div>

                {/* アクションボタン */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-1.5 flex flex-col gap-1.5 w-full max-w-[88%]">
                    {msg.actions.map((action, i) => (
                      <button
                        key={i}
                        onClick={() => handleAction(action)}
                        className="flex items-start gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg text-left hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors"
                      >
                        <svg
                          className="w-3.5 h-3.5 mt-0.5 text-blue-500 flex-shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-blue-700 dark:text-blue-300 truncate">
                            {action.label}
                          </p>
                          {action.reason && (
                            <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">
                              {action.reason}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* 入力エリア */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-3">
            <div className="relative">
              {/* @メンション ドロップダウン */}
              {mentionState && filteredNodes.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-40 overflow-y-auto z-10">
                  {filteredNodes.slice(0, 8).map((node, i) => (
                    <button
                      key={node.id}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        insertMention(node)
                      }}
                      className={`w-full text-left px-3 py-1.5 text-sm truncate transition-colors ${
                        i === selectedMentionIdx
                          ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                          : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {node.data.title}
                    </button>
                  ))}
                </div>
              )}

              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="@ノード名で参照、Enter で送信..."
                disabled={isChatLoading}
                rows={2}
                className="w-full resize-none rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600 disabled:opacity-50"
              />

              {/* 送信ボタン / 停止ボタン */}
              {isChatLoading ? (
                <button
                  onClick={handleStop}
                  className="absolute right-2 bottom-2 p-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                  title="生成を停止"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={() => void handleSend()}
                  disabled={!input.trim() || isChatLoading}
                  className="absolute right-2 bottom-2 p-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
              {isChatLoading ? '■ボタンで停止' : 'Shift+Enter で改行 / Enter で送信'}
            </p>
          </div>
        </>
      )}
    </div>
    </>
  )
}
