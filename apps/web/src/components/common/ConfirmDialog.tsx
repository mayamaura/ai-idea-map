import { useEffect, useRef } from 'react'
import { useUIStore } from '../../stores/uiStore'
import { useFocusTrap } from '../../hooks/useFocusTrap'

export function ConfirmDialog() {
  const { confirmDialog, closeConfirmDialog } = useUIStore()
  const dialogRef = useRef<HTMLDivElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  useFocusTrap(dialogRef, Boolean(confirmDialog), confirmButtonRef)

  useEffect(() => {
    if (!confirmDialog) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        confirmDialog.onCancel?.()
        closeConfirmDialog()
      }
      // ボタンにフォーカスがある場合はボタン自身の click が走るため、ここでは処理しない（二重実行の防止）
      if (e.key === 'Enter' && (e.target as HTMLElement)?.tagName !== 'BUTTON') {
        confirmDialog.onConfirm()
        closeConfirmDialog()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmDialog, closeConfirmDialog])

  if (!confirmDialog) return null

  const { title, message, confirmLabel = '削除', danger = true, onConfirm, onCancel, secondaryAction } = confirmDialog

  const handleConfirm = () => {
    onConfirm()
    closeConfirmDialog()
  }

  const handleCancel = () => {
    onCancel?.()
    closeConfirmDialog()
  }

  const handleSecondary = () => {
    secondaryAction?.onClick()
    closeConfirmDialog()
  }

  return (
    <div
      // ファイルダッシュボード（z-60・portal）の上にも表示できるよう z-70
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 animate-fade-in"
      onClick={handleCancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-5 animate-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-dialog-title" className="text-base font-semibold text-gray-800 dark:text-gray-100">
          {title}
        </h3>
        <p id="confirm-dialog-message" className="mt-2 text-sm text-gray-500 dark:text-gray-300 leading-relaxed">
          {message}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            キャンセル
          </button>
          {secondaryAction && (
            <button
              onClick={handleSecondary}
              className="px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 border border-primary-300 dark:border-primary-600 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
            >
              {secondaryAction.label}
            </button>
          )}
          <button
            ref={confirmButtonRef}
            onClick={handleConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
              danger ? 'bg-red-500 hover:bg-red-600' : 'bg-primary-600 hover:bg-primary-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
