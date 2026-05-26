import { useState } from 'react'
import { useUIStore } from '../../stores/uiStore'
import { useSettingsStore } from '../../stores/settingsStore'
import type { AIModel } from '../../types'

export function SettingsPanel() {
  const { isSettingsOpen, setSettingsOpen } = useUIStore()
  const {
    apiKey, setApiKey,
    aiModel, setAiModel,
    suggestionCount, setSuggestionCount,
    autoSave, setAutoSave,
    googleClientId, setGoogleClientId,
  } = useSettingsStore()

  const [clientIdInput, setClientIdInput] = useState(googleClientId)
  const [isEditingClientId, setIsEditingClientId] = useState(false)

  const [keyInput, setKeyInput] = useState(apiKey ? '••••••••••••••••' : '')
  const [showKey, setShowKey] = useState(false)
  const [isEditingKey, setIsEditingKey] = useState(false)

  if (!isSettingsOpen) return null

  const handleKeySave = () => {
    if (keyInput && !keyInput.includes('•')) {
      setApiKey(keyInput.trim())
      setKeyInput('••••••••••••••••')
    }
    setIsEditingKey(false)
  }

  const handleKeyEdit = () => {
    setKeyInput('')
    setIsEditingKey(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">設定</h2>
          <button
            onClick={() => setSettingsOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Claude API キー */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Claude API</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">APIキー</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showKey && isEditingKey ? 'text' : 'password'}
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      disabled={!isEditingKey}
                      placeholder="sk-ant-..."
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-400"
                    />
                    {isEditingKey && (
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showKey
                          ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                          : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        }
                      </button>
                    )}
                  </div>
                  {isEditingKey ? (
                    <button
                      onClick={handleKeySave}
                      className="px-3 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      保存
                    </button>
                  ) : (
                    <button
                      onClick={handleKeyEdit}
                      className="px-3 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      変更
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  キーはこのブラウザにのみ保存されます。サーバーには送信しません。
                </p>
                {!apiKey && (
                  <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-700">
                      ⚠️ APIキーが未設定です。AI拡張機能を使うには
                      <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer"
                        className="underline ml-0.5">Anthropic Console</a>
                      でキーを取得してください。
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1.5">使用モデル</label>
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value as AIModel)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-primary-500"
                >
                  <option value="claude-sonnet-4-6">Claude Sonnet 4.6（高品質）</option>
                  <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5（高速・低コスト）</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1.5">
                  AI提案数: <span className="font-medium text-gray-700">{suggestionCount}個</span>
                </label>
                <input
                  type="range"
                  min={3}
                  max={7}
                  value={suggestionCount}
                  onChange={(e) => setSuggestionCount(Number(e.target.value))}
                  className="w-full accent-primary-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>3</span><span>7</span>
                </div>
              </div>
            </div>
          </section>

          {/* Google Drive 設定 */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Google Drive</h3>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">OAuth クライアントID</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={isEditingClientId ? clientIdInput : (googleClientId ? '••••••••••••••••' : '')}
                  onChange={(e) => setClientIdInput(e.target.value)}
                  disabled={!isEditingClientId}
                  placeholder="xxxx.apps.googleusercontent.com"
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-400 min-w-0"
                />
                {isEditingClientId ? (
                  <button
                    onClick={() => {
                      setGoogleClientId(clientIdInput.trim())
                      setIsEditingClientId(false)
                    }}
                    className="px-3 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors flex-shrink-0"
                  >
                    保存
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setClientIdInput(googleClientId)
                      setIsEditingClientId(true)
                    }}
                    className="px-3 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0"
                  >
                    変更
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                Google Cloud Console で取得したOAuth 2.0クライアントIDを入力してください。
              </p>
              {!googleClientId && (
                <div className="mt-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-700">
                    Googleドライブへの保存にはクライアントIDが必要です。
                    Google Cloud Consoleでプロジェクトを作成し、Drive APIを有効化してください。
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* 保存設定 */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">保存</h3>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-gray-600">自動保存</span>
              <button
                role="switch"
                aria-checked={autoSave}
                onClick={() => setAutoSave(!autoSave)}
                className={`relative w-10 h-6 rounded-full transition-colors ${autoSave ? 'bg-primary-600' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoSave ? 'translate-x-4' : ''}`} />
              </button>
            </label>
            <p className="text-xs text-gray-400 mt-1.5">
              {googleClientId ? 'Googleドライブに3秒後自動保存します。' : 'ブラウザのローカルストレージに保存します。'}
            </p>
          </section>
        </div>

        <div className="px-6 py-4 border-t border-gray-100">
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
