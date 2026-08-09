import { useCallback, useEffect, useState } from 'react'
import type { FileRef } from '@ideamap/platform'
import { listMaps, useUIStore, type DriveFile } from '@ideamap/core'
import { openMapFile } from '../openMap'
import { saveCurrentMapToDrive } from '../saveToDrive'
import type { useDesktopGoogleAuth } from '../hooks/useDesktopGoogleAuth'

/**
 * 起動画面の Google ドライブ欄。Web版で作ったマップをデスクトップ版から直接開き、
 * ローカルで作ったマップを Drive へ上げるための導線（docs/desktop/README.md §3.1）。
 *
 * ローカルファイルが既定の保存先である点は変えず、Drive は「もう一つの保存先」として並べる。
 * 開いたあとの自動保存が Drive へ向くかどうかは FileRef.origin が決める。
 */

interface DriveSectionProps {
  auth: ReturnType<typeof useDesktopGoogleAuth>
  onBusyChange: (busy: boolean) => void
}

function toDriveRef(file: DriveFile): FileRef {
  return {
    id: file.id,
    name: file.name.replace(/\.json$/, ''),
    origin: 'cloud',
    updatedAt: file.modifiedTime,
  }
}

export function DriveSection({ auth, onBusyChange }: DriveSectionProps) {
  const { isSignedIn, accessToken, isLoading, error, userEmail, clientIdMissing, signIn, signOut } = auth
  const hasActiveMap = useUIStore((s) => s.hasActiveMap)

  // 一覧は取得元のトークンとセットで持つ。アカウントを切り替えた直後に
  // 前のアカウントの一覧が残って見えるのを防ぐ
  const [loaded, setLoaded] = useState<{ token: string; files: DriveFile[] } | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const files = loaded?.token === accessToken ? loaded.files : []

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    void listMaps(accessToken)
      .then((list) => {
        if (cancelled) return
        setLoaded({ token: accessToken, files: list })
        setListError(null)
      })
      .catch(() => {
        if (!cancelled) setListError('ドライブのマップ一覧を取得できませんでした')
      })
    return () => {
      cancelled = true
    }
  }, [accessToken])

  const runBusy = useCallback(
    async (task: () => Promise<void>) => {
      if (isBusy) return
      setIsBusy(true)
      onBusyChange(true)
      try {
        await task()
      } finally {
        setIsBusy(false)
        onBusyChange(false)
      }
    },
    [isBusy, onBusyChange]
  )

  const handleOpen = (file: DriveFile) =>
    void runBusy(async () => {
      await openMapFile(toDriveRef(file))
    })

  /** いま開いているマップを Drive へ新規保存し、以後の自動保存も Drive へ向ける */
  const handleUpload = () =>
    void runBusy(async () => {
      if (!accessToken) return
      if (!(await saveCurrentMapToDrive(accessToken))) return
      setLoaded({ token: accessToken, files: await listMaps(accessToken) })
    })

  const formatDate = (iso: string) =>
    iso
      ? new Date(iso).toLocaleDateString('ja-JP', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : ''

  return (
    <div className="px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
          </svg>
          Googleドライブ
        </h2>
        {isSignedIn && (
          <button
            onClick={signOut}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            切断
          </button>
        )}
      </div>

      {clientIdMissing ? (
        <p className="text-xs text-gray-400 py-2">
          Googleドライブ連携は未設定です。`apps/desktop/.env` に `VITE_GOOGLE_DESKTOP_CLIENT_ID` を設定すると使えます。
        </p>
      ) : !isSignedIn ? (
        <div className="py-1">
          <button
            onClick={signIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-2 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'ブラウザで認証中…' : 'Googleドライブに接続'}
          </button>
          <p className="text-xs text-gray-400 mt-2">
            接続すると、Web版で作ったマップをそのまま開けます。認証はOS既定のブラウザで行われます。
          </p>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>
      ) : (
        <div>
          {userEmail && <p className="text-xs text-gray-400 mb-2 truncate">{userEmail}</p>}
          {listError && <p className="text-xs text-red-500 py-1">{listError}</p>}
          {!listError && files.length === 0 && (
            <p className="text-xs text-gray-400 py-2">ドライブにマップがまだありません。</p>
          )}
          {files.length > 0 && (
            <div className="space-y-1 max-h-44 overflow-y-auto">
              {files.map((file) => (
                <button
                  key={file.id}
                  onClick={() => handleOpen(file)}
                  disabled={isBusy}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left disabled:opacity-50"
                >
                  <svg className="w-4 h-4 text-primary-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
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
          {hasActiveMap && (
            <button
              onClick={handleUpload}
              disabled={isBusy}
              className="mt-2 w-full py-2 text-xs font-medium text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors disabled:opacity-50"
            >
              いま開いているマップをドライブに保存
            </button>
          )}
        </div>
      )}
    </div>
  )
}
