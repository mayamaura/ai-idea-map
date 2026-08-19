import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getPlatform, type FileRef } from '@ideamap/platform'
import { useUIStore, type MapFile } from '@ideamap/core'
import { openLoadedMap, startNewMapFromTemplate, useDashboardEscapeToClose, TemplatePickerModal, DashboardShell, ResumeMapCard, DashboardActionBar } from '@ideamap/ui'
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
    // Drive 欄が加わって縦に伸びるため、カード全体をスクロールさせる（Web版は overflow-hidden）
    <DashboardShell hasActiveMap={hasActiveMap} onClose={() => setFileDashboardOpen(false)} scrollableCard>
      {autosaved && (
        <ResumeMapCard
          title={autosaved.title || '無題のマップ'}
          updatedAt={autosaved.updatedAt}
          nodeCount={autosaved.nodes.length}
          onClick={handleResumeAutosave}
        />
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

      <DashboardActionBar
        onTemplateClick={() => setShowTemplates(true)}
        onOpenClick={() => void handleOpen()}
        openDisabled={isBusy}
      />
    </DashboardShell>
  )

  return createPortal(
    <>
      {content}
      <TemplatePickerModal
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        onSelect={(id) => {
          setShowTemplates(false)
          startNewMapFromTemplate(id)
        }}
      />
    </>,
    document.body,
  )
}
