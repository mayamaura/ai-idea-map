// generateArtifactFromMap のテスト。LLMProvider は HTTP を経由しないので、
// openaiProvider.test.ts 等と違い HttpAdapter をモックせず LLMProvider インターフェースを直接フェイクする。
import { describe, expect, it } from 'vitest'
import { generateArtifactFromMap, reviewMap, debateNode } from './aiService'
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

/** completeJson() が固定レスポンスを返す最小限のフェイク（reviewMap 等の構造化出力テスト用） */
function fakeJsonProvider(response: unknown, onRequest?: (req: LLMRequest) => void): LLMProvider {
  return {
    id: 'claude',
    capabilities: {
      streaming: true,
      structuredOutput: 'prompt-only',
      maxContextTokens: 200000,
      billed: true,
      supportsModelListing: false,
    },
    complete: async () => '',
    completeJson: async <T,>(req: LLMRequest) => {
      onRequest?.(req)
      return response as T
    },
    stream: async () => '',
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

describe('reviewMap', () => {
  // n2 は子を持たない葉ノードかつ本文なし → findNeglectedNodeIds が検出する
  const nodes = [
    { id: 'n1', title: 'ルート', body: 'ルートの本文', createdBy: 'user' as const },
    { id: 'n2', title: '放置ノード', createdBy: 'user' as const },
  ]
  const edges = [{ source: 'n1', target: 'n2' }]

  it('放置ノード候補（findNeglectedNodeIds の結果）をプロンプトに埋め込む', async () => {
    let capturedPrompt = ''
    const provider = fakeJsonProvider({ suggestions: [] }, (req) => {
      capturedPrompt = req.messages[0].content
    })

    await reviewMap({ provider, nodes, edges, categories: [] })

    expect(capturedPrompt).toContain('【放置されている可能性のあるノード（参考）】')
    expect(capturedPrompt).toContain('[n2] 放置ノード')
  })

  it('放置ノードがなければ参考セクションを含めない', async () => {
    let capturedPrompt = ''
    const provider = fakeJsonProvider({ suggestions: [] }, (req) => {
      capturedPrompt = req.messages[0].content
    })
    const allGoodNodes = [{ id: 'n1', title: 'ルート', body: '本文あり', createdBy: 'user' as const }]

    await reviewMap({ provider, nodes: allGoodNodes, edges: [], categories: [] })

    expect(capturedPrompt).not.toContain('【放置されている可能性のあるノード（参考）】')
  })

  it('suggestions が配列でなければ空配列を返す', async () => {
    const provider = fakeJsonProvider({ suggestions: 'not-an-array' })

    const result = await reviewMap({ provider, nodes, edges, categories: [] })

    expect(result).toEqual([])
  })

  it('targetNodeIds が配列でない要素は空配列に落とす（小型モデルの逸脱への防御）', async () => {
    const provider = fakeJsonProvider({
      suggestions: [{ kind: 'deepen', reason: '理由', targetNodeIds: 'n2', title: 'タイトル' }],
    })

    const result = await reviewMap({ provider, nodes, edges, categories: [] })

    expect(result).toEqual([{ kind: 'deepen', reason: '理由', targetNodeIds: [], title: 'タイトル' }])
  })
})

describe('debateNode', () => {
  it('対象ノード・隣接ノード（1ホップのみ）・ペルソナ一覧をプロンプトに埋め込む', async () => {
    let capturedPrompt = ''
    const provider = fakeJsonProvider({ personas: [] }, (req) => {
      capturedPrompt = req.messages[0].content
    })

    // n2 の1ホップ隣接は n1 のみ（n3 は n1 の子であり n2 とは繋がっていない）
    await debateNode(
      { provider, mapContext, nodeId: 'n2', personas: ['楽観家', '批評家'] },
    )

    expect(capturedPrompt).toContain('子1')
    expect(capturedPrompt).toContain('子1の本文')
    expect(capturedPrompt).toContain('ルート')
    expect(capturedPrompt).toContain('ルートの本文')
    // n3（子2）は n2 と繋がっていないため隣接セクションには含まれない
    expect(capturedPrompt).not.toContain('子2')
    expect(capturedPrompt).toContain('楽観家')
    expect(capturedPrompt).toContain('批評家')
  })

  it('対象ノードが mapContext に存在しない場合はエラーを投げる', async () => {
    const provider = fakeJsonProvider({ personas: [] })

    await expect(
      debateNode({ provider, mapContext, nodeId: 'missing', personas: ['楽観家'] }),
    ).rejects.toThrow('対象ノードが見つかりません')
  })

  it('personas が配列でなければエラーを投げる（不正応答のフォールバック）', async () => {
    const provider = fakeJsonProvider({ personas: 'not-an-array' })

    await expect(
      debateNode({ provider, mapContext, nodeId: 'n1', personas: ['楽観家'] }),
    ).rejects.toThrow('AIからの応答形式が正しくありません')
  })

  it('opinions が配列でないペルソナは空配列に落とす（小型モデルの逸脱への防御）', async () => {
    const provider = fakeJsonProvider({
      personas: [
        { persona: '楽観家', opinions: [{ title: 'いいね', body: '詳細' }] },
        { persona: '批評家', opinions: 'not-an-array' },
      ],
    })

    const result = await debateNode({ provider, mapContext, nodeId: 'n1', personas: ['楽観家', '批評家'] })

    expect(result).toEqual([
      { persona: '楽観家', opinions: [{ title: 'いいね', body: '詳細' }] },
      { persona: '批評家', opinions: [] },
    ])
  })
})
