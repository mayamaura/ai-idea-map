import { useEffect, useCallback, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Header } from './components/common/Header'
import { IdeaCanvas } from './components/canvas/IdeaCanvas'
import { NodePanel } from './components/panels/NodePanel'
import { SettingsPanel } from './components/panels/SettingsPanel'
import { AISuggestionPanel } from './components/panels/AISuggestionPanel'
import { MapListPanel } from './components/panels/MapListPanel'
import { NodeDetailPanel } from './components/panels/NodeDetailPanel'
import { ToastContainer } from './components/common/Toast'
import { ContextMenu } from './components/canvas/ContextMenu'
import { ConfirmDialog } from './components/common/ConfirmDialog'
import { WelcomeModal } from './components/common/WelcomeModal'
import { useSettingsStore } from './stores/settingsStore'
import { useUIStore } from './stores/uiStore'
import { useGoogleAuth } from './hooks/useGoogleAuth'
import { useAutoSave } from './hooks/useAutoSave'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

const WELCOME_KEY = 'ideamap-welcomed'

function AppInner() {
  useKeyboardShortcuts()

  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem(WELCOME_KEY))
  const { loadApiKey, theme } = useSettingsStore()
  const { addToast } = useUIStore()
  const googleAuth = useGoogleAuth()
  const { setFileId } = useAutoSave(googleAuth.accessToken)

  useEffect(() => {
    if (googleAuth.error) {
      addToast(googleAuth.error, 'error')
    }
  }, [googleAuth.error, addToast])

  useEffect(() => {
    void loadApiKey()
  }, [loadApiKey])

  // Apply dark/light theme to <html>
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  const handleMapLoaded = useCallback(
    (fileId: string) => {
      setFileId(fileId)
    },
    [setFileId]
  )

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
      <SettingsPanel />
      <AISuggestionPanel />
      <MapListPanel
        accessToken={googleAuth.accessToken}
        onMapLoaded={handleMapLoaded}
      />
      <NodeDetailPanel />
      <ToastContainer />
      <ContextMenu />
      <ConfirmDialog />
      {showWelcome && (
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
