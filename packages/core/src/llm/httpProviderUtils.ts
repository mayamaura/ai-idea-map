/**
 * OpenAIProvider・OllamaProvider・webSearch で重複していた HTTP 制御フローの共通化（Phase 57）。
 * ClaudeProvider は Anthropic SDK 経由のため対象外。
 */
import { LLMError } from './types'
import type { LLMProviderId } from '../types'

/**
 * パラメータ剥がし付き POST リトライ。
 *
 * reasoning系モデルが特定パラメータ（OpenAI: temperature/response_format、Ollama: think）を
 * 拒否して 400 を返すことがあるため、400 かつそのパラメータを含む場合だけ削って1回だけ再送する。
 * `send` は再送用に呼び出し側で用意した「ボディを渡すと POST するクロージャ」（エンドポイントや
 * signal は呼び出し側が閉じ込める）。
 */
export async function postWithParamFallback(
  send: (body: Record<string, unknown>) => Promise<Response>,
  body: Record<string, unknown>,
  fallbackKeys: readonly string[],
  toHttpError: (res: Response) => Promise<LLMError>,
): Promise<Response> {
  let res = await send(body)
  if (res.status === 400 && fallbackKeys.some((k) => k in body)) {
    await res.text().catch(() => '') // 破棄するレスポンスのボディを解放する
    const relaxed = { ...body }
    for (const key of fallbackKeys) delete relaxed[key]
    res = await send(relaxed)
  }
  if (!res.ok) throw await toHttpError(res)
  return res
}

/**
 * 行バッファリング付きのストリーム読み取り。
 *
 * SSE（OpenAI）・NDJSON（Ollama）とも「reader.read → decode → '\n' 分割 → 未完成行を次のチャンクへ
 * 持ち越す」制御フローは同一で、行の意味づけ（`data:` プレフィックスの有無・JSON の形）だけが異なる
 * ため onLine に委ねる。onLine が true を返すと即座に読み取りを打ち切る（OpenAI の `data: [DONE]` 用）。
 *
 * 中断（signal.aborted）時は例外を投げずに戻る。呼び出し側はそれまでの累積テキストをそのまま結果として
 * 使う規約（ClaudeProvider の中断時の振る舞いに揃えている）。
 */
export async function readLineStream(
  body: ReadableStream<Uint8Array>,
  onLine: (line: string) => boolean | void,
  signal: AbortSignal | undefined,
  provider: LLMProviderId,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? '' // 最後の未完成行は次のチャンクへ持ち越す
      for (const line of lines) {
        if (onLine(line)) return
      }
    }
  } catch (e) {
    if (signal?.aborted) return
    throw new LLMError('unknown', 'ストリーミング中にエラーが発生しました', { provider, cause: e })
  }
}

/**
 * タイムアウト付きの AbortSignal を作る。
 *
 * `AbortSignal.timeout()` を使わないのは、Tauri の http プラグインが signal の abort で
 * レスポンスボディの解放（fetch_cancel_body）を呼ぶため。読み終わったあとにタイマーが発火すると
 * 解放済みリソースを二重に解放して「The resource id ... is invalid」の未処理例外になる。
 * 応答を読み切った時点で `cleanup()` を呼んでタイマーを止める形にし、abort が後から走らないようにする
 * （呼び出し側は必ず finally で cleanup() を呼ぶこと）。
 *
 * `externalSignal` を渡すと、その abort でも内部の AbortController を一緒に abort する
 * （呼び出し側の中断とタイムアウトの両方で打ち切りたい webSearch 向け）。
 */
export function createTimeoutSignal(
  timeoutMs: number,
  externalSignal?: AbortSignal,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const onExternalAbort = () => controller.abort()
  externalSignal?.addEventListener('abort', onExternalAbort)
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer)
      externalSignal?.removeEventListener('abort', onExternalAbort)
    },
  }
}
