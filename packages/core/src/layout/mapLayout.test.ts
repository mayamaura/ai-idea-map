import { describe, expect, it } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import type { IdeaNodeData } from '../types'
import { applyRadialLayout, applyDagreLayout } from './mapLayout'

// verify-radial-layout.mts からの移植。放射状レイアウトは「ノード同士が重ならない」
// ことと「末端が親のすぐそばに来る」ことを機械的に検出しないと、角度・半径の計算を
// 壊しても見た目でしか気づけない。

const W = 288
const H = 64

function node(id: string): Node<IdeaNodeData> {
  return {
    id,
    type: 'ideaNode',
    position: { x: 0, y: 0 },
    data: { title: id, color: '#fff', createdBy: 'user' },
  }
}

function edge(source: string, target: string): Edge {
  return { id: `${source}-${target}`, source, target }
}

/** 幅 breadth・深さ depth の木を作る */
function tree(breadth: number, depth: number): { nodes: Node<IdeaNodeData>[]; edges: Edge[] } {
  const nodes = [node('root')]
  const edges: Edge[] = []
  let frontier = ['root']
  for (let d = 0; d < depth; d++) {
    const next: string[] = []
    for (const parent of frontier) {
      for (let i = 0; i < breadth; i++) {
        const id = `${parent}.${i}`
        nodes.push(node(id))
        edges.push(edge(parent, id))
        next.push(id)
      }
    }
    frontier = next
  }
  return { nodes, edges }
}

/**
 * 末端（子を持たないノード）が親のすぐそばに置かれること。
 * 深さで半径を決めていた頃はここが数百px単位で開き、放射状に見えなかった。
 * 上位のノードほど大きなサブツリーを抱えるぶん親から離れるのは想定どおりなので、末端だけを見る。
 */
function longestLeafDistance(laid: Node<IdeaNodeData>[], edges: Edge[]): number {
  const MAX = 480 // ノード幅ぶん中心間距離が伸びるため W に追随する目安値
  const pos = new Map(laid.map((n) => [n.id, n.position]))
  const hasChild = new Set(edges.map((e) => e.source))
  let longest = 0
  for (const e of edges) {
    if (hasChild.has(e.target)) continue
    const a = pos.get(e.source)
    const b = pos.get(e.target)
    if (!a || !b) continue
    const d = Math.hypot(a.x - b.x, a.y - b.y)
    longest = Math.max(longest, d)
    expect(d, `末端 ${e.target} が親から ${d.toFixed(0)}px（上限 ${MAX}）`).toBeLessThanOrEqual(MAX)
  }
  return longest
}

function assertNoOverlap(laid: Node<IdeaNodeData>[]): void {
  for (let i = 0; i < laid.length; i++) {
    for (let j = i + 1; j < laid.length; j++) {
      const a = laid[i].position
      const b = laid[j].position
      const overlaps = Math.abs(a.x - b.x) < W && Math.abs(a.y - b.y) < H
      expect(
        overlaps,
        `${laid[i].id} と ${laid[j].id} が重なっている ` +
          `(${a.x.toFixed(0)},${a.y.toFixed(0)}) / (${b.x.toFixed(0)},${b.y.toFixed(0)})`
      ).toBe(false)
    }
  }
}

describe('applyRadialLayout', () => {
  const cases = [
    [3, 1],
    [5, 1],
    [3, 2],
    [4, 2],
    [2, 4],
    [3, 3],
  ] as const

  it.each(cases)('breadth=%i depth=%i でノードが重ならず、末端が親の近くに来る', async (breadth, depth) => {
    const { nodes, edges } = tree(breadth, depth)
    const laid = await applyRadialLayout(nodes, edges)
    expect(laid.length).toBe(nodes.length)
    assertNoOverlap(laid)
    longestLeafDistance(laid, edges)
  })

  it('枝ごとに子の数が違う木でも重ならず、末端が親の近くに来る', async () => {
    const nodes = [node('root')]
    const edges: Edge[] = []
    ;[3, 5, 4, 6].forEach((kids, b) => {
      const branch = `branch${b}`
      nodes.push(node(branch))
      edges.push(edge('root', branch))
      for (let i = 0; i < kids; i++) {
        nodes.push(node(`${branch}.${i}`))
        edges.push(edge(branch, `${branch}.${i}`))
      }
    })
    const laid = await applyRadialLayout(nodes, edges)
    assertNoOverlap(laid)
    longestLeafDistance(laid, edges)
  })

  it('孤立ノード（エッジなし）があっても他と重ならない', async () => {
    const { nodes, edges } = tree(3, 2)
    nodes.push(node('lonely-a'), node('lonely-b'))
    const laid = await applyRadialLayout(nodes, edges)
    assertNoOverlap(laid)
  })

  it('トップレベルノードが1件だけなら中心 (0,0) に置く', async () => {
    const nodes = [node('solo')]
    const laid = await applyRadialLayout(nodes, [])
    expect(laid).toHaveLength(1)
    expect(laid[0].position).toEqual({ x: -W / 2, y: -H / 2 })
  })

  it('ノードが0件なら入力をそのまま返す', async () => {
    const nodes: Node<IdeaNodeData>[] = []
    const laid = await applyRadialLayout(nodes, [])
    expect(laid).toBe(nodes)
  })
})

describe('applyDagreLayout', () => {
  it('ノード数を維持し、座標が有限値になる', async () => {
    const { nodes, edges } = tree(3, 2)
    const laid = await applyDagreLayout(nodes, edges)
    expect(laid.length).toBe(nodes.length)
    for (const n of laid) {
      expect(Number.isFinite(n.position.x)).toBe(true)
      expect(Number.isFinite(n.position.y)).toBe(true)
    }
  })

  it('rankdir "LR" は親→子でx座標が増加し、"TB" は親→子でy座標が増加する', async () => {
    const { nodes, edges } = tree(2, 3)
    const lr = await applyDagreLayout(nodes, edges, 'LR')
    const tb = await applyDagreLayout(nodes, edges, 'TB')
    const posOf = (laid: Node<IdeaNodeData>[]) => new Map(laid.map((n) => [n.id, n.position]))
    const lrPos = posOf(lr)
    const tbPos = posOf(tb)

    for (const e of edges) {
      const lrParent = lrPos.get(e.source)
      const lrChild = lrPos.get(e.target)
      const tbParent = tbPos.get(e.source)
      const tbChild = tbPos.get(e.target)
      if (!lrParent || !lrChild || !tbParent || !tbChild) {
        throw new Error(`位置が見つからない: ${e.source} -> ${e.target}`)
      }
      expect(lrChild.x).toBeGreaterThan(lrParent.x)
      expect(tbChild.y).toBeGreaterThan(tbParent.y)
    }
  })

  it('ノードが0件なら入力をそのまま返す', async () => {
    const nodes: Node<IdeaNodeData>[] = []
    const laid = await applyDagreLayout(nodes, [])
    expect(laid).toBe(nodes)
  })
})
