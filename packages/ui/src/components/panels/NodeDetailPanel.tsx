import { useState, useEffect, useCallback, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useUIStore, useMapStore, useSettingsStore, type IdeaNodeData } from '@ideamap/core'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { renderMarkdownSimple } from '../../utils/markdown'

export function NodeDetailPanel() {
  const { isNodeDetailOpen, nodeDetailId, closeNodeDetail, setAIPanelOpen, setPersonaDebatePanelOpen, setSelectedNodeId, openConfirmDialog } = useUIStore(
    useShallow((s) => ({
      isNodeDetailOpen: s.isNodeDetailOpen,
      nodeDetailId: s.nodeDetailId,
      closeNodeDetail: s.closeNodeDetail,
      setAIPanelOpen: s.setAIPanelOpen,
      setPersonaDebatePanelOpen: s.setPersonaDebatePanelOpen,
      setSelectedNodeId: s.setSelectedNodeId,
      openConfirmDialog: s.openConfirmDialog,
    }))
  )
  const { updateNodeTitle, updateNodeBody, updateNodeCategory, deleteNode } = useMapStore(
    useShallow((s) => ({
      updateNodeTitle: s.updateNodeTitle,
      updateNodeBody: s.updateNodeBody,
      updateNodeCategory: s.updateNodeCategory,
      deleteNode: s.deleteNode,
    }))
  )
  const { categories, getCategoryById } = useSettingsStore(
    useShallow((s) => ({ categories: s.categories, getCategoryById: s.getCategoryById }))
  )

  // nodes 全体ではなく対象ノードだけを購読し、他ノードのドラッグで再描画しない
  const node = useMapStore((s) => s.nodes.find((n) => n.id === nodeDetailId))
  const nodeData = node?.data as IdeaNodeData | undefined

  const [titleInput, setTitleInput] = useState('')
  const [bodyInput, setBodyInput] = useState('')
  const [isPreview, setIsPreview] = useState(true)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  // 破棄して閉じるとき、入力欄の DOM 削除に伴う blur で保存が走るのを防ぐ
  const skipBlurCommit = useRef(false)

  useEffect(() => {
    if (nodeData) {
      setTitleInput(nodeData.title)
      setBodyInput(nodeData.body ?? '')
    }
  }, [nodeDetailId, nodeData?.title, nodeData?.body])

  useEffect(() => {
    if (isNodeDetailOpen && titleRef.current) {
      skipBlurCommit.current = false
      titleRef.current.focus()
      titleRef.current.select()
    }
  }, [isNodeDetailOpen])

  useFocusTrap(panelRef, isNodeDetailOpen)

  // 未コミットの編集があるか（blur 済みの変更はストアに反映されるため差分にならない）
  const isDirty =
    Boolean(nodeData) &&
    (titleInput !== (nodeData?.title ?? '') || bodyInput !== (nodeData?.body ?? ''))

  // blur が走らない閉じ方（Ctrl+Enter・×ボタン）に対応するため閉じ処理を集約
  const commitAndClose = useCallback(() => {
    if (nodeDetailId) {
      if (titleInput.trim()) updateNodeTitle(nodeDetailId, titleInput.trim())
      updateNodeBody(nodeDetailId, bodyInput)
    }
    closeNodeDetail()
  }, [nodeDetailId, titleInput, bodyInput, updateNodeTitle, updateNodeBody, closeNodeDetail])

  const discardAndClose = useCallback(() => {
    skipBlurCommit.current = true
    closeNodeDetail()
  }, [closeNodeDetail])

  // Esc・背景クリックは「閉じる」操作として破棄で統一する（IdeaNode のインライン編集と同じ）。
  // ただし未コミットの編集がある場合だけ取り違えを防ぐ確認を挟む
  const requestClose = useCallback(() => {
    if (!isDirty) {
      discardAndClose()
      return
    }
    // 確認ダイアログへフォーカスが移る際の blur で保存されるのを先回りして止める。
    // 「保存して閉じる」を選んだ場合は commitAndClose が明示的に書き込むため保存は失われない
    skipBlurCommit.current = true
    openConfirmDialog({
      title: '編集内容を破棄しますか？',
      message: '入力中の変更はまだ保存されていません。破棄して閉じますか？',
      confirmLabel: '破棄して閉じる',
      danger: true,
      onConfirm: closeNodeDetail,
      onCancel: () => {
        skipBlurCommit.current = false
      },
      secondaryAction: { label: '保存して閉じる', onClick: commitAndClose },
    })
  }, [isDirty, discardAndClose, commitAndClose, closeNodeDetail, openConfirmDialog])

  // Esc と本文 Ctrl+Enter のキー処理
  useEffect(() => {
    if (!isNodeDetailOpen) return
    const onKey = (e: KeyboardEvent) => {
      // 破棄確認ダイアログ表示中の Esc はダイアログ側に任せる
      if (useUIStore.getState().confirmDialog) return
      if (e.key === 'Escape') {
        e.preventDefault()
        requestClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isNodeDetailOpen, requestClose])

  const handleTitleBlur = useCallback(() => {
    if (skipBlurCommit.current) return
    if (nodeDetailId && titleInput.trim()) {
      updateNodeTitle(nodeDetailId, titleInput.trim())
    }
  }, [nodeDetailId, titleInput, updateNodeTitle])

  const handleBodyBlur = useCallback(() => {
    if (skipBlurCommit.current) return
    if (nodeDetailId) {
      updateNodeBody(nodeDetailId, bodyInput)
    }
  }, [nodeDetailId, bodyInput, updateNodeBody])

  const handleBodyKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl+Enter で本文を保存して閉じる
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        commitAndClose()
      }
    },
    [commitAndClose]
  )

  const handleCategorySelect = useCallback(
    (categoryId: string) => {
      if (!nodeDetailId) return
      const cat = getCategoryById(categoryId)
      if (!cat) return
      updateNodeCategory(nodeDetailId, categoryId, cat.color)
      setShowCategoryPicker(false)
    },
    [nodeDetailId, getCategoryById, updateNodeCategory]
  )

  const handleDelete = useCallback(() => {
    if (nodeDetailId) {
      deleteNode(nodeDetailId)
      closeNodeDetail()
    }
  }, [nodeDetailId, deleteNode, closeNodeDetail])

  const handleAIExpand = useCallback(() => {
    if (nodeDetailId) {
      setSelectedNodeId(nodeDetailId)
      setAIPanelOpen(true)
    }
  }, [nodeDetailId, setSelectedNodeId, setAIPanelOpen])

  const handlePersonaDebate = useCallback(() => {
    if (nodeDetailId) {
      setSelectedNodeId(nodeDetailId)
      setPersonaDebatePanelOpen(true)
    }
  }, [nodeDetailId, setSelectedNodeId, setPersonaDebatePanelOpen])

  if (!isNodeDetailOpen || !node || !nodeData) return null

  const currentCategory = nodeData.categoryId ? getCategoryById(nodeData.categoryId) : undefined

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      // click ではなく mousedown で閉じる。click まで待つと先に入力欄の blur が走り、
      // 破棄を選ぶ前に変更が保存されてしまうため
      onMouseDown={requestClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="node-detail-title"
        className="bg-white dark:bg-gray-800 w-full sm:max-w-lg max-h-[90vh] h-full sm:h-auto sm:rounded-2xl shadow-2xl flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            {nodeData.createdBy === 'ai' && (
              <span className="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">✦</span>
            )}
            <h2 id="node-detail-title" className="text-sm font-semibold text-gray-800 dark:text-gray-100">ノード詳細</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleAIExpand}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-primary-600 dark:text-primary-400 font-medium hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
            >
              <span>✦</span>
              <span>AI拡張</span>
            </button>
            <button
              onClick={handlePersonaDebate}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-primary-600 dark:text-primary-400 font-medium hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
            >
              <span>🎭</span>
              <span>壁打ち</span>
            </button>
            <button
              onClick={commitAndClose}
              title="保存して閉じる"
              aria-label="保存して閉じる"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* タイトル */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium">タイトル</label>
            <input
              ref={titleRef}
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleBlur()
              }}
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          {/* カテゴリ */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium">カテゴリ</label>
            <div className="relative">
              <button
                onClick={() => setShowCategoryPicker((v) => !v)}
                className="w-full flex items-center gap-2.5 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-gray-300 dark:hover:border-gray-500 transition-colors text-left"
                style={{ backgroundColor: currentCategory?.color ?? '#ffffff' }}
              >
                <span className="text-base leading-none">{currentCategory?.icon ?? '○'}</span>
                <span className="text-sm text-gray-800 flex-1">{currentCategory?.name ?? '未分類'}</span>
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showCategoryPicker && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg z-10 overflow-hidden">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategorySelect(cat.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:brightness-95 ${
                        nodeData.categoryId === cat.id ? 'font-medium' : ''
                      }`}
                      style={{ backgroundColor: cat.color }}
                    >
                      <span className="text-base leading-none">{cat.icon}</span>
                      <span className="text-gray-800 flex-1">{cat.name}</span>
                      {nodeData.categoryId === cat.id && (
                        <svg className="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 本文 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">メモ・詳細</label>
              <button
                onClick={() => setIsPreview((v) => !v)}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                {isPreview ? '✏️ 編集' : '👁 プレビュー'}
              </button>
            </div>
            {isPreview ? (
              <div
                className="min-h-32 w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 prose-sm"
                dangerouslySetInnerHTML={{ __html: renderMarkdownSimple(bodyInput) || '<span class="text-gray-400 text-sm">メモなし</span>' }}
              />
            ) : (
              <textarea
                value={bodyInput}
                onChange={(e) => setBodyInput(e.target.value)}
                onBlur={handleBodyBlur}
                onKeyDown={handleBodyKeyDown}
                placeholder="Markdown形式で記述できます（# 見出し、**太字**、- リストなど）"
                rows={8}
                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 resize-none dark:bg-gray-700 dark:text-gray-100 placeholder-gray-400"
              />
            )}
            <p className="text-xs text-gray-400 mt-1">Markdown対応（# 見出し、**太字**、- リスト、`コード`）</p>
          </div>
        </div>

        {/* フッター */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
          <button
            onClick={handleDelete}
            className="w-full py-2 flex items-center justify-center gap-2 text-sm text-red-500 border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            このノードを削除
          </button>
        </div>
      </div>
    </div>
  )
}
