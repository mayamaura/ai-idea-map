import { invoke } from '@tauri-apps/api/core'
import type { SecretAdapter } from '@ideamap/platform'

/**
 * デスクトップ版の秘密情報の保管。Rust 側の keyring クレート経由で
 * OSキーチェーン（Windows Credential Manager / macOS Keychain / libsecret）に置く。
 *
 * OSログインで既に保護されているためマスターパスワードは要求しない
 * （isPassphraseFree: true。呼び出し側が MasterPasswordModal を出さなくなる）。
 */
export const desktopSecretAdapter: SecretAdapter = {
  isPassphraseFree: true,

  async hasSecret(key) {
    return invoke<boolean>('has_secret', { key })
  },

  async getSecret(key) {
    return invoke<string | null>('get_secret', { key })
  },

  async setSecret(key, value) {
    await invoke('set_secret', { key, value })
  },

  async clearSecret(key) {
    await invoke('clear_secret', { key })
  },

  // 旧形式（Web版 Phase 27 以前のハードコード鍵で localStorage に置いたキー）は
  // デスクトップ版には存在しないため、移行用の3メソッドは常に「無し」を返す
  async hasLegacySecret() {
    return false
  },

  async getLegacySecret() {
    return null
  },

  async clearLegacySecret() {
    /* no-op */
  },
}
