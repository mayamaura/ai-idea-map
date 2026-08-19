import { formatMapDate } from '../../utils/formatMapDate'

/**
 * 起動画面の「前回の作業を再開」カード。Web版はローカル保存、デスクトップ版は自動保存の内容を表示するが、
 * 見た目とクリックで再開する動作は共通。表示するかどうか（対象データの有無）の判定は呼び出し側で行う。
 */
export interface ResumeMapCardProps {
  title: string
  updatedAt: string | undefined
  nodeCount: number
  onClick: () => void
}

export function ResumeMapCard({ title, updatedAt, nodeCount, onClick }: ResumeMapCardProps) {
  return (
    <div className="px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-700">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
        前回の作業を再開
      </h2>
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50/60 dark:bg-primary-900/20 hover:bg-primary-50 dark:hover:bg-primary-900/40 transition-colors text-left"
      >
        <svg className="w-5 h-5 text-primary-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
            {title}
          </p>
          <p className="text-xs text-gray-400">
            {updatedAt ? formatMapDate(updatedAt) : ''} · ノード {nodeCount} 件
          </p>
        </div>
      </button>
    </div>
  )
}
