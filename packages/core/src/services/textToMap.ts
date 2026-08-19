import { v4 as uuidv4 } from 'uuid'
import type { Node, Edge } from '@xyflow/react'
import { applyRadialLayout } from '../layout/mapLayout'
import { sanitizeExtractedNodes, type ExtractedNode } from '../llm/aiService'
import type { IdeaNodeData, SerializedEdge, SerializedNode } from '../types'

export interface MapFragment {
  nodes: SerializedNode[]
  edges: SerializedEdge[]
}

// mapLayout.ts の ideaNode 既定幅と同じ値。既存マップの外接矩形（右端）を求めるためだけに使う
// （SerializedNode.width は通常グループノードにしか入らないため、アイデアノードはこの既定値で見積もる）
const DEFAULT_NODE_WIDTH = 288

/**
 * AIが抽出したノード群（Phase 44 ブレインダンプ→マップ生成）を、
 * 実際にマップへ読み込める断片（新規ID・座標・エッジ付き）に変換する。
 *
 * sanitizeExtractedNodes を通してから使う。extractMapFromText は既にサニタイズ済みの結果を返すが、
 * ここでも通しておくことで（冪等なので害はない）、この関数を直接テストするときに壊れた入力
 * （存在しない parentTempId・循環参照）にも単体で耐えられる。
 */
export async function buildMapFragmentFromExtracted(
  extracted: ExtractedNode[],
  existing?: { nodes: SerializedNode[] }
): Promise<MapFragment> {
  const nodes = sanitizeExtractedNodes(extracted)
  const idMap = new Map(nodes.map((n) => [n.tempId, uuidv4()]))
  const existingIds = new Set((existing?.nodes ?? []).map((n) => n.id))

  const flowNodes: Node<IdeaNodeData>[] = nodes.map((n) => ({
    id: idMap.get(n.tempId)!,
    type: 'ideaNode',
    position: { x: 0, y: 0 },
    data: {
      title: n.title,
      body: n.body,
      color: '#ffffff',
      createdBy: 'ai' as const,
      categoryId: n.categoryId,
    },
  }))

  // レイアウトに渡すのは新規ノード同士の親子関係（parentTempId）のみ。既存ノードへの接続
  // （parentNodeId）はレイアウト対象外の実ノードを指すため、シリアライズ後の edges にだけ追加する
  const layoutEdges: Edge[] = nodes
    .filter((n) => n.parentTempId)
    .map((n) => ({
      id: `${n.parentTempId}-${n.tempId}`,
      // sanitizeExtractedNodes 済みなので parentTempId は必ず idMap に存在する
      source: idMap.get(n.parentTempId!)!,
      target: idMap.get(n.tempId)!,
    }))

  const laidOut = await applyRadialLayout(flowNodes, layoutEdges)
  const offset = computeOffset(laidOut, existing?.nodes)

  const serializedNodes: SerializedNode[] = laidOut.map((n) => ({
    id: n.id,
    nodeType: 'idea' as const,
    title: n.data.title,
    body: n.data.body,
    x: n.position.x + offset.x,
    y: n.position.y + offset.y,
    color: n.data.color,
    createdBy: n.data.createdBy,
    categoryId: n.data.categoryId,
  }))

  // エッジは new→new（parentTempId）を優先し、なければ existing→new（parentNodeId、実在するIDのみ）
  const edges: SerializedEdge[] = []
  for (const n of nodes) {
    const target = idMap.get(n.tempId)!
    const source = n.parentTempId ? idMap.get(n.parentTempId) : n.parentNodeId
    if (!source) continue
    if (!n.parentTempId && !existingIds.has(source)) continue
    edges.push({ id: uuidv4(), source, target, sourceHandle: 'right', targetHandle: 'left', label: '' })
  }

  return { nodes: serializedNodes, edges }
}

/** 追記モードでは新規ブロックを「既存マップの外接矩形の右端 + 200px」から始まるよう平行移動する */
function computeOffset(
  laidOut: Node<IdeaNodeData>[],
  existingNodes: SerializedNode[] | undefined
): { x: number; y: number } {
  if (!existingNodes || existingNodes.length === 0 || laidOut.length === 0) return { x: 0, y: 0 }

  const existingMaxRight = Math.max(...existingNodes.map((n) => n.x + (n.width ?? DEFAULT_NODE_WIDTH)))
  const existingMinY = Math.min(...existingNodes.map((n) => n.y))
  const newMinX = Math.min(...laidOut.map((n) => n.position.x))
  const newMinY = Math.min(...laidOut.map((n) => n.position.y))

  return { x: existingMaxRight + 200 - newMinX, y: existingMinY - newMinY }
}
