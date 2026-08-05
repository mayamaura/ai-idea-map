import type { StorageAdapter } from '@ideamap/platform'

/**
 * Web版の Key-Value 永続化。localStorage をそのままラップする。
 * 既存 storageService.ts と同じく、プライベートモード等での例外は握りつぶして
 * 「保存できなかっただけ」として扱う（アプリを止めない）。
 */
export const webStorageAdapter: StorageAdapter = {
  async getItem(key) {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  async setItem(key, value) {
    try {
      localStorage.setItem(key, value)
    } catch {
      /* 保存できなくてもアプリは継続する */
    }
  },
  async removeItem(key) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* 同上 */
    }
  },
}
