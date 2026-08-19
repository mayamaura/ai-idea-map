import { useState } from 'react'
import { useUIStore, useSettingsStore, OllamaWebSearchClient } from '@ideamap/core'
import { ExternalLink } from '../../common/ExternalLink'

/** ollama.com の Web Search APIキー設定。プロバイダ選択とは独立（Claude利用時も使える） */
export function WebSearchSection() {
  const { webSearchApiKey, setWebSearchApiKey, webSearchEnabled, setWebSearchEnabled } =
    useSettingsStore()
  const { addToast } = useUIStore()
  const [keyInput, setKeyInput] = useState(webSearchApiKey ? '••••••••••••••••' : '')
  const [isEditing, setIsEditing] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  const handleSave = () => {
    if (keyInput && !keyInput.includes('•')) {
      setWebSearchApiKey(keyInput.trim())
      setKeyInput('••••••••••••••••')
    }
    setIsEditing(false)
  }

  const handleTest = async () => {
    setIsTesting(true)
    try {
      const results = await new OllamaWebSearchClient(webSearchApiKey).search('Ollama')
      addToast(`Web検索に成功しました（${results.length}件）`, 'success')
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Web検索に失敗しました', 'error')
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Web検索</h3>
      <div className="space-y-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          AIに聞く前にWebを検索し、最新情報をふまえて回答させます。アイデア提案・AIチャット・マップ分析の各画面で、実行前にオン／オフを切り替えられます。
        </p>

        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">
            ollama.com APIキー
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              disabled={!isEditing}
              placeholder="ollama.com で発行したAPIキー"
              className="flex-1 text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500"
            />
            {isEditing ? (
              <button
                onClick={handleSave}
                className="px-3 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors flex-shrink-0"
              >
                保存
              </button>
            ) : (
              <button
                onClick={() => { setKeyInput(''); setIsEditing(true) }}
                className="px-3 py-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
              >
                変更
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
            キーはこの端末のOSキーチェーンにのみ保存されます。
            <ExternalLink href="https://ollama.com/settings/keys" className="ml-1">
              ollama.com でキーを発行
            </ExternalLink>
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            ⚠️ Web検索はローカルのOllamaではなく ollama.com のサービスを使います。検索クエリ（ノードのタイトルやチャットの入力）は ollama.com に送信されます。
          </p>
        </div>

        {webSearchApiKey && (
          <>
            <div className="flex gap-2">
              <button
                onClick={() => void handleTest()}
                disabled={isTesting}
                className="px-3 py-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {isTesting ? '確認中…' : '検索テスト'}
              </button>
              <button
                onClick={() => setWebSearchApiKey('')}
                className="px-3 py-2 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                キーを削除
              </button>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
              <input
                type="checkbox"
                checked={webSearchEnabled}
                onChange={(e) => setWebSearchEnabled(e.target.checked)}
                className="accent-primary-600"
              />
              既定でWeb検索を使う
            </label>
          </>
        )}
      </div>
    </section>
  )
}
