import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { useUIStore } from '@ideamap/core'
import { getPlatform } from '@ideamap/platform'
import { openMapFile } from '../openMap'

/**
 * エクスプローラ／Finder からのファイルドロップ受け入れ。
 *
 * ウィンドウの dragDropEnabled は true にしてある。React Flow のノード操作は
 * HTML5 の drag&drop ではなくポインタイベント（d3-drag）で実装されているため、
 * OS レベルのファイルドロップを有効にしてもキャンバス操作とは競合しない。
 */

const MAP_EXTENSIONS = ['.ideamap', '.json']

export function FileDropOverlay() {
  const [isOver, setIsOver] = useState(false)

  useEffect(() => {
    const unlisten = getCurrentWebview().onDragDropEvent((event) => {
      const payload = event.payload
      if (payload.type === 'enter' || payload.type === 'over') {
        setIsOver(true)
        return
      }
      setIsOver(false)
      if (payload.type === 'drop') void handleDrop(payload.paths)
    })
    return () => {
      void unlisten.then((off) => off())
    }
  }, [])

  if (!isOver) return null

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-primary-900/40 backdrop-blur-sm pointer-events-none">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl px-8 py-6 border-2 border-dashed border-primary-400 text-center">
        <svg className="w-10 h-10 mx-auto text-primary-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">ドロップしてマップを開く</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">.ideamap / .json ファイル</p>
      </div>
    </div>,
    document.body
  )
}

async function handleDrop(paths: string[]): Promise<void> {
  const ui = useUIStore.getState()
  const path = paths.find((p) => MAP_EXTENSIONS.some((ext) => p.toLowerCase().endsWith(ext)))
  if (!path) {
    ui.addToast('.ideamap または .json ファイルをドロップしてください', 'error')
    return
  }

  const ref = { id: path, name: baseName(path), origin: getPlatform().file.origin, updatedAt: '' }
  // 保存前の変更を黙って捨てないよう、開く前に確認する
  if (ui.saveStatus === 'unsaved' || ui.saveStatus === 'saving' || ui.saveStatus === 'error') {
    ui.openConfirmDialog({
      title: 'マップを開く',
      message: `保存されていない変更があります。「${ref.name}」を開くと、この画面の変更は失われます。`,
      confirmLabel: '開く',
      danger: true,
      onConfirm: () => void openMapFile(ref),
    })
    return
  }
  await openMapFile(ref)
}

function baseName(path: string): string {
  const segments = path.split(/[\\/]/)
  return segments[segments.length - 1] || path
}
