/**
 * aiService の各機能モジュール（suggestions/mapAnalysis/gardener/debate/textExtraction/chat/artifact）
 * で共有するヘルパー（Phase 57 でモジュール分割時に aiService.ts から切り出し）。
 */
import type { JsonSchema, LLMProvider, LLMRequest } from '../types'
import { LLMError } from '../types'
import { AIParseError } from '../jsonUtils'
import { formatWebSearchBlock, type WebSearchClient, type WebSearchResult } from '../webSearch'

// 生レスポンスのコピー導線（MapAnalysisPanel）が型判定に使うため再エクスポートする
export { AIParseError }

/**
 * AIに聞く前のWeb検索。使うかどうかは呼び出し側（各パネルのトグル）が決め、
 * `webSearch` が未指定なら検索は一切走らずプロンプトも Phase 35 以前と同一になる。
 */
export interface WebSearchOptions {
  webSearch?: WebSearchClient
  /** 実際に参照した検索結果。UIの出典表示に使う */
  onWebSearchResults?: (results: WebSearchResult[]) => void
}

export async function buildWebContext(
  opts: WebSearchOptions,
  query: string,
  signal?: AbortSignal,
): Promise<string> {
  if (!opts.webSearch) return ''
  const results = await opts.webSearch.search(query, signal)
  opts.onWebSearchResults?.(results)
  return formatWebSearchBlock(results)
}

/**
 * JSON出力を要求する指示文の末尾に付けるスキーマ提示。
 *
 * Ollama は format にスキーマを渡すのに加えてプロンプトにも埋め込むと追従率が上がる（公式ドキュメント推奨）。
 * Claude はプロンプト内の「JSON形式のみで回答」指示だけで十分なため何も足さない
 * ＝ Claude に送るプロンプトは Phase 34 以前と1文字も変わらない。
 */
export function jsonInstructionSuffix(provider: LLMProvider, schema: JsonSchema): string {
  if (provider.capabilities.structuredOutput !== 'json-schema') return ''
  return `\n\n出力は以下のJSON Schemaに厳密に従ってください:\n${JSON.stringify(schema)}`
}

/**
 * 構造化出力のパースに失敗したら1回だけ修復を促して再試行する。
 * 小型ローカルモデルはJSONの逸脱が起きやすく、この1回で大半は回復する。
 * 2回目の失敗はそのまま呼び出し元（＝UIの「生レスポンスをコピー」導線）に渡す。
 */
export async function completeJsonWithRetry<T>(
  provider: LLMProvider,
  req: LLMRequest,
  schema: JsonSchema,
  signal?: AbortSignal,
): Promise<T> {
  try {
    return await provider.completeJson<T>(req, schema, signal)
  } catch (e) {
    if (!(e instanceof LLMError) || e.kind !== 'parse') throw e
    // Claude API は空の content ブロックを拒否するため、生レスポンスが取れたときだけ差し戻す
    const previous: LLMRequest['messages'] = e.rawResponse
      ? [{ role: 'assistant', content: e.rawResponse }]
      : []
    const repairReq: LLMRequest = {
      ...req,
      messages: [
        ...req.messages,
        ...previous,
        {
          role: 'user',
          content: `直前の応答はJSONとして解析できませんでした（エラー: ${e.message}）。同じ内容をJSON形式で出力し直してください。説明文は不要です。`,
        },
      ],
    }
    return provider.completeJson<T>(repairReq, schema, signal)
  }
}

export function toFriendlyAIError(e: unknown): string {
  if (e instanceof LLMError) {
    // kind ごとの日本語文言は Provider が設定する（同じ kind でも Claude と Ollama で案内が変わるため）。
    // キャンセルは呼び出し側が握り潰す前提だが、保険として無害な文言を返す。
    return e.kind === 'aborted' ? 'キャンセルされました' : e.message
  }
  return e instanceof Error ? e.message : 'エラーが発生しました'
}
