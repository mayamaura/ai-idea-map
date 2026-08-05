import type { MapFile } from '@ideamap/core'

// 共有URL は「ブラウザのURLバーでマップを受け渡す」Web版専用の機能。
// デスクトップに対応する概念がないため apps/web に閉じ込める（architecture.md §1.2）。

// base64エンコード後のURL文字数がこれを超えると警告（ブラウザURL制限を考慮）
const URL_SIZE_WARNING = 50000

// 共有URL生成
export function generateShareUrl(mapFile: MapFile): { url: string; tooLarge: boolean } {
  const json = JSON.stringify(mapFile)
  const encoded = btoa(unescape(encodeURIComponent(json)))
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('map', encoded)
  return { url: url.toString(), tooLarge: encoded.length > URL_SIZE_WARNING }
}

// URLからマップデータを解析
export function parseMapFromUrl(): MapFile | null {
  try {
    const params = new URLSearchParams(window.location.search)
    const encoded = params.get('map')
    if (!encoded) return null
    const json = decodeURIComponent(escape(atob(encoded)))
    const data = JSON.parse(json) as MapFile
    if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) return null
    return data
  } catch {
    return null
  }
}

// URLの map パラメーターをクリア（インポート後）
export function clearMapFromUrl(): void {
  const url = new URL(window.location.href)
  url.searchParams.delete('map')
  window.history.replaceState({}, '', url.toString())
}
