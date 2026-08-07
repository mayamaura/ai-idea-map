import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setPlatform } from '@ideamap/platform'
import { restorePersistedState } from '@ideamap/core'
import { desktopPlatform } from './platform'
import '@ideamap/ui/styles.css'
import { DesktopApp } from './DesktopApp.tsx'

// ストアやコンポーネントが getPlatform() を呼ぶ前に注入する
setPlatform(desktopPlatform)

// 設定のクラウド同期（setAppSettingsSync）は注入しない。
// Google Drive はデスクトップ版 v1 のスコープ外（docs/desktop/README.md §3.1）

// 設定と currentFileId は StorageAdapter が非同期なためストア生成時に読めない。
// テーマのちらつきと、前回開いていたファイルへの誤保存を防ぐため復元後にレンダーする
void restorePersistedState().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <DesktopApp />
    </StrictMode>,
  )
})
