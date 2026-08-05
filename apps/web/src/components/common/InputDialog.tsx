import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useUIStore, type InputDialogState } from '@ideamap/core'
import { useFocusTrap } from '../../hooks/useFocusTrap'

// 入力値をマウント単位で持つことで、ダイアログを開くたびに initialValue から始まる
function DialogContent({ dialog, onClose }: { dialog: InputDialogState; onClose: () => void }) {
  const {
    title,
    message,
    initialValue = '',
    placeholder,
    confirmLabel = '保存',
    allowEmpty = true,
    onSubmit,
    onCancel,
  } = dialog
  const [value, setValue] = useState(initialValue)
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useFocusTrap(dialogRef, true, inputRef)

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  const canSubmit = allowEmpty || value.trim() !== ''

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit(value.trim())
    onClose()
  }

  const handleCancel = () => {
    onCancel?.()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 animate-fade-in"
      onClick={handleCancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="input-dialog-title"
        className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-5 animate-dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            handleCancel()
          }
        }}
      >
        <h3 id="input-dialog-title" className="text-base font-semibold text-gray-800 dark:text-gray-100">
          {title}
        </h3>
        {message && (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-300 leading-relaxed">{message}</p>
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleSubmit()
            }
          }}
          placeholder={placeholder}
          aria-label={title}
          className="mt-3 w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:bg-gray-700 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/** window.prompt の代替。ラベル編集など1行入力を求める場面で使う */
export function InputDialog() {
  const { inputDialog, closeInputDialog } = useUIStore()

  if (!inputDialog) return null

  return createPortal(
    <DialogContent dialog={inputDialog} onClose={closeInputDialog} />,
    document.body
  )
}
