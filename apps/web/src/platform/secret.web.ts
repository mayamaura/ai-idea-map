import type { SecretAdapter } from '@ideamap/platform'
import {
  hasStoredApiKey,
  hasLegacyApiKey,
  getLegacyApiKey,
  clearLegacyApiKey,
  setStoredApiKeyWithPassword,
  getStoredApiKeyWithPassword,
  clearStoredApiKey,
} from '../utils/encryption'

/**
 * Web版の秘密情報の保管。マスターパスワード（PBKDF2 + AES-GCM）で暗号化して
 * localStorage に置く既存方式をそのまま使う。
 *
 * 保管している秘密情報は Claude APIキーの1件だけなので、`key` 引数は
 * インタフェース互換のために受け取るだけで分岐には使っていない。
 * 2件目が必要になったら encryption.ts 側をキー別に一般化する。
 */
export const webSecretAdapter: SecretAdapter = {
  isPassphraseFree: false,

  async hasSecret() {
    return hasStoredApiKey()
  },

  async getSecret(_key, passphrase) {
    if (!passphrase) throw new Error('マスターパスワードが必要です')
    // パスワード誤りは復号側が throw する。呼び出し元で解錠失敗として扱う
    return getStoredApiKeyWithPassword(passphrase)
  },

  async setSecret(_key, value, passphrase) {
    if (!passphrase) throw new Error('マスターパスワードが必要です')
    await setStoredApiKeyWithPassword(value, passphrase)
  },

  async clearSecret() {
    clearStoredApiKey()
  },

  async hasLegacySecret() {
    return hasLegacyApiKey()
  },

  async getLegacySecret() {
    return getLegacyApiKey()
  },

  async clearLegacySecret() {
    clearLegacyApiKey()
  },
}
