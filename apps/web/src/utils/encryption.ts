// Web版の秘密情報の「保存先」担当。暗号化アルゴリズム自体は
// プラットフォーム非依存なので @ideamap/core の passwordCrypto に置いてある。
import { encryptWithPassword, decryptWithPassword } from '@ideamap/core'

// ---- 旧形式復号（移行専用・非推奨） ----
// Phase 27 以前のハードコード鍵 'ideamap-v1' で暗号化されたキーの読み出し用。
// 新規の暗号化にはこの経路を使わないこと。

const LEGACY_ENCRYPTED_KEY_STORAGE = 'ideamap-apikey-enc'
const LEGACY_SALT_STORAGE = 'ideamap-salt'

function getLegacySalt(): Uint8Array<ArrayBuffer> | null {
  const stored = localStorage.getItem(LEGACY_SALT_STORAGE)
  if (!stored) return null
  const bytes = JSON.parse(stored) as number[]
  const arr = new Uint8Array(bytes.length) as Uint8Array<ArrayBuffer>
  bytes.forEach((b, i) => { arr[i] = b })
  return arr
}

async function decryptLegacyApiKey(ciphertext: string): Promise<string> {
  const salt = getLegacySalt()
  if (!salt) throw new Error('旧形式のsaltが見つかりません')
  const rawKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('ideamap-v1'),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    rawKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
  const combined = new Uint8Array(
    atob(ciphertext).split('').map((c) => c.charCodeAt(0))
  )
  const iv = combined.slice(0, 12)
  const data = combined.slice(12)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return new TextDecoder().decode(decrypted)
}

// ---- 新形式ストレージ（マスターパスワード方式） ----

const MP_KEY_STORAGE = 'ideamap-apikey-mp'

interface StoredApiKeyV2 {
  v: 2
  encrypted: string
  salt: number[]
}

export function hasStoredApiKey(): boolean {
  return localStorage.getItem(MP_KEY_STORAGE) !== null
}

export function hasLegacyApiKey(): boolean {
  return localStorage.getItem(LEGACY_ENCRYPTED_KEY_STORAGE) !== null
}

export async function getLegacyApiKey(): Promise<string> {
  const stored = localStorage.getItem(LEGACY_ENCRYPTED_KEY_STORAGE)
  if (!stored) return ''
  try {
    return await decryptLegacyApiKey(stored)
  } catch {
    return ''
  }
}

export function clearLegacyApiKey(): void {
  localStorage.removeItem(LEGACY_ENCRYPTED_KEY_STORAGE)
  localStorage.removeItem(LEGACY_SALT_STORAGE)
}

export async function setStoredApiKeyWithPassword(apiKey: string, password: string): Promise<void> {
  if (!apiKey) {
    localStorage.removeItem(MP_KEY_STORAGE)
    return
  }
  const { encrypted, salt } = await encryptWithPassword(apiKey, password)
  const record: StoredApiKeyV2 = { v: 2, encrypted, salt }
  localStorage.setItem(MP_KEY_STORAGE, JSON.stringify(record))
}

export async function getStoredApiKeyWithPassword(password: string): Promise<string> {
  const stored = localStorage.getItem(MP_KEY_STORAGE)
  if (!stored) return ''
  const record = JSON.parse(stored) as StoredApiKeyV2
  // パスワード誤りは decryptWithPassword が throw するのでそのまま伝播させる
  return decryptWithPassword(record.encrypted, password, record.salt)
}

export function clearStoredApiKey(): void {
  localStorage.removeItem(MP_KEY_STORAGE)
}
