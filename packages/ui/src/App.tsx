import { useEffect, useState, type ReactNode } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { getPlatform } from '@ideamap/platform'
import { useSettingsStore, useUIStore } from '@ideamap/core'
import { Header } from './components/common/Header'
import { IdeaCanvas } from './components/canvas/IdeaCanvas'
import { NodePanel } from './components/panels/NodePanel'
import { SettingsPanel } from './components/panels/SettingsPanel'
import { AISuggestionPanel } from './components/panels/AISuggestionPanel'
import { PersonaDebatePanel } from './components/panels/PersonaDebatePanel'
import { NodeDetailPanel } from './components/panels/NodeDetailPanel'
import { ExportImportPanel, type ExportImportPanelProps } from './components/panels/ExportImportPanel'
import { MapAnalysisPanel } from './components/panels/MapAnalysisPanel'
import { AIChatPanel } from './components/panels/AIChatPanel'
import { ArtifactPanel } from './components/panels/ArtifactPanel'
import { HistoryPanel } from './components/panels/HistoryPanel'
import { PresentationMode } from './components/screens/PresentationMode'
import { ToastContainer } from './components/common/Toast'
import { ContextMenu } from './components/canvas/ContextMenu'
import { ConfirmDialog } from './components/common/ConfirmDialog'
import { InputDialog } from './components/common/InputDialog'
import { WelcomeModal } from './components/common/WelcomeModal'
import { MasterPasswordModal } from './components/common/MasterPasswordModal'
import { SearchBar } from './components/common/SearchBar'
import { KeyboardShortcutsModal } from './components/common/KeyboardShortcutsModal'
import { PresentationOrderPanel } from './components/panels/PresentationOrderPanel'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useAutoSave, type AutoSaveOptions } from './hooks/useAutoSave'
import { useGlobalErrorLog } from './hooks/useGlobalErrorLog'

const WELCOME_KEY = 'ideamap-welcomed'

/** クラウド認証の状態。Web版は useGoogleAuth の戻り値をそのまま渡せる形にしてある */
export interface AppCloudAuth {
  isSignedIn: boolean
  isLoading: boolean
  clientIdMissing: boolean
  userEmail: string | null
  accessToken: string | null
  error: string | null
  signIn: () => void
  signOut: () => void
}

export interface AppProps {
  /**
   * クラウド認証の状態（Web版の Google Drive）。
   * 未指定のプラットフォーム（デスクトップ版）ではクラウド関連UIを描画しない。
   */
  cloudAuth?: AppCloudAuth
  /** 自動保存の挙動。保存失敗時のハンドリングをプラットフォーム側から注入する */
  autoSave?: AutoSaveOptions
  /** クラウドのマップ一覧パネル（Web版のみ） */
  mapListSlot?: ReactNode
  /** 起動時のファイル選択ダッシュボード。isFileDashboardOpen が true のときだけ描画する */
  dashboardSlot?: ReactNode
  /** 共有URL生成（Web版のみ）。未指定なら共有タブは代替手段の案内になる */
  onGenerateShareUrl?: ExportImportPanelProps['onGenerateShareUrl']
  /** 設定パネル末尾に足すプラットフォーム固有セクション（デスクトップ版の自動更新など） */
  settingsExtraSections?: ReactNode
  /**
   * いま開いているマップをクラウドへ保存し直す（デスクトップ版のみ）。
   * ローカルに保存したマップの保存先を後から Drive に変える導線をヘッダーに出す。
   */
  onSaveToCloud?: () => void
  /** いま開いているマップをローカルファイルへ保存し直す（デスクトップ版のみ、上記の逆方向） */
  onSaveToLocal?: () => void
}

const NO_CLOUD_AUTH: AppCloudAuth = {
  isSignedIn: false,
  isLoading: false,
  clientIdMissing: false,
  userEmail: null,
  accessToken: null,
  error: null,
  signIn: () => {},
  signOut: () => {},
}

function AppInner({
  cloudAuth,
  autoSave,
  mapListSlot,
  dashboardSlot,
  onGenerateShareUrl,
  settingsExtraSections,
  onSaveToCloud,
  onSaveToLocal,
}: AppProps) {
  useKeyboardShortcuts()
  useGlobalErrorLog()

  const auth = cloudAuth ?? NO_CLOUD_AUTH
  const [showWelcome, setShowWelcome] = useState(false)
  const { initApiKey, theme } = useSettingsStore()
  const { addToast, isFileDashboardOpen, isPresentationMode } = useUIStore()
  useAutoSave(autoSave ?? { remoteReady: false })

  // StorageAdapter は非同期なのでレンダー後に判定する。
  // 起動直後はダッシュボードが開いていてウェルカムは隠れるため、遅延は表示に影響しない
  useEffect(() => {
    void getPlatform()
      .storage.getItem(WELCOME_KEY)
      .then((v) => setShowWelcome(!v))
  }, [])

  useEffect(() => {
    if (auth.error) {
      addToast(auth.error, 'error')
    }
  }, [auth.error, addToast])

  useEffect(() => {
    void initApiKey()
  }, [initApiKey])

  // 未保存（デバウンス待ち・保存中）のまま終了しようとしたら警告する。
  // Web = beforeunload、Desktop = ウィンドウの close-requested を SystemAdapter が吸収する
  useEffect(() => {
    return getPlatform().system.onBeforeExit(() => {
      const status = useUIStore.getState().saveStatus
      return !(status === 'unsaved' || status === 'saving')
    })
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
      {!isPresentationMode && (
        <Header
          showCloudAuth={cloudAuth != null}
          showMapList={mapListSlot != null}
          isSignedIn={auth.isSignedIn}
          isGoogleLoading={auth.isLoading}
          clientIdMissing={auth.clientIdMissing}
          userEmail={auth.userEmail}
          onGoogleSignIn={auth.signIn}
          onGoogleSignOut={auth.signOut}
          onSaveToCloud={onSaveToCloud}
          onSaveToLocal={onSaveToLocal}
        />
      )}
      <div className="flex flex-1 min-h-0">
        <IdeaCanvas />
        {!isPresentationMode && <NodePanel />}
      </div>
      {!isPresentationMode && (
        <>
          <SettingsPanel
            accessToken={auth.accessToken}
            showCloudSync={cloudAuth != null}
            extraSections={settingsExtraSections}
          />
          <AISuggestionPanel />
          <PersonaDebatePanel />
          {mapListSlot}
          <NodeDetailPanel />
          <ExportImportPanel onGenerateShareUrl={onGenerateShareUrl} />
          <MapAnalysisPanel />
          <AIChatPanel />
          <ArtifactPanel />
          <HistoryPanel />
        </>
      )}
      <ToastContainer />
      <ContextMenu />
      <ConfirmDialog />
      <InputDialog />
      <MasterPasswordModal />
      <SearchBar />
      <KeyboardShortcutsModal />
      <PresentationOrderPanel />
      <PresentationMode />
      {isFileDashboardOpen && dashboardSlot}
      {showWelcome && !isFileDashboardOpen && (
        <WelcomeModal
          onClose={() => {
            setShowWelcome(false)
            void getPlatform().storage.setItem(WELCOME_KEY, '1')
          }}
        />
      )}
    </div>
  )
}

export default function App(props: AppProps) {
  return (
    <ReactFlowProvider>
      <AppInner {...props} />
    </ReactFlowProvider>
  )
}
