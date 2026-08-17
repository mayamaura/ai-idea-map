import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useUIStore, type MergeConflictDialogState, type MergeConflict } from '@ideamap/core'
import { useFocusTrap } from '../../hooks/useFocusTrap'

type Choice = 'mine' | 'theirs'

function describeConflict(conflict: MergeConflict, side: 'base' | 'mine' | 'theirs'): string {
  // conflict.kind で先に分岐しないと、conflict[side] が SerializedNode | SerializedEdge の
  // 合成型になり title/label 双方にアクセスできなくなる（TS はここまで相関narrowingしない）
  if (conflict.kind === 'node') {
    const value = conflict[side]
    return value ? value.title || '(タイトルなし)' : '(削除)'
  }
  const value = conflict[side]
  if (!value) return '(削除)'
  return value.label ? `${value.source} → ${value.target}: ${value.label}` : `${value.source} → ${value.target}`
}

function conflictBody(conflict: MergeConflict, side: 'mine' | 'theirs'): string | undefined {
  if (conflict.kind !== 'node') return undefined
  return conflict[side]?.body
}

function DialogContent({ dialog, onClose }: { dialog: MergeConflictDialogState; onClose: () => void }) {
  const { conflicts, onResolve } = dialog
  const dialogRef = useRef<HTMLDivElement>(null)
  const applyButtonRef = useRef<HTMLButtonElement>(null)
  // マージ本体が衝突時に暫定採用しているのが mine のため、既定選択も mine に揃える
  const [choices, setChoices] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(conflicts.map((c) => [c.id, 'mine' as Choice]))
  )

  useFocusTrap(dialogRef, true, applyButtonRef)

  const setAll = (choice: Choice) => {
    setChoices(Object.fromEntries(conflicts.map((c) => [c.id, choice])))
  }

  const handleApply = () => {
    onResolve(choices)
    onClose()
  }

  const handleCancel = () => {
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
        aria-labelledby="merge-conflict-dialog-title"
        className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-5 animate-dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            handleCancel()
          }
        }}
      >
        <h3 id="merge-conflict-dialog-title" className="text-base font-semibold text-gray-800 dark:text-gray-100">
          マージの衝突を解決してください
        </h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-300 leading-relaxed">
          自分と相手が同じ箇所を別の内容に変更しました（{conflicts.length}件）。それぞれ採用する側を選んでください。
        </p>

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setAll('mine')}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            すべて自分の変更を採用
          </button>
          <button
            onClick={() => setAll('theirs')}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            すべて相手の変更を採用
          </button>
        </div>

        <div className="mt-3 flex-1 overflow-y-auto space-y-3 pr-1">
          {conflicts.map((conflict) => (
            <fieldset
              key={conflict.id}
              className="border border-gray-200 dark:border-gray-600 rounded-xl p-3"
            >
              <legend className="text-xs text-gray-400 dark:text-gray-500 px-1">
                {conflict.kind === 'node' ? 'ノード' : 'エッジ'} ・ 元: {describeConflict(conflict, 'base')}
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {(['mine', 'theirs'] as const).map((side) => (
                  <label
                    key={side}
                    className={`flex flex-col gap-1 p-2 rounded-lg border cursor-pointer transition-colors ${
                      choices[conflict.id] === side
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                        : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                      <input
                        type="radio"
                        name={`merge-conflict-${conflict.id}`}
                        checked={choices[conflict.id] === side}
                        onChange={() => setChoices((prev) => ({ ...prev, [conflict.id]: side }))}
                      />
                      {side === 'mine' ? '自分の変更' : '相手の変更'}
                    </span>
                    <span className="text-sm text-gray-800 dark:text-gray-100 break-words">
                      {describeConflict(conflict, side)}
                    </span>
                    {conflictBody(conflict, side) && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 break-words">
                        {conflictBody(conflict, side)}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            キャンセル
          </button>
          <button
            ref={applyButtonRef}
            onClick={handleApply}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
          >
            適用
          </button>
        </div>
      </div>
    </div>
  )
}

/** 3方向マージ（Phase 53）で自動統合できなかった衝突を1件ずつ選択させるダイアログ */
export function MergeConflictDialog() {
  const { mergeConflictDialog, closeMergeConflictDialog } = useUIStore()

  if (!mergeConflictDialog) return null

  return createPortal(
    <DialogContent dialog={mergeConflictDialog} onClose={closeMergeConflictDialog} />,
    document.body
  )
}
