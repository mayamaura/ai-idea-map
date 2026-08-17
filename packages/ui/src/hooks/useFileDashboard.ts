import { useEffect } from 'react'
import type { FileRef } from '@ideamap/platform'
import { getMapTemplate, migrateMapFile, useMapStore, useUIStore, type MapFile } from '@ideamap/core'

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

/** テンプレート（SWOT等）から新規マップを作ってキャンバスに入る（Phase 46） */
export function startNewMapFromTemplate(templateId: string): void {
  const template = getMapTemplate(templateId)
  if (!template) return
  const ui = useUIStore.getState()
  const map = useMapStore.getState()
  map.reset()
  map.loadFromSerialized(template.nodes, template.edges)
  ui.setMapTitle(template.mapTitle)
  // startNewMap と同じ手順で保存先の紐付けを外す（前回ファイルへの誤保存を防ぐ）
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
 * @param origin 保存先の種別。省略時は FileAdapter の既定。デスクトップ版が Drive 上の
 *   マップを開いたときだけ 'cloud' を明示し、以後の保存を Drive へ向ける
 */
export function openLoadedMap(
  rawData: MapFile,
  fileId: string | null,
  fallbackTitle: string,
  origin?: FileRef['origin']
): void {
  const ui = useUIStore.getState()
  const { file: data, warning } = migrateMapFile(rawData)
  useMapStore.getState().loadFromSerialized(data.nodes, data.edges)
  ui.setMapTitle(data.title || fallbackTitle)
  ui.setCurrentFileId(fileId, origin)
  ui.setCurrentMapId(data.mapId ?? null)
  ui.setPresentationNodeIds(data.presentationNodeIds ?? [])
  ui.setSaveStatus(fileId ? 'saved' : 'unsaved')
  ui.setFileDashboardOpen(false)
  if (warning) ui.addToast(warning, 'info')
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
