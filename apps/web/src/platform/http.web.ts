import type { HttpAdapter } from '@ideamap/platform'

/**
 * Web版の HTTP アクセス。ブラウザの fetch をそのまま使うため CORS 制約を受ける。
 * ローカル LLM（Ollama）へのアクセスは相手側の OLLAMA_ORIGINS 設定に依存し、
 * デフォルト設定のままでは到達できない。この制約を外すのがデスクトップ版の主目的。
 */
export const webHttpAdapter: HttpAdapter = {
  canAccessLocalServers: false,

  async canReach(url) {
    try {
      // no-cors では成否を判定できないため通常リクエストを投げ、
      // レスポンスが返ってきた時点（ステータス問わず）で到達可能とみなす
      await fetch(url, { method: 'GET' })
      return true
    } catch {
      return false
    }
  },
  request(input, init) {
    return fetch(input, init)
  },
  getFetch() {
    // 分離した fetch を素で呼ぶと Illegal invocation になるブラウザがあるため束縛して返す
    return globalThis.fetch.bind(globalThis)
  },
}
