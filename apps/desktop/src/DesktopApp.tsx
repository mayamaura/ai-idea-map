import { useEffect, useMemo } from 'react'
import { App } from '@ideamap/ui'
import { useUIStore } from '@ideamap/core'
import { DesktopFileDashboard } from './components/DesktopFileDashboard'
import { FileDropOverlay } from './components/FileDropOverlay'
import { UpdaterSection } from './components/UpdaterSection'
import { useDesktopGoogleAuth } from './hooks/useDesktopGoogleAuth'
import { setDriveAccessToken } from './platform'
import { openMapFile } from './openMap'
import { scheduleStartupUpdateCheck } from './updater'
import { listenForLaunchFile } from './launchFile'
import { watchExternalFileChanges } from './externalChange'

/**
 * デスクトップ版のシェル。ローカルファイル中心の保存モデルと、その導線を足す。
 *
 * Google Drive 連携は Phase 38 で追加した。認証は Web版の GIS ポップアップではなく
 * ループバック + PKCE（googleAuth.ts）で、消費側から見た形は Web版と揃えてある。
 * mapListSlot / onGenerateShareUrl は Web専用のままなので渡さない。
 */
export function DesktopApp() {
  const cloudAuth = useDesktopGoogleAuth()
  const { accessToken, silentReauth, signIn } = cloudAuth

  // FileAdapter はトークンを引数に取らないため、変わるたびに流し込む（Web版と同じ形）
  useEffect(() => {
    setDriveAccessToken(accessToken)
  }, [accessToken])

  const autoSave = useMemo(
    () => ({
      // ローカルファイルシステムは常に使える。Drive 上のマップを開いている間も、
      // 保存が401で落ちたときの再認証は onSaveError 側で扱う
      remoteReady: true,
      credentialKey: accessToken,
      // 保存先未確定のままデバウンス保存すると3秒ごとに保存ダイアログが出るため、
      // 新規ファイルの作成は Ctrl+S 等の明示的な保存にだけ許す
      createNewFileOnSave: false,
      onSaveError: (err: unknown, attempt: number): 'retry' | 'handled' => {
        // ローカル保存の失敗と Drive の失効を取り違えないよう、開いている先で分岐する
        const isCloud = useUIStore.getState().currentFileOrigin === 'cloud'
        const isAuthError = isCloud && err instanceof Error && err.message.includes('401')
        if (!isAuthError) {
          useUIStore
            .getState()
            .addToast(isCloud ? 'Googleドライブへの保存に失敗しました' : '保存に失敗しました', 'error')
          return 'handled'
        }
        if (attempt === 1) {
          // 初回401: キーチェーンのリフレッシュトークンで silent に取り直す
          silentReauth()
          return 'retry'
        }
        useUIStore.getState().addToast('Googleドライブの認証が切れました', 'error', {
          label: '再接続',
          onClick: signIn,
        })
        return 'handled'
      },
    }),
    [accessToken, silentReauth, signIn]
  )

  useOpenFileShortcut()
  useEffect(scheduleStartupUpdateCheck, [])
  useEffect(listenForLaunchFile, [])
  useEffect(watchExternalFileChanges, [])

  return (
    <>
      <App
        cloudAuth={cloudAuth}
        autoSave={autoSave}
        dashboardSlot={<DesktopFileDashboard cloudAuth={cloudAuth} />}
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
