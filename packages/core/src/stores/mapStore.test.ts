import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from './mapStore'
import { makeEdge } from './map/constants'
import type { IdeaNode } from './map/types'
import type { SerializedEdge, SerializedNode } from '../types'

// reset() は初期状態（root ノード1個・履歴なし）に戻す唯一の公開アクションなので、
// これを beforeEach で使ってストア（モジュールシングルトン）をテスト間で独立させる
beforeEach(() => {
  useMapStore.getState().reset()
  useMapStore.getState().clearPendingFitView()
})

describe('nodeSlice', () => {
  it('addNode: ノードを追加し履歴に積む', () => {
    const pastLen = useMapStore.getState().past.length
    const id = useMapStore.getState().addNode('新しいノード', 100, 200)

    const state = useMapStore.getState()
    const node = state.nodes.find((n) => n.id === id)
    expect(node?.data.title).toBe('新しいノード')
    expect(node?.position).toEqual({ x: 100, y: 200 })
    expect(state.past.length).toBe(pastLen + 1)
    expect(state.future).toEqual([])
  })

  it('updateNodeTitle: ラベルを更新し履歴に積む', () => {
    const id = useMapStore.getState().addNode('旧タイトル', 0, 0)
    const pastLen = useMapStore.getState().past.length

    useMapStore.getState().updateNodeTitle(id, '新タイトル')

    const state = useMapStore.getState()
    expect(state.nodes.find((n) => n.id === id)?.data.title).toBe('新タイトル')
    expect(state.past.length).toBe(pastLen + 1)
  })

  it('deleteNode: ノードと接続エッジを削除し履歴に積む', () => {
    const idA = useMapStore.getState().addNode('A', 0, 0)
    const idB = useMapStore.getState().addConnectedNode(idA)
    expect(idB).not.toBeNull()
    const pastLen = useMapStore.getState().past.length

    useMapStore.getState().deleteNode(idA)

    const state = useMapStore.getState()
    expect(state.nodes.find((n) => n.id === idA)).toBeUndefined()
    // 子ノード自体は残り、A に繋がっていたエッジだけ消える
    expect(state.nodes.find((n) => n.id === idB)).toBeDefined()
    expect(state.edges.some((e) => e.source === idA || e.target === idA)).toBe(false)
    expect(state.past.length).toBe(pastLen + 1)
  })

  it('mergeNodes: 本文を連結し、エッジを張り替え、重複エッジを除外し、Undo で戻る', () => {
    const idA = useMapStore.getState().addNode('A', 0, 0, 'user', '#fff', undefined, 'Aの本文')
    const idB = useMapStore.getState().addNode('B', 200, 0, 'user', '#fff', undefined, 'Bの本文')
    const idC = useMapStore.getState().addNode('C', 400, 0)
    // B→C と A→C を用意し、B→C が A に張り替わると A→C と重複するようにする
    useMapStore.getState().onConnect({ source: idB, target: idC, sourceHandle: null, targetHandle: null })
    useMapStore.getState().onConnect({ source: idA, target: idC, sourceHandle: null, targetHandle: null })
    const beforeNodes = useMapStore.getState().nodes
    const beforeEdges = useMapStore.getState().edges
    const pastLen = useMapStore.getState().past.length

    useMapStore.getState().mergeNodes(idA, idB)

    const state = useMapStore.getState()
    expect(state.nodes.find((n) => n.id === idB)).toBeUndefined()
    expect(state.nodes.find((n) => n.id === idA)?.data.body).toBe('Aの本文\n\nBの本文')
    expect(state.edges.filter((e) => e.source === idA && e.target === idC)).toHaveLength(1)
    expect(state.edges.some((e) => e.source === idB || e.target === idB)).toBe(false)
    expect(state.past.length).toBe(pastLen + 1)

    useMapStore.getState().undo()
    const afterUndo = useMapStore.getState()
    expect(afterUndo.nodes).toEqual(beforeNodes)
    expect(afterUndo.edges).toEqual(beforeEdges)
    expect(afterUndo.past.length).toBe(pastLen)
  })

  it('undo/redo: 複数操作の往復で状態が戻る', () => {
    const initialNodes = useMapStore.getState().nodes
    const initialEdges = useMapStore.getState().edges

    const idA = useMapStore.getState().addNode('A', 0, 0)
    useMapStore.getState().updateNodeTitle(idA, 'A-renamed')
    useMapStore.getState().deleteNode(idA)
    expect(useMapStore.getState().nodes.find((n) => n.id === idA)).toBeUndefined()

    useMapStore.getState().undo() // 削除を取り消す
    useMapStore.getState().undo() // 改名を取り消す
    useMapStore.getState().undo() // 追加を取り消す

    const afterUndo = useMapStore.getState()
    expect(afterUndo.nodes).toEqual(initialNodes)
    expect(afterUndo.edges).toEqual(initialEdges)
    expect(afterUndo.past).toEqual([])

    useMapStore.getState().redo()
    useMapStore.getState().redo()
    useMapStore.getState().redo()

    const afterRedo = useMapStore.getState()
    expect(afterRedo.nodes.find((n) => n.id === idA)).toBeUndefined()
    expect(afterRedo.future).toEqual([])
  })

  it('onNodesChange: dragging中は履歴に積まない、確定時に1回だけ積む', () => {
    const id = useMapStore.getState().addNode('Draggable', 0, 0)
    const pastLen = useMapStore.getState().past.length

    useMapStore.getState().onNodesChange([
      { id, type: 'position', position: { x: 10, y: 10 }, dragging: true },
    ])
    expect(useMapStore.getState().nodes.find((n) => n.id === id)?.position).toEqual({ x: 10, y: 10 })
    expect(useMapStore.getState().past.length).toBe(pastLen)

    useMapStore.getState().onNodesChange([
      { id, type: 'position', position: { x: 50, y: 50 }, dragging: true },
    ])
    expect(useMapStore.getState().nodes.find((n) => n.id === id)?.position).toEqual({ x: 50, y: 50 })
    expect(useMapStore.getState().past.length).toBe(pastLen)

    useMapStore.getState().onNodesChange([
      { id, type: 'position', position: { x: 80, y: 80 }, dragging: false },
    ])
    const state = useMapStore.getState()
    expect(state.nodes.find((n) => n.id === id)?.position).toEqual({ x: 80, y: 80 })
    expect(state.past.length).toBe(pastLen + 1)

    // Undo はドラッグ開始前の位置(0,0)まで戻る。中間フレームは非履歴更新で state.nodes を
    // 直接動かすため、確定時のスナップショットではなく「最初の dragging:true で控えた
    // スナップショット」が past に積まれることを検証する
    useMapStore.getState().undo()
    expect(useMapStore.getState().nodes.find((n) => n.id === id)?.position).toEqual({ x: 0, y: 0 })
  })

  it('addNodesWithEdges: 複数ノード・エッジを1回の set でまとめて追加し、past は1回だけ積む。Undo 1回で全て消える', () => {
    const idA = useMapStore.getState().addNode('A', 0, 0)
    const beforeNodes = useMapStore.getState().nodes
    const beforeEdges = useMapStore.getState().edges
    const pastLen = useMapStore.getState().past.length

    const newNodes: IdeaNode[] = [
      { id: 'opinion-1', type: 'ideaNode', position: { x: 100, y: 100 }, data: { title: '意見1', color: '#fff', createdBy: 'ai' } },
      { id: 'opinion-2', type: 'ideaNode', position: { x: 200, y: 100 }, data: { title: '意見2', color: '#fff', createdBy: 'ai' } },
    ]
    const newEdges = newNodes.map((n) => makeEdge({ source: idA, target: n.id }))

    useMapStore.getState().addNodesWithEdges(newNodes, newEdges)

    const state = useMapStore.getState()
    expect(state.nodes.length).toBe(beforeNodes.length + 2)
    expect(state.edges.length).toBe(beforeEdges.length + 2)
    expect(state.nodes.find((n) => n.id === 'opinion-1')?.data.title).toBe('意見1')
    expect(state.past.length).toBe(pastLen + 1)
    expect(state.future).toEqual([])

    useMapStore.getState().undo()
    const afterUndo = useMapStore.getState()
    expect(afterUndo.nodes).toEqual(beforeNodes)
    expect(afterUndo.edges).toEqual(beforeEdges)
    expect(afterUndo.past.length).toBe(pastLen)
  })

  describe('updatedAt の刻印（Phase 49）', () => {
    it('updateNodeTitle/Body/Color/Category/Url/Image は対象ノードの updatedAt を更新する', () => {
      const id = useMapStore.getState().addNode('タイトル', 0, 0)
      expect(useMapStore.getState().nodes.find((n) => n.id === id)?.data.updatedAt).toBeUndefined()

      const actions: Array<() => void> = [
        () => useMapStore.getState().updateNodeTitle(id, '更新後タイトル'),
        () => useMapStore.getState().updateNodeBody(id, '更新後本文'),
        () => useMapStore.getState().updateNodeColor(id, '#123456'),
        () => useMapStore.getState().updateNodeCategory(id, 'cat-1', '#abcdef'),
        () => useMapStore.getState().updateNodeUrl(id, 'https://example.com'),
        () => useMapStore.getState().updateNodeImage(id, 'data:image/jpeg;base64,xxx'),
      ]
      for (const action of actions) {
        action()
        expect(useMapStore.getState().nodes.find((n) => n.id === id)?.data.updatedAt).toBeDefined()
      }
    })

    it('mergeNodes は keep 側ノードの updatedAt を更新する', () => {
      const idA = useMapStore.getState().addNode('A', 0, 0)
      const idB = useMapStore.getState().addNode('B', 200, 0)

      useMapStore.getState().mergeNodes(idA, idB)

      expect(useMapStore.getState().nodes.find((n) => n.id === idA)?.data.updatedAt).toBeDefined()
    })

    it('applyClusterCategory は対象ノードの updatedAt を更新する', () => {
      const idA = useMapStore.getState().addNode('A', 0, 0)

      useMapStore.getState().applyClusterCategory([idA], 'cat-1', '#abcdef')

      expect(useMapStore.getState().nodes.find((n) => n.id === idA)?.data.updatedAt).toBeDefined()
    })
  })
})

describe('edgeSlice', () => {
  it('onConnect: エッジを追加し履歴に積む', () => {
    const idA = useMapStore.getState().addNode('A', 0, 0)
    const idB = useMapStore.getState().addNode('B', 200, 0)
    const pastLen = useMapStore.getState().past.length

    useMapStore.getState().onConnect({ source: idA, target: idB, sourceHandle: null, targetHandle: null })

    const state = useMapStore.getState()
    expect(state.edges.some((e) => e.source === idA && e.target === idB)).toBe(true)
    expect(state.past.length).toBe(pastLen + 1)
  })

  it('deleteEdge: エッジを削除し履歴に積む', () => {
    const idA = useMapStore.getState().addNode('A', 0, 0)
    const idB = useMapStore.getState().addNode('B', 200, 0)
    useMapStore.getState().onConnect({ source: idA, target: idB, sourceHandle: null, targetHandle: null })
    const edgeId = useMapStore.getState().edges[0]!.id
    const pastLen = useMapStore.getState().past.length

    useMapStore.getState().deleteEdge(edgeId)

    const state = useMapStore.getState()
    expect(state.edges.find((e) => e.id === edgeId)).toBeUndefined()
    expect(state.past.length).toBe(pastLen + 1)
  })

  it('onEdgesChange: remove で履歴に積む、select では積まない', () => {
    const idA = useMapStore.getState().addNode('A', 0, 0)
    const idB = useMapStore.getState().addNode('B', 200, 0)
    useMapStore.getState().onConnect({ source: idA, target: idB, sourceHandle: null, targetHandle: null })
    const edgeId = useMapStore.getState().edges[0]!.id
    const pastLen = useMapStore.getState().past.length

    useMapStore.getState().onEdgesChange([{ id: edgeId, type: 'select', selected: true }])
    expect(useMapStore.getState().past.length).toBe(pastLen)

    useMapStore.getState().onEdgesChange([{ id: edgeId, type: 'remove' }])
    const state = useMapStore.getState()
    expect(state.edges.find((e) => e.id === edgeId)).toBeUndefined()
    expect(state.past.length).toBe(pastLen + 1)
  })

  it('connectNodes: 自己接続は無視する', () => {
    const idA = useMapStore.getState().addNode('A', 0, 0)
    const before = useMapStore.getState()

    useMapStore.getState().connectNodes(idA, idA)

    expect(useMapStore.getState()).toEqual(before)
  })

  it('connectDroppedNode: 自己ドロップは何もしない', () => {
    const idA = useMapStore.getState().addNode('A', 0, 0)
    const before = useMapStore.getState()

    useMapStore.getState().connectDroppedNode(idA, idA, { x: 0, y: 0 })

    expect(useMapStore.getState()).toEqual(before)
  })

  it('connectDroppedNode: 既に接続済みなら何もしない', () => {
    const idA = useMapStore.getState().addNode('A', 0, 0)
    const idB = useMapStore.getState().addNode('B', 200, 0)
    useMapStore.getState().connectNodes(idA, idB)
    const before = useMapStore.getState()

    // droppedId/parentId が既存エッジと逆向きでも「既に接続済み」と判定される
    useMapStore.getState().connectDroppedNode(idB, idA, { x: 999, y: 999 })

    expect(useMapStore.getState()).toEqual(before)
  })

  it('connectDroppedNode: エッジ作成と位置戻しが1回の履歴になる', () => {
    const idA = useMapStore.getState().addNode('Parent', 0, 0)
    const idB = useMapStore.getState().addNode('Child', 300, 0)
    const originalPos = { x: 300, y: 0 }
    const pastLen = useMapStore.getState().past.length

    // ドラッグ確定（重ねた位置へ移動）: onNodesChange(dragging:false) がここで1回だけ履歴を積む
    useMapStore.getState().onNodesChange([
      { id: idB, type: 'position', position: { x: 0, y: 0 }, dragging: false },
    ])
    expect(useMapStore.getState().past.length).toBe(pastLen + 1)

    // ドロップ接続: エッジ作成 + 開始位置へ戻す。history.ts のコメント通り新規の past は積まない
    useMapStore.getState().connectDroppedNode(idB, idA, originalPos)

    const afterDrop = useMapStore.getState()
    expect(afterDrop.edges.some((e) => e.source === idA && e.target === idB)).toBe(true)
    expect(afterDrop.nodes.find((n) => n.id === idB)?.position).toEqual(originalPos)
    // ドラッグ + ドロップ接続の一連の操作全体で past は1件しか増えていない
    expect(afterDrop.past.length).toBe(pastLen + 1)

    // 1回の undo でエッジ・位置の両方が操作前の状態に戻る
    useMapStore.getState().undo()
    const afterUndo = useMapStore.getState()
    expect(afterUndo.edges).toHaveLength(0)
    expect(afterUndo.nodes.find((n) => n.id === idB)?.position).toEqual(originalPos)
    expect(afterUndo.past.length).toBe(pastLen)
  })
})

describe('groupSlice', () => {
  it('groupSelectedNodes: 選択ノードをグループ化する', () => {
    const idA = useMapStore.getState().addNode('A', 0, 0)
    const idB = useMapStore.getState().addNode('B', 200, 0)
    useMapStore.getState().onNodesChange([
      { id: idA, type: 'select', selected: true },
      { id: idB, type: 'select', selected: true },
    ])
    const pastLen = useMapStore.getState().past.length

    useMapStore.getState().groupSelectedNodes()

    const state = useMapStore.getState()
    const group = state.nodes.find((n) => n.type === 'groupNode')
    expect(group).toBeDefined()
    expect(group!.position).toEqual({ x: -40, y: -40 })
    expect(group!.style).toEqual({ width: 440, height: 140 })
    expect(state.nodes.find((n) => n.id === idA)?.parentId).toBe(group!.id)
    expect(state.nodes.find((n) => n.id === idB)?.parentId).toBe(group!.id)
    expect(state.past.length).toBe(pastLen + 1)
  })

  it('ungroupNodes: グループを解除し子ノードを元の絶対座標に戻す', () => {
    const idA = useMapStore.getState().addNode('A', 0, 0)
    const idB = useMapStore.getState().addNode('B', 200, 0)
    useMapStore.getState().onNodesChange([
      { id: idA, type: 'select', selected: true },
      { id: idB, type: 'select', selected: true },
    ])
    useMapStore.getState().groupSelectedNodes()
    const groupId = useMapStore.getState().nodes.find((n) => n.type === 'groupNode')!.id
    const pastLen = useMapStore.getState().past.length

    useMapStore.getState().ungroupNodes(groupId)

    const state = useMapStore.getState()
    expect(state.nodes.find((n) => n.id === groupId)).toBeUndefined()
    expect(state.nodes.find((n) => n.id === idA)?.parentId).toBeUndefined()
    expect(state.nodes.find((n) => n.id === idA)?.position).toEqual({ x: 0, y: 0 })
    expect(state.nodes.find((n) => n.id === idB)?.position).toEqual({ x: 200, y: 0 })
    expect(state.past.length).toBe(pastLen + 1)
  })
})

describe('documentSlice', () => {
  it('loadFromSerialized: シリアライズされたノード・エッジを復元する', () => {
    const nodes: SerializedNode[] = [
      { id: 'n1', nodeType: 'idea', title: 'ノード1', x: 0, y: 0, color: '#fff', createdBy: 'user' },
      { id: 'n2', nodeType: 'idea', title: 'ノード2', x: 100, y: 0, color: '#fff', createdBy: 'user' },
    ]
    const edges: SerializedEdge[] = [
      { id: 'e1', source: 'n1', target: 'n2', label: '', bidirectional: false },
    ]

    useMapStore.getState().loadFromSerialized(nodes, edges)

    const state = useMapStore.getState()
    expect(state.nodes.map((n) => n.id)).toEqual(['n1', 'n2'])
    expect(state.nodes[0]!.data.title).toBe('ノード1')
    expect(state.edges).toHaveLength(1)
    expect(state.edges[0]!.source).toBe('n1')
    expect(state.past).toEqual([])
    expect(state.future).toEqual([])
    expect(state.pendingFitView).toBe(true)
  })

  it('loadFromSerialized/getSerializedNodes: updatedAt/url/image を往復で保持する（Phase 49）', () => {
    const nodes: SerializedNode[] = [
      {
        id: 'n1',
        nodeType: 'idea',
        title: 'ノード1',
        x: 0,
        y: 0,
        color: '#fff',
        createdBy: 'user',
        updatedAt: '2026-01-01T00:00:00.000Z',
        url: 'https://example.com',
        image: 'data:image/jpeg;base64,xxx',
      },
      // 旧ファイル由来（updatedAt/url/image を持たない）ノードは undefined のまま保持する
      { id: 'n2', nodeType: 'idea', title: 'ノード2', x: 100, y: 0, color: '#fff', createdBy: 'user' },
    ]

    useMapStore.getState().loadFromSerialized(nodes, [])
    const serialized = useMapStore.getState().getSerializedNodes()

    const n1 = serialized.find((n) => n.id === 'n1')
    expect(n1?.updatedAt).toBe('2026-01-01T00:00:00.000Z')
    expect(n1?.url).toBe('https://example.com')
    expect(n1?.image).toBe('data:image/jpeg;base64,xxx')

    const n2 = serialized.find((n) => n.id === 'n2')
    expect(n2?.updatedAt).toBeUndefined()
    expect(n2?.url).toBeUndefined()
    expect(n2?.image).toBeUndefined()
  })

  it('reset: 初期状態（root ノード1個）に戻す', () => {
    useMapStore.getState().addNode('temp', 0, 0)

    useMapStore.getState().reset()

    const state = useMapStore.getState()
    expect(state.nodes).toHaveLength(1)
    expect(state.nodes[0]!.id).toBe('root')
    expect(state.edges).toEqual([])
    expect(state.past).toEqual([])
    expect(state.future).toEqual([])
    expect(state.clipboard).toEqual({ nodes: [], edges: [] })
  })
})
