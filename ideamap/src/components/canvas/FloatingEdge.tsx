import { useInternalNode, BaseEdge, getBezierPath, Position, type EdgeProps } from '@xyflow/react'

type BezierArgs = {
  sourceX: number
  sourceY: number
  sourcePosition: Position
  targetX: number
  targetY: number
  targetPosition: Position
}

function calcBezierArgs(source: string, target: string, getNode: (id: string) => ReturnType<typeof useInternalNode>): BezierArgs | null {
  const sNode = getNode(source)
  const tNode = getNode(target)
  if (!sNode || !tNode) return null

  const sw = sNode.measured?.width ?? 150
  const sh = sNode.measured?.height ?? 40
  const tw = tNode.measured?.width ?? 150
  const th = tNode.measured?.height ?? 40

  const scx = sNode.internals.positionAbsolute.x + sw / 2
  const scy = sNode.internals.positionAbsolute.y + sh / 2
  const tcx = tNode.internals.positionAbsolute.x + tw / 2
  const tcy = tNode.internals.positionAbsolute.y + th / 2

  const dx = tcx - scx
  const dy = tcy - scy
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return null

  // ノード境界との交点を計算（ソース側）
  const ts = Math.min(
    Math.abs(dx) > 0.1 ? (sw / 2) / Math.abs(dx) : Infinity,
    Math.abs(dy) > 0.1 ? (sh / 2) / Math.abs(dy) : Infinity,
  )
  const sourceX = scx + dx * ts
  const sourceY = scy + dy * ts

  // ノード境界との交点を計算（ターゲット側）
  const tt = Math.min(
    Math.abs(dx) > 0.1 ? (tw / 2) / Math.abs(dx) : Infinity,
    Math.abs(dy) > 0.1 ? (th / 2) / Math.abs(dy) : Infinity,
  )
  const targetX = tcx - dx * tt
  const targetY = tcy - dy * tt

  // ベジェ曲線のハンドル方向を支配軸で決定
  const horizontal = Math.abs(dx) >= Math.abs(dy)
  const sourcePosition = horizontal
    ? (dx >= 0 ? Position.Right : Position.Left)
    : (dy >= 0 ? Position.Bottom : Position.Top)
  const targetPosition = horizontal
    ? (dx >= 0 ? Position.Left : Position.Right)
    : (dy >= 0 ? Position.Top : Position.Bottom)

  return { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition }
}

export function FloatingEdge({ id, source, target, markerEnd, style, selected }: EdgeProps) {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)

  // useInternalNode の返り値を直接渡せないため、計算をインラインで行う
  if (!sourceNode || !targetNode) return null

  const args = calcBezierArgs(source, target, (nodeId) => {
    if (nodeId === source) return sourceNode
    if (nodeId === target) return targetNode
    return undefined
  })
  if (!args) return null

  const [edgePath] = getBezierPath(args)

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        strokeWidth: selected ? 2 : 1.5,
        stroke: selected ? '#6366f1' : '#94a3b8',
        ...style,
      }}
    />
  )
}
