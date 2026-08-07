import { getPlatform } from '@ideamap/platform'
import type {
  JsonSchema,
  LLMProvider,
  LLMRequest,
  ModelInfo,
  ProviderCapabilities,
} from './types'
import { LLMError } from './types'
import { safeParseJson } from './jsonUtils'

export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434'

/**
 * モデルごとの実際のコンテキスト長は /api/show の model_info から取れるが、
 * キー名がモデルファミリーごとに異なり網羅できていない（docs/desktop/README.md §5 #5）。
 * 現時点では安全側の代表値を固定で持つ。
 */
const FALLBACK_MAX_CONTEXT_TOKENS = 8192

/** モデル一覧取得が固まらないよう接続待ちを打ち切る時間（ミリ秒） */
const LIST_MODELS_TIMEOUT_MS = 5000

interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OllamaChatResponse {
  message: { role: string; content: string }
  done: boolean
}

interface OllamaChatStreamChunk {
  message?: { role: string; content: string }
  done: boolean
}

interface OllamaTagsModel {
  name: string
  size: number
  details?: {
    parameter_size?: string
    quantization_level?: string
    family?: string
    /** Ollama 0.32 系の /api/tags が返す実コンテキスト長。旧バージョンには無い */
    context_length?: number
  }
}

function toOllamaMessages(req: LLMRequest): OllamaChatMessage[] {
  const systemMsg: OllamaChatMessage[] = req.system ? [{ role: 'system', content: req.system }] : []
  return [...systemMsg, ...req.messages.map((m) => ({ role: m.role, content: m.content }))]
}

function formatSize(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)}GB`
}

/**
 * ローカル Ollama（http://localhost:11434）を叩く LLMProvider 実装。
 *
 * HTTP の送出は必ず HttpAdapter 経由にする。デスクトップ版では Rust の reqwest から発行されるため
 * ブラウザの CORS 制約（OLLAMA_ORIGINS）を受けずに済み、これがデスクトップ版を作る主目的そのもの
 * にあたる（docs/desktop/README.md §3.3）。
 *
 * 全リクエストで `think: false` を送るのは、思考トークンが num_predict の枠を食って
 * 出力が途中で切れる（done_reason: 'length'）のを防ぐため。ClaudeProvider が thinking を
 * 明示的に無効化しているのと同じ理由で、両プロバイダの挙動もこれで揃う。
 */
export class OllamaProvider implements LLMProvider {
  readonly id = 'ollama' as const
  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    structuredOutput: 'json-schema',
    maxContextTokens: FALLBACK_MAX_CONTEXT_TOKENS,
    billed: false,
    supportsModelListing: true,
  }

  private readonly baseUrl: string
  private readonly model: string

  constructor(baseUrl: string, model: string) {
    this.baseUrl = baseUrl || DEFAULT_OLLAMA_BASE_URL
    this.model = model
  }

  private endpoint(path: string): string {
    return `${this.baseUrl.replace(/\/+$/, '')}${path}`
  }

  private connectionError(cause: unknown): LLMError {
    return new LLMError(
      'connection',
      'Ollamaに接続できませんでした。Ollamaが起動しているか、接続先URLが正しいか確認してください。',
      { provider: 'ollama', cause },
    )
  }

  private async toHttpError(res: Response): Promise<LLMError> {
    const text = await res.text().catch(() => '')
    if (res.status === 404) {
      return new LLMError(
        'notFound',
        `モデル「${this.model}」が見つかりません。「ollama pull ${this.model}」でモデルを取得してください。`,
        { provider: 'ollama', statusCode: 404, rawResponse: text },
      )
    }
    return new LLMError('unknown', `Ollamaがエラーを返しました（HTTP ${res.status}）`, {
      provider: 'ollama',
      statusCode: res.status,
      rawResponse: text,
    })
  }

  private async send(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
    try {
      return await getPlatform().http.request(this.endpoint(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      })
    } catch (e) {
      // Tauri の http プラグインは中断時に AbortError ではない独自の例外を投げるため signal を見て判定する
      if (signal?.aborted) throw new LLMError('aborted', 'キャンセルされました', { provider: 'ollama', cause: e })
      throw this.connectionError(e)
    }
  }

  /** POST /api/chat の共通処理。到達失敗・中断・HTTPエラーを LLMError に正規化する */
  private async post(
    path: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<Response> {
    let res = await this.send(path, body, signal)
    // think を解釈しないバージョン・モデルの組み合わせがありうるので、400 のときだけ外して1回だけ再送する
    if (res.status === 400 && 'think' in body) {
      await res.text().catch(() => '') // 破棄するレスポンスのボディを解放する
      const withoutThink = { ...body }
      delete withoutThink.think
      res = await this.send(path, withoutThink, signal)
    }
    if (!res.ok) throw await this.toHttpError(res)
    return res
  }

  async complete(req: LLMRequest, signal?: AbortSignal): Promise<string> {
    const res = await this.post(
      '/api/chat',
      {
        model: this.model,
        messages: toOllamaMessages(req),
        stream: false,
        think: false,
        options: { temperature: req.temperature ?? 0.7, num_predict: req.maxTokens },
      },
      signal,
    )
    const data = (await res.json()) as OllamaChatResponse
    return data.message.content
  }

  async completeJson<T>(req: LLMRequest, schema?: JsonSchema, signal?: AbortSignal): Promise<T> {
    // format にスキーマを渡すと Ollama 側で制約付きデコードが働き、JSON以外を出力しなくなる。
    // temperature: 0 は JSON構文エラーを減らすための公式ドキュメント推奨値。
    const res = await this.post(
      '/api/chat',
      {
        model: this.model,
        messages: toOllamaMessages(req),
        stream: false,
        think: false,
        format: schema ?? 'json',
        options: { temperature: 0, num_predict: req.maxTokens },
      },
      signal,
    )
    const data = (await res.json()) as OllamaChatResponse
    const content = data.message?.content ?? ''
    try {
      return safeParseJson<T>(content)
    } catch (e) {
      throw new LLMError('parse', 'AIの応答形式が不正でした。もう一度お試しください。', {
        provider: 'ollama',
        rawResponse: content,
        cause: e,
      })
    }
  }

  async stream(
    req: LLMRequest,
    onText: (accumulatedText: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const res = await this.post(
      '/api/chat',
      {
        model: this.model,
        messages: toOllamaMessages(req),
        stream: true,
        think: false,
        options: { temperature: req.temperature ?? 0.7, num_predict: req.maxTokens },
      },
      signal,
    )
    if (!res.body) {
      throw new LLMError('unknown', 'Ollamaがストリーミング応答を返しませんでした', { provider: 'ollama' })
    }

    // Ollama のストリーミング応答は NDJSON（改行区切りでJSONオブジェクトが1行ずつ届く）
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let accumulated = ''

    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? '' // 最後の未完成行は次のチャンクへ持ち越す
        for (const line of lines) {
          if (!line.trim()) continue
          const chunk = JSON.parse(line) as OllamaChatStreamChunk
          if (chunk.message?.content) {
            accumulated += chunk.message.content
            onText(accumulated)
          }
        }
      }
    } catch (e) {
      // 中断時はそれまでの累積テキストを返す（ClaudeProvider と同じ規約）
      if (signal?.aborted) return accumulated
      throw new LLMError('unknown', 'ストリーミング中にエラーが発生しました', { provider: 'ollama', cause: e })
    }
    return accumulated
  }

  /**
   * タイムアウト付きの GET。
   *
   * `AbortSignal.timeout()` を使わないのは、Tauri の http プラグインが signal の abort で
   * レスポンスボディの解放（fetch_cancel_body）を呼ぶため。読み終わったあとにタイマーが発火すると
   * 解放済みリソースを二重に解放して「The resource id ... is invalid」の未処理例外になる。
   * 応答を読み切った時点でタイマーを止める形にして、abort が後から走らないようにしている。
   */
  private async getWithTimeout(path: string): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), LIST_MODELS_TIMEOUT_MS)
    try {
      return await getPlatform().http.request(this.endpoint(path), {
        method: 'GET',
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    let res: Response
    try {
      res = await this.getWithTimeout('/api/tags')
    } catch (e) {
      throw this.connectionError(e)
    }
    if (!res.ok) throw await this.toHttpError(res)

    const data = (await res.json()) as { models?: OllamaTagsModel[] }
    const loaded = await this.loadedModelNames()

    return (data.models ?? []).map((m) => {
      const ctx = m.details?.context_length
      const parts = [
        m.details?.parameter_size,
        m.details?.quantization_level,
        formatSize(m.size),
        ctx ? `${Math.round(ctx / 1024)}Kコンテキスト` : undefined,
      ]
        .filter(Boolean)
        .join(' / ')
      return {
        id: m.name,
        label: m.name,
        description: parts || undefined,
        sizeBytes: m.size,
        contextTokens: ctx,
        loaded: loaded.has(m.name),
      }
    })
  }

  /** /api/ps でロード済み（初回応答が速い）モデルを拾う。取得できなくても一覧表示は続行する */
  private async loadedModelNames(): Promise<Set<string>> {
    try {
      const res = await this.getWithTimeout('/api/ps')
      if (!res.ok) return new Set()
      const data = (await res.json()) as { models?: { name: string }[] }
      return new Set((data.models ?? []).map((m) => m.name))
    } catch {
      return new Set()
    }
  }
}
