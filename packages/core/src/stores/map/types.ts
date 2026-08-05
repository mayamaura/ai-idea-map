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

/** ノードの追加・編集・削除・整列 */
export interface NodeSlice {
  nodes: IdeaNode[]
  clipboard: Clipboard
  onNodesChange: (changes: NodeChange<IdeaNode>[]) => void
  addNode: (title: string, x: number, y: number, createdBy?: 'user' | 'ai', color?: string, categoryId?: string, body?: string) => string
  addConnectedNode: (parentId: string, title?: string) => string | null
  /** 指定ノードの兄弟ノード（同じ親を持つ）を作成して新ノードのIDを返す。親がなければ独立ノードを作成 */
  addSiblingNode: (nodeId: string) => string | null
  updateNodeTitle: (id: string, title: string) => void
  updateNodeBody: (id: string, body: string) => void
  updateNodeColor: (id: string, color: string) => void
  updateNodeCategory: (id: string, categoryId: string, color: string) => void
  deleteNode: (id: string) => void
  deleteNodes: (ids: string[]) => void
  deleteSelected: () => void
  applyClusterCategory: (nodeIds: string[], categoryId: string, color: string) => void
  copyNodes: (ids: string[]) => void
  paste: (position?: { x: number; y: number }) => void
  alignSelectedNodes: (type: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom') => void
  distributeSelectedNodes: (direction: 'horizontal' | 'vertical') => void
  setNodes: (nodes: IdeaNode[]) => void
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
  hasConnectedEdges: (nodeId: string) => boolean
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

export type MapState = HistorySlice & NodeSlice & EdgeSlice & GroupSlice & DocumentSlice

/** 各スライスは MapState 全体に対して set/get できる（スライスをまたぐ更新があるため） */
export type MapSliceCreator<T> = StateCreator<MapState, [], [], T>
