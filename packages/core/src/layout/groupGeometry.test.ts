import { describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'
import type { IdeaNodeData } from '../types'
import {
  DEFAULT_NODE_SIZE,
  DEFAULT_GROUP_SIZE,
  getGroupSize,
  computePushOut,
  findOverlappingGroup,
  isOutsideParent,
  clampInsideParent,
  syncGroupMeasured,
  expandGroupIds,
} from './groupGeometry'

type FlowNode = Node<IdeaNodeData>

function freeNode(
  id: string,
  x: number,
  y: number,
  measured?: { width?: number; height?: number },
  parentId?: string
): FlowNode {
  return {
    id,
    type: 'ideaNode',
    position: { x, y },
    parentId,
    measured,
    data: { title: id, color: '#fff', createdBy: 'user' },
  }
}

function groupNode(
  id: string,
  x: number,
  y: number,
  style?: { width?: number | string; height?: number | string }
): FlowNode {
  return {
    id,
    type: 'groupNode',
    position: { x, y },
    style,
    data: { title: id, color: '#fff', createdBy: 'user' },
  }
}

describe('getGroupSize', () => {
  it('style.width/height が number ならそのまま使う', () => {
    const g = groupNode('g1', 0, 0, { width: 200, height: 150 })
    expect(getGroupSize(g)).toEqual({ width: 200, height: 150 })
  })

  it('style.width/height が number でない（未設定・文字列）ときは DEFAULT_GROUP_SIZE を使う', () => {
    expect(getGroupSize(groupNode('g1', 0, 0))).toEqual(DEFAULT_GROUP_SIZE)
    // width/height はそれぞれ独立に number かどうかを判定する（片方だけ文字列でも他方は活かされる）
    expect(getGroupSize(groupNode('g2', 0, 0, { width: '100%', height: 150 }))).toEqual({
      width: DEFAULT_GROUP_SIZE.width,
      height: 150,
    })
  })
})

describe('computePushOut', () => {
  it('グループがなければ位置は変わらない', () => {
    const pos = computePushOut({ x: 10, y: 10 }, undefined, [])
    expect(pos).toEqual({ x: 10, y: 10 })
  })

  it('グループと重ならない位置なら変わらない', () => {
    const g = groupNode('g1', 0, 0, { width: 200, height: 150 })
    const pos = computePushOut({ x: 1000, y: 1000 }, undefined, [g])
    expect(pos).toEqual({ x: 1000, y: 1000 })
  })

  it('重なっているとき最小移動距離の方向（下）へ押し出す', () => {
    const g = groupNode('g1', 0, 0, { width: 200, height: 150 })
    // fallback は DEFAULT_NODE_SIZE(160x60): dLeft=210, dRight=150, dUp=110, dDown=100 → 最小は dDown
    expect(DEFAULT_NODE_SIZE).toEqual({ width: 160, height: 60 })
    const pos = computePushOut({ x: 50, y: 50 }, undefined, [g])
    expect(pos).toEqual({ x: 50, y: 150 })
  })

  it('measured サイズを優先し、なければ fallbackSize を使う', () => {
    const g = groupNode('g1', 0, 0, { width: 200, height: 150 })
    // measured{40,20}: dLeft=140, dRight=100, dUp=25, dDown=145 → 最小は dUp
    const withMeasured = computePushOut({ x: 100, y: 5 }, { width: 40, height: 20 }, [g])
    expect(withMeasured).toEqual({ x: 100, y: -20 })

    const withFallback = computePushOut({ x: 100, y: 5 }, undefined, [g], { width: 40, height: 20 })
    expect(withFallback).toEqual({ x: 100, y: -20 })
  })

  it('複数グループと順に重なる場合はそれぞれ押し出す', () => {
    const g1 = groupNode('g1', 0, 0, { width: 200, height: 150 })
    const g2 = groupNode('g2', 40, 140, { width: 200, height: 150 })
    // g1 側の押し出しで (50,150) になった後、g2 (40,140)-(240,290) とまだ重なるので
    // 続けて押し出される（fallback は DEFAULT_NODE_SIZE 160x60）
    // g1: dLeft=210,dRight=150,dUp=110,dDown=100 → 最小 dDown → (50,150)
    // g2: dLeft=170,dRight=190,dUp=70,dDown=140 → 最小 dUp → (50,80)
    const pos = computePushOut({ x: 50, y: 50 }, undefined, [g1, g2])
    expect(pos).toEqual({ x: 50, y: 80 })
  })
})

describe('findOverlappingGroup', () => {
  const g1 = groupNode('g1', 0, 0, { width: 200, height: 150 })
  const g2 = groupNode('g2', 1000, 1000, { width: 200, height: 150 })

  it('重なるグループがなければ null', () => {
    expect(findOverlappingGroup({ x: 50, y: 50 }, undefined, [])).toBeNull()
    expect(findOverlappingGroup({ x: 500, y: 500 }, undefined, [g1, g2])).toBeNull()
  })

  it('重なるグループを返す', () => {
    expect(findOverlappingGroup({ x: 50, y: 50 }, undefined, [g1, g2])).toBe(g1)
  })

  it('複数重なる場合は配列内で最初に見つかったものを返す', () => {
    const overlappingBoth = groupNode('g3', 0, 0, { width: 2000, height: 2000 })
    expect(findOverlappingGroup({ x: 50, y: 50 }, undefined, [overlappingBoth, g1])).toBe(
      overlappingBoth
    )
  })
})

describe('isOutsideParent', () => {
  const parent = groupNode('parent', 0, 0, { width: 300, height: 200 })

  it('中心が枠内なら false', () => {
    // measured 160x60 なら中心は (80,30)
    expect(isOutsideParent({ x: 0, y: 0 }, undefined, parent)).toBe(false)
  })

  it('中心が枠外（左・上）なら true', () => {
    expect(isOutsideParent({ x: -100, y: -100 }, undefined, parent)).toBe(true)
  })

  it('中心が枠外（右・下）なら true', () => {
    expect(isOutsideParent({ x: 1000, y: 1000 }, undefined, parent)).toBe(true)
  })

  it('中心がちょうど枠の境界なら false（境界は内側扱い）', () => {
    // measured 160x60 → center.x = gW(300) にするには pos.x = 220
    expect(isOutsideParent({ x: 220, y: 0 }, { width: 160, height: 60 }, parent)).toBe(false)
  })
})

describe('clampInsideParent', () => {
  const parent = groupNode('parent', 0, 0, { width: 300, height: 200 })

  it('枠内の位置は変わらない', () => {
    expect(clampInsideParent({ x: 50, y: 50 }, undefined, parent)).toEqual({ x: 50, y: 50 })
  })

  it('枠外の位置は [0, size-nodeSize] にクランプされる', () => {
    expect(clampInsideParent({ x: -50, y: -50 }, undefined, parent)).toEqual({ x: 0, y: 0 })
    // measured 160x60, 枠 300x200 → x最大 140, y最大 140
    expect(clampInsideParent({ x: 9999, y: 9999 }, undefined, parent)).toEqual({ x: 140, y: 140 })
  })
})

describe('syncGroupMeasured', () => {
  it('style.width/height が number の groupNode は measured に反映される', () => {
    const g = groupNode('g1', 0, 0, { width: 200, height: 150 })
    const [synced] = syncGroupMeasured([g])
    expect(synced.measured).toEqual({ width: 200, height: 150 })
  })

  it('style.width/height が number でない groupNode は変更されない', () => {
    const g = groupNode('g1', 0, 0, { width: '100%', height: 150 })
    const [synced] = syncGroupMeasured([g])
    expect(synced).toBe(g)
  })

  it('groupNode 以外は変更されない', () => {
    const n = freeNode('n1', 0, 0)
    const [synced] = syncGroupMeasured([n])
    expect(synced).toBe(n)
  })
})

describe('expandGroupIds', () => {
  it('グループを含まない場合はそのまま', () => {
    const nodes = [freeNode('a', 0, 0), freeNode('b', 0, 0)]
    const result = expandGroupIds(['a'], nodes)
    expect(result).toEqual(new Set(['a']))
  })

  it('グループIDが含まれる場合は子ノードのIDも加える', () => {
    const g = groupNode('g1', 0, 0, { width: 200, height: 150 })
    const child1 = freeNode('c1', 10, 10, undefined, 'g1')
    const child2 = freeNode('c2', 20, 20, undefined, 'g1')
    const other = freeNode('other', 0, 0)
    const nodes = [g, child1, child2, other]

    const result = expandGroupIds(['g1', 'other'], nodes)
    expect(result).toEqual(new Set(['g1', 'other', 'c1', 'c2']))
  })
})
