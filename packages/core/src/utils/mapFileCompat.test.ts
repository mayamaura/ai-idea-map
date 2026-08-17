import { describe, expect, it } from 'vitest'
import type { SerializedNode, SerializedEdge } from '../types'
import { readNodeTitle, readEdgeHandles } from './mapFileCompat'

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
