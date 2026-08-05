import type { SerializedNode, SerializedEdge } from '../types'

/**
 * 旧バージョンのマップファイルを読み込むための互換処理を集約する。
 * 新たな互換対応が必要になったらストア側ではなくこのファイルに追加すること。
 */

/** 初期バージョンはノード見出しを `text` フィールドに持っていた */
export function readNodeTitle(node: SerializedNode): string {
  return node.title ?? (node as { text?: string }).text ?? ''
}

/**
 * ハンドルIDを持たない古いエッジは左右ハンドルとして扱う。
 * FloatingEdge は描画時にハンドルIDを参照しないため、値は接続方向の記録用。
 */
export function readEdgeHandles(edge: SerializedEdge): { sourceHandle: string; targetHandle: string } {
  return {
    sourceHandle: edge.sourceHandle ?? 'right',
    targetHandle: edge.targetHandle ?? 'left',
  }
}
