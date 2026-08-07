import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import type { HttpAdapter } from '@ideamap/platform'

/** 疎通確認が固まらないよう接続待ちを打ち切る時間（ミリ秒） */
const REACHABILITY_TIMEOUT_MS = 2000

/**
 * デスクトップ版の HTTP アクセス。Rust 側の reqwest から発行するため
 * ブラウザの CORS 制約を受けない。ローカル LLM（Ollama）へ到達できるのはこの実装のおかげで、
 * デスクトップ版を作る主目的そのものにあたる（docs/desktop/README.md §3.3）。
 *
 * 到達先は capabilities/*.json の http スコープで許可したホストに限られる。
 */
export const desktopHttpAdapter: HttpAdapter = {
  async canReach(url) {
    try {
      await tauriFetch(url, { method: 'GET', connectTimeout: REACHABILITY_TIMEOUT_MS })
      return true
    } catch {
      return false
    }
  },

  request(input, init) {
    return tauriFetch(input, init)
  },

  getFetch() {
    // plugin-http の fetch は init が RequestInit & ClientOptions（より狭い型）のため
    // typeof fetch へそのままは代入できない。引数を素通しするラッパーで橋渡しする
    return ((input: RequestInfo | URL, init?: RequestInit) =>
      tauriFetch(input as string | URL | Request, init)) as typeof fetch
  },
}
