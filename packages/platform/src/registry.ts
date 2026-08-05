import type { Platform } from './types'

let currentPlatform: Platform | null = null

/** 各アプリの main.tsx で、React のレンダー開始前に1度だけ呼び出す */
export function setPlatform(platform: Platform): void {
  currentPlatform = platform
}

/**
 * 注入済みの Platform を取得する。
 *
 * モジュールのトップレベルではなく、必ず関数の内部（ストアのアクション・
 * イベントハンドラ・useEffect）から呼ぶこと。トップレベルで呼ぶと
 * main.tsx の setPlatform() より先に評価されて throw する。
 */
export function getPlatform(): Platform {
  if (!currentPlatform) {
    throw new Error(
      'Platform が未初期化です。apps/*/src/main.tsx で setPlatform() を呼び出してください'
    )
  }
  return currentPlatform
}

/** テスト用。注入済み Platform を破棄する */
export function resetPlatform(): void {
  currentPlatform = null
}
