/**
 * マップ横断（ワークスペース）の全文検索（Phase 52）。
 *
 * 「最近開いたマップ＋現在のマップ」を対象にタイトル・ノードの title/body を検索する。
 * 現在のマップは呼び出し側（SearchBar）が既にライブの state を持っているため、
 * ここでは entries（= 現在のマップを除いた最近開いたマップ一覧）だけを対象にする。
 *
 * 取得した MapFile はセッション内メモリにキャッシュし、検索のたびに（Drive を含む）
 * FileAdapter への再取得を行わない。「検索時点で最新とは限らない」トレードオフを許容する
 * （起票時点の判断。過剰設計を避けるため無効化・TTLの仕組みは持たない）。
 */
import { getPlatform, type FileRef, type RecentFileEntry } from '@ideamap/platform'
import type { MapFile } from '../types'
import { migrateMapFile, readNodeTitle } from '../utils/mapFileCompat'

export interface CrossMapSearchResult {
  ref: FileRef
  mapTitle: string
  /** タイトル自体がヒットしたか（ノードのヒットがなくてもマップを一覧に出すため） */
  titleMatched: boolean
  matchedNodes: { id: string; title: string }[]
}

const contentCache = new Map<string, MapFile>()

async function getMapFile(ref: FileRef): Promise<MapFile | null> {
  const cached = contentCache.get(ref.id)
  if (cached) return cached
  try {
    const opened = await getPlatform().file.openFile(ref)
    if (!opened) return null
    const { file } = migrateMapFile(opened.content as MapFile)
    contentCache.set(ref.id, file)
    return file
  } catch {
    // 削除済み・アクセス不可などの1マップの取得失敗は、他マップの検索結果に影響させない
    return null
  }
}

function includesQuery(text: string | undefined, query: string): boolean {
  return (text ?? '').toLowerCase().includes(query)
}

export async function searchAcrossMaps(
  query: string,
  entries: RecentFileEntry[]
): Promise<CrossMapSearchResult[]> {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const results = await Promise.all(
    entries.map(async (entry): Promise<CrossMapSearchResult | null> => {
      const file = await getMapFile(entry.ref)
      if (!file) return null

      const titleMatched = includesQuery(file.title, q)
      const matchedNodes = file.nodes
        .filter((n) => includesQuery(readNodeTitle(n), q) || includesQuery(n.body, q))
        .map((n) => ({ id: n.id, title: readNodeTitle(n) }))

      if (!titleMatched && matchedNodes.length === 0) return null
      return { ref: entry.ref, mapTitle: file.title || entry.title, titleMatched, matchedNodes }
    })
  )

  return results.filter((r): r is CrossMapSearchResult => r !== null)
}
