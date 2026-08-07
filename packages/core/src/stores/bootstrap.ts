import { useSettingsStore } from './settingsStore'
import { useUIStore } from './uiStore'

/**
 * 永続化された状態を復元する。StorageAdapter は非同期なのでストア生成時には読めず、
 * 各アプリの main.tsx が最初のレンダー前にこれを await する。
 *
 * レンダー後に復元すると、テーマが既定値（light）で一瞬描画されてちらつき、
 * currentFileId が未復元のまま自動保存が走って別ファイルを作ってしまう。
 */
export async function restorePersistedState(): Promise<void> {
  await Promise.all([
    useSettingsStore.persist.rehydrate(),
    useUIStore.getState().restoreCurrentFileId(),
  ])
}
