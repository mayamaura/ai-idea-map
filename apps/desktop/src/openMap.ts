import { getPlatform, type FileRef } from '@ideamap/platform'
import { useUIStore, type MapFile } from '@ideamap/core'
import { openLoadedMap } from '@ideamap/ui'

/**
 * マップファイルを開く。ref 省略時はネイティブの「開く」ダイアログを出す。
 * 戻り値はマップを開いたか（false = ユーザーがキャンセル）。読み込み失敗は throw せずトーストにする。
 *
 * ダッシュボードからの選択と Ctrl+O の両方がここを通ることで状態遷移を一本化する。
 */
export async function openMapFile(ref?: FileRef): Promise<boolean> {
  try {
    const opened = await getPlatform().file.openFile(ref)
    if (!opened) return false
    openLoadedMap(
      opened.content as MapFile,
      opened.ref.id,
      opened.ref.name.replace(/\.[^.]+$/, ''),
      opened.ref.origin
    )
    return true
  } catch {
    useUIStore.getState().addToast('ファイルの読み込みに失敗しました', 'error')
    return false
  }
}
