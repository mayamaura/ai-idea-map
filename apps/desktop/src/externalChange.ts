import { getCurrentWindow } from '@tauri-apps/api/window'
import { getPlatform } from '@ideamap/platform'
import { useUIStore } from '@ideamap/core'
import { openMapFile } from './openMap'

/**
 * 開いているファイルが他のエディタやデバイス同期で書き換えられていないかを、
 * ウィンドウが前面に戻ったタイミングで確かめる（docs/desktop/platform-integration.md §3.7）。
 *
 * ファイルシステム監視（notify crate）は初期リリースにはオーバースペックと判断し、
 * Web版 useAutoSave のバックグラウンド復帰チェックと同じ「focus 契機」に揃えている。
 */

/**
 * mtime の比較に持たせる余裕。保存直後は自分が書いた mtime が lastSavedAt を
 * わずかに上回るため、これが無いと自分の保存を外部変更と誤検知する。
 */
const MTIME_TOLERANCE_MS = 2000

export function watchExternalFileChanges(): () => void {
  /** このファイルについて「変更なし」と確認できている最新の mtime */
  let baseline: { fileId: string; mtime: number } | null = null
  /** 同じ mtime で繰り返し尋ねないための記録 */
  let promptedMtime = 0
  let isChecking = false

  const check = async () => {
    if (isChecking) return
    const ui = useUIStore.getState()
    // ダイアログが出ている最中に別のダイアログで上書きしない
    if (!ui.hasActiveMap || !ui.currentFileId || ui.confirmDialog) return
    // Drive 上のマップは mtime を持たない（Drive の getMetadata は mapId だけを返す）。
    // ここでの外部変更検知はローカルファイルに限る
    if (ui.currentFileOrigin === 'cloud') return

    isChecking = true
    try {
      const file = getPlatform().file
      const ref = {
        id: ui.currentFileId,
        name: ui.mapTitle,
        origin: ui.currentFileOrigin ?? getPlatform().file.origin,
        updatedAt: '',
      }
      const meta = await file.getMetadata(ref)
      if (!meta?.updatedAt) return

      const mtime = Date.parse(meta.updatedAt)
      if (Number.isNaN(mtime)) return

      // 別のファイルに切り替わっていたら、今の mtime を基準に取り直すだけで終わる
      if (baseline?.fileId !== ui.currentFileId) {
        baseline = { fileId: ui.currentFileId, mtime }
        return
      }

      const savedAt = ui.lastSavedAt ? Date.parse(ui.lastSavedAt) : 0
      const known = Math.max(baseline.mtime, Number.isNaN(savedAt) ? 0 : savedAt)
      if (mtime <= known + MTIME_TOLERANCE_MS) return
      if (mtime === promptedMtime) return

      promptedMtime = mtime
      const hasLocalEdits = ui.saveStatus === 'unsaved' || ui.saveStatus === 'error'
      ui.openConfirmDialog({
        title: 'ファイルが外部で変更されています',
        message: hasLocalEdits
          ? `「${ui.mapTitle}」が他のアプリで更新されています。読み込み直すと、まだ保存していないこの画面の変更は失われます。`
          : `「${ui.mapTitle}」が他のアプリで更新されています。読み込み直しますか？`,
        confirmLabel: '読み込み直す',
        danger: hasLocalEdits,
        onConfirm: () => {
          void openMapFile(ref).then((opened) => {
            // 読み込めた時点の mtime を新しい基準にする
            if (opened) baseline = { fileId: ref.id, mtime }
          })
        },
        onCancel: () => {
          // 「開いたまま」を選んだ以上、この内容については二度と尋ねない。
          // 基準を進めておかないと focus のたびに同じ確認が出る
          baseline = { fileId: ref.id, mtime }
        },
      })
    } catch {
      // 削除・リネーム・権限エラーはここでは黙る。保存時に FileAdapter 側が扱う
    } finally {
      isChecking = false
    }
  }

  const unlisten = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
    if (focused) void check()
  })

  return () => {
    void unlisten.then((off) => off())
  }
}
