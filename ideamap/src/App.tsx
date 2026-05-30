import { useEffect, useCallback } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Header } from './components/common/Header'
import { IdeaCanvas } from './components/canvas/IdeaCanvas'
import { NodePanel } from './components/panels/NodePanel'
import { SettingsPanel } from './components/panels/SettingsPanel'
import { AISuggestionPanel } from './components/panels/AISuggestionPanel'
import { MapListPanel } from './components/panels/MapListPanel'
import { ToastContainer } from './components/common/Toast'
import { useSettingsStore } from './stores/settingsStore'
import { useGoogleAuth } from './hooks/useGoogleAuth'
import { useAutoSave } from './hooks/useAutoSave'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

function AppInner() {
  useKeyboardShortcuts()

  const { loadApiKey, theme } = useSettingsStore()
  const googleAuth = useGoogleAuth()
  const { setFileId } = useAutoSave(googleAuth.accessToken)

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
      <ToastContainer />
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
