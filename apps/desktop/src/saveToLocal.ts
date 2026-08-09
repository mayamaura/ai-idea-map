import { v4 as uuidv4 } from 'uuid'
import { getPlatform } from '@ideamap/platform'
import { buildMapFile, useUIStore } from '@ideamap/core'

/**
 * いま開いているマップをローカルの `.ideamap` として保存し直し、以後の自動保存も
 * そのファイルへ向ける（saveToDrive.ts の逆方向）。
 *
 * 保存ダイアログとファイル書き込みは FileAdapter.saveFileAs がすでに担っているので、
 * ここがやるのは保存先の付け替えだけ。Drive 側のファイルは切り替えた時点の内容のまま残る。
 */
export async function saveCurrentMapToLocal(): Promise<boolean> {
  const ui = useUIStore.getState()
  // マップ未読込のまま呼ぶと初期マップを書き出してしまう（useAutoSave と同じガード）
  if (!ui.hasActiveMap) return false

  const mapId = ui.currentMapId ?? uuidv4()
  try {
    const ref = await getPlatform().file.saveFileAs(buildMapFile(mapId), ui.mapTitle)
    // null は保存ダイアログのキャンセル。失敗ではないので保存先は変えない
    if (!ref) return false
    ui.setCurrentMapId(mapId)
    ui.setCurrentFileId(ref.id, ref.origin)
    ui.setSaveStatus('saved')
    ui.setLastSavedAt(new Date().toISOString())
    ui.addToast(
      `「${ui.mapTitle}」を ${ref.name} に保存しました。以後の自動保存もこのファイルに向きます`,
      'success'
    )
    return true
  } catch {
    ui.addToast('ファイルの保存に失敗しました', 'error')
    return false
  }
}
