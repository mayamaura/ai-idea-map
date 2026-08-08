import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { openUrl } from '@tauri-apps/plugin-opener'
import { getPlatform } from '@ideamap/platform'

/**
 * デスクトップ版の Google 認可フロー（ループバック + PKCE、RFC 8252）。
 *
 * Web版が使う GIS のトークンモデルは組み込み WebView から認可画面を開けない
 * （Google が `disallowed_useragent` で拒否する）ため、認可画面は OS 既定ブラウザに出し、
 * Rust 側が一時的に立てた `http://127.0.0.1:<port>` でリダイレクトを受け取る。
 *
 * 認可コードは Cloud Console で「デスクトップアプリ」種別として発行した
 * クライアントIDに対して発行される。ポートは事前登録が不要なので毎回変わってよい。
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_DESKTOP_CLIENT_ID as string | undefined
/**
 * 同じクライアントのシークレット。
 *
 * 実装当初は「PKCE を併用すれば省略できる」と判断していたが、実機で試すと
 * デスクトップアプリ種別のクライアントでは 400 invalid_request
 * "client_secret is missing." が返るため必須。公開クライアントである以上
 * これは機密ではなく、PKCE が本来の防御になっている（RFC 8252）。
 */
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_DESKTOP_CLIENT_SECRET as string | undefined

/** drive.file でファイル保存、openid + email で接続アカウントのメールアドレスを取得 */
const SCOPES = 'https://www.googleapis.com/auth/drive.file openid email'
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke'
const CALLBACK_EVENT = 'ideamap://oauth-callback'

/** SecretAdapter（OSキーチェーン）に置くリフレッシュトークンのスロット名 */
export const REFRESH_TOKEN_SECRET = 'googleRefreshToken'

export const isDesktopClientIdMissing = !CLIENT_ID

export interface GoogleTokens {
  accessToken: string
  /** 有効期間（秒）。Google は通常 3600 を返す */
  expiresIn: number
  /** 再認可なしで更新するための長期トークン。初回サインイン時のみ返る */
  refreshToken: string | null
  email: string | null
}

interface OauthStartInfo {
  port: number
  codeChallenge: string
}

interface OauthCallback {
  code: string | null
  error: string | null
}

interface TokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  id_token?: string
}

/** PKCE の code_verifier / state 用のランダム文字列（base64url） */
function randomUrlSafe(byteLength: number): string {
  const bytes = new Uint8Array(byteLength)
  // getRandomValues はセキュアコンテキストの制約を受けない（crypto.subtle とは異なる）
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * ID トークン（JWT）の payload から email を取り出す。
 * Google のトークンエンドポイントから TLS 経由で直接受け取ったものなので署名検証は不要。
 */
function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null
  try {
    const payload = idToken.split('.')[1]
    if (!payload) return null
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    )
    return (JSON.parse(json) as { email?: string }).email ?? null
  } catch {
    // メールアドレスは表示用でしかないため、読めなくても認証は成功として扱う
    return null
  }
}

async function postForm(url: string, params: Record<string, string>): Promise<Response> {
  return getPlatform().http.request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  })
}

function requireClientId(): string {
  if (!CLIENT_ID) {
    throw new Error('Google Client ID が未設定です（VITE_GOOGLE_DESKTOP_CLIENT_ID）')
  }
  return CLIENT_ID
}

/**
 * トークンエンドポイントのエラー応答を読み解く。
 * Google は原因を本文の `error` / `error_description` に入れて返すので、
 * ステータスコードだけを見せると設定ミスの切り分けができない。
 */
async function describeTokenError(res: Response): Promise<string> {
  const body = await res.text().catch(() => '')
  try {
    const parsed = JSON.parse(body) as { error?: string; error_description?: string }
    if (parsed.error) {
      const detail = parsed.error_description ? `: ${parsed.error_description}` : ''
      return `${parsed.error}${detail}${hintFor(parsed.error, parsed.error_description)}`
    }
  } catch {
    // JSON でない応答（プロキシのエラーページ等）はそのまま見せる
  }
  return body.slice(0, 200)
}

/** 設定ミスとして頻出するものだけ、次に何をすればよいかを添える */
function hintFor(error: string, description?: string): string {
  const text = `${error} ${description ?? ''}`
  if (text.includes('client_secret')) {
    return '（.env に VITE_GOOGLE_DESKTOP_CLIENT_SECRET を設定してください）'
  }
  if (error === 'invalid_client') {
    return '（クライアントIDとシークレットが「デスクトップアプリ」種別のものか確認してください）'
  }
  if (error === 'redirect_uri_mismatch') {
    return '（OAuth クライアントの種別が「ウェブアプリケーション」になっている可能性があります。「デスクトップアプリ」で作り直してください）'
  }
  return ''
}

/**
 * OS 既定ブラウザで認可画面を開き、リダイレクトを受け取ってトークンに交換する。
 * ユーザーがブラウザで許可するまで戻らない（上限5分で timeout エラー）。
 */
export async function signInWithGoogle(): Promise<GoogleTokens> {
  const clientId = requireClientId()
  const codeVerifier = randomUrlSafe(32)
  const state = randomUrlSafe(16)

  const { port, codeChallenge } = await invoke<OauthStartInfo>('start_oauth_loopback', {
    codeVerifier,
    state,
  })
  // ループバックは 127.0.0.1 を使う。localhost はファイアウォールで弾かれることがあると
  // Google 公式が明記しているため
  const redirectUri = `http://127.0.0.1:${port}`

  const authUrl =
    `${AUTH_ENDPOINT}?` +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
    }).toString()

  let resolveCallback!: (value: OauthCallback) => void
  const callback = new Promise<OauthCallback>((resolve) => {
    resolveCallback = resolve
  })
  // 購読はブラウザを開く前に張る。認可が即座に終わる場合にイベントを取りこぼさないため
  const unlisten = await listen<OauthCallback>(CALLBACK_EVENT, (event) => {
    resolveCallback(event.payload)
  })

  try {
    await openUrl(authUrl)
    const result = await callback

    if (result.error || !result.code) {
      throw new Error(friendlyAuthError(result.error))
    }

    const params: Record<string, string> = {
      client_id: clientId,
      code: result.code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }
    if (CLIENT_SECRET) params.client_secret = CLIENT_SECRET

    const res = await postForm(TOKEN_ENDPOINT, params)
    if (!res.ok) {
      throw new Error(`トークンの取得に失敗しました（${res.status}）${await describeTokenError(res)}`)
    }
    const token = (await res.json()) as TokenResponse
    return {
      accessToken: token.access_token,
      expiresIn: token.expires_in,
      // installed app では常にリフレッシュトークンが返る（access_type=offline は不要）
      refreshToken: token.refresh_token ?? null,
      email: emailFromIdToken(token.id_token),
    }
  } finally {
    unlisten()
    await invoke('cancel_oauth_loopback').catch(() => {
      /* サーバは結果を返した時点で自力で畳んでいる。二重停止の失敗は実害がない */
    })
  }
}

/** キーチェーンのリフレッシュトークンでアクセストークンを取り直す（ブラウザを開かない） */
export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const clientId = requireClientId()
  const params: Record<string, string> = {
    client_id: clientId,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  }
  if (CLIENT_SECRET) params.client_secret = CLIENT_SECRET

  const res = await postForm(TOKEN_ENDPOINT, params)
  if (!res.ok) {
    throw new Error(`再認証に失敗しました（${res.status}）${await describeTokenError(res)}`)
  }
  const token = (await res.json()) as TokenResponse
  return {
    accessToken: token.access_token,
    expiresIn: token.expires_in,
    // 更新時はリフレッシュトークンが返らないので、呼び出し元は既存の値を保つ
    refreshToken: token.refresh_token ?? null,
    email: emailFromIdToken(token.id_token),
  }
}

/** Google 側の許可を取り消す。失敗しても手元の状態は破棄する */
export async function revokeGoogleToken(token: string): Promise<void> {
  await postForm(REVOKE_ENDPOINT, { token }).catch(() => {
    /* 失効済み・オフラインでも手元のサインアウトは進める */
  })
}

function friendlyAuthError(error: string | null): string {
  if (error === 'timeout') return 'ブラウザでの認証が時間内に完了しませんでした'
  if (error === 'access_denied') return 'Googleへのアクセスが許可されませんでした'
  if (error === 'state_mismatch') return '認証リクエストの照合に失敗しました。もう一度お試しください'
  return `Google認証でエラーが発生しました（${error ?? '不明'}）`
}
