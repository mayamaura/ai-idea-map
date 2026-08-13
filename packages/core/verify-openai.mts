// OpenAIProvider の自己チェック。`pnpm check:openai` で実行する。
//
// HttpAdapter を差し替えて SSE パース・400フォールバック・エラー分類・モデル絞り込みを確認する。
// 通信の実物が要らないので、これらのロジックを壊したときに気づける唯一の手段になっている。
// src の外に置いてあるので tsc -b の対象外（テストランナーは導入していない）。
import assert from 'node:assert/strict'
import { setPlatform } from '@ideamap/platform'
import { OpenAIProvider } from './src/llm/openaiProvider.ts'
import { LLMError } from './src/llm/types.ts'

type Handler = (url: string, init: RequestInit) => Response

let handler: Handler = () => new Response('', { status: 500 })

// OpenAIProvider が触るのは http だけなので、他の Adapter は用意せず型だけ黙らせる
setPlatform({
  http: {
    canAccessLocalServers: false,
    canReach: async () => true,
    request: async (input: string, init?: RequestInit) => handler(String(input), init ?? {}),
    getFetch: () => fetch,
  },
} as never)

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function sse(chunks: string[]): Response {
  const stream = new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(new TextEncoder().encode(ch))
      c.close()
    },
  })
  return new Response(stream, { status: 200 })
}

const req = { messages: [{ role: 'user' as const, content: 'hi' }], maxTokens: 100 }
const p = new OpenAIProvider('sk-test', 'gpt-5.1')

async function main() {
// 1. SSE: チャンクが行の途中で切れても累積できる / [DONE] で終端する
{
  handler = () =>
    sse([
      'data: {"choices":[{"delta":{"content":"こん"}}]}\n\ndata: {"choi',
      'ces":[{"delta":{"content":"にちは"}}]}\n\n',
      'data: [DONE]\n\ndata: {"choices":[{"delta":{"content":"無視される"}}]}\n\n',
    ])
  const seen: string[] = []
  const out = await p.stream(req, (t) => seen.push(t))
  assert.equal(out, 'こんにちは')
  assert.deepEqual(seen, ['こん', 'こんにちは'])
  console.log('ok: SSE パース（分割チャンク・累積・[DONE]終端）')
}

// 2. 400 フォールバック: temperature / response_format を落として1回だけ再送する
{
  const bodies: Record<string, unknown>[] = []
  handler = (_url, init) => {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    bodies.push(body)
    if ('temperature' in body) {
      return json({ error: { message: "Unsupported parameter: 'temperature'" } }, 400)
    }
    return json({ choices: [{ message: { content: 'ok' } }] })
  }
  const text = await p.complete({ ...req, temperature: 0.7 })
  assert.equal(text, 'ok')
  assert.equal(bodies.length, 2, '再送は1回だけ')
  assert.ok(!('temperature' in bodies[1]))
  assert.equal(bodies[1].max_completion_tokens, 100, 'max_completion_tokens は落とさない')
  console.log('ok: 400 フォールバック（temperature を外して1回だけ再送）')
}

// 3. フォールバック後も 400 なら LLMError になる（無限再送しない）
{
  let calls = 0
  handler = () => {
    calls++
    return json({ error: { message: 'still bad' } }, 400)
  }
  await assert.rejects(
    () => p.complete({ ...req, temperature: 0.7 }),
    (e: unknown) => e instanceof LLMError && e.kind === 'unknown' && e.message === 'still bad',
  )
  assert.equal(calls, 2)
  console.log('ok: 再送後も 400 なら LLMError に落とす')
}

// 4. HTTPステータスごとのエラー分類
{
  for (const [status, kind] of [
    [401, 'auth'],
    [403, 'auth'],
    [404, 'notFound'],
    [429, 'rateLimit'],
    [500, 'unknown'],
  ] as const) {
    handler = () => json({ error: { message: `err ${status}` } }, status)
    await assert.rejects(
      () => p.complete(req),
      (e: unknown) => e instanceof LLMError && e.kind === kind && e.provider === 'openai',
      `HTTP ${status} → ${kind}`,
    )
  }
  console.log('ok: エラー分類（401/403=auth, 404=notFound, 429=rateLimit, 500=unknown）')
}

// 5. completeJson: 前置き付きの応答からJSONを取り出す
{
  handler = () =>
    json({ choices: [{ message: { content: 'はい、こちらです:\n```json\n{"a":1}\n```' } }] })
  assert.deepEqual(await p.completeJson(req), { a: 1 })
  console.log('ok: completeJson（前置き付き応答からJSON抽出）')
}

// 6. completeJson: JSONが無ければ parse エラーで生レスポンスを保持する
{
  handler = () => json({ choices: [{ message: { content: 'すみません、できません' } }] })
  await assert.rejects(
    () => p.completeJson(req),
    (e: unknown) =>
      e instanceof LLMError && e.kind === 'parse' && e.rawResponse === 'すみません、できません',
  )
  console.log('ok: completeJson（JSON不在は parse エラー＋生レスポンス保持）')
}

// 7. listModels: チャット用モデルだけを拾う
{
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
  assert.deepEqual((await p.listModels()).map((m) => m.id), ['gpt-5.1', 'o3'])
  console.log('ok: listModels（埋め込み・音声・画像・instruct を除外）')
}

// 8. 未選択モデルは既定モデルにフォールバックする
{
  const bodies: Record<string, unknown>[] = []
  handler = (_url, init) => {
    bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>)
    return json({ choices: [{ message: { content: 'ok' } }] })
  }
  await new OpenAIProvider('sk-test', '').complete(req)
  assert.equal(bodies[0].model, 'gpt-5.1')
  console.log('ok: モデル未選択時は既定モデルを使う')
}

// 9. system プロンプトが messages 先頭に入る
{
  const bodies: Record<string, unknown>[] = []
  handler = (_url, init) => {
    bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>)
    return json({ choices: [{ message: { content: 'ok' } }] })
  }
  await p.complete({ ...req, system: 'あなたは助手です' })
  assert.deepEqual(bodies[0].messages, [
    { role: 'system', content: 'あなたは助手です' },
    { role: 'user', content: 'hi' },
  ])
  console.log('ok: system プロンプトを messages 先頭に変換')
}

console.log('\nすべて成功')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
