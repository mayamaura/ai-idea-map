import { describe, expect, it } from 'vitest'
import { AIParseError, safeParseJson } from './jsonUtils'

describe('safeParseJson', () => {
  it('正しいJSONをそのままパースする', () => {
    expect(safeParseJson<{ a: number }>('{"a":1}')).toEqual({ a: 1 })
  })

  it('文字列値内の未エスケープ改行・タブを補正してパースする', () => {
    const raw = '{"text": "1行目\n2行目\tタブ"}'
    expect(safeParseJson<{ text: string }>(raw)).toEqual({ text: '1行目\n2行目\tタブ' })
  })

  it('文字列の外側の改行（整形用）は壊さない', () => {
    const raw = '{\n  "a": "x"\n}'
    expect(safeParseJson<{ a: string }>(raw)).toEqual({ a: 'x' })
  })

  it('エスケープ済みシーケンスは二重エスケープしない', () => {
    const raw = '{"text": "a\\nb"}'
    expect(safeParseJson<{ text: string }>(raw)).toEqual({ text: 'a\nb' })
  })

  it('修復不能なJSONは AIParseError（rawResponse 付き）を投げる', () => {
    const raw = '{"a": '
    try {
      safeParseJson(raw)
      expect.unreachable('例外が投げられるべき')
    } catch (e) {
      expect(e).toBeInstanceOf(AIParseError)
      expect((e as AIParseError).rawResponse).toBe(raw)
    }
  })
})
