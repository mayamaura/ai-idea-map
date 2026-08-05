import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setPlatform } from '@ideamap/platform'
import { useUIStore } from '@ideamap/core'
import { webPlatform } from './platform'
import './index.css'
import App from './App.tsx'

// ストアやコンポーネントが getPlatform() を呼ぶ前に注入する
setPlatform(webPlatform)

// currentFileId は StorageAdapter が非同期なためストア生成時に読めない。
// 「リロード後も前回と同じファイルへ保存を継続する」挙動を保つため、
// 復元が終わってから最初のレンダーを行う
void useUIStore
  .getState()
  .restoreCurrentFileId()
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
