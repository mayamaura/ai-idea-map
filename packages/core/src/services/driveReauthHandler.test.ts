import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDriveReauthHandler } from './driveReauthHandler'
import { useUIStore } from '../stores/uiStore'

function last(): { message: string; action?: { label: string } } | undefined {
  const toasts = useUIStore.getState().toasts
  return toasts[toasts.length - 1]
}

describe('createDriveReauthHandler', () => {
  beforeEach(() => {
    useUIStore.setState({ toasts: [] })
  })

  it('オフラインなら401判定より前にretryを返しトーストを出さない', () => {
    const silentReauth = vi.fn()
    const handler = createDriveReauthHandler({
      isCloudSave: () => true,
      isOnline: () => false,
      silentReauth,
      signIn: vi.fn(),
    })
    expect(handler(new Error('401'), 1)).toBe('retry')
    expect(silentReauth).not.toHaveBeenCalled()
    expect(last()).toBeUndefined()
  })

  it('isCloudSaveがfalseなら401でも認証エラー扱いしない（デスクトップのローカル保存）', () => {
    const handler = createDriveReauthHandler({
      isCloudSave: () => false,
      silentReauth: vi.fn(),
      signIn: vi.fn(),
      nonAuthErrorMessage: (isCloud) => (isCloud ? 'クラウド失敗' : 'ローカル失敗'),
    })
    expect(handler(new Error('401 unauthorized'), 1)).toBe('handled')
    expect(last()?.message).toBe('ローカル失敗')
  })

  it('初回401はサイレント再認証してretry、トーストは出さない', () => {
    const silentReauth = vi.fn()
    const handler = createDriveReauthHandler({
      isCloudSave: () => true,
      silentReauth,
      signIn: vi.fn(),
    })
    expect(handler(new Error('401'), 1)).toBe('retry')
    expect(silentReauth).toHaveBeenCalledOnce()
    expect(last()).toBeUndefined()
  })

  it('2回目以降の401は再接続ボタン付きトーストを出しhandledを返す', () => {
    const signIn = vi.fn()
    const handler = createDriveReauthHandler({
      isCloudSave: () => true,
      silentReauth: vi.fn(),
      signIn,
    })
    expect(handler(new Error('401'), 2)).toBe('handled')
    expect(last()?.message).toBe('Googleドライブの認証が切れました')
    expect(last()?.action?.label).toBe('再接続')
  })

  it('401以外はGoogleドライブ失敗トーストを出しhandledを返す', () => {
    const handler = createDriveReauthHandler({
      isCloudSave: () => true,
      silentReauth: vi.fn(),
      signIn: vi.fn(),
    })
    expect(handler(new Error('network error'), 1)).toBe('handled')
    expect(last()?.message).toBe('Googleドライブへの保存に失敗しました')
  })
})
