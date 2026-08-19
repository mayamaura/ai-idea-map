// ClaudeProvider の Vitest テスト。
//
// 実際の通信は @anthropic-ai/sdk 内部で行われる（HttpAdapter の `request()` は使わず
// `getFetch()` が返す fetch 互換関数を渡している）ため、HttpAdapter モックは getFetch() 側を
// 差し替える形にする。SDK は node_modules/@anthropic-ai/sdk/resources/messages/messages.mjs の
// create()/stream() で応答をそのまま返す（zod 等のスキーマ検証はしない）ため、
// Message 型・SSE イベント列を手組みしたレスポンスで検証できる。
//
// 429/500系のエラーテストは SDK 既定の自動リトライ（maxRetries: 2, 指数バックオフ）にかかるため、
// レスポンスヘッダ `x-should-retry: false` でリトライを止めるか、fake timers で待ち時間を飛ばす。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetPlatform, setPlatform } from '@ideamap/platform'
import { ClaudeProvider } from './claudeProvider'
import type { LLMRequest } from './types'

type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>

let fetchImpl: FetchImpl = async () => new Response('', { status: 500 })

beforeEach(() => {
  setPlatform({
    http: {
      canAccessLocalServers: false,
      request: async () => new Response('', { status: 500 }),
      getFetch: () => fetchImpl as typeof fetch,
    },
  } as never)
})

afterEach(() => {
  resetPlatform()
  vi.useRealTimers()
})

function json(body: unknown, status = 200, headers?: Record<string, string>): Response {
  // Content-Type が無いと SDK が JSON としてパースせず文字列のまま返してしまう
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function anthropicMessage(text: string, overrides: Record<string, unknown> = {}): unknown {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5',
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 },
    ...overrides,
  }
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

/** Claude のストリーミング応答（SSE）を模した「こんにちは」1メッセージ分のイベント列 */
function anthropicStreamResponse(): Response {
  const body = [
    sseEvent('message_start', {
      type: 'message_start',
      message: {
        id: 'msg_stream',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-5',
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 0 },
      },
    }),
    sseEvent('content_block_start', {
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '' },
    }),
    sseEvent('content_block_delta', {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: 'こん' },
    }),
    sseEvent('content_block_delta', {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: 'にちは' },
    }),
    sseEvent('content_block_stop', { type: 'content_block_stop', index: 0 }),
    sseEvent('message_delta', {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn', stop_sequence: null },
      usage: { output_tokens: 5 },
    }),
    sseEvent('message_stop', { type: 'message_stop' }),
  ].join('')
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

const req: LLMRequest = { messages: [{ role: 'user', content: 'hi' }], maxTokens: 100 }

describe('ClaudeProvider', () => {
  describe('capabilities', () => {
    it('既知のモデルはモデルごとの maxContextTokens を設定する', () => {
      const sonnet = new ClaudeProvider('key', 'claude-sonnet-5').capabilities
      expect(sonnet).toMatchObject({
        streaming: true,
        structuredOutput: 'prompt-only',
        maxContextTokens: 1_000_000,
        billed: true,
        supportsModelListing: false,
      })
      const haiku = new ClaudeProvider('key', 'claude-haiku-4-5-20251001').capabilities
      expect(haiku.maxContextTokens).toBe(200_000)
    })

    it('未知のモデルは 200_000 にフォールバックする', () => {
      expect(new ClaudeProvider('key', 'claude-unknown-model').capabilities.maxContextTokens).toBe(200_000)
    })
  })

  describe('listModels', () => {
    it('HTTPを叩かず固定のモデル一覧を返す', async () => {
      fetchImpl = () => {
        throw new Error('listModels は HTTP を呼ばないはず')
      }
      const models = await new ClaudeProvider('key', 'claude-sonnet-5').listModels()
      expect(models.map((m) => m.id)).toEqual(['claude-sonnet-5', 'claude-haiku-4-5-20251001'])
    })
  })

  describe('complete', () => {
    it('成功時はテキストを返し、thinking無効化・system・temperatureを送る', async () => {
      let captured: Record<string, unknown> | undefined
      fetchImpl = async (_input, init) => {
        captured = JSON.parse(String(init?.body)) as Record<string, unknown>
        return json(anthropicMessage('こんにちは'))
      }
      const p = new ClaudeProvider('sk-ant-test', 'claude-sonnet-5')
      const text = await p.complete({ ...req, system: 'あなたは助手です', temperature: 0.5 })
      expect(text).toBe('こんにちは')
      expect(captured).toMatchObject({
        model: 'claude-sonnet-5',
        max_tokens: 100,
        thinking: { type: 'disabled' },
        system: 'あなたは助手です',
        temperature: 0.5,
        messages: [{ role: 'user', content: 'hi' }],
      })
    })

    it('system・temperature 未指定なら送らない', async () => {
      let captured: Record<string, unknown> | undefined
      fetchImpl = async (_input, init) => {
        captured = JSON.parse(String(init?.body)) as Record<string, unknown>
        return json(anthropicMessage('ok'))
      }
      await new ClaudeProvider('sk-ant-test', 'claude-sonnet-5').complete(req)
      expect(captured).not.toHaveProperty('system')
      expect(captured).not.toHaveProperty('temperature')
    })

    it('content が text 以外なら unknown エラー（予期しないレスポンス形式）', async () => {
      fetchImpl = async () =>
        json(anthropicMessage('', { content: [{ type: 'tool_use', id: 'x', name: 'y', input: {} }] }))
      const p = new ClaudeProvider('sk-ant-test', 'claude-sonnet-5')
      await expect(p.complete(req)).rejects.toMatchObject({
        kind: 'unknown',
        provider: 'claude',
        message: '予期しないレスポンス形式です',
      })
    })
  })

  describe('completeJson', () => {
    it('前置き付きの応答からJSONを取り出す', async () => {
      fetchImpl = async () => json(anthropicMessage('はい、こちらです:\n```json\n{"a":1}\n```'))
      const p = new ClaudeProvider('sk-ant-test', 'claude-sonnet-5')
      await expect(p.completeJson(req)).resolves.toEqual({ a: 1 })
    })

    it('JSONブロックが無ければ parse エラー（rawResponse 付き）を投げる', async () => {
      fetchImpl = async () => json(anthropicMessage('すみません、できません'))
      const p = new ClaudeProvider('sk-ant-test', 'claude-sonnet-5')
      await expect(p.completeJson(req)).rejects.toMatchObject({
        kind: 'parse',
        rawResponse: 'すみません、できません',
      })
    })
  })

  describe('エラー分類', () => {
    it('401 は auth', async () => {
      fetchImpl = async () =>
        json({ type: 'error', error: { type: 'authentication_error', message: 'bad key' } }, 401)
      const p = new ClaudeProvider('sk-ant-bad', 'claude-sonnet-5')
      await expect(p.complete(req)).rejects.toMatchObject({ kind: 'auth', provider: 'claude', statusCode: 401 })
    })

    it('429 は rateLimit（x-should-retry: false でSDKの自動リトライを止める）', async () => {
      fetchImpl = async () =>
        json({ type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } }, 429, {
          'x-should-retry': 'false',
        })
      const p = new ClaudeProvider('sk-ant-test', 'claude-sonnet-5')
      await expect(p.complete(req)).rejects.toMatchObject({
        kind: 'rateLimit',
        provider: 'claude',
        statusCode: 429,
      })
    })

    it('529 は unknown（混雑メッセージ）', async () => {
      fetchImpl = async () =>
        json({ type: 'error', error: { type: 'overloaded_error', message: 'overloaded' } }, 529, {
          'x-should-retry': 'false',
        })
      const p = new ClaudeProvider('sk-ant-test', 'claude-sonnet-5')
      await expect(p.complete(req)).rejects.toMatchObject({
        kind: 'unknown',
        provider: 'claude',
        statusCode: 529,
        message: expect.stringContaining('混雑'),
      })
    })

    it('その他のステータス（400）は unknown に分類する', async () => {
      fetchImpl = async () =>
        json({ type: 'error', error: { type: 'invalid_request_error', message: 'bad request' } }, 400)
      const p = new ClaudeProvider('sk-ant-test', 'claude-sonnet-5')
      await expect(p.complete(req)).rejects.toMatchObject({
        kind: 'unknown',
        provider: 'claude',
        statusCode: 400,
      })
    })

    it('fetch自体が失敗し続けると connection エラーになる（リトライの待ち時間は fake timers で飛ばす）', async () => {
      vi.useFakeTimers()
      fetchImpl = async () => {
        throw new TypeError('fetch failed')
      }
      const p = new ClaudeProvider('sk-ant-test', 'claude-sonnet-5')
      const assertion = expect(p.complete(req)).rejects.toMatchObject({
        kind: 'connection',
        provider: 'claude',
      })
      await vi.runAllTimersAsync()
      await assertion
    })
  })

  describe('中断（AbortSignal）', () => {
    it('complete(): 呼び出し時点で abort 済みなら aborted エラーを投げる', async () => {
      fetchImpl = async () => {
        throw new Error('abort済みなのでfetchは呼ばれないはず')
      }
      const controller = new AbortController()
      controller.abort()
      const p = new ClaudeProvider('sk-ant-test', 'claude-sonnet-5')
      await expect(p.complete(req, controller.signal)).rejects.toMatchObject({
        name: 'AbortError',
        kind: 'aborted',
      })
    })

    it('stream(): 呼び出し時点で abort 済みならエラーにせず累積テキスト（空文字）を返す', async () => {
      fetchImpl = async () => {
        throw new Error('abort済みなのでfetchは呼ばれないはず')
      }
      const controller = new AbortController()
      controller.abort()
      const p = new ClaudeProvider('sk-ant-test', 'claude-sonnet-5')
      const seen: string[] = []
      const out = await p.stream(req, (t) => seen.push(t), controller.signal)
      expect(out).toBe('')
      expect(seen).toEqual([])
    })
  })

  describe('stream', () => {
    it('SSEイベント列から累積テキストを構築し、thinkingを無効化して送る', async () => {
      let captured: Record<string, unknown> | undefined
      fetchImpl = async (_input, init) => {
        captured = JSON.parse(String(init?.body)) as Record<string, unknown>
        return anthropicStreamResponse()
      }
      const p = new ClaudeProvider('sk-ant-test', 'claude-sonnet-5')
      const seen: string[] = []
      const out = await p.stream(req, (t) => seen.push(t))
      expect(out).toBe('こんにちは')
      expect(seen).toEqual(['こん', 'こんにちは'])
      expect(captured).toMatchObject({ thinking: { type: 'disabled' } })
    })
  })
})
