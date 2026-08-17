import { describe, expect, it } from 'vitest'
import type { MapFile, SerializedNode, SerializedEdge } from '../types'
import { mergeMapFiles, applyConflictResolutions } from './mapMerge'

function makeNode(id: string, overrides: Partial<SerializedNode> = {}): SerializedNode {
  return {
    id,
    nodeType: 'idea',
    title: `node-${id}`,
    x: 0,
    y: 0,
    color: '#fff',
    createdBy: 'user',
    ...overrides,
  }
}

function makeEdge(id: string, overrides: Partial<SerializedEdge> = {}): SerializedEdge {
  return { id, source: 'a', target: 'b', label: '', ...overrides }
}

function makeMapFile(overrides: Partial<MapFile> = {}): MapFile {
  return {
    version: '1.1',
    mapId: 'map-1',
    title: 'ベースマップ',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    nodes: [],
    edges: [],
    ...overrides,
  }
}

describe('mergeMapFiles / ノード', () => {
  it('片方のみ変更したノードはその内容を採用する', () => {
    const base = makeMapFile({ nodes: [makeNode('n1', { title: '元のタイトル' })] })
    const mine = makeMapFile({ nodes: [makeNode('n1', { title: '自分の変更' })] })
    const theirs = makeMapFile({ nodes: [makeNode('n1', { title: '元のタイトル' })] })

    const { merged, conflicts } = mergeMapFiles(base, mine, theirs)

    expect(conflicts).toHaveLength(0)
    expect(merged.nodes).toEqual([makeNode('n1', { title: '自分の変更' })])
  })

  it('双方が同じ内容に変更した場合は衝突にならない', () => {
    const base = makeMapFile({ nodes: [makeNode('n1', { title: '元のタイトル' })] })
    const mine = makeMapFile({ nodes: [makeNode('n1', { title: '同じ変更' })] })
    const theirs = makeMapFile({ nodes: [makeNode('n1', { title: '同じ変更' })] })

    const { merged, conflicts } = mergeMapFiles(base, mine, theirs)

    expect(conflicts).toHaveLength(0)
    expect(merged.nodes).toEqual([makeNode('n1', { title: '同じ変更' })])
  })

  it('双方が異なる内容に変更した場合は真の衝突として積み、暫定的に mine を採用する', () => {
    const base = makeMapFile({ nodes: [makeNode('n1', { title: '元のタイトル' })] })
    const mine = makeMapFile({ nodes: [makeNode('n1', { title: '自分の変更' })] })
    const theirs = makeMapFile({ nodes: [makeNode('n1', { title: '相手の変更' })] })

    const { merged, conflicts } = mergeMapFiles(base, mine, theirs)

    expect(conflicts).toEqual([
      {
        kind: 'node',
        id: 'n1',
        base: makeNode('n1', { title: '元のタイトル' }),
        mine: makeNode('n1', { title: '自分の変更' }),
        theirs: makeNode('n1', { title: '相手の変更' }),
      },
    ])
    expect(merged.nodes).toEqual([makeNode('n1', { title: '自分の変更' })])
  })

  it('片方が削除しもう片方が編集した場合は衝突になる', () => {
    const base = makeMapFile({ nodes: [makeNode('n1', { title: '元のタイトル' })] })
    const mine = makeMapFile({ nodes: [] }) // 自分が削除
    const theirs = makeMapFile({ nodes: [makeNode('n1', { title: '相手の変更' })] }) // 相手が編集

    const { merged, conflicts } = mergeMapFiles(base, mine, theirs)

    expect(conflicts).toEqual([
      {
        kind: 'node',
        id: 'n1',
        base: makeNode('n1', { title: '元のタイトル' }),
        mine: null,
        theirs: makeNode('n1', { title: '相手の変更' }),
      },
    ])
    // 暫定的に mine（削除）を採用するため、衝突解決前の merged には含まれない
    expect(merged.nodes).toEqual([])
  })

  it('双方が base と同じ新規ノードを追加した場合は衝突にならず1件だけ残る', () => {
    const base = makeMapFile({ nodes: [] })
    const mine = makeMapFile({ nodes: [makeNode('n2', { title: '新規ノード' })] })
    const theirs = makeMapFile({ nodes: [makeNode('n2', { title: '新規ノード' })] })

    const { merged, conflicts } = mergeMapFiles(base, mine, theirs)

    expect(conflicts).toHaveLength(0)
    expect(merged.nodes).toEqual([makeNode('n2', { title: '新規ノード' })])
  })

  it('双方が異なる内容の新規ノードを同じ id で追加した場合は衝突になる', () => {
    const base = makeMapFile({ nodes: [] })
    const mine = makeMapFile({ nodes: [makeNode('n2', { title: '自分の新規' })] })
    const theirs = makeMapFile({ nodes: [makeNode('n2', { title: '相手の新規' })] })

    const { conflicts } = mergeMapFiles(base, mine, theirs)

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].base).toBeNull()
  })

  it('base にあり mine/theirs 双方から消えたノードは削除を採用する（衝突なし）', () => {
    const base = makeMapFile({ nodes: [makeNode('n1')] })
    const mine = makeMapFile({ nodes: [] })
    const theirs = makeMapFile({ nodes: [] })

    const { merged, conflicts } = mergeMapFiles(base, mine, theirs)

    expect(conflicts).toHaveLength(0)
    expect(merged.nodes).toEqual([])
  })

  it('双方とも無変更のノードはそのまま残る', () => {
    const node = makeNode('n1')
    const base = makeMapFile({ nodes: [node] })
    const mine = makeMapFile({ nodes: [node] })
    const theirs = makeMapFile({ nodes: [node] })

    const { merged, conflicts } = mergeMapFiles(base, mine, theirs)

    expect(conflicts).toHaveLength(0)
    expect(merged.nodes).toEqual([node])
  })

  it('updatedAt のみが異なるノードは無変更とみなす（誤検出しない）', () => {
    const base = makeMapFile({ nodes: [makeNode('n1', { updatedAt: '2026-01-01T00:00:00.000Z' })] })
    const mine = makeMapFile({ nodes: [makeNode('n1', { updatedAt: '2026-01-02T00:00:00.000Z' })] })
    const theirs = makeMapFile({ nodes: [makeNode('n1', { updatedAt: '2026-01-01T00:00:00.000Z' })] })

    const { merged, conflicts } = mergeMapFiles(base, mine, theirs)

    expect(conflicts).toHaveLength(0)
    // mine 側が無変更（updatedAt だけ違う）として扱われても theirs も無変更なので base のまま
    expect(merged.nodes).toEqual([makeNode('n1', { updatedAt: '2026-01-01T00:00:00.000Z' })])
  })
})

describe('mergeMapFiles / エッジ', () => {
  it('片方のみ変更したエッジはその内容を採用する', () => {
    const base = makeMapFile({ edges: [makeEdge('e1', { label: '元のラベル' })] })
    const mine = makeMapFile({ edges: [makeEdge('e1', { label: '自分の変更' })] })
    const theirs = makeMapFile({ edges: [makeEdge('e1', { label: '元のラベル' })] })

    const { merged, conflicts } = mergeMapFiles(base, mine, theirs)

    expect(conflicts).toHaveLength(0)
    expect(merged.edges).toEqual([makeEdge('e1', { label: '自分の変更' })])
  })

  it('双方が異なる内容に変更したエッジは衝突になる', () => {
    const base = makeMapFile({ edges: [makeEdge('e1', { label: '元のラベル' })] })
    const mine = makeMapFile({ edges: [makeEdge('e1', { label: '自分の変更' })] })
    const theirs = makeMapFile({ edges: [makeEdge('e1', { label: '相手の変更' })] })

    const { merged, conflicts } = mergeMapFiles(base, mine, theirs)

    expect(conflicts).toEqual([
      {
        kind: 'edge',
        id: 'e1',
        base: makeEdge('e1', { label: '元のラベル' }),
        mine: makeEdge('e1', { label: '自分の変更' }),
        theirs: makeEdge('e1', { label: '相手の変更' }),
      },
    ])
    expect(merged.edges).toEqual([makeEdge('e1', { label: '自分の変更' })])
  })

  it('自分だけが新規追加したエッジはそのまま採用される', () => {
    const base = makeMapFile({ edges: [] })
    const mine = makeMapFile({ edges: [makeEdge('e2')] })
    const theirs = makeMapFile({ edges: [] })

    const { merged, conflicts } = mergeMapFiles(base, mine, theirs)

    expect(conflicts).toHaveLength(0)
    expect(merged.edges).toEqual([makeEdge('e2')])
  })

  it('base にあり双方から消えたエッジは削除を採用する（衝突なし）', () => {
    const base = makeMapFile({ edges: [makeEdge('e1')] })
    const mine = makeMapFile({ edges: [] })
    const theirs = makeMapFile({ edges: [] })

    const { merged, conflicts } = mergeMapFiles(base, mine, theirs)

    expect(conflicts).toHaveLength(0)
    expect(merged.edges).toEqual([])
  })
})

describe('mergeMapFiles / マップ全体のメタ情報', () => {
  it('title・presentationNodeIds は mine（自分側）を引き継ぐ', () => {
    const base = makeMapFile({ title: 'ベース', presentationNodeIds: ['n1'] })
    const mine = makeMapFile({ title: '自分のタイトル', presentationNodeIds: ['n2'] })
    const theirs = makeMapFile({ title: '相手のタイトル', presentationNodeIds: ['n3'] })

    const { merged } = mergeMapFiles(base, mine, theirs)

    expect(merged.title).toBe('自分のタイトル')
    expect(merged.presentationNodeIds).toEqual(['n2'])
    expect(merged.mapId).toBe(mine.mapId)
  })
})

describe('applyConflictResolutions', () => {
  it('mine を選ぶと自分側の内容に置き換わる', () => {
    const merged = makeMapFile({ nodes: [makeNode('n1', { title: '自分の変更' })] })
    const conflicts = [
      {
        kind: 'node' as const,
        id: 'n1',
        base: makeNode('n1', { title: '元' }),
        mine: makeNode('n1', { title: '自分の変更' }),
        theirs: makeNode('n1', { title: '相手の変更' }),
      },
    ]

    const result = applyConflictResolutions(merged, conflicts, { n1: 'mine' })

    expect(result.nodes).toEqual([makeNode('n1', { title: '自分の変更' })])
  })

  it('theirs を選ぶと相手側の内容に置き換わる', () => {
    const merged = makeMapFile({ nodes: [makeNode('n1', { title: '自分の変更' })] })
    const conflicts = [
      {
        kind: 'node' as const,
        id: 'n1',
        base: makeNode('n1', { title: '元' }),
        mine: makeNode('n1', { title: '自分の変更' }),
        theirs: makeNode('n1', { title: '相手の変更' }),
      },
    ]

    const result = applyConflictResolutions(merged, conflicts, { n1: 'theirs' })

    expect(result.nodes).toEqual([makeNode('n1', { title: '相手の変更' })])
  })

  it('選んだ側が削除（null）なら merged から取り除く', () => {
    const merged = makeMapFile({ nodes: [] }) // 暫定的に mine（削除）が採用済み
    const conflicts = [
      {
        kind: 'node' as const,
        id: 'n1',
        base: makeNode('n1'),
        mine: null,
        theirs: makeNode('n1', { title: '相手の変更' }),
      },
    ]

    // theirs（編集）を選ぶと merged に無かったノードが復活する
    const result = applyConflictResolutions(merged, conflicts, { n1: 'theirs' })
    expect(result.nodes).toEqual([makeNode('n1', { title: '相手の変更' })])

    // mine（削除）のままなら merged は空のまま
    const keepDeleted = applyConflictResolutions(merged, conflicts, { n1: 'mine' })
    expect(keepDeleted.nodes).toEqual([])
  })
})
