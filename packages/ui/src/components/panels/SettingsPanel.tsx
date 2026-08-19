import { useState, type ReactNode } from 'react'
import { getPlatform } from '@ideamap/platform'
import { ExternalLink } from '../common/ExternalLink'
import { useUIStore, useSettingsStore, type LLMProviderId } from '@ideamap/core'
import { DriveSyncSection } from './settings/DriveSyncSection'
import { CategoryManager } from './settings/CategoryManager'
import { SuggestionCountField } from './settings/SuggestionCountField'
import { ApiKeyField } from './settings/ApiKeyField'
import { OllamaSection } from './settings/OllamaSection'
import { OpenAISection } from './settings/OpenAISection'
import { WebSearchSection } from './settings/WebSearchSection'
import { ErrorLogSection } from './settings/ErrorLogSection'

interface SettingsPanelProps {
  accessToken: string | null
  /** クラウド設定同期のセクションを出すか。デスクトップ版は false */
  showCloudSync?: boolean
  /**
   * プラットフォーム固有の追加セクション（デスクトップ版の自動更新など）。
   * 末尾に描画する。packages/ui からプラットフォーム実装へ依存しないための注入口
   */
  extraSections?: ReactNode
}

export function SettingsPanel({ accessToken, showCloudSync = true, extraSections }: SettingsPanelProps) {
  const { isSettingsOpen, setSettingsOpen } = useUIStore()
  const {
    apiKey, setApiKey,
    apiKeyLock,
    llmProvider, setLlmProvider,
    claudeModel, setClaudeModel,
    autoSave, setAutoSave,
    edgeStyle, setEdgeStyle,
  } = useSettingsStore()

  // 実行中に変わらない値なので遅延初期化で一度だけ読む。
  // レンダー本体で getPlatform() を呼ぶと setPlatform() 前の評価に晒されるため避ける
  const [isKeychainBacked] = useState(() => getPlatform().secret.isPassphraseFree)
  // ブラウザからは Ollama 側の OLLAMA_ORIGINS 設定に依存して安定提供できないため、
  // Ollama はローカルサーバーへ到達できるプラットフォームでのみ選択肢に出す。
  // Claude / OpenAI は api.anthropic.com・api.openai.com どちらもCORSを許可しているため常に選べる
  const [canUseOllama] = useState(() => getPlatform().http.canAccessLocalServers)

  if (!isSettingsOpen) return null

  const providerOptions: { id: LLMProviderId; label: string; hint: string }[] = [
    { id: 'claude', label: 'Claude API', hint: 'クラウド・従量課金' },
    { id: 'openai', label: 'OpenAI', hint: 'クラウド・従量課金' },
    ...(canUseOllama ? [{ id: 'ollama' as const, label: 'Ollama', hint: 'ローカル・無料' }] : []),
  ]

  const handleShowUnlockModal = () => {
    // 設定パネルを閉じてモーダルを表示（dismissMasterPasswordPrompt をリセット）
    useSettingsStore.setState({ masterPasswordPromptDismissed: false })
    setSettingsOpen(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">設定</h2>
          <button
            onClick={() => setSettingsOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* AIプロバイダ切り替え。Claude / OpenAI は CORS 許可済みで常に選べる。Ollama はローカルサーバーへ到達できる環境のみ */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">AIプロバイダ</h3>
            <div className={`grid gap-2 ${canUseOllama ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {providerOptions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setLlmProvider(p.id)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    llmProvider === p.id
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="block font-medium">{p.label}</span>
                  <span className="block text-xs opacity-70">{p.hint}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Ollama 設定（デスクトップ版で Ollama を選んでいるときのみ） */}
          {llmProvider === 'ollama' && <OllamaSection />}

          {/* OpenAI 設定 */}
          {llmProvider === 'openai' && <OpenAISection />}

          {/* Claude API キー */}
          {llmProvider === 'claude' && (
          <section>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Claude API</h3>
            <div className="space-y-3">
              <ApiKeyField
                hasKey={!!apiKey}
                onSave={setApiKey}
                placeholder="sk-ant-..."
                locked={apiKeyLock === 'locked'}
                onUnlockClick={handleShowUnlockModal}
                isKeychainBacked={isKeychainBacked}
              >
                <div className="mt-1.5 space-y-1">
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    ⚠️ <ExternalLink href="https://console.anthropic.com/">Anthropic Console</ExternalLink> で利用上限（使用上限）を設定することを推奨します。
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    🔑 このアプリ専用のAPIキーを発行して使うことを推奨します。
                  </p>
                </div>
                {!apiKey && apiKeyLock !== 'locked' && (
                  <div className="mt-2 p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      ⚠️ APIキーが未設定です。AI拡張機能を使うには
                      <ExternalLink href="https://console.anthropic.com/" className="ml-0.5">Anthropic Console</ExternalLink>
                      でキーを取得してください。
                    </p>
                  </div>
                )}
              </ApiKeyField>

              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">使用モデル</label>
                <select
                  value={claudeModel}
                  onChange={(e) => setClaudeModel(e.target.value)}
                  className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500 dark:bg-gray-700 dark:text-gray-100"
                >
                  <option value="claude-sonnet-5">Claude Sonnet 5（高品質）</option>
                  <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5（高速・低コスト）</option>
                </select>
              </div>

              <SuggestionCountField />
            </div>
          </section>
          )}

          {/* Web検索（ollama.com のサービスで、ブラウザからは CORS で叩けないためデスクトップ版のみ） */}
          {canUseOllama && <WebSearchSection />}

          {/* 設定のDrive同期。マスターパスワード設定を兼ねるので、キーチェーンに載せていて
              パスワードの概念がない環境（デスクトップ版）では出さない。
              デスクトップ版は cloudAuth を渡すようになった（Phase 38）が、
              設定同期そのものはスコープ外のまま（docs/desktop/README.md §3.1-H #12） */}
          {showCloudSync && !isKeychainBacked && <DriveSyncSection accessToken={accessToken} />}

          {/* カテゴリ管理 */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">カテゴリ管理</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              ノードをカテゴリで分類できます。デフォルトカテゴリは削除できません。
            </p>
            <CategoryManager />
          </section>

          {/* 外観 */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">外観</h3>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">エッジの形状</label>
            <div className="flex gap-2">
              {([
                { value: 'bezier', label: '曲線' },
                { value: 'smoothstep', label: '折れ線' },
                { value: 'straight', label: '直線' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setEdgeStyle(opt.value)}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                    edgeStyle === opt.value
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          {/* 保存設定 */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">保存</h3>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-gray-600 dark:text-gray-300">自動保存</span>
              <button
                role="switch"
                aria-checked={autoSave}
                onClick={() => setAutoSave(!autoSave)}
                className={`relative w-10 h-6 rounded-full transition-colors ${autoSave ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'}`}
              >
                {/* つまみはトラック（暗色）との対比を保つためダークでも白のままにする */}
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoSave ? 'translate-x-4' : ''}`} />
              </button>
            </label>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
              Googleドライブにサインイン中は3秒後に自動保存します。未サインイン時はローカルストレージに保存します。
            </p>
          </section>

          <ErrorLogSection />

          {extraSections}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={() => setSettingsOpen(false)}
            className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
