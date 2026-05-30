import { useEffect } from 'react'
import { useUIStore } from '../../stores/uiStore'

export function ConfirmDialog() {
  const { confirmDialog, closeConfirmDialog } = useUIStore()

  useEffect(() => {
    if (!confirmDialog) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeConfirmDialog()
      if (e.key === 'Enter') {
        confirmDialog.onConfirm()
        closeConfirmDialog()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmDialog, closeConfirmDialog])

  if (!confirmDialog) return null

  const { title, message, confirmLabel = '削除', danger = true, onConfirm } = confirmDialog

  const handleConfirm = () => {
    onConfirm()
    closeConfirmDialog()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 animate-fade-in"
      onClick={closeConfirmDialog}
    >
      <div
        className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-5 animate-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-300 leading-relaxed">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={closeConfirmDialog}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            キャンセル
          </button>
          <button
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
