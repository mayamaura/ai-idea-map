import { describe, expect, it } from 'vitest'
import type { MapFile, SerializedNode, SerializedEdge } from '../types'
import { readNodeTitle, readEdgeHandles, migrateMapFile, CURRENT_MAP_FILE_VERSION } from './mapFileCompat'

function baseNode(overrides: Partial<SerializedNode>): SerializedNode {
  return { id: 'n1', title: 'デフォルトタイトル', x: 0, y: 0, color: '#fff', createdBy: 'user', ...overrides }
}

function baseEdge(overrides: Partial<SerializedEdge>): SerializedEdge {
  return { id: 'e1', source: 'a', target: 'b', label: '', ...overrides }
}

describe('readNodeTitle', () => {
  it('title があればそれを返す', () => {
    expect(readNodeTitle(baseNode({ title: '新タイトル' }))).toBe('新タイトル')
  })

  it('title がなく、初期バージョンの text フィールドがあればそれを返す', () => {
    // 初期バージョンのファイルは title を持たず text だけを持つため、型としては
    // SerializedNode を満たさない実データを想定してキャストする
    const legacyNode = {
      id: 'n1',
      x: 0,
      y: 0,
      color: '#fff',
      createdBy: 'user',
      text: '旧バージョンのタイトル',
    } as unknown as SerializedNode
    expect(readNodeTitle(legacyNode)).toBe('旧バージョンのタイトル')
  })

  it('title も text もなければ空文字を返す', () => {
    const emptyNode = {
      id: 'n1',
      x: 0,
      y: 0,
      color: '#fff',
      createdBy: 'user',
    } as unknown as SerializedNode
    expect(readNodeTitle(emptyNode)).toBe('')
  })

  it('title と text の両方があれば title を優先する', () => {
    const node = {
      id: 'n1',
      title: '新タイトル',
      x: 0,
      y: 0,
      color: '#fff',
      createdBy: 'user',
      text: '旧タイトル',
    } as unknown as SerializedNode
    expect(readNodeTitle(node)).toBe('新タイトル')
  })
})

describe('readEdgeHandles', () => {
  it('sourceHandle/targetHandle があればそのまま返す', () => {
    const edge = baseEdge({ sourceHandle: 'top', targetHandle: 'bottom' })
    expect(readEdgeHandles(edge)).toEqual({ sourceHandle: 'top', targetHandle: 'bottom' })
  })

  it('ハンドルIDを持たない古いエッジは左右ハンドル（right/left）として扱う', () => {
    const edge = baseEdge({})
    expect(readEdgeHandles(edge)).toEqual({ sourceHandle: 'right', targetHandle: 'left' })
  })

  it('null のハンドルIDも既定値（right/left）にフォールバックする', () => {
    const edge = baseEdge({ sourceHandle: null, targetHandle: null })
    expect(readEdgeHandles(edge)).toEqual({ sourceHandle: 'right', targetHandle: 'left' })
  })
})

function baseMapFile(overrides: Partial<MapFile>): MapFile {
  return {
    version: CURRENT_MAP_FILE_VERSION,
    mapId: 'map-1',
    title: 'テストマップ',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    nodes: [baseNode({})],
    edges: [],
    ...overrides,
  }
}

describe('migrateMapFile', () => {
  it('現行バージョンはそのまま返す（警告なし）', () => {
    const file = baseMapFile({})

    const result = migrateMapFile(file)

    expect(result.file).toEqual(file)
    expect(result.warning).toBeUndefined()
  })

  it('version が欠落しているファイルは現行バージョンを補完して返す（警告なし）', () => {
    // 実データには version フィールド自体が存在しないケースを想定するため、
    // 型としては MapFile を満たさない（version 欠落の）オブジェクトをキャストする
    const file = {
      mapId: 'map-1',
      title: 'テストマップ',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [baseNode({})],
      edges: [],
    } as unknown as MapFile

    const result = migrateMapFile(file)

    expect(result.file.version).toBe(CURRENT_MAP_FILE_VERSION)
    expect(result.file.nodes).toEqual(file.nodes)
    expect(result.file.edges).toEqual(file.edges)
    expect(result.warning).toBeUndefined()
  })

  it('未知の新しいバージョンは警告つきで返すが、中身はそのまま読み込める', () => {
    const file = baseMapFile({ version: '99.0' })

    const result = migrateMapFile(file)

    expect(result.warning).toBe(
      'このファイルは新しいバージョンで作成されています。一部のデータが読み込めない可能性があります'
    )
    expect(result.file.nodes).toEqual(file.nodes)
    expect(result.file.edges).toEqual(file.edges)
  })

  it('updatedAt/url/image を持たない旧ファイルも例外なく読み込める', () => {
    const legacyNode = baseNode({})
    const file = baseMapFile({ nodes: [legacyNode] })

    const result = migrateMapFile(file)

    expect(result.file.nodes[0]).toEqual(legacyNode)
    expect(result.warning).toBeUndefined()
  })
})
