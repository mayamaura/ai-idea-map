const ENCRYPTED_KEY_STORAGE = 'ideamap-apikey-enc'
const SALT_STORAGE = 'ideamap-salt'

function getOrCreateSalt(): Uint8Array<ArrayBuffer> {
  const stored = localStorage.getItem(SALT_STORAGE)
  if (stored) {
    const bytes = JSON.parse(stored) as number[]
    const arr = new Uint8Array(bytes.length)
    bytes.forEach((b, i) => { arr[i] = b })
    return arr
  }
  const salt = crypto.getRandomValues(new Uint8Array(16))
  localStorage.setItem(SALT_STORAGE, JSON.stringify(Array.from(salt)))
  return salt
}

async function deriveKey(): Promise<CryptoKey> {
  const salt = getOrCreateSalt()
  const rawKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('ideamap-v1'),
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

async function encryptText(text: string): Promise<string> {
  const key = await deriveKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(text)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)
  return btoa(String.fromCharCode(...combined))
}

async function decryptText(ciphertext: string): Promise<string> {
  const key = await deriveKey()
  const combined = new Uint8Array(
    atob(ciphertext).split('').map((c) => c.charCodeAt(0))
  )
  const iv = combined.slice(0, 12)
  const data = combined.slice(12)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return new TextDecoder().decode(decrypted)
}

export async function getStoredApiKey(): Promise<string> {
  const stored = localStorage.getItem(ENCRYPTED_KEY_STORAGE)
  if (!stored) return ''
  try {
    return await decryptText(stored)
  } catch {
    return ''
  }
}

export async function setStoredApiKey(apiKey: string): Promise<void> {
  if (!apiKey) {
    localStorage.removeItem(ENCRYPTED_KEY_STORAGE)
    return
  }
  const encrypted = await encryptText(apiKey)
  localStorage.setItem(ENCRYPTED_KEY_STORAGE, encrypted)
}
