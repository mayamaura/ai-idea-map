import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useUIStore } from '../../stores/uiStore'

interface ShortcutRow {
  keys: string[]
  description: string
}

const SHORTCUTS: { section: string; rows: ShortcutRow[] }[] = [
  {
    section: '基本操作',
    rows: [
      { keys: ['Ctrl', 'S'], description: '今すぐ保存' },
      { keys: ['Ctrl', 'Z'], description: '元に戻す（Undo）' },
      { keys: ['Ctrl', 'Y'], description: 'やり直し（Redo）' },
      { keys: ['Ctrl', 'C'], description: '選択ノードをコピー' },
      { keys: ['Ctrl', 'V'], description: 'ペースト（マウス位置）' },
      { keys: ['Delete', '/','Backspace'], description: '選択ノード・エッジを削除' },
      { keys: ['Tab'], description: '選択ノードに子ノードを作成' },
    ],
  },
  {
    section: '表示・検索',
    rows: [
      { keys: ['Ctrl', 'F'], description: '検索バーをトグル' },
      { keys: ['Ctrl', '/'], description: 'ショートカット一覧を表示' },
    ],
  },
  {
    section: '検索バー内',
    rows: [
      { keys: ['↑', '↓'], description: '検索結果を前/次へ移動' },
      { keys: ['Esc'], description: '検索バーを閉じる' },
    ],
  },
  {
    section: 'ダイアログ',
    rows: [
      { keys: ['Enter'], description: '確認ダイアログを承認' },
      { keys: ['Esc'], description: '確認ダイアログをキャンセル / メニューを閉じる' },
    ],
  },
]

function Key({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono text-gray-700 dark:text-gray-300 shadow-sm">
      {children}
    </kbd>
  )
}

export function KeyboardShortcutsModal() {
  const { isShortcutsModalOpen, setShortcutsModalOpen } = useUIStore()

  useEffect(() => {
    if (!isShortcutsModalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShortcutsModalOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isShortcutsModalOpen, setShortcutsModalOpen])

  if (!isShortcutsModalOpen) return null

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">キーボードショートカット</h2>
          <button
            onClick={() => setShortcutsModalOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {SHORTCUTS.map(({ section, rows }) => (
            <div key={section}>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                {section}
              </h3>
              <div className="space-y-2">
                {rows.map(({ keys, description }) => (
                  <div key={description} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{description}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {keys.map((k, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && <span className="text-gray-400 text-xs">+</span>}
                          <Key>{k}</Key>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-400 text-center">
            <kbd className="font-mono">Ctrl</kbd> = Windowsの <kbd className="font-mono">Ctrl</kbd> / Macの <kbd className="font-mono">⌘ Cmd</kbd>
          </p>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
