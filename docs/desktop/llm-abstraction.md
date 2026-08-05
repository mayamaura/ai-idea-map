# LLMプロバイダ抽象化設計書（Claude API / ローカル Ollama 対応）

**作成日**: 2026-08-05
**バージョン**: 1.0
**対象**: デスクトップ版（Tauri v2）における LLM プロバイダ抽象化レイヤーの設計

> **先に [README.md](README.md) を読んでください。** ドキュメント間で結論が食い違う箇所は README §3 の裁定が優先されます。本書に関係する裁定は次の2点です。
> - 本書はモノレポ移行前の構成（`src/services/llm/`）を前提に書かれています。**移行後の配置は `packages/core/src/llm/`** です。パス対応表は README §3.3 にあります。
> - `packages/core` は `fetch` を直接呼べません。`ClaudeProvider`/`OllamaProvider` の HTTP 呼び出しは必ず `getPlatform().http`（`HttpAdapter`、[architecture.md](architecture.md) §3）経由にしてください。Web版は `fetch`、デスクトップ版は `@tauri-apps/plugin-http` に解決され、**Ollama の CORS 問題はこの1箇所で解決します**。本書中の直接 `fetch` を使ったコード例は、この Adapter 経由に読み替えてください。

---

## 0. 目的とスコープ

現在の Web 版 `ideamap/` は `src/services/claudeService.ts` が `@anthropic-ai/sdk` を `dangerouslyAllowBrowser: true` でブラウザから直接呼び出す実装になっている。デスクトップ版（Tauri v2）を作る主目的は **ローカル LLM（Ollama）対応** であり、Web 版は引き続き Claude API のみを使う。

本ドキュメントでは、

1. `claudeService.ts` の実装を「Claude 固有の部分」と「プロバイダ非依存の部分」に分離し、
2. `LLMProvider` という共通インタフェースを設計し、
3. `ClaudeProvider` と `OllamaProvider` の2実装でそれを満たし、
4. 既存の Web 版の挙動を一切変えずに段階移行する

ための設計を行う。今後の実装は Claude Code（AIエージェント）が主に担うため、各ステップに明確な完了条件を付ける。

---

## 1. 現状分析

`claudeService.ts`（486行）が提供する機能は次の5つ＋エラー整形ユーティリティ1つ。

| 関数 | 役割 | 出力形式 |
|---|---|---|
| `generateSuggestions` | 選択ノードを起点にアイデアを提案 | JSON（`{ suggestions: AISuggestion[] }`） |
| `analyzeMap` | マップ全体を分析 | JSON（`MapAnalysis`） |
| `suggestConnections` | 未接続だが関連性の高いノード対を提案 | JSON（`{ suggestions: ConnectionSuggestion[] }`） |
| `suggestClusters` | ノードをテーマ別にグループ化 | JSON（`{ clusters: ... }`） |
| `chatWithMap` | マップを文脈にした自由対話（ストリーミング） | テキスト＋末尾の &#96;&#96;&#96;actions ブロック |
| `toFriendlyAIError` | 例外を日本語の文言に変換 | — |

これを「プロンプト構築」「JSON抽出とサニタイズ」「ストリーミング」「エラー分類」「中断（AbortSignal）」の5観点で整理すると、**Claude SDK に依存しているのは実質「APIを呼ぶ部分」と「エラー分類」だけ**で、プロンプトの文字列組み立てとJSON抽出ロジックは完全にプロバイダ非依存であることがわかる。

| 機能 | プロンプト構築 | JSON抽出とサニタイズ | ストリーミング | エラー分類 | 中断(AbortSignal) |
|---|---|---|---|---|---|
| `generateSuggestions` | 非依存（テンプレート文字列の組み立てのみ） | 非依存（`sanitizeJsonString`/`safeParseJson` は純粋関数、`content.text.match(/\{[\s\S]*\}/)` で抽出） | 未使用 | Claude依存（呼び出し元で `Anthropic.APIUserAbortError` を判定） | 対応済み（`{ signal }` を `messages.create` に渡す） |
| `analyzeMap` | 非依存 | 非依存 | 未使用 | Claude依存 | **未対応**（`signal` 引数自体が無い） |
| `suggestConnections` | 非依存 | 非依存 | 未使用 | Claude依存 | **未対応** |
| `suggestClusters` | 非依存 | 非依存 | 未使用 | Claude依存 | **未対応** |
| `chatWithMap` | 非依存（`systemContext` の組み立てのみ） | 非依存（&#96;&#96;&#96;actions ブロックは `JSON.parse` のみで `sanitizeJsonString` は未使用＝JSON抽出ロジックが2系統に分かれている） | **Claude依存**（`client.messages.stream()` + `.on('text')`） | Claude依存 | 対応済み |
| `toFriendlyAIError` | — | — | — | **完全にClaude依存**（`Anthropic.APIConnectionError` / `Anthropic.APIError` の `status` 判定） | — |

この分析から得られる設計上の結論は3つ。

1. **プロンプト文字列の組み立てとJSON抽出は共通化できる**。`LLMProvider` の実装差はAPI呼び出しとレスポンスの取り出し方だけに閉じ込められる。
2. **`analyzeMap` / `suggestConnections` / `suggestClusters` に `AbortSignal` が無いのは既存の実装漏れ**。Ollamaのローカル小型モデルはClaudeより応答が遅くなりうるため、この抽象化を機にキャンセル対応を統一する。
3. **JSON抽出ロジックが2系統ある**（`safeParseJson`＋`sanitizeJsonString` と、`chatWithMap` の素の `JSON.parse`）。抽象化のタイミングで `LLMProvider.completeJson` 経由の1系統に統一する。

---

## 2. `LLMProvider` インタフェース設計

新設するディレクトリ構成:

```
src/services/llm/
├── types.ts             # LLMProvider / LLMRequest / ModelInfo / LLMError などの型
├── jsonUtils.ts          # sanitizeJsonString / safeParseJson（claudeService.ts から移設）
├── claudeProvider.ts      # ClaudeProvider 実装
├── ollamaProvider.ts      # OllamaProvider 実装
└── providerFactory.ts     # settingsStore の状態から LLMProvider を生成
```

### 2.1 共通リクエスト型

```typescript
// src/services/llm/types.ts

export interface LLMMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface LLMRequest {
  /** システムプロンプト（Claude は system パラメータ、Ollama は role:'system' メッセージに変換） */
  system?: string
  messages: LLMMessage[]
  maxTokens: number
  /** 未指定時の既定値は各 Provider 実装が決める（Claude:1.0相当のSDK既定 / Ollama:0.7） */
  temperature?: number
}
```

### 2.2 構造化出力用のスキーマ型

```typescript
/** Ollama の format パラメータ・将来の JSON Schema 検証で共用する最小限の JSON Schema 型 */
export interface JsonSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean'
  properties?: Record<string, JsonSchema>
  items?: JsonSchema
  required?: string[]
  enum?: (string | number)[]
  description?: string
}
```

### 2.3 モデル情報・プロバイダ能力

```typescript
export interface ModelInfo {
  /** Claude: 'claude-sonnet-5' など固定ID / Ollama: 'gemma3:12b' など /api/tags の name */
  id: string
  /** UI表示用ラベル */
  label: string
  /** Ollama: パラメータ数・量子化レベルなど。Claude は省略 */
  description?: string
  /** Ollama のみ: ローカルディスク上のモデルサイズ（バイト） */
  sizeBytes?: number
  /** Ollama のみ: /api/ps 由来。ロード済み＝初回応答が速い */
  loaded?: boolean
}

export interface ProviderCapabilities {
  streaming: boolean
  /**
   * 構造化出力の実現方式。
   * 'json-schema' = format にスキーマを渡して制約付きデコードさせる（Ollama）
   * 'prompt-only'  = 自然言語プロンプトで指示し、応答から正規表現でJSONブロックを抽出する（Claude）
   */
  structuredOutput: 'json-schema' | 'prompt-only'
  /** モデルの最大コンテキスト長（トークン）。Ollama は /api/show の model_info から取得するのが理想だが、
   *  当面は代表値を静的に持つ（3.3節参照） */
  maxContextTokens: number
  /** トークン課金が発生するか。Ollama は false */
  billed: boolean
  /** listModels() が意味のある動的一覧を返すか（Claude は固定リストなので false） */
  supportsModelListing: boolean
}
```

### 2.4 エラー型

```typescript
export type LLMErrorKind =
  | 'auth'        // APIキー無効・未認証
  | 'rateLimit'   // レート制限
  | 'connection'  // ネットワーク到達不可（Ollama未起動を含む）
  | 'notFound'    // モデル未インストールなど
  | 'parse'       // JSON解析失敗
  | 'aborted'     // ユーザーによるキャンセル
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
    this.name = 'LLMError'
    this.kind = kind
    this.provider = opts.provider
    this.statusCode = opts.statusCode
    this.rawResponse = opts.rawResponse
  }
}
```

### 2.5 `LLMProvider` 本体

```typescript
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

  /** ストリーミング補完。onText には「これまでの累積テキスト」を渡す（既存 chatWithMap の呼び出し規約を踏襲） */
  stream(req: LLMRequest, onText: (accumulatedText: string) => void, signal?: AbortSignal): Promise<string>

  /** 利用可能なモデル一覧。Ollama は /api/tags 由来の動的一覧、Claude は固定リスト */
  listModels(): Promise<ModelInfo[]>
}
```

`completeJson` の第2引数 `schema` を省略可能にしているのは、Claude はスキーマを渡しても使い道がなく（プロンプト内の指示文だけが効く）、Ollama 側もスキーマ無しで `format: "json"` の緩いJSONモードにフォールバックできるようにするため。呼び出し側（5つのAI機能）は原則スキーマを渡す運用にし、Claude実装側はそれを無視する。

---

## 3. `ClaudeProvider` / `OllamaProvider` の実装方針

### 3.1 `ClaudeProvider`

既存の `claudeService.ts` にあった「Anthropic SDK を叩く」「例外を判定する」部分をそのまま移設する。プロンプト文字列の組み立てと `jsonMatch` 抽出・`safeParseJson` はここに閉じ込める。

```typescript
// src/services/llm/claudeProvider.ts
import Anthropic from '@anthropic-ai/sdk'
import type { LLMProvider, LLMRequest, JsonSchema, ModelInfo, ProviderCapabilities } from './types'
import { LLMError } from './types'
import { safeParseJson } from './jsonUtils'

const CLAUDE_MODELS: ModelInfo[] = [
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5（高品質）' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5（高速・低コスト）' },
]

export class ClaudeProvider implements LLMProvider {
  readonly id = 'claude' as const
  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    structuredOutput: 'prompt-only',
    maxContextTokens: 200_000,
    billed: true,
    supportsModelListing: false,
  }

  constructor(private readonly apiKey: string, private readonly model: string) {}

  private client(): Anthropic {
    return new Anthropic({ apiKey: this.apiKey, dangerouslyAllowBrowser: true })
  }

  private toLLMError(e: unknown): LLMError {
    if (e instanceof Anthropic.APIConnectionError) {
      return new LLMError('connection', 'ネットワークエラーです。接続を確認してください', { provider: 'claude', cause: e })
    }
    if (e instanceof Anthropic.APIError) {
      if (e.status === 401) return new LLMError('auth', 'APIキーが無効です。設定画面で確認してください', { provider: 'claude', statusCode: 401, cause: e })
      if (e.status === 429) return new LLMError('rateLimit', 'レート制限に達しました。1分ほど待ってから再試行してください', { provider: 'claude', statusCode: 429, cause: e })
      if (e.status === 529) return new LLMError('unknown', 'Claude APIが混雑しています。しばらく待ってから再試行してください', { provider: 'claude', statusCode: 529, cause: e })
      return new LLMError('unknown', e.message, { provider: 'claude', statusCode: e.status, cause: e })
    }
    return new LLMError('unknown', e instanceof Error ? e.message : 'エラーが発生しました', { provider: 'claude', cause: e })
  }

  async complete(req: LLMRequest, signal?: AbortSignal): Promise<string> {
    try {
      const message = await this.client().messages.create(
        {
          model: this.model,
          max_tokens: req.maxTokens,
          system: req.system,
          messages: req.messages,
          temperature: req.temperature,
        },
        { signal },
      )
      const content = message.content[0]
      if (content.type !== 'text') {
        throw new LLMError('unknown', '予期しないレスポンス形式です', { provider: 'claude' })
      }
      return content.text
    } catch (e) {
      if (e instanceof LLMError) throw e
      if (signal?.aborted) throw new LLMError('aborted', 'キャンセルされました', { provider: 'claude', cause: e })
      throw this.toLLMError(e)
    }
  }

  async completeJson<T>(req: LLMRequest, _schema?: JsonSchema, signal?: AbortSignal): Promise<T> {
    // Claude は schema を使わない。呼び出し側プロンプトの「JSON形式のみで回答」指示に依存する。
    const text = await this.complete(req, signal)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new LLMError('parse', 'AIからの応答を解析できませんでした。もう一度お試しください。', {
        provider: 'claude',
        rawResponse: text,
      })
    }
    try {
      return safeParseJson<T>(jsonMatch[0])
    } catch (e) {
      throw new LLMError('parse', 'AIの応答形式が不正でした。もう一度お試しください。', {
        provider: 'claude',
        rawResponse: text,
        cause: e,
      })
    }
  }

  async stream(req: LLMRequest, onText: (accumulatedText: string) => void, signal?: AbortSignal): Promise<string> {
    let accumulated = ''
    try {
      const stream = this.client().messages.stream(
        { model: this.model, max_tokens: req.maxTokens, system: req.system, messages: req.messages },
        { signal },
      )
      stream.on('text', (delta) => {
        accumulated += delta
        onText(accumulated)
      })
      await stream.finalMessage()
    } catch (e) {
      // Abort 時はそれまでの累積テキストを返す（エラーとして扱わない）— 既存 chatWithMap の挙動を踏襲
      if (e instanceof Anthropic.APIUserAbortError || signal?.aborted) return accumulated
      throw this.toLLMError(e)
    }
    return accumulated
  }

  async listModels(): Promise<ModelInfo[]> {
    // Claude は固定リストで管理する（3.3節参照：Anthropic には models.list() APIもあるが、
    // 対応モデルを恣意的に絞り込みたいため動的取得はしない）
    return CLAUDE_MODELS
  }
}
```

`stream` に渡す `onText` は「差分」ではなく「累積テキスト」を渡す既存の呼び出し規約（`AIChatPanel.tsx` の `updateLastChatMessage(partial)` がそのままメッセージ内容を上書きする実装になっている）をそのまま踏襲する。&#96;&#96;&#96;actions ブロックの途中露出防止（`accumulated.replace(/```actions[\s\S]*$/, '')`）は provider の外側、`chatWithMap` サービス層に残す（後述 3.3）。

### 3.2 `OllamaProvider`

```typescript
// src/services/llm/ollamaProvider.ts
import type { LLMProvider, LLMRequest, JsonSchema, ModelInfo, ProviderCapabilities } from './types'
import { LLMError } from './types'
import { safeParseJson } from './jsonUtils'

interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OllamaChatResponse {
  message: { role: string; content: string }
  done: boolean
  done_reason?: string
}

interface OllamaChatStreamChunk {
  message?: { role: string; content: string }
  done: boolean
}

interface OllamaTagsModel {
  name: string
  size: number
  details: { parameter_size: string; quantization_level: string; family: string }
}

function toOllamaMessages(req: LLMRequest): OllamaChatMessage[] {
  const systemMsg: OllamaChatMessage[] = req.system ? [{ role: 'system', content: req.system }] : []
  return [...systemMsg, ...req.messages.map((m) => ({ role: m.role, content: m.content }))]
}

export class OllamaProvider implements LLMProvider {
  readonly id = 'ollama' as const
  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    structuredOutput: 'json-schema',
    // モデルごとに実際は異なる（3.3節）。ここでは安全側の代表値を置き、将来 /api/show 連携で動的化する
    maxContextTokens: 8192,
    billed: false,
    supportsModelListing: true,
  }

  constructor(private readonly baseUrl: string, private readonly model: string) {}

  private endpoint(path: string): string {
    return `${this.baseUrl.replace(/\/$/, '')}${path}`
  }

  private async fetchJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    let res: Response
    try {
      res = await fetch(this.endpoint(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      })
    } catch (e) {
      if (signal?.aborted) throw new LLMError('aborted', 'キャンセルされました', { provider: 'ollama', cause: e })
      throw new LLMError(
        'connection',
        'Ollamaに接続できませんでした。Ollamaが起動しているか、接続先URLが正しいか確認してください。',
        { provider: 'ollama', cause: e },
      )
    }
    if (!res.ok) throw await this.toHttpError(res)
    return res.json() as Promise<T>
  }

  private async toHttpError(res: Response): Promise<LLMError> {
    const text = await res.text().catch(() => '')
    if (res.status === 404) {
      return new LLMError('notFound', `モデル「${this.model}」が見つかりません。'ollama pull ${this.model}' でモデルを取得してください。`, {
        provider: 'ollama',
        statusCode: 404,
        rawResponse: text,
      })
    }
    return new LLMError('unknown', `Ollamaがエラーを返しました（HTTP ${res.status}）`, {
      provider: 'ollama',
      statusCode: res.status,
      rawResponse: text,
    })
  }

  async complete(req: LLMRequest, signal?: AbortSignal): Promise<string> {
    const data = await this.fetchJson<OllamaChatResponse>(
      '/api/chat',
      {
        model: this.model,
        messages: toOllamaMessages(req),
        stream: false,
        options: { temperature: req.temperature ?? 0.7, num_predict: req.maxTokens },
      },
      signal,
    )
    return data.message.content
  }

  async completeJson<T>(req: LLMRequest, schema?: JsonSchema, signal?: AbortSignal): Promise<T> {
    // format にスキーマを渡すと Ollama 側で制約付きデコードが働き、JSON以外を出力しなくなる（Ollama 0.3系以降で動作確認、
    // ただしスキーマ未対応の古いバージョンでは "json" 文字列指定にフォールバックさせる余地を残す。4節参照）
    const data = await this.fetchJson<OllamaChatResponse>(
      '/api/chat',
      {
        model: this.model,
        messages: toOllamaMessages(req),
        stream: false,
        format: schema ?? 'json',
        options: { temperature: 0, num_predict: req.maxTokens },
      },
      signal,
    )
    try {
      return safeParseJson<T>(data.message.content)
    } catch (e) {
      throw new LLMError('parse', 'AIの応答形式が不正でした。もう一度お試しください。', {
        provider: 'ollama',
        rawResponse: data.message.content,
        cause: e,
      })
    }
  }

  async stream(req: LLMRequest, onText: (accumulatedText: string) => void, signal?: AbortSignal): Promise<string> {
    let res: Response
    try {
      res = await fetch(this.endpoint('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: toOllamaMessages(req),
          stream: true,
          options: { temperature: req.temperature ?? 0.7, num_predict: req.maxTokens },
        }),
        signal,
      })
    } catch (e) {
      if (signal?.aborted) return ''
      throw new LLMError('connection', 'Ollamaに接続できませんでした。Ollamaが起動しているか確認してください。', {
        provider: 'ollama',
        cause: e,
      })
    }
    if (!res.ok || !res.body) throw await this.toHttpError(res)

    // Ollama のストリーミング応答は NDJSON（改行区切りでJSONオブジェクトが1行ずつ届く）。
    // fetch の ReadableStream をチャンクごとにデコードし、改行で分割してパースする。
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
        buffer = lines.pop() ?? '' // 最後の未完成行は次のチャンクに持ち越す
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
      if (signal?.aborted) return accumulated
      throw new LLMError('unknown', 'ストリーミング中にエラーが発生しました', { provider: 'ollama', cause: e })
    }
    return accumulated
  }

  async listModels(): Promise<ModelInfo[]> {
    let res: Response
    try {
      res = await fetch(this.endpoint('/api/tags'))
    } catch (e) {
      throw new LLMError('connection', 'Ollamaに接続できませんでした。Ollamaが起動しているか確認してください。', {
        provider: 'ollama',
        cause: e,
      })
    }
    if (!res.ok) throw await this.toHttpError(res)
    const data = (await res.json()) as { models: OllamaTagsModel[] }
    return data.models.map((m) => ({
      id: m.name,
      label: m.name,
      description: `${m.details.parameter_size} / ${m.details.quantization_level}`,
      sizeBytes: m.size,
    }))
  }
}
```

`complete` / `completeJson` は非ストリーミング（`stream: false`）で単発リクエストにしている。`/api/generate` ではなく `/api/chat` に統一しているのは、5機能すべてが「単発の指示＋文脈」という会話1往復のパターンで、`system` を渡す口が `/api/chat` の方が自然だからである（4節で詳述）。

### 3.3 ストリーミングの吸収方法（Claude SDK vs Ollama NDJSON）

| | Claude (`ClaudeProvider`) | Ollama (`OllamaProvider`) |
|---|---|---|
| 実現手段 | Anthropic SDK の `client.messages.stream()` が返す `MessageStream` オブジェクトの `.on('text', delta => ...)` イベント | `fetch` の `Response.body`（`ReadableStream`）を `getReader()` で読み、`TextDecoder` でデコードした文字列を改行分割して1行ずつ `JSON.parse` する自前実装（NDJSON） |
| デルタの単位 | `text` イベントごとに差分文字列 | 各行の `message.content` が差分文字列（`/api/generate` の場合は `response` フィールド） |
| 終了判定 | `stream.finalMessage()` の resolve | 行の `done: true` （もしくは `reader.read()` が `{ done: true }` を返す） |
| 中断 | `{ signal }` をSDKに渡すと内部で `AbortController` 相当の処理をしてくれる | `fetch` 自体に `signal` を渡す。中断時 `fetch` が `AbortError` を投げるので `signal?.aborted` で判定し、それまでの `accumulated` を返す |
| 両者を揃えるポイント | `LLMProvider.stream()` の呼び出し側からは「`onText(累積テキスト)` が呼ばれ、最終的に `Promise<string>` が解決する」という同一の見え方になるようにする | 同上 |

これにより `chatWithMap` サービス層（provider の外側）は次のように provider 実装を意識せず書ける。

```typescript
// src/services/aiService.ts（claudeService.ts を改名・provider非依存化したもの）
export async function chatWithMap(
  provider: LLMProvider,
  req: ChatWithMapRequest,
  onText?: (partialText: string) => void,
  signal?: AbortSignal,
): Promise<{ content: string; actions: ChatAction[] }> {
  const { system, messages } = buildChatPrompt(req) // プロンプト構築は完全共通

  let accumulated = ''
  try {
    accumulated = await provider.stream(
      { system, messages, maxTokens: 2048 },
      (partial) => {
        accumulated = partial
        // actionsブロックの途中露出を防ぐため除去してから渡す（provider非依存のロジック）
        onText?.(partial.replace(/```actions[\s\S]*$/, ''))
      },
      signal,
    )
  } catch (e) {
    if (e instanceof LLMError && e.kind === 'aborted') {
      const content = accumulated.replace(/```actions[\s\S]*$/, '').trim()
      return { content, actions: [] }
    }
    throw e
  }

  return parseChatActions(accumulated) // ```actions ブロックの抽出も共通関数化
}
```

### 3.4 `maxContextTokens` の扱いについて（未確認事項）

Ollama のモデルごとの実際のコンテキスト長は `/api/show` の `model_info["<family>.context_length"]` から取得できる（フィールド名はモデルファミリーによって異なる、例: `llama.context_length`、`qwen2.context_length`）。ただし本設計では `OllamaProvider.capabilities.maxContextTokens` を固定値 8192 とし、将来的に `OllamaProvider` の生成時に `/api/show` を1回呼んで動的に上書きする拡張余地を残すに留める（初期実装のスコープ外）。**モデルファミリーごとのフィールド名の網羅は未確認**。

---

## 4. プロンプト戦略の差

### 4.1 結論：プロンプトのテンプレート文字列自体は共通に保つ

`generateSuggestions` などのプロンプト構築関数（1節の表で「非依存」と整理した部分）は、Claude / Ollama で分岐させない。理由は3つ。

1. 「JSON形式のみで回答してください」という自然言語の指示は、Ollama で `format` にスキーマを渡した場合は制約付きデコードが効くため実質的に無害な冗長文になるだけで、悪影響がない。
2. 5機能 × 2プロバイダで10種のプロンプトを維持するコストは、AIエージェントが継続開発する前提では事故（片方だけ更新し忘れる）の温床になる。
3. Ollama 側で不安定になりやすいのは「指示追従」ではなく「出力形式の逸脱」であり、これは `format` パラメータと後述のリトライ機構で吸収する方が、プロンプト分岐より効果的かつメンテナンスコストが低い。

一方で、**JSON出力を要求する指示文の末尾に付ける「スキーマ提示」だけは provider ごとに出し分ける**。Ollama の公式ドキュメントが「スキーマをプロンプト内にも文字列として埋め込むと精度が上がる」と明記しているため、次のようなヘルパーで吸収する。

```typescript
// src/services/aiService.ts
function jsonInstructionSuffix(provider: LLMProvider, schema: JsonSchema): string {
  if (provider.capabilities.structuredOutput === 'json-schema') {
    // Ollama: format にスキーマを渡す前提だが、プロンプトにも埋め込むと追従率が上がる（公式ドキュメント推奨）
    return `\n\n出力は以下のJSON Schemaに厳密に従ってください:\n${JSON.stringify(schema)}`
  }
  return '' // Claude はプロンプト内の「必ず以下のJSON形式のみで回答してください」の指示のみで十分
}
```

### 4.2 小型ローカルモデル向けの安定化策

| 施策 | 内容 | 適用範囲 |
|---|---|---|
| `format` にJSON Schemaを渡す | Ollama 0.3系以降が対応する構造化出力機能。モデルの出力トークン列そのものをスキーマで制約するため、Claude のプロンプトのみによる誘導より逸脱が起きにくい | Ollamaのみ |
| `temperature: 0` | `completeJson` では決定的な出力を優先し、JSON構文エラーの発生率を下げる。Ollama公式ドキュメントの推奨設定 | 両方（Claudeも構造化出力時は低温にする） |
| `num_predict` / `max_tokens` の明示指定 | Ollama は未指定だとモデルのデフォルト値に依存し、出力が途中で切れてJSONが不完全になることがある。5機能それぞれで現行の `max_tokens`（2048 or 4096）をそのまま `num_predict` に流用する | Ollamaのみ（Claudeは元々 `max_tokens` 必須） |
| スキーマ検証＋自動修復リトライ | `completeJson` のパースに失敗した場合、1回だけ「直前の応答は次のエラーでパースに失敗しました: {エラー内容}。同じ内容をJSON Schemaに厳密に従って出力し直してください」という修復プロンプトを追加して再試行する。2回失敗したら `LLMError('parse', ...)` を投げてUI側の「AIの生レスポンスをコピー」導線（`MapAnalysisPanel.tsx` に既存）に委ねる | 両方（Ollamaで特に効果が高い） |
| few-shot例の追加 | 小型モデル（4B級）で `suggestClusters` のようなネストしたJSON構造の追従率が低い場合、プロンプト末尾に1件だけ出力例を追加する。ただし初期実装では見送り、実運用でモデルごとの失敗率を見てから追加するかを判断する（過剰な作り込みを避ける） | 主にOllama、必要になった機能のみ個別対応 |

自動修復リトライは `aiService.ts` に共通ヘルパーとして実装し、5機能すべてがこれを経由する。

```typescript
async function completeJsonWithRetry<T>(
  provider: LLMProvider,
  req: LLMRequest,
  schema: JsonSchema,
  signal?: AbortSignal,
): Promise<T> {
  try {
    return await provider.completeJson<T>(req, schema, signal)
  } catch (e) {
    if (!(e instanceof LLMError) || e.kind !== 'parse') throw e
    const repairReq: LLMRequest = {
      ...req,
      messages: [
        ...req.messages,
        { role: 'assistant', content: e.rawResponse ?? '' },
        {
          role: 'user',
          content: `直前の応答はJSONとして解析できませんでした（エラー: ${e.message}）。同じ内容をJSON Schemaに厳密に従って出力し直してください。説明文は不要です。`,
        },
      ],
    }
    return provider.completeJson<T>(repairReq, schema, signal) // 2回目の失敗はそのまま呼び出し元に投げる
  }
}
```

---

## 5. 型変更の設計

### 5.1 `AIModel` 型の置き換え

現在の `AIModel` は Claude 専用の union 型で、`aiModel` を `provider` の意味も兼ねて使っている（`aiModel` の値がそのまま Anthropic の model パラメータになる）。これを次のように分割する。

```typescript
// src/types/index.ts（変更後）
export type LLMProviderId = 'claude' | 'ollama'

/** UIやプロンプト構築側では常に「今アクティブなプロバイダ + モデルID」の組で扱う */
export interface AIModelSelection {
  provider: LLMProviderId
  /** Claude: 'claude-sonnet-5' 等の固定ID。Ollama: 'gemma3:12b' など /api/tags の name */
  model: string
}
```

`AIModel` という型名は廃止し、`claudeService.ts` の各 `Request` インタフェースにあった `apiKey: string` / `model: AIModel` の2フィールドは、呼び出し側で解決済みの `LLMProvider` インスタンス1個に置き換える（6節・7節の移行ステップ参照）。これにより、Ollama利用時に無意味な `apiKey` を引き回す必要がなくなる。

```typescript
// 変更前（claudeService.ts）
interface SuggestionRequest {
  apiKey: string
  model: AIModel
  selectedNodeTitle: string
  // ...
}

// 変更後（aiService.ts）
interface SuggestionRequest {
  provider: LLMProvider
  selectedNodeTitle: string
  // ...
}
```

### 5.2 `settingsStore` の変更

```typescript
// src/stores/settingsStore.ts（変更後、抜粋）
interface SettingsState {
  apiKey: string                 // Claude APIキー（既存のまま）
  llmProvider: LLMProviderId     // 新規: 'claude' | 'ollama'（デフォルト 'claude'）
  claudeModel: string            // 旧 aiModel を改名。デフォルト 'claude-sonnet-5'
  ollamaModel: string            // 新規。デフォルト '' （未選択）
  ollamaBaseUrl: string          // 新規。デフォルト 'http://localhost:11434'
  // ...
  setLlmProvider: (provider: LLMProviderId) => void
  setClaudeModel: (model: string) => void
  setOllamaModel: (model: string) => void
  setOllamaBaseUrl: (url: string) => void
  /** llmProvider に応じて claudeModel / ollamaModel のどちらかを返すセレクタ */
  getActiveModelSelection: () => AIModelSelection
}
```

プロバイダを切り替えても選択中のモデル名を失わないよう、`claudeModel` と `ollamaModel` を別フィールドとして持つ（1本の `aiModel` にすると「Claudeで選んでいたモデル名」を Ollama 切り替え時に上書きしてしまい、Claudeに戻したときにデフォルト値へ後退する）。

### 5.3 永続化データのマイグレーション

#### localStorage（`ideamap-settings`）

現状 `partialize` で永続化しているのは `aiModel: AIModel` を含む状態。zustand の `persist` ミドルウェアが提供する `version` + `migrate` オプションで移行する。

```typescript
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({ /* ... */ }),
    {
      name: 'ideamap-settings',
      version: 1, // 現状 version 未指定＝0 扱いなので、1へ上げて migrate を発火させる
      migrate: (persisted, version) => {
        if (version < 1) {
          const old = persisted as { aiModel?: string }
          return {
            ...(persisted as object),
            llmProvider: 'claude',
            claudeModel: old.aiModel ?? 'claude-sonnet-5',
            ollamaModel: '',
            ollamaBaseUrl: 'http://localhost:11434',
          }
        }
        return persisted
      },
      partialize: (state) => ({
        llmProvider: state.llmProvider,
        claudeModel: state.claudeModel,
        ollamaModel: state.ollamaModel,
        ollamaBaseUrl: state.ollamaBaseUrl,
        suggestionCount: state.suggestionCount,
        autoSave: state.autoSave,
        theme: state.theme,
        language: state.language,
        nodeShape: state.nodeShape,
        categories: state.categories,
        snapToGrid: state.snapToGrid,
        edgeStyle: state.edgeStyle,
      }),
    },
  ),
)
```

破壊的変更を避けるポイントは、旧キー `aiModel` の値をそのまま `claudeModel` に移し替え、`llmProvider` は必ず `'claude'` で初期化することで、**既存ユーザーは何もしなくてもアップデート後も Claude が使われ続ける**こと。

#### Google Drive（`settings.json` = `AppSettings`）

現状の `AppSettings`:

```typescript
export interface AppSettings {
  version: string        // '1.0'
  encryptedApiKey: string
  salt: number[]
  model: string           // 旧 aiModel の値
  updatedAt: string
}
```

**Ollamaのエンドポイント・選択モデルは同期対象に含めない**。理由は、Drive同期は「別デバイスでも同じ設定を復元する」ためのものだが、Ollamaはデバイスローカルなネットワークサービスであり、PC-AのローカルURLやインストール済みモデルをPC-Bに同期しても意味がない（むしろ誤動作の元）。したがって Drive に同期するのは引き続き「Claude APIキー」と「Claudeモデル」のみとする。

```typescript
export interface AppSettings {
  version: string          // '2.0' に更新
  encryptedApiKey: string
  salt: number[]
  model: string             // Claudeモデルのみ（旧フィールドを流用、意味は変えない）
  updatedAt: string
}
```

`model` フィールドの意味を変えていないため、**フォーマット自体は後方互換**。`loadSettingsFromDrive` 側の読み込みコードも次のように変更点は最小限で済む。

```typescript
loadSettingsFromDrive: async (token: string) => {
  const { syncPassword } = get()
  if (!syncPassword) throw new Error('マスターパスワードが設定されていません')
  const settings = await loadAppSettings(token)
  if (!settings) throw new Error('Driveに設定ファイルが見つかりません')
  const apiKey = await decryptWithPassword(settings.encryptedApiKey, syncPassword, settings.salt)
  get().setApiKey(apiKey)
  if (settings.model) set({ claudeModel: settings.model }) // 旧 aiModel → 新 claudeModel
  // llmProvider / ollamaModel / ollamaBaseUrl は変更しない（デバイスローカル設定を尊重する）
},
```

`version: '1.0'` の古いファイルも `model` フィールドが存在すれば同じロジックでそのまま読める。`version` フィールド自体は将来のスキーマ判定用に残すが、現時点では分岐処理を追加しない（構造が変わっていないため）。

---

## 6. 設定UIの設計

### 6.1 Web版でのOllama選択肢の扱い

Web版のブラウザから `http://localhost:11434` を直接叩くこと自体は技術的に可能だが、`OLLAMA_ORIGINS` をユーザーごとに設定させる運用は非現実的（各ユーザーのブラウザのオリジンをOllama側に許可リスト登録させる必要があり、サポートコストに見合わない）。よって **Web版ではプロバイダ切り替えUIそのものを表示しない**。判定は実行時にTauriランタイムの有無で行う。

```typescript
// src/utils/platform.ts
export function isDesktopRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}
```

`SettingsPanel.tsx` では `isDesktopRuntime()` が `false` の間は現行の「Claude API」セクションのみを表示し、`true` のときだけプロバイダ切り替えUIを追加で描画する。これにより、単一のコードベース（`ideamap/`）を Web ビルドと Tauri ビルドの両方で共用できる。

### 6.2 プロバイダ切り替えUI（デスクトップ版のみ）

```
┌ AIプロバイダ ──────────────────────────────┐
│ ○ Claude API　　● Ollama（ローカル）        │
│                                              │
│ [Ollama選択時のみ表示]                        │
│ 接続先URL: [http://localhost:11434      ]    │
│                          [接続テスト]          │
│                                              │
│ ✅ 接続成功 / 3個のモデルが見つかりました        │
│                                              │
│ 使用モデル: [gemma3:12b            ▼]        │
│   gemma3:12b (12.2B / Q4_K_M, 8.1GB)         │
│   qwen3:8b   (8.2B  / Q4_K_M, 5.2GB)         │
│   elyza-jp:8b(8.0B  / Q4_K_M, 4.9GB)         │
│                              [🔄 一覧を更新]   │
└──────────────────────────────────────────────┘
```

### 6.3 接続テストとエラーガイダンス

「接続テスト」ボタンは `provider.listModels()` を呼ぶだけで実現できる（`/api/tags` は疎通確認とモデル一覧取得を兼ねる）。失敗時は `LLMError.kind` に応じて文言を出し分ける。

| `LLMError.kind` | 表示文言 | 付随ガイダンス |
|---|---|---|
| `connection` | 「Ollamaに接続できませんでした」 | 「ターミナルで `ollama serve` を実行してOllamaを起動してください」＋コマンドのコピーボタン。デフォルトURL以外を指定している場合は「接続先URLを確認してください」を追加 |
| `notFound` | 「指定したモデルが見つかりません」 | 「`ollama pull <モデル名>` でモデルを取得してください」＋コマンドのコピーボタン。加えて [ollama.com/library](https://ollama.com/library) へのリンク |
| その他 | `LLMError.message` をそのまま表示 | — |

インストール済みモデルが0件（`/api/tags` の `models` が空配列）の場合は、モデル選択のドロップダウンの代わりに次の空状態を表示する。

```
まだモデルがインストールされていません。
ターミナルで以下を実行してください:

  ollama pull gemma3:12b     [コピー]

日本語での利用には gemma3 / qwen3 / elyza-jp などがおすすめです（8節参照）。
```

### 6.4 Tauri特有の注意点（CORS）

Ollamaはデフォルトでは `OLLAMA_ORIGINS` に `http://localhost` 等の限られたオリジンしか許可しておらず、**素の `fetch` をTauriのWebView（本番ビルドでは `tauri://localhost`、開発時は Vite の `http://localhost:5173` 等）から投げると、Ollama側がCORSヘッダーを返さずリクエストが失敗する可能性がある**。デフォルト許可リストには `tauri://` 系オリジンが含まれるとの情報があるが、開発時の Vite オリジン（ポート番号違い）まで許可されるかは未確認。

対策として2案あり、後者を推奨する。

1. ユーザーに `OLLAMA_ORIGINS` 環境変数の設定を案内する（OS再起動やサービス再起動が必要でハードルが高い）。
2. **`@tauri-apps/plugin-http` の `fetch` を使い、リクエストをTauriのRustバックエンド経由で送る**。WebViewのブラウザCORS制約を経由しないため、Ollama側の `OLLAMA_ORIGINS` 設定に依存せず疎通できる。`OllamaProvider` 内の `fetch` 呼び出しを、デスクトップ実行時のみ `@tauri-apps/plugin-http` の `fetch` に差し替える（Web版ビルドには同プラグインは含まれないため、`isDesktopRuntime()` で分岐するか、Vite の環境変数でエントリポイントを分ける）。

いずれにせよ **この節の内容は一次情報での検証が済んでいない（8節「未確認」参照）**。実装フェーズで実機検証し、`OLLAMA_ORIGINS` の追加設定が本当に不要かを確認すること。

---

## 7. 段階的実装計画

「既存 Web 版の挙動を1ミリも変えない」ことを最優先に、小さいステップに分割する。各ステップは独立してコミットし、完了条件を満たしたら次へ進む。

> **Step 1-2 は Phase 32 で実施済み（2026-08-05）。** 実装時に本書の記述から意図的に変えた点が4つあります。**以下が優先されます。**
>
> | 本書の記述 | 実装（Phase 32） | 理由 |
> |---|---|---|
> | §3.3 のサービス層例は `stream()` が `LLMError('aborted')` を throw する前提 | **throw せず累積テキストを return**（§3.1 の `ClaudeProvider` コード例どおり）。呼び出し側は戻り値の後に `signal?.aborted` を見て分岐する | 本書内で §3.1 と §3.3 が矛盾していた。既存 `chatWithMap` の「中断は例外ではない」挙動に近い §3.1 を採用 |
> | §2.4 `LLMError` の `name` は `'LLMError'` 固定 | `kind === 'aborted'` のときだけ `name = 'AbortError'` | `AISuggestionPanel` が `name === 'AbortError'` でキャンセルを判定しているため。ここを変えるとキャンセル時にエラー表示が出てしまう |
> | §3.1 `maxContextTokens: 200_000` 固定 | **モデル別**（`claude-sonnet-5` = 1M / `claude-haiku-4-5-20251001` = 200K） | 200K は Haiku 基準。誤った値が Phase 35 の設定UIに波及するのを防ぐ |
> | §7 Step 2「`toFriendlyAIError` を `LLMError.kind` を見て日本語文言を返す実装に置き換え」 | kind は見るが**文言は上書きせず `e.message` を返す**（`aborted` のみ例外） | 同じ `connection` でも Claude と Ollama で案内文が変わる。文言の置き場所を Provider 側に一本化した |
>
> あわせて、Phase 32 の完了条件「パネルに差分なし」を守るため次の2点を持ち越しています（Phase 35 Step 6 で解消）。
> - **Step 2 の「3機能でキャンセルボタンが機能すること」は未達**。`analyzeMap`/`suggestConnections`/`suggestClusters` はサービス層まで `signal` を通したが、`MapAnalysisPanel` のキャンセルUIは未追加。
> - `claudeService.ts` に**移行用アダプタ**（`toLegacySuggestionParseError` / `toLegacyAnalysisParseError`）を置き、`LLMError('parse')` を機能別の従来例外（`AIParseError` を含む）へ戻している。エラー表示を統一する際に削除する。

### Step 1: `LLMProvider` 型と `ClaudeProvider` を追加し、内部実装だけを差し替える

- `src/services/llm/types.ts`・`jsonUtils.ts`・`claudeProvider.ts` を新規作成。
- `claudeService.ts` の5関数＋`toFriendlyAIError` は**関数シグネチャを一切変えず**、内部で `new ClaudeProvider(apiKey, model)` を生成して処理を委譲するだけにする。
- 呼び出し側（`AISuggestionPanel.tsx` 等5ファイル）は無変更。

**完了条件**: `git diff` で `src/components/panels/*.tsx` に差分が無いこと。`npm run build` が通ること。AI提案・チャット・分析・接続提案・クラスタ提案の5機能を手動テストし、変更前と入出力が一致すること。

### Step 2: エラー分類を `LLMError` ベースに統一する

- `toFriendlyAIError` を `LLMError.kind` を見て日本語文言を返す実装に置き換える（Claude固有の `Anthropic.APIError` 判定は `ClaudeProvider.toLLMError` に閉じ込め済み）。
- `analyzeMap` / `suggestConnections` / `suggestClusters` に欠けていた `AbortSignal` 対応をここで追加する（1節で指摘した既存の実装漏れの解消）。

**完了条件**: 401 / 429 / 529 / ネットワークエラーの4パターンで、Step 1以前と全く同じ日本語メッセージが表示されること。3機能でキャンセルボタンが機能すること（`MapAnalysisPanel.tsx` 側のUI追加が必要な場合はここで実施）。

### Step 3: `OllamaProvider` を実装する（UIには未接続）

- `src/services/llm/ollamaProvider.ts` を実装。
- UIからはまだ呼ばれない状態で、開発者がコンソールやスクリプトから疎通確認する。

**完了条件**: ローカルで起動した Ollama（例: `ollama run gemma3:4b`）に対し、`complete` / `completeJson` / `stream` / `listModels` の4メソッドがそれぞれ期待した型で応答を返すことを手動確認する。

### Step 4: 型移行（`AIModel` → `AIModelSelection`、`settingsStore`、Drive `AppSettings`）

- 5節の設計に従い `types/index.ts`・`settingsStore.ts` を変更し、`migrate` を実装する。
- `AppSettings` の `version` を `'2.0'` にし、`loadSettingsFromDrive` を更新する。

**完了条件**: `aiModel` のみを持つ旧形式の `localStorage` データで起動し、エラーなく `claudeModel` に移行されること。旧 `version: '1.0'` のDrive設定ファイルを読み込んでもエラーにならないこと。

### Step 5: 設定UIにプロバイダ切り替え・接続テスト・モデル一覧を追加する

- 6節の設計に従い `SettingsPanel.tsx` を拡張。`isDesktopRuntime()` で表示を分岐。
- Tauriの `plugin-http` 経由 fetch の実機検証をここで行い、6.4節の未確認事項を解消する。

**完了条件**: Tauriビルドでプロバイダを Ollama に切り替え、接続テスト・モデル一覧取得・モデル選択が動作すること。Webビルドではプロバイダ切り替えUIが一切表示されないこと（既存UIと見た目が完全一致すること）。

### Step 6: 各パネルの呼び出しを `provider` 注入方式に切り替える

- `AISuggestionPanel.tsx` / `AIChatPanel.tsx` / `MapAnalysisPanel.tsx` で `apiKey` / `aiModel` を直接渡していた箇所を、`providerFactory.ts` の `getActiveProvider(settings)` から得た `LLMProvider` を渡す形に変更する。
- ここで初めて `claudeService.ts` を `aiService.ts` にリネームし、5節で示した `SuggestionRequest` 等のシグネチャ変更（`apiKey`/`model` → `provider`）を適用する。

**完了条件**: Claude / Ollama 双方の設定で5機能すべてが動作することを手動確認する。Web版は `llmProvider` が常に `'claude'` のため、Step 1〜3以前と体感上の差が無いこと。

### Step 7（任意・安定化）: Ollama向けの出力安定化策を追加する

- 4.2節の「スキーマ検証＋自動修復リトライ」「few-shot」を必要に応じて追加する。

**完了条件**: 選定した小型モデル（4B〜8B級）で `suggestClusters` など複雑なJSON構造を要求する機能のパース失敗率が、目視確認で許容範囲（体感で連続失敗しない程度）に収まること。

---

## 8. 付録: Ollama API 調査まとめ

WebSearch / WebFetch で一次情報（Ollama公式リポジトリの `docs/api.md`、`docs.ollama.com`、Ollama公式ブログ）を確認した内容と、確認が取れなかった内容を分けて記載する。

### 8.1 裏取りできた事実

- **`/api/generate` と `/api/chat` の違い**: `/api/generate` は単発プロンプト（`prompt` フィールド）に対する補完、`/api/chat` は `messages` 配列で会話履歴を保持する。本設計では `system` パラメータを自然に渡せる `/api/chat` に統一した。
- **ストリーミング形式**: NDJSON。改行区切りで1行ごとに独立したJSONオブジェクトが返る。`/api/chat` は各行に `message.content`（差分テキスト）が入り、最終行で `done: true`。
- **構造化出力（`format`）**: `format: "json"` で緩いJSONモード、`format` にJSON Schemaオブジェクトを渡すと制約付きデコードが働く。Ollama公式ブログ・ドキュメント（`docs.ollama.com/capabilities/structured-outputs`）に明記あり。ドキュメントは「スキーマをプロンプト文字列としても埋め込むと精度が上がる」「`temperature: 0` を推奨」と明言している。ただし **Ollama Cloud（クラウド提供モデル）では構造化出力が未対応** とドキュメントに明記されており、本設計が対象とするローカル実行のみで有効な機能である。
- **`/api/tags`**: インストール済みモデル一覧。各要素に `name` / `model` / `modified_at` / `size` / `digest` / `details.parameter_size` / `details.quantization_level` 等を含む。
- **`/api/ps`**: ロード中モデル一覧。`/api/tags` の各要素に加えて `expires_at`（アンロード予定時刻）・`size_vram`（VRAM使用量）を含む。
- **`/api/show`**: `modelfile` / `parameters` / `template` / `details` / `model_info`（アーキテクチャ・トークナイザ情報を含む） / `capabilities`（`completion` / `vision` 等の配列）を返す。
- **OpenAI互換エンドポイント**: `http://localhost:11434/v1/chat/completions`（他に `/v1/embeddings`、`/v1/models`）が存在し、OpenAI SDKの `base_url` を差し替えるだけで動く。APIキーは任意の文字列でよい（認証なし）。
- **`OLLAMA_ORIGINS`**: CORS許可オリジンを制御する環境変数。未設定時は `http(s)://localhost`・`127.0.0.1`・`0.0.0.0`・`app://`・`file://`・`tauri://`・`vscode-webview://` が自動的に許可リストに入る。変更には Ollama サービスの再起動が必要。
- **日本語対応ローカルモデルの候補**: Gemma 3（4B/12B/27B、140以上の言語に対応と公称、マルチモーダル対応）、Qwen3（4B/8B/14B/30B-A3B MoE）、ELYZA-JP-8B（Llama-3ベースの日本語特化ファインチューン、`ollama pull` 可能、約4.9GB）、Swallow（同じく `ollama pull` 可能、約8.5GB）。目安VRAM: 7〜8B級はQ4量子化で約8GB、14B級で約12GB、30B級で約24GB。
- **Tauri v2 と CORS の一般論**: TauriのWebViewは本番ビルドで `tauri://localhost` オリジンから動作し、通常のブラウザ同様CORS制約を受ける。Ollamaのようにヘッダーを返さないローカルサービスへのアクセスが失敗する事例が複数の情報源で報告されており、回避策として `@tauri-apps/plugin-http` のRust経由fetchを使う方法が紹介されている。

### 8.2 未確認事項

- **`format` にJSON Schemaオブジェクト（文字列 `"json"` ではなく）を渡す機能が、Ollamaのどのバージョンから利用可能か**の正確なバージョン番号。基本的な `format: "json"` モードは0.3.0以降という情報は得られたが、フルスキーマ制約は別リリースの可能性があり、公式ドキュメントからは正確なバージョン境界を特定できなかった。
- **開発時（`tauri dev`、Viteの `http://localhost:5173` 等のオリジン）から `OLLAMA_ORIGINS` の追加設定なしにOllamaへアクセスできるか**。デフォルト許可リストに `http://localhost` が含まれる旨の情報はあるが、ポート番号違いのオリジンまで一致とみなされるかは検証できていない。6.4節の通り実機検証が必要。
- **モデルファミリーごとの `/api/show` の `model_info` 内フィールド名**（コンテキスト長を表すキーが `llama.context_length` 等ファミリーごとに異なる）の網羅的な一覧。
- **Rakuten AI 2.0 が Ollama公式ライブラリから直接 `ollama pull` できるか**。調査した範囲では Hugging Face から GGUF を取得し `Modelfile` 経由で手動インポートする方法のみ確認できた。
- **`done_reason` フィールド**（ストリーミング最終行に含まれるとされる終了理由）が全バージョンの `/api/chat` レスポンスに存在するか。

---

## 参考資料（本ドキュメント作成にあたり参照したURL）

- [Ollama API Reference (docs/api.md)](https://raw.githubusercontent.com/ollama/ollama/main/docs/api.md)
- [Structured outputs · Ollama Blog](https://ollama.com/blog/structured-outputs)
- [Structured Outputs - Ollama Docs](https://docs.ollama.com/capabilities/structured-outputs)
- [OpenAI compatibility · Ollama Blog](https://ollama.com/blog/openai-compatibility)
- [OpenAI compatibility - Ollama Docs](https://docs.ollama.com/api/openai-compatibility)
- [Allowing CORS to local Ollama](https://objectgraph.com/blog/ollama-cors/)
- [tauri-plugin-cors-fetch](https://github.com/idootop/tauri-plugin-cors-fetch)
- [Ollama VRAM Requirements: Complete 2026 Guide](https://localllm.in/blog/ollama-vram-requirements-for-local-llms)
- [2026年最新｜Ollama日本語モデル完全ガイド](https://saiteki-ai.com/basics/ai-tool/ollama/ollama-japanese-language-model/)
