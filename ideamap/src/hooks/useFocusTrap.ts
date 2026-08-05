import { useEffect, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * モーダル内に Tab フォーカスを閉じ込め、閉じたら元の要素へフォーカスを戻す。
 * キャンバスが背後にあるアプリでは、Tab がモーダル外へ抜けると操作対象を見失うため必要。
 *
 * @param containerRef フォーカスを閉じ込める要素
 * @param active モーダルが開いているか
 * @param initialFocusRef 開いた直後にフォーカスする要素（省略時は先頭の focusable）
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  initialFocusRef?: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      )

    // 既にモーダル内へフォーカスが移っている場合（各コンポーネント側の初期フォーカス）は尊重する
    if (!container.contains(document.activeElement)) {
      const initial = initialFocusRef?.current ?? focusables()[0]
      initial?.focus()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      // モーダルが重なっている場合（詳細パネルの上に確認ダイアログ等）は最前面のトラップだけを効かせる。
      // 後から開くダイアログほど DOM 上で後ろに来るため、末尾の [role="dialog"] を最前面とみなす
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]')
      const topmost = dialogs[dialogs.length - 1]
      if (topmost && topmost !== container) return

      const items = focusables()
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const current = document.activeElement as HTMLElement | null
      const isInside = current !== null && container.contains(current)

      if (e.shiftKey) {
        if (!isInside || current === first) {
          e.preventDefault()
          last.focus()
        }
      } else if (!isInside || current === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      // 閉じた要素にフォーカスが残っていると body へ落ちるため、開く前の位置へ戻す
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [containerRef, active, initialFocusRef])
}
