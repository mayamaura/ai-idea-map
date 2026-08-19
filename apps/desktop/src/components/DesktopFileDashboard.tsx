import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getPlatform, type FileRef } from '@ideamap/platform'
import { useUIStore, type MapFile } from '@ideamap/core'
import { openLoadedMap, startNewMap, startNewMapFromTemplate, useDashboardEscapeToClose, TemplatePickerModal, formatMapDate } from '@ideamap/ui'
import { loadLastAutosave } from '../platform'
import { openMapFile } from '../openMap'
import { DriveSection } from './DriveSection'
import type { useDesktopGoogleAuth } from '../hooks/useDesktopGoogleAuth'

/**
 * デスクトップ版の起動画面。Web版の FileOpenDashboard に相当するが、
 * 既定の保存先がローカルファイルなので中身は別物になる
 * （ネイティブの「開く」ダイアログ・パスベースの最近使ったファイル・自動保存からの復旧）。
 *
 * Phase 38 以降は Google ドライブ欄も並ぶ。ローカルとドライブのどちらから開いたかは
 * FileRef.origin として記録され、以後の自動保存の向き先になる。
 */
interface DesktopFileDashboardProps {
  cloudAuth: ReturnType<typeof useDesktopGoogleAuth>
}

export function DesktopFileDashboard({ cloudAuth }: DesktopFileDashboardProps) {
  const { isFileDashboardOpen, setFileDashboardOpen, hasActiveMap } = useUIStore()

  const [recent, setRecent] = useState<{ ref: FileRef; title: string }[]>([])
  const [autosaved, setAutosaved] = useState<MapFile | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

  useEffect(() => {
    if (!isFileDashboardOpen) return
    const file = getPlatform().file
    void file.listRecent().then(setRecent)
    void loadLastAutosave().then((content) => setAutosaved((content as MapFile | null) ?? null))
  }, [isFileDashboardOpen])

  useDashboardEscapeToClose()

  if (!isFileDashboardOpen) return null

  const handleOpen = async (ref?: FileRef) => {
    if (isBusy) return
    setIsBusy(true)
    try {
      await openMapFile(ref)
    } finally {
      setIsBusy(false)
    }
  }

  const handleResumeAutosave = () => {
    if (!autosaved) return
    // 自動保存は「まだ名前を付けていないマップ」の控えなので保存先は未確定のまま復帰する
    openLoadedMap(autosaved, null, '無題のマップ')
  }

  const content = (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gradient-to-br from-primary-50 to-violet-50 dark:from-gray-900 dark:to-gray-800 p-4">
      {hasActiveMap && (
        <button
          onClick={() => setFileDashboardOpen(false)}
          className="absolute top-4 right-4 p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-700 transition-colors"
          title="キャンバスに戻る (Esc)"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl mb-3 shadow-lg">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24">
              <line x1="5" y1="11" x2="12" y2="3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="12" y1="3" x2="19" y2="11" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="5" y1="11" x2="12" y2="15" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="19" y1="11" x2="12" y2="15" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="12" y1="15" x2="12" y2="19" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="8" y1="19" x2="16" y2="19" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="9" y1="22" x2="15" y2="22" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="12" cy="3" r="1.5" fill="white" />
              <circle cx="5" cy="11" r="1.5" fill="white" />
              <circle cx="19" cy="11" r="1.5" fill="white" />
              <circle cx="12" cy="15" r="2" fill="white" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">IdeaMap</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">どのマップを開きますか？</p>
        </div>

        {/* Drive 欄が加わって縦に伸びるため、カード全体をスクロールさせる */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-y-auto flex flex-col max-h-[calc(90vh-180px)]">
          {autosaved && (
            <div className="px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                前回の作業を再開
              </h2>
              <button
                onClick={handleResumeAutosave}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50/60 dark:bg-primary-900/20 hover:bg-primary-50 dark:hover:bg-primary-900/40 transition-colors text-left"
              >
                <svg className="w-5 h-5 text-primary-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                    {autosaved.title || '無題のマップ'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {autosaved.updatedAt ? formatMapDate(autosaved.updatedAt) : ''} · ノード {autosaved.nodes.length} 件
                  </p>
                </div>
              </button>
            </div>
          )}

          <DriveSection auth={cloudAuth} onBusyChange={setIsBusy} />

          <div className="px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              最近開いたファイル
            </h2>
            {recent.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">
                まだファイルを開いていません。「ファイルを開く」から `.ideamap` を選ぶか、新規作成してください。
              </p>
            ) : (
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {recent.map((entry) => (
                  <button
                    key={entry.ref.id}
                    onClick={() => void handleOpen(entry.ref)}
                    disabled={isBusy}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left disabled:opacity-50"
                  >
                    <svg className="w-4 h-4 text-primary-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{entry.title}</p>
                      <p className="text-xs text-gray-400 truncate" title={entry.ref.id}>{entry.ref.id}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="px-6 py-4 flex gap-3">
            <button
              onClick={startNewMap}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              新規作成
            </button>
            <button
              onClick={() => setShowTemplates(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              テンプレート
            </button>
            <button
              onClick={() => void handleOpen()}
              disabled={isBusy}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              ファイルを開く
            </button>
          </div>
        </div>
      </div>
      <TemplatePickerModal
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        onSelect={(id) => {
          setShowTemplates(false)
          startNewMapFromTemplate(id)
        }}
      />
    </div>
  )

  return createPortal(content, document.body)
}
