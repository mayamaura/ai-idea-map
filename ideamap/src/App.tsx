import { useEffect, useCallback } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Header } from './components/common/Header'
import { IdeaCanvas } from './components/canvas/IdeaCanvas'
import { NodePanel } from './components/panels/NodePanel'
import { SettingsPanel } from './components/panels/SettingsPanel'
import { AISuggestionPanel } from './components/panels/AISuggestionPanel'
import { MapListPanel } from './components/panels/MapListPanel'
import { useSettingsStore } from './stores/settingsStore'
import { useGoogleAuth } from './hooks/useGoogleAuth'
import { useAutoSave } from './hooks/useAutoSave'

export default function App() {
  const { loadApiKey, googleClientId } = useSettingsStore()
  const googleAuth = useGoogleAuth(googleClientId)
  const { setFileId } = useAutoSave(googleAuth.accessToken)

  useEffect(() => {
    void loadApiKey()
  }, [loadApiKey])

  const handleMapLoaded = useCallback(
    (fileId: string) => {
      setFileId(fileId)
    },
    [setFileId]
  )

  return (
    <ReactFlowProvider>
      <div className="flex flex-col w-full h-full bg-gray-50">
        <Header
          isSignedIn={googleAuth.isSignedIn}
          isGoogleLoading={googleAuth.isLoading}
          hasGoogleClientId={!!googleClientId}
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
      </div>
    </ReactFlowProvider>
  )
}
