# アイデア拡張メモアプリ 設計書

**作成日**: 2026-05-30  
**バージョン**: 1.0

---

## 1. アーキテクチャ概要

フロントエンドのみのSPAとして構成する。バックエンドサーバーは持たない。

```
ブラウザ
├── React SPA (Vite + React 18 + TypeScript)
│   ├── React Flow（マインドマップキャンバス）
│   ├── Zustand（状態管理: mapStore / uiStore / settingsStore）
│   └── Tailwind CSS（スタイリング）
│
├── 外部API呼び出し（ブラウザから直接）
│   ├── Anthropic API（Claude）
│   └── Google Drive API（GIS Token モデル）
│
└── ローカル永続化
    └── localStorage（マップデータ・設定・暗号化APIキー）
```

---

## 2. 技術スタック

### 2.1 フロントエンド
| 分類 | 採用技術 | 理由 |
|------|----------|------|
| フレームワーク | **React 18 + TypeScript** | 型安全、大規模コンポーネント管理に適する |
| ビルドツール | **Vite** | 高速な開発サーバー、軽量バンドル |
| マインドマップ | **React Flow (@xyflow/react)** | ノード・エッジの管理が容易、スマホ対応、豊富なAPI |
| スタイリング | **Tailwind CSS** | レスポンシブ対応が容易、ユーティリティファーストで高速開発 |
| 状態管理 | **Zustand** | シンプルで軽量、React Flowとの親和性が高い |
| AI連携 | **Anthropic SDK (@anthropic-ai/sdk)** | 公式SDK、型安全 |
| Googleドライブ | **Google Identity Services (GIS)** | 公式クライアント、Token モデル採用 |
| レイアウト | **@dagrejs/dagre** | 有向グラフの自動整列 |
| ユニークID | **uuid** | ノード・エッジのID生成 |

### 2.2 ホスティング
- **GitHub Pages**（静的サイトホスティング）
- GitHub Actions でCI/CD自動デプロイ

---

## 3. プロジェクト構成

```
ideamap/
├── public/
│   └── index.html
├── src/
│   ├── main.tsx                    # エントリーポイント
│   ├── App.tsx                     # ルートコンポーネント
│   ├── components/
│   │   ├── canvas/
│   │   │   ├── IdeaCanvas.tsx      # React Flowのメインキャンバス
│   │   │   ├── IdeaNode.tsx        # カスタムノードコンポーネント
│   │   │   └── ContextMenu.tsx     # 右クリックコンテキストメニュー
│   │   ├── panels/
│   │   │   ├── NodePanel.tsx       # ノード選択時のサイドパネル（簡易表示）
│   │   │   ├── NodeDetailPanel.tsx # ノード詳細パネル（タイトル・本文・カテゴリ編集、デフォルトプレビューモード）
│   │   │   ├── AISuggestionPanel.tsx # AI提案表示パネル（title+body分離表示、種別フィルタ・提案数スライダー付き）
│   │   │   ├── SettingsPanel.tsx   # 設定パネル（カテゴリ管理含む）
│   │   │   ├── MapListPanel.tsx    # マップ一覧パネル
│   │   │   ├── ExportImportPanel.tsx # エクスポート/インポート/共有パネル（Phase 9）
│   │   │   ├── MapAnalysisPanel.tsx  # AIマップ分析パネル（分析・接続提案・クラスタリング）（Phase 10）
│   │   │   ├── AIChatPanel.tsx      # AIチャットパネル（継続会話・@参照・アクションボタン）（Phase 14）
│   │   │   └── PresentationOrderPanel.tsx # 発表順序編集モーダル（↑↓ボタン・削除・発表開始）（Phase 18）
│   │   ├── toolbar/
│   │   │   ├── Toolbar.tsx         # ツールバー（PC用）。右端に ❓ ヘルプボタン（Phase 22 G）
│   │   │   └── BottomNav.tsx       # ボトムナビ（スマホ用）。「ヘルプ」ボタン追加（Phase 22 G）
│   │   └── common/
│   │       ├── Header.tsx
│   │       ├── Modal.tsx
│   │       ├── Toast.tsx
│   │       ├── ConfirmDialog.tsx
│   │       ├── SearchBar.tsx           # 検索バー（Phase 8）
│   │       └── LoadingSpinner.tsx
│   ├── stores/
│   │   ├── mapStore.ts             # マップ状態（ノード・エッジ・Undo/Redo）
│   │   ├── settingsStore.ts        # 設定状態（APIキー・テーマ・自動保存）
│   │   └── uiStore.ts              # UI状態（パネル開閉・コンテキストメニュー等）
│   ├── services/
│   │   ├── claudeService.ts        # Claude API呼び出し（generateSuggestions / analyzeMap / suggestConnections / suggestClusters）
│   │   ├── googleDriveService.ts   # Google Drive API操作
│   │   ├── storageService.ts       # localStorageのラッパー
│   │   └── exportService.ts        # エクスポート/インポート/共有URLロジック（Phase 9）
│   ├── hooks/
│   │   ├── useAutoSave.ts          # 自動保存フック
│   │   ├── useGoogleAuth.ts        # Googleログイン状態管理
│   │   └── useKeyboardShortcuts.ts # キーボードショートカット
│   ├── types/
│   │   └── index.ts                # 型定義
│   └── utils/
│       ├── mapLayout.ts            # ノード自動配置ロジック（dagre・円形配置）
│       ├── encryption.ts           # APIキーの暗号化・復号（AES-GCM）
│       └── markdown.ts             # Markdown→HTML変換ユーティリティ（Phase 18）
├── .env.example
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

---

## 4. 状態管理設計

### 4.1 mapStore（src/stores/mapStore.ts）

マップの実体データと操作履歴を管理する中心的なストア。

| 状態 | 型 | 説明 |
|------|-----|------|
| `nodes` | `IdeaNode[]` | React Flow ノード配列 |
| `edges` | `Edge[]` | React Flow エッジ配列 |
| `past` | `Snapshot[]` | Undo用スナップショット履歴（最大50件） |
| `future` | `Snapshot[]` | Redo用スナップショット履歴（最大50件） |
| `clipboard` | `{ nodes: IdeaNode[]; edges: Edge[] }` | コピー用クリップボード（Phase 22: エッジも含む構造に変更） |

主要アクション:
- `addNode`, `addConnectedNode` — ノード追加（`addNode(title, x, y, createdBy?, color?, categoryId?, body?)` — Phase 18で `body` 追加）
  - `addConnectedNode`: グループ外分岐では `findFreePosition` を適用して重なり回避（Phase 21）
- `addSiblingNode(nodeId)` — 兄弟ノードを作成してIDを返す（Phase 22）。親エッジがあれば同じ親の子として追加、なければ下方に独立ノード作成
- `selectOnlyNode(id)` — 指定ノードのみ選択状態にする（履歴に積まない、矢印キー移動用）（Phase 22）
- `updateNodeTitle`, `updateNodeBody`, `updateNodeColor`, `updateNodeCategory` — ノード更新
- `deleteNode`, `deleteNodes`, `deleteSelected`, `deleteNodeEdges` — 削除系
- `reverseEdge`, `toggleEdgeDirection`, `updateEdgeLabel`, `deleteEdge` — エッジ操作
- `copyNodes`, `paste` — コピー・ペースト（Phase 22: `copyNodes` は選択ノード間のエッジも保存、`paste` は `Map<oldId,newId>` でエッジを再生成）
- `alignSelectedNodes(type)` — 複数選択ノードを整列（Phase 21）。`'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom'`。`selected && !parentId && type !== 'groupNode'` のノードが対象（2件未満は何もしない）。変更前スナップショットを `past` に push
- `distributeSelectedNodes(direction)` — 複数選択ノードを等間隔配置（Phase 21）。`'horizontal' | 'vertical'`。対象3件未満は何もしない。中心座標でソートし、両端固定で中間を等間隔補間
- `setNodes(nodes)` — ノード配列を更新し履歴に積む。内部で `syncGroupMeasured` を通してグループノードの `measured` を同期
- `setNodesNoHistory(nodes)` — ノード配列を更新するが履歴に積まない（アニメーション途中フレーム用）（Phase 21）
- `commitNodesWithHistory(originalNodes, finalNodes)` — 最終フレームを確定し、整列前スナップショットを `past` に1回積む（Phase 21）
- `undo`, `redo` — 履歴操作
- `loadFromSerialized`, `getSerializedNodes`, `getSerializedEdges` — シリアライズ（旧 `text` フィールドを `title` に自動マイグレーション）

内部ヘルパー（store外関数）:
- `syncGroupMeasured(nodes)` — グループノードの `style.width/height` を `measured` に同期。`setNodes` / `setNodesNoHistory` / `commitNodesWithHistory` で共通使用（Phase 21: `setNodes` から抽出）

### 4.2 uiStore（src/stores/uiStore.ts）

UIの表示状態と、現在開いているマップのメタ情報（タイトル・fileId）を管理する。原則副作用なしだが、例外として `setCurrentFileId` のみ fileId を localStorage（`ideamap-drive-fileid`）と同期する。

| 状態 | 型 | 説明 |
|------|-----|------|
| `selectedNodeId` | `string \| null` | 現在選択中のノードID |
| `editingNodeId` | `string \| null` | インライン編集中のノードID（null=編集なし）（Phase 22） |
| `isSettingsOpen` | `boolean` | 設定パネルの開閉 |
| `isAIPanelOpen` | `boolean` | AI提案パネルの開閉 |
| `isMapListOpen` | `boolean` | マップ一覧パネルの開閉 |
| `isNodeDetailOpen` | `boolean` | ノード詳細パネルの開閉 |
| `nodeDetailId` | `string \| null` | 詳細パネルで表示中のノードID |
| `aiSuggestions` | `AISuggestion[]` | AI提案リスト |
| `isAILoading` | `boolean` | AI呼び出し中フラグ |
| `saveStatus` | `SaveStatus` | `saved \| saving \| unsaved \| error \| conflict` |
| `saveRequestId` | `number` | 手動保存トリガー（Phase 20）。`requestSave()` でインクリメントされ、useAutoSave がデバウンスをスキップして即時保存する |
| `lastSavedAt` | `string \| null` | 最後に保存が成功した時刻（ISO文字列）。ヘッダーの保存ステータスのツールチップに表示（Phase 20） |
| `hasActiveMap` | `boolean` | このセッションでマップを開いた/作成したことがあるか。ダッシュボードの「キャンバスに戻る」ボタン・Esc閉じの表示判定に使用。`setFileDashboardOpen(false)` 時に自動で true になる（閉じる経路はマップ選択後のみのため）（Phase 20） |
| `mapTitle` | `string` | 現在のマップタイトル |
| `currentFileId` | `string \| null` | 現在開いている Drive ファイルの ID（null=未保存の新規/インポート）。fileId の単一の真実源。`setCurrentFileId` で localStorage と同期 |
| `toasts` | `Toast[]` | トースト通知リスト（4秒後自動削除） |
| `contextMenu` | `ContextMenuState \| null` | 右クリックメニューの表示状態 |
| `confirmDialog` | `ConfirmDialogState \| null` | 確認ダイアログの表示状態 |
| `isSearchOpen` | `boolean` | 検索バーの開閉（Phase 8） |
| `searchQuery` | `string` | 検索クエリ（IdeaNodeが参照してdim/highlight） |
| `activeCategoryFilters` | `string[]` | フィルター中のカテゴリID（空=全表示、OR条件） |
| `recentNodeIds` | `string[]` | 最近選択したノードID（最大10件、setSelectedNodeId呼び出し時に自動更新） |
| `isExportPanelOpen` | `boolean` | エクスポート/インポートパネルの開閉（Phase 9） |
| `isAnalysisPanelOpen` | `boolean` | AIマップ分析パネルの開閉（Phase 10） |
| `isAnalysisLoading` | `boolean` | AI分析中フラグ（Phase 10） |
| `mapAnalysis` | `MapAnalysis \| null` | マップ全体分析結果（Phase 10） |
| `connectionSuggestions` | `ConnectionSuggestion[]` | 接続提案リスト（Phase 10） |
| `clusterSuggestions` | `ClusterSuggestion[]` | クラスタリング提案リスト（Phase 10） |
| `isChatPanelOpen` | `boolean` | AIチャットパネルの開閉（Phase 14） |
| `chatMessages` | `ChatMessage[]` | チャット履歴（セッションメモリのみ、最大40件）（Phase 14） |
| `isChatLoading` | `boolean` | AIチャット応答待ちフラグ（Phase 14） |
| `isPresentationMode` | `boolean` | 発表モード中フラグ（Phase 15） |
| `isPresentationOrderOpen` | `boolean` | 発表順序編集モーダルの開閉（Phase 18） |
| `presentationNodeIds` | `string[]` | 発表順序を保持したノードIDリスト（Phase 15） |
| `presentationCurrentIndex` | `number` | 現在表示中のインデックス（0-based）（Phase 15） |
| `renderAllNodes` | `boolean` | 画像エクスポート時のみ true。`onlyRenderVisibleElements` を一時無効化して全ノードをDOM描画させ、マップ全体エクスポートの欠落を防ぐ（Phase 24） |

### 4.3 settingsStore（src/stores/settingsStore.ts）

設定と永続化を担当。APIキーは暗号化して保存。

| 状態 | 型 | 説明 |
|------|-----|------|
| `apiKey` | `string` | Claude APIキー（メモリ上） |
| `model` | `AIModel` | `claude-sonnet-4-6 \| claude-haiku-4-5-20251001` |
| `suggestionCount` | `number` | AI提案件数（3〜7） |
| `autoSave` | `boolean` | 自動保存のオン/オフ |
| `theme` | `Theme` | `light \| dark` |
| `nodeShape` | `NodeShape` | `rounded \| ellipse \| hexagon`（ノード形状） |
| `categories` | `Category[]` | カテゴリ一覧（デフォルト7件＋ユーザー追加分、localStorage永続化） |
| `snapToGrid` | `boolean` | グリッドスナップの有効/無効（default: `false`、localStorage永続化）（Phase 21） |
| `edgeStyle` | `EdgeStyle` | `bezier \| smoothstep \| straight`（エッジ描画パス種別、default: `'bezier'`、localStorage永続化）（Phase 21-F） |

---

## 5. コンポーネント設計

### 5.1 App（src/App.tsx）

`ReactFlowProvider` でアプリ全体をラップ。`AppInner` で以下のフックを最上位でマウント:
- `useKeyboardShortcuts()` — グローバルキーイベント
- `useAutoSave(accessToken, auth)` — マップ変更監視と自動保存。`auth: { silentReauth, signIn }` を受け取り、401 時のサイレント再認証・リトライを担う（Phase 19）
- `useGoogleAuth()` — Google認証状態管理

テーマ適用: `settingsStore.theme` に応じて `<html>` の `dark` クラスを切替。

発表モード中（`isPresentationMode: true`）: ヘッダー・NodePanel・各種サイドパネルを非表示。`PresentationMode` コンポーネントが全面オーバーレイとして表示される。

### 5.1.1 PresentationMode（src/components/screens/PresentationMode.tsx）

`createPortal(content, document.body)` で `<body>` 直下にレンダリング（z-index: 100）。`isPresentationMode: false` のとき `null` を返す。

内部で `useReactFlow().fitView` を呼び出し、`presentationCurrentIndex` が変わるたびにカレントノードへズームアニメーション（duration: 600ms, padding: 0.4, maxZoom: 1.5）。

**レイアウト:**
- 左エリア（`flex-1`）: `pointer-events: none` でキャンバスへのクリックをスルー
- 右スライドパネル（`w-[480px]`）: カレントノードのタイトル（text-4xl）＋本文（text-xl）＋ドットインジケーター
- 下部ナビバー（`fixed bottom-0`）: 前へ/次へボタン、X/N カウンター、終了ボタン

### 5.2 IdeaCanvas（src/components/canvas/IdeaCanvas.tsx）

React Flow の主要設定:

| 設定 | 値 | 理由 |
|---|---|---|
| `connectionMode` | `ConnectionMode.Loose` | source/target兼用ハンドルで任意方向から接続 |
| `deleteKeyCode` | `null` | React Flow組み込み削除を無効化し、storeに一元化 |
| `panOnScroll` | `true` | スクロールでキャンバス移動 |
| `minZoom` | `0.1` | 広大なマップにも対応 |
| `maxZoom` | `3` | |

イベントハンドラ:
- `onDoubleClick` (pane) → ダブルクリック位置にノード追加
- `onNodeContextMenu` → `uiStore.openContextMenu({ type: 'node', ... })`
- `onEdgeContextMenu` → `uiStore.openContextMenu({ type: 'edge', ... })`
- `onPaneContextMenu` → `uiStore.openContextMenu({ type: 'pane', flowPosition })`
- `onPaneClick` → 選択解除 + コンテキストメニュー閉じる

### 5.3 IdeaNode（src/components/canvas/IdeaNode.tsx）

カスタムノードコンポーネント。`React.memo` でラップ。

**ハンドル配置:**
```
         [Top]
[Left] ──[Node]── [Right]
         [Bottom]
```
全ハンドルを `type="source"` で定義。`ConnectionMode.Loose` により target として機能。

**表示状態:**
- 通常: テキスト表示、ボーダー `border-gray-200`
- 選択中: ボーダー `border-primary-500`、アクションバーを下部に表示
- AIノード (`createdBy === 'ai'`): `node-ai-generated` クラス（`✦` バッジ + pulse アニメーション）

**インライン編集（タイトルのみ）（Phase 22）:**
- ダブルクリック / F2 / 右クリック「名前を変更」で `uiStore.editingNodeId` を設定 → textarea 表示
- Enter (Shift なし) または blur でコミット、Escape で変更破棄
- 本文があるノードは左上に 📝 バッジを表示。バッジクリック → `openNodeDetail(id)`（詳細モーダルへの導線を維持）
- 本文の冒頭をノードカード内にプレビュー表示（2行）
- ノード作成直後（キャンバスダブルクリック・ツールバー追加・Tab・Enter・右クリック作成）は自動で編集モード開始

**モバイル対応:**
- ロングプレス 500ms → 選択 + AI提案パネルを開く
- `onTouchMove` でロングプレスタイマーをキャンセル（誤発火防止）

### 5.4 ContextMenu（src/components/canvas/ContextMenu.tsx）

`createPortal(content, document.body)` で `<body>` 直下にレンダリング（z-index問題を回避）。

メニュー位置の調整:
```typescript
const left = Math.max(8, Math.min(x, window.innerWidth - MENU_WIDTH - 8))
const top = Math.max(8, Math.min(y, window.innerHeight - 320))
```

| メニュー種別 | 表示項目 |
|---|---|
| node | **名前を変更（F2）**（Phase 22）/ 詳細を開く / アイデアを作成（接続）/ AIで拡張 / コピー / 発表に追加（または発表から除外）/ カテゴリを変更 / **整列セクション**（Phase 21・選択2件以上で表示）/ 接続線のみ削除 / ノードを削除 |
| edge | 向きを反転 / 双方向切替 / ラベルを編集 / 線を削除 |
| pane | アイデアを作成（作成後インライン編集開始・Phase 22）/ グループを作成 / ここに貼り付け |

**整列セクション（Phase 21）**: ノードメニューで `alignableCount >= 2`（`selected && !parentId && type !== 'groupNode'` の件数）のとき Divider 付きで追加。⬅ 左揃え / ⬆ 上揃え / ↔ 左右中央 / ↕ 上下中央。`alignableCount >= 3` のとき追加で ⇿ 横に等間隔 / ⇳ 縦に等間隔。各項目は `run()` ヘルパー経由でアクション実行後 `closeContextMenu()`。

### 5.5 WelcomeModal（src/components/common/WelcomeModal.tsx）

初回起動時のみ表示。`localStorage.getItem('ideamap-welcomed')` がなければ表示し、閉じ時にセット。  
3ステップ（アイデア追加 / 接続 / AI拡張）のスライドモーダル。`createPortal` で `<body>` に描画。  
最終ステップ（3ステップ目）に「❓ ボタンまたは Ctrl+/ で操作ガイドを確認できます」のヒントを表示（Phase 22 G）。

### 5.5.1 KeyboardShortcutsModal（src/components/common/KeyboardShortcutsModal.tsx）

`uiStore.isShortcutsModalOpen` で制御。`createPortal` で `<body>` に描画。  
`Ctrl+/` ショートカットのほか、Toolbar の ❓ ボタン（デスクトップ）・BottomNav の「ヘルプ」ボタン（モバイル）から開ける（Phase 22 G）。  
**見出し**: 「操作ガイド」（Phase 22 G で「キーボードショートカット」から変更）。  
**内容**: キーボードショートカット（基本操作・ノード編集・表示検索・検索バー内・ダイアログ）＋マウス・タッチ操作セクション。

### 5.6 ConfirmDialog（src/components/common/ConfirmDialog.tsx）

接続線があるノード削除時のみ表示。  
- `Enter` → 確認、`Escape` → キャンセル（ショートカット有効）
- `confirmDialog` 表示中はキャンバス操作ショートカット全体を抑制

---

## 6. 型定義（src/types/index.ts）

```typescript
interface Category {
  id: string
  name: string
  color: string        // hex カラーコード
  icon: string         // 絵文字
  description?: string
}

interface IdeaNodeData extends Record<string, unknown> {
  title: string        // ノードタイトル（旧 text から Phase 7 でリネーム）
  body?: string        // 詳細メモ（Markdown）
  color: string        // hex カラーコード（カテゴリから派生）
  createdBy: 'user' | 'ai'
  categoryId?: string  // Category.id への参照
}

interface MapFile {
  version: string
  mapId: string        // マップの論理的同一性を表す UUID（作成時に1度だけ付与、ファイル名変更後も不変）
  title: string
  createdAt: string    // ISO 8601
  updatedAt: string    // ISO 8601
  nodes: SerializedNode[]
  edges: SerializedEdge[]
}

interface SerializedNode {
  id: string
  title: string        // 旧フォーマット（text）との後方互換: loadFromSerialized で自動マイグレーション
  body?: string
  x: number; y: number
  color: string
  createdBy: 'user' | 'ai'
  categoryId?: string
}

interface SerializedEdge {
  id: string
  source: string; target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  label: string
  bidirectional?: boolean  // true のとき両端に矢印
}

interface AISuggestion {
  title: string        // 短いタイトル（20字以内）
  body?: string        // 補足説明・詳細（省略可）
  categoryId?: string  // AIが自動判定したカテゴリID
}

type Theme = 'light' | 'dark'
type AIModel = 'claude-sonnet-4-6' | 'claude-haiku-4-5-20251001'
type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error' | 'conflict'
type NodeShape = 'rounded' | 'ellipse' | 'hexagon'
type SuggestionType = '関連' | '深掘り' | '対比' | '応用'

// Phase 10: AI高度化
interface MapAnalysis {
  summary: string              // マップの主要テーマ要約
  missingAreas: string[]       // 見落としているアイデア領域（最大4件）
  importantNodeIds: string[]   // 重要ノードのID（最大3件）
  importantNodeTitles: string[] // 重要ノードのタイトル
}

interface ConnectionSuggestion {
  sourceId: string
  targetId: string
  sourceTitle: string
  targetTitle: string
  reason: string               // 接続の理由（1文）
}

interface ClusterSuggestion {
  groupName: string
  categoryId: string           // 適用するカテゴリID
  nodeIds: string[]
  nodeTitles: string[]
}

// Phase 14: AIチャット
type ChatActionType = 'addNode' | 'connectNodes' | 'updateNode'

interface ChatAction {
  type: ChatActionType
  label: string                // ボタン表示テキスト
  sourceNodeId?: string        // addNode: 接続先の親ID / connectNodes: source / updateNode: 対象ID
  targetNodeId?: string        // connectNodes: target
  categoryId?: string          // addNode: 推奨カテゴリID
  body?: string                // addNode: ノードの本文（Phase 18追加）
  reason?: string              // ボタン下の補足説明
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string            // ISO 8601
  actions?: ChatAction[]       // assistant のみ持つ
}

interface MapContext {
  mapTitle: string
  nodes: { id: string; title: string; body?: string; categoryId?: string }[]
  edges: { source: string; target: string; label?: string }[]
  categories: { id: string; name: string }[]
}
```

---

## 7. エッジ・有向グラフ設計

### 7.1 デフォルト: 有向エッジ（矢印付き）

理由: AI提案ノードは常に「親→子」で生成される。dagre も有向グラフ前提。起点ノードが視覚的に自明になる。

```typescript
const ARROW: EdgeMarker = {
  type: MarkerType.ArrowClosed,
  width: 16, height: 16,
  color: '#94a3b8'
}
const EDGE_STYLE = { stroke: '#94a3b8', strokeWidth: 1.5 }
```

全ての新規エッジに `markerEnd: ARROW` と `type: 'smoothstep'` を設定（折れ線より見栄えのよい曲線エッジ）。

### 7.2 双方向エッジ

`markerStart` に ARROW を追加することで双方向を表現:
- 双方向にする: `toggleEdgeDirection` → `markerStart: ARROW`
- 単方向に戻す: `toggleEdgeDirection` → `markerStart: undefined`

シリアライズ: `bidirectional: Boolean(e.markerStart)` で保存、読み込み時に復元。

### 7.3 旧データ互換性

ハンドルID未指定の旧保存データは読み込み時に `sourceHandle='right'`, `targetHandle='left'` をデフォルト設定してフォールバック。

---

## 8. Undo/Redo設計

### 8.1 スナップショット方式

```typescript
interface Snapshot {
  nodes: IdeaNode[]
  edges: Edge[]
}
// past: Snapshot[] (最大50件)
// future: Snapshot[] (最大50件)
```

### 8.2 履歴に積む操作

**積む（確定的操作）:**
- ノード追加 / 削除 / 移動完了（`dragging=false`）/ テキスト更新 / 色更新
- エッジ追加 / 削除 / 向き反転 / 双方向切替 / ラベル編集
- コピー後のペースト

**積まない（ドラッグ中）:**
- ドラッグ中の位置変化（`position change` with `dragging=true`）

### 8.3 操作フロー

```
Undo: past の末尾を復元 → 現在状態を future 先頭に追加 → past から末尾を除去
Redo: future の先頭を復元 → 現在状態を past 末尾に追加 → future から先頭を除去
```

---

## 9. Claude API連携設計（src/services/claudeService.ts）

### 9.1 ブラウザからの直接呼び出し

`dangerouslyAllowBrowser: true` で Anthropic SDK をブラウザから直接使用。APIキーはユーザー管理（サーバー経由なし）。

### 9.2 プロンプト設計

送信コンテキスト:
1. **選択ノード**: `selectedNodeText`
2. **接続ノード**: `connectedNodeTexts`（直接繋がる全ノード）
3. **全体文脈**: `allNodeTexts.slice(0, 10)`（参考）

提案タイプ: `関連 / 深掘り / 対比 / 応用`

### 9.3 レスポンス解析

JSON部分をregexで抽出（Claudeの前置き説明文への耐性）:
```typescript
const jsonMatch = content.text.match(/\{[\s\S]*\}/)
const parsed = JSON.parse(jsonMatch[0]) as { suggestions: AISuggestion[] }
return parsed.suggestions.slice(0, req.count)
```

### 9.4 各関数の仕様（Phase 23）

| 関数 | max_tokens | 備考 |
|---|---|---|
| `generateSuggestions(req, signal?)` | 2048 | signal で途中キャンセル可 |
| `analyzeMap` | 2048 | |
| `suggestConnections` | 2048 | |
| `suggestClusters` | 2048 | |
| `chatWithMap(req, onText?, signal?)` | 2048 | ストリーミング + system パラメータ化 |

### 9.5 chatWithMap のストリーミング設計（Phase 23）

```typescript
export async function chatWithMap(
  req: ChatWithMapRequest,
  onText?: (partialText: string) => void,
  signal?: AbortSignal,
): Promise<{ content: string; actions: ChatAction[] }>
```

- `systemContext`（マップコンテキスト文字列）を **`system` パラメータ**で渡す。`messages` は会話履歴をそのままマップ（最初のユーザーメッセージへの埋め込みなし）。
- `client.messages.stream({ model, max_tokens: 2048, system, messages }, { signal })` で逐次受信。
- `onText` コールバックには `/```actions[\s\S]*$/` を除去した累積テキストを都度渡す（actions ブロックの途中表示防止）。
- Abort 時（`APIUserAbortError` または `signal.aborted`）: それまでの累積テキスト（actions 除去済み）を `content` として返す。`actions: []`。throw しない。
- 完了後: `/```actions\n([\s\S]*?)\n```/` で actions をパースして返す。

### 9.6 toFriendlyAIError（Phase 23）

```typescript
export function toFriendlyAIError(e: unknown): string
```

エラー種別の優先判定順（`APIConnectionError` は `APIError` のサブクラスのため先に検査）:

| 条件 | メッセージ |
|---|---|
| `e instanceof Anthropic.APIConnectionError` | 「ネットワークエラーです。接続を確認してください」 |
| `e instanceof Anthropic.APIError` / status 401 | 「APIキーが無効です。設定画面で確認してください」 |
| status 429 | 「レート制限に達しました。1分ほど待ってから再試行してください」 |
| status 529 | 「Claude APIが混雑しています。しばらく待ってから再試行してください」 |
| 他の `APIError` | `e.message` |
| fallback | `e instanceof Error ? e.message : 'エラーが発生しました'` |

### 9.7 updateLastChatMessage（uiStore — Phase 23）

```typescript
updateLastChatMessage: (content: string) => void
```

`chatMessages` 配列の末尾メッセージが `role === 'assistant'` の場合のみ、その `content` を置換した新配列をセットする。ストリーミング中にデルタを逐次反映するために使用。

---

## 10. APIキー暗号化設計（src/utils/encryption.ts）

- Web Crypto API（AES-GCM）で暗号化してlocalStorageに保存
- 鍵はブラウザフィンガープリントから導出（`userAgent`, `language`, `platform` 等）
- サーバーへの送信なし
- settingsStore はメモリ上に平文APIキーを保持し、永続化時のみ暗号化/復号を実行

---

## 11. ノード配置ロジック（src/utils/mapLayout.ts）

### 11.1 AI提案ノードの円形配置（`calcSuggestionPositions`）

- 親ノードを中心に半径 **220px** の円形配置
- 角度計算: `(idx / count) × 2π − π/2`（上から時計回り）
- 衝突検出: 既存ノードとの重なり（幅192px × 高64px判定）をチェック。重なれば外側に60pxずつ最大5回再試行

### 11.2 子ノード接続時の直線配置（`addConnectedNode`）

- 親ノードから右 **280px**
- 既存の子ノード数 × **90px** だけ縦にオフセット（重なり回避）
- グループ外分岐では `findFreePosition` を通して既存ノードとの重なりを追加回避（Phase 21）
- エッジ: `source: parentId / sourceHandle: 'right'`、`target: newId / targetHandle: 'left'`

### 11.3 dagre自動整列（`applyDagreLayout`）

- `@dagrejs/dagre` を使用
- `rankdir: 'LR'`（左→右）、`ranksep: 100`、`nodesep: 60`
- ノードサイズ: 192 × 64px
- Toolbar の「整列」ボタン実行後にアニメーション完了コールバックで `fitView({ padding: 0.15, duration: 400 })` でフィット（Phase 21: 瞬間移動→アニメーション付きに変更）

### 11.4 整列アニメーション（`animateNodePositions`）（Phase 21）

`requestAnimationFrame` ループで `from` → `to` の位置を補間。イージング関数 `easeInOutCubic` を使用。完了時に `onDone()` コールバックを呼ぶ。キャンセル関数を返す。

- `Toolbar.tsx` 側: アニメーション途中フレームは `setNodesNoHistory`（履歴なし）で描画し、完了時に `commitNodesWithHistory(original, laid)` で1回だけ履歴に積む
- 多重実行ガード: `animatingRef.current` で実行中フラグを管理

### 11.5 ノード追加位置の重なり回避（`findFreePosition`）（Phase 21）

- `desired` 位置を起点に、フリーノード（`!parentId && type !== 'groupNode'`）との重なり（`|dx| < 200 && |dy| < 80`）を検出
- 重なる間 y を **90px** ずつ下にずらす（最大10回）
- `Toolbar.handleAddNode`: `screenToFlowPosition` で画面中央をフロー座標に変換し、`findFreePosition` を通してから `addNode`
- `mapStore.addConnectedNode`: グループ外分岐の `finalPosition` 決定後に `findFreePosition` を適用

### 11.6 FloatingEdge のラベル・双方向矢印（Phase 21 不具合修正）

`FloatingEdge.tsx` が `label` と `markerStart` を受け取れていなかった不具合を修正。

- `EdgeProps` から `label`・`markerStart` を受け取り、`BaseEdge` に `markerStart={markerStart}` を渡す
- `label` が truthy のとき `EdgeLabelRenderer` で `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` の位置にラベルを描画（白背景・dark対応・`text-xs px-1.5 py-0.5 rounded border shadow-sm`）
- `getBezierPath` の返り値を `[edgePath, labelX, labelY]` の3値で受ける

### 11.7 FloatingEdge のエッジスタイル切替（Phase 21-F）

`FloatingEdge.tsx` が `settingsStore.edgeStyle` を参照し、3種類の描画関数を切り替える。

- `useSettingsStore((s) => s.edgeStyle)` でスタイルを購読（フックは early return より前に呼ぶ）
- `edgeStyle === 'smoothstep'` → `getSmoothStepPath(args)`
- `edgeStyle === 'straight'` → `getStraightPath(args)`
- それ以外（`'bezier'` またはデフォルト）→ `getBezierPath(args)`
- 3関数とも同じ `args` オブジェクトを受け取れるため、引数変換は不要（`straight` は `position` を無視する）
- 設定UIは `SettingsPanel.tsx` の「外観」セクションに3択ボタンとして追加（曲線 / 折れ線 / 直線）

---

## 12. Google Drive連携設計

### 12.1 認証（GIS Token モデル）

- Google Identity Services (GIS) の Token モデルを採用
- クライアントID: `VITE_GOOGLE_CLIENT_ID` 環境変数で管理（ユーザー設定不要）
- スコープ: `https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email`
- アクセストークン取得後、Drive API を直接 fetch
- トークン取得成功時に Google の userinfo エンドポイントへ fetch してメールアドレスを取得。`userEmail: string | null` を `GoogleAuthState` に追加し、`localStorage['googleUserEmail']` に永続化（サインアウト時削除）
- `Header` コンポーネントに `userEmail` を prop で渡し、「接続済み」ボタンのドロップダウンメニューに表示する
- `FileOpenDashboard` の未サインイン時エリアに `localStorage['googleUserEmail']` があれば「前回: xxx@gmail.com」を表示

#### 12.1.1 サイレント再認証（Phase 19）

- `useGoogleAuth` が返す `silentReauth(): void`: `AUTO_AUTH_FLAG === 'true'` かつ `tokenClientRef.current` が存在する場合のみ `requestAccessToken({ prompt: '' })` を呼ぶ。条件不成立の場合は何もしない
- `useAutoSave` が Drive 保存で 401 を受けたとき:
  - 初回 401: `reauthAttemptedRef = true`、`pendingRetryRef = true` を立て `auth.silentReauth()` を呼ぶ。トーストは表示しない
  - `accessToken` が non-null になったとき（再認証成功）: `reauthAttemptedRef = false` にリセットし、`pendingRetryRef === true` なら保存をリトライ
  - サイレント再認証後も 401（`reauthAttemptedRef === true` の再入り）: 「再接続」アクションボタン付きトーストを表示（`auth.signIn` を呼ぶ）

#### 12.1.2 バックグラウンド復帰時のトークン失効チェック（Phase 19）

- `useGoogleAuth` の `isGisReady` effect 内に `visibilitychange` リスナーを追加
- タブが前面に戻ったとき（`document.hidden === false`）、`sessionStorage[TOKEN_EXPIRY_KEY]` を読み、`Date.now() >= expiry`（失効済み: EXPIRY_BUFFER_MS 分の余裕は保存済み）かつ `AUTO_AUTH_FLAG === 'true'` なら `requestAccessToken({ prompt: '' })` を発行（`isAutoAuthRef.current = true` を立てる）

#### 12.1.3 認証エラーメッセージの日本語化（Phase 19）

- `friendlyAuthError(type: string): string | null` を `useGoogleAuth.ts` 内に定義し `error_callback` で使用
- `popup_closed` → `null`（表示しない） / `popup_failed_to_open` → ポップアップブロック案内 / `access_denied` → アクセス拒否案内 / 他 → 「Google認証でエラーが発生しました（{type}）」

### 12.2 フォルダ管理

- フォルダ名: `IdeaMap`（存在しない場合は自動作成）
- フォルダIDはプロセス内メモリキャッシュ（`folderIdCache`）で再取得を防ぐ

### 12.3 ファイル保存戦略

```
Google Drive/
└── IdeaMap/
    └── {title}.json      # マルチパートアップロード（PATCH/POST）
```

- 既存ファイル（fileId あり）: `PATCH` で上書き
- 新規ファイル: `POST` でマルチパートアップロード
- fileId は `uiStore.currentFileId` を単一の真実源とし、`setCurrentFileId` 経由で localStorage（`ideamap-drive-fileid`）に同期する。ロード／新規作成／インポート／保存後／サインアウトはすべてこのアクションを通すため、新規作成時に前マップの fileId が残って別ファイルを上書き消失させる事故を構造的に防ぐ
- 保存時は Drive ファイルの `appProperties: { mapId }` も更新する。`appProperties` は JSON 内容をダウンロードせずに照合できる軽量なメタデータとして衝突チェックに使用

### 12.4 自動保存（src/hooks/useAutoSave.ts）

- `useMapStore.subscribe()`（ノード・エッジ変更）に加え、`useUIStore.subscribe()` で `mapTitle` 変更も監視（差分比較で mapTitle のみ拾い、パネル開閉等の他UI状態変更では保存しない）。両者は同一デバウンスタイマーを共有
- デバウンス: 変更から **3000ms** 後に保存実行
- **手動保存（Phase 20）**: `uiStore.saveRequestId` の変化も購読し、変化時はデバウンスをスキップして即時保存する。`settingsStore.autoSave` が off でも手動保存は常に実行される。トリガーは `Ctrl+S` とヘッダーの保存ステータスクリック
- 保存先 fileId は `uiStore.currentFileId` を参照。`POST` で採番された id は `setCurrentFileId` で反映し、次回以降は同じファイルへ `PATCH`
- 保存優先順位: Google Drive（accessToken あり）→ localStorage（オフライン）。localStorage への保存（`saveMapLocally`）は Drive 保存の成否に関わらず毎回実行される
- 保存ステータスは `uiStore.saveStatus` で管理しヘッダーに表示。表示は「保存済み · Drive」「保存済み · ローカル」形式（`isSignedIn && currentFileId` → Drive）。保存成功時に `uiStore.lastSavedAt` を更新し、ツールチップに最終保存時刻を表示
- **未保存ガード（Phase 20）**: `App.tsx` で `beforeunload` を購読し、`saveStatus` が `unsaved`/`saving` のときタブを閉じる前に警告する

### 12.4.1 ローカル復元とファイルダッシュボード（Phase 20）

- `storageService.loadMapLocally()` は `MapFile | null` を返す（`nodes`/`edges` が配列でない壊れたデータは null）
- `FileOpenDashboard` 最上部に「前回の作業を再開」カードを表示（サインイン・オンライン状態に関係なく表示）。クリックで localStorage のマップを復元する。このとき `currentFileId` は触らない（localStorage から復元済みの値を維持し、同じ Drive ファイルへの保存を継続）
- ダッシュボードは `hasActiveMap` が true のとき右上の X ボタンまたは Esc で閉じられる（初回起動時は閉じる先がないため非表示）
- Drive ファイル一覧の各行に hover で「複製」「削除」ボタンを表示。削除は確認ダイアログ経由で、開いているファイルを削除した場合は `currentFileId`/`currentMapId` をクリアする。複製は新しい `mapId` を採番し、同名ファイルへの PATCH 上書きを避けるため「{title} のコピー (n)」形式で名前を一意化する
- Drive ファイルが8件を超えると名前の部分一致絞り込み input を表示
- **z-index 規約**: ダッシュボード z-60（portal）< ConfirmDialog z-70 < Toast z-80。ダッシュボード上から確認ダイアログ・トーストが使えるようにするための順序

### 12.5 mapId 衝突検出

マップの「論理的同一性」を表す UUID（`mapId`）を利用して、別デバイスや別プロジェクトによる上書き事故を検出する。

**チェックタイミング（API 頻度最適化）:**
- セッション開始後の最初の PATCH 前（`hasCheckedThisSession` ref）
- タブが 60 秒以上バックグラウンドになった後に復帰したとき（`visibilitychange` 監視）

**衝突判定:**
```
fetchMapAppProperties(token, fileId) → { mapId: string | null }
  ↓
remote.mapId ≠ currentMapId → 衝突検出
```

**衝突時の動作:**
1. 自動保存を `isSuspended` フラグで一時停止
2. `saveStatus = 'conflict'`（ヘッダーに「競合あり」オレンジ表示）
3. `ConfirmDialog` に3択ボタンを表示（`ConfirmDialogState.secondaryAction` を利用）:
   - 「最新版を読み込む」: Drive から再ロードして自分の編集を破棄
   - 「上書き保存」（danger）: チェックをスキップして PATCH を強制実行
   - 「キャンセル」: 自動保存停止のまま閉じる

**後方互換:**
- `appProperties.mapId` がない旧ファイルは衝突チェックをスキップし、次回保存時に付与する

---

## 13. キーボードショートカット設計（src/hooks/useKeyboardShortcuts.ts）

| ショートカット | 動作 |
|---|---|
| `Ctrl+S` | 今すぐ保存（テキスト入力中・モーダル表示中でも有効。ブラウザの保存ダイアログを抑止） |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Ctrl+C` | 選択中ノードをクリップボードにコピー |
| `Ctrl+V` | ペースト（36px オフセット） |
| `Delete` / `Backspace` | 選択中ノード・エッジを削除（確認なし） |
| `Tab` | 選択ノードから接続された子ノードを作成 |
| `Ctrl+F` | 検索バーをトグル |
| `Ctrl+/` | キーボードショートカット一覧を表示 |
| `Ctrl+Shift+C` | AIチャットパネルをトグル |
| `Ctrl+P` | 発表モード開始（発表リストが空のとき無効） |

**発表モード中のショートカット（他はすべてブロック）:**

| ショートカット | 動作 |
|---|---|
| `→` / `Space` | 次のノードへ移動 |
| `←` | 前のノードへ戻る |
| `Esc` | 発表モードを終了 |

**抑制条件**（以下が表示中はショートカットを無効化）:
- 設定パネル（`isSettingsOpen`）
- マップ一覧パネル（`isMapListOpen`）
- 確認ダイアログ（`confirmDialog`）
- 右クリックメニュー（`contextMenu`）
- フォーカスが `input` / `textarea` / `contentEditable` 上

---

## 14. テーマ設計

- `settingsStore.theme: 'light' | 'dark'`
- `App.tsx` の `useEffect` で `document.documentElement.classList` に `dark` を付け外し
- Tailwind CSS の `dark:` バリアントで全コンポーネントのダーク対応
- 初期値・永続化: `settingsStore` が localStorage から復元

### Phase 24 によるダーク対応の全面化

Phase 24 で Toolbar / BottomNav / IdeaCanvas（NodeActionBar・空状態・Background）/ WelcomeModal にダーク対応を追加し、全 UI で配色が統一された。

- **React Flow 組み込みUI**: `<ReactFlow colorMode={theme}>` を追加。Controls / MiniMap / その他の組み込みUIが自動的にダーク化される。border/bg が浮く箇所は `className` の三項演算子で最小限上書き（`!border-gray-700 !bg-gray-800` 等）。
- **Background ドット色**: `<Background color={theme === 'dark' ? '#374151' : '#e5e7eb'}>` でテーマに合わせてドット色を出し分ける。背景そのものは `index.css` の `.dark .react-flow__background` が担当。
- **配色基準**: Header.tsx / ContextMenu.tsx の既存パターン（`bg-white dark:bg-gray-800`、ボタン `text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700` 等）に全コンポーネントを統一。

---

## 16. 大規模マップのパフォーマンス（Phase 24）

### 16.1 onlyRenderVisibleElements

`<ReactFlow onlyRenderVisibleElements={!renderAllNodes}>` を有効化し、ビューポート外のノードの DOM 描画をスキップする。ノード数が多いマップでのパン・ズームの描画負荷を軽減する。

### 16.2 エクスポート干渉対策（renderAllNodes フラグ）

`exportService` の画像エクスポートは `.react-flow__viewport` の DOM を直接 html-to-image で撮影する。`onlyRenderVisibleElements` が有効な状態では画面外ノードが DOM から除外されるため、「マップ全体」モードでエクスポートすると画面外ノードが欠落する。

**対策**: `uiStore.renderAllNodes` フラグを用意し、`ExportImportPanel.handleImageExport` が以下の手順で切り替える。
1. 撮影前に `setRenderAllNodes(true)` を呼ぶ
2. React Flow が全ノードを DOM に描画するのを待つ（2フレーム分の `requestAnimationFrame` を await）
3. `exportMapAsImage(...)` を実行
4. `finally` ブロックで `setRenderAllNodes(false)` に戻す（成功・失敗どちらでも戻す）

---

## 15. ノードカラーパレット

全コンポーネントで共通の8色パレット:

| 色 | Hex | 用途（目安） |
|---|---|---|
| 白 | `#ffffff` | デフォルト |
| 紫 | `#e0e7ff` | メインアイデア（デフォルトroot） |
| 青 | `#dbeafe` | 参考情報 |
| 緑 | `#d1fae5` | アクション |
| 黄 | `#fef3c7` | 問い・疑問 |
| ピンク | `#fce7f3` | 感情・直感 |
| 赤 | `#ffe4e6` | 懸念・リスク |
| グレー | `#f3f4f6` | その他 |
