import Anthropic from '@anthropic-ai/sdk'
import { getPlatform } from '@ideamap/platform'
import type {
  JsonSchema,
  LLMProvider,
  LLMRequest,
  ModelInfo,
  ProviderCapabilities,
} from './types'
import { LLMError } from './types'
import { AIParseError, extractJsonBlock } from './jsonUtils'

const CLAUDE_MODELS: ModelInfo[] = [
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5（高品質）' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5（高速・低コスト）' },
]

/** モデルごとのコンテキスト長。未知のモデルは安全側に倒して 200K とする */
const MAX_CONTEXT_TOKENS: Record<string, number> = {
  'claude-sonnet-5': 1_000_000,
  'claude-haiku-4-5-20251001': 200_000,
}

/**
 * Claude Sonnet 5 は thinking を省略すると adaptive thinking が既定で有効になる
 * （Sonnet 4.6 までは無効が既定）。本アプリの呼び出しは短いJSON／チャット応答が中心で、
 * max_tokens の枠を思考トークンに取られると出力が途中で切れるため明示的に無効化する。
 */
const THINKING_DISABLED = { type: 'disabled' } as const

export class ClaudeProvider implements LLMProvider {
  readonly id = 'claude' as const
  readonly capabilities: ProviderCapabilities

  private readonly apiKey: string
  private readonly model: string

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey
    this.model = model
    this.capabilities = {
      streaming: true,
      structuredOutput: 'prompt-only',
      maxContextTokens: MAX_CONTEXT_TOKENS[model] ?? 200_000,
      billed: true,
      supportsModelListing: false,
    }
  }

  /**
   * ブラウザのみで動作するSPAのため dangerouslyAllowBrowser が必須。生成箇所を1つに集約する。
   *
   * 実際の HTTP 送出は HttpAdapter に委ねる。Web版はブラウザの fetch、
   * デスクトップ版は Tauri の http プラグイン（Rust 側から発行）になり、
   * packages/core が fetch を直接呼ばないという制約もここで満たされる。
   */
  private client(): Anthropic {
    return new Anthropic({
      apiKey: this.apiKey,
      dangerouslyAllowBrowser: true,
      fetch: getPlatform().http.getFetch(),
    })
  }

  /** Anthropic SDK の例外をプロバイダ非依存の LLMError に変換する。SDK依存はこのメソッド内に閉じる */
  private toLLMError(e: unknown): LLMError {
    // APIUserAbortError / APIConnectionError は APIError のサブクラスのため先に判定する
    if (e instanceof Anthropic.APIUserAbortError || (e as { name?: string })?.name === 'AbortError') {
      return new LLMError('aborted', 'キャンセルされました', { provider: 'claude', cause: e })
    }
    if (e instanceof Anthropic.APIConnectionError) {
      return new LLMError('connection', 'ネットワークエラーです。接続を確認してください', {
        provider: 'claude',
        cause: e,
      })
    }
    if (e instanceof Anthropic.APIError) {
      if (e.status === 401) {
        return new LLMError('auth', 'APIキーが無効です。設定画面で確認してください', {
          provider: 'claude',
          statusCode: 401,
          cause: e,
        })
      }
      if (e.status === 429) {
        return new LLMError('rateLimit', 'レート制限に達しました。1分ほど待ってから再試行してください', {
          provider: 'claude',
          statusCode: 429,
          cause: e,
        })
      }
      if (e.status === 529) {
        return new LLMError('unknown', 'Claude APIが混雑しています。しばらく待ってから再試行してください', {
          provider: 'claude',
          statusCode: 529,
          cause: e,
        })
      }
      return new LLMError('unknown', e.message, { provider: 'claude', statusCode: e.status, cause: e })
    }
    return new LLMError('unknown', e instanceof Error ? e.message : 'エラーが発生しました', {
      provider: 'claude',
      cause: e,
    })
  }

  async complete(req: LLMRequest, signal?: AbortSignal): Promise<string> {
    try {
      const message = await this.client().messages.create(
        {
          model: this.model,
          max_tokens: req.maxTokens,
          thinking: THINKING_DISABLED,
          ...(req.system !== undefined ? { system: req.system } : {}),
          ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
          messages: req.messages,
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
      throw this.toLLMError(e)
    }
  }

  async completeJson<T>(req: LLMRequest, _schema?: JsonSchema, signal?: AbortSignal): Promise<T> {
    // Claude は schema を使わない。呼び出し側プロンプトの「JSON形式のみで回答」指示に依存する。
    const text = await this.complete(req, signal)

    try {
      // 前置き説明文への耐性のため、最初の {...} ブロックだけを取り出す
      return extractJsonBlock<T>(text)
    } catch (e) {
      // ブロックが見つからない場合とパースに失敗した場合とで案内文を変える
      const found = text.match(/\{[\s\S]*\}/) !== null
      throw new LLMError(
        'parse',
        found
          ? 'AIの応答形式が不正でした。もう一度お試しください。'
          : 'AIからの応答を解析できませんでした。もう一度お試しください。',
        {
          provider: 'claude',
          rawResponse: e instanceof AIParseError ? e.rawResponse : text,
          cause: e,
        },
      )
    }
  }

  async stream(
    req: LLMRequest,
    onText: (accumulatedText: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    let accumulated = ''
    try {
      const stream = this.client().messages.stream(
        {
          model: this.model,
          max_tokens: req.maxTokens,
          thinking: THINKING_DISABLED,
          ...(req.system !== undefined ? { system: req.system } : {}),
          messages: req.messages,
        },
        { signal },
      )

      stream.on('text', (delta) => {
        accumulated += delta
        onText(accumulated)
      })

      await stream.finalMessage()
    } catch (e) {
      // 中断時はそれまでの累積テキストを返す（エラーとして扱わない）
      if (e instanceof Anthropic.APIUserAbortError || signal?.aborted) return accumulated
      throw this.toLLMError(e)
    }
    return accumulated
  }

  async listModels(): Promise<ModelInfo[]> {
    // Anthropic には models.list() もあるが、対応モデルを恣意的に絞り込みたいため固定リストで管理する
    return CLAUDE_MODELS
  }
}
