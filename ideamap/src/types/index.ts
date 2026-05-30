export interface IdeaNodeData extends Record<string, unknown> {
  text: string
  color: string
  createdBy: 'user' | 'ai'
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
  text: string
  x: number
  y: number
  color: string
  createdBy: 'user' | 'ai'
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
}

export type Theme = 'light' | 'dark'
export type AIModel = 'claude-sonnet-4-6' | 'claude-haiku-4-5-20251001'
export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'
export type NodeShape = 'rounded' | 'ellipse' | 'hexagon'
