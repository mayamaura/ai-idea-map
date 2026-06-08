import { useState, useCallback, useEffect, useRef } from 'react'
import { clearDriveCache } from '../services/googleDriveService'
import { useUIStore } from '../stores/uiStore'

const SCOPES = 'https://www.googleapis.com/auth/drive.file'
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const AUTO_AUTH_FLAG = 'googleAuthRequested'
const TOKEN_STORAGE_KEY = 'googleAccessToken'
const TOKEN_EXPIRY_KEY = 'googleTokenExpiry'
// トークン有効期限の5分前に失効扱い
const EXPIRY_BUFFER_MS = 5 * 60 * 1000

export interface GoogleAuthState {
  isSignedIn: boolean
  accessToken: string | null
  isLoading: boolean
  error: string | null
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

export function useGoogleAuth() {
  const [state, setState] = useState<GoogleAuthState>({
    isSignedIn: false,
    accessToken: null,
    isLoading: false,
    error: null,
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
        setState({
          isSignedIn: true,
          accessToken: response.access_token,
          isLoading: false,
          error: null,
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
          error: err.type === 'popup_closed' ? null : err.type,
        }))
      },
    })

    // sessionStorage に有効なトークンが残っていればすぐに復元
    const savedToken = loadTokenFromSession()
    if (savedToken) {
      setState({ isSignedIn: true, accessToken: savedToken, isLoading: false, error: null })
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

    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current)
      }
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
    clearTokenFromSession()
    clearDriveCache()
    // 別アカウントへ切替時に前アカウントの fileId へ保存しないようクリア
    useUIStore.getState().setCurrentFileId(null)
    setState({ isSignedIn: false, accessToken: null, isLoading: false, error: null })
  }, [state.accessToken])

  return { ...state, signIn, signOut, isGisReady, clientIdMissing: !GOOGLE_CLIENT_ID }
}
