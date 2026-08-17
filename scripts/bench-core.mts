/**
 * Phase 43: 性能ベースライン計測（ブラウザ外で測れる範囲）。
 *
 * 実行: pnpm bench:core
 *   --emit を付けると計測に使うマップを .ideamap ファイルとしても書き出す
 *   （実アプリでの初期描画・ドラッグの手動計測に使う）。
 *
 * 計測対象: 自動整列（放射状 / dagre）・MapFile のシリアライズ/パース。
 * ブラウザ描画（初期描画・ドラッグ）はここでは測れないため、--emit した
 * ファイルを実アプリで開いて確認する。結果は docs/implementation-plan.md の
 * Phase 43 に記録する。
 */
import { performance } from 'node:perf_hooks'
import { writeFileSync, mkdirSync } from 'node:fs'
import { applyRadialLayout, applyDagreLayout } from '../packages/core/src/layout/mapLayout'
import type { IdeaNodeData, MapFile, SerializedNode, SerializedEdge } from '../packages/core/src/types'
import type { Node, Edge } from '@xyflow/react'

interface BenchMap {
  nodes: Node<IdeaNodeData>[]
  edges: Edge[]
}

// 乱数は再現性のため線形合同法で固定シード
function makeRng(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 0x100000000
    return s / 0x100000000
  }
}

/** ルートから枝分かれするツリー＋少数の横断エッジを持つ、実利用に近い形のマップを作る */
function makeBenchMap(nodeCount: number): BenchMap {
  const rng = makeRng(nodeCount)
  const nodes: Node<IdeaNodeData>[] = []
  const edges: Edge[] = []

  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      id: `n${i}`,
      type: 'ideaNode',
      position: { x: rng() * 4000 - 2000, y: rng() * 4000 - 2000 },
      data: {
        title: `アイデア ${i}`,
        body: i % 5 === 0 ? '補足メモのサンプルテキスト' : undefined,
        color: '#e0e7ff',
        createdBy: i % 3 === 0 ? 'ai' : 'user',
      },
    })
    if (i > 0) {
      // 前方のノードからランダムに親を選ぶ（枝分かれするツリーになる）
      const parent = Math.floor(rng() * i)
      edges.push({ id: `e${i}`, source: `n${parent}`, target: `n${i}` })
    }
  }
  // 5% の横断エッジ
  const crossCount = Math.floor(nodeCount * 0.05)
  for (let i = 0; i < crossCount; i++) {
    const a = Math.floor(rng() * nodeCount)
    const b = Math.floor(rng() * nodeCount)
    if (a !== b) edges.push({ id: `x${i}`, source: `n${a}`, target: `n${b}` })
  }
  return { nodes, edges }
}

function toMapFile(map: BenchMap, title: string): MapFile {
  const nodes: SerializedNode[] = map.nodes.map((n) => ({
    id: n.id,
    title: n.data.title,
    body: n.data.body,
    x: n.position.x,
    y: n.position.y,
    color: n.data.color,
    createdBy: n.data.createdBy,
  }))
  const edges: SerializedEdge[] = map.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: '',
  }))
  const now = new Date().toISOString()
  return {
    version: '1',
    mapId: `bench-${map.nodes.length}`,
    title,
    createdAt: now,
    updatedAt: now,
    nodes,
    edges,
  }
}

async function median(runs: number, fn: () => Promise<void> | void): Promise<number> {
  const times: number[] = []
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now()
    await fn()
    times.push(performance.now() - t0)
  }
  times.sort((a, b) => a - b)
  return times[Math.floor(times.length / 2)]
}

// jiti 1.x は CJS 変換のためトップレベル await が使えない
async function main(): Promise<void> {
const emit = process.argv.includes('--emit')
const results: string[] = []

for (const count of [500, 1000]) {
  const map = makeBenchMap(count)

  const radial = await median(3, async () => {
    await applyRadialLayout(map.nodes, map.edges)
  })
  const dagre = await median(3, async () => {
    await applyDagreLayout(map.nodes, map.edges)
  })
  const file = toMapFile(map, `ベンチマーク ${count} ノード`)
  const json = JSON.stringify(file)
  const serialize = await median(5, () => {
    JSON.stringify(file)
  })
  const parse = await median(5, () => {
    JSON.parse(json)
  })

  results.push(
    `${count}ノード: 放射状レイアウト ${radial.toFixed(1)}ms / dagre ${dagre.toFixed(1)}ms / ` +
      `シリアライズ ${serialize.toFixed(2)}ms / パース ${parse.toFixed(2)}ms / JSON ${(json.length / 1024).toFixed(0)}KB`,
  )

  if (emit) {
    mkdirSync('bench', { recursive: true })
    writeFileSync(`bench/bench-${count}.ideamap`, JSON.stringify(file, null, 2))
    results.push(`  → bench/bench-${count}.ideamap を書き出しました`)
  }
}

console.log(results.join('\n'))
}

void main()
