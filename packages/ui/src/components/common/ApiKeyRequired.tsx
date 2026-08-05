interface ApiKeyRequiredProps {
  /** 呼び出し元のパネルを閉じて設定パネルを開く処理 */
  onOpenSettings: () => void
  /** パネルごとの配置差分（flex-1 で縦中央にするか、固定余白にするか）を吸収する */
  className?: string
}

/** APIキー未設定時にAI系パネルが表示する空状態 */
export function ApiKeyRequired({ onOpenSettings, className = 'flex-1 p-6' }: ApiKeyRequiredProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center gap-4 ${className}`}>
      <span className="text-4xl">🔑</span>
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
        Claude APIキーが必要です
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        AI機能を使うには Anthropic の APIキーを設定してください
      </p>
      <button
        onClick={onOpenSettings}
        className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors"
      >
        設定を開く
      </button>
    </div>
  )
}
