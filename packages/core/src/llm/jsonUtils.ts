/**
 * AI応答からJSONを取り出すためのプロバイダ非依存ユーティリティ（Phase 32 で claudeService.ts から移設）。
 */

// AIが出力するJSONの文字列値内に含まれる未エスケープ制御文字を修正する
function sanitizeJsonString(raw: string): string {
  let result = ''
  let inString = false
  let escaped = false

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i]

    if (escaped) {
      result += char
      escaped = false
      continue
    }

    if (char === '\\' && inString) {
      result += char
      escaped = true
      continue
    }

    if (char === '"') {
      inString = !inString
      result += char
      continue
    }

    if (inString) {
      if (char === '\n') result += '\\n'
      else if (char === '\r') result += '\\r'
      else if (char === '\t') result += '\\t'
      else result += char
    } else {
      result += char
    }
  }

  return result
}

export class AIParseError extends Error {
  readonly rawResponse: string
  constructor(message: string, rawResponse: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'AIParseError'
    this.rawResponse = rawResponse
  }
}

/**
 * 応答テキストから最初の `{...}` ブロックを抽出してパースする（Phase 57、Claude/OpenAI で重複していた処理）。
 * 両プロバイダとも前置き説明文つきで返ってくることがあるため、テキスト全体ではなく最初のJSONブロックだけを
 * 取り出す。ブロックが見つからない場合も safeParseJson と同じ AIParseError を投げ、rawResponse には
 * テキスト全体を入れる（パースに失敗した場合は safeParseJson が一致したブロックを rawResponse にする）。
 */
export function extractJsonBlock<T>(text: string): T {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new AIParseError('JSONブロックが見つかりません', text)
  }
  return safeParseJson<T>(jsonMatch[0])
}

export function safeParseJson<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    try {
      return JSON.parse(sanitizeJsonString(raw)) as T
    } catch (e) {
      throw new AIParseError(
        `JSONの解析に失敗しました: ${e instanceof Error ? e.message : String(e)}`,
        raw,
        e,
      )
    }
  }
}
