interface ShareTabProps {
  /** 共有URL生成が使えるプラットフォームか（Web版のみ）。false なら JSONファイル案内のみ表示する */
  canShareUrl: boolean
  shareUrl: string
  shareUrlTooLarge: boolean
  urlCopied: boolean
  onGenerate: () => void
  onCopyUrl: () => void
  onReset: () => void
  onExportJson: () => void
}

/**
 * 「共有」タブ。共有URL生成に対応するプラットフォーム（Web版）は共有リンクを、
 * 非対応（デスクトップ版）はJSONファイル書き出しの案内を表示する
 */
export function ShareTab({
  canShareUrl,
  shareUrl,
  shareUrlTooLarge,
  urlCopied,
  onGenerate,
  onCopyUrl,
  onReset,
  onExportJson,
}: ShareTabProps) {
  if (!canShareUrl) {
    return (
      <>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            JSONファイルとして共有
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            マップを .json ファイルとして書き出し、メールやチャットで渡してください。
            受け取った人は「インポート」タブから読み込めます。Web版で開くこともできます。
          </p>
          <button
            onClick={onExportJson}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            JSONファイルとして書き出す
          </button>
        </div>

        <div className="rounded-xl bg-gray-50 dark:bg-gray-700/50 p-3 text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <p className="font-medium">共有URLについて</p>
          <p>• デスクトップ版には共有URLがありません。URLを開く先のブラウザが必要になるためです</p>
          <p>• ファイル形式は Web版と共通なので、書き出したJSONはどちらでも開けます</p>
        </div>
      </>
    )
  }

  return (
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
            onClick={onGenerate}
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
                onClick={onCopyUrl}
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
              onClick={onReset}
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
  )
}
