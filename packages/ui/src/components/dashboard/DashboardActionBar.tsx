import { startNewMap } from '../../hooks/useFileDashboard'

/**
 * 起動画面下部の3ボタン（新規作成／テンプレート／ファイルを開く）。
 * 「新規作成」は両アプリで startNewMap を呼ぶだけで差がないため、このコンポーネントが直接呼び出す。
 * 「テンプレート」「ファイルを開く」は呼び出し側が保持する状態（showTemplates・fileInputRef 等）に
 * 依存するため props で受け取る。
 */
export interface DashboardActionBarProps {
  onTemplateClick: () => void
  onOpenClick: () => void
  /** デスクトップ版はファイル操作中のみ無効化する。Web版は指定しない（常に有効） */
  openDisabled?: boolean
}

export function DashboardActionBar({ onTemplateClick, onOpenClick, openDisabled }: DashboardActionBarProps) {
  return (
    <div className="px-6 py-4 flex gap-3">
      <button
        onClick={startNewMap}
        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        新規作成
      </button>
      <button
        onClick={onTemplateClick}
        className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
        テンプレート
      </button>
      <button
        onClick={onOpenClick}
        disabled={openDisabled}
        className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        ファイルを開く
      </button>
    </div>
  )
}
