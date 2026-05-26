import { useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Header } from './components/common/Header'
import { IdeaCanvas } from './components/canvas/IdeaCanvas'
import { NodePanel } from './components/panels/NodePanel'
import { SettingsPanel } from './components/panels/SettingsPanel'
import { AISuggestionPanel } from './components/panels/AISuggestionPanel'
import { useSettingsStore } from './stores/settingsStore'

export default function App() {
  const loadApiKey = useSettingsStore((s) => s.loadApiKey)

  useEffect(() => {
    void loadApiKey()
  }, [loadApiKey])

  return (
    <ReactFlowProvider>
      <div className="flex flex-col w-full h-full bg-gray-50">
        <Header />
        <div className="flex flex-1 min-h-0">
          <IdeaCanvas />
          <NodePanel />
        </div>
        <SettingsPanel />
        <AISuggestionPanel />
      </div>
    </ReactFlowProvider>
  )
}
