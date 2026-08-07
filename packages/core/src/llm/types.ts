/**
 * LLMプロバイダ抽象化の共通型（Phase 32）。
 * Claude / Ollama など個別プロバイダの差は LLMProvider の実装内に閉じ込め、
 * 呼び出し側（aiService・UI）はこのファイルの型だけを見る。
 */

export interface LLMMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface LLMRequest {
  /** システムプロンプト（Claude は system パラメータ、Ollama は role:'system' メッセージに変換する） */
  system?: string
  messages: LLMMessage[]
  maxTokens: number
  /** 未指定時の既定値は各 Provider 実装が決める（Claude: SDK既定 / Ollama: 0.7） */
  temperature?: number
}

/** Ollama の format パラメータ・将来の JSON Schema 検証で共用する最小限の JSON Schema 型 */
export interface JsonSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean'
  properties?: Record<string, JsonSchema>
  items?: JsonSchema
  required?: string[]
  enum?: (string | number)[]
  description?: string
}

export interface ModelInfo {
  /** Claude: 'claude-sonnet-5' など固定ID / Ollama: 'gemma3:12b' など /api/tags の name */
  id: string
  /** UI表示用ラベル */
  label: string
  /** Ollama: パラメータ数・量子化レベルなど。Claude は省略 */
  description?: string
  /** Ollama のみ: ローカルディスク上のモデルサイズ（バイト） */
  sizeBytes?: number
  /** Ollama のみ: /api/tags の details.context_length（0.32 系以降が返す）。取れない場合は省略 */
  contextTokens?: number
  /** Ollama のみ: /api/ps 由来。ロード済み＝初回応答が速い */
  loaded?: boolean
}

export interface ProviderCapabilities {
  streaming: boolean
  /**
   * 構造化出力の実現方式。
   * 'json-schema' = format にスキーマを渡して制約付きデコードさせる（Ollama）
   * 'prompt-only' = 自然言語プロンプトで指示し、応答から正規表現でJSONブロックを抽出する（Claude）
   */
  structuredOutput: 'json-schema' | 'prompt-only'
  /** モデルの最大コンテキスト長（トークン） */
  maxContextTokens: number
  /** トークン課金が発生するか。Ollama は false */
  billed: boolean
  /** listModels() が意味のある動的一覧を返すか（Claude は固定リストなので false） */
  supportsModelListing: boolean
}

export type LLMErrorKind =
  | 'auth' // APIキー無効・未認証
  | 'rateLimit' // レート制限
  | 'connection' // ネットワーク到達不可（Ollama未起動を含む）
  | 'notFound' // モデル未インストールなど
  | 'parse' // JSON解析失敗
  | 'aborted' // ユーザーによるキャンセル
  | 'unknown'

export class LLMError extends Error {
  readonly kind: LLMErrorKind
  readonly provider: 'claude' | 'ollama'
  readonly statusCode?: number
  /** parse エラー時、UIで「AIの生レスポンスをコピー」できるよう保持する */
  readonly rawResponse?: string

  constructor(
    kind: LLMErrorKind,
    message: string,
    opts: {
      provider: 'claude' | 'ollama'
      statusCode?: number
      rawResponse?: string
      cause?: unknown
    },
  ) {
    super(message, { cause: opts.cause })
    // 呼び出し側（AISuggestionPanel）が name === 'AbortError' でキャンセルを判定しているため、
    // 中断のみ DOM 標準の例外名に合わせる。
    this.name = kind === 'aborted' ? 'AbortError' : 'LLMError'
    this.kind = kind
    this.provider = opts.provider
    this.statusCode = opts.statusCode
    this.rawResponse = opts.rawResponse
  }
}

export interface LLMProvider {
  readonly id: 'claude' | 'ollama'
  readonly capabilities: ProviderCapabilities

  /** 非ストリーミングのテキスト補完 */
  complete(req: LLMRequest, signal?: AbortSignal): Promise<string>

  /**
   * 構造化出力。Claude は「JSONのみで回答してください」という指示込みのプロンプトを前提に
   * 応答から最初の {...} ブロックを抽出してパースする。Ollama は schema を format に渡し、
   * モデル側の制約付きデコードでJSON以外を出力させない。
   */
  completeJson<T>(req: LLMRequest, schema?: JsonSchema, signal?: AbortSignal): Promise<T>

  /** ストリーミング補完。onText には「これまでの累積テキスト」を渡す。中断時はそれまでの累積テキストを返す */
  stream(
    req: LLMRequest,
    onText: (accumulatedText: string) => void,
    signal?: AbortSignal,
  ): Promise<string>

  /** 利用可能なモデル一覧。Ollama は /api/tags 由来の動的一覧、Claude は固定リスト */
  listModels(): Promise<ModelInfo[]>
}

/**
 * ユーザーによるキャンセルかどうかを判定する。
 *
 * `LLMError('aborted')` は `name` を DOM 標準の 'AbortError' に揃えているため、
 * プロバイダ由来の中断も `AbortController` 由来の中断も同じ条件で拾える。
 * UI 側が SDK の例外クラス（Anthropic.APIUserAbortError）を知らずに済むようにするための入口。
 */
export function isAbortError(e: unknown): boolean {
  return (e as { name?: string } | null)?.name === 'AbortError'
}
