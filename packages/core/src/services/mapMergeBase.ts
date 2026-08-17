/**
 * 3方向マージ（Phase 53）用の base スナップショット保持。
 *
 * `errorLog.ts`/`mapHistory.ts` と同じ「StorageAdapter 経由 + プロセス内メモリキャッシュ」
 * パターンだが、履歴ではなく mapId ごとに直近1件（前回読み込み/保存時点の内容）だけを
 * 上書き保持する。保存の失敗はアプリ動作に影響させない（このモジュールは決して throw しない）。
 */
import { getPlatform } from '@ideamap/platform'
import type { MapFile } from '../types'

const STORAGE_KEY_PREFIX = 'ideamap-merge-base-'

// mapId ごとのプロセス内キャッシュ。読み込みは初回のみで、以後はメモリを正とし保存で上書きする
const cache = new Map<string, MapFile | null>()

function storageKey(mapId: string): string {
  return `${STORAGE_KEY_PREFIX}${mapId}`
}

/** base スナップショットを保存する。読み込み成功時・保存成功時に呼ぶ */
export async function saveMergeBase(mapId: string, file: MapFile): Promise<void> {
  cache.set(mapId, file)
  try {
    await getPlatform().storage.setItem(storageKey(mapId), JSON.stringify(file))
  } catch {
    // 保存できなくてもメモリ上のキャッシュは維持される
  }
}

/** mapId の base スナップショットを返す。未保存なら null */
export async function getMergeBase(mapId: string): Promise<MapFile | null> {
  if (cache.has(mapId)) return cache.get(mapId) ?? null
  try {
    const raw = await getPlatform().storage.getItem(storageKey(mapId))
    const result = raw ? (JSON.parse(raw) as MapFile) : null
    cache.set(mapId, result)
    return result
  } catch {
    cache.set(mapId, null)
    return null
  }
}
