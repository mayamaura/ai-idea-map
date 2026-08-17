import type { MapFile } from '../types'
import { CURRENT_MAP_FILE_VERSION } from '../utils/mapFileCompat'
import { useMapStore } from './mapStore'
import { useUIStore } from './uiStore'

/**
 * いま編集中の内容を保存用の `MapFile` に固める。
 *
 * 自動保存（useAutoSave）とデスクトップ版の「Drive に保存」が同じ形の
 * スナップショットを作る必要があるため、組み立てをここに集約している。
 *
 * @param mapId 保存先に載せる論理ID。新規保存時は呼び出し側が採番する
 */
export function buildMapFile(mapId: string): MapFile {
  const { getSerializedNodes, getSerializedEdges } = useMapStore.getState()
  const { mapTitle, presentationNodeIds } = useUIStore.getState()
  const now = new Date().toISOString()

  return {
    version: CURRENT_MAP_FILE_VERSION,
    mapId,
    title: mapTitle,
    createdAt: now,
    updatedAt: now,
    nodes: getSerializedNodes(),
    edges: getSerializedEdges(),
    presentationNodeIds: presentationNodeIds.length > 0 ? presentationNodeIds : undefined,
  }
}
