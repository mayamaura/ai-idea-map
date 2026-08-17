/**
 * タイムラプス再生のエンジン（Phase 50）。
 *
 * 再生開始ボタンは HistoryPanel、停止ボタンは IdeaCanvas のオーバーレイと
 * コンポーネントをまたぐため、React state ではなくモジュール内シングルトンで
 * タイマーと再生前スナップショットを保持する（errorLog.ts のキャッシュと同じ発想）。
 */
import { useMapStore, useUIStore, type MapSnapshotEntry, type SerializedNode, type SerializedEdge } from '@ideamap/core'

const INTERVAL_MS = 800

let timerId: ReturnType<typeof setTimeout> | null = null
let restoreState: { nodes: SerializedNode[]; edges: SerializedEdge[]; title: string } | null = null

function finish(): void {
  if (timerId) {
    clearTimeout(timerId)
    timerId = null
  }
  if (restoreState) {
    useMapStore.getState().loadFromSerialized(restoreState.nodes, restoreState.edges)
    useUIStore.getState().setMapTitle(restoreState.title)
    restoreState = null
  }
  useUIStore.getState().setTimelapsePlaying(false)
}

/** 履歴パネルの「タイムラプス再生」から呼ぶ。スナップショットを古い順に一定間隔で適用する */
export function startTimelapse(snapshots: readonly MapSnapshotEntry[]): void {
  if (snapshots.length === 0 || timerId) return

  const { getSerializedNodes, getSerializedEdges, loadFromSerialized } = useMapStore.getState()
  restoreState = {
    nodes: getSerializedNodes(),
    edges: getSerializedEdges(),
    title: useUIStore.getState().mapTitle,
  }
  useUIStore.getState().setTimelapsePlaying(true)

  let i = 0
  const playNext = () => {
    if (i >= snapshots.length) {
      finish()
      return
    }
    const snap = snapshots[i]
    loadFromSerialized(snap.mapFile.nodes, snap.mapFile.edges)
    i += 1
    timerId = setTimeout(playNext, INTERVAL_MS)
  }
  playNext()
}

/** IdeaCanvas の停止ボタンから呼ぶ。再生前の状態へ復元して再生を終了する */
export function stopTimelapse(): void {
  finish()
}
