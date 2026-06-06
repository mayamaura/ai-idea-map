import { useState, useEffect } from 'react'
import { useUIStore } from '../../stores/uiStore'
import { useMapStore } from '../../stores/mapStore'
import { listMaps, loadMap, deleteMap } from '../../services/googleDriveService'
import type { DriveFile } from '../../services/googleDriveService'
import type { MapFile } from '../../types'

interface MapListPanelProps {
  accessToken: string | null
}

export function MapListPanel({ accessToken }: MapListPanelProps) {
  const { isMapListOpen, setMapListOpen, setMapTitle, setSaveStatus, setCurrentFileId } = useUIStore()
  const { loadFromSerialized, reset } = useMapStore()

  const [files, setFiles] = useState<DriveFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isMapListOpen || !accessToken) return
    setIsLoading(true)
    setError(null)
    listMaps(accessToken)
      .then(setFiles)
      .catch(() => setError('マップ一覧の取得に失敗しました'))
      .finally(() => setIsLoading(false))
  }, [isMapListOpen, accessToken])

  if (!isMapListOpen) return null

  const handleNewMap = () => {
    reset()
    setMapTitle('新しいマップ')
    setCurrentFileId(null)
    setSaveStatus('unsaved')
    setMapListOpen(false)
  }

  const handleLoad = async (file: DriveFile) => {
    if (!accessToken) return
    setIsLoading(true)
    try {
      const data = (await loadMap(accessToken, file.id)) as MapFile
      loadFromSerialized(data.nodes, data.edges)
      setMapTitle(data.title || file.name.replace(/\.json$/, ''))
      setCurrentFileId(file.id)
      setSaveStatus('saved')
      setMapListOpen(false)
    } catch {
      setError('マップの読み込みに失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (file: DriveFile, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!accessToken) return
    if (!window.confirm(`「${file.name.replace(/\.json$/, '')}」を削除しますか？`)) return
    try {
      await deleteMap(accessToken, file.id)
      setFiles((prev) => prev.filter((f) => f.id !== file.id))
    } catch {
      setError('削除に失敗しました')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6.5 0h11l3.5 3.5v16.5a1 1 0 01-1 1h-13a1 1 0 01-1-1v-19a1 1 0 011-1zm10.5 1.5v3h3l-3-3z" opacity=".3"/>
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 4h6v6h6v10H6V4z"/>
            </svg>
            <h2 className="text-lg font-semibold text-gray-800">マップ一覧</h2>
          </div>
          <button
            onClick={() => setMapListOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading && (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 mb-3">
              {error}
            </div>
          )}

          {!isLoading && !error && files.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-10">
              Googleドライブに保存されたマップはありません
            </p>
          )}

          {!isLoading && (
            <div className="space-y-2">
              {files.map((file) => (
                <button
                  key={file.id}
                  onClick={() => void handleLoad(file)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">
                        {file.name.replace(/\.json$/, '')}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(file.modifiedTime).toLocaleDateString('ja-JP', {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => void handleDelete(file, e)}
                    className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0 ml-2"
                    title="削除"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-6 py-4 border-t border-gray-100">
          <button
            onClick={handleNewMap}
            className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新しいマップを作成
          </button>
        </div>
      </div>
    </div>
  )
}
