import { getNodesBounds, getViewportForBounds } from '@xyflow/react'
import type { Node, Edge } from '@xyflow/react'
import { v4 as uuidv4 } from 'uuid'
import { getPlatform } from '@ideamap/platform'
import type { IdeaNodeData, MapFile, SerializedNode, SerializedEdge } from '@ideamap/core'

const EXPORT_WIDTH = 1920
const EXPORT_HEIGHT = 1080

/**
 * データURLをそのバイト列の Blob に戻す。
 * 従来の `<a download href={dataUrl}>` はブラウザがデコードして書き出していたため、
 * FileAdapter 経由でも同じバイト列になるようここでデコードする。
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const commaIdx = dataUrl.indexOf(',')
  const header = dataUrl.slice(0, commaIdx)
  const body = dataUrl.slice(commaIdx + 1)
  const mime = /data:([^;,]+)/.exec(header)?.[1] ?? 'application/octet-stream'
  if (header.includes(';base64')) {
    const bin = atob(body)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new Blob([bytes], { type: mime })
  }
  return new Blob([decodeURIComponent(body)], { type: mime })
}

function downloadBlob(blob: Blob, filename: string): void {
  // Web = <a download>、Desktop = 保存ダイアログ + fs。差は FileAdapter が吸収する
  void getPlatform().file.exportBlob(filename, blob)
}

function downloadText(text: string, filename: string, mimeType: string) {
  downloadBlob(new Blob([text], { type: mimeType }), filename)
}

// PNG / SVG エクスポート
export async function exportMapAsImage(
  format: 'png' | 'svg',
  mode: 'current' | 'full',
  options: {
    transparent: boolean
    highDpi: boolean
    nodes: Node<IdeaNodeData>[]
    currentViewport: { x: number; y: number; zoom: number }
    title: string
  }
): Promise<void> {
  const viewportEl = document.querySelector('.react-flow__viewport') as HTMLElement | null
  if (!viewportEl) throw new Error('React Flow の要素が見つかりません')

  const scale = options.highDpi ? 2 : 1
  const width = EXPORT_WIDTH * scale
  const height = EXPORT_HEIGHT * scale

  let transformStyle: string

  if (mode === 'full' && options.nodes.length > 0) {
    const bounds = getNodesBounds(options.nodes)
    const padding = 40
    const vp = getViewportForBounds(
      {
        x: bounds.x - padding,
        y: bounds.y - padding,
        width: bounds.width + padding * 2,
        height: bounds.height + padding * 2,
      },
      width,
      height,
      0.05,
      2,
      0
    )
    transformStyle = `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`
  } else {
    const { x, y, zoom } = options.currentViewport
    transformStyle = `translate(${x * scale}px, ${y * scale}px) scale(${zoom * scale})`
  }

  const bg = options.transparent ? undefined : '#f9fafb'

  const imageOptions = {
    backgroundColor: bg,
    width,
    height,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: transformStyle,
    },
  }

  const filename = `${options.title}.${format}`

  // html-to-image は画像エクスポート時にしか使わないため初回ロードから外す
  const { toPng, toSvg } = await import('html-to-image')

  if (format === 'png') {
    const dataUrl = await toPng(viewportEl, imageOptions)
    downloadBlob(dataUrlToBlob(dataUrl), filename)
  } else {
    // toSvg が返すのは `data:image/svg+xml;charset=utf-8,<percent-encoded XML>` であって
    // SVG 本体ではない。PNG と同じくデコードしてから書き出さないと、
    // 先頭が `data:` で始まるファイルになりブラウザが XML として解析できない
    const dataUrl = await toSvg(viewportEl, imageOptions)
    downloadBlob(dataUrlToBlob(dataUrl), filename)
  }
}

// JSON エクスポート
export function exportAsJson(mapFile: MapFile): void {
  const json = JSON.stringify(mapFile, null, 2)
  downloadText(json, `${mapFile.title}.json`, 'application/json')
}

// Markdown エクスポート（BFS でツリー構造に変換）
export function exportAsMarkdown(
  nodes: Node<IdeaNodeData>[],
  edges: Edge[],
  title: string
): void {
  const md = buildMarkdown(nodes, edges, title)
  downloadText(md, `${title}.md`, 'text/markdown')
}

function buildMarkdown(
  nodes: Node<IdeaNodeData>[],
  edges: Edge[],
  title: string
): string {
  const targetSet = new Set(edges.map((e) => e.target))
  const roots = nodes.filter((n) => !targetSet.has(n.id))

  const childMap = new Map<string, string[]>()
  for (const edge of edges) {
    if (!childMap.has(edge.source)) childMap.set(edge.source, [])
    childMap.get(edge.source)!.push(edge.target)
  }

  let md = `# ${title}\n\n`
  const visited = new Set<string>()

  function traverse(nodeId: string, depth: number) {
    if (visited.has(nodeId)) return
    visited.add(nodeId)
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return

    const indent = '  '.repeat(depth)
    md += `${indent}- **${node.data.title}**\n`
    if (node.data.body) {
      const bodyLines = node.data.body.split('\n')
      for (const line of bodyLines) {
        md += `${indent}  ${line}\n`
      }
    }

    const children = childMap.get(nodeId) ?? []
    for (const childId of children) {
      traverse(childId, depth + 1)
    }
  }

  const startNodes = roots.length > 0 ? roots : nodes.slice(0, 1)
  for (const root of startNodes) {
    traverse(root.id, 0)
  }

  const unvisited = nodes.filter((n) => !visited.has(n.id))
  if (unvisited.length > 0) {
    md += '\n## その他\n\n'
    for (const node of unvisited) {
      md += `- **${node.data.title}**\n`
      if (node.data.body) {
        for (const line of node.data.body.split('\n')) {
          md += `  ${line}\n`
        }
      }
    }
  }

  return md
}

// JSON ファイルからインポート（バージョン互換チェック付き）
export async function importFromJson(file: File): Promise<MapFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as MapFile
        if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
          throw new Error('Invalid format')
        }
        resolve(data)
      } catch {
        reject(new Error('JSONファイルの形式が無効です'))
      }
    }
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'))
    reader.readAsText(file)
  })
}

// インデント付きテキスト → ノード変換（行 → ノード、インデントで親子関係）
export function indentedTextToNodes(
  text: string,
  baseX: number,
  baseY: number
): { nodes: SerializedNode[]; edges: SerializedEdge[] } {
  const lines = text.split('\n').filter((l) => l.trim().length > 0)

  const resultNodes: SerializedNode[] = []
  const resultEdges: SerializedEdge[] = []

  const SPACING_X = 280
  const SPACING_Y = 90

  function getIndent(line: string): number {
    const match = line.match(/^(\s+)/)
    if (!match) return 0
    return Math.floor(match[1].replace(/\t/g, '  ').length / 2)
  }

  function cleanTitle(line: string): string {
    return line
      .trim()
      .replace(/^[-*>•]\s*/, '')
      .replace(/^\*\*(.+)\*\*$/, '$1')
      .replace(/^#+\s*/, '')
      .trim()
  }

  // depth ごとのノードIDスタックと Y インデックス
  const depthStack: Array<{ id: string } | undefined> = []
  const depthYIdx = new Map<number, number>()

  for (const line of lines) {
    const depth = getIndent(line)
    const title = cleanTitle(line)
    if (!title) continue

    // 現在の depth より深い Y インデックスをリセット
    for (const d of [...depthYIdx.keys()]) {
      if (d > depth) depthYIdx.delete(d)
    }

    const yIdx = depthYIdx.get(depth) ?? 0
    depthYIdx.set(depth, yIdx + 1)

    const id = uuidv4()
    resultNodes.push({
      id,
      title,
      x: baseX + depth * SPACING_X,
      y: baseY + yIdx * SPACING_Y,
      color: '#ffffff',
      createdBy: 'user',
    })

    // 親エッジを作成
    depthStack.splice(depth)
    const parent = depthStack[depth - 1]
    if (parent) {
      resultEdges.push({
        id: uuidv4(),
        source: parent.id,
        target: id,
        sourceHandle: 'right',
        targetHandle: 'left',
        label: '',
      })
    }
    depthStack[depth] = { id }
  }

  return { nodes: resultNodes, edges: resultEdges }
}
