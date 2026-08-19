/**
 * パネルヘッダーの×ボタン。モーダル系パネル（AISuggestionPanel など）で
 * バイト単位まで同一だったマークアップだけを対象に共通化した最小コンポーネント。
 * サイズやパディングが異なる箇所（NodePanel の p-1 など）は見た目が変わってしまうため対象外。
 */
export interface CloseButtonProps {
  onClick: () => void
  ariaLabel: string
}

export function CloseButton({ onClick, ariaLabel }: CloseButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  )
}
