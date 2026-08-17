/**
 * エラーログのリングバッファ（Phase 43）。
 *
 * 外部監視サービスを使わない方針（docs/roadmap.md §3.4）のため、
 * 未捕捉エラーを StorageAdapter 経由で端末内に貯め、設定パネルからエクスポートできるようにする。
 * 記録の失敗はアプリ動作に影響させない（このモジュールは決して throw しない）。
 */
import { getPlatform } from '@ideamap/platform'

export interface ErrorLogEntry {
  /** ISO 8601 */
  time: string
  /** 発生元（'window.onerror' / 'unhandledrejection' など） */
  source: string
  message: string
  stack?: string
  /** 同一エラーが連続した回数（フラッディング防止のためまとめる） */
  count: number
}

const STORAGE_KEY = 'ideamap-error-log'
const MAX_ENTRIES = 200

// プロセス内キャッシュ。読み込みは初回のみで、以後はメモリを正とし保存で上書きする
let cache: ErrorLogEntry[] | null = null

async function loadEntries(): Promise<ErrorLogEntry[]> {
  if (cache) return cache
  try {
    const raw = await getPlatform().storage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    cache = Array.isArray(parsed) ? (parsed as ErrorLogEntry[]) : []
  } catch {
    cache = []
  }
  return cache
}

async function persist(entries: ErrorLogEntry[]): Promise<void> {
  try {
    await getPlatform().storage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // 保存できなくてもメモリ上のログは維持される
  }
}

function toMessage(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: `${error.name}: ${error.message}`, stack: error.stack }
  }
  if (typeof error === 'string') return { message: error }
  try {
    return { message: JSON.stringify(error) }
  } catch {
    return { message: String(error) }
  }
}

/** エラーを記録する。エラーハンドラから呼ばれるため決して throw しない */
export async function recordError(source: string, error: unknown): Promise<void> {
  try {
    const { message, stack } = toMessage(error)
    const entries = await loadEntries()
    const last = entries[entries.length - 1]
    // 同一エラーの連続（レンダーループ等）はエントリを増やさず count に畳む
    if (last && last.source === source && last.message === message) {
      last.count += 1
      last.time = new Date().toISOString()
    } else {
      entries.push({ time: new Date().toISOString(), source, message, stack, count: 1 })
      if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES)
    }
    await persist(entries)
  } catch {
    // 記録の失敗は握りつぶす
  }
}

export async function getErrorLog(): Promise<readonly ErrorLogEntry[]> {
  return loadEntries()
}

export async function clearErrorLog(): Promise<void> {
  cache = []
  try {
    await getPlatform().storage.removeItem(STORAGE_KEY)
  } catch {
    // 消せなくても次回の保存で上書きされる
  }
}

/** ログをテキストファイルとして書き出す。ログが空なら false を返し何もしない */
export async function exportErrorLog(): Promise<boolean> {
  const entries = await loadEntries()
  if (entries.length === 0) return false
  const lines = entries.map((e) => {
    const head = `[${e.time}] ${e.source}${e.count > 1 ? ` (×${e.count})` : ''}: ${e.message}`
    return e.stack ? `${head}\n${e.stack}` : head
  })
  const blob = new Blob([lines.join('\n\n') + '\n'], { type: 'text/plain' })
  await getPlatform().file.exportBlob('ideamap-error-log.txt', blob)
  return true
}
