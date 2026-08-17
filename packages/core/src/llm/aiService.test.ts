// generateArtifactFromMap のテスト。LLMProvider は HTTP を経由しないので、
// openaiProvider.test.ts 等と違い HttpAdapter をモックせず LLMProvider インターフェースを直接フェイクする。
import { describe, expect, it } from 'vitest'
import { generateArtifactFromMap } from './aiService'
import type { LLMProvider, LLMRequest, ModelInfo } from './types'
import type { MapContext } from '../types'

/** stream() が渡された文字列を1文字ずつ累積してコールバックする最小限のフェイク */
function fakeProvider(responseText: string, onRequest?: (req: LLMRequest) => void): LLMProvider {
  return {
    id: 'claude',
    capabilities: {
      streaming: true,
      structuredOutput: 'prompt-only',
      maxContextTokens: 200000,
      billed: true,
      supportsModelListing: false,
    },
    complete: async () => responseText,
    completeJson: async () => {
      throw new Error('not used in this test')
    },
    stream: async (req, onText) => {
      onRequest?.(req)
      let acc = ''
      for (const ch of responseText) {
        acc += ch
        onText(acc)
      }
      return acc
    },
    listModels: async (): Promise<ModelInfo[]> => [],
  }
}

const mapContext: MapContext = {
  mapTitle: 'テストマップ',
  nodes: [
    { id: 'n1', title: 'ルート', body: 'ルートの本文' },
    { id: 'n2', title: '子1', body: '子1の本文' },
    { id: 'n3', title: '子2' },
  ],
  edges: [
    { source: 'n1', target: 'n2' },
    { source: 'n1', target: 'n3' },
  ],
  categories: [],
}

describe('generateArtifactFromMap', () => {
  it('focusNodeIds が指定されると、その集合に絞ったノード・エッジだけがプロンプトに含まれる', async () => {
    let capturedPrompt = ''
    const provider = fakeProvider('本文', (req) => {
      capturedPrompt = req.messages[0].content
    })

    await generateArtifactFromMap({
      provider,
      mapContext,
      format: 'document',
      focusNodeIds: ['n1', 'n2'],
    })

    expect(capturedPrompt).toContain('ルート')
    expect(capturedPrompt).toContain('子1')
    expect(capturedPrompt).not.toContain('子2')
    expect(capturedPrompt).toContain('n1 → n2')
    expect(capturedPrompt).not.toContain('n1 → n3')
  })

  it('focusNodeIds 未指定ならマップ全体がプロンプトに含まれる', async () => {
    let capturedPrompt = ''
    const provider = fakeProvider('本文', (req) => {
      capturedPrompt = req.messages[0].content
    })

    await generateArtifactFromMap({ provider, mapContext, format: 'document' })

    expect(capturedPrompt).toContain('ルート')
    expect(capturedPrompt).toContain('子1')
    expect(capturedPrompt).toContain('子2')
  })

  it('onText が逐次呼ばれ、最終的な累積テキストが返る', async () => {
    const provider = fakeProvider('ABC')
    const seen: string[] = []

    const result = await generateArtifactFromMap(
      { provider, mapContext, format: 'tasks' },
      (partial) => seen.push(partial),
    )

    expect(result).toBe('ABC')
    expect(seen).toEqual(['A', 'AB', 'ABC'])
  })

  it.each([
    ['document', '見出しレベル'],
    ['slides', 'marp: true'],
    ['tasks', '- [ ]'],
  ] as const)('format=%s のとき、対応する指示がプロンプトに入る', async (format, expectedFragment) => {
    let capturedPrompt = ''
    const provider = fakeProvider('本文', (req) => {
      capturedPrompt = req.messages[0].content
    })

    await generateArtifactFromMap({ provider, mapContext, format })

    expect(capturedPrompt).toContain(expectedFragment)
  })
})
