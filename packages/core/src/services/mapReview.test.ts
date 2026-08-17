import { describe, expect, it } from 'vitest'
import { findNeglectedNodeIds } from './mapReview'

describe('findNeglectedNodeIds', () => {
  it('葉ノードかつ本文が空なら放置ノードとして検出する', () => {
    const nodes = [{ id: 'n1', createdBy: 'user' as const }]
    expect(findNeglectedNodeIds(nodes, [])).toEqual(['n1'])
  })

  it('葉ノードで createdBy が ai のままなら本文があっても放置ノードとして検出する', () => {
    const nodes = [{ id: 'n1', body: '本文あり', createdBy: 'ai' as const }]
    expect(findNeglectedNodeIds(nodes, [])).toEqual(['n1'])
  })

  it('子ノードを持つノードは、本文が空でも放置ノードとして検出しない', () => {
    // n1 は本文が空（単独なら検出される条件）だが子ノード n2 を持つため対象外になる
    const nodes = [
      { id: 'n1', createdBy: 'user' as const },
      { id: 'n2', body: '本文あり', createdBy: 'user' as const },
    ]
    const edges = [{ source: 'n1', target: 'n2' }]
    expect(findNeglectedNodeIds(nodes, edges)).toEqual([])
  })

  it('本文があり user 作成なら放置ノードとして検出しない', () => {
    const nodes = [{ id: 'n1', body: '本文あり', createdBy: 'user' as const }]
    expect(findNeglectedNodeIds(nodes, [])).toEqual([])
  })

  it('空白のみの本文は「空」として扱う', () => {
    const nodes = [{ id: 'n1', body: '   ', createdBy: 'user' as const }]
    expect(findNeglectedNodeIds(nodes, [])).toEqual(['n1'])
  })
})
