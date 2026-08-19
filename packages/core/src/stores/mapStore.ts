import { create } from 'zustand'
import { createHistorySlice } from './map/history'
import { createNodeSlice } from './map/nodeSlice'
import { createClipboardSlice } from './map/clipboardSlice'
import { createAlignmentSlice } from './map/alignmentSlice'
import { createEdgeSlice } from './map/edgeSlice'
import { createGroupSlice } from './map/groupSlice'
import { createDocumentSlice } from './map/documentSlice'
import type { MapState } from './map/types'

export type { IdeaNode, MapState } from './map/types'

/**
 * マップデータの単一ストア。
 * 実装は責務ごとに `map/` 配下のスライスへ分割してあるが、
 * スライスは同じ state を共有するため利用側からは1つのストアとして扱える。
 */
export const useMapStore = create<MapState>()((...a) => ({
  ...createHistorySlice(...a),
  ...createNodeSlice(...a),
  ...createClipboardSlice(...a),
  ...createAlignmentSlice(...a),
  ...createEdgeSlice(...a),
  ...createGroupSlice(...a),
  ...createDocumentSlice(...a),
}))
