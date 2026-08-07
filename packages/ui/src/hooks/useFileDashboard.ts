import { useEffect } from 'react'
import { useMapStore, useUIStore, type MapFile } from '@ideamap/core'

/**
 * 起動画面（ファイルダッシュボード）の共通部分。
 *
 * 一覧の取得元は Web版が Google Drive、デスクトップ版がローカルファイルで異なるが、
 * 「マップを決めてキャンバスに入る」までのストア操作は同一なのでここに集約する。
 */

/** 新規マップを作ってキャンバスに入る */
export function startNewMap(): void {
  const ui = useUIStore.getState()
  useMapStore.getState().reset()
  ui.setMapTitle('新しいマップ')
  ui.setCurrentFileId(null)
  ui.setCurrentMapId(null)
  ui.setPresentationNodeIds([])
  ui.setSaveStatus('unsaved')
  ui.setFileDashboardOpen(false)
}

/**
 * 読み込んだマップをストアへ反映してキャンバスに入る。
 *
 * @param fileId 保存先の識別子（Web=Drive の fileId、Desktop=絶対パス）。
 *   null は「保存先が未確定」で、以後の保存で新規作成 or 保存ダイアログに進む
 */
export function openLoadedMap(data: MapFile, fileId: string | null, fallbackTitle: string): void {
  const ui = useUIStore.getState()
  useMapStore.getState().loadFromSerialized(data.nodes, data.edges)
  ui.setMapTitle(data.title || fallbackTitle)
  ui.setCurrentFileId(fileId)
  ui.setCurrentMapId(data.mapId ?? null)
  ui.setPresentationNodeIds(data.presentationNodeIds ?? [])
  ui.setSaveStatus(fileId ? 'saved' : 'unsaved')
  ui.setFileDashboardOpen(false)
}

/**
 * マップを開いた後の再表示時のみ Esc でダッシュボードを閉じられるようにする
 * （初回起動時は閉じる先がない）。
 */
export function useDashboardEscapeToClose(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // hasActiveMap をクロージャで持たず getState() で都度読むことでスタレ値を防ぐ
      const { hasActiveMap, confirmDialog, setFileDashboardOpen } = useUIStore.getState()
      if (e.key === 'Escape' && hasActiveMap && !confirmDialog) setFileDashboardOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
