import { open, save } from '@tauri-apps/plugin-dialog'
import {
  BaseDirectory,
  exists,
  mkdir,
  readTextFile,
  remove,
  stat,
  writeFile,
  writeTextFile,
} from '@tauri-apps/plugin-fs'
import type { FileAdapter, FileRef, RecentFileEntry } from '@ideamap/platform'
import { appStore } from './store.desktop'

/**
 * デスクトップ版のファイル入出力。マップの主保存先はローカルの `.ideamap`
 * （実体は Web版と同じ MapFile 形式の JSON）で、`FileRef.id` は絶対パスになる。
 *
 * ダイアログで選んだパスは dialog プラグインが実行時に fs スコープへ追加する。
 * それを次回起動へ引き継ぐのが Rust 側の persisted-scope プラグインで、
 * capabilities の fs:scope 自体はアプリ専用ディレクトリだけに絞っている。
 */

const MAP_FILTERS = [{ name: 'IdeaMap マップ', extensions: ['ideamap', 'json'] }]
const RECENT_KEY = 'recent-files'
/** 未保存マップの自動保存先。ユーザーが名前を付けるまで実ファイルを作らない */
const AUTOSAVE_DIR = 'autosave'
/** 起動時に「前回の作業を再開」で拾う自動保存ファイルのパス（$APPLOCALDATA 相対） */
const LAST_AUTOSAVE_KEY = 'last-autosave-path'
const MAX_RECENT = 10

interface StoredRecent {
  path: string
  title: string
  updatedAt: string
}

function baseName(path: string): string {
  const segments = path.split(/[\\/]/)
  return segments[segments.length - 1] || path
}

function toRef(path: string, updatedAt: string): FileRef {
  return { id: path, name: baseName(path), origin: 'local', updatedAt }
}

function readMapId(content: unknown): string | null {
  return (content as { mapId?: string } | null)?.mapId ?? null
}

function readTitle(content: unknown): string {
  return (content as { title?: string } | null)?.title || '無題のマップ'
}

async function loadRecent(): Promise<StoredRecent[]> {
  return (await appStore.get<StoredRecent[]>(RECENT_KEY)) ?? []
}

/** 開く・保存のたびに履歴の先頭へ積む。同じパスは重複させず最新の位置へ繰り上げる */
async function recordRecent(path: string, title: string): Promise<void> {
  const entry: StoredRecent = { path, title, updatedAt: new Date().toISOString() }
  const rest = (await loadRecent()).filter((r) => r.path !== path)
  await appStore.set(RECENT_KEY, [entry, ...rest].slice(0, MAX_RECENT))
  await appStore.save()
}

async function ensureAutosaveDir(): Promise<void> {
  if (await exists(AUTOSAVE_DIR, { baseDir: BaseDirectory.AppLocalData })) return
  await mkdir(AUTOSAVE_DIR, { baseDir: BaseDirectory.AppLocalData, recursive: true })
}

/** 直近の自動保存ファイル。デスクトップ版ダッシュボードの「前回の作業を再開」が使う */
export async function loadLastAutosave(): Promise<unknown | null> {
  const path = await appStore.get<string>(LAST_AUTOSAVE_KEY)
  if (!path) return null
  try {
    if (!(await exists(path, { baseDir: BaseDirectory.AppLocalData }))) return null
    const text = await readTextFile(path, { baseDir: BaseDirectory.AppLocalData })
    return JSON.parse(text) as unknown
  } catch {
    // 自動保存の欠損・破損は復旧の失敗であってアプリの異常ではない
    return null
  }
}

export const desktopFileAdapter: FileAdapter = {
  origin: 'local',
  // ローカルファイルシステムは常に使えるため、Web版のサインイン待ちに相当する状態はない
  isRemoteReady: true,

  async listRecent(): Promise<RecentFileEntry[]> {
    const stored = await loadRecent()
    const entries: RecentFileEntry[] = []
    for (const r of stored) {
      // 移動・削除されたファイルは一覧から落とす（パスが主キーである以上避けられない）
      if (!(await exists(r.path).catch(() => false))) continue
      entries.push({ ref: toRef(r.path, r.updatedAt), title: r.title })
    }
    return entries
  },

  async openFile(ref) {
    const path = ref?.id ?? (await open({ multiple: false, directory: false, filters: MAP_FILTERS }))
    if (typeof path !== 'string') return null
    const text = await readTextFile(path)
    const content = JSON.parse(text) as unknown
    const info = await stat(path)
    const updatedAt = info.mtime?.toISOString() ?? new Date().toISOString()
    await recordRecent(path, readTitle(content))
    return { ref: toRef(path, updatedAt), content }
  },

  async saveFile(ref, content) {
    await writeTextFile(ref.id, JSON.stringify(content, null, 2))
    await recordRecent(ref.id, readTitle(content))
    return toRef(ref.id, new Date().toISOString())
  },

  async saveFileAs(content, suggestedName) {
    const path = await save({
      defaultPath: `${suggestedName}.ideamap`,
      filters: MAP_FILTERS,
    })
    if (!path) return null
    await writeTextFile(path, JSON.stringify(content, null, 2))
    await recordRecent(path, readTitle(content))
    return toRef(path, new Date().toISOString())
  },

  async deleteFile(ref) {
    await remove(ref.id)
    const rest = (await loadRecent()).filter((r) => r.path !== ref.id)
    await appStore.set(RECENT_KEY, rest)
    await appStore.save()
  },

  async getMetadata(ref) {
    try {
      const info = await stat(ref.id)
      // 衝突判定は Web版と同じくファイル内 mapId の一致で行うため中身まで読む。
      // マップ JSON は数十 KB 程度なので、セッション初回の1回だけなら許容できる
      const content = JSON.parse(await readTextFile(ref.id)) as unknown
      return {
        mapId: readMapId(content),
        updatedAt: info.mtime?.toISOString() ?? '',
      }
    } catch {
      // 開いていたファイルが外部で消された場合。衝突なしとして扱い保存を進める
      return null
    }
  },

  async saveLocalMirror(content) {
    const mapId = readMapId(content)
    if (!mapId) return
    await ensureAutosaveDir()
    const relPath = `${AUTOSAVE_DIR}/${mapId}.ideamap`
    await writeTextFile(relPath, JSON.stringify(content, null, 2), {
      baseDir: BaseDirectory.AppLocalData,
    })
    await appStore.set(LAST_AUTOSAVE_KEY, relPath)
    await appStore.save()
  },

  async exportBlob(suggestedName, blob) {
    const path = await save({ defaultPath: suggestedName })
    if (!path) return
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()))
  },
}
