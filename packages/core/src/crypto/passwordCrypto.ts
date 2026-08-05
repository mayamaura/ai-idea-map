// パスワードベースの暗号化（PBKDF2 100,000回 + AES-GCM 256bit）。
// WebCrypto は Tauri の WebView でも同一に動くため、プラットフォーム非依存の純粋ロジックとして core に置く。
// 保存先（localStorage / OSキーチェーン）の差は SecretAdapter が吸収する。

async function deriveKeyFromPassword(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const rawKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    rawKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptWithPassword(
  text: string,
  password: string
): Promise<{ encrypted: string; salt: number[] }> {
  const salt = crypto.getRandomValues(new Uint8Array(16)) as Uint8Array<ArrayBuffer>
  const key = await deriveKeyFromPassword(password, salt)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(text)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)
  return {
    encrypted: btoa(String.fromCharCode(...combined)),
    salt: Array.from(salt),
  }
}

export async function decryptWithPassword(
  ciphertext: string,
  password: string,
  saltArray: number[]
): Promise<string> {
  const salt = new Uint8Array(saltArray) as Uint8Array<ArrayBuffer>
  const key = await deriveKeyFromPassword(password, salt)
  const combined = new Uint8Array(
    atob(ciphertext).split('').map((c) => c.charCodeAt(0))
  )
  const iv = combined.slice(0, 12)
  const data = combined.slice(12)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return new TextDecoder().decode(decrypted)
}
