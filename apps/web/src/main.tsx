import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setPlatform } from '@ideamap/platform'
import { useUIStore, setAppSettingsSync } from '@ideamap/core'
import { webPlatform } from './platform'
import { saveAppSettings, loadAppSettings } from './services/googleDriveService'
import '@ideamap/ui/styles.css'
import { WebApp } from './WebApp.tsx'

// ストアやコンポーネントが getPlatform() を呼ぶ前に注入する
setPlatform(webPlatform)

// 設定のクラウド同期は Google Drive を使う Web 版だけの機能なので、
// core には実装を持たせず apps/web から注入する
setAppSettingsSync({ save: saveAppSettings, load: loadAppSettings })

// currentFileId は StorageAdapter が非同期なためストア生成時に読めない。
// 「リロード後も前回と同じファイルへ保存を継続する」挙動を保つため、
// 復元が終わってから最初のレンダーを行う
void useUIStore
  .getState()
  .restoreCurrentFileId()
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <WebApp />
      </StrictMode>,
    )
  })
