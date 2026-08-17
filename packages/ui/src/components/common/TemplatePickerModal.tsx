import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MAP_TEMPLATES } from '@ideamap/core'

export interface TemplatePickerModalProps {
  isOpen: boolean
  onClose: () => void
  /** テンプレートを選んだとき。マップ生成は呼び出し側（startNewMapFromTemplate）が行う */
  onSelect: (templateId: string) => void
}

/** 思考フレームワークのテンプレート選択モーダル（Phase 46）。起動ダッシュボードの上に重ねて表示する */
export function TemplatePickerModal({ isOpen, onClose, onSelect }: TemplatePickerModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const content = (
    // ダッシュボード（portal で body 直下）より手前に出すため z を1段上げる
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="テンプレートから作成"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">テンプレートから作成</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="閉じる"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 space-y-2">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
            各ノードには「何を書く欄か」の説明が入っています。AI提案も観点に沿った案を出します。
          </p>
          {MAP_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-primary-300 hover:bg-primary-50/50 dark:hover:bg-primary-900/20 transition-colors"
            >
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{t.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
