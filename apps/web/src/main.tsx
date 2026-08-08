import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setPlatform } from '@ideamap/platform'
import {
  restorePersistedState,
  setAppSettingsSync,
  saveAppSettings,
  loadAppSettings,
} from '@ideamap/core'
import { webPlatform } from './platform'
import '@ideamap/ui/styles.css'
import { WebApp } from './WebApp.tsx'

// ストアやコンポーネントが getPlatform() を呼ぶ前に注入する
setPlatform(webPlatform)

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
