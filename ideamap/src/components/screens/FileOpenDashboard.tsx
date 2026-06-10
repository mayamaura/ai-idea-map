import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { v4 as uuidv4 } from 'uuid'
import { useUIStore } from '../../stores/uiStore'
import { useMapStore } from '../../stores/mapStore'
import { listMaps, loadMap, deleteMap, saveMap } from '../../services/googleDriveService'
import { loadRecentMaps, saveRecentMap, loadMapLocally } from '../../services/storageService'
import type { DriveFile } from '../../services/googleDriveService'
import type { MapFile } from '../../types'

interface FileOpenDashboardProps {
  accessToken: string | null
  isSignedIn: boolean
  isGoogleLoading: boolean
  onGoogleSignIn: () => void
}

export function FileOpenDashboard({
  accessToken,
  isSignedIn,
  isGoogleLoading,
  onGoogleSignIn,
}: FileOpenDashboardProps) {
  const { isFileDashboardOpen, setFileDashboardOpen, setMapTitle, setSaveStatus, setCurrentFileId, setCurrentMapId, setPresentationNodeIds, openConfirmDialog, hasActiveMap, addToast } = useUIStore()
  const { loadFromSerialized, reset } = useMapStore()

  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([])
  const [isDriveLoading, setIsDriveLoading] = useState(false)
  const [driveError, setDriveError] = useState<string | null>(null)
  const [filterText, setFilterText] = useState('')
  const [busyFileId, setBusyFileId] = useState<string | null>(null)
  const recentMaps = loadRecentMaps()
  const localMap = loadMapLocally()
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

  // マップを開いた後の再表示時のみ Esc で閉じられる（初回起動時は閉じる先がない）
  useEffect(() => {
    if (!isFileDashboardOpen || !hasActiveMap) return
    const onKey = (e: KeyboardEvent) => {
      // 削除確認ダイアログ表示中はそちらの Esc を優先
      if (e.key === 'Escape' && !useUIStore.getState().confirmDialog) {
        setFileDashboardOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isFileDashboardOpen, hasActiveMap, setFileDashboardOpen])

  if (!isFileDashboardOpen) return null

  const handleNewMap = () => {
    reset()
    setMapTitle('新しいマップ')
    setCurrentFileId(null)
    setCurrentMapId(null)
    setPresentationNodeIds([])
    setSaveStatus('unsaved')
    setFileDashboardOpen(false)
  }

  const handleResumeLocal = () => {
    if (!localMap) return
    loadFromSerialized(localMap.nodes, localMap.edges)
    setMapTitle(localMap.title || '無題のマップ')
    setCurrentMapId(localMap.mapId ?? null)
    setPresentationNodeIds(localMap.presentationNodeIds ?? [])
    setSaveStatus('saved')
    // currentFileId は localStorage から復元済みのため触らない（同じ Drive ファイルへの保存を継続）
    setFileDashboardOpen(false)
  }

  const handleLoadDriveFile = async (file: DriveFile) => {
    if (!accessToken) return
    setIsDriveLoading(true)
    try {
      const data = (await loadMap(accessToken, file.id)) as MapFile & { mapId?: string }
      loadFromSerialized(data.nodes, data.edges)
      const title = data.title || file.name.replace(/\.json$/, '')
      setMapTitle(title)
      setCurrentFileId(file.id)
      setCurrentMapId(data.mapId ?? null)
      setPresentationNodeIds(data.presentationNodeIds ?? [])
      setSaveStatus('saved')
      saveRecentMap({ fileId: file.id, title, updatedAt: file.modifiedTime })
      setFileDashboardOpen(false)
    } catch {
      addToast('マップの読み込みに失敗しました', 'error')
    } finally {
      setIsDriveLoading(false)
    }
  }

  const handleDeleteFile = (file: DriveFile, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!accessToken) return
    openConfirmDialog({
      title: 'マップを削除',
      message: `「${file.name.replace(/\.json$/, '')}」を Google Drive から削除しますか？この操作は取り消せません。`,
      confirmLabel: '削除',
      danger: true,
      onConfirm: () => {
        void (async () => {
          try {
            await deleteMap(accessToken, file.id)
            // 開いているマップを消した場合は、自動保存が消えたファイルへ PATCH しないようにクリア
            if (useUIStore.getState().currentFileId === file.id) {
              setCurrentFileId(null)
              setCurrentMapId(null)
            }
            setDriveFiles((prev) => prev.filter((f) => f.id !== file.id))
            addToast('マップを削除しました', 'success')
          } catch {
            addToast('マップの削除に失敗しました', 'error')
          }
        })()
      },
    })
  }

  const handleDuplicateFile = async (file: DriveFile, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!accessToken || busyFileId) return
    setBusyFileId(file.id)
    try {
      const data = (await loadMap(accessToken, file.id)) as MapFile
      const baseTitle = `${data.title || file.name.replace(/\.json$/, '')} のコピー`
      // 同名ファイルがあると saveMap が PATCH 上書きするため、名前を一意にする
      const names = new Set(driveFiles.map((f) => f.name.replace(/\.json$/, '')))
      let newTitle = baseTitle
      for (let i = 2; names.has(newTitle); i++) newTitle = `${baseTitle} (${i})`
      const newMapId = uuidv4()
      const copy: MapFile = {
        ...data,
        mapId: newMapId,
        title: newTitle,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await saveMap(accessToken, newTitle, copy, null, newMapId)
      setDriveFiles(await listMaps(accessToken))
      addToast(`「${newTitle}」を作成しました`, 'success')
    } catch {
      addToast('マップの複製に失敗しました', 'error')
    } finally {
      setBusyFileId(null)
    }
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as MapFile & { mapId?: string }
        loadFromSerialized(data.nodes, data.edges)
        setMapTitle(data.title || file.name.replace(/\.json$/, ''))
        setCurrentFileId(null)
        setCurrentMapId(data.mapId ?? null)
        setPresentationNodeIds(data.presentationNodeIds ?? [])
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

  const visibleFiles = filterText.trim()
    ? driveFiles.filter((f) => f.name.toLowerCase().includes(filterText.trim().toLowerCase()))
    : driveFiles

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
        {/* ロゴ & タイトル */}
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

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[calc(90vh-180px)]">
          {/* 前回の作業を再開（サインイン状態・オンライン状態に関係なく表示） */}
          {localMap && (
            <div className="px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                前回の作業を再開
              </h2>
              <button
                onClick={handleResumeLocal}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50/60 dark:bg-primary-900/20 hover:bg-primary-50 dark:hover:bg-primary-900/40 transition-colors text-left"
              >
                <svg className="w-5 h-5 text-primary-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                    {localMap.title || '無題のマップ'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {localMap.updatedAt ? formatDate(localMap.updatedAt) : ''} · ノード {localMap.nodes.length} 件
                  </p>
                </div>
              </button>
            </div>
          )}

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
              <>
                {driveFiles.length > 8 && (
                  <input
                    type="text"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    placeholder="マップ名で絞り込み"
                    className="w-full mb-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:bg-gray-700 dark:text-gray-100 placeholder-gray-400"
                  />
                )}
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
                  {!isDriveLoading && !driveError && driveFiles.length > 0 && visibleFiles.length === 0 && (
                    <p className="text-xs text-gray-400 py-2">「{filterText}」に一致するマップがありません</p>
                  )}
                  {!isDriveLoading && visibleFiles.map((file) => (
                    <div
                      key={file.id}
                      onClick={() => void handleLoadDriveFile(file)}
                      className="group w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left cursor-pointer"
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
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={(e) => void handleDuplicateFile(file, e)}
                          disabled={busyFileId !== null}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors disabled:opacity-40"
                          title="複製"
                        >
                          {busyFileId === file.id ? (
                            <div className="w-4 h-4 border border-primary-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={(e) => handleDeleteFile(file, e)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                          title="削除"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
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
