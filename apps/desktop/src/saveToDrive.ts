import { v4 as uuidv4 } from 'uuid'
import { buildMapFile, saveMap, useUIStore } from '@ideamap/core'

/**
 * いま開いているマップを Google ドライブへ保存し、以後の自動保存も Drive へ向ける。
 *
 * ローカルファイルとして開いたマップの保存先を後から切り替える唯一の経路なので、
 * 起動画面の Drive 欄とヘッダーのアカウントメニューの両方からここを通す
 * （openMap.ts が「開く」を一本化しているのと同じ理由）。
 *
 * 元のローカルファイルは上げた時点の内容のまま残り、以後は更新されない。
 */
export async function saveCurrentMapToDrive(accessToken: string): Promise<boolean> {
  const ui = useUIStore.getState()
  // マップ未読込のまま呼ぶと初期マップを Drive に作ってしまう（useAutoSave と同じガード）
  if (!ui.hasActiveMap) return false

  const mapId = ui.currentMapId ?? uuidv4()
  try {
    // fileId は渡さない。同じ mapId のファイルが Drive にあれば driveService が拾って上書きする
    const fileId = await saveMap(accessToken, ui.mapTitle, buildMapFile(mapId), null, mapId)
    ui.setCurrentMapId(mapId)
    ui.setCurrentFileId(fileId, 'cloud')
    ui.setSaveStatus('saved')
    ui.setLastSavedAt(new Date().toISOString())
    ui.addToast(
      `「${ui.mapTitle}」をGoogleドライブに保存しました。以後の自動保存もドライブに向きます`,
      'success'
    )
    return true
  } catch {
    ui.addToast('Googleドライブへの保存に失敗しました', 'error')
    return false
  }
}
