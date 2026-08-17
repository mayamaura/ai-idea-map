/**
 * マップのバージョン履歴（Phase 50）。
 *
 * `errorLog.ts` と同じ「StorageAdapter 経由 + プロセス内メモリキャッシュ」パターンで、
 * 保存が成功するたびにスナップショットをリングバッファへ積む。エラーログと違い履歴は
 * マップごとに肥大化するため、単一キーではなく mapId ごとにストレージキーを分離する。
 * 記録の失敗はアプリ動作に影響させない（このモジュールは決して throw しない）。
 */
import { getPlatform } from '@ideamap/platform'
import type { MapFile, SerializedNode } from '../types'

export interface MapSnapshotEntry {
  /** ISO 8601 */
  time: string
  mapFile: MapFile
}

const STORAGE_KEY_PREFIX = 'ideamap-history-'
const MAX_ENTRIES = 20
// 1件あたりのサイズ上限（文字数で近似。JSON文字列はほぼ1文字=1バイトのdata URLが支配的なため十分な近似になる）。
// Phase49 の画像添付でスナップショットが肥大化しうるため、超過分は画像を省いて保存する
const MAX_ENTRY_SIZE = 2 * 1024 * 1024

// mapId ごとのプロセス内キャッシュ。読み込みは初回のみで、以後はメモリを正とし保存で上書きする
const cache = new Map<string, MapSnapshotEntry[]>()

function storageKey(mapId: string): string {
  return `${STORAGE_KEY_PREFIX}${mapId}`
}

async function loadEntries(mapId: string): Promise<MapSnapshotEntry[]> {
  const cached = cache.get(mapId)
  if (cached) return cached
  let entries: MapSnapshotEntry[]
  try {
    const raw = await getPlatform().storage.getItem(storageKey(mapId))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    entries = Array.isArray(parsed) ? (parsed as MapSnapshotEntry[]) : []
  } catch {
    entries = []
  }
  cache.set(mapId, entries)
  return entries
}

async function persist(mapId: string, entries: MapSnapshotEntry[]): Promise<void> {
  try {
    await getPlatform().storage.setItem(storageKey(mapId), JSON.stringify(entries))
  } catch {
    // 保存できなくてもメモリ上の履歴は維持される
  }
}

/**
 * 画像フィールドを省いたノード配列を作る。サイズ上限超過時のみ使う
 * （プレビュー・復元では画像が欠けるトレードオフを許容する）。
 * JSON.stringify は値が undefined のプロパティを出力しないため、保存後は image キー自体が消える
 */
function stripImages(nodes: SerializedNode[]): SerializedNode[] {
  return nodes.map((n) => (n.image ? { ...n, image: undefined } : n))
}

/**
 * スナップショットを記録する。保存失敗はアプリ動作に影響させないため throw しない。
 * 直前の記録と nodes/edges が同一（JSON文字列比較）なら無変更とみなし追記しない
 * （無変更の保存が続いてもリングバッファを浪費しないため）。
 */
export async function recordSnapshot(mapId: string, mapFile: MapFile): Promise<void> {
  try {
    const entries = await loadEntries(mapId)
    const last = entries[entries.length - 1]
    if (
      last &&
      JSON.stringify(last.mapFile.nodes) === JSON.stringify(mapFile.nodes) &&
      JSON.stringify(last.mapFile.edges) === JSON.stringify(mapFile.edges)
    ) {
      return
    }

    const stored =
      JSON.stringify(mapFile).length > MAX_ENTRY_SIZE
        ? { ...mapFile, nodes: stripImages(mapFile.nodes) }
        : mapFile

    entries.push({ time: new Date().toISOString(), mapFile: stored })
    if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES)
    await persist(mapId, entries)
  } catch {
    // 記録の失敗は握りつぶす
  }
}

/** mapId の履歴を古い順に返す */
export async function getSnapshots(mapId: string): Promise<readonly MapSnapshotEntry[]> {
  return loadEntries(mapId)
}

export async function clearSnapshots(mapId: string): Promise<void> {
  cache.set(mapId, [])
  try {
    await getPlatform().storage.removeItem(storageKey(mapId))
  } catch {
    // 消せなくても次回の保存で上書きされる
  }
}
