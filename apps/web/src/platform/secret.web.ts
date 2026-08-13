import type { SecretAdapter } from '@ideamap/platform'
import {
  hasStoredSecret,
  hasLegacyApiKey,
  getLegacyApiKey,
  clearLegacyApiKey,
  setStoredSecretWithPassword,
  getStoredSecretWithPassword,
  clearStoredSecret,
} from '../utils/encryption'

/**
 * Web版の秘密情報の保管。マスターパスワード（PBKDF2 + AES-GCM）で暗号化して
 * localStorage に置く既存方式をそのまま使う。
 *
 * 論理キーごとに別スロットへ保存するが、暗号化に使うマスターパスワードは全キーで共通。
 * 旧形式（Phase 27 以前）が存在するのは Claude APIキーだけなので、legacy 系は key を見ない。
 */
export const webSecretAdapter: SecretAdapter = {
  isPassphraseFree: false,

  async hasSecret(key) {
    return hasStoredSecret(key)
  },

  async getSecret(key, passphrase) {
    if (!passphrase) throw new Error('マスターパスワードが必要です')
    // パスワード誤りは復号側が throw する。呼び出し元で解錠失敗として扱う
    return getStoredSecretWithPassword(key, passphrase)
  },

  async setSecret(key, value, passphrase) {
    if (!passphrase) throw new Error('マスターパスワードが必要です')
    await setStoredSecretWithPassword(key, value, passphrase)
  },

  async clearSecret(key) {
    clearStoredSecret(key)
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
