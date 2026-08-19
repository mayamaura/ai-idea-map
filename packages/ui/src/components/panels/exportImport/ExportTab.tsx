interface ExportTabProps {
  imageMode: 'current' | 'full'
  onImageModeChange: (mode: 'current' | 'full') => void
  transparent: boolean
  onTransparentChange: (value: boolean) => void
  highDpi: boolean
  onHighDpiChange: (value: boolean) => void
  isExporting: boolean
  onExportImage: (format: 'png' | 'svg') => void
  onExportJson: () => void
  onExportMarkdown: () => void
  onGenerateArtifact: () => void
}

/** 「エクスポート」タブ。画像（PNG/SVG）・JSON・Markdown・AI成果物生成への導線 */
export function ExportTab({
  imageMode,
  onImageModeChange,
  transparent,
  onTransparentChange,
  highDpi,
  onHighDpiChange,
  isExporting,
  onExportImage,
  onExportJson,
  onExportMarkdown,
  onGenerateArtifact,
}: ExportTabProps) {
  return (
    <>
      {/* 画像オプション */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          画像（PNG / SVG）
        </p>

        {/* モード選択 */}
        <div className="flex gap-2">
          <button
            onClick={() => onImageModeChange('full')}
            className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
              imageMode === 'full'
                ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-900/30 dark:border-primary-500 dark:text-primary-300'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            マップ全体
          </button>
          <button
            onClick={() => onImageModeChange('current')}
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
              onChange={(e) => onTransparentChange(e.target.checked)}
              className="rounded"
            />
            透過背景
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={highDpi}
              onChange={(e) => onHighDpiChange(e.target.checked)}
              className="rounded"
            />
            高解像度（2倍）
          </label>
        </div>

        {/* ボタン */}
        <div className="flex gap-2">
          <button
            onClick={() => onExportImage('png')}
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
            onClick={() => onExportImage('svg')}
            disabled={isExporting}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            SVG
          </button>
        </div>
      </div>

      {/* JSON エクスポート */}
      <button
        onClick={onExportJson}
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
        onClick={onExportMarkdown}
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

      {/* AIで成果物を生成（Phase 45） */}
      <button
        onClick={onGenerateArtifact}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
      >
        <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">AIで成果物を生成…</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">ドキュメント・スライド・タスクリストをAIが作成</p>
        </div>
      </button>
    </>
  )
}
