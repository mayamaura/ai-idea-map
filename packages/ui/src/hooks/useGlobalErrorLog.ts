import { useEffect } from 'react'
import { recordError } from '@ideamap/core'

/**
 * 未捕捉エラーをエラーログ（core/services/errorLog）に記録する（Phase 43）。
 * Web版・デスクトップ版とも WebView の window イベントで拾えるため packages/ui に置く。
 */
export function useGlobalErrorLog(): void {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      void recordError('window.onerror', event.error ?? event.message)
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      void recordError('unhandledrejection', event.reason)
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
}
