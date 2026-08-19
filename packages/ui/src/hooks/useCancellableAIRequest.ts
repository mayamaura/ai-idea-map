import { useCallback, useRef } from 'react'
import { isAbortError } from '@ideamap/core'

/**
 * AI呼び出し系ハンドラで重複していた「AbortController生成 → loadingフラグON → 実行 →
 * キャンセル判定 → finallyで後始末」という骨格だけを共通化する薄いフック。
 * リクエストの組み立て・結果の反映・エラー表示（トースト or ローカルstate）は
 * 呼び出し側の関数に残す。キャンセル時は例外を握りつぶして何もしない
 * （呼び出し側の catch には届かない）。キャンセル以外の例外は呼び出し側へ再送出するので、
 * エラー表示は各パネルの既存ロジックのまま使える。
 */
export function useCancellableAIRequest(setLoading: (loading: boolean) => void) {
  const abortRef = useRef<AbortController | null>(null)

  const run = useCallback(
    async (fn: (signal: AbortSignal) => Promise<void>) => {
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setLoading(true)
      try {
        await fn(ctrl.signal)
      } catch (e) {
        if (!isAbortError(e)) throw e
      } finally {
        setLoading(false)
        abortRef.current = null
      }
    },
    [setLoading],
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { run, cancel }
}
