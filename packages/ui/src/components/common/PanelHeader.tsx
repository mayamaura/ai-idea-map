import type { ReactNode } from 'react'
import { CloseButton } from './CloseButton'

/**
 * 「絵文字アイコン＋タイトル（＋任意のサブタイトル）＋×ボタン」という定型ヘッダー。
 * flex-shrink-0 は常に付けるが、親がflexコンテナでないモーダル系パネルでは無害（no-op）なので
 * モーダル系・サイドパネル系のどちらにも安全に使える。
 * subtitle がない構成（MapAnalysisPanel 等）と subtitle がある構成（AISuggestionPanel 等）の
 * どちらも同一マークアップになるよう、タイトルは常に div でラップしている。
 */
export interface PanelHeaderProps {
  icon: ReactNode
  title: string
  subtitle?: string
  onClose: () => void
  closeAriaLabel: string
}

export function PanelHeader({ icon, title, subtitle, onClose, closeAriaLabel }: PanelHeaderProps) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h2>
          {subtitle && (
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-48">{subtitle}</p>
          )}
        </div>
      </div>
      <CloseButton onClick={onClose} ariaLabel={closeAriaLabel} />
    </div>
  )
}
