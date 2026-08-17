import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { setPlatform } from '@ideamap/platform'
import {
  restorePersistedState,
  setAppSettingsSync,
  saveAppSettings,
  loadAppSettings,
  useUIStore,
} from '@ideamap/core'
import { webPlatform } from './platform'
import '@ideamap/ui/styles.css'
import { WebApp } from './WebApp.tsx'

// ストアやコンポーネントが getPlatform() を呼ぶ前に注入する
setPlatform(webPlatform)

// Service Worker の登録は初回描画をブロックしない（restorePersistedState とは独立に実行する）。
// registerType: 'prompt' のため自動リロードはせず、新バージョン検出時はトーストでユーザー操作を促す
// （編集中のマップを失わせないため）。既存の「再接続」トースト（WebApp.tsx の onSaveError）と同じ形
const updateSW = registerSW({
  onNeedRefresh() {
    useUIStore.getState().addToast('新しいバージョンがあります。再読み込みで更新されます', 'info', {
      label: '更新',
      onClick: () => void updateSW(true),
    })
  },
  onOfflineReady() {
    useUIStore.getState().addToast('オフラインで利用できる準備ができました', 'success')
  },
})

// 設定のクラウド同期は Google Drive を使う Web 版だけの機能なので、
// core には実装を持たせず apps/web から注入する
setAppSettingsSync({ save: saveAppSettings, load: loadAppSettings })

// 設定と currentFileId は StorageAdapter が非同期なためストア生成時に読めない。
// テーマのちらつきと「前回と同じファイルへ保存を継続する」挙動を守るため、
// 復元が終わってから最初のレンダーを行う
void restorePersistedState().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <WebApp />
    </StrictMode>,
  )
})
