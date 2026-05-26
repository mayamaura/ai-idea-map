import { ReactFlowProvider } from '@xyflow/react'
import { Header } from './components/common/Header'
import { IdeaCanvas } from './components/canvas/IdeaCanvas'
import { SettingsPanel } from './components/panels/SettingsPanel'
import { AISuggestionPanel } from './components/panels/AISuggestionPanel'

export default function App() {
  return (
    <ReactFlowProvider>
      <div className="flex flex-col w-full h-full bg-gray-50">
        <Header />
        <IdeaCanvas />
        <SettingsPanel />
        <AISuggestionPanel />
      </div>
    </ReactFlowProvider>
  )
}
