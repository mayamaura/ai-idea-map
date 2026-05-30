# アイデア拡張メモアプリ 実装計画書

**作成日**: 2026-05-27  
**バージョン**: 1.0

---

## 1. 技術スタック

### 1.1 フロントエンド
| 分類 | 採用技術 | 理由 |
|------|----------|------|
| フレームワーク | **React 18 + TypeScript** | 型安全、大規模コンポーネント管理に適する |
| ビルドツール | **Vite** | 高速な開発サーバー、軽量バンドル |
| マインドマップ | **React Flow** | ノード・エッジの管理が容易、スマホ対応、豊富なAPI |
| スタイリング | **Tailwind CSS** | レスポンシブ対応が容易、ユーティリティファーストで高速開発 |
| 状態管理 | **Zustand** | シンプルで軽量、React Flowとの親和性が高い |
| AI連携 | **Anthropic SDK (@anthropic-ai/sdk)** | 公式SDK、型安全 |
| Googleドライブ | **Google API Client (gapi)** | 公式クライアント |
| ユニークID | **uuid** | ノード・エッジのID生成 |

### 1.2 ホスティング
- **Vercel** または **GitHub Pages**（静的サイトホスティング）
- GitHub Actions でCI/CD自動デプロイ

---

## 2. プロジェクト構成

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
│   │   │   └── IdeaEdge.tsx        # カスタムエッジコンポーネント
│   │   ├── panels/
│   │   │   ├── NodePanel.tsx       # ノード選択時のサイドパネル
│   │   │   ├── AISuggestionPanel.tsx # AI提案表示パネル
│   │   │   └── SettingsPanel.tsx   # 設定パネル
│   │   ├── toolbar/
│   │   │   ├── Toolbar.tsx         # ツールバー（PC用）
│   │   │   └── BottomNav.tsx       # ボトムナビ（スマホ用）
│   │   └── common/
│   │       ├── Header.tsx
│   │       ├── Modal.tsx
│   │       └── LoadingSpinner.tsx
│   ├── stores/
│   │   ├── mapStore.ts             # マップ状態（ノード・エッジ）
│   │   ├── settingsStore.ts        # 設定状態（APIキーなど）
│   │   └── uiStore.ts              # UI状態（パネル開閉など）
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
│       ├── mapLayout.ts            # ノード自動配置ロジック
│       └── encryption.ts           # APIキーの暗号化・復号
├── .env.example
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

---

## 3. 実装フェーズ

### Phase 1: 基盤構築（約2日） ✅ 完了（2026-05-27）

**目標**: アプリが起動してマインドマップが表示される状態

#### タスク
- [x] Vite + React + TypeScript プロジェクト初期化
- [x] Tailwind CSS セットアップ
- [x] React Flow インストールと基本設定
- [x] Zustand ストア初期設計（mapStore, settingsStore, uiStore）
- [x] カスタムノードコンポーネント（IdeaNode）の実装
  - テキスト表示・インライン編集
  - 色設定
  - 「AIノード」の視覚的区別（背景色やアイコン）
- [x] 基本キャンバス操作（パン、ズーム、ノード追加・削除）
- [x] ヘッダー・ツールバーのUI実装
- [x] レスポンシブ対応（スマホ用BottomNav）

**完了条件**: ノードを追加・編集・削除・移動でき、線でつなげる

---

### Phase 2: 設定 & API連携（約2日） ✅ 完了（2026-05-27）

**目標**: Claude APIが呼び出せる状態

#### タスク
- [x] 設定パネルUI（SettingsPanel）の実装
- [x] APIキーの入力・保存（localStorage暗号化）
  - `encryption.ts` で AES-GCM 暗号化
  - settingsStore にAPIキー・モデル設定を保持
- [x] Claude APIサービス（claudeService.ts）の実装
  - `@anthropic-ai/sdk` を使用
  - プロンプト設計（ノードのコンテキストを含めた提案依頼）
  - エラーハンドリング（APIキー未設定、レート制限、タイムアウト）
- [x] ノード選択パネル（NodePanel）の実装
  - 「AIに拡張を依頼」ボタン
  - ノード編集・削除・色変更UI
- [x] AI提案パネル（AISuggestionPanel）の実装
  - 提案一覧表示（チェックボックス選択）
  - 「追加」「再生成」ボタン
  - ローディング表示
- [x] 選択した提案を新ノードとして追加するロジック
  - 親ノードの右側/下側に自動配置（`mapLayout.ts`）

**完了条件**: ノードを選択してAIに拡張依頼→提案を選択→マップに追加できる

---

### Phase 3: Googleドライブ連携（約2日） ✅ 完了（2026-05-27）

**目標**: データをGoogleドライブに保存・読み込みできる状態

#### タスク

- [x] Google Cloud Project 設定（`VITE_GOOGLE_CLIENT_ID` 環境変数でクライアントIDを管理）
- [x] Google Identity Services (GIS) のセットアップ（index.html にスクリプト追加）
- [x] useGoogleAuth フックの実装（src/hooks/useGoogleAuth.ts）
  - サインイン・サインアウト
  - GIS Token モデルによる認証
  - 認証状態の保持
- [x] googleDriveService.ts の実装（src/services/googleDriveService.ts）
  - ファイル一覧取得（IdeaMapフォルダ内）
  - ファイル作成・更新（マルチパートアップロード）
  - ファイル読み込み
  - ファイル削除
- [x] storageService.ts の実装（src/services/storageService.ts）
  - localStorage への保存・読み込みラッパー
  - Drive ファイルIDのキャッシュ
- [x] マップ管理UI（src/components/panels/MapListPanel.tsx）
  - マップ一覧画面（既存マップの読み込み）
  - 新規作成ボタン
  - マップ削除ボタン
- [x] useAutoSave フックの実装（src/hooks/useAutoSave.ts）
  - 変更検知（Zustandのsubscribe）
  - デバウンス（3秒後に自動保存）
  - 保存状態の表示（「保存中...」「保存済み」）
- [x] オフライン時のフォールバック（localStorageに自動保存）
- [x] Header に Google Drive ボタン追加（接続・切断・マップ一覧）
- [x] ~~設定パネルに Google Client ID 入力フォーム追加~~ → アプリ共通の Client ID を環境変数で管理する方式に変更

**完了条件**: Googleドライブにマップが保存・読み込みできる

---

### Phase 4: UX改善 & 仕上げ（約2日） ✅ 完了（2026-05-27）

**目標**: 実用的なアプリとしての完成度

#### タスク
- [x] キーボードショートカット（Delete削除、Ctrl+Z 元に戻す、Ctrl+Y やり直し）
- [x] Undo/Redo機能（mapStoreに過去/未来スナップショット履歴管理）
- [x] ノードの自動整列ボタン（dagre レイアウトアルゴリズム + fitView）
- [x] ミニマップの実装（React Flowのビルトイン）
- [x] ダーク/ライトテーマ切替（ヘッダーのボタンで切替、設定に永続化）
- [x] スマホタッチ操作の最適化（ロングプレス500msでAIパネル、ピンチはReact Flow標準で対応済み）
- [x] エラー表示（トースト通知：Drive保存失敗など、4秒後自動消滅）
- [x] AIノードの視覚的区別（✦アイコン + パルスアニメーション）
- [x] パフォーマンス最適化（IdeaNodeをReact.memoでラップ）
- [x] README.md の作成（Phase 3時点で作成済み）

**完了条件**: 全機能が実用レベルで動作する

---

## 4. 重要な技術的設計

### 4.1 Claude API プロンプト設計

```typescript
const buildPrompt = (selectedNode: Node, context: MapContext) => `
あなたはアイデア発想の専門家です。
以下のアイデアを起点に、関連する新しいアイデアを${count}個提案してください。

【選択されたアイデア】
${selectedNode.text}

【つながっているアイデア】
${context.connectedNodes.map(n => `- ${n.text}`).join('\n')}

【マップ全体のテーマ（参考）】
${context.allNodes.slice(0, 10).map(n => `- ${n.text}`).join('\n')}

以下のJSON形式で回答してください：
{
  "suggestions": [
    {"text": "アイデア1", "type": "関連"},
    {"text": "アイデア2", "type": "深掘り"},
    ...
  ]
}
`;
```

### 4.2 APIキーの暗号化

```typescript
// Web Crypto APIを使ってlocalStorageの値を保護
// キーはユーザーのブラウザフィンガープリントから導出
const encrypt = async (text: string): Promise<string> => {
  const key = await deriveKey();
  const encoded = new TextEncoder().encode(text);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  return btoa(String.fromCharCode(...iv, ...new Uint8Array(encrypted)));
};
```

### 4.3 ノード自動配置ロジック

AI提案ノードの配置：
- 親ノードの周囲に円形配置（半径200px）
- 既存ノードと重ならないよう衝突検出
- アニメーション付きで配置（React Flowのtransition）

### 4.4 Googleドライブ保存戦略

```
Googleドライブ/
└── IdeaMap/           # アプリ専用フォルダ（自動作成）
    ├── map_001.json
    ├── map_002.json
    └── ...
```

- ファイル名: `map_{タイトル}_{YYYYMMDD}.json`
- 変更のたびに同じファイルを上書き（新バージョンは作らない）
- ファイルIDをlocalStorageにキャッシュして高速アクセス

---

## 5. Google Cloud Project 設定（開発者向け）

> **変更点**: クライアントIDをユーザーが設定パネルに入力する方式から、アプリ共通の環境変数で管理する方式に変更しました。ユーザーは自分の Google アカウントでサインインするだけで Drive 連携が使えます。

1. [Google Cloud Console](https://console.cloud.google.com) でプロジェクト作成
2. Google Drive API を有効化
3. OAuth 2.0 クライアントIDを作成（ウェブアプリケーション）
4. 承認済みのJavaScript生成元にアプリのURLを追加（例: `https://<username>.github.io`）
5. クライアントIDを `.env` および GitHub Variables に設定:
   ```
   VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
   ```

---

## 6. 開発環境セットアップ

```bash
# プロジェクト作成
npm create vite@latest ideamap -- --template react-ts
cd ideamap

# 依存関係インストール
npm install @xyflow/react zustand @anthropic-ai/sdk uuid
npm install -D tailwindcss postcss autoprefixer @types/uuid
npx tailwindcss init -p

# 開発サーバー起動
npm run dev
```

---

### Phase 5: 右クリックメニュー & インタラクション全面改善（約3日） ✅ 完了（2026-05-30）

**目標**: マウス操作だけで全操作が完結するUXの実現

#### 設計判断：エッジに向きを持たせる

**採用：有向エッジ（矢印付き）をデフォルトとする**

理由：
- AI提案ノードは常に「親から子」の方向で生成されるため、方向が自然に一致する
- dagreレイアウトアルゴリズムが有向グラフを前提としており整合性がある
- 起点ノード（入力エッジなし）が視覚的に自明になる
- 思考の派生・展開という概念は方向性を持つ

設計方針：
- 矢印マーカーは細くシンプルに（視覚的な圧迫感を抑える）
- エッジ右クリックで「双方向」「無向」に変更可能
- （設定でマップ全体のトグルは Phase 6 以降へ持ち越し）

#### タスク

**右クリックコンテキストメニュー** (`src/components/canvas/ContextMenu.tsx`)
- [x] キャンバス右クリック → 「アイデアを作成」「ここに貼り付け（マウス位置）」
- [x] ノード右クリック → 「アイデアを作成（接続）」「AI拡張」「コピー」「色を変更」「接続線のみ削除」「ノードを削除」
  - ※「カテゴリを変更」「詳細を開く」は Phase 7 で追加予定
- [x] エッジ右クリック → 「向きを反転」「双方向⇄単方向」「ラベルを編集」「線を削除」
- [x] Escキーでメニューを閉じる、メニュー外クリックで閉じる
- [x] React Portalで `<body>` 直下にレンダリング（z-index問題を回避）
- [x] 登場アニメーション（`animate-context-menu`）

**ノード削除UX改善**
- [x] DELキー以外の削除手段：右クリックメニュー、Backspaceキー、ツールバーボタン（選択時のみ有効）
- [x] 複数選択状態での一括削除（DEL / Backspace）
- [x] 削除確認モーダル（接続線がある場合のみ表示）（`src/components/common/ConfirmDialog.tsx`）
- [x] 「接続エッジのみ削除」オプション（ノード自体は残す）
- [x] 副次修正：旧来のDeleteキー削除（React Flow組み込み）がUndoできなかったバグを修正 → storeに一元化

**ハンドル改善：全方向接続対応**
- [x] IdeaNode の Handle を全4方向（Top/Right/Bottom/Left）に配置し、`ConnectionMode.Loose` で source/target 兼用 → 任意方向から接続可能
- [x] ホバー時・選択時・接続操作中のみハンドルを表示（通常時は非表示でスッキリ）
- [x] ハンドルホバー時のスケールアップ演出
- [x] 後方互換：旧保存データのハンドルID未指定エッジは `right→left` をデフォルトにフォールバック

**ノード作成UX改善**
- [x] 選択ノードから `Tab` キーで接続された子ノードを作成（既存の子数に応じてY位置をオフセット）
- [x] ノード右クリックメニュー「アイデアを作成（接続）」で右隣に新ノードを追加
- [ ] ツールバーの「追加」ボタンを「選択ノードの子として追加」「独立して追加」に分岐（未実装・Phase 6 で対応）

**マルチセレクト & コピー・ペースト**
- [x] Shift+クリック / ドラッグ範囲選択で複数選択（React Flow の組み込み機能を有効化）
- [x] Ctrl+C でコピー、Ctrl+V でペースト（マウス位置への座標指定ペーストに対応）
- [x] 複数選択ノードの一括移動・削除

**有向エッジの実装**
- [x] `mapStore.onConnect` に `markerEnd: { type: MarkerType.ArrowClosed }` を追加
- [x] `reverseEdge`（向き反転）・`toggleEdgeDirection`（双方向切替）・`updateEdgeLabel`・`deleteEdge` アクションを追加
- [x] エッジを「双方向」にする場合は `markerStart` と `markerEnd` 両方に矢印
- ※ `IdeaEdge.tsx` カスタムエッジは不要と判断 → エッジデータ操作＋右クリックメニューで同等機能を実現

**その他（追加実装）**
- [x] モーダル・確認ダイアログ表示中はキャンバス操作ショートカットを抑制（誤削除防止）
- [x] `ConfirmDialog` に Enter キーで確認、Escキーでキャンセルのキーボード対応

**完了条件**: マウスのみで全操作（作成・接続・削除・AI拡張・カテゴリ変更）が完結する ✅

---

### Phase 6: 放射状レイアウト & ビジュアルデザイン向上（約2日）

**目標**: 見た目と配置のデフォルトをアイデアマップらしく刷新

#### タスク

**放射状レイアウトをデフォルトに**
- [ ] `mapLayout.ts` に `applyRadialLayout` を追加（d3-force または手動計算）
  - ルートノード（入力エッジなし）を中心に配置
  - 子ノードをルート中心から放射状に等間隔配置（角度計算）
  - 孫ノードは親を中心として更に外周に配置（階層ごとに半径を拡大）
- [ ] ツールバーの「自動整列」ボタンを「放射状（デフォルト）」「左→右 (dagre)」「上→下 (dagre)」の3択に変更
- [ ] 新規マップ作成時のデフォルトは放射状

**ノードビジュアルの向上**
- [ ] ノードのカード形状オプション：角丸四角形（現在）、楕円、六角形
- [ ] ノードサイズを内容に応じて自動調整（テキスト量に応じてmax-w を拡大）
- [ ] アニメーション：ノード追加時にスケールアップで登場（Tailwind `animate-bounce` → `animate-in zoom-in`）
- [ ] エッジのスタイル：デフォルトを `smoothstep` に変更（折れ線より見栄えよい）
- [ ] フォーカスモード：選択ノードとその直接接続のみを明るく表示、他はダウン

**スタートアップ体験**
- [ ] 初回起動時のウェルカム画面（使い方ヒントを3ステップで表示）
- [ ] マップが空の場合のエンプティ状態UI（「ダブルクリックでアイデアを追加」ガイド表示）

**完了条件**: 新規作成マップが放射状に広がり、操作ヒントが表示される

---

### Phase 7: ノードのリッチコンテンツ & カテゴリシステム（約4日）

**目標**: アイデアに情報量を持たせ、カテゴリによる分類を実現

#### タスク

**ノードデータ拡張** (`src/types/index.ts`, `mapStore.ts`)
- [ ] `IdeaNodeData` に `title: string`、`body?: string` を追加（`text` → `title` にリネーム、マイグレーション対応）
- [ ] `SerializedNode` も同様に拡張
- [ ] `claudeService.ts` のプロンプトをタイトル＋本文で構築するよう更新

**ノード詳細パネル / モーダル** (`src/components/panels/NodeDetailPanel.tsx`)
- [ ] ノードをダブルクリック or 右クリック「詳細を開く」でサイドパネルを表示
- [ ] タイトル編集（既存インライン編集をここに統合）
- [ ] 本文エディタ（Markdown対応のテキストエリア、プレビュートグル）
- [ ] 本文があるノードにはアイコン（📝）を表示してインジケーター
- [ ] ノードカードに本文の冒頭2行をプレビュー表示（折り畳み）

**カテゴリシステム** (`src/stores/settingsStore.ts`, `src/components/panels/CategoryPanel.tsx`)
- [ ] カテゴリの型定義：`{ id, name, color, icon, description }`
- [ ] デフォルトカテゴリの用意:

  | カテゴリ | 色 | アイコン | 用途 |
  |----------|-----|---------|------|
  | メインアイデア | 藍色 `#e0e7ff` | 💡 | マップの核心 |
  | 問い・疑問 | 黄色 `#fef3c7` | ❓ | 未解決の問い |
  | アクション | 緑色 `#d1fae5` | ✅ | 実行すべきタスク |
  | 参考・情報 | 水色 `#dbeafe` | 📚 | 参照情報 |
  | 感情・直感 | ピンク `#fce7f3` | ❤️ | 感情的な気づき |
  | 懸念・リスク | 赤色 `#ffe4e6` | ⚠️ | 問題点・課題 |
  | 未分類 | 白 `#ffffff` | ○ | デフォルト |

- [ ] `settingsStore` に `categories: Category[]` を追加（永続化）
- [ ] カテゴリ管理パネル（設定画面内）：追加・編集・削除・色変更・アイコン変更
- [ ] ノードの色ピッカーをカテゴリ選択UIに刷新（カテゴリ名 + カラーサークル）
- [ ] カテゴリ変更時に `IdeaNodeData.categoryId` を更新、ノードの `color` はカテゴリから派生
- [ ] AI提案ノードのカテゴリ自動判定（Claudeがsuggestion生成時に `category` フィールドも返す）

**完了条件**: ノードにタイトル＋本文が書け、カテゴリで色分けされたマップが作れる

---

### Phase 8: 検索 & フィルタリング（約2日）

**目標**: ノード数が増えても目的のアイデアに素早くアクセスできる

#### タスク

**テキスト検索** (`src/components/common/SearchBar.tsx`)
- [ ] Ctrl+F でサーチバーをトグル表示（キャンバス上部にオーバーレイ）
- [ ] 入力に応じてリアルタイムでノードをハイライト（マッチしたノードは明るく、非マッチはdim）
- [ ] マッチ数表示（例：「3 / 12件」）
- [ ] `↑` `↓` キー or 「次へ」ボタンでマッチノード間を順にfitView移動
- [ ] タイトルと本文の両方を検索対象に

**カテゴリフィルター**
- [ ] ツールバーにカテゴリフィルターチップを追加（全カテゴリをトグルボタンで表示）
- [ ] フィルター中は非対象カテゴリのノードをdimまたは非表示
- [ ] 複数カテゴリの同時フィルター（OR条件）

**ノードジャンプ**
- [ ] 検索結果のリストビュー（サイドパネル）：タイトル一覧、クリックでfitView移動
- [ ] 最近編集したノードのクイックアクセス

**完了条件**: テキストで検索してノードにジャンプできる。カテゴリでフィルタリングできる

---

### Phase 9: エクスポート & インポート（約2日）

**目標**: マップを他の形式で活用・共有できる

#### タスク

**エクスポート**
- [ ] PNG / SVG エクスポート（`html-to-image` ライブラリ使用）
  - 背景込み or 透過の選択
  - 現在のビューポート or マップ全体の選択
  - DPI指定（標準/高解像度）
- [ ] JSON エクスポート（`MapFile` 形式をそのままダウンロード）
- [ ] Markdown エクスポート（ノードをツリー構造のMarkdownに変換）
  - ルートノードから階層的にリスト形式で出力
  - 本文がある場合はインデントして追記

**インポート**
- [ ] JSON ファイルアップロードでマップをインポート（バージョン互換チェック付き）
- [ ] インポート時の確認ダイアログ（「現在のマップを置き換えますか？」）
- [ ] クリップボードからMarkdown/テキストをペーストしてノードを一括作成（行 → ノード）

**共有**
- [ ] マップをURLパラメーターにエンコードして共有リンク生成（読み取り専用、小〜中規模マップ向け）
- [ ] 「リンクをコピー」ボタン（base64エンコードでマップデータをURLに埋め込み）

**完了条件**: マップをPNGで保存・共有でき、JSONで別デバイスにインポートできる

---

### Phase 10: AI高度化（約3日）

**目標**: AIをただのアイデア提案係から「思考パートナー」にレベルアップ

#### タスク

**マップ全体の分析**
- [ ] 「マップを分析」ボタン（ヘッダー or ツールバー）
- [ ] Claude がマップ全体のノード・エッジ構造を解析し：
  - マップの主要テーマを1文で要約
  - 見落としているアイデア領域の指摘
  - 最も重要と思われるノードのハイライト提案
- [ ] 分析結果をサイドパネルに表示（コピー可能なテキスト）

**接続提案（関連ノードの自動発見）**
- [ ] 「つながりを探す」機能：既存ノード間で接続されていないが関連性が高いペアをClaudeが提案
- [ ] 提案されたペアを点線エッジでプレビュー表示し、ユーザーが承認/却下
- [ ] 承認したエッジを「AI提案エッジ」として追加（色を変えて区別）

**クラスタリング提案**
- [ ] 「グループ化を提案」機能：Claudeがノードをテーマ別にグループ分け提案
- [ ] 提案されたグループをカテゴリとして一括適用できる

**AIプロンプトの改善**
- [ ] ノードの本文（`body`）もコンテキストとして提供
- [ ] カテゴリ情報も提供（「このノードはアクション種別」など）
- [ ] 生成する提案数をユーザーが設定可能（3〜10件）
- [ ] 提案の「種別」（関連・深掘り・対比・応用）ごとにフィルタリング

**完了条件**: マップ全体の分析と接続提案をAIに依頼できる

---

## 7. スケジュール概要

| フェーズ | 内容 | 目安期間 |
|----------|------|----------|
| Phase 1 | 基盤構築（マインドマップUI） | 2日 |
| Phase 2 | AI（Claude）連携 | 2日 |
| Phase 3 | Googleドライブ連携 | 2日 |
| Phase 4 | UX改善・仕上げ | 2日 |
| Phase 5 | 右クリックメニュー & インタラクション全面改善 | 3日 ✅ |
| Phase 6 | 放射状レイアウト & ビジュアルデザイン向上 | 2日 |
| Phase 7 | ノードリッチコンテンツ & カテゴリシステム | 4日 |
| Phase 8 | 検索 & フィルタリング | 2日 |
| Phase 9 | エクスポート & インポート | 2日 |
| Phase 10 | AI高度化 | 3日 |
| **Phase 1-4 合計** | | **約8日** |
| **Phase 5-10 合計** | | **約16日** |
| **全体合計** | | **約24日** |

---

## 8. リスクと対策

| リスク | 対策 |
|--------|------|
| Claude APIのCORS制限 | Anthropic SDKはブラウザから直接呼び出し可能（CORS対応済み） |
| Google OAuthの設定ミス | セットアップ手順書を詳細に用意、エラーメッセージをわかりやすく表示 |
| スマホでのReact Flowパフォーマンス | ノード数が多い場合は仮想化、タッチイベントの最適化 |
| APIキーの漏洩リスク | localStorageに暗号化して保存、サーバーには一切送信しない旨を明示 |
| Googleドライブの競合 | 自動保存はデバウンス処理+楽観的更新で対応 |
| Phase 7でのデータ移行 | `text` → `title` のリネーム時は旧フォーマットの読み込み互換処理を実装 |
| URLエンコード共有のサイズ限界 | base64エンコードのURLはブラウザの制限（約2KB）があるため、大マップはDriveリンクを推奨する旨を表示 |
| 放射状レイアウトの計算精度 | ノード数が多い場合のオーバーラップを防ぐため、衝突検出ループを既存の `calcSuggestionPositions` から流用して拡張する |
