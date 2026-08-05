import { useState, useCallback, useEffect, useRef } from 'react'
import { clearDriveCache } from '../services/googleDriveService'
import { useUIStore } from '../stores/uiStore'

// drive.file のみでファイル保存、userinfo.email で接続アカウントを表示
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email'
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const AUTO_AUTH_FLAG = 'googleAuthRequested'
const TOKEN_STORAGE_KEY = 'googleAccessToken'
const TOKEN_EXPIRY_KEY = 'googleTokenExpiry'
// トークン有効期限の5分前に失効扱い
const EXPIRY_BUFFER_MS = 5 * 60 * 1000
const USER_EMAIL_KEY = 'googleUserEmail'

export interface GoogleAuthState {
  isSignedIn: boolean
  accessToken: string | null
  isLoading: boolean
  error: string | null
  userEmail: string | null
}

function saveTokenToSession(token: string, expiresIn: number): void {
  const expiresAt = Date.now() + expiresIn * 1000 - EXPIRY_BUFFER_MS
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token)
  sessionStorage.setItem(TOKEN_EXPIRY_KEY, expiresAt.toString())
}

function loadTokenFromSession(): string | null {
  const token = sessionStorage.getItem(TOKEN_STORAGE_KEY)
  const expiryStr = sessionStorage.getItem(TOKEN_EXPIRY_KEY)
  if (!token || !expiryStr) return null
  if (Date.now() >= parseInt(expiryStr, 10)) {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY)
    sessionStorage.removeItem(TOKEN_EXPIRY_KEY)
    return null
  }
  return token
}

function clearTokenFromSession(): void {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY)
  sessionStorage.removeItem(TOKEN_EXPIRY_KEY)
}

// エラータイプを日本語メッセージに変換する。null は表示しない
function friendlyAuthError(type: string): string | null {
  if (type === 'popup_closed') return null
  if (type === 'popup_failed_to_open') return 'ポップアップがブロックされました。ブラウザのポップアップ設定を確認してください'
  if (type === 'access_denied') return 'Googleへのアクセスが許可されませんでした'
  return `Google認証でエラーが発生しました（${type}）`
}

export function useGoogleAuth() {
  const [state, setState] = useState<GoogleAuthState>({
    isSignedIn: false,
    accessToken: null,
    isLoading: false,
    error: null,
    // localStorage から前回のメールアドレスを復元（未ログイン時も表示用に保持）
    userEmail: localStorage.getItem(USER_EMAIL_KEY),
  })
  const tokenClientRef = useRef<TokenClient | null>(null)
  const [isGisReady, setIsGisReady] = useState(false)
  // 自動再認証の試行中かどうかを追跡（エラー時のフラグ削除を制御するため）
  const isAutoAuthRef = useRef(false)
  const refreshTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return

    const check = () => {
      if (typeof google !== 'undefined' && google.accounts?.oauth2) {
        setIsGisReady(true)
        return true
      }
      return false
    }

    if (!check()) {
      const id = setInterval(() => {
        if (check()) clearInterval(id)
      }, 300)
      return () => clearInterval(id)
    }
  }, [])

  const scheduleRefreshAt = useCallback((delayMs: number) => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current)
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null
      if (tokenClientRef.current && localStorage.getItem(AUTO_AUTH_FLAG) === 'true') {
        isAutoAuthRef.current = true
        tokenClientRef.current.requestAccessToken({ prompt: '' })
      }
    }, Math.max(delayMs, 0))
  }, [])

  useEffect(() => {
    if (!isGisReady || !GOOGLE_CLIENT_ID) return

    tokenClientRef.current = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          // 手動サインインのエラーはフラグを削除
          localStorage.removeItem(AUTO_AUTH_FLAG)
          clearTokenFromSession()
          setState((s) => ({
            ...s,
            isLoading: false,
            error: response.error_description ?? response.error ?? '認証エラー',
          }))
          return
        }
        isAutoAuthRef.current = false
        const expiresIn = (response as TokenResponse & { expires_in?: number }).expires_in ?? 3600
        saveTokenToSession(response.access_token, expiresIn)
        scheduleRefreshAt((expiresIn - 300) * 1000)
        localStorage.setItem(AUTO_AUTH_FLAG, 'true')

        // 接続アカウントのメールアドレスを取得して表示・永続化
        const token = response.access_token
        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: 'Bearer ' + token },
        })
          .then((res) => res.json())
          .then((data: { email?: string }) => {
            const email = data.email ?? null
            if (email) {
              localStorage.setItem(USER_EMAIL_KEY, email)
            }
            setState({
              isSignedIn: true,
              accessToken: token,
              isLoading: false,
              error: null,
              userEmail: email,
            })
          })
          .catch(() => {
            // メール取得失敗は無視して認証は成功として扱う
            setState({
              isSignedIn: true,
              accessToken: token,
              isLoading: false,
              error: null,
              userEmail: null,
            })
          })
      },
      error_callback: (err) => {
        // access_denied はユーザーの意図的な拒否 → フラグを削除
        // 自動再認証の失敗（popup_closed, popup_failed_to_open 等）はフラグを保持して次回も試行
        if (!isAutoAuthRef.current || err.type === 'access_denied') {
          localStorage.removeItem(AUTO_AUTH_FLAG)
          clearTokenFromSession()
        }
        isAutoAuthRef.current = false
        setState((s) => ({
          ...s,
          isLoading: false,
          error: friendlyAuthError(err.type),
        }))
      },
    })

    // sessionStorage に有効なトークンが残っていればすぐに復元
    const savedToken = loadTokenFromSession()
    if (savedToken) {
      setState({
        isSignedIn: true,
        accessToken: savedToken,
        isLoading: false,
        error: null,
        userEmail: localStorage.getItem(USER_EMAIL_KEY),
      })
      const expiryStr = sessionStorage.getItem(TOKEN_EXPIRY_KEY)
      if (expiryStr) {
        scheduleRefreshAt(parseInt(expiryStr, 10) - Date.now())
      }
    } else if (localStorage.getItem(AUTO_AUTH_FLAG) === 'true') {
      // 前回サインイン済みなら prompt: '' でサイレント再認証を試みる
      isAutoAuthRef.current = true
      setState((s) => ({ ...s, isLoading: true }))
      tokenClientRef.current.requestAccessToken({ prompt: '' })
    }

    // バックグラウンドから復帰したときにトークン失効チェック
    const onVisibilityChange = () => {
      if (!document.hidden && localStorage.getItem(AUTO_AUTH_FLAG) === 'true' && tokenClientRef.current) {
        const expiryStr = sessionStorage.getItem(TOKEN_EXPIRY_KEY)
        const expiry = expiryStr ? parseInt(expiryStr, 10) : 0
        // 失効済みまたは残り5分未満（EXPIRY_BUFFER_MS は既に引いてあるため Date.now() >= expiry で失効判定）
        if (Date.now() >= expiry) {
          isAutoAuthRef.current = true
          tokenClientRef.current.requestAccessToken({ prompt: '' })
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current)
      }
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [isGisReady, scheduleRefreshAt])

  const signIn = useCallback(() => {
    if (!GOOGLE_CLIENT_ID) {
      setState((s) => ({
        ...s,
        error: 'Google Client ID が未設定です（VITE_GOOGLE_CLIENT_ID）',
      }))
      return
    }
    if (!tokenClientRef.current) {
      setState((s) => ({
        ...s,
        error: 'Google認証ライブラリの読み込みに失敗しました。ページを再読み込みしてください。',
      }))
      return
    }
    isAutoAuthRef.current = false
    setState((s) => ({ ...s, isLoading: true, error: null }))
    tokenClientRef.current.requestAccessToken({ prompt: 'select_account' })
  }, [])

  // AUTO_AUTH_FLAG が 'true' かつ tokenClient が存在する場合のみサイレント再認証
  const silentReauth = useCallback(() => {
    if (localStorage.getItem(AUTO_AUTH_FLAG) === 'true' && tokenClientRef.current) {
      isAutoAuthRef.current = true
      tokenClientRef.current.requestAccessToken({ prompt: '' })
    }
  }, [])

  const signOut = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
    const token = state.accessToken
    if (token) {
      google.accounts.oauth2.revoke(token)
    }
    localStorage.removeItem(AUTO_AUTH_FLAG)
    localStorage.removeItem(USER_EMAIL_KEY)
    clearTokenFromSession()
    clearDriveCache()
    // 別アカウントへ切替時に前アカウントの fileId へ保存しないようクリア
    useUIStore.getState().setCurrentFileId(null)
    setState({ isSignedIn: false, accessToken: null, isLoading: false, error: null, userEmail: null })
  }, [state.accessToken])

  return { ...state, signIn, signOut, silentReauth, isGisReady, clientIdMissing: !GOOGLE_CLIENT_ID }
}
