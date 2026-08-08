import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { getVersion } from '@tauri-apps/api/app'
import { ask, message } from '@tauri-apps/plugin-dialog'
import { useUIStore } from '@ideamap/core'

/**
 * GitHub Releases の latest.json を見にいく自動更新。
 *
 * 更新パッケージの署名検証は Rust 側（tauri-plugin-updater）が公開鍵で行うため、
 * コード署名証明書が無くても「配布後にすり替えられたものを掴む」ことは防げる
 * （docs/desktop/platform-integration.md §6.5）。
 */

/** 起動直後の重い処理（マップ復元・設定復元）とネットワークを取り合わないよう待つ */
const STARTUP_DELAY_MS = 5000

export async function getAppVersion(): Promise<string> {
  return getVersion()
}

/**
 * 更新を確認し、あればユーザーに尋ねてから適用する。
 *
 * @param silent 更新なし・確認失敗を黙って無視する（起動時の自動チェック用）。
 *               false のときは結果を必ずユーザーに返す（設定パネルの手動チェック用）
 * @returns 更新を適用して再起動に進んだか
 */
export async function checkForUpdate(silent: boolean): Promise<boolean> {
  const toast = useUIStore.getState().addToast

  let update: Update | null
  try {
    update = await check()
  } catch (e) {
    // オフラインや GitHub 側の一時障害で起動のたびに通知が出るのは煩わしいだけなので、
    // 自動チェックでは黙る。手動チェックは押した本人が結果を待っているので必ず返す
    if (!silent) toast(`更新の確認に失敗しました: ${errorText(e)}`, 'error')
    return false
  }

  if (!update) {
    if (!silent) toast('お使いのバージョンは最新です', 'success')
    return false
  }

  const accepted = await ask(
    `新しいバージョン ${update.version} が利用できます。\n（現在のバージョン: ${update.currentVersion}）\n\n今すぐダウンロードしてインストールしますか？インストール後にアプリが再起動します。`,
    { title: 'IdeaMap の更新', kind: 'info', okLabel: '更新する', cancelLabel: 'あとで' }
  )
  if (!accepted) return false

  try {
    // 未保存の変更があると再起動で失われる。保存の完了を待ってから落とす
    await flushPendingSave()
    toast(`バージョン ${update.version} をダウンロードしています…`, 'info')
    await update.downloadAndInstall()
    await relaunch()
    return true
  } catch (e) {
    await message(`更新の適用に失敗しました。\n\n${errorText(e)}`, {
      title: 'IdeaMap の更新',
      kind: 'error',
    })
    return false
  }
}

/** 起動時の自動チェック。戻り値は登録解除用（タイマーの後始末） */
export function scheduleStartupUpdateCheck(): () => void {
  const timer = setTimeout(() => void checkForUpdate(true), STARTUP_DELAY_MS)
  return () => clearTimeout(timer)
}

/** デバウンス待ちの自動保存を確定させる。最大 10 秒だけ待ち、それ以上は諦めて進む */
async function flushPendingSave(): Promise<void> {
  const ui = useUIStore.getState()
  if (ui.saveStatus !== 'unsaved' && ui.saveStatus !== 'saving') return

  ui.requestSave()
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const status = useUIStore.getState().saveStatus
    if (status !== 'unsaved' && status !== 'saving') return
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
