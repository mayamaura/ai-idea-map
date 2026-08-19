import { useState, useEffect, useCallback, useRef } from 'react'
import { useSettingsStore, OllamaProvider, LLMError, type ModelInfo } from '@ideamap/core'
import { CommandHint } from './CommandHint'
import { SuggestionCountField } from './SuggestionCountField'

type OllamaTestStatus = 'idle' | 'testing' | 'ok' | 'error'

/** ローカルLLM（Ollama）の接続先・モデル選択。デスクトップ版でのみ描画される */
export function OllamaSection() {
  const { ollamaBaseUrl, setOllamaBaseUrl, ollamaModel, setOllamaModel } = useSettingsStore()
  const [urlInput, setUrlInput] = useState(ollamaBaseUrl)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [status, setStatus] = useState<OllamaTestStatus>('idle')
  const [errorKind, setErrorKind] = useState<'connection' | 'notFound' | 'other'>('other')
  const [errorMessage, setErrorMessage] = useState('')
  const didAutoTestRef = useRef(false)

  const runTest = useCallback(
    async (baseUrl: string) => {
      setStatus('testing')
      try {
        // /api/tags は疎通確認とモデル一覧取得を兼ねるので、接続テストはこれ1本で足りる
        const list = await new OllamaProvider(baseUrl, ollamaModel).listModels()
        setModels(list)
        setStatus('ok')
        // 選択中モデルが一覧に無ければ先頭に寄せる（初回セットアップの手数を減らす）
        if (list.length > 0 && !list.some((m) => m.id === ollamaModel)) setOllamaModel(list[0].id)
      } catch (e) {
        setModels([])
        setStatus('error')
        setErrorKind(
          e instanceof LLMError && (e.kind === 'connection' || e.kind === 'notFound') ? e.kind : 'other',
        )
        setErrorMessage(e instanceof Error ? e.message : 'Ollamaへの接続に失敗しました')
      }
    },
    [ollamaModel, setOllamaModel],
  )

  // 設定を開くたびにボタンを押させないよう、初回だけ自動で疎通を試す
  useEffect(() => {
    if (didAutoTestRef.current) return
    didAutoTestRef.current = true
    void runTest(ollamaBaseUrl)
  }, [ollamaBaseUrl, runTest])

  const handleTest = () => {
    const url = urlInput.trim() || ollamaBaseUrl
    setUrlInput(url)
    setOllamaBaseUrl(url)
    void runTest(url)
  }

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Ollama（ローカル）</h3>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">接続先URL</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="http://localhost:11434"
              className="flex-1 text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
            />
            <button
              onClick={handleTest}
              disabled={status === 'testing'}
              className="px-3 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors flex-shrink-0"
            >
              {status === 'testing' ? '確認中…' : '接続テスト'}
            </button>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
            通信はこの端末の中で完結します。マップの内容が外部に送信されることはありません。
          </p>
        </div>

        {status === 'ok' && models.length > 0 && (
          <p className="text-xs text-green-600 dark:text-green-400">
            ✅ 接続成功 / {models.length}個のモデルが見つかりました
          </p>
        )}

        {status === 'error' && (
          <div className="p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-xs text-red-700 dark:text-red-300">⚠️ {errorMessage}</p>
            {errorKind === 'connection' && (
              <>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">
                  ターミナルで以下を実行して Ollama を起動してください。接続先URLも確認してください。
                </p>
                <CommandHint command="ollama serve" />
              </>
            )}
            {errorKind === 'notFound' && ollamaModel && (
              <>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">
                  ターミナルで以下を実行してモデルを取得してください。
                </p>
                <CommandHint command={`ollama pull ${ollamaModel}`} />
              </>
            )}
          </div>
        )}

        {status === 'ok' && models.length === 0 && (
          <div className="p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              まだモデルがインストールされていません。ターミナルで以下を実行してください。
            </p>
            <CommandHint command="ollama pull gemma3:4b" />
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              日本語での利用には gemma3 / qwen3 / elyza-jp などがおすすめです。
            </p>
          </div>
        )}

        {models.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-gray-500 dark:text-gray-400">使用モデル</label>
              <button
                onClick={handleTest}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                🔄 一覧を更新
              </button>
            </div>
            <select
              value={ollamaModel}
              onChange={(e) => setOllamaModel(e.target.value)}
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500 dark:bg-gray-700 dark:text-gray-100"
            >
              {!models.some((m) => m.id === ollamaModel) && <option value="">（未選択）</option>}
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                  {m.description ? `（${m.description}）` : ''}
                  {m.loaded ? ' ⚡ロード済み' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <SuggestionCountField />
      </div>
    </section>
  )
}
