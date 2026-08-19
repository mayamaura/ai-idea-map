import { useState, useCallback, useEffect, useRef } from 'react'
import { getPlatform } from '@ideamap/platform'
import { clearDriveCache, useUIStore } from '@ideamap/core'
import type { AppCloudAuth } from '@ideamap/ui'
import {
  REFRESH_TOKEN_SECRET,
  isDesktopClientIdMissing,
  refreshAccessToken,
  revokeGoogleToken,
  signInWithGoogle,
} from '../googleAuth'

/**
 * デスクトップ版の Google 認証。Web版 `useGoogleAuth` と同じ形の状態を返し、
 * 呼び出し側（App の cloudAuth prop・自動保存の再認証）から見て等価に扱えるようにする。
 *
 * 中身は別物で、GIS のポップアップではなくループバック + PKCE（googleAuth.ts）を使い、
 * リフレッシュトークンを OSキーチェーンに置くことで再起動後もサインイン状態を保つ。
 */

/** 接続アカウントのメールアドレス。表示用なのでキーチェーンではなく通常の永続化に置く */
const USER_EMAIL_KEY = 'ideamap-google-email'
/** アクセストークンの更新を仕掛ける余裕（秒）。失効直前の保存失敗を避ける */
const REFRESH_MARGIN_SEC = 300

/** フックの戻り値の形。AppCloudAuth に silentReauth を足しただけ */
export interface DesktopGoogleAuthState extends AppCloudAuth {
  silentReauth: () => void
}

/** useState で保持する分だけの部分集合（signIn/signOut 等は useCallback 側で持つ） */
type AuthFields = Pick<AppCloudAuth, 'isSignedIn' | 'accessToken' | 'isLoading' | 'error' | 'userEmail'>

export function useDesktopGoogleAuth(): DesktopGoogleAuthState {
  const [state, setState] = useState<AuthFields>({
    isSignedIn: false,
    accessToken: null,
    isLoading: false,
    error: null,
    userEmail: null,
  })
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(true)
  /** 更新処理の多重起動を防ぐ。401 リトライと定期更新が重なりうる */
  const isRefreshingRef = useRef(false)
  /**
   * 更新処理と更新の予約は互いを呼び合うため、片方を ref 越しに参照して
   * 宣言順の依存を切る（タイマー発火時には最新のものが入っている）。
   */
  const renewRef = useRef<() => Promise<boolean>>(async () => false)
  /**
   * ブラウザでの認可を待っている最中かどうか。
   * 2回目の開始は Rust 側で1回目のループバックサーバを畳んでしまい、
   * 1回目の待機がイベントを受け取れないまま残るため、ここで弾く。
   */
  const isSigningInRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, [])

  /** 有効期限の少し前に自動更新を仕掛ける */
  const scheduleRefresh = useCallback((expiresIn: number) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    const delayMs = Math.max(expiresIn - REFRESH_MARGIN_SEC, 60) * 1000
    refreshTimerRef.current = setTimeout(() => {
      void renewRef.current()
    }, delayMs)
  }, [])

  /** キーチェーンのリフレッシュトークンでアクセストークンを取り直す */
  const renewFromKeychain = useCallback(async (): Promise<boolean> => {
    if (isRefreshingRef.current) return false
    isRefreshingRef.current = true
    try {
      const { secret, storage } = getPlatform()
      const refreshToken = await secret.getSecret(REFRESH_TOKEN_SECRET)
      if (!refreshToken) return false

      const tokens = await refreshAccessToken(refreshToken)
      // 更新レスポンスにリフレッシュトークンは含まれないので既存の値を使い続ける
      if (tokens.refreshToken) {
        await secret.setSecret(REFRESH_TOKEN_SECRET, tokens.refreshToken)
      }
      const email = tokens.email ?? (await storage.getItem(USER_EMAIL_KEY))
      if (tokens.email) await storage.setItem(USER_EMAIL_KEY, tokens.email)

      if (isMountedRef.current) {
        setState({
          isSignedIn: true,
          accessToken: tokens.accessToken,
          isLoading: false,
          error: null,
          userEmail: email,
        })
        scheduleRefresh(tokens.expiresIn)
      }
      return true
    } catch {
      // リフレッシュトークンが失効している（Testing 公開ステータスの7日制限・ユーザーによる取り消し）。
      // 黙ってサインアウト状態に戻し、必要になった時点で再サインインを促す
      await getPlatform().secret.clearSecret(REFRESH_TOKEN_SECRET).catch(() => {})
      if (isMountedRef.current) {
        setState((s) => ({ ...s, isSignedIn: false, accessToken: null, isLoading: false }))
      }
      return false
    } finally {
      isRefreshingRef.current = false
    }
  }, [scheduleRefresh])
  renewRef.current = renewFromKeychain

  // 起動時：キーチェーンに残っていれば自動でサインイン状態を復元する
  useEffect(() => {
    if (isDesktopClientIdMissing) return
    void (async () => {
      const { secret, storage } = getPlatform()
      const savedEmail = await storage.getItem(USER_EMAIL_KEY)
      if (savedEmail && isMountedRef.current) {
        setState((s) => ({ ...s, userEmail: savedEmail }))
      }
      if (!(await secret.hasSecret(REFRESH_TOKEN_SECRET))) return
      if (isMountedRef.current) setState((s) => ({ ...s, isLoading: true }))
      await renewFromKeychain()
    })()
  }, [renewFromKeychain])

  const signIn = useCallback(() => {
    if (isSigningInRef.current) return
    if (isDesktopClientIdMissing) {
      setState((s) => ({
        ...s,
        error: 'Google Client ID が未設定です（VITE_GOOGLE_DESKTOP_CLIENT_ID）',
      }))
      return
    }
    isSigningInRef.current = true
    setState((s) => ({ ...s, isLoading: true, error: null }))
    void (async () => {
      try {
        const tokens = await signInWithGoogle()
        const { secret, storage } = getPlatform()
        if (tokens.refreshToken) {
          await secret.setSecret(REFRESH_TOKEN_SECRET, tokens.refreshToken)
        }
        if (tokens.email) await storage.setItem(USER_EMAIL_KEY, tokens.email)

        if (isMountedRef.current) {
          setState({
            isSignedIn: true,
            accessToken: tokens.accessToken,
            isLoading: false,
            error: null,
            userEmail: tokens.email,
          })
          scheduleRefresh(tokens.expiresIn)
        }
      } catch (err) {
        if (isMountedRef.current) {
          setState((s) => ({
            ...s,
            isLoading: false,
            error: err instanceof Error ? err.message : 'Google認証に失敗しました',
          }))
        }
      } finally {
        isSigningInRef.current = false
      }
    })()
  }, [scheduleRefresh])

  const signOut = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
    const token = state.accessToken
    void (async () => {
      if (token) await revokeGoogleToken(token)
      const { secret, storage } = getPlatform()
      await secret.clearSecret(REFRESH_TOKEN_SECRET).catch(() => {})
      await storage.removeItem(USER_EMAIL_KEY)
      clearDriveCache()
      // Drive 上のマップを開いたままサインアウトしたら保存先を手放す。
      // ローカルファイルを開いている場合は保存を続けられるので触らない
      const ui = useUIStore.getState()
      if (ui.currentFileOrigin === 'cloud') ui.setCurrentFileId(null)
      if (isMountedRef.current) {
        setState({
          isSignedIn: false,
          accessToken: null,
          isLoading: false,
          error: null,
          userEmail: null,
        })
      }
    })()
  }, [state.accessToken])

  /** 保存が401で落ちたときの再認証。Web版 useGoogleAuth の silentReauth に相当する */
  const silentReauth = useCallback(() => {
    void renewFromKeychain()
  }, [renewFromKeychain])

  return {
    ...state,
    signIn,
    signOut,
    silentReauth,
    clientIdMissing: isDesktopClientIdMissing,
  }
}
