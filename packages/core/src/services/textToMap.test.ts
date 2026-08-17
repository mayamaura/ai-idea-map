import { describe, expect, it } from 'vitest'
import type { ExtractedNode } from '../llm/aiService'
import type { SerializedNode } from '../types'
import { buildMapFragmentFromExtracted } from './textToMap'

function extractedNode(overrides: Partial<ExtractedNode> & { tempId: string; title: string }): ExtractedNode {
  return overrides
}

function byTitle(nodes: SerializedNode[], title: string): SerializedNode {
  const found = nodes.find((n) => n.title === title)
  if (!found) throw new Error(`ノードが見つからない: ${title}`)
  return found
}

describe('buildMapFragmentFromExtracted', () => {
  it('parentTempId から親→子のエッジを生成する（先例のインポートと同じ体裁: label空・right/leftハンドル）', async () => {
    const extracted: ExtractedNode[] = [
      extractedNode({ tempId: 'n1', title: '親' }),
      extractedNode({ tempId: 'n2', title: '子', parentTempId: 'n1' }),
    ]
    const fragment = await buildMapFragmentFromExtracted(extracted)
    expect(fragment.nodes).toHaveLength(2)
    expect(fragment.edges).toHaveLength(1)

    const parent = byTitle(fragment.nodes, '親')
    const child = byTitle(fragment.nodes, '子')
    const [edge] = fragment.edges
    expect(edge.source).toBe(parent.id)
    expect(edge.target).toBe(child.id)
    expect(edge.label).toBe('')
    expect(edge.sourceHandle).toBe('right')
    expect(edge.targetHandle).toBe('left')
  })

  it('存在しない parentTempId を指すノードはルート扱いになり、エッジを作らない', async () => {
    const extracted: ExtractedNode[] = [
      extractedNode({ tempId: 'n1', title: '孤立', parentTempId: 'ghost' }),
    ]
    const fragment = await buildMapFragmentFromExtracted(extracted)
    expect(fragment.nodes).toHaveLength(1)
    expect(fragment.edges).toHaveLength(0)
  })

  it('循環参照になっている parentTempId 同士はルート扱いに落ち、エッジを作らない', async () => {
    const extracted: ExtractedNode[] = [
      extractedNode({ tempId: 'a', title: 'A', parentTempId: 'b' }),
      extractedNode({ tempId: 'b', title: 'B', parentTempId: 'a' }),
    ]
    const fragment = await buildMapFragmentFromExtracted(extracted)
    expect(fragment.nodes).toHaveLength(2)
    expect(fragment.edges).toHaveLength(0)
  })

  it('parentNodeId で既存ノードに接続する', async () => {
    const existingNode: SerializedNode = { id: 'existing-1', title: '既存', x: 0, y: 0, color: '#fff', createdBy: 'user' }
    const extracted: ExtractedNode[] = [
      extractedNode({ tempId: 'n1', title: '新規の子', parentNodeId: 'existing-1' }),
    ]
    const fragment = await buildMapFragmentFromExtracted(extracted, { nodes: [existingNode] })
    expect(fragment.edges).toHaveLength(1)
    const [edge] = fragment.edges
    expect(edge.source).toBe('existing-1')
    expect(edge.target).toBe(byTitle(fragment.nodes, '新規の子').id)
  })

  it('存在しない parentNodeId は無視される（エッジを作らない）', async () => {
    const existingNode: SerializedNode = { id: 'existing-1', title: '既存', x: 0, y: 0, color: '#fff', createdBy: 'user' }
    const extracted: ExtractedNode[] = [
      extractedNode({ tempId: 'n1', title: '新規', parentNodeId: 'not-real' }),
    ]
    const fragment = await buildMapFragmentFromExtracted(extracted, { nodes: [existingNode] })
    expect(fragment.edges).toHaveLength(0)
  })

  it('追記モードでは新規ノードが既存マップの外接矩形の右側（右端+200px起点）に配置される', async () => {
    const existingNode: SerializedNode = { id: 'existing-1', title: '既存', x: 0, y: 0, color: '#fff', createdBy: 'user' }
    const extracted: ExtractedNode[] = [extractedNode({ tempId: 'n1', title: '新規' })]
    const fragment = await buildMapFragmentFromExtracted(extracted, { nodes: [existingNode] })
    // 既存ノードの右端(0 + 幅192) + 200px が新規ブロックの左端になる
    expect(fragment.nodes[0].x).toBe(392)
  })

  it('新規マップ生成（existing省略）では平行移動しない', async () => {
    const extracted: ExtractedNode[] = [extractedNode({ tempId: 'n1', title: '新規' })]
    const fragment = await buildMapFragmentFromExtracted(extracted)
    // トップレベル1件のときの放射状レイアウトは中心(0,0)基準の左上座標になる
    expect(fragment.nodes[0].x).toBe(-96)
    expect(fragment.nodes[0].y).toBe(-32)
  })

  it('座標がすべて有限値になる（複数階層・複数ルートの木でも）', async () => {
    const extracted: ExtractedNode[] = [
      extractedNode({ tempId: 'r1', title: 'ルート1' }),
      extractedNode({ tempId: 'r1-a', title: '子1', parentTempId: 'r1' }),
      extractedNode({ tempId: 'r1-a-a', title: '孫1', parentTempId: 'r1-a' }),
      extractedNode({ tempId: 'r2', title: 'ルート2' }),
      extractedNode({ tempId: 'r2-a', title: '子2', parentTempId: 'r2' }),
    ]
    const fragment = await buildMapFragmentFromExtracted(extracted)
    expect(fragment.nodes).toHaveLength(5)
    for (const n of fragment.nodes) {
      expect(Number.isFinite(n.x)).toBe(true)
      expect(Number.isFinite(n.y)).toBe(true)
    }
  })

  it('tempId が重複する場合は後勝ちで1件だけ残る', async () => {
    const extracted: ExtractedNode[] = [
      extractedNode({ tempId: 'n1', title: '古い' }),
      extractedNode({ tempId: 'n1', title: '新しい' }),
    ]
    const fragment = await buildMapFragmentFromExtracted(extracted)
    expect(fragment.nodes).toHaveLength(1)
    expect(fragment.nodes[0].title).toBe('新しい')
  })

  it('タイトルが空のノードは除外される', async () => {
    const extracted: ExtractedNode[] = [
      extractedNode({ tempId: 'n1', title: '  ' }),
      extractedNode({ tempId: 'n2', title: '有効' }),
    ]
    const fragment = await buildMapFragmentFromExtracted(extracted)
    expect(fragment.nodes).toHaveLength(1)
    expect(fragment.nodes[0].title).toBe('有効')
  })
})
