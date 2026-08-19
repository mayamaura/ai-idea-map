import { useState } from 'react'
import { getPlatform } from '@ideamap/platform'
import {
  useUIStore,
  useSettingsStore,
  OpenAIProvider,
  DEFAULT_OPENAI_MODEL,
  LLMError,
  type ModelInfo,
} from '@ideamap/core'
import { ExternalLink } from '../../common/ExternalLink'
import { ApiKeyField } from './ApiKeyField'
import { SuggestionCountField } from './SuggestionCountField'

type OpenAITestStatus = 'idle' | 'testing' | 'ok' | 'error'
type OpenAIErrorKind = 'auth' | 'rateLimit' | 'connection' | 'other'

/** OpenAI（クラウド）のAPIキー入力・接続テスト・モデル選択 */
export function OpenAISection() {
  const { openaiApiKey, setOpenaiApiKey, openaiModel, setOpenaiModel, apiKeyLock } = useSettingsStore()
  const { setSettingsOpen } = useUIStore()
  // isPassphraseFree は実行中に変わらないプラットフォーム固有値なので遅延初期化で一度だけ読む
  const [isKeychainBacked] = useState(() => getPlatform().secret.isPassphraseFree)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [status, setStatus] = useState<OpenAITestStatus>('idle')
  const [errorKind, setErrorKind] = useState<OpenAIErrorKind>('other')
  const [errorMessage, setErrorMessage] = useState('')

  const handleShowUnlockModal = () => {
    // 設定パネルを閉じてモーダルを表示（dismissMasterPasswordPrompt をリセット）
    useSettingsStore.setState({ masterPasswordPromptDismissed: false })
    setSettingsOpen(false)
  }

  const handleTest = async () => {
    if (!openaiApiKey) return
    setStatus('testing')
    try {
      const list = await new OpenAIProvider(openaiApiKey, openaiModel).listModels()
      setModels(list)
      setStatus('ok')
      // 選択中モデルが一覧に無ければ先頭に寄せる（初回セットアップの手数を減らす）
      if (list.length > 0 && !list.some((m) => m.id === openaiModel)) setOpenaiModel(list[0].id)
    } catch (e) {
      setModels([])
      setStatus('error')
      setErrorKind(
        e instanceof LLMError && (e.kind === 'auth' || e.kind === 'rateLimit' || e.kind === 'connection')
          ? e.kind
          : 'other',
      )
      setErrorMessage(e instanceof Error ? e.message : 'OpenAIへの接続に失敗しました')
    }
  }

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">OpenAI</h3>
      <div className="space-y-3">
        <ApiKeyField
          hasKey={!!openaiApiKey}
          onSave={setOpenaiApiKey}
          placeholder="sk-..."
          locked={apiKeyLock === 'locked'}
          onUnlockClick={handleShowUnlockModal}
          isKeychainBacked={isKeychainBacked}
        >
          <div className="mt-1.5 space-y-1">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              ⚠️ <ExternalLink href="https://platform.openai.com/settings/organization/limits">Usage limits</ExternalLink> で利用上限を設定することを推奨します。
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              🔑 このアプリ専用のAPIキーを発行して使うことを推奨します。
            </p>
          </div>
          {!openaiApiKey && apiKeyLock !== 'locked' && (
            <div className="mt-2 p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                ⚠️ APIキーが未設定です。AI拡張機能を使うには
                <ExternalLink href="https://platform.openai.com/api-keys" className="ml-0.5">platform.openai.com</ExternalLink>
                でキーを発行してください。
              </p>
            </div>
          )}
        </ApiKeyField>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleTest()}
            disabled={status === 'testing' || !openaiApiKey}
            className="px-3 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors flex-shrink-0"
          >
            {status === 'testing' ? '確認中…' : '接続テスト'}
          </button>
          {status === 'ok' && models.length > 0 && (
            <p className="text-xs text-green-600 dark:text-green-400">
              ✅ 接続成功 / {models.length}個のモデルが見つかりました
            </p>
          )}
        </div>

        {status === 'error' && (
          <div className="p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-xs text-red-700 dark:text-red-300">⚠️ {errorMessage}</p>
            {errorKind === 'auth' && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">
                APIキーが正しいか、<ExternalLink href="https://platform.openai.com/api-keys">platform.openai.com</ExternalLink> で有効なキーか確認してください。
              </p>
            )}
            {errorKind === 'rateLimit' && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">
                レート制限、または利用上限（課金枠）に達している可能性があります。
                <ExternalLink href="https://platform.openai.com/settings/organization/limits">Usage limits</ExternalLink> を確認してください。
              </p>
            )}
            {errorKind === 'connection' && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">
                ネットワーク接続を確認してください。
              </p>
            )}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-gray-500 dark:text-gray-400">使用モデル</label>
            {models.length > 0 && (
              <button
                onClick={() => void handleTest()}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                🔄 一覧を更新
              </button>
            )}
          </div>
          {models.length > 0 ? (
            <select
              value={openaiModel}
              onChange={(e) => setOpenaiModel(e.target.value)}
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500 dark:bg-gray-700 dark:text-gray-100"
            >
              {!models.some((m) => m.id === openaiModel) && <option value="">（未選択）</option>}
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          ) : (
            // モデル一覧を未取得の間は現在値（未選択ならデフォルト）を表示だけする
            <select
              value={openaiModel || DEFAULT_OPENAI_MODEL}
              disabled
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 outline-none bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500"
            >
              <option value={openaiModel || DEFAULT_OPENAI_MODEL}>{openaiModel || DEFAULT_OPENAI_MODEL}</option>
            </select>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
            接続テストを実行すると利用可能なモデル一覧を取得できます。
          </p>
        </div>

        <SuggestionCountField />
      </div>
    </section>
  )
}
