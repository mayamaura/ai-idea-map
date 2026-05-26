import { useState, useCallback, useEffect, useRef } from 'react'
import { clearDriveCache } from '../services/googleDriveService'

const SCOPES = 'https://www.googleapis.com/auth/drive.file'

export interface GoogleAuthState {
  isSignedIn: boolean
  accessToken: string | null
  isLoading: boolean
  error: string | null
}

export function useGoogleAuth(clientId: string) {
  const [state, setState] = useState<GoogleAuthState>({
    isSignedIn: false,
    accessToken: null,
    isLoading: false,
    error: null,
  })
  const tokenClientRef = useRef<TokenClient | null>(null)
  const [isGisReady, setIsGisReady] = useState(false)

  useEffect(() => {
    if (!clientId) return

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
  }, [clientId])

  useEffect(() => {
    if (!isGisReady || !clientId) return

    tokenClientRef.current = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
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
  }, [isGisReady, clientId])

  const signIn = useCallback(() => {
    if (!tokenClientRef.current) return
    setState((s) => ({ ...s, isLoading: true, error: null }))
    tokenClientRef.current.requestAccessToken({ prompt: '' })
  }, [])

  const signOut = useCallback(() => {
    const token = state.accessToken
    if (token) {
      google.accounts.oauth2.revoke(token)
    }
    clearDriveCache()
    setState({ isSignedIn: false, accessToken: null, isLoading: false, error: null })
  }, [state.accessToken])

  return { ...state, signIn, signOut, isGisReady }
}
