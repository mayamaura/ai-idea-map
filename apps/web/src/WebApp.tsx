import { useEffect, useMemo } from 'react'
import { App } from '@ideamap/ui'
import { useUIStore, useMapStore, migrateMapFile } from '@ideamap/core'
import { useGoogleAuth } from './hooks/useGoogleAuth'
import { MapListPanel } from './components/panels/MapListPanel'
import { FileOpenDashboard } from './components/screens/FileOpenDashboard'
import { setDriveAccessToken } from './platform'
import { generateShareUrl, parseMapFromUrl, clearMapFromUrl } from './services/shareUrl'

/**
 * Web版のシェル。Google Drive / GIS 認証 / 共有URL という
 * Web でしか成立しない機能をここに閉じ込め、共通UIには props で渡す。
 */
export function WebApp() {
  const googleAuth = useGoogleAuth()
  const { accessToken, silentReauth, signIn } = googleAuth

  // FileAdapter はトークンを引数に取らないため、変わるたびに流し込む。
  // レンダー中に副作用を起こさないよう useEffect ではなく同期で入れると
  // StrictMode の二重実行で順序が乱れるため useEffect に置く
  useEffect(() => {
    setDriveAccessToken(accessToken)
  }, [accessToken])

  useShareUrlImport()

  const autoSave = useMemo(
    () => ({
      remoteReady: accessToken !== null,
      credentialKey: accessToken,
      onSaveError: (err: unknown, attempt: number): 'retry' | 'handled' => {
        // オフライン中の保存失敗はヘッダーのオフラインバナー（useOnlineStatus）が既に状態を
        // 示しているため、fetch の TypeError のたびにトーストを重ねて出さない（Phase 51）。
        // online イベント（useAutoSave 側）で復帰後に自動リトライされる
        if (!navigator.onLine) return 'retry'
        const isAuthError = err instanceof Error && err.message.includes('401')
        if (!isAuthError) {
          useUIStore.getState().addToast('Googleドライブへの保存に失敗しました', 'error')
          return 'handled'
        }
        if (attempt === 1) {
          // 初回401: サイレント再認証を試みる。トーストは表示しない
          silentReauth()
          return 'retry'
        }
        // 再認証後も401: ユーザーに手動再接続を促す
        useUIStore
          .getState()
          .addToast('Googleドライブの認証が切れました', 'error', {
            label: '再接続',
            onClick: signIn,
          })
        return 'handled'
      },
    }),
    [accessToken, silentReauth, signIn]
  )

  return (
    <App
      cloudAuth={googleAuth}
      autoSave={autoSave}
      onGenerateShareUrl={generateShareUrl}
      mapListSlot={<MapListPanel accessToken={accessToken} />}
      dashboardSlot={
        <FileOpenDashboard
          accessToken={accessToken}
          isSignedIn={googleAuth.isSignedIn}
          isGoogleLoading={googleAuth.isLoading}
          onGoogleSignIn={signIn}
        />
      }
    />
  )
}

/** 共有URL（?map=...）でアクセスされた場合にマップを取り込む。Web版だけの導線 */
function useShareUrlImport() {
  useEffect(() => {
    const rawData = parseMapFromUrl()
    if (!rawData) return
    clearMapFromUrl()
    const { file: mapData, warning } = migrateMapFile(rawData)
    const ui = useUIStore.getState()
    ui.openConfirmDialog({
      title: '共有マップのインポート',
      message: `「${mapData.title}」が共有URLから見つかりました。インポートしますか？現在のマップは置き換えられます。`,
      confirmLabel: 'インポート',
      onConfirm: () => {
        useMapStore.getState().loadFromSerialized(mapData.nodes, mapData.edges)
        ui.setMapTitle(mapData.title)
        // 共有URL からのインポートは新規マップ扱い。前のマップの fileId を引き継いで上書きしない
        ui.setCurrentFileId(null)
        ui.addToast(`「${mapData.title}」をインポートしました`, 'success')
        // ダッシュボードを閉じてインポートしたマップを表示（開いたままだと別マップ選択で上書きされる）
        ui.setFileDashboardOpen(false)
        if (warning) ui.addToast(warning, 'info')
      },
    })
  }, [])
}
