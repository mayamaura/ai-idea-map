import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from './mapStore'
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
