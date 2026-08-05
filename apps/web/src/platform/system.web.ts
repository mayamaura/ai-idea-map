import type { SystemAdapter } from '@ideamap/platform'
import { useUIStore } from '../stores/uiStore'

/**
 * Web版のクリップボード・外部URL・終了前確認。
 * 通知はアプリ内トースト（uiStore）で、デスクトップ版も同じ扱いにする。
 */
export const webSystemAdapter: SystemAdapter = {
  async copyToClipboard(text) {
    await navigator.clipboard.writeText(text)
  },

  async openExternalUrl(url) {
    window.open(url, '_blank', 'noopener,noreferrer')
  },

  onBeforeExit(handler) {
    const listener = (e: BeforeUnloadEvent) => {
      // beforeunload は同期でしか判定できないため、Promise を返すハンドラは
      // 「終了を止めない」扱いになる。Web版の呼び出し元は同期で真偽を返すこと
      const result = handler()
      if (result === false) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', listener)
    return () => window.removeEventListener('beforeunload', listener)
  },

  notify(message, type) {
    useUIStore.getState().addToast(message, type)
  },
}
