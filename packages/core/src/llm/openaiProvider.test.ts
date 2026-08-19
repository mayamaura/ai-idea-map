// verify-openai.mts（`pnpm check:openai`）の全チェック項目を Vitest に移植したもの。
// HttpAdapter を差し替えて SSE パース・400フォールバック・エラー分類・モデル絞り込みを検証する。
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetPlatform, setPlatform } from '@ideamap/platform'
import { OpenAIProvider } from './openaiProvider'
import { LLMError } from './types'
import type { LLMRequest } from './types'

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>

// OpenAIProvider が触るのは http だけなので、他の Adapter は用意せず型だけ黙らせる（verify-openai.mts と同じ方式）
let handler: Handler = () => new Response('', { status: 500 })

beforeEach(() => {
  setPlatform({
    http: {
      canAccessLocalServers: false,
      request: async (input: string, init?: RequestInit) => handler(String(input), init ?? {}),
      // OpenAIProvider は request() のみ使い getFetch() は呼ばない
      getFetch: () => {
        throw new Error('not used')
      },
    },
  } as never)
})

afterEach(() => {
  resetPlatform()
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function sse(chunks: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(new TextEncoder().encode(ch))
      c.close()
    },
  })
  return new Response(stream, { status: 200 })
}

const req: LLMRequest = { messages: [{ role: 'user', content: 'hi' }], maxTokens: 100 }

describe('OpenAIProvider', () => {
  describe('stream', () => {
    it('行の途中でチャンクが分割されても累積し、[DONE] で終端する', async () => {
      handler = () =>
        sse([
          'data: {"choices":[{"delta":{"content":"こん"}}]}\n\ndata: {"choi',
          'ces":[{"delta":{"content":"にちは"}}]}\n\n',
          'data: [DONE]\n\ndata: {"choices":[{"delta":{"content":"無視される"}}]}\n\n',
        ])
      const p = new OpenAIProvider('sk-test', 'gpt-5.1')
      const seen: string[] = []
      const out = await p.stream(req, (t) => seen.push(t))
      expect(out).toBe('こんにちは')
      expect(seen).toEqual(['こん', 'こんにちは'])
    })
  })

  describe('400 フォールバック', () => {
    it('temperature / response_format を落として1回だけ再送する', async () => {
      const bodies: Record<string, unknown>[] = []
      handler = (_url, init) => {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>
        bodies.push(body)
        if ('temperature' in body) {
          return json({ error: { message: "Unsupported parameter: 'temperature'" } }, 400)
        }
        return json({ choices: [{ message: { content: 'ok' } }] })
      }
      const p = new OpenAIProvider('sk-test', 'gpt-5.1')
      const text = await p.complete({ ...req, temperature: 0.7 })
      expect(text).toBe('ok')
      expect(bodies).toHaveLength(2)
      expect(bodies[1]).not.toHaveProperty('temperature')
      expect(bodies[1].max_completion_tokens).toBe(100)
    })

    it('フォールバック後も400なら LLMError に落とす（無限再送しない）', async () => {
      let calls = 0
      handler = () => {
        calls++
        return json({ error: { message: 'still bad' } }, 400)
      }
      const p = new OpenAIProvider('sk-test', 'gpt-5.1')
      await expect(p.complete({ ...req, temperature: 0.7 })).rejects.toMatchObject({
        name: 'LLMError',
        kind: 'unknown',
        message: 'still bad',
      })
      expect(calls).toBe(2)
    })
  })

  describe('エラー分類', () => {
    it.each([
      [401, 'auth'],
      [403, 'auth'],
      [404, 'notFound'],
      [429, 'rateLimit'],
      [500, 'unknown'],
    ] as const)('HTTP %i → %s', async (status, kind) => {
      handler = () => json({ error: { message: `err ${status}` } }, status)
      const p = new OpenAIProvider('sk-test', 'gpt-5.1')
      await expect(p.complete(req)).rejects.toBeInstanceOf(LLMError)
      await expect(p.complete(req)).rejects.toMatchObject({ kind, provider: 'openai' })
    })
  })

  describe('completeJson', () => {
    it('前置き付きの応答からJSONを取り出す', async () => {
      handler = () =>
        json({ choices: [{ message: { content: 'はい、こちらです:\n```json\n{"a":1}\n```' } }] })
      const p = new OpenAIProvider('sk-test', 'gpt-5.1')
      await expect(p.completeJson(req)).resolves.toEqual({ a: 1 })
    })

    it('JSONが無ければ parse エラー（rawResponse 付き）を投げる', async () => {
      handler = () => json({ choices: [{ message: { content: 'すみません、できません' } }] })
      const p = new OpenAIProvider('sk-test', 'gpt-5.1')
      await expect(p.completeJson(req)).rejects.toMatchObject({
        kind: 'parse',
        rawResponse: 'すみません、できません',
      })
    })
  })

  describe('listModels', () => {
    it('チャット用モデルだけを拾う（埋め込み・音声・画像・instruct を除外）', async () => {
      handler = () =>
        json({
          data: [
            { id: 'gpt-5.1' },
            { id: 'text-embedding-3-small' },
            { id: 'o3' },
            { id: 'gpt-4o-audio-preview' },
            { id: 'dall-e-3' },
            { id: 'whisper-1' },
            { id: 'gpt-3.5-turbo-instruct' },
            { id: 'omni-moderation-latest' },
          ],
        })
      const p = new OpenAIProvider('sk-test', 'gpt-5.1')
      const models = await p.listModels()
      expect(models.map((m) => m.id)).toEqual(['gpt-5.1', 'o3'])
    })
  })

  describe('モデル選択', () => {
    it('未選択モデルは既定モデル（gpt-5.1）にフォールバックする', async () => {
      const bodies: Record<string, unknown>[] = []
      handler = (_url, init) => {
        bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>)
        return json({ choices: [{ message: { content: 'ok' } }] })
      }
      await new OpenAIProvider('sk-test', '').complete(req)
      expect(bodies[0].model).toBe('gpt-5.1')
    })
  })

  describe('system プロンプト', () => {
    it('messages 先頭に system ロールとして変換される', async () => {
      const bodies: Record<string, unknown>[] = []
      handler = (_url, init) => {
        bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>)
        return json({ choices: [{ message: { content: 'ok' } }] })
      }
      const p = new OpenAIProvider('sk-test', 'gpt-5.1')
      await p.complete({ ...req, system: 'あなたは助手です' })
      expect(bodies[0].messages).toEqual([
        { role: 'system', content: 'あなたは助手です' },
        { role: 'user', content: 'hi' },
      ])
    })
  })
})
