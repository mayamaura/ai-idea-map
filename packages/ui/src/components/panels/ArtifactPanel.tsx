import { useState, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { getPlatform } from '@ideamap/platform'
import {
  useUIStore,
  useMapStore,
  useSettingsStore,
  generateArtifactFromMap,
  toFriendlyAIError,
  type ArtifactFormat,
  type MapContext,
} from '@ideamap/core'
import { ApiKeyRequired } from '../common/ApiKeyRequired'
import { PanelHeader } from '../common/PanelHeader'
import { useActiveProvider } from '../../hooks/useActiveProvider'
import { useSubtreeNodeIds } from '../../hooks/useSubtreeNodeIds'
import { useCancellableAIRequest } from '../../hooks/useCancellableAIRequest'

const FORMAT_OPTIONS: { id: ArtifactFormat; label: string; icon: string }[] = [
  { id: 'document', label: 'ドキュメント', icon: '📄' },
  { id: 'slides', label: 'スライド (Marp)', icon: '🖼️' },
  { id: 'tasks', label: 'タスクリスト', icon: '✅' },
]

export function ArtifactPanel() {
  const { isArtifactPanelOpen, setArtifactPanelOpen, mapTitle, addToast, setSettingsOpen } = useUIStore(
    useShallow((s) => ({
      isArtifactPanelOpen: s.isArtifactPanelOpen,
      setArtifactPanelOpen: s.setArtifactPanelOpen,
      mapTitle: s.mapTitle,
      addToast: s.addToast,
      setSettingsOpen: s.setSettingsOpen,
    }))
  )
  const categories = useSettingsStore((s) => s.categories)
  const { provider, isReady, providerId } = useActiveProvider()
  const subtreeIds = useSubtreeNodeIds()

  const [format, setFormat] = useState<ArtifactFormat>('document')
  // サブツリーがあるときの既定は「サブツリーのみ」。ユーザーがトグルでマップ全体に切り替えられる
  const [useWholeMap, setUseWholeMap] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [generatedText, setGeneratedText] = useState('')
  const { run, cancel } = useCancellableAIRequest(setIsLoading)

  const notReadyMessage =
    providerId === 'ollama' ? '使用するOllamaモデルが選択されていません' : 'APIキーが設定されていません'

  const handleGenerate = useCallback(async () => {
    if (!isReady) {
      addToast(notReadyMessage, 'error')
      return
    }
    setGeneratedText('')
    try {
      await run(async (signal) => {
        const { nodes, edges } = useMapStore.getState()
        const mapContext: MapContext = {
          mapTitle,
          nodes: nodes.map((n) => ({ id: n.id, title: n.data.title, body: n.data.body, categoryId: n.data.categoryId })),
          edges: edges.map((e) => ({ source: e.source, target: e.target, label: typeof e.label === 'string' ? e.label : undefined })),
          categories: categories.map((c) => ({ id: c.id, name: c.name })),
        }
        const focusNodeIds = subtreeIds && !useWholeMap ? [...subtreeIds] : undefined
        const result = await generateArtifactFromMap(
          { provider, mapContext, format, focusNodeIds },
          (partial) => setGeneratedText(partial),
          signal,
        )
        setGeneratedText(result)
      })
    } catch (e) {
      addToast(toFriendlyAIError(e), 'error')
    }
  }, [isReady, notReadyMessage, provider, mapTitle, categories, format, subtreeIds, useWholeMap, run, addToast])

  const handleCopy = useCallback(async () => {
    await getPlatform().system.copyToClipboard(generatedText)
    addToast('コピーしました', 'success')
  }, [generatedText, addToast])

  const handleSave = useCallback(async () => {
    const blob = new Blob([generatedText], { type: 'text/markdown' })
    await getPlatform().file.exportBlob(`${mapTitle}-${format}.md`, blob)
    addToast('.mdファイルとして保存しました', 'success')
  }, [generatedText, mapTitle, format, addToast])

  if (!isArtifactPanelOpen) return null

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setArtifactPanelOpen(false)} />
      <div className="relative ml-auto w-full sm:max-w-md h-full bg-white dark:bg-gray-800 shadow-2xl flex flex-col overflow-hidden">
        <PanelHeader
          icon="📝"
          title="AI成果物生成"
          onClose={() => setArtifactPanelOpen(false)}
          closeAriaLabel="閉じる"
        />

        {!isReady ? (
          <ApiKeyRequired
            providerId={providerId}
            onOpenSettings={() => {
              setArtifactPanelOpen(false)
              setSettingsOpen(true)
            }}
          />
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* 形式選択 */}
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">形式</p>
              <div className="flex gap-2">
                {FORMAT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setFormat(opt.id)}
                    disabled={isLoading}
                    className={`flex-1 py-2 text-xs rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      format === opt.id
                        ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-900/30 dark:border-primary-500 dark:text-primary-300'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="block text-base leading-none mb-1">{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 対象範囲 */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 flex items-center justify-between">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {subtreeIds && !useWholeMap
                  ? `選択中のノードから ${subtreeIds.size} 件を対象`
                  : 'マップ全体を対象'}
              </p>
              {subtreeIds && (
                <button
                  onClick={() => setUseWholeMap((v) => !v)}
                  disabled={isLoading}
                  className="text-xs text-primary-600 dark:text-primary-400 underline hover:no-underline disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {useWholeMap ? '選択サブツリーに戻す' : 'マップ全体に切替'}
                </button>
              )}
            </div>

            {/* 生成ボタン */}
            <button
              onClick={() => void handleGenerate()}
              disabled={isLoading}
              className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'AI が生成中...' : '成果物を生成'}
            </button>

            {isLoading && (
              <div className="flex justify-center">
                <button
                  onClick={cancel}
                  className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            )}

            {/* ストリーミング / 結果プレビュー */}
            {generatedText && (
              <div className="space-y-2">
                <pre className="whitespace-pre-wrap break-words text-xs font-mono p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-200 max-h-96 overflow-y-auto">
                  {generatedText}
                </pre>

                {!isLoading && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => void handleCopy()}
                      className="flex-1 py-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      コピー
                    </button>
                    <button
                      onClick={() => void handleSave()}
                      className="flex-1 py-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      .mdで保存
                    </button>
                  </div>
                )}
              </div>
            )}

            {!generatedText && !isLoading && (
              <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
                <span className="text-3xl mb-3 block">📝</span>
                マップからドキュメント・スライド・タスクリストを生成します
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
