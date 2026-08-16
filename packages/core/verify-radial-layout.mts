// 放射状レイアウトの自己チェック。`pnpm check:radial` で実行する。
//
// 「ノード同士が重ならない」ことだけを確認する。角度配分と半径の計算を壊すと
// 見た目が一気に破綻するが、目視でしか気づけないのでここで機械的に検出する。
// src の外に置いてあるので tsc -b の対象外（テストランナーは導入していない）。
import assert from 'node:assert/strict'
import type { Node, Edge } from '@xyflow/react'
import type { IdeaNodeData } from './src/types/index.ts'
import { applyRadialLayout } from './src/layout/mapLayout.ts'

const W = 192
const H = 64

function node(id: string): Node<IdeaNodeData> {
  return {
    id,
    type: 'ideaNode',
    position: { x: 0, y: 0 },
    data: { label: id } as IdeaNodeData,
  }
}

function edge(source: string, target: string): Edge {
  return { id: `${source}-${target}`, source, target }
}

/** 幅 breadth・深さ depth の木を作る */
function tree(breadth: number, depth: number) {
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

function assertNoOverlap(laid: Node<IdeaNodeData>[], label: string) {
  for (let i = 0; i < laid.length; i++) {
    for (let j = i + 1; j < laid.length; j++) {
      const a = laid[i].position
      const b = laid[j].position
      const overlaps = Math.abs(a.x - b.x) < W && Math.abs(a.y - b.y) < H
      assert.ok(
        !overlaps,
        `${label}: ${laid[i].id} と ${laid[j].id} が重なっている ` +
          `(${a.x.toFixed(0)},${a.y.toFixed(0)}) / (${b.x.toFixed(0)},${b.y.toFixed(0)})`
      )
    }
  }
}

// jiti 1.x はトップレベル await を扱えないので main() でくるむ
async function main() {
  for (const [breadth, depth] of [
    [3, 1],
    [5, 1],
    [3, 2],
    [4, 2],
    [2, 4],
    [3, 3],
  ] as const) {
    const { nodes, edges } = tree(breadth, depth)
    const laid = await applyRadialLayout(nodes, edges)
    assert.equal(laid.length, nodes.length)
    assertNoOverlap(laid, `breadth=${breadth} depth=${depth} (${nodes.length}ノード)`)
    console.log(`OK breadth=${breadth} depth=${depth} — ${nodes.length}ノードが重ならず配置された`)
  }

  // 孤立ノード（エッジなし）も他と重ならないこと
  const { nodes, edges } = tree(3, 2)
  nodes.push(node('lonely-a'), node('lonely-b'))
  assertNoOverlap(await applyRadialLayout(nodes, edges), '孤立ノードあり')
  console.log('OK 孤立ノードあり')

  console.log('\n放射状レイアウトの自己チェック: 全て通過')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
