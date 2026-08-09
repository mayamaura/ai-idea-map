import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import type { HttpAdapter } from '@ideamap/platform'

/** 疎通確認が固まらないよう接続待ちを打ち切る時間（ミリ秒） */
const REACHABILITY_TIMEOUT_MS = 2000

/**
 * plugin-http は webview の URL から Origin ヘッダを勝手に付ける。
 * 開発時は devUrl の `http://localhost:5174` なので Ollama の既定 CORS 許可に引っかからないが、
 * 本番ビルドでは `http://tauri.localhost` になり、Ollama がこれを許可していないため 403 を返す。
 * 空文字を渡すと Rust 側が Origin ごと落とすので、そこに乗せて全リクエストから外す。
 * デスクトップの通信はブラウザ由来ではなく、Origin を送る理由がそもそもない。
 * （空文字の解釈には unsafe-headers feature が必要。src-tauri/Cargo.toml を参照）
 */
function withoutOrigin<T extends RequestInit>(init?: T): T {
  const headers = new Headers(init?.headers)
  headers.set('Origin', '')
  return { ...(init as T), headers }
}

/**
 * デスクトップ版の HTTP アクセス。Rust 側の reqwest から発行するため
 * ブラウザの CORS 制約を受けない。ローカル LLM（Ollama）へ到達できるのはこの実装のおかげで、
 * デスクトップ版を作る主目的そのものにあたる（docs/desktop/README.md §3.3）。
 *
 * 到達先は capabilities/*.json の http スコープで許可したホストに限られる。
 */
export const desktopHttpAdapter: HttpAdapter = {
  canAccessLocalServers: true,

  async canReach(url) {
    try {
      await tauriFetch(url, withoutOrigin({ method: 'GET', connectTimeout: REACHABILITY_TIMEOUT_MS }))
      return true
    } catch {
      return false
    }
  },

  request(input, init) {
    return tauriFetch(input, withoutOrigin(init))
  },

  getFetch() {
    // plugin-http の fetch は init が RequestInit & ClientOptions（より狭い型）のため
    // typeof fetch へそのままは代入できない。引数を素通しするラッパーで橋渡しする
    return ((input: RequestInfo | URL, init?: RequestInit) =>
      tauriFetch(input as string | URL | Request, withoutOrigin(init))) as typeof fetch
  },
}
