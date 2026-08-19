import { useState, useEffect } from 'react'
import { useUIStore, getErrorLog, clearErrorLog, exportErrorLog } from '@ideamap/core'

/** 未捕捉エラーのローカルログ（Phase 43）。件数表示とエクスポート・クリアのみの最小UI */
export function ErrorLogSection() {
  const { addToast } = useUIStore()
  const [count, setCount] = useState(0)

  useEffect(() => {
    void getErrorLog().then((entries) => setCount(entries.length))
  }, [])

  if (count === 0) return null

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">エラーログ</h3>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
        アプリ内で発生した未処理のエラーが {count} 件記録されています。不具合報告の際にエクスポートして添付できます。
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => {
            void exportErrorLog().then((exported) => {
              if (exported) addToast('エラーログを書き出しました', 'success')
            })
          }}
          className="flex-1 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          エクスポート
        </button>
        <button
          onClick={() => {
            void clearErrorLog().then(() => {
              setCount(0)
              addToast('エラーログを消去しました', 'success')
            })
          }}
          className="flex-1 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          消去
        </button>
      </div>
    </section>
  )
}
