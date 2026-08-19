import { getPlatform } from '@ideamap/platform'
import type {
  JsonSchema,
  LLMProvider,
  LLMRequest,
  ModelInfo,
  ProviderCapabilities,
} from './types'
import { LLMError } from './types'
import { extractJsonBlock } from './jsonUtils'
import { createTimeoutSignal, postWithParamFallback, readLineStream } from './httpProviderUtils'

const CHAT_URL = 'https://api.openai.com/v1/chat/completions'
const MODELS_URL = 'https://api.openai.com/v1/models'

/** 初回のみ使う既定モデル。実際の選択肢は listModels() の動的一覧から選ぶ */
export const DEFAULT_OPENAI_MODEL = 'gpt-5.1'

/** モデルごとに異なるが、UI の目安表示にしか使っていないので代表値を持つ */
const FALLBACK_MAX_CONTEXT_TOKENS = 400_000

/** モデル一覧取得が固まらないよう接続待ちを打ち切る時間（ミリ秒） */
const LIST_MODELS_TIMEOUT_MS = 10_000

/**
 * reasoning 系モデルは temperature を送ると 400（無視ではなくエラー）を返す。
 * response_format も対応がモデル次第なので、400 のときだけまとめて落として1回だけ再送する
 * （OllamaProvider が think でやっているのと同じ方式）。
 */
const OPTIONAL_PARAMS = ['temperature', 'response_format'] as const

/**
 * /v1/models は埋め込み・音声・画像モデルまで返すが、用途を判別できるフィールドが無い。
 * ID で機械的に絞るしかないので、チャット以外に使われる語を除外する。
 */
const NON_CHAT_PATTERN =
  /embedding|whisper|tts|dall-e|moderation|audio|realtime|transcribe|image|instruct|sora/

interface OpenAIModelsResponse {
  data?: { id: string }[]
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[]
}

interface ChatCompletionChunk {
  choices?: { delta?: { content?: string } }[]
}

interface ErrorPayload {
  error?: { message?: string }
}

function toChatMessages(req: LLMRequest): ChatMessage[] {
  const system: ChatMessage[] = req.system ? [{ role: 'system', content: req.system }] : []
  return [...system, ...req.messages.map((m) => ({ role: m.role, content: m.content }))]
}

/** エラーボディから人が読める説明を取り出す。JSON でない応答もありうるので握りつぶす */
function errorDetail(text: string): string {
  try {
    return (JSON.parse(text) as ErrorPayload).error?.message ?? ''
  } catch {
    return ''
  }
}

/**
 * OpenAI の Chat Completions API を叩く LLMProvider 実装。
 *
 * api.openai.com は CORS を許可している（Origin をエコーし authorization ヘッダも通す）ため、
 * Ollama と違ってWeb版のブラウザからも直接呼べる。HTTP の送出は他プロバイダと揃えて
 * HttpAdapter 経由にし、packages/core が fetch を直接呼ばない制約を守る。
 */
export class OpenAIProvider implements LLMProvider {
  readonly id = 'openai' as const
  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    // response_format: json_object はスキーマを取らないので、出力の形はプロンプト側の指示に任せる
    structuredOutput: 'prompt-only',
    maxContextTokens: FALLBACK_MAX_CONTEXT_TOKENS,
    billed: true,
    supportsModelListing: true,
  }

  private readonly apiKey: string
  private readonly model: string

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey
    this.model = model || DEFAULT_OPENAI_MODEL
  }

  private connectionError(cause: unknown): LLMError {
    return new LLMError(
      'connection',
      'OpenAIに接続できませんでした。ネットワーク接続を確認してください。',
      { provider: 'openai', cause },
    )
  }

  private async toHttpError(res: Response): Promise<LLMError> {
    const text = await res.text().catch(() => '')
    const detail = errorDetail(text)

    if (res.status === 401 || res.status === 403) {
      return new LLMError(
        'auth',
        'OpenAIの認証に失敗しました。APIキーが有効か設定画面で確認してください。',
        { provider: 'openai', statusCode: res.status, rawResponse: text },
      )
    }
    if (res.status === 404) {
      return new LLMError(
        'notFound',
        `モデル「${this.model}」が見つかりません。設定画面で使用モデルを選び直してください。`,
        { provider: 'openai', statusCode: 404, rawResponse: text },
      )
    }
    if (res.status === 429) {
      // 頻度超過と課金枠切れの両方が 429 で返るので、原因の切り分けは detail に委ねる
      return new LLMError(
        'rateLimit',
        detail || 'OpenAIのレート制限に達しました。しばらく待ってから再試行してください。',
        { provider: 'openai', statusCode: 429, rawResponse: text },
      )
    }
    return new LLMError('unknown', detail || `OpenAIがエラーを返しました（HTTP ${res.status}）`, {
      provider: 'openai',
      statusCode: res.status,
      rawResponse: text,
    })
  }

  private async send(body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
    try {
      return await getPlatform().http.request(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      })
    } catch (e) {
      // Tauri の http プラグインは中断時に AbortError ではない独自の例外を投げるため signal を見て判定する
      if (signal?.aborted) {
        throw new LLMError('aborted', 'キャンセルされました', { provider: 'openai', cause: e })
      }
      throw this.connectionError(e)
    }
  }

  /** POST /chat/completions の共通処理。到達失敗・中断・HTTPエラーを LLMError に正規化する */
  private async post(body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
    return postWithParamFallback(
      (b) => this.send(b, signal),
      body,
      OPTIONAL_PARAMS,
      (res) => this.toHttpError(res),
    )
  }

  async complete(req: LLMRequest, signal?: AbortSignal): Promise<string> {
    // max_tokens は非推奨かつ reasoning 系と非互換なので max_completion_tokens を使う
    const res = await this.post(
      {
        model: this.model,
        messages: toChatMessages(req),
        stream: false,
        max_completion_tokens: req.maxTokens,
        ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
      },
      signal,
    )
    const data = (await res.json()) as ChatCompletionResponse
    return data.choices?.[0]?.message?.content ?? ''
  }

  async completeJson<T>(req: LLMRequest, _schema?: JsonSchema, signal?: AbortSignal): Promise<T> {
    // json_object は「プロンプトに JSON という語を含むこと」が条件だが、
    // 呼び出し側（aiService）のプロンプトはいずれもJSON形式を明示しているので満たしている。
    const res = await this.post(
      {
        model: this.model,
        messages: toChatMessages(req),
        stream: false,
        response_format: { type: 'json_object' },
        temperature: 0,
        max_completion_tokens: req.maxTokens,
      },
      signal,
    )
    const data = (await res.json()) as ChatCompletionResponse
    const content = data.choices?.[0]?.message?.content ?? ''
    try {
      // response_format が落ちて前置き付きで返る場合に備え、最初の {...} ブロックを取り出す
      return extractJsonBlock<T>(content)
    } catch (e) {
      throw new LLMError('parse', 'AIの応答形式が不正でした。もう一度お試しください。', {
        provider: 'openai',
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
      {
        model: this.model,
        messages: toChatMessages(req),
        stream: true,
        max_completion_tokens: req.maxTokens,
        ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
      },
      signal,
    )
    if (!res.body) {
      throw new LLMError('unknown', 'OpenAIがストリーミング応答を返しませんでした', {
        provider: 'openai',
      })
    }

    // レスポンスは SSE。`data: {...}` の行が並び、`data: [DONE]` で終わる
    let accumulated = ''
    await readLineStream(
      res.body,
      (line) => {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) return
        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') return true
        const delta = (JSON.parse(payload) as ChatCompletionChunk).choices?.[0]?.delta?.content
        if (delta) {
          accumulated += delta
          onText(accumulated)
        }
      },
      signal,
      'openai',
    )
    return accumulated
  }

  async listModels(): Promise<ModelInfo[]> {
    const { signal, cleanup } = createTimeoutSignal(LIST_MODELS_TIMEOUT_MS)
    let res: Response
    try {
      res = await getPlatform().http.request(MODELS_URL, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal,
      })
    } catch (e) {
      throw this.connectionError(e)
    } finally {
      cleanup()
    }
    if (!res.ok) throw await this.toHttpError(res)

    const data = (await res.json()) as OpenAIModelsResponse
    return (data.data ?? [])
      .filter((m) => /^(gpt-|o\d)/.test(m.id) && !NON_CHAT_PATTERN.test(m.id))
      .map((m) => ({ id: m.id, label: m.id }))
      .sort((a, b) => a.id.localeCompare(b.id))
  }
}
