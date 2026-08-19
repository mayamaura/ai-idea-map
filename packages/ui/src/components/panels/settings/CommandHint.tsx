import { getPlatform } from '@ideamap/platform'
import { useUIStore } from '@ideamap/core'

/** ターミナルで実行してもらうコマンドの案内。コピーボタンを添える */
export function CommandHint({ command }: { command: string }) {
  const { addToast } = useUIStore()
  return (
    <div className="flex items-center gap-2 mt-2">
      <code className="flex-1 text-xs font-mono bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-200 rounded px-2 py-1.5 overflow-x-auto whitespace-nowrap">
        {command}
      </code>
      <button
        onClick={() => {
          void getPlatform()
            .system.copyToClipboard(command)
            .then(() => addToast('コマンドをコピーしました', 'success'))
        }}
        className="px-2.5 py-1.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
      >
        コピー
      </button>
    </div>
  )
}
