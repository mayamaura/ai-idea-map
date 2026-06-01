import { useState, useRef, useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useMapStore } from '../../stores/mapStore'
import { useUIStore } from '../../stores/uiStore'
import type { IdeaNodeData, MapFile } from '../../types'
import type { Node } from '@xyflow/react'
import {
  exportMapAsImage,
  exportAsJson,
  exportAsMarkdown,
  importFromJson,
  indentedTextToNodes,
  generateShareUrl,
} from '../../services/exportService'

type Tab = 'export' | 'import' | 'share'

export function ExportImportPanel() {
  const { isExportPanelOpen, setExportPanelOpen, addToast, mapTitle, setMapTitle, openConfirmDialog } =
    useUIStore()
  const { nodes, edges, getSerializedNodes, getSerializedEdges, loadFromSerialized } = useMapStore()
  const { getViewport } = useReactFlow()

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

  const getMapFile = useCallback((): MapFile => ({
    version: '1.0',
    title: mapTitle,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: getSerializedNodes(),
    edges: getSerializedEdges(),
  }), [mapTitle, getSerializedNodes, getSerializedEdges])

  if (!isExportPanelOpen) return null

  const handleImageExport = async (format: 'png' | 'svg') => {
    setIsExporting(true)
    try {
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
      const data = await importFromJson(file)
      openConfirmDialog({
        title: 'マップのインポート',
        message: `「${data.title}」をインポートします。現在のマップを置き換えますか？`,
        confirmLabel: 'インポート',
        danger: true,
        onConfirm: () => {
          loadFromSerialized(data.nodes, data.edges)
          setMapTitle(data.title)
          addToast(`「${data.title}」をインポートしました`, 'success')
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

  const handleGenerateShareUrl = () => {
    try {
      const { url, tooLarge } = generateShareUrl(getMapFile())
      setShareUrl(url)
      setShareUrlTooLarge(tooLarge)
    } catch {
      addToast('共有URLの生成に失敗しました', 'error')
    }
  }

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
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
          {/* ─── エクスポートタブ ─── */}
          {tab === 'export' && (
            <>
              {/* 画像オプション */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  画像（PNG / SVG）
                </p>

                {/* モード選択 */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setImageMode('full')}
                    className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
                      imageMode === 'full'
                        ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-900/30 dark:border-primary-500 dark:text-primary-300'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'
                    }`}
                  >
                    マップ全体
                  </button>
                  <button
                    onClick={() => setImageMode('current')}
                    className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
                      imageMode === 'current'
                        ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-900/30 dark:border-primary-500 dark:text-primary-300'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'
                    }`}
                  >
                    現在のビュー
                  </button>
                </div>

                {/* トグルオプション */}
                <div className="flex gap-4 text-xs text-gray-600 dark:text-gray-400">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={transparent}
                      onChange={(e) => setTransparent(e.target.checked)}
                      className="rounded"
                    />
                    透過背景
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={highDpi}
                      onChange={(e) => setHighDpi(e.target.checked)}
                      className="rounded"
                    />
                    高解像度（2倍）
                  </label>
                </div>

                {/* ボタン */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleImageExport('png')}
                    disabled={isExporting}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                  >
                    {isExporting ? (
                      <span className="animate-spin w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    )}
                    PNG
                  </button>
                  <button
                    onClick={() => handleImageExport('svg')}
                    disabled={isExporting}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    SVG
                  </button>
                </div>
              </div>

              {/* JSON エクスポート */}
              <button
                onClick={handleJsonExport}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">JSON でエクスポート</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">別デバイスへの移動や完全バックアップに</p>
                </div>
              </button>

              {/* Markdown エクスポート */}
              <button
                onClick={handleMarkdownExport}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Markdown でエクスポート</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">ツリー構造のMarkdownとして出力</p>
                </div>
              </button>
            </>
          )}

          {/* ─── インポートタブ ─── */}
          {tab === 'import' && (
            <>
              {/* JSON ファイルインポート */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  JSON ファイルから読み込み
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  IdeaMap の JSON ファイルをインポートします。現在のマップは置き換えられます。
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileImport}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-primary-400 hover:text-primary-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  JSONファイルを選択
                </button>
              </div>

              {/* テキスト/Markdown ペースト */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  テキストからノードを作成
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  1行1ノード。スペース2個またはタブでインデントすると親子関係になります。
                  Markdown のリスト（- や *）にも対応。
                </p>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={`例:\nメインテーマ\n  サブトピック1\n    詳細A\n  サブトピック2\n別のテーマ`}
                  rows={6}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-primary-400 font-mono"
                />
                <button
                  onClick={handlePasteImport}
                  disabled={!pasteText.trim()}
                  className="w-full py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ノードを追加
                </button>
              </div>
            </>
          )}

          {/* ─── 共有タブ ─── */}
          {tab === 'share' && (
            <>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  共有リンク
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  マップデータをURLにエンコードして共有します。受け取った人がURLを開くと自動的にインポートされます。
                  小〜中規模のマップに適しています。
                </p>

                {!shareUrl ? (
                  <button
                    onClick={handleGenerateShareUrl}
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    共有リンクを生成
                  </button>
                ) : (
                  <div className="space-y-2">
                    {shareUrlTooLarge && (
                      <div className="flex items-start gap-2 p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-xs text-amber-700 dark:text-amber-300">
                        <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        マップが大きいため、URLが長くなっています。ブラウザによっては動作しない場合があります。大きなマップは Google Drive で共有してください。
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={shareUrl}
                        className="flex-1 text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 truncate"
                      />
                      <button
                        onClick={handleCopyUrl}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border transition-colors ${
                          urlCopied
                            ? 'bg-green-50 border-green-300 text-green-600'
                            : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {urlCopied ? (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                        {urlCopied ? 'コピー済' : 'コピー'}
                      </button>
                    </div>
                    <button
                      onClick={() => { setShareUrl(''); setShareUrlTooLarge(false) }}
                      className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      リセット
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-gray-50 dark:bg-gray-700/50 p-3 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <p className="font-medium">共有リンクについて</p>
                <p>• 共有URLはマップデータ全体をbase64エンコードしたものです</p>
                <p>• 読み取り専用ではなく、受け取った人が自由に編集できます</p>
                <p>• 大きなマップは Google Drive での共有を推奨します</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
