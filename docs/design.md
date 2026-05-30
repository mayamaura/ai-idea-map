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
│   │   │   ├── NodePanel.tsx       # ノード選択時のサイドパネル
│   │   │   ├── AISuggestionPanel.tsx # AI提案表示パネル
│   │   │   ├── SettingsPanel.tsx   # 設定パネル
│   │   │   └── MapListPanel.tsx    # マップ一覧パネル
│   │   ├── toolbar/
│   │   │   ├── Toolbar.tsx         # ツールバー（PC用）
│   │   │   └── BottomNav.tsx       # ボトムナビ（スマホ用）
│   │   └── common/
│   │       ├── Header.tsx
│   │       ├── Modal.tsx
│   │       ├── Toast.tsx
│   │       ├── ConfirmDialog.tsx
│   │       └── LoadingSpinner.tsx
│   ├── stores/
│   │   ├── mapStore.ts             # マップ状態（ノード・エッジ・Undo/Redo）
│   │   ├── settingsStore.ts        # 設定状態（APIキー・テーマ・自動保存）
│   │   └── uiStore.ts              # UI状態（パネル開閉・コンテキストメニュー等）
│   ├── services/
│   │   ├── claudeService.ts        # Claude API呼び出し
│   │   ├── googleDriveService.ts   # Google Drive API操作
│   │   └── storageService.ts       # localStorageのラッパー
│   ├── hooks/
│   │   ├── useAutoSave.ts          # 自動保存フック
│   │   ├── useGoogleAuth.ts        # Googleログイン状態管理
│   │   └── useKeyboardShortcuts.ts # キーボードショートカット
│   ├── types/
│   │   └── index.ts                # 型定義
│   └── utils/
│       ├── mapLayout.ts            # ノード自動配置ロジック（dagre・円形配置）
│       └── encryption.ts           # APIキーの暗号化・復号（AES-GCM）
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
| `clipboard` | `IdeaNode[]` | コピー用クリップボード |

主要アクション:
- `addNode`, `addConnectedNode` — ノード追加
- `updateNodeText`, `updateNodeColor` — ノード更新
- `deleteNode`, `deleteNodes`, `deleteSelected`, `deleteNodeEdges` — 削除系
- `reverseEdge`, `toggleEdgeDirection`, `updateEdgeLabel`, `deleteEdge` — エッジ操作
- `copyNodes`, `paste` — コピー・ペースト
- `undo`, `redo` — 履歴操作
- `loadFromSerialized`, `getSerializedNodes`, `getSerializedEdges` — シリアライズ

### 4.2 uiStore（src/stores/uiStore.ts）

UIの表示状態を管理する。副作用なし。

| 状態 | 型 | 説明 |
|------|-----|------|
| `selectedNodeId` | `string \| null` | 現在選択中のノードID |
| `isSettingsOpen` | `boolean` | 設定パネルの開閉 |
| `isAIPanelOpen` | `boolean` | AI提案パネルの開閉 |
| `isMapListOpen` | `boolean` | マップ一覧パネルの開閉 |
| `aiSuggestions` | `AISuggestion[]` | AI提案リスト |
| `isAILoading` | `boolean` | AI呼び出し中フラグ |
| `saveStatus` | `SaveStatus` | `saved \| saving \| unsaved \| error` |
| `mapTitle` | `string` | 現在のマップタイトル |
| `toasts` | `Toast[]` | トースト通知リスト（4秒後自動削除） |
| `contextMenu` | `ContextMenuState \| null` | 右クリックメニューの表示状態 |
| `confirmDialog` | `ConfirmDialogState \| null` | 確認ダイアログの表示状態 |

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

---

## 5. コンポーネント設計

### 5.1 App（src/App.tsx）

`ReactFlowProvider` でアプリ全体をラップ。`AppInner` で以下のフックを最上位でマウント:
- `useKeyboardShortcuts()` — グローバルキーイベント
- `useAutoSave(accessToken)` — マップ変更監視と自動保存
- `useGoogleAuth()` — Google認証状態管理

テーマ適用: `settingsStore.theme` に応じて `<html>` の `dark` クラスを切替。

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

**インライン編集:**
- ダブルクリックで `textarea` に切替
- Enter（Shiftなし）または blur で確定
- Escape でキャンセル（元テキストに戻す）

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
| node | アイデアを作成（接続）/ AIで拡張 / コピー / 色を変更 / 接続線のみ削除 / ノードを削除 |
| edge | 向きを反転 / 双方向切替 / ラベルを編集 / 線を削除 |
| pane | アイデアを作成 / ここに貼り付け |

### 5.5 WelcomeModal（src/components/common/WelcomeModal.tsx）

初回起動時のみ表示。`localStorage.getItem('ideamap-welcomed')` がなければ表示し、閉じ時にセット。  
3ステップ（アイデア追加 / 接続 / AI拡張）のスライドモーダル。`createPortal` で `<body>` に描画。

### 5.6 ConfirmDialog（src/components/common/ConfirmDialog.tsx）

接続線があるノード削除時のみ表示。  
- `Enter` → 確認、`Escape` → キャンセル（ショートカット有効）
- `confirmDialog` 表示中はキャンバス操作ショートカット全体を抑制

---

## 6. 型定義（src/types/index.ts）

```typescript
interface IdeaNodeData extends Record<string, unknown> {
  text: string
  color: string        // hex カラーコード
  createdBy: 'user' | 'ai'
}

interface MapFile {
  version: string
  title: string
  createdAt: string    // ISO 8601
  updatedAt: string    // ISO 8601
  nodes: SerializedNode[]
  edges: SerializedEdge[]
}

interface SerializedNode {
  id: string
  text: string
  x: number; y: number
  color: string
  createdBy: 'user' | 'ai'
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
  text: string
  type: '関連' | '深掘り' | '対比' | '応用'
}

type Theme = 'light' | 'dark'
type AIModel = 'claude-sonnet-4-6' | 'claude-haiku-4-5-20251001'
type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'
type NodeShape = 'rounded' | 'ellipse' | 'hexagon'
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
- エッジ: `source: parentId / sourceHandle: 'right'`、`target: newId / targetHandle: 'left'`

### 11.3 dagre自動整列（`applyDagreLayout`）

- `@dagrejs/dagre` を使用
- `rankdir: 'LR'`（左→右）、`ranksep: 100`、`nodesep: 60`
- ノードサイズ: 192 × 64px
- Toolbar の「整列」ボタン実行後に `fitView({ padding: 0.15, duration: 400 })` でフィット

---

## 12. Google Drive連携設計

### 12.1 認証（GIS Token モデル）

- Google Identity Services (GIS) の Token モデルを採用
- クライアントID: `VITE_GOOGLE_CLIENT_ID` 環境変数で管理（ユーザー設定不要）
- スコープ: `https://www.googleapis.com/auth/drive.file`
- アクセストークン取得後、Drive API を直接 fetch

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
- ファイルIDは localStorage の `driveFileId` キーにキャッシュ

### 12.4 自動保存（src/hooks/useAutoSave.ts）

- `useMapStore.subscribe()` でストア変更を監視
- デバウンス: 変更から **3000ms** 後に保存実行
- 保存優先順位: Google Drive（accessToken あり）→ localStorage（オフライン）
- 保存ステータスは `uiStore.saveStatus` で管理しヘッダーに表示

---

## 13. キーボードショートカット設計（src/hooks/useKeyboardShortcuts.ts）

| ショートカット | 動作 |
|---|---|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Ctrl+C` | 選択中ノードをクリップボードにコピー |
| `Ctrl+V` | ペースト（36px オフセット） |
| `Delete` / `Backspace` | 選択中ノード・エッジを削除（確認なし） |
| `Tab` | 選択ノードから接続された子ノードを作成 |

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
