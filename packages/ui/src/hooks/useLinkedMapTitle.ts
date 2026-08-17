import { useEffect, useState } from 'react'
import { getPlatform, type RecentFileEntry } from '@ideamap/platform'

/**
 * `listRecent()` の結果をセッション内メモリで共有するキャッシュ（Phase 52）。
 * キャンバス上の各 IdeaNode がリンクチップの表示名を個別に取得すると、
 * デスクトップ版では listRecent() 呼び出しごとにファイル存在チェック（fs アクセス）が
 * ノード数だけ発生してしまうため、1回の取得結果を全ノードで使い回す。
 */
let cachePromise: Promise<RecentFileEntry[]> | null = null

function loadRecentEntries(): Promise<RecentFileEntry[]> {
  if (!cachePromise) cachePromise = getPlatform().file.listRecent().catch(() => [])
  return cachePromise
}

/** リンク設定を変更した直後など、次回参照時に最新の一覧を取り直したいときに呼ぶ */
export function invalidateRecentEntriesCache(): void {
  cachePromise = null
}

/** linkedMapId からマップタイトルを解決する。見つからない・取得前は null */
export function useLinkedMapTitle(linkedMapId: string | undefined): string | null {
  const [title, setTitle] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // linkedMapId なしのときも .then() 側で null をセットする（setState を effect 本体に
    // 直接置くと react-hooks/set-state-in-effect に引っかかるため、常に非同期経路を通す）
    const entriesPromise = linkedMapId ? loadRecentEntries() : Promise.resolve<RecentFileEntry[]>([])
    void entriesPromise.then((entries) => {
      if (cancelled) return
      setTitle(linkedMapId ? entries.find((e) => e.ref.id === linkedMapId)?.title ?? null : null)
    })
    return () => {
      cancelled = true
    }
  }, [linkedMapId])

  return title
}
