import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useUIStore } from '@ideamap/core'
import { getPlatform } from '@ideamap/platform'
import { openMapFile } from './openMap'

/**
 * `.ideamap` のダブルクリック起動を受ける。
 *
 * 初回起動は Rust 側が起動引数から拾って保持しているものを取りに行き、
 * すでにアプリが動いている場合は single-instance プラグインが
 * 2つ目のプロセスの引数をイベントに変換して送ってくる。
 */

const OPEN_MAP_EVENT = 'ideamap://open-map-file'

export function listenForLaunchFile(): () => void {
  // 起動引数のファイルは、ダッシュボードより先に開いて起動画面を飛ばす
  void invoke<string | null>('take_launch_file').then((path) => {
    if (path) void openPath(path, false)
  })

  const unlisten = listen<string>(OPEN_MAP_EVENT, (event) => {
    void openPath(event.payload, true)
  })

  return () => {
    void unlisten.then((off) => off())
  }
}

/** @param confirmDiscard 編集中の内容を捨てる確認を挟むか（起動直後は編集がないので不要） */
async function openPath(path: string, confirmDiscard: boolean): Promise<void> {
  const ui = useUIStore.getState()
  const ref = { id: path, name: baseName(path), origin: getPlatform().file.origin, updatedAt: '' }

  const hasPendingEdits =
    ui.saveStatus === 'unsaved' || ui.saveStatus === 'saving' || ui.saveStatus === 'error'
  if (confirmDiscard && ui.hasActiveMap && hasPendingEdits) {
    ui.openConfirmDialog({
      title: 'マップを開く',
      message: `保存されていない変更があります。「${ref.name}」を開くと、この画面の変更は失われます。`,
      confirmLabel: '開く',
      danger: true,
      onConfirm: () => void openMapFile(ref),
    })
    return
  }
  await openMapFile(ref)
}

function baseName(path: string): string {
  const segments = path.split(/[\\/]/)
  return segments[segments.length - 1] || path
}
