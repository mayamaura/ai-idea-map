import type { StateCreator } from 'zustand'
import type {
  Node,
  Edge,
  Connection,
  NodeChange,
  EdgeChange,
} from '@xyflow/react'
import type { IdeaNodeData, SerializedNode, SerializedEdge } from '../../types'

export type IdeaNode = Node<IdeaNodeData>

export interface Snapshot {
  nodes: IdeaNode[]
  edges: Edge[]
}

export interface Clipboard {
  nodes: IdeaNode[]
  edges: Edge[]
}

/** Undo/Redo 履歴 */
export interface HistorySlice {
  past: Snapshot[]
  future: Snapshot[]
  undo: () => void
  redo: () => void
}

/** ノードの追加・編集・削除 */
export interface NodeSlice {
  nodes: IdeaNode[]
  onNodesChange: (changes: NodeChange<IdeaNode>[]) => void
  addNode: (title: string, x: number, y: number, createdBy?: 'user' | 'ai', color?: string, categoryId?: string, body?: string) => string
  addConnectedNode: (parentId: string, title?: string) => string | null
  /** 指定ノードの兄弟ノード（同じ親を持つ）を作成して新ノードのIDを返す。親がなければ独立ノードを作成 */
  addSiblingNode: (nodeId: string) => string | null
  updateNodeTitle: (id: string, title: string) => void
  updateNodeBody: (id: string, body: string) => void
  updateNodeColor: (id: string, color: string) => void
  updateNodeCategory: (id: string, categoryId: string, color: string) => void
  updateNodeUrl: (id: string, url: string) => void
  updateNodeImage: (id: string, image: string | undefined) => void
  /** 他マップへのリンクを設定・解除する（undefined で解除。Phase 52） */
  updateNodeLinkedMap: (id: string, link: { mapId: string; origin: 'cloud' | 'local' } | undefined) => void
  deleteNode: (id: string) => void
  deleteNodes: (ids: string[]) => void
  deleteSelected: () => void
  /** mergeId を keepId に統合する（AIガーデナー「統合」提案の適用）。本文を連結し、mergeId 宛のエッジを keepId へ張り替え、mergeId を削除する */
  mergeNodes: (keepId: string, mergeId: string) => void
  applyClusterCategory: (nodeIds: string[], categoryId: string, color: string) => void
  setNodes: (nodes: IdeaNode[]) => void
  /**
   * ノード配列とエッジ配列をまとめて1回の set で追加し、past に1回だけ積む（Phase 48）。
   * ループで addNode/onConnect を繰り返すと1操作ごとに履歴が積まれ Undo が1ノードずつになるため、
   * AIの複数意見の一括追加のような「1操作＝複数ノード＋エッジ」のケース向けに用意した汎用アクション
   */
  addNodesWithEdges: (nodes: IdeaNode[], edges: Edge[]) => void
  /** ノード配列をストアに反映するが、履歴には積まない（アニメーション途中フレーム用） */
  setNodesNoHistory: (nodes: IdeaNode[]) => void
  /** 最終フレームを確定し、整列前スナップショットを past に1回だけ積む */
  commitNodesWithHistory: (originalNodes: IdeaNode[], finalNodes: IdeaNode[]) => void
  /** ノード選択を指定IDのみにする（履歴に積まない）。矢印キー移動などで使用 */
  selectOnlyNode: (id: string) => void
}

/** エッジの作成・編集・削除 */
export interface EdgeSlice {
  edges: Edge[]
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  /** 接続モード方式のエッジ作成（Phase 26）。onConnect に委譲して履歴・マーカー・重複排除を再利用 */
  connectNodes: (source: string, target: string) => void
  deleteNodeEdges: (nodeId: string) => void
  deleteEdge: (id: string) => void
  reverseEdge: (id: string) => void
  toggleEdgeDirection: (id: string) => void
  updateEdgeLabel: (id: string, label: string) => void
  addSuggestedEdge: (sourceId: string, targetId: string) => void
  /** ドラッグ&ドロップ接続。重ねられた側（親）→ ドラッグした側（子）のエッジを作成し、
   *  同時にドラッグしたノードを開始位置へ戻す。
   *  履歴は直前の onNodesChange(dragging:false) が積んだエントリに相乗りし、Undo 1回で両方戻る */
  connectDroppedNode: (droppedId: string, parentId: string, returnPosition: { x: number; y: number }) => void
  hasConnectedEdges: (nodeId: string) => boolean
}

/** クリップボード（コピー・貼り付け） */
export interface ClipboardSlice {
  clipboard: Clipboard
  copyNodes: (ids: string[]) => void
  paste: (position?: { x: number; y: number }) => void
}

/** 選択ノードの整列・等間隔分配 */
export interface AlignmentSlice {
  alignSelectedNodes: (type: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom') => void
  distributeSelectedNodes: (direction: 'horizontal' | 'vertical') => void
}

/** グループノードと所属関係の操作 */
export interface GroupSlice {
  addGroupNode: (label: string, x: number, y: number, width?: number, height?: number) => string
  groupSelectedNodes: () => void
  ungroupNodes: (groupId: string) => void
  deleteGroupWithChildren: (groupId: string) => void
  addNodeToGroup: (nodeId: string, groupId: string) => void
  removeNodeFromGroup: (nodeId: string) => void
  pushNodeOutOfGroups: (nodeId: string) => void
  clampNodeInsideParent: (nodeId: string) => void
}

/** マップ全体のロード・シリアライズ・リセット */
export interface DocumentSlice {
  pendingFitView: boolean
  clearPendingFitView: () => void
  loadFromSerialized: (nodes: SerializedNode[], edges: SerializedEdge[]) => void
  getSerializedNodes: () => SerializedNode[]
  getSerializedEdges: () => SerializedEdge[]
  reset: () => void
}

export type MapState = HistorySlice &
  NodeSlice &
  ClipboardSlice &
  AlignmentSlice &
  EdgeSlice &
  GroupSlice &
  DocumentSlice

/** 各スライスは MapState 全体に対して set/get できる（スライスをまたぐ更新があるため） */
export type MapSliceCreator<T> = StateCreator<MapState, [], [], T>
