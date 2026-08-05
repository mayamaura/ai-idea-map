import type { Node } from '@xyflow/react'
import type { IdeaNodeData } from '@ideamap/core'

/**
 * グループノードとフリーノードの当たり判定・押し出し計算。
 * mapStore（ドラッグ操作）と mapLayout（整列後の補正）の両方から使うため、
 * ストアに依存しない純粋関数としてここに置く。
 */

type FlowNode = Node<IdeaNodeData>

export interface Size {
  width: number
  height: number
}

export interface Position {
  x: number
  y: number
}

/** ノードの measured が未確定なときに使うフォールバックサイズ（ドラッグ操作系） */
export const DEFAULT_NODE_SIZE: Size = { width: 160, height: 60 }

/** グループの style.width/height が number でないときのフォールバックサイズ */
export const DEFAULT_GROUP_SIZE: Size = { width: 400, height: 300 }

/** style.width/height は '100%' などの文字列も取り得るため number のときだけ採用する */
export function getGroupSize(group: FlowNode): Size {
  return {
    width: typeof group.style?.width === 'number' ? group.style.width : DEFAULT_GROUP_SIZE.width,
    height: typeof group.style?.height === 'number' ? group.style.height : DEFAULT_GROUP_SIZE.height,
  }
}

function getNodeSize(measured: { width?: number; height?: number } | undefined, fallback: Size): Size {
  return {
    width: measured?.width ?? fallback.width,
    height: measured?.height ?? fallback.height,
  }
}

function overlaps(pos: Position, size: Size, group: FlowNode): boolean {
  const { width: gW, height: gH } = getGroupSize(group)
  const gx = group.position.x
  const gy = group.position.y
  return pos.x < gx + gW && pos.x + size.width > gx && pos.y < gy + gH && pos.y + size.height > gy
}

/** フリーノードをグループノードの外側へ押し出す位置を計算する（最小移動距離の方向へ逃がす） */
export function computePushOut(
  pos: Position,
  measured: { width?: number; height?: number } | undefined,
  groupNodes: FlowNode[],
  fallbackSize: Size = DEFAULT_NODE_SIZE
): Position {
  const size = getNodeSize(measured, fallbackSize)
  let { x, y } = pos

  for (const group of groupNodes) {
    if (!overlaps({ x, y }, size, group)) continue

    const { width: gW, height: gH } = getGroupSize(group)
    const gx = group.position.x
    const gy = group.position.y

    const dLeft = x + size.width - gx
    const dRight = gx + gW - x
    const dUp = y + size.height - gy
    const dDown = gy + gH - y

    const min = Math.min(dLeft, dRight, dUp, dDown)
    if (min === dLeft) x = gx - size.width
    else if (min === dRight) x = gx + gW
    else if (min === dUp) y = gy - size.height
    else y = gy + gH
  }

  return { x, y }
}

/** フリーノードの位置がいずれかのグループと重なるか判定し、最初にヒットしたグループを返す */
export function findOverlappingGroup(
  pos: Position,
  measured: { width?: number; height?: number } | undefined,
  groupNodes: FlowNode[],
  fallbackSize: Size = DEFAULT_NODE_SIZE
): FlowNode | null {
  const size = getNodeSize(measured, fallbackSize)
  return groupNodes.find((group) => overlaps(pos, size, group)) ?? null
}

/** 子ノードの相対座標（中心）が親グループ枠の外に出ているか判定 */
export function isOutsideParent(
  pos: Position,
  measured: { width?: number; height?: number } | undefined,
  parentGroup: FlowNode,
  fallbackSize: Size = DEFAULT_NODE_SIZE
): boolean {
  const size = getNodeSize(measured, fallbackSize)
  const centerX = pos.x + size.width / 2
  const centerY = pos.y + size.height / 2
  const { width: gW, height: gH } = getGroupSize(parentGroup)
  return centerX < 0 || centerY < 0 || centerX > gW || centerY > gH
}

/** 子ノードの相対座標を親グループ枠内に収める */
export function clampInsideParent(
  pos: Position,
  measured: { width?: number; height?: number } | undefined,
  parentGroup: FlowNode,
  fallbackSize: Size = DEFAULT_NODE_SIZE
): Position {
  const size = getNodeSize(measured, fallbackSize)
  const { width: gW, height: gH } = getGroupSize(parentGroup)
  return {
    x: Math.max(0, Math.min(pos.x, gW - size.width)),
    y: Math.max(0, Math.min(pos.y, gH - size.height)),
  }
}

/**
 * グループノードは style.width/height を measured にも反映させておく。
 * レイアウト後に React Flow の ResizeObserver が古い measured と比較して
 * 誤った dimensions change を発火するのを防ぐため。
 */
export function syncGroupMeasured(nodes: FlowNode[]): FlowNode[] {
  return nodes.map((n) => {
    if (
      n.type === 'groupNode' &&
      typeof n.style?.width === 'number' &&
      typeof n.style?.height === 'number'
    ) {
      return { ...n, measured: { width: n.style.width, height: n.style.height } }
    }
    return n
  })
}

/** 削除対象IDにグループノードが含まれる場合、その子ノードのIDも加えた集合を返す */
export function expandGroupIds(ids: Iterable<string>, nodes: FlowNode[]): Set<string> {
  const result = new Set(ids)
  for (const node of nodes) {
    if (node.type === 'groupNode' && result.has(node.id)) {
      nodes.filter((n) => n.parentId === node.id).forEach((n) => result.add(n.id))
    }
  }
  return result
}
