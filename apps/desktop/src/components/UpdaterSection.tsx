import { useEffect, useState } from 'react'
import { checkForUpdate, getAppVersion } from '../updater'

/**
 * 設定パネル末尾の「アプリ情報」セクション（デスクトップ版のみ）。
 * バージョン表示と手動の更新チェックを置く。自動チェックは起動5秒後に別途走る。
 */
export function UpdaterSection() {
  const [version, setVersion] = useState('')
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    void getAppVersion().then(setVersion)
  }, [])

  const handleCheck = async () => {
    if (isChecking) return
    setIsChecking(true)
    try {
      await checkForUpdate(false)
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">アプリ情報</h3>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-gray-600 dark:text-gray-300">IdeaMap Desktop</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {version ? `バージョン ${version}` : 'バージョンを取得中…'}
          </p>
        </div>
        <button
          onClick={() => void handleCheck()}
          disabled={isChecking}
          className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {isChecking ? '確認中…' : '更新を確認'}
        </button>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
        起動時にも自動で更新を確認します。更新はGitHubのリリースから取得し、署名を検証してから適用します。
      </p>
    </section>
  )
}
