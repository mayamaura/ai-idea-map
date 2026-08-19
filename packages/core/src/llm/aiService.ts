/**
 * AI機能のエントリポイント（Phase 57 でモジュール分割）。
 *
 * 実装は `aiService/` 配下に機能別（shared/suggestions/mapAnalysis/gardener/debate/
 * textExtraction/chat/artifact）で分割してあるが、このファイルは元の1ファイル構成を前提に
 * 書かれた既存の import パス（`../llm/aiService` / `./aiService`）を変えないための re-export バレル。
 */
export { AIParseError, toFriendlyAIError } from './aiService/shared'
export type { WebSearchOptions } from './aiService/shared'

export { generateSuggestions } from './aiService/suggestions'

export { analyzeMap, suggestConnections, suggestClusters } from './aiService/mapAnalysis'

export { reviewMap } from './aiService/gardener'

export { debateNode } from './aiService/debate'

export { sanitizeExtractedNodes, extractMapFromText } from './aiService/textExtraction'
export type { ExtractedNode, ExtractMapRequest } from './aiService/textExtraction'

export { chatWithMap } from './aiService/chat'

export { generateArtifactFromMap } from './aiService/artifact'
export type { ArtifactFormat, GenerateArtifactRequest } from './aiService/artifact'
