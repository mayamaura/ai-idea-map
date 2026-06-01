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
  title: string
  createdAt: string
  updatedAt: string
  nodes: SerializedNode[]
  edges: SerializedEdge[]
}

export interface SerializedNode {
  id: string
  title: string
  body?: string
  x: number
  y: number
  color: string
  createdBy: 'user' | 'ai'
  categoryId?: string
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
  text: string
  type: '関連' | '深掘り' | '対比' | '応用'
  categoryId?: string
}

export type SuggestionType = '関連' | '深掘り' | '対比' | '応用'

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
export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'
export type NodeShape = 'rounded' | 'ellipse' | 'hexagon'
