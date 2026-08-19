import { useState, useRef, useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import {
  useMapStore,
  useUIStore,
  useSettingsStore,
  extractMapFromText,
  buildMapFragmentFromExtracted,
  toFriendlyAIError,
  CURRENT_MAP_FILE_VERSION,
  type IdeaNodeData,
  type MapFile,
} from '@ideamap/core'
import type { Node } from '@xyflow/react'
import { getPlatform } from '@ideamap/platform'
import {
  exportMapAsImage,
  exportAsJson,
  exportAsMarkdown,
  importFromJson,
  indentedTextToNodes,
} from '../../services/exportService'
import { useActiveProvider } from '../../hooks/useActiveProvider'
import { useCancellableAIRequest } from '../../hooks/useCancellableAIRequest'
import { ExportTab } from './exportImport/ExportTab'
import { ImportTab, type BrainDumpTarget } from './exportImport/ImportTab'
import { ShareTab } from './exportImport/ShareTab'

type Tab = 'export' | 'import' | 'share'

export interface ExportImportPanelProps {
  /**
   * 共有URLの生成。ブラウザのURLバー前提の Web版専用機能なので実装は apps/web が渡す。
   * 未指定のプラットフォーム（デスクトップ版）では、共有タブが代替手段（JSONファイル）の案内になる。
   */
  onGenerateShareUrl?: (mapFile: MapFile) => { url: string; tooLarge: boolean }
}

export function ExportImportPanel({ onGenerateShareUrl }: ExportImportPanelProps = {}) {
  const {
    isExportPanelOpen,
    setExportPanelOpen,
    addToast,
    mapTitle,
    setMapTitle,
    currentMapId,
    openConfirmDialog,
    setRenderAllNodes,
    setSettingsOpen,
    setCurrentFileId,
    setCurrentMapId,
    setPresentationNodeIds,
    setSaveStatus,
    setArtifactPanelOpen,
  } = useUIStore()
  const { nodes, edges, getSerializedNodes, getSerializedEdges, loadFromSerialized, reset } = useMapStore()
  const { getViewport } = useReactFlow()
  const categories = useSettingsStore((s) => s.categories)
  const { provider, isReady, providerId } = useActiveProvider()

  const [tab, setTab] = useState<Tab>('export')
  const [imageMode, setImageMode] = useState<'current' | 'full'>('full')
  const [transparent, setTransparent] = useState(false)
  const [highDpi, setHighDpi] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [shareUrlTooLarge, setShareUrlTooLarge] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [urlCopied, setUrlCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [brainDumpEnabled, setBrainDumpEnabled] = useState(false)
  const [brainDumpText, setBrainDumpText] = useState('')
  const [brainDumpTarget, setBrainDumpTarget] = useState<BrainDumpTarget>('append')
  const [isBrainDumpLoading, setIsBrainDumpLoading] = useState(false)
  const { run: runBrainDump, cancel: cancelBrainDump } = useCancellableAIRequest(setIsBrainDumpLoading)

  const getMapFile = useCallback((): MapFile => ({
    version: CURRENT_MAP_FILE_VERSION,
    // エクスポート時は現在の mapId を保持（なければ空文字でフォールバック）
    mapId: currentMapId ?? '',
    title: mapTitle,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: getSerializedNodes(),
    edges: getSerializedEdges(),
  }), [currentMapId, mapTitle, getSerializedNodes, getSerializedEdges])

  if (!isExportPanelOpen) return null

  const handleImageExport = async (format: 'png' | 'svg') => {
    setIsExporting(true)
    // onlyRenderVisibleElements で画面外ノードがDOMから外れるとマップ全体エクスポートが欠けるため、
    // 撮影前に全描画モードに切り替えてReact Flowがすべてのノードを描画するのを待つ
    setRenderAllNodes(true)
    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
      await exportMapAsImage(format, imageMode, {
        transparent,
        highDpi,
        nodes: nodes as Node<IdeaNodeData>[],
        currentViewport: getViewport(),
        title: mapTitle,
      })
      addToast(`${format.toUpperCase()}でエクスポートしました`, 'success')
    } catch {
      addToast('エクスポートに失敗しました', 'error')
    } finally {
      setRenderAllNodes(false)
      setIsExporting(false)
    }
  }

  const handleJsonExport = () => {
    exportAsJson(getMapFile())
    addToast('JSONでエクスポートしました', 'success')
  }

  const handleMarkdownExport = () => {
    exportAsMarkdown(nodes as Node<IdeaNodeData>[], edges, mapTitle)
    addToast('Markdownでエクスポートしました', 'success')
  }

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { file: data, warning } = await importFromJson(file)
      openConfirmDialog({
        title: 'マップのインポート',
        message: `「${data.title}」をインポートします。現在のマップを置き換えますか？`,
        confirmLabel: 'インポート',
        danger: true,
        onConfirm: () => {
          loadFromSerialized(data.nodes, data.edges)
          setMapTitle(data.title)
          addToast(`「${data.title}」をインポートしました`, 'success')
          if (warning) addToast(warning, 'info')
        },
      })
    } catch (err) {
      addToast((err as Error).message, 'error')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handlePasteImport = () => {
    if (!pasteText.trim()) return
    const { nodes: newNodes, edges: newEdges } = indentedTextToNodes(pasteText, 100, 100)
    if (newNodes.length === 0) {
      addToast('有効なテキストがありません', 'error')
      return
    }
    const currentNodes = getSerializedNodes()
    const currentEdges = getSerializedEdges()
    loadFromSerialized([...currentNodes, ...newNodes], [...currentEdges, ...newEdges])
    setPasteText('')
    addToast(`${newNodes.length}個のノードを追加しました`, 'success')
  }

  const handleBrainDumpExtract = async () => {
    if (!brainDumpText.trim()) return
    if (!isReady) {
      addToast(providerId === 'ollama' ? '使用するOllamaモデルが選択されていません' : 'APIキーが設定されていません', 'error')
      return
    }
    try {
      await runBrainDump(async (signal) => {
        const currentNodes = getSerializedNodes()
        const existingNodes = brainDumpTarget === 'append'
          ? currentNodes.map((n) => ({ id: n.id, title: n.title }))
          : undefined

        const extracted = await extractMapFromText(
          { provider, text: brainDumpText, categories, existingNodes },
          signal
        )
        const fragment = await buildMapFragmentFromExtracted(
          extracted,
          brainDumpTarget === 'append' ? { nodes: currentNodes } : undefined
        )
        if (fragment.nodes.length === 0) {
          addToast('構造を抽出できませんでした', 'error')
          return
        }

        if (brainDumpTarget === 'append') {
          const currentEdges = getSerializedEdges()
          loadFromSerialized([...currentNodes, ...fragment.nodes], [...currentEdges, ...fragment.edges])
        } else {
          // 新規作成フロー（useFileDashboard.startNewMap）と同じ手順で保存先の紐付けをリセットする。
          // ここを省くと「新規マップのつもりが前回開いていたファイルに上書き保存される」事故になる
          reset()
          loadFromSerialized(fragment.nodes, fragment.edges)
          const firstLine = brainDumpText.trim().split('\n')[0]?.trim()
          setMapTitle(firstLine ? firstLine.slice(0, 30) : '新しいマップ')
          setCurrentFileId(null)
          setCurrentMapId(null)
          setPresentationNodeIds([])
          setSaveStatus('unsaved')
        }

        setBrainDumpText('')
        addToast(`${fragment.nodes.length}個のノードを追加しました`, 'success')
      })
    } catch (e) {
      addToast(toFriendlyAIError(e), 'error')
    }
  }

  const handleGenerateShareUrl = () => {
    if (!onGenerateShareUrl) return
    try {
      const { url, tooLarge } = onGenerateShareUrl(getMapFile())
      setShareUrl(url)
      setShareUrlTooLarge(tooLarge)
    } catch {
      addToast('共有URLの生成に失敗しました', 'error')
    }
  }

  const handleCopyUrl = () => {
    void getPlatform().system.copyToClipboard(shareUrl).then(() => {
      setUrlCopied(true)
      addToast('URLをコピーしました', 'success')
      setTimeout(() => setUrlCopied(false), 2000)
    })
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'export',
      label: 'エクスポート',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      ),
    },
    {
      id: 'import',
      label: 'インポート',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      ),
    },
    {
      id: 'share',
      label: '共有',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={() => setExportPanelOpen(false)}
      />

      {/* パネル本体 */}
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-node-enter">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
            エクスポート / インポート
          </h2>
          <button
            onClick={() => setExportPanelOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* タブ */}
        <div className="flex border-b border-gray-100 dark:border-gray-700 px-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* コンテンツ */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {tab === 'export' && (
            <ExportTab
              imageMode={imageMode}
              onImageModeChange={setImageMode}
              transparent={transparent}
              onTransparentChange={setTransparent}
              highDpi={highDpi}
              onHighDpiChange={setHighDpi}
              isExporting={isExporting}
              onExportImage={handleImageExport}
              onExportJson={handleJsonExport}
              onExportMarkdown={handleMarkdownExport}
              onGenerateArtifact={() => { setExportPanelOpen(false); setArtifactPanelOpen(true) }}
            />
          )}

          {tab === 'import' && (
            <ImportTab
              fileInputRef={fileInputRef}
              onFileImport={handleFileImport}
              pasteText={pasteText}
              onPasteTextChange={setPasteText}
              onPasteImport={handlePasteImport}
              brainDumpEnabled={brainDumpEnabled}
              onBrainDumpEnabledChange={setBrainDumpEnabled}
              isReady={isReady}
              providerId={providerId}
              onOpenSettings={() => { setExportPanelOpen(false); setSettingsOpen(true) }}
              brainDumpText={brainDumpText}
              onBrainDumpTextChange={setBrainDumpText}
              isBrainDumpLoading={isBrainDumpLoading}
              brainDumpTarget={brainDumpTarget}
              onBrainDumpTargetChange={setBrainDumpTarget}
              onBrainDumpExtract={() => void handleBrainDumpExtract()}
              onCancelBrainDump={cancelBrainDump}
            />
          )}

          {tab === 'share' && (
            <ShareTab
              canShareUrl={!!onGenerateShareUrl}
              shareUrl={shareUrl}
              shareUrlTooLarge={shareUrlTooLarge}
              urlCopied={urlCopied}
              onGenerate={handleGenerateShareUrl}
              onCopyUrl={handleCopyUrl}
              onReset={() => { setShareUrl(''); setShareUrlTooLarge(false) }}
              onExportJson={handleJsonExport}
            />
          )}
        </div>
      </div>
    </div>
  )
}
