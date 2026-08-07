import type { StorageAdapter } from '@ideamap/platform'
import { appStore } from './store.desktop'

/**
 * デスクトップ版の Key-Value 永続化。tauri-plugin-store の JSON ファイルに書く。
 * localStorage と違い WebView のデータ削除で消えず、ユーザーがファイルとして
 * バックアップ・削除できる。
 *
 * 書き込みのたびに save() するのは、アプリが強制終了しても直前の値が残るようにするため。
 */
export const desktopStorageAdapter: StorageAdapter = {
  async getItem(key) {
    return (await appStore.get<string>(key)) ?? null
  },

  async setItem(key, value) {
    await appStore.set(key, value)
    await appStore.save()
  },

  async removeItem(key) {
    await appStore.delete(key)
    await appStore.save()
  },
}
