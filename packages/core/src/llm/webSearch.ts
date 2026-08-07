import { getPlatform } from '@ideamap/platform'
import { LLMError } from './types'

/**
 * Ollama の Web Search API（https://docs.ollama.com/capabilities/web-search）。
 *
 * ローカルの Ollama サーバーではなく ollama.com のホスト型APIで、認証は
 * ollama.com のアカウントで発行する API キー（Bearer）。LLM本体が Claude でも使えるため、
 * プロバイダ選択とは独立した機能として扱う。
 *
 * ブラウザからは CORS で叩けないため、デスクトップ版（plugin-http 経由）専用。
 */
const WEB_SEARCH_URL = 'https://ollama.com/api/web_search'

/** 1回の検索で取り込む件数。API の上限は 10 */
const MAX_RESULTS = 5

/**
 * 1件あたりの本文の切り詰め長（文字）。
 * 公式ドキュメントは「検索結果は数千トークンになるのでコンテキスト長を32K以上に」と書いているが、
 * 本アプリはスニペット利用に限定してローカル小型モデルでも破綻しない量に抑える。
 */
const MAX_CONTENT_CHARS = 600

/** 検索が固まったままにならないよう打ち切る時間（ミリ秒） */
const TIMEOUT_MS = 15000

export interface WebSearchResult {
  title: string
  url: string
  content: string
}

/** AI機能に注入する検索の入口。将来別の検索バックエンドを足す場合もこの形を保つ */
export interface WebSearchClient {
  search(query: string, signal?: AbortSignal): Promise<WebSearchResult[]>
}

function truncate(text: string): string {
  const t = text.trim()
  return t.length > MAX_CONTENT_CHARS ? `${t.slice(0, MAX_CONTENT_CHARS)}…` : t
}

export class OllamaWebSearchClient implements WebSearchClient {
  private readonly apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async search(query: string, signal?: AbortSignal): Promise<WebSearchResult[]> {
    if (!query.trim()) return []

    // 呼び出し側の中断と検索自体のタイムアウトの両方で打ち切る。
    // AbortSignal.timeout() を直接 plugin-http に渡すと読了後の abort が
    // ボディの二重解放になるため、必ず自前のタイマーを clearTimeout する（design.md §9.1.2）
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const onOuterAbort = () => controller.abort()
    signal?.addEventListener('abort', onOuterAbort)

    let res: Response
    try {
      res = await getPlatform().http.request(WEB_SEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ query, max_results: MAX_RESULTS }),
        signal: controller.signal,
      })
    } catch (e) {
      if (signal?.aborted) {
        throw new LLMError('aborted', 'キャンセルされました', { provider: 'ollama', cause: e })
      }
      throw new LLMError(
        'connection',
        'Web検索に接続できませんでした。ネットワーク接続を確認してください。',
        { provider: 'ollama', cause: e },
      )
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onOuterAbort)
    }

    if (!res.ok) throw await toSearchError(res)

    const data = (await res.json()) as { results?: WebSearchResult[] }
    return (data.results ?? []).map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      content: truncate(r.content ?? ''),
    }))
  }
}

async function toSearchError(res: Response): Promise<LLMError> {
  const body = await res.text().catch(() => '')
  if (res.status === 401 || res.status === 403) {
    return new LLMError(
      'auth',
      'Web検索のAPIキーが無効です。設定画面で ollama.com のAPIキーを確認してください。',
      { provider: 'ollama', statusCode: res.status, rawResponse: body },
    )
  }
  if (res.status === 429) {
    return new LLMError('rateLimit', 'Web検索の利用上限に達しました。しばらく待ってから再試行してください。', {
      provider: 'ollama',
      statusCode: 429,
      rawResponse: body,
    })
  }
  return new LLMError('unknown', `Web検索がエラーを返しました（HTTP ${res.status}）`, {
    provider: 'ollama',
    statusCode: res.status,
    rawResponse: body,
  })
}

/** 検索結果をプロンプトに埋め込むブロックへ整形する。結果が無ければ空文字を返す */
export function formatWebSearchBlock(results: WebSearchResult[]): string {
  if (results.length === 0) return ''
  const body = results
    .map((r, i) => `${i + 1}. ${r.title}（${r.url}）\n${r.content}`)
    .join('\n\n')
  return `\n\n【Web検索で取得した最新情報】
以下は検索エンジンから取得した外部情報です。学習データより新しい可能性があるため、内容が食い違う場合はこちらを優先してください。関係のない項目は無視してかまいません。
${body}`
}
