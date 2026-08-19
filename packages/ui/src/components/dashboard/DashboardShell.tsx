import type { ReactNode } from 'react'

/**
 * 起動画面（Web版 FileOpenDashboard・デスクトップ版 DesktopFileDashboard）で共通の
 * 全画面オーバーレイ・「戻る」ボタン・ロゴ＆タイトルと、それらを包むカードの外枠を切り出したもの。
 * カード内側のスクロール挙動だけはアプリごとに異なる（デスクトップ版は Drive 欄が加わり縦に伸びるため）
 * ので scrollableCard で切り替える。
 */
export interface DashboardShellProps {
  hasActiveMap: boolean
  onClose: () => void
  /** true で overflow-y-auto（デスクトップ版）。既定 false は overflow-hidden（Web版） */
  scrollableCard?: boolean
  children: ReactNode
}

export function DashboardShell({ hasActiveMap, onClose, scrollableCard = false, children }: DashboardShellProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gradient-to-br from-primary-50 to-violet-50 dark:from-gray-900 dark:to-gray-800 p-4">
      {hasActiveMap && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-700 transition-colors"
          title="キャンバスに戻る (Esc)"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* ロゴ & タイトル */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl mb-3 shadow-lg">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24">
              <line x1="5" y1="11" x2="12" y2="3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="12" y1="3" x2="19" y2="11" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="5" y1="11" x2="12" y2="15" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="19" y1="11" x2="12" y2="15" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="12" y1="15" x2="12" y2="19" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="8" y1="19" x2="16" y2="19" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="9" y1="22" x2="15" y2="22" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="12" cy="3" r="1.5" fill="white" />
              <circle cx="5" cy="11" r="1.5" fill="white" />
              <circle cx="19" cy="11" r="1.5" fill="white" />
              <circle cx="12" cy="15" r="2" fill="white" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">IdeaMap</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">どのマップを開きますか？</p>
        </div>

        <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-xl ${scrollableCard ? 'overflow-y-auto' : 'overflow-hidden'} flex flex-col max-h-[calc(90vh-180px)]`}>
          {children}
        </div>
      </div>
    </div>
  )
}
