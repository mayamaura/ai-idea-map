import type { LLMProviderId } from '@ideamap/core'

interface ApiKeyRequiredProps {
  /** 呼び出し元のパネルを閉じて設定パネルを開く処理 */
  onOpenSettings: () => void
  /** パネルごとの配置差分（flex-1 で縦中央にするか、固定余白にするか）を吸収する */
  className?: string
  /** 未設定の内容がプロバイダごとに違う（クラウド勢=APIキー / Ollama=モデル選択） */
  providerId?: LLMProviderId
}

/** Record にしてあるのは、プロバイダを増やしたときに文言の追加漏れを型エラーで検出するため */
const MISSING_SETUP: Record<LLMProviderId, { icon: string; title: string; hint: string }> = {
  claude: {
    icon: '🔑',
    title: 'Claude APIキーが必要です',
    hint: 'AI機能を使うには Anthropic の APIキーを設定してください',
  },
  openai: {
    icon: '🔑',
    title: 'OpenAI APIキーが必要です',
    hint: 'AI機能を使うには OpenAI の APIキーを設定してください',
  },
  ollama: {
    icon: '🖥️',
    title: '使用するOllamaモデルが未選択です',
    hint: '設定画面の「AIプロバイダ」で接続テストを実行し、モデルを選んでください',
  },
}

/** AI機能の前提設定が未完了のときにAI系パネルが表示する空状態 */
export function ApiKeyRequired({
  onOpenSettings,
  className = 'flex-1 p-6',
  providerId = 'claude',
}: ApiKeyRequiredProps) {
  const { icon, title, hint } = MISSING_SETUP[providerId]
  return (
    <div className={`flex flex-col items-center justify-center text-center gap-4 ${className}`}>
      <span className="text-4xl">{icon}</span>
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>
      <button
        onClick={onOpenSettings}
        className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors"
      >
        設定を開く
      </button>
    </div>
  )
}
