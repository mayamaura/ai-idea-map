/**
 * AI実行中のスピナー＋メッセージ＋キャンセルボタン。
 * layout='stacked'（既定）: スピナー→メッセージ→キャンセルボタンを縦積み（MapAnalysisPanelの4タブ）。
 * layout='inline': スピナーとキャンセルボタンを横並びにし、メッセージをその下に置く
 * （AISuggestionPanel / PersonaDebatePanel）。枠線の濃さもこの2系統で元々異なっていたため
 * layout に応じて出し分ける。
 */
export interface AILoadingIndicatorProps {
  message: string
  onCancel: () => void
  layout?: 'stacked' | 'inline'
}

// Tailwind の JIT はクラス名を静的に走査するため、`border-${x}` のような動的合成はできない。
// 2系統ぶんのクラス文字列をリテラルのまま持っておく
const CANCEL_BUTTON_CLASS: Record<'gray-200' | 'gray-300', string> = {
  'gray-200':
    'px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
  'gray-300':
    'px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
}

function CancelButton({ onClick, border }: { onClick: () => void; border: 'gray-200' | 'gray-300' }) {
  return (
    <button onClick={onClick} className={CANCEL_BUTTON_CLASS[border]}>
      キャンセル
    </button>
  )
}

export function AILoadingIndicator({ message, onCancel, layout = 'stacked' }: AILoadingIndicatorProps) {
  const spinner = <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />

  if (layout === 'inline') {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="flex items-center gap-3">
          {spinner}
          <CancelButton onClick={onCancel} border="gray-300" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 py-8">
      {spinner}
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
      <CancelButton onClick={onCancel} border="gray-200" />
    </div>
  )
}
