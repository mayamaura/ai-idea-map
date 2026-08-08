import { useEffect, useMemo } from 'react'
import { App } from '@ideamap/ui'
import { DesktopFileDashboard } from './components/DesktopFileDashboard'
import { FileDropOverlay } from './components/FileDropOverlay'
import { UpdaterSection } from './components/UpdaterSection'
import { openMapFile } from './openMap'
import { scheduleStartupUpdateCheck } from './updater'
import { listenForLaunchFile } from './launchFile'
import { watchExternalFileChanges } from './externalChange'

/**
 * デスクトップ版のシェル。ローカルファイル中心の保存モデルと、その導線だけを足す。
 *
 * cloudAuth / mapListSlot / onGenerateShareUrl は渡さない。
 * Drive同期・GIS認証・共有URL は Web専用として apps/web に閉じてあり、
 * 未指定のとき共通UIが該当箇所を描画しないようになっている（docs/desktop/README.md §3.1）。
 */
export function DesktopApp() {
  const autoSave = useMemo(
    () => ({
      // ローカルファイルシステムは常に使える。Web版のサインイン待ちに相当する状態はない
      remoteReady: true,
      // 保存先未確定のままデバウンス保存すると3秒ごとに保存ダイアログが出るため、
      // 新規ファイルの作成は Ctrl+S 等の明示的な保存にだけ許す
      createNewFileOnSave: false,
    }),
    []
  )

  useOpenFileShortcut()
  useEffect(scheduleStartupUpdateCheck, [])
  useEffect(listenForLaunchFile, [])
  useEffect(watchExternalFileChanges, [])

  return (
    <>
      <App
        autoSave={autoSave}
        dashboardSlot={<DesktopFileDashboard />}
        settingsExtraSections={<UpdaterSection />}
      />
      <FileDropOverlay />
    </>
  )
}

/** Ctrl+O でネイティブの「開く」ダイアログ。デスクトップアプリの慣習に合わせる */
function useOpenFileShortcut() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 'o') return
      e.preventDefault()
      void openMapFile()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
