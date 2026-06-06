import { useEffect, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Header } from './components/common/Header'
import { IdeaCanvas } from './components/canvas/IdeaCanvas'
import { NodePanel } from './components/panels/NodePanel'
import { SettingsPanel } from './components/panels/SettingsPanel'
import { AISuggestionPanel } from './components/panels/AISuggestionPanel'
import { MapListPanel } from './components/panels/MapListPanel'
import { NodeDetailPanel } from './components/panels/NodeDetailPanel'
import { ExportImportPanel } from './components/panels/ExportImportPanel'
import { MapAnalysisPanel } from './components/panels/MapAnalysisPanel'
import { FileOpenDashboard } from './components/screens/FileOpenDashboard'
import { ToastContainer } from './components/common/Toast'
import { ContextMenu } from './components/canvas/ContextMenu'
import { ConfirmDialog } from './components/common/ConfirmDialog'
import { WelcomeModal } from './components/common/WelcomeModal'
import { SearchBar } from './components/common/SearchBar'
import { KeyboardShortcutsModal } from './components/common/KeyboardShortcutsModal'
import { useSettingsStore } from './stores/settingsStore'
import { useUIStore } from './stores/uiStore'
import { useMapStore } from './stores/mapStore'
import { useGoogleAuth } from './hooks/useGoogleAuth'
import { useAutoSave } from './hooks/useAutoSave'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { parseMapFromUrl, clearMapFromUrl } from './services/exportService'

const WELCOME_KEY = 'ideamap-welcomed'

function AppInner() {
  useKeyboardShortcuts()

  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem(WELCOME_KEY))
  const { loadApiKey, theme } = useSettingsStore()
  const { addToast, setMapTitle, setCurrentFileId, openConfirmDialog, isFileDashboardOpen } = useUIStore()
  const { loadFromSerialized } = useMapStore()
  const googleAuth = useGoogleAuth()
  useAutoSave(googleAuth.accessToken)

  useEffect(() => {
    if (googleAuth.error) {
      addToast(googleAuth.error, 'error')
    }
  }, [googleAuth.error, addToast])

  useEffect(() => {
    void loadApiKey()
  }, [loadApiKey])

  // 共有URL からマップをインポート
  useEffect(() => {
    const mapData = parseMapFromUrl()
    if (!mapData) return
    clearMapFromUrl()
    openConfirmDialog({
      title: '共有マップのインポート',
      message: `「${mapData.title}」が共有URLから見つかりました。インポートしますか？現在のマップは置き換えられます。`,
      confirmLabel: 'インポート',
      onConfirm: () => {
        loadFromSerialized(mapData.nodes, mapData.edges)
        setMapTitle(mapData.title)
        // 共有URL からのインポートは新規マップ扱い。前のマップの fileId を引き継いで上書きしない
        setCurrentFileId(null)
        addToast(`「${mapData.title}」をインポートしました`, 'success')
      },
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Apply dark/light theme to <html>
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  return (
    <div className="flex flex-col w-full h-full bg-gray-50 dark:bg-gray-900">
      <Header
        isSignedIn={googleAuth.isSignedIn}
        isGoogleLoading={googleAuth.isLoading}
        clientIdMissing={googleAuth.clientIdMissing}
        onGoogleSignIn={googleAuth.signIn}
        onGoogleSignOut={googleAuth.signOut}
      />
      <div className="flex flex-1 min-h-0">
        <IdeaCanvas />
        <NodePanel />
      </div>
      <SettingsPanel accessToken={googleAuth.accessToken} />
      <AISuggestionPanel />
      <MapListPanel accessToken={googleAuth.accessToken} />
      <NodeDetailPanel />
      <ExportImportPanel />
      <MapAnalysisPanel />
      <ToastContainer />
      <ContextMenu />
      <ConfirmDialog />
      <SearchBar />
      <KeyboardShortcutsModal />
      {isFileDashboardOpen && (
        <FileOpenDashboard
          accessToken={googleAuth.accessToken}
          isSignedIn={googleAuth.isSignedIn}
          isGoogleLoading={googleAuth.isLoading}
          onGoogleSignIn={googleAuth.signIn}
        />
      )}
      {showWelcome && !isFileDashboardOpen && (
        <WelcomeModal
          onClose={() => {
            setShowWelcome(false)
            localStorage.setItem(WELCOME_KEY, '1')
          }}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <ReactFlowProvider>
      <AppInner />
    </ReactFlowProvider>
  )
}
