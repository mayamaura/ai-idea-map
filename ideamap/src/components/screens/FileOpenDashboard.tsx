import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useUIStore } from '../../stores/uiStore'
import { useMapStore } from '../../stores/mapStore'
import { listMaps, loadMap } from '../../services/googleDriveService'
import { saveDriveFileId, loadRecentMaps, saveRecentMap } from '../../services/storageService'
import type { DriveFile } from '../../services/googleDriveService'
import type { MapFile } from '../../types'

interface FileOpenDashboardProps {
  accessToken: string | null
  isSignedIn: boolean
  isGoogleLoading: boolean
  onGoogleSignIn: () => void
  onMapLoaded: (fileId: string) => void
}

export function FileOpenDashboard({
  accessToken,
  isSignedIn,
  isGoogleLoading,
  onGoogleSignIn,
  onMapLoaded,
}: FileOpenDashboardProps) {
  const { isFileDashboardOpen, setFileDashboardOpen, setMapTitle, setSaveStatus, addToast } = useUIStore()
  const { loadFromSerialized, reset } = useMapStore()

  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([])
  const [isDriveLoading, setIsDriveLoading] = useState(false)
  const [driveError, setDriveError] = useState<string | null>(null)
  const recentMaps = loadRecentMaps()
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isFileDashboardOpen || !accessToken) return
    setIsDriveLoading(true)
    setDriveError(null)
    listMaps(accessToken)
      .then(setDriveFiles)
      .catch(() => setDriveError('マップ一覧の取得に失敗しました'))
      .finally(() => setIsDriveLoading(false))
  }, [isFileDashboardOpen, accessToken])

  if (!isFileDashboardOpen) return null

  const handleNewMap = () => {
    reset()
    setMapTitle('新しいマップ')
    saveDriveFileId(null)
    setSaveStatus('unsaved')
    setFileDashboardOpen(false)
  }

  const handleLoadDriveFile = async (file: DriveFile) => {
    if (!accessToken) return
    setIsDriveLoading(true)
    try {
      const data = (await loadMap(accessToken, file.id)) as MapFile
      loadFromSerialized(data.nodes, data.edges)
      const title = data.title || file.name.replace(/\.json$/, '')
      setMapTitle(title)
      onMapLoaded(file.id)
      setSaveStatus('saved')
      saveRecentMap({ fileId: file.id, title, updatedAt: file.modifiedTime })
      setFileDashboardOpen(false)
    } catch {
      addToast('マップの読み込みに失敗しました', 'error')
    } finally {
      setIsDriveLoading(false)
    }
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as MapFile
        loadFromSerialized(data.nodes, data.edges)
        setMapTitle(data.title || file.name.replace(/\.json$/, ''))
        saveDriveFileId(null)
        setSaveStatus('unsaved')
        setFileDashboardOpen(false)
      } catch {
        addToast('ファイルの読み込みに失敗しました', 'error')
      }
    }
    reader.readAsText(file)
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  const content = (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gradient-to-br from-primary-50 to-violet-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* ロゴ & タイトル */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl mb-3 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="5" cy="12" r="2" strokeWidth="2" />
              <circle cx="19" cy="6" r="2" strokeWidth="2" />
              <circle cx="19" cy="18" r="2" strokeWidth="2" />
              <line x1="7" y1="12" x2="17" y2="7" strokeWidth="1.5" />
              <line x1="7" y1="12" x2="17" y2="17" strokeWidth="1.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">IdeaMap</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">どのマップを開きますか？</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[calc(90vh-180px)]">
          {/* Google Drive セクション */}
          <div className="px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Google Drive
              </h2>
              {!isSignedIn && !isGoogleLoading && (
                <button
                  onClick={onGoogleSignIn}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <GoogleIcon />
                  サインイン
                </button>
              )}
              {isGoogleLoading && (
                <span className="text-xs text-gray-400 flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                  認証中...
                </span>
              )}
            </div>

            {!isSignedIn && !isGoogleLoading && (
              <p className="text-xs text-gray-400 dark:text-gray-500 pb-2">
                サインインするとDriveのマップを開けます
              </p>
            )}

            {isSignedIn && (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {isDriveLoading && (
                  <div className="flex justify-center py-4">
                    <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {driveError && (
                  <p className="text-xs text-red-500 py-2">{driveError}</p>
                )}
                {!isDriveLoading && !driveError && driveFiles.length === 0 && (
                  <p className="text-xs text-gray-400 py-2">Driveにマップがありません</p>
                )}
                {!isDriveLoading && driveFiles.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => void handleLoadDriveFile(file)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                  >
                    <svg className="w-4 h-4 text-primary-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                        {file.name.replace(/\.json$/, '')}
                      </p>
                      <p className="text-xs text-gray-400">{formatDate(file.modifiedTime)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 最近使ったマップ */}
          {recentMaps.length > 0 && isSignedIn && (
            <div className="px-6 pt-4 pb-3 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                最近使ったマップ
              </h2>
              <div className="space-y-1">
                {recentMaps.map((m) => {
                  const driveFile = driveFiles.find((f) => f.id === m.fileId)
                  if (!driveFile) return null
                  return (
                    <button
                      key={m.fileId}
                      onClick={() => void handleLoadDriveFile(driveFile)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                    >
                      <svg className="w-4 h-4 text-violet-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{m.title}</p>
                        <p className="text-xs text-gray-400">{formatDate(m.updatedAt)}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* アクションボタン */}
          <div className="px-6 py-4 flex gap-3">
            <button
              onClick={handleNewMap}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              新規作成
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              ファイルを開く
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportFile}
            />
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}

function GoogleIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
