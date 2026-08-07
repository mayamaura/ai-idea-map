import { getCurrentWindow } from '@tauri-apps/api/window'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { openUrl } from '@tauri-apps/plugin-opener'
import { ask } from '@tauri-apps/plugin-dialog'
import type { SystemAdapter } from '@ideamap/platform'
import { useUIStore } from '@ideamap/core'

/**
 * デスクトップ版のクリップボード・外部URL・終了前確認。
 * 通知は Web版と同じくアプリ内トースト（uiStore）に寄せている。
 */
export const desktopSystemAdapter: SystemAdapter = {
  async copyToClipboard(text) {
    await writeText(text)
  },

  async openExternalUrl(url) {
    // WebView 内に外部サイトを開くと戻れなくなるため、必ず OS 既定ブラウザへ出す
    await openUrl(url)
  },

  onBeforeExit(handler) {
    const win = getCurrentWindow()
    const unlisten = win.onCloseRequested(async (event) => {
      if (await handler()) return
      // beforeunload と違いブラウザ標準の確認UIが無いので、
      // 「止めるだけ」では閉じない理由がユーザーに伝わらない。ネイティブダイアログで意思を確認する
      event.preventDefault()
      const discard = await ask('保存されていない変更があります。保存せずに終了しますか？', {
        title: 'IdeaMap を終了',
        kind: 'warning',
        okLabel: '終了する',
        cancelLabel: 'キャンセル',
      })
      // close() は再び close-requested を発火してループするため destroy() で直接閉じる
      if (discard) await win.destroy()
    })
    return () => {
      void unlisten.then((off) => off())
    }
  },

  notify(message, type) {
    useUIStore.getState().addToast(message, type)
  },
}
