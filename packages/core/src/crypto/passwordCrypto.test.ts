import { describe, expect, it } from 'vitest'
import { encryptWithPassword, decryptWithPassword } from './passwordCrypto'

describe('encryptWithPassword / decryptWithPassword', () => {
  it('同じパスワード・saltで復号すると元のテキストに戻る', async () => {
    const text = 'sk-ant-api03-xxxxxxxxxxxxxxxxxxxx'
    const { encrypted, salt } = await encryptWithPassword(text, 'correct-password')
    const decrypted = await decryptWithPassword(encrypted, 'correct-password', salt)
    expect(decrypted).toBe(text)
  })

  it('絵文字・マルチバイト文字も往復できる', async () => {
    const text = '日本語のAPIキー🔑テスト'
    const { encrypted, salt } = await encryptWithPassword(text, 'password')
    const decrypted = await decryptWithPassword(encrypted, 'password', salt)
    expect(decrypted).toBe(text)
  })

  it('空文字列も往復できる', async () => {
    const { encrypted, salt } = await encryptWithPassword('', 'password')
    const decrypted = await decryptWithPassword(encrypted, 'password', salt)
    expect(decrypted).toBe('')
  })

  it('誤ったパスワードで復号すると失敗する', async () => {
    const { encrypted, salt } = await encryptWithPassword('secret', 'correct-password')
    await expect(decryptWithPassword(encrypted, 'wrong-password', salt)).rejects.toThrow()
  })

  it('誤ったsaltで復号すると失敗する（鍵導出がずれるため）', async () => {
    const { encrypted } = await encryptWithPassword('secret', 'password')
    const wrongSalt = Array.from({ length: 16 }, (_, i) => i) // 元のsaltとは無関係な固定値
    await expect(decryptWithPassword(encrypted, 'password', wrongSalt)).rejects.toThrow()
  })

  it('暗号文が改ざんされていると復号に失敗する（AES-GCMの認証タグ検証）', async () => {
    const { encrypted, salt } = await encryptWithPassword('secret', 'password')
    // base64の先頭1文字を別の文字に差し替えて改ざんする
    const tamperedChar = encrypted[0] === 'A' ? 'B' : 'A'
    const tampered = tamperedChar + encrypted.slice(1)
    await expect(decryptWithPassword(tampered, 'password', salt)).rejects.toThrow()
  })

  it('同じテキスト・パスワードでも呼び出しごとにsaltとIV（延いては暗号文）が変わる', async () => {
    const text = 'same-text'
    const a = await encryptWithPassword(text, 'password')
    const b = await encryptWithPassword(text, 'password')

    expect(a.salt).not.toEqual(b.salt)
    expect(a.encrypted).not.toBe(b.encrypted)
  })

  it('saltは16バイト、暗号文の先頭12バイトはIVでこちらも呼び出しごとに変わる', async () => {
    const a = await encryptWithPassword('same-text', 'password')
    const b = await encryptWithPassword('same-text', 'password')

    expect(a.salt).toHaveLength(16)

    const ivOf = (encrypted: string) => atob(encrypted).slice(0, 12)
    expect(ivOf(a.encrypted)).not.toBe(ivOf(b.encrypted))
  })
})
