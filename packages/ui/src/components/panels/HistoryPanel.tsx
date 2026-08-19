import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  useUIStore,
  useMapStore,
  buildMapFile,
  getSnapshots,
  recordSnapshot,
  type MapSnapshotEntry,
} from '@ideamap/core'
import { PanelHeader } from '../common/PanelHeader'
import { startTimelapse } from '../../services/timelapsePlayer'

const TIMELAPSE_CONFIRM_MESSAGE =
  'マップが育っていく過程をアニメーションで再生します。再生中は編集できません。実行中のUndo履歴は再生後に失われます。'
const MAX_PREVIEW_NODES = 30

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function HistoryPanel() {
  const {
    isHistoryPanelOpen,
    setHistoryPanelOpen,
    currentMapId,
    setMapTitle,
    setPresentationNodeIds,
    openConfirmDialog,
    addToast,
    isTimelapsePlaying,
  } = useUIStore(
    useShallow((s) => ({
      isHistoryPanelOpen: s.isHistoryPanelOpen,
      setHistoryPanelOpen: s.setHistoryPanelOpen,
      currentMapId: s.currentMapId,
      setMapTitle: s.setMapTitle,
      setPresentationNodeIds: s.setPresentationNodeIds,
      openConfirmDialog: s.openConfirmDialog,
      addToast: s.addToast,
      isTimelapsePlaying: s.isTimelapsePlaying,
    }))
  )
  const loadFromSerialized = useMapStore((s) => s.loadFromSerialized)

  // null = 未読込（読み込み中の表示に使う）。読み込み中フラグを別 state で持たず、
  // この1つの state で「未読込／空／件数あり」の3状態を表す（react-hooks/set-state-in-effect を避けるため、
  // 効果内では非同期解決後の1回だけ setState する構成にしている）
  const [snapshots, setSnapshots] = useState<readonly MapSnapshotEntry[] | null>(null)
  // 開いている行は index ではなく time で覚える。マップ切り替えで一覧が入れ替わっても、
  // 別の同名 index を誤って開いたままにせず自然に閉じた状態になる
  const [openTime, setOpenTime] = useState<string | null>(null)

  // 開いたら現在のマップの履歴を読み込む。マップを切り替えて開き直したときも再取得する
  useEffect(() => {
    if (!isHistoryPanelOpen || !currentMapId) return
    void getSnapshots(currentMapId).then(setSnapshots)
  }, [isHistoryPanelOpen, currentMapId])

  if (!isHistoryPanelOpen) return null

  const handleRestore = (entry: MapSnapshotEntry) => {
    openConfirmDialog({
      title: 'この時点に復元しますか？',
      message: `${formatTime(entry.time)} 時点の状態に復元します。現在の内容は復元前にスナップショットとして保存されます。`,
      confirmLabel: '復元する',
      danger: true,
      onConfirm: () => {
        // 復元で失われる直前の状態を履歴へ退避してから復元する
        if (currentMapId) {
          void recordSnapshot(currentMapId, buildMapFile(currentMapId))
        }
        loadFromSerialized(entry.mapFile.nodes, entry.mapFile.edges)
        setMapTitle(entry.mapFile.title)
        setPresentationNodeIds(entry.mapFile.presentationNodeIds ?? [])
        setHistoryPanelOpen(false)
        addToast('復元しました', 'success')
      },
    })
  }

  const handleTimelapse = () => {
    if (!snapshots || snapshots.length === 0) return
    openConfirmDialog({
      title: 'タイムラプス再生',
      message: TIMELAPSE_CONFIRM_MESSAGE,
      confirmLabel: '再生する',
      onConfirm: () => {
        setHistoryPanelOpen(false)
        startTimelapse(snapshots)
      },
    })
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setHistoryPanelOpen(false)} />
      <div className="relative ml-auto w-full sm:max-w-md h-full bg-white dark:bg-gray-800 shadow-2xl flex flex-col overflow-hidden">
        <PanelHeader
          icon="🕘"
          title="バージョン履歴"
          onClose={() => setHistoryPanelOpen(false)}
          closeAriaLabel="閉じる"
        />

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {!currentMapId ? (
            <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
              このマップはまだ保存されていません。保存すると履歴が記録されます
            </div>
          ) : snapshots === null ? (
            <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">読み込み中...</div>
          ) : snapshots.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
              <span className="text-3xl mb-3 block">🕘</span>
              まだ履歴がありません。保存すると記録されます
            </div>
          ) : (
            <>
              <button
                onClick={handleTimelapse}
                disabled={isTimelapsePlaying}
                className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isTimelapsePlaying ? 'タイムラプス再生中...' : '🎬 タイムラプス再生'}
              </button>

              <ul className="space-y-1.5">
                {snapshots.map((entry, idx) => {
                  const isOpen = openTime === entry.time
                  return (
                    <li
                      key={`${entry.time}-${idx}`}
                      className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                    >
                      <button
                        onClick={() => setOpenTime(isOpen ? null : entry.time)}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <span className="text-xs text-gray-600 dark:text-gray-300">{formatTime(entry.time)}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {entry.mapFile.nodes.length}ノード / {entry.mapFile.edges.length}エッジ
                        </span>
                      </button>
                      {isOpen && (
                        <div className="px-3 py-2.5 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 space-y-2">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">
                            {entry.mapFile.title}
                          </p>
                          <ul className="max-h-40 overflow-y-auto space-y-1">
                            {entry.mapFile.nodes.slice(0, MAX_PREVIEW_NODES).map((n) => (
                              <li key={n.id} className="text-xs text-gray-600 dark:text-gray-300 truncate">
                                ・{n.title || '（無題）'}
                              </li>
                            ))}
                            {entry.mapFile.nodes.length > MAX_PREVIEW_NODES && (
                              <li className="text-xs text-gray-400 dark:text-gray-500">
                                他 {entry.mapFile.nodes.length - MAX_PREVIEW_NODES} 件
                              </li>
                            )}
                          </ul>
                          <button
                            onClick={() => handleRestore(entry)}
                            disabled={isTimelapsePlaying}
                            className="w-full py-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            この時点に復元
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
