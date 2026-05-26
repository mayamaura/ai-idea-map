interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
  error?: string
  error_description?: string
}

interface TokenClient {
  requestAccessToken(overrideConfig?: { prompt?: string; hint?: string }): void
}

interface TokenClientConfig {
  client_id: string
  scope: string
  callback: (response: TokenResponse) => void
  error_callback?: (error: { type: string; message?: string }) => void
}

declare const google: {
  accounts: {
    oauth2: {
      initTokenClient(config: TokenClientConfig): TokenClient
      revoke(token: string, callback?: () => void): void
    }
  }
}
