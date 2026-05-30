import { useState, useCallback, useEffect, useRef } from 'react'
import { clearDriveCache } from '../services/googleDriveService'

const SCOPES = 'https://www.googleapis.com/auth/drive.file'
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

export interface GoogleAuthState {
  isSignedIn: boolean
  accessToken: string | null
  isLoading: boolean
  error: string | null
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

  useEffect(() => {
    if (!isGisReady || !GOOGLE_CLIENT_ID) return

    tokenClientRef.current = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          setState((s) => ({
            ...s,
            isLoading: false,
            error: response.error_description ?? response.error ?? '認証エラー',
          }))
          return
        }
        setState({
          isSignedIn: true,
          accessToken: response.access_token,
          isLoading: false,
          error: null,
        })
      },
      error_callback: (err) => {
        setState((s) => ({
          ...s,
          isLoading: false,
          error: err.type === 'popup_closed' ? null : err.type,
        }))
      },
    })
  }, [isGisReady])

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
    setState((s) => ({ ...s, isLoading: true, error: null }))
    tokenClientRef.current.requestAccessToken({ prompt: 'select_account' })
  }, [])

  const signOut = useCallback(() => {
    const token = state.accessToken
    if (token) {
      google.accounts.oauth2.revoke(token)
    }
    clearDriveCache()
    setState({ isSignedIn: false, accessToken: null, isLoading: false, error: null })
  }, [state.accessToken])

  return { ...state, signIn, signOut, isGisReady, clientIdMissing: !GOOGLE_CLIENT_ID }
}
