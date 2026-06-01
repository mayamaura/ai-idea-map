import { toPng, toSvg } from 'html-to-image'
import { getNodesBounds, getViewportForBounds } from '@xyflow/react'
import type { Node, Edge } from '@xyflow/react'
import { v4 as uuidv4 } from 'uuid'
import type { IdeaNodeData, MapFile, SerializedNode, SerializedEdge } from '../types'

const EXPORT_WIDTH = 1920
const EXPORT_HEIGHT = 1080
// base64エンコード後のURL文字数がこれを超えると警告（ブラウザURL制限を考慮）
const URL_SIZE_WARNING = 50000

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  link.click()
}

function downloadText(text: string, filename: string, mimeType: string) {
  const blob = new Blob([text], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = filename
  link.href = url
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
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

  if (format === 'png') {
    const dataUrl = await toPng(viewportEl, imageOptions)
    downloadDataUrl(dataUrl, filename)
  } else {
    const dataUrl = await toSvg(viewportEl, imageOptions)
    downloadText(dataUrl, filename, 'image/svg+xml')
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

// 共有URL生成
export function generateShareUrl(mapFile: MapFile): { url: string; tooLarge: boolean } {
  const json = JSON.stringify(mapFile)
  const encoded = btoa(unescape(encodeURIComponent(json)))
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('map', encoded)
  return { url: url.toString(), tooLarge: encoded.length > URL_SIZE_WARNING }
}

// URLからマップデータを解析
export function parseMapFromUrl(): MapFile | null {
  try {
    const params = new URLSearchParams(window.location.search)
    const encoded = params.get('map')
    if (!encoded) return null
    const json = decodeURIComponent(escape(atob(encoded)))
    const data = JSON.parse(json) as MapFile
    if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) return null
    return data
  } catch {
    return null
  }
}

// URLの map パラメーターをクリア（インポート後）
export function clearMapFromUrl(): void {
  const url = new URL(window.location.href)
  url.searchParams.delete('map')
  window.history.replaceState({}, '', url.toString())
}
