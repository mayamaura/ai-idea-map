// OllamaProvider の Vitest テスト。openaiProvider.test.ts と同じ HttpAdapter モック方式で、
// NDJSON ストリーミングパース・400 の think フォールバック・エラー分類・listModels の
// /api/tags + /api/ps 合成を検証する。
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetPlatform, setPlatform } from '@ideamap/platform'
import { DEFAULT_OLLAMA_BASE_URL, OllamaProvider } from './ollamaProvider'
import { LLMError } from './types'
import type { LLMRequest } from './types'

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>

let handler: Handler = () => new Response('', { status: 500 })

beforeEach(() => {
  setPlatform({
    http: {
      canAccessLocalServers: true,
      canReach: async () => true,
      request: async (input: string, init?: RequestInit) => handler(String(input), init ?? {}),
      // OllamaProvider は request() のみ使い getFetch() は呼ばない
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

function ndjson(chunks: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(new TextEncoder().encode(ch))
      c.close()
    },
  })
  return new Response(stream, { status: 200 })
}

const req: LLMRequest = { messages: [{ role: 'user', content: 'hi' }], maxTokens: 100 }

describe('OllamaProvider', () => {
  describe('complete', () => {
    it('モデル・メッセージ・think:false・options を送り、message.content を返す', async () => {
      const bodies: Record<string, unknown>[] = []
      handler = (url, init) => {
        bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>)
        expect(url).toBe(`${DEFAULT_OLLAMA_BASE_URL}/api/chat`)
        return json({ message: { role: 'assistant', content: 'ok' }, done: true })
      }
      const p = new OllamaProvider('', 'gemma3:12b')
      const text = await p.complete({ ...req, system: 'あなたは助手です', temperature: 0.3 })
      expect(text).toBe('ok')
      expect(bodies[0]).toMatchObject({
        model: 'gemma3:12b',
        stream: false,
        think: false,
        messages: [
          { role: 'system', content: 'あなたは助手です' },
          { role: 'user', content: 'hi' },
        ],
        options: { temperature: 0.3, num_predict: 100 },
      })
    })

    it('temperature 未指定時は 0.7 を既定値として送る', async () => {
      const bodies: Record<string, unknown>[] = []
      handler = (_url, init) => {
        bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>)
        return json({ message: { role: 'assistant', content: 'ok' }, done: true })
      }
      await new OllamaProvider('', 'gemma3:12b').complete(req)
      expect((bodies[0].options as Record<string, unknown>).temperature).toBe(0.7)
    })
  })

  describe('think フォールバック（400 のときだけ think を外して1回だけ再送）', () => {
    it('think 非対応（400）なら think を外して再送し成功させる', async () => {
      const bodies: Record<string, unknown>[] = []
      handler = (_url, init) => {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>
        bodies.push(body)
        if ('think' in body) return json({ error: 'unknown field think' }, 400)
        return json({ message: { role: 'assistant', content: 'ok' }, done: true })
      }
      const p = new OllamaProvider('', 'gemma3:12b')
      const text = await p.complete(req)
      expect(text).toBe('ok')
      expect(bodies).toHaveLength(2)
      expect(bodies[1]).not.toHaveProperty('think')
    })

    it('再送後も400なら LLMError（unknown）に落とす（無限再送しない）', async () => {
      let calls = 0
      handler = () => {
        calls++
        return json({ error: 'still bad' }, 400)
      }
      const p = new OllamaProvider('', 'gemma3:12b')
      await expect(p.complete(req)).rejects.toMatchObject({
        name: 'LLMError',
        kind: 'unknown',
        provider: 'ollama',
      })
      expect(calls).toBe(2)
    })
  })

  describe('completeJson', () => {
    it('schema を渡すと format にそのまま使う', async () => {
      const bodies: Record<string, unknown>[] = []
      const schema = { type: 'object' as const, properties: { a: { type: 'number' as const } } }
      handler = (_url, init) => {
        bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>)
        return json({ message: { role: 'assistant', content: '{"a":1}' }, done: true })
      }
      const p = new OllamaProvider('', 'gemma3:12b')
      await expect(p.completeJson(req, schema)).resolves.toEqual({ a: 1 })
      expect(bodies[0].format).toEqual(schema)
      expect((bodies[0].options as Record<string, unknown>).temperature).toBe(0)
    })

    it('schema 省略時は format: "json" を送る', async () => {
      const bodies: Record<string, unknown>[] = []
      handler = (_url, init) => {
        bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>)
        return json({ message: { role: 'assistant', content: '{"a":1}' }, done: true })
      }
      await new OllamaProvider('', 'gemma3:12b').completeJson(req)
      expect(bodies[0].format).toBe('json')
    })

    it('JSONとして解析できなければ parse エラー（rawResponse 付き）を投げる', async () => {
      handler = () => json({ message: { role: 'assistant', content: 'すみません' }, done: true })
      const p = new OllamaProvider('', 'gemma3:12b')
      await expect(p.completeJson(req)).rejects.toMatchObject({
        kind: 'parse',
        rawResponse: 'すみません',
      })
    })
  })

  describe('stream', () => {
    it('NDJSON が行の途中で分割されても累積してパースする', async () => {
      handler = () =>
        ndjson([
          '{"message":{"role":"assistant","content":"こん"},"done":false}\n{"mess',
          'age":{"role":"assistant","content":"にちは"},"done":false}\n',
          '{"message":{"role":"assistant","content":""},"done":true}\n',
        ])
      const p = new OllamaProvider('', 'gemma3:12b')
      const seen: string[] = []
      const out = await p.stream(req, (t) => seen.push(t))
      expect(out).toBe('こんにちは')
      expect(seen).toEqual(['こん', 'こんにちは'])
    })
  })

  describe('エラー分類', () => {
    it('404 は notFound（モデル名と ollama pull コマンドを含む）', async () => {
      handler = () => json({ error: 'not found' }, 404)
      const p = new OllamaProvider('', 'gemma3:12b')
      await expect(p.complete(req)).rejects.toBeInstanceOf(LLMError)
      await expect(p.complete(req)).rejects.toMatchObject({
        kind: 'notFound',
        provider: 'ollama',
        message: expect.stringContaining('ollama pull gemma3:12b'),
      })
    })

    it('404以外（500）は unknown に分類する', async () => {
      handler = () => json({ error: 'boom' }, 500)
      const p = new OllamaProvider('', 'gemma3:12b')
      await expect(p.complete(req)).rejects.toMatchObject({ kind: 'unknown', provider: 'ollama' })
    })

    it('到達不可（fetch失敗）は connection エラーになる', async () => {
      handler = () => {
        throw new TypeError('fetch failed')
      }
      const p = new OllamaProvider('', 'gemma3:12b')
      await expect(p.complete(req)).rejects.toMatchObject({ kind: 'connection', provider: 'ollama' })
    })

    it('signal が abort 済みなら aborted エラー（name: AbortError）になる', async () => {
      handler = () => {
        throw new Error('aborted by controller')
      }
      const controller = new AbortController()
      controller.abort()
      const p = new OllamaProvider('', 'gemma3:12b')
      await expect(p.complete(req, controller.signal)).rejects.toMatchObject({
        name: 'AbortError',
        kind: 'aborted',
      })
    })
  })

  describe('listModels', () => {
    it('/api/tags と /api/ps を合成し、説明文・サイズ・ロード状態を組み立てる', async () => {
      handler = (url) => {
        if (url.endsWith('/api/tags')) {
          return json({
            models: [
              {
                name: 'gemma3:12b',
                size: 8 * 1024 ** 3,
                details: {
                  parameter_size: '12B',
                  quantization_level: 'Q4_K_M',
                  family: 'gemma3',
                  context_length: 8192,
                },
              },
              { name: 'llama3:8b', size: 4 * 1024 ** 3 },
            ],
          })
        }
        if (url.endsWith('/api/ps')) {
          return json({ models: [{ name: 'gemma3:12b' }] })
        }
        throw new Error(`unexpected url: ${url}`)
      }
      const p = new OllamaProvider('', 'gemma3:12b')
      const models = await p.listModels()
      expect(models).toEqual([
        {
          id: 'gemma3:12b',
          label: 'gemma3:12b',
          description: '12B / Q4_K_M / 8.0GB / 8Kコンテキスト',
          sizeBytes: 8 * 1024 ** 3,
          contextTokens: 8192,
          loaded: true,
        },
        {
          id: 'llama3:8b',
          label: 'llama3:8b',
          description: '4.0GB',
          sizeBytes: 4 * 1024 ** 3,
          contextTokens: undefined,
          loaded: false,
        },
      ])
    })

    it('/api/ps が失敗しても一覧表示は続行する（loaded: false 扱い）', async () => {
      handler = (url) => {
        if (url.endsWith('/api/tags')) {
          return json({ models: [{ name: 'gemma3:12b', size: 100 }] })
        }
        return json({ error: 'boom' }, 500)
      }
      const p = new OllamaProvider('', 'gemma3:12b')
      const models = await p.listModels()
      expect(models[0].loaded).toBe(false)
    })

    it('/api/tags 自体が404なら notFound エラーになる', async () => {
      handler = () => json({ error: 'not found' }, 404)
      const p = new OllamaProvider('', 'gemma3:12b')
      await expect(p.listModels()).rejects.toMatchObject({ kind: 'notFound', provider: 'ollama' })
    })
  })

  describe('baseUrl の扱い', () => {
    it('末尾スラッシュ付き baseUrl でもパスが二重スラッシュにならない', async () => {
      let seenUrl = ''
      handler = (url) => {
        seenUrl = url
        return json({ message: { role: 'assistant', content: 'ok' }, done: true })
      }
      await new OllamaProvider('http://localhost:11434/', 'gemma3:12b').complete(req)
      expect(seenUrl).toBe('http://localhost:11434/api/chat')
    })

    it('空文字の baseUrl は既定URL（DEFAULT_OLLAMA_BASE_URL）にフォールバックする', async () => {
      let seenUrl = ''
      handler = (url) => {
        seenUrl = url
        return json({ message: { role: 'assistant', content: 'ok' }, done: true })
      }
      await new OllamaProvider('', 'gemma3:12b').complete(req)
      expect(seenUrl).toBe(`${DEFAULT_OLLAMA_BASE_URL}/api/chat`)
    })
  })
})
