import { useEffect, useRef, type RefObject } from 'react'

/**
 * 要素の外側をクリックしたときに閉じる（ドロップダウンメニュー共通のパターン）。
 * active が false の間はリスナーを張らない。
 *
 * @param ref 外側判定の基準にする要素（メニュー全体を包むコンテナ）
 * @param active メニューが開いているか
 * @param onOutside 外側クリック時に呼ぶコールバック
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onOutside: () => void
): void {
  // onOutside を毎レンダーで新しい関数として渡しても再購読しないよう ref 越しに呼ぶ。
  // render 中に ref へ書き込まないよう、更新自体も effect の中で行う
  const onOutsideRef = useRef(onOutside)
  useEffect(() => {
    onOutsideRef.current = onOutside
  })

  useEffect(() => {
    if (!active) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Element)) {
        onOutsideRef.current()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, active])
}
