# プロジェクト要約（検証済み）— IdeaMap

作成日: 2026-06-28
本書は当初エージェントが生成に失敗（ファイル未永続化）したため、オーケストレーターが
直接検証した事実に基づき再作成した版である。数値は実測。

## プロジェクト概要
AIと一緒に育てるアイデアマップアプリ。React Flow（@xyflow/react）でノード・エッジを管理し、
Claude API でアイデアを拡張する。バックエンドなしのフロントエンドのみ SPA（Vite + React +
TypeScript + Zustand + Tailwind CSS）。データ永続化は localStorage / Google Drive / 共有URL。

## 状態管理（Zustand 3ストア）
- `stores/mapStore.ts`（**1032行**）— マップデータ（ノード・エッジ）、Undo/Redo履歴、グループ操作。冒頭にグループジオメトリ計算4関数が混在。唯一の真の肥大化ファイル。
- `stores/uiStore.ts`（330行）— パネル開閉・ダイアログ・トースト・チャット状態・プレゼン状態・currentFileId/currentMapId 等。`:243` に `setSearchOpen` バグあり。
- `stores/settingsStore.ts` — apiKey（平文メモリ保持）、syncPassword、categories、テーマ等。localStorage persist（apiKeyは暗号化、syncPasswordは除外）。

## サービス層
- `services/claudeService.ts`（**400行**）— Claude API 呼び出し（generateSuggestions/analyzeMap/suggestConnections/suggestClusters/chatWithMap）。各関数で `new Anthropic({ apiKey, dangerouslyAllowBrowser: true })` を生成（5重複）。
- `services/googleDriveService.ts` — Drive ファイル CRUD、appProperties に mapId、settings.json 読み書き。
- `services/storageService.ts` — localStorage ラッパー、最近開いたマップ履歴。
- `services/exportService.ts` — PNG/SVG/JSON/Markdown エクスポート、JSONインポート、共有URL（base64）生成・解析。

## ユーティリティ
- `utils/encryption.ts` — AES-GCM + PBKDF2。ただし `deriveKey()` がハードコード文字列 `'ideamap-v1'` をパスフレーズに使用（暗号化が形骸化）。
- `utils/markdown.ts` — `renderMarkdownSimple()`。HTMLエスケープ後にタグを文字列置換で生成し `dangerouslySetInnerHTML` で描画。**react-markdown は未使用**。
- `utils/mapLayout.ts` — 放射状/dagre レイアウト、`applyGroupPushOut`（mapStore の computePushOut と重複）。

## 主要コンポーネント
- canvas: `IdeaNode.tsx`（カスタムノード、`:231` で dangerouslySetInnerHTML）、`IdeaCanvas.tsx`（367行、displayNodes/Edges 変換・NodeActionBar・接続モードバナー）、`GroupNode.tsx`、`ContextMenu.tsx`（window.prompt 2箇所）。
- panels: `AISuggestionPanel.tsx`（478行、ダーク未対応）、`AIChatPanel.tsx`（460行）、`NodeDetailPanel.tsx`、`NodePanel.tsx`、`MapAnalysisPanel.tsx`、`SettingsPanel.tsx`、`MapListPanel.tsx`、`ExportImportPanel.tsx`。
- screens: `FileOpenDashboard.tsx`、`PresentationMode.tsx`（`:83` で dangerouslySetInnerHTML）。
- common: `Header.tsx`、`WelcomeModal.tsx`、`ConfirmDialog.tsx`、`KeyboardShortcutsModal.tsx`、`SearchBar.tsx`。
- toolbar: `Toolbar.tsx`、`BottomNav.tsx`（スマホ9ボタン）。

## hooks
`useGoogleAuth.ts`（GISトークン、sessionStorage保持、prompt:'' 自動再認証）、`useAutoSave.ts`
（subscribe + 3秒デバウンス、衝突検出）、`useKeyboardShortcuts.ts`、`useOnlineStatus.ts`。

## セキュリティ境界（検証済み）
- **APIキー**: settingsStore に平文メモリ保持 + localStorage に AES-GCM 暗号化保存。ただし鍵導出パスフレーズがハードコードのため暗号化は実質無効。
- **Claude API**: ブラウザから `dangerouslyAllowBrowser: true` で直接呼び出し（Anthropic公式が許容するBYOKパターン）。
- **Google OAuth**: アクセストークンを sessionStorage 保持。スコープは `drive.file` + `userinfo.email`（最小権限）。
- **ユーザー入力描画**: `renderMarkdownSimple()` + `dangerouslySetInnerHTML` を4箇所（IdeaNode/PresentationMode/NodeDetailPanel/NodePanel）。エスケープ先行のため現状XSSリスクは低いが脆弱な設計。
- **共有URL**: マップ全体を base64 で URL に埋め込み（情報露出経路）。

## 主要な型定義（types/index.ts）
`IdeaNodeData`（title/body/categoryId/color 等）、`SerializedNode`（保存形式、nodeType/width/height/parentId）、
`MapFile`（mapId 含む）、`Category`、`ChatMessage`/`ChatAction`/`MapContext`、`SaveStatus`（'conflict' 含む）。

## ビルド/バンドル（実測）
`npm run build` で JS が**単一チャンク 811kB raw / 235kB gzip**（Vite が 500kB 超警告を出力）。
manualChunks 未設定。重量級依存: @xyflow/react, @anthropic-ai/sdk, @dagrejs/dagre, html-to-image。

## 「実装済み（確認中）」フェーズが触れる主な箇所
- Phase 14（AIチャット）: `AIChatPanel.tsx`, `claudeService.chatWithMap`, uiStore のチャット状態。
- Phase 18（UX小改善）: 複製/整列ガイド/テンプレート/絵文字、`PresentationOrderPanel`。
- Phase 25/26（スマホ）: `BottomNav.tsx`, `IdeaCanvas` 接続モード, `IdeaNode` ロングプレス, 各パネルの下部シート化。
