import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { getPlatform, type FileRef } from '@ideamap/platform'
import type { AISuggestion, SaveStatus, MapAnalysis, ConnectionSuggestion, ClusterSuggestion, GardenerSuggestion, PersonaOpinion, ChatMessage } from '../types'

/** 開いている Drive ファイルIDの永続化キー（リロード後も同じファイルへ保存を継続するため） */
const DRIVE_FILE_ID_KEY = 'ideamap-drive-fileid'
/** 開いているファイルの保存先種別の永続化キー。fileId と必ず対で読み書きする */
const FILE_ORIGIN_KEY = 'ideamap-file-origin'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  action?: { label: string; onClick: () => void }
}

export type ContextMenuType = 'node' | 'edge' | 'pane' | 'group'

export interface ContextMenuState {
  type: ContextMenuType
  /** 画面座標（メニュー表示位置） */
  x: number
  y: number
  /** node の場合はノードID、edge の場合はエッジID */
  targetId?: string
  /** pane の場合のフロー座標（新規ノード配置・貼り付け用） */
  flowPosition?: { x: number; y: number }
}

export interface ConfirmDialogState {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel?: () => void
  /** 3択が必要な場合（衝突ダイアログ等）に使うオプションの中央ボタン */
  secondaryAction?: {
    label: string
    onClick: () => void
  }
}

/** 1行テキスト入力ダイアログ（window.prompt の代替） */
export interface InputDialogState {
  title: string
  message?: string
  initialValue?: string
  placeholder?: string
  confirmLabel?: string
  /** 空文字での確定を許可するか（ラベル削除など）。false のときは空だと確定ボタンを無効化する */
  allowEmpty?: boolean
  onSubmit: (value: string) => void
  onCancel?: () => void
}

interface UIState {
  selectedNodeId: string | null
  /** インライン編集中のノードID（null = 編集なし） */
  editingNodeId: string | null
  isSettingsOpen: boolean
  isAIPanelOpen: boolean
  isMapListOpen: boolean
  isNodeDetailOpen: boolean
  nodeDetailId: string | null
  aiSuggestions: AISuggestion[]
  isAILoading: boolean
  saveStatus: SaveStatus
  /** 手動保存トリガー。インクリメントされるたびに useAutoSave が即時保存する */
  saveRequestId: number
  /** 最後に保存が成功した時刻（ISO文字列）。Drive・ローカルどちらの保存でも更新 */
  lastSavedAt: string | null
  /** このセッションでマップを開いた/作成したことがあるか（ダッシュボードの「閉じる」表示判定用） */
  hasActiveMap: boolean
  mapTitle: string
  /** 現在開いている Drive ファイルの ID（null=未保存の新規/インポート）。fileId の単一の真実源 */
  currentFileId: string | null
  /**
   * currentFileId が指す保存先の種別。デスクトップ版が Google Drive 上のマップと
   * ローカルファイルを同じ自動保存経路で扱うために必要（Web版は常に 'cloud'）。
   * currentFileId が null のときだけ null になる。
   */
  currentFileOrigin: FileRef['origin'] | null
  /** 現在開いているマップの論理 ID（JSON 内 mapId と同値）。セッション内メモリのみ、localStorage 不要 */
  currentMapId: string | null
  toasts: Toast[]
  contextMenu: ContextMenuState | null
  confirmDialog: ConfirmDialogState | null
  inputDialog: InputDialogState | null
  // 検索 & カテゴリフィルター
  isSearchOpen: boolean
  searchQuery: string
  activeCategoryFilters: string[]
  recentNodeIds: string[]
  // エクスポート & インポート
  isExportPanelOpen: boolean
  // AIマップ分析（全体分析・つながり提案・クラスタ提案）
  isAnalysisPanelOpen: boolean
  isAnalysisLoading: boolean
  mapAnalysis: MapAnalysis | null
  connectionSuggestions: ConnectionSuggestion[]
  clusterSuggestions: ClusterSuggestion[]
  gardenerSuggestions: GardenerSuggestion[]
  // AI成果物生成（Phase 45）
  isArtifactPanelOpen: boolean
  // ペルソナ壁打ち会議（Phase 48）。対象ノードIDは selectedNodeId を再利用する
  isPersonaDebatePanelOpen: boolean
  personaDebateResult: PersonaOpinion[]
  isPersonaDebateLoading: boolean
  // AIチャット
  isChatPanelOpen: boolean
  chatMessages: ChatMessage[]
  isChatLoading: boolean
  // プレゼンテーションモード
  isPresentationMode: boolean
  isPresentationOrderOpen: boolean
  presentationNodeIds: string[]
  presentationCurrentIndex: number
  /** スマホの接続モード（ノード選択→「接続」→相手タップでエッジ作成）の接続元ノード */
  connectingFromNodeId: string | null
  /** ドラッグ中のノードが重なっているグループ（ハイライト表示用） */
  dragOverGroupId: string | null
  setDragOverGroupId: (id: string | null) => void
  /** ドラッグ中のノードが重なっている接続先ノード（ドロップでエッジ作成・ハイライト表示用） */
  dragOverNodeId: string | null
  setDragOverNodeId: (id: string | null) => void
  // ファイルダッシュボード & ショートカット一覧
  isFileDashboardOpen: boolean
  isShortcutsModalOpen: boolean
  /** 画像エクスポート中のみ true。onlyRenderVisibleElements を一時無効化し画面外ノードもDOMに描画させる */
  renderAllNodes: boolean
  setSelectedNodeId: (id: string | null) => void
  setEditingNodeId: (id: string | null) => void
  setSettingsOpen: (open: boolean) => void
  setAIPanelOpen: (open: boolean) => void
  setMapListOpen: (open: boolean) => void
  openNodeDetail: (nodeId: string) => void
  closeNodeDetail: () => void
  setAISuggestions: (suggestions: AISuggestion[]) => void
  setAILoading: (loading: boolean) => void
  setSaveStatus: (status: SaveStatus) => void
  requestSave: () => void
  setLastSavedAt: (iso: string) => void
  setMapTitle: (title: string) => void
  /**
   * @param origin 保存先の種別。省略時は FileAdapter の既定（Web=cloud / Desktop=local）を使う
   */
  setCurrentFileId: (id: string | null, origin?: FileRef['origin']) => void
  /**
   * 永続化した currentFileId を復元する。StorageAdapter が非同期のため
   * ストア生成時には読めない。各アプリの main.tsx が最初のレンダー前に await する。
   */
  restoreCurrentFileId: () => Promise<void>
  setCurrentMapId: (id: string | null) => void
  addToast: (message: string, type: Toast['type'], action?: Toast['action']) => void
  removeToast: (id: string) => void
  openContextMenu: (menu: ContextMenuState) => void
  closeContextMenu: () => void
  openConfirmDialog: (dialog: ConfirmDialogState) => void
  closeConfirmDialog: () => void
  openInputDialog: (dialog: InputDialogState) => void
  closeInputDialog: () => void
  // 検索 & カテゴリフィルター
  setSearchOpen: (open: boolean) => void
  setSearchQuery: (query: string) => void
  toggleCategoryFilter: (categoryId: string) => void
  clearCategoryFilters: () => void
  trackRecentNode: (nodeId: string) => void
  // エクスポート & インポート
  setExportPanelOpen: (open: boolean) => void
  // AIマップ分析
  setAnalysisPanelOpen: (open: boolean) => void
  // AI成果物生成
  setArtifactPanelOpen: (open: boolean) => void
  // ペルソナ壁打ち会議
  setPersonaDebatePanelOpen: (open: boolean) => void
  setPersonaDebateResult: (result: PersonaOpinion[]) => void
  setPersonaDebateLoading: (loading: boolean) => void
  // AIチャット
  setChatPanelOpen: (open: boolean) => void
  addChatMessage: (message: ChatMessage) => void
  setChatLoading: (loading: boolean) => void
  clearChatHistory: () => void
  /** chatMessages 末尾が assistant メッセージの場合、その content を置換する */
  updateLastChatMessage: (content: string) => void
  // プレゼンテーションモード
  startPresentation: () => void
  exitPresentation: () => void
  goToNextPresentation: () => void
  goToPrevPresentation: () => void
  addNodeToPresentation: (nodeId: string) => void
  removeNodeFromPresentation: (nodeId: string) => void
  reorderPresentationNodes: (fromIndex: number, toIndex: number) => void
  clearPresentationNodes: () => void
  setPresentationNodeIds: (ids: string[]) => void
  setPresentationOrderOpen: (open: boolean) => void
  // ファイルダッシュボード & ショートカット一覧
  setFileDashboardOpen: (open: boolean) => void
  setShortcutsModalOpen: (open: boolean) => void
  setRenderAllNodes: (v: boolean) => void
  setConnectingFromNodeId: (id: string | null) => void
  setAnalysisLoading: (loading: boolean) => void
  setMapAnalysis: (analysis: MapAnalysis | null) => void
  setConnectionSuggestions: (suggestions: ConnectionSuggestion[]) => void
  setClusterSuggestions: (suggestions: ClusterSuggestion[]) => void
  setGardenerSuggestions: (suggestions: GardenerSuggestion[]) => void
}

export const useUIStore = create<UIState>((set) => ({
  selectedNodeId: null,
  editingNodeId: null,
  isSettingsOpen: false,
  isAIPanelOpen: false,
  isMapListOpen: false,
  isNodeDetailOpen: false,
  nodeDetailId: null,
  aiSuggestions: [],
  isAILoading: false,
  saveStatus: 'saved',
  saveRequestId: 0,
  lastSavedAt: null,
  hasActiveMap: false,
  mapTitle: '新しいマップ',
  // 復元は非同期の restoreCurrentFileId() が担う（main.tsx が初回レンダー前に呼ぶ）
  currentFileId: null,
  currentFileOrigin: null,
  currentMapId: null,
  toasts: [],
  contextMenu: null,
  confirmDialog: null,
  inputDialog: null,
  isSearchOpen: false,
  searchQuery: '',
  activeCategoryFilters: [],
  recentNodeIds: [],
  isExportPanelOpen: false,
  isAnalysisPanelOpen: false,
  isAnalysisLoading: false,
  mapAnalysis: null,
  connectionSuggestions: [],
  clusterSuggestions: [],
  gardenerSuggestions: [],
  isArtifactPanelOpen: false,
  isPersonaDebatePanelOpen: false,
  personaDebateResult: [],
  isPersonaDebateLoading: false,
  isChatPanelOpen: false,
  chatMessages: [],
  isChatLoading: false,
  isPresentationMode: false,
  isPresentationOrderOpen: false,
  presentationNodeIds: [],
  presentationCurrentIndex: 0,
  dragOverGroupId: null,
  setDragOverGroupId: (id) => set({ dragOverGroupId: id }),
  dragOverNodeId: null,
  setDragOverNodeId: (id) => set({ dragOverNodeId: id }),
  connectingFromNodeId: null,
  isFileDashboardOpen: true,
  isShortcutsModalOpen: false,
  renderAllNodes: false,
  setSelectedNodeId: (id) =>
    set((state) => ({
      selectedNodeId: id,
      recentNodeIds: id
        ? [id, ...state.recentNodeIds.filter((r) => r !== id)].slice(0, 10)
        : state.recentNodeIds,
    })),
  setEditingNodeId: (id) => set({ editingNodeId: id }),
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  setAIPanelOpen: (open) => set({ isAIPanelOpen: open }),
  setMapListOpen: (open) => set({ isMapListOpen: open }),
  openNodeDetail: (nodeId) => set({ isNodeDetailOpen: true, nodeDetailId: nodeId }),
  closeNodeDetail: () => set({ isNodeDetailOpen: false, nodeDetailId: null }),
  setAISuggestions: (suggestions) => set({ aiSuggestions: suggestions }),
  setAILoading: (loading) => set({ isAILoading: loading }),
  setSaveStatus: (status) => set({ saveStatus: status }),
  requestSave: () => set((state) => ({ saveRequestId: state.saveRequestId + 1 })),
  setLastSavedAt: (iso) => set({ lastSavedAt: iso }),
  setMapTitle: (title) => set({ mapTitle: title }),
  // fileId は永続化領域と常に一致させる（更新を1アクションに集約し同期漏れを防ぐ）。
  // 書き込みは待たずに state を更新する（旧実装の localStorage 直書きと同じ同期性を保つため）
  setCurrentFileId: (id, origin) => {
    const { storage, file } = getPlatform()
    // origin 未指定は「このアプリの既定の保存先」の意。fileId と対で永続化しないと、
    // リロード後にデスクトップ版が Drive のファイルIDをローカルパスとして扱ってしまう
    const nextOrigin = id ? (origin ?? file.origin) : null
    void (id ? storage.setItem(DRIVE_FILE_ID_KEY, id) : storage.removeItem(DRIVE_FILE_ID_KEY))
    void (nextOrigin
      ? storage.setItem(FILE_ORIGIN_KEY, nextOrigin)
      : storage.removeItem(FILE_ORIGIN_KEY))
    set({ currentFileId: id, currentFileOrigin: nextOrigin })
  },
  restoreCurrentFileId: async () => {
    const { storage, file } = getPlatform()
    const id = await storage.getItem(DRIVE_FILE_ID_KEY)
    const origin = await storage.getItem(FILE_ORIGIN_KEY)
    set({
      currentFileId: id,
      // Phase 38 より前に保存された値には origin が無い。当時は保存先が
      // アプリごとに1つだけだったので、Adapter の既定に寄せるのが正しい復元になる
      currentFileOrigin: !id ? null : origin === 'cloud' || origin === 'local' ? origin : file.origin,
    })
  },
  setCurrentMapId: (id) => set({ currentMapId: id }),
  addToast: (message, type, action?) => {
    const id = uuidv4()
    set((state) => ({ toasts: [...state.toasts, { id, message, type, action }] }))
    // action 付きトーストはユーザーが操作しやすいよう8秒、通常は4秒
    const duration = action ? 8000 : 4000
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, duration)
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  openContextMenu: (menu) => set({ contextMenu: menu }),
  closeContextMenu: () => set({ contextMenu: null }),
  openConfirmDialog: (dialog) => set({ confirmDialog: dialog }),
  closeConfirmDialog: () => set({ confirmDialog: null }),
  openInputDialog: (dialog) => set({ inputDialog: dialog }),
  closeInputDialog: () => set({ inputDialog: null }),
  setSearchOpen: (open) => set({ isSearchOpen: open, ...(open ? {} : { searchQuery: '' }) }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleCategoryFilter: (categoryId) =>
    set((state) => ({
      activeCategoryFilters: state.activeCategoryFilters.includes(categoryId)
        ? state.activeCategoryFilters.filter((id) => id !== categoryId)
        : [...state.activeCategoryFilters, categoryId],
    })),
  clearCategoryFilters: () => set({ activeCategoryFilters: [] }),
  trackRecentNode: (nodeId) =>
    set((state) => ({
      recentNodeIds: [nodeId, ...state.recentNodeIds.filter((r) => r !== nodeId)].slice(0, 10),
    })),
  setExportPanelOpen: (open) => set({ isExportPanelOpen: open }),
  setAnalysisPanelOpen: (open) => set({ isAnalysisPanelOpen: open }),
  setArtifactPanelOpen: (open) => set({ isArtifactPanelOpen: open }),
  setPersonaDebatePanelOpen: (open) => set({ isPersonaDebatePanelOpen: open }),
  setPersonaDebateResult: (result) => set({ personaDebateResult: result }),
  setPersonaDebateLoading: (loading) => set({ isPersonaDebateLoading: loading }),
  setChatPanelOpen: (open) => set({ isChatPanelOpen: open }),
  addChatMessage: (message) =>
    set((state) => ({ chatMessages: [...state.chatMessages, message].slice(-40) })),
  setChatLoading: (loading) => set({ isChatLoading: loading }),
  clearChatHistory: () => set({ chatMessages: [] }),
  updateLastChatMessage: (content) =>
    set((state) => {
      const msgs = state.chatMessages
      if (msgs.length === 0 || msgs[msgs.length - 1].role !== 'assistant') return {}
      const updated = [...msgs]
      updated[updated.length - 1] = { ...updated[updated.length - 1], content }
      return { chatMessages: updated }
    }),
  startPresentation: () =>
    set({
      isPresentationMode: true,
      presentationCurrentIndex: 0,
      isAIPanelOpen: false,
      isChatPanelOpen: false,
      isAnalysisPanelOpen: false,
      isArtifactPanelOpen: false,
      isPersonaDebatePanelOpen: false,
      isSettingsOpen: false,
      isExportPanelOpen: false,
      isMapListOpen: false,
      isNodeDetailOpen: false,
      isSearchOpen: false,
      contextMenu: null,
      editingNodeId: null,
    }),
  exitPresentation: () => set({ isPresentationMode: false, presentationCurrentIndex: 0 }),
  goToNextPresentation: () =>
    set((state) => ({
      presentationCurrentIndex: Math.min(
        state.presentationCurrentIndex + 1,
        state.presentationNodeIds.length - 1
      ),
    })),
  goToPrevPresentation: () =>
    set((state) => ({
      presentationCurrentIndex: Math.max(state.presentationCurrentIndex - 1, 0),
    })),
  addNodeToPresentation: (nodeId) =>
    set((state) =>
      state.presentationNodeIds.includes(nodeId)
        ? {}
        : { presentationNodeIds: [...state.presentationNodeIds, nodeId] }
    ),
  removeNodeFromPresentation: (nodeId) =>
    set((state) => {
      const newIds = state.presentationNodeIds.filter((id) => id !== nodeId)
      return {
        presentationNodeIds: newIds,
        presentationCurrentIndex: Math.min(state.presentationCurrentIndex, Math.max(0, newIds.length - 1)),
      }
    }),
  reorderPresentationNodes: (fromIndex, toIndex) =>
    set((state) => {
      const ids = [...state.presentationNodeIds]
      const [moved] = ids.splice(fromIndex, 1)
      ids.splice(toIndex, 0, moved)
      return { presentationNodeIds: ids }
    }),
  clearPresentationNodes: () => set({ presentationNodeIds: [], presentationCurrentIndex: 0 }),
  setPresentationNodeIds: (ids) => set({ presentationNodeIds: ids, presentationCurrentIndex: 0 }),
  setPresentationOrderOpen: (open) => set({ isPresentationOrderOpen: open }),
  setAnalysisLoading: (loading) => set({ isAnalysisLoading: loading }),
  setMapAnalysis: (analysis) => set({ mapAnalysis: analysis }),
  setConnectionSuggestions: (suggestions) => set({ connectionSuggestions: suggestions }),
  setClusterSuggestions: (suggestions) => set({ clusterSuggestions: suggestions }),
  setGardenerSuggestions: (suggestions) => set({ gardenerSuggestions: suggestions }),
  // ダッシュボードが閉じる＝マップを開いた/作成した直後なので hasActiveMap を立てる
  // （閉じる経路はマップ選択・新規作成・インポート・「キャンバスに戻る」のみ）
  setFileDashboardOpen: (open) =>
    set((state) => ({
      isFileDashboardOpen: open,
      hasActiveMap: open ? state.hasActiveMap : true,
    })),
  setShortcutsModalOpen: (open) => set({ isShortcutsModalOpen: open }),
  setRenderAllNodes: (v) => set({ renderAllNodes: v }),
  setConnectingFromNodeId: (id) => set({ connectingFromNodeId: id }),
}))
