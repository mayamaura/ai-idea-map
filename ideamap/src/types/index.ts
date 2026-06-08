export interface Category {
  id: string
  name: string
  color: string
  icon: string
  description?: string
}

export interface IdeaNodeData extends Record<string, unknown> {
  title: string
  body?: string
  color: string
  createdBy: 'user' | 'ai'
  categoryId?: string
}

export interface IdeaEdgeData {
  label?: string
}

export interface MapFile {
  version: string
  /** マップの論理的同一性を表す UUID（作成時に1度だけ付与、ファイル名変更後も不変） */
  mapId: string
  title: string
  createdAt: string
  updatedAt: string
  nodes: SerializedNode[]
  edges: SerializedEdge[]
  /** 発表順（ノードIDの配列）。省略時は空リストとして扱う */
  presentationNodeIds?: string[]
}

export interface SerializedNode {
  id: string
  nodeType?: 'idea' | 'group'
  title: string
  body?: string
  x: number
  y: number
  color: string
  createdBy: 'user' | 'ai'
  categoryId?: string
  width?: number
  height?: number
  parentId?: string
}

export interface SerializedEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  label: string
  bidirectional?: boolean
}

export interface AISuggestion {
  title: string
  body?: string
  categoryId?: string
  /** 兄弟モード・複数親のとき AI が選んだ接続先の親ノード ID */
  parentNodeId?: string
}

export interface MapAnalysis {
  summary: string
  missingAreas: string[]
  importantNodeIds: string[]
  importantNodeTitles: string[]
}

export interface ConnectionSuggestion {
  sourceId: string
  targetId: string
  sourceTitle: string
  targetTitle: string
  reason: string
}

export interface ClusterSuggestion {
  groupName: string
  categoryId: string
  nodeIds: string[]
  nodeTitles: string[]
}

export type Theme = 'light' | 'dark'
export type AIModel = 'claude-sonnet-4-6' | 'claude-haiku-4-5-20251001'
export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error' | 'conflict'
export type NodeShape = 'rounded' | 'ellipse' | 'hexagon'

// Phase 14: AIチャット
export type ChatActionType = 'addNode' | 'connectNodes' | 'updateNode'

export interface ChatAction {
  type: ChatActionType
  label: string
  /** addNode: 接続先の親ID / connectNodes: sourceId / updateNode: 対象nodeId */
  sourceNodeId?: string
  /** connectNodes: targetId */
  targetNodeId?: string
  /** addNode: 推奨カテゴリID */
  categoryId?: string
  /** addNode: ノードの本文（body） */
  body?: string
  /** ボタン下の補足説明 */
  reason?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  actions?: ChatAction[]
}

export interface MapContext {
  mapTitle: string
  nodes: { id: string; title: string; body?: string; categoryId?: string }[]
  edges: { source: string; target: string; label?: string }[]
  categories: { id: string; name: string }[]
}

export interface ChatWithMapRequest {
  apiKey: string
  model: AIModel
  messages: ChatMessage[]
  mapContext: MapContext
  mentionedNodeIds?: string[]
}
