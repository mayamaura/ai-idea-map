# アイデア拡張メモアプリ 実装計画書

**作成日**: 2026-05-27
**バージョン**: 1.0

> 技術スタック・プロジェクト構成・技術的設計は [design.md](design.md) を参照。

---

## 1. 実装フェーズ

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
  - 親ノードの周囲に円形配置（`mapLayout.ts`）

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

### Phase 6: 放射状レイアウト & ビジュアルデザイン向上（約2日） ✅ 完了（2026-05-30）

**目標**: 見た目と配置のデフォルトをアイデアマップらしく刷新

#### タスク

**放射状レイアウトをデフォルトに**
- [x] `mapLayout.ts` に `applyRadialLayout` を追加（手動計算・BFS+サブツリーサイズ比で角度配分）
  - ルートノード（入力エッジなし）を中心に配置
  - 子ノードをルート中心から放射状に等間隔配置（角度計算）
  - 孫ノードは親を中心として更に外周に配置（階層ごとに半径を拡大）
- [x] ツールバーの「自動整列」ボタンを「放射状（デフォルト）」「左→右 (dagre)」「上→下 (dagre)」の3択ドロップダウンに変更
- [x] `applyDagreLayout` に `rankdir` 引数を追加し TB レイアウトも対応

**ノードビジュアルの向上**
- [x] ノードのカード形状オプション：角丸四角形（現在）、楕円、六角形（`settingsStore.nodeShape` で管理）
- [x] ノードサイズを内容に応じて自動調整（テキスト量 < 20 / 20-60 / > 60 文字で 3 段階）
- [x] アニメーション：ノード追加時にスケールアップで登場（`animate-node-enter`）
- [x] エッジのスタイル：デフォルトを `smoothstep` に変更（折れ線より見栄えよい）
- [x] フォーカスモード：選択ノードとその直接接続のみを明るく表示、他は opacity: 0.15

**スタートアップ体験**
- [x] 初回起動時のウェルカム画面（使い方ヒントを3ステップで表示、`WelcomeModal.tsx`）
- [x] マップが空の場合のエンプティ状態UI（「ダブルクリックでアイデアを追加」ガイド表示）

**完了条件**: 新規作成マップが放射状に広がり、操作ヒントが表示される ✅

---

### Phase 7: ノードのリッチコンテンツ & カテゴリシステム（約4日） ✅ 完了（2026-05-30）

**目標**: アイデアに情報量を持たせ、カテゴリによる分類を実現

#### タスク

**ノードデータ拡張** (`src/types/index.ts`, `mapStore.ts`)
- [x] `IdeaNodeData` に `title: string`、`body?: string`、`categoryId?: string` を追加（`text` → `title` にリネーム、旧フォーマットはロード時に自動マイグレーション）
- [x] `SerializedNode` も同様に拡張（`title`, `body`, `categoryId` を追加）
- [x] `claudeService.ts` のプロンプトをタイトル＋本文で構築するよう更新

**ノード詳細パネル** (`src/components/panels/NodeDetailPanel.tsx`)
- [x] ノードをダブルクリック or 右クリック「詳細を開く」でモーダルパネルを表示
- [x] タイトル編集（既存インライン編集を詳細パネルに統合）
- [x] 本文エディタ（Markdown対応のテキストエリア、プレビュートグル）
- [x] 本文があるノードにはアイコン（📝）を表示してインジケーター
- [x] ノードカードに本文の冒頭2行をプレビュー表示

**カテゴリシステム** (`src/stores/settingsStore.ts`, `SettingsPanel.tsx` 内カテゴリ管理)
- [x] カテゴリの型定義：`{ id, name, color, icon, description }`
- [x] デフォルトカテゴリの用意:

  | カテゴリ | 色 | アイコン | 用途 |
  |----------|-----|---------|------|
  | メインアイデア | 藍色 `#e0e7ff` | 💡 | マップの核心 |
  | 問い・疑問 | 黄色 `#fef3c7` | ❓ | 未解決の問い |
  | アクション | 緑色 `#d1fae5` | ✅ | 実行すべきタスク |
  | 参考・情報 | 水色 `#dbeafe` | 📚 | 参照情報 |
  | 感情・直感 | ピンク `#fce7f3` | ❤️ | 感情的な気づき |
  | 懸念・リスク | 赤色 `#ffe4e6` | ⚠️ | 問題点・課題 |
  | 未分類 | 白 `#ffffff` | ○ | デフォルト |

- [x] `settingsStore` に `categories: Category[]` を追加（localStorage永続化）
- [x] カテゴリ管理パネル（設定画面内）：追加・編集・削除・色変更・アイコン変更
- [x] ノードの色ピッカーをカテゴリ選択UIに刷新（右クリックメニュー・詳細パネル）
- [x] カテゴリ変更時に `IdeaNodeData.categoryId` を更新、ノードの `color` はカテゴリから派生
- [x] AI提案ノードのカテゴリ自動判定（Claudeがsuggestion生成時に `categoryId` フィールドも返す）

**完了条件**: ノードにタイトル＋本文が書け、カテゴリで色分けされたマップが作れる ✅

---

### Phase 8: 検索 & フィルタリング（約2日） ✅ 完了（2026-06-01）

**目標**: ノード数が増えても目的のアイデアに素早くアクセスできる

#### タスク

**テキスト検索** (`src/components/common/SearchBar.tsx`)
- [x] Ctrl+F でサーチバーをトグル表示（キャンバス上部にオーバーレイ）
- [x] 入力に応じてリアルタイムでノードをハイライト（マッチしたノードは明るく黄色ボーダー、非マッチはopacity-20でdim）
- [x] マッチ数表示（例：「3 / 12件」）
- [x] `↑` `↓` キー or 「前へ」「次へ」ボタンでマッチノード間を順にfitView移動
- [x] タイトルと本文の両方を検索対象に

**カテゴリフィルター**
- [x] ツールバーにカテゴリフィルターチップを追加（全カテゴリをトグルボタンで表示・ドロップダウン形式）
- [x] フィルター中は非対象カテゴリのノードをopacity-20でdim
- [x] 複数カテゴリの同時フィルター（OR条件）

**ノードジャンプ**
- [x] 検索結果のリストビュー（SearchBarドロップダウン内）：タイトル一覧＋本文プレビュー、クリックでfitView移動
- [x] 最近使ったノードのクイックアクセス（ノード選択履歴から最大5件表示）

**完了条件**: テキストで検索してノードにジャンプできる。カテゴリでフィルタリングできる ✅

---

### Phase 9: エクスポート & インポート（約2日） ✅ 完了（2026-06-01）

**目標**: マップを他の形式で活用・共有できる

#### タスク

**エクスポート**
- [x] PNG / SVG エクスポート（`html-to-image` ライブラリ使用）
  - 背景込み or 透過の選択
  - 現在のビューポート or マップ全体の選択
  - DPI指定（標準/高解像度）
- [x] JSON エクスポート（`MapFile` 形式をそのままダウンロード）
- [x] Markdown エクスポート（ノードをツリー構造のMarkdownに変換）
  - ルートノードから階層的にリスト形式で出力
  - 本文がある場合はインデントして追記

**インポート**
- [x] JSON ファイルアップロードでマップをインポート（バージョン互換チェック付き）
- [x] インポート時の確認ダイアログ（「現在のマップを置き換えますか？」）
- [x] クリップボードからMarkdown/テキストをペーストしてノードを一括作成（行 → ノード）

**共有**
- [x] マップをURLパラメーターにエンコードして共有リンク生成（小〜中規模マップ向け）
- [x] 「リンクをコピー」ボタン（base64エンコードでマップデータをURLに埋め込み）

**完了条件**: マップをPNGで保存・共有でき、JSONで別デバイスにインポートできる ✅

---

### Phase 10: AI高度化（約3日） ✅ 完了（2026-06-01）

**目標**: AIをただのアイデア提案係から「思考パートナー」にレベルアップ

#### タスク

**マップ全体の分析**
- [x] 「マップを分析」ボタン（ヘッダー）
- [x] Claude がマップ全体のノード・エッジ構造を解析し：
  - マップの主要テーマを1〜2文で要約
  - 見落としているアイデア領域の指摘（最大4件）
  - 最も重要と思われるノードのハイライト提案（最大3件）
- [x] 分析結果をサイドパネル（`MapAnalysisPanel.tsx`）に表示（コピー可能なテキスト）

**接続提案（関連ノードの自動発見）**
- [x] 「つながりを探す」機能：既存ノード間で接続されていないが関連性が高いペアをClaudeが提案（最大5件）
- [x] 提案されたペアを承認/却下できるUI（MapAnalysisPanel内「🔗 つながり」タブ）
- [x] 承認したエッジを「AI提案エッジ」として追加（紫色点線で区別、`mapStore.addSuggestedEdge`）

**クラスタリング提案**
- [x] 「グループ化を提案」機能：Claudeがノードをテーマ別にグループ分け提案（最大4グループ）
- [x] 提案されたグループをカテゴリとして一括適用できる（`mapStore.applyClusterCategory`）

**AIプロンプトの改善**
- [x] ノードの本文（`body`）もコンテキストとして提供（既存 `claudeService.ts` で対応済み）
- [x] カテゴリ情報も提供（各API呼び出しにカテゴリ一覧を渡す）
- [x] 生成する提案数をユーザーが設定可能（3〜10件、AISuggestionPanel内スライダー）
- [x] 提案の「種別」（関連・深掘り・対比・応用）ごとにフィルタリング

**完了条件**: マップ全体の分析と接続提案をAIに依頼できる ✅

---

### Phase 11: デバイス間連携 & スタートアップ体験改善（約4日）

**目標**: どのデバイスからでもすぐに使い始められる環境の実現

#### A. APIキーのGoogle Drive安全保存（セキュアなデバイス間共有）

**設計方針**:
- 現在の固定パスフレーズ方式を廃止し、**ユーザー設定の「同期パスワード」ベースの暗号化**に変更
- 同期パスワード → PBKDF2 (100,000回) → AES-GCM鍵 → APIキーを暗号化
- 暗号化済みAPIキーとsaltを `IdeaMap/settings.json` としてDriveに保存
  ```json
  {
    "version": "1.0",
    "encryptedApiKey": "<base64>",
    "salt": [1, 2, 3, ...],
    "model": "claude-sonnet-4-6",
    "updatedAt": "..."
  }
  ```
- 別デバイスでは「Driveから設定を読み込む」→同じパスワードを入力して復号
- **パスワード自体はDriveに保存しない**（サーバーにも送信しない）

#### タスク
- [x] `src/utils/encryption.ts` に `encryptWithPassword` / `decryptWithPassword` を追加（既存のデバイス固有暗号化は互換維持）
- [x] `src/services/googleDriveService.ts` に `saveAppSettings` / `loadAppSettings` を追加（`IdeaMap/settings.json` の読み書き）
- [x] `src/stores/settingsStore.ts` に `syncPassword`, `saveSettingsToDrive`, `loadSettingsFromDrive` アクションを追加
- [x] `src/components/panels/SettingsPanel.tsx` に同期パスワード設定UI + 「Driveに保存」「Driveから読み込む」ボタンを追加
  - パスワード未設定時は「同期するにはパスワードを設定してください」と案内
  - 読み込み成功時はトースト通知「APIキーを同期しました」

---

#### B. Googleログイン自動再認証

**設計方針**:
- GIS Token モデルは元々リフレッシュトークンを持たず、アクセストークンはメモリのみで1時間有効
- `prompt: ''` を使うと、ユーザーが一度同意済みの場合はポップアップなしで自動トークン取得できる
- リロード時にこの仕組みを使って「見えない形での自動ログイン」を実現
- **テストユーザーの制限は原因ではない**（リフレッシュトークンを使わない設計なので影響なし）

#### タスク
- [x] `src/hooks/useGoogleAuth.ts` を更新：
  - サインイン成功時に `localStorage.setItem('googleAuthRequested', 'true')` を保存
  - サインアウト時にフラグを削除
  - GISライブラリ準備完了 (`isGisReady`) を検知したら、フラグがあれば自動的に `requestAccessToken({ prompt: '' })` を呼び出す
  - 自動認証中は `isLoading: true` を立てて画面に「認証中...」を表示（素早く解決するため違和感なし）
  - 失敗（同意取消・トークン期限切れ等）はフラグをクリアしてサインインボタンを表示
- [x] トークン失効時の検知：`useAutoSave.ts` でDrive保存が401エラーの場合に「認証が切れました」トーストを表示

---

#### C. スタートアップ / ファイル選択ダッシュボード

**設計方針**:
- アプリ起動時のフローを刷新：
  ```
  アプリ起動
  ├── 自動認証中（フラグあり） → 成功 → ファイルダッシュボード
  ├── 未ログイン → ダッシュボード（ログインボタン付き）
  └── オフライン → ダッシュボード（ローカルファイルのみ表示）
  ```
- `FileOpenDashboard.tsx`（全画面オーバーレイ）の内容：
  - 「最近開いたマップ」（localStorageに最大5件の履歴を保存、マップ名+更新日時）
  - 「Google Driveのマップ一覧」（Drive APIから取得、ファイル名+更新日時）
  - 「新規作成」ボタン
  - 「ファイルを開く（JSONインポート）」ボタン
  - Googleログインボタン（未認証時）
- マップを開いたら（またはファイルを選択したら）ダッシュボードを閉じてキャンバスへ移行
- ヘッダーのマップ名をクリックするとダッシュボードを再表示できる

#### タスク
- [x] `src/components/screens/FileOpenDashboard.tsx` を新規作成（全画面オーバーレイ）
- [x] `src/stores/uiStore.ts` に `isFileDashboardOpen`, `setFileDashboardOpen` を追加
- [x] `src/App.tsx` を更新：起動時にダッシュボードを表示、マップ選択後に閉じるフローを組み込む
- [x] `src/services/storageService.ts` に最近開いたマップ履歴を追加（`saveRecentMap` / `loadRecentMaps`）
- [x] `src/components/common/Header.tsx` を更新：マップ名横に▼ボタンでダッシュボードを開く

---

#### D. UIの改善

**D-1. キーボードショートカット一覧（Ctrl+/）**
- [x] `src/components/common/KeyboardShortcutsModal.tsx` を新規作成（全ショートカット一覧をモーダル表示）
- [x] `src/hooks/useKeyboardShortcuts.ts` に `Ctrl+/` ショートカットを追加

**D-2. オフライン状態インジケーター**
- [x] `src/hooks/useOnlineStatus.ts` を新規作成（`navigator.onLine` + `online`/`offline` イベント）
- [x] `src/components/common/Header.tsx` にオフライン時の小バナーを追加（「オフライン - ローカル保存中」）

**D-3. Drive保存エラー時の検知**
- [x] `src/hooks/useAutoSave.ts` でDrive保存が認証エラー（401）の場合、「認証が切れました」トーストを表示

---

**完了条件**: どのデバイスでもサインイン後すぐにファイルを選択・開始でき、APIキーの再入力が不要になる ✅（2026-06-01）

---

### Phase 12: ノードUX細部改善 & グループ化（約3日）

**目標**: 操作の細かい不便を解消し、ノードの視覚的グルーピングを実現

#### A. ノード選択時カテゴリラベル表示 ✅ 完了（2026-06-03）

- [x] `IdeaNode.tsx` でノード選択（`selected`）時に左上にカテゴリアイコン＋名前のバッジを表示
  - `getCategoryById` で取得したカテゴリ情報を使用
  - `cat-none`（未分類）の場合は非表示
  - `pointer-events-none` でクリック操作の邪魔をしない

#### B. ノードグループ化（コンテナ） ✅ 完了（2026-06-04）

設計方針:

- `@xyflow/react` の親子ノード機能を使い、視覚的な「囲み枠」として軽量に実装する
- グループは独立したノード種別 `GroupNode` として追加し、他ノードをドラッグで入れられる
- グループ自体はラベル付きの半透明な背景ボックスとして表示

#### タスク

##### GroupNode の実装 (`src/components/canvas/GroupNode.tsx`)

- [x] `GroupNode` コンポーネントを新規作成（ラベル付き半透明ボックス、`NodeResizer` によるリサイズハンドル付き）
- [x] `mapStore` に `addGroupNode` / `ungroupNodes` / `deleteGroupWithChildren` / `groupSelectedNodes` アクションを追加
- [x] キャンバス右クリック → 「グループを作成」メニュー項目追加
- [x] 複数選択ノードを右クリック → 「グループ化」でグループノードを生成し選択ノードを子に設定

##### グループ操作UX

- [x] グループヘッダーをダブルクリックでラベル編集
- [x] グループを移動すると子ノードも追従（React Flow の `parentId` 機能を利用）
- [x] グループを削除 → 右クリックメニューから「グループを解除（子ノードは残す）」「グループと子ノードを削除」の2択
- [x] `SerializedNode` に `nodeType`/`width`/`height`/`parentId` を追加し、Google Drive保存・読み込みに対応
- [x] DEL/Backspaceキーでグループ削除時は子ノードも一括削除（Undoで復元可）

**完了条件**: 複数ノードをグループ化して一括移動・視覚的に整理できる ✅

---

### Phase 13: AI機能の改善（約2日） ✅ 完了（2026-06-07）

**目標**: AIアイデア拡張の操作性と柔軟性を向上させ、より自然にAIと協働できるようにする

#### 改善項目

**A. カテゴリフィルタリングの削除**
- 現在の「関連」「深堀り」「対比」「応用」のトグルは、AIへの質問方式を切り替えるUIのように見えるが、実際にはAIが返した提案をカテゴリ別にフィルタリングする機能になっている
- ユーザーの期待と実装が乖離しているため、このフィルタリング機能を削除する
- `AISuggestionPanel.tsx` のカテゴリフィルターUIと、`claudeService.ts` の提案カテゴリ分類ロジックを削除
- 提案はカテゴリに関係なくすべて一覧表示する

**B. AI拡張へのフリーテキスト指示入力**
- ノード選択後にAIアイデア拡張を依頼する際、「どのようにしてほしいか」を自由記述で一言添えられる入力欄を追加
  - 例：「もっと具体的なアクションプランに落とし込んで」「このアイデアの反論を考えて」「ビジネス視点で深堀りして」
- `AISuggestionPanel.tsx` に入力欄（textarea）を追加し、`claudeService.ts` のプロンプトにユーザー指示を組み込む
- 入力欄は省略可能で、空の場合は現行と同じ汎用プロンプトを使用

**C. 接続ノードの文脈をAIに渡す**
- 現在は選択ノード単体のタイトル・本文のみをAIに送っているが、親ノードや接続ノードの内容もコンテキストとして送ることで、マップの流れを踏まえた提案を得られるようにする
- `claudeService.ts` で選択ノードの直接接続ノード（1ホップ）情報を収集しプロンプトに含める（最大5件）

**D. 提案の個別再生成**
- 気に入らない提案だけを個別に再生成できる「↺」ボタンを各提案アイテムに追加
- 全件再生成は既存の「再生成」ボタンで引き続き対応

**E. 兄弟ノードとして追加する拡張モード**
- 現在のAI拡張は常に「選択ノードの子ノード」として提案を追加するが、「このノードに似たアイデアをもっと出して」という依頼の場合は、選択ノードの親から生えた兄弟ノードとして追加するほうが自然
- `AISuggestionPanel.tsx` に追加先を切り替えるトグル「子ノードとして追加 / 兄弟ノードとして追加」を追加
  - 「兄弟ノードとして追加」を選んだ場合、提案を親ノードに接続してマップに追加
  - 親ノードが存在しない（ルートノード）場合はトグルをグレーアウトして無効化
- **複数親への対応**: 選択ノードへの入力エッジが複数ある場合（複数の親が存在する場合）：
  - 全親ノードのタイトル・本文・各親の既存子ノード一覧をプロンプトに含め、AIに「最も適切な親を1つ選んで、そこに新アイデアを追加してください」と指示する
  - AIのレスポンスに `parentNodeId` フィールドを含めてもらい、そのIDの親ノードに接続する
  - AIが判断できない場合のフォールバックとして、最初の親ノード（エッジ追加順）を使用する
- C（接続ノードの文脈）と組み合わせ、「兄弟モード」では選択した（またはAIが選んだ）親ノードと既存の兄弟ノード一覧もプロンプトに含める（AIが重複しないアイデアを出しやすくなる）

#### タスク
- [x]✅ `AISuggestionPanel.tsx` のカテゴリフィルター（関連/深堀り/対比/応用）UIを削除
- [x]✅ `claudeService.ts` の提案カテゴリ分類・フィルタリングロジックを削除（`SuggestionType` 型・`AISuggestion.type` フィールドも削除）
- [x]✅ `AISuggestionPanel.tsx` にユーザー指示入力欄（textarea）を追加
- [x]✅ `claudeService.ts` の `SuggestionRequest` にユーザー指示パラメータ（`userInstruction`）を追加し、プロンプトに反映
- [x]✅ `claudeService.ts` で接続ノードの文脈収集ロジックを追加（`connectedNodes` を `{title, body}[]` に拡張し本文も送信）
- [x]✅ 各提案アイテムに個別再生成ボタン（↺）を追加（`handleRegenerate`・`buildBaseRequest` ヘルパー）
- [x]✅ `AISuggestionPanel.tsx` に「子ノード / 兄弟ノード」追加先トグルを追加（親なしの場合はグレーアウト）
- [x]✅ `claudeService.ts` の兄弟モード用プロンプトに全親ノード情報と既存兄弟ノード一覧を含める
- [x]✅ 複数親がある場合、AIレスポンスに `parentNodeId` を返させ、最適な親を選択させる（フォールバック：最初の親）
- [x]✅ 兄弟モード選択時、提案の追加先ノードIDを `parentNodeId` に従って解決するロジックを `AISuggestionPanel` の `handleAddSelected` に実装

**完了条件**: フィルタリングが消え、ノード選択後に一言添えてAI拡張を依頼でき、接続ノードの文脈を踏まえた提案が得られる ✅

---

### Phase 14: AIチャット & マップ対話（約3日） 🔨 実装済み（確認中）

**目標**: AIを「マップ全体と対話できる思考パートナー」に昇格させる

#### 設計方針
- 現在のAI機能（ノード個別拡張、マップ分析）に加え、自由形式のチャットでマップについて議論できる
- チャット履歴はセッション内のみ保持（Drive保存は行わない）
- AIはマップの全ノード（最大50件）・エッジ・カテゴリ情報をコンテキストとして保持した上で回答
- AIレスポンスに ```actions``` ブロックを埋め込み、パースしてアクションボタンを表示

#### タスク

**AIチャットパネル** (`src/components/panels/AIChatPanel.tsx`)
- [x] ヘッダーに「AIチャット」ボタンを追加（マップ分析ボタンの隣、青系カラー）
- [x] サイドパネル形式のチャットUI（メッセージ履歴 + 入力フォーム）
- [x] `claudeService.ts` に `chatWithMap(messages, mapContext)` 関数を追加
  - 初回メッセージにマップ全体のコンテキストを埋め込み
  - 以降は会話履歴を引き継いで連続対話（最大40件まで保持）
- [x] AIの回答にマップ操作の提案が含まれる場合、ワンクリックで実行できるアクションボタンを表示
  - `addNode`（ノード追加）・`connectNodes`（ノード接続）・`updateNode`（ノード更新）の3種類

**コンテキスト認識機能**
- [x] チャット中に `@ノード名` でノードを参照できる（オートコンプリート付き、↑↓/Enter/Tab/Esc対応）
- [x] 選択中のノードがある場合は「このノードについて」のクイック質問チップを表示
  - 「深掘り」「反論」「アクション化」「関連提案」「次のステップ」の5種類
- [x] `Ctrl+Shift+C` でチャットパネルをトグル
- [x] 型定義追加: `ChatMessage`, `ChatAction`, `ChatActionType`, `MapContext`, `ChatWithMapRequest`
- [x] `uiStore` に `isChatPanelOpen`, `chatMessages`, `isChatLoading` と対応アクションを追加

**完了条件**: マップを見ながらAIとフリーフォームで対話でき、会話の流れでノード追加・接続を実行できる

---

### Phase 15: プレゼンテーションモード（約3日） ✅ 完了（2026-06-07）

**目標**: 作成したマップをそのままプレゼンテーションに使える

#### 設計方針
- ノードに「発表順序」番号を付け、順番にズームしながら焦点を当てる
- ヘッダー・ツールバー非表示のフルスクリーン表示＋ナビゲーション
- 各ノードのタイトルと本文を大きく表示するスライドビュー

#### タスク

**プレゼンモード UI** (`src/components/screens/PresentationMode.tsx`)
- [x]✅ `uiStore` に `isPresentationMode`, `presentationNodeIds`, `presentationCurrentIndex` を追加
- [x]✅ `uiStore` に発表モード操作アクション（`startPresentation`, `exitPresentation`, `goToNextPresentation`, `goToPrevPresentation`, `addNodeToPresentation`, `removeNodeFromPresentation`, `clearPresentationNodes`）を追加
- [x]✅ ツールバーに「発表 (N)」ボタン追加（Ctrl+P でトグル、リスト空のとき disabled）
- [x]✅ ノード右クリック → 「発表に追加（N番目）」「発表から除外（N番目）」メニュー追加
- [x]✅ 発表モード時：ヘッダー・ツールバー非表示、カレントノードにfitViewズーム（600ms）、他ノードを opacity: 0.1 でdim
- [x]✅ 「次へ」(→キー / スペース) で次のノードへfitViewアニメーション
- [x]✅ 「前へ」(←キー) で前のノードへ戻る
- [x]✅ Escキーで発表モード終了（発表リスト・進捗はリセット）
- [x]✅ 各ノード右上に発表順序番号バッジを表示（発表リストに追加済みのとき常時表示）
- [x]✅ 右スライドパネル：現在のノードのタイトル＋本文を大きく表示（プレゼン用スライドビュー）
- [x]✅ 下部ナビバー：前へ/次へ/終了ボタン + X/N カウンター + ドットインジケーター
- [x]✅ 発表モード中は Space/→/← 以外のショートカットをすべてブロック
- [x]✅ `IdeaCanvas` で発表モード中 `nodesDraggable={false}` 等を設定（Space キー競合防止）

**完了条件**: ノードに順序を割り当て、キーボード操作でプレゼンテーションを進められる ✅

---

### Phase 16: Google Drive 保存のデータ消失バグ修正 ✅ 完了（2026-06-06）

**背景**: 新規マップ作成・インポート時に「現在開いているファイルID」が前のマップのまま残り、自動保存が前のマップを `PATCH` 上書きして消失させていた。またノード・エッジを触らずタイトルだけ変更しても保存されなかった。

**原因**: fileId が `useAutoSave` 内の `useRef` と localStorage に二重管理され、新規作成・インポートでは localStorage しかクリアされず ref に旧 fileId が残存。自動保存トリガーも mapStore 変更のみで `mapTitle` 変更を拾わなかった。

#### タスク
- [x] fileId を `uiStore.currentFileId` に一元化し、`setCurrentFileId`（localStorage 同期内包）を新設
- [x] `useAutoSave` の `fileIdRef` を廃止し `currentFileId` を参照、保存後は `setCurrentFileId` で採番 id を反映
- [x] `useAutoSave` に `mapTitle` 変更購読を追加（差分比較・デバウンス共有）でタイトル変更も自動保存
- [x] 新規作成・Drive ロード・ローカルインポート・共有URLインポートを `setCurrentFileId` 経由に統一（インポートは `null`）
- [x] `onMapLoaded` の props バケツリレーを撤去
- [x] サインアウト時に `setCurrentFileId(null)` で現在ファイル参照をクリア
- [x] `docs/design.md` / `requirements.md` を更新

**完了条件**: 新規作成・インポート後の自動保存が既存マップを上書きせず別ファイルになる。タイトル変更のみでも保存される。サインアウトで fileId がクリアされる

---

### Phase 17: mapId による衝突検出 ✅ 完了（2026-06-06）

**背景**: マップ名が同じ別プロジェクトが Drive 上に存在したとき、または複数デバイスで同一ファイルを同時編集したとき、一方のデータが無警告で上書きされてしまう可能性があった。

**解決策**: マップの論理的同一性を表す UUID（mapId）を JSON ファイルに埋め込み、Drive の `appProperties` にも保存することで、ファイル内容をダウンロードせずに軽量な衝突チェックを実現。

#### タスク
- [x] `types/index.ts`: `MapFile.mapId: string` を追加、`SaveStatus` に `'conflict'` を追加
- [x] `uiStore.ts`: `currentMapId` + `setCurrentMapId`、`ConfirmDialogState.secondaryAction` を追加
- [x] `googleDriveService.ts`: `saveMap` に `appProperties: { mapId }` 追加（POST/PATCH 両方）、`fetchMapAppProperties` 新関数追加
- [x] `useAutoSave.ts`: 衝突検出ロジック組み込み（セッション初回 PATCH 前チェック + バックグラウンド 60 秒後復帰チェック）、mapId 生成（POST 時に uuidv4）、`isSuspended` 管理
- [x] `ConfirmDialog.tsx`: `secondaryAction` ボタン（3択）を追加
- [x] `Header.tsx`: `'conflict'` saveStatus の表示（「競合あり」オレンジ文字）を追加
- [x] `MapListPanel.tsx` / `FileOpenDashboard.tsx`: ロード時に `setCurrentMapId` 呼び出し、新規作成・インポート時に `null` をセット
- [x] `ExportImportPanel.tsx`: 手動エクスポート時の `MapFile` に `mapId` を含める

**完了条件**: 別デバイスで上書きされたファイルを編集しようとすると衝突ダイアログが表示され、「最新版を読み込む」「上書き保存」「キャンセル」の3択で対応できる。後方互換として mapId のない旧ファイルは次回保存時に mapId が付与される。

---

### Phase 18: UX 小改善バッチ 🔨 実装済み（確認中）

**背景**: AI生成ノードのタイトルが長すぎる・Markdownが生テキストで表示される・プレゼンテーション順序を後から編集できないという複数の小さなUX課題を一括で解決する。

#### タスク
- [x] `src/utils/markdown.ts` 新規作成: `renderMarkdownSimple` を共通ユーティリティとして抽出
- [x] `src/types/index.ts`: `AISuggestion.text` → `AISuggestion.title` + `body?: string` に変更、`ChatAction.body?: string` 追加
- [x] `src/services/claudeService.ts`: `generateSuggestions` のプロンプト・JSONスキーマを `title`/`body` 分離仕様に更新
- [x] `src/stores/mapStore.ts`: `addNode()` シグネチャに `body?: string` 追加
- [x] `src/components/panels/AISuggestionPanel.tsx`: `text` → `title` 参照を修正、提案カードにbodyプレビュー表示、addNodeにbodyを渡す
- [x] `src/components/panels/AIChatPanel.tsx`: `handleAction` の addNode 呼び出しに `action.body` を渡す
- [x] `src/components/panels/NodeDetailPanel.tsx`: `isPreview` デフォルト `false` → `true`、`renderMarkdownSimple` を共通ユーティリティからインポート
- [x] `src/components/canvas/IdeaNode.tsx`: body を `renderMarkdownSimple` で整形表示（`dangerouslySetInnerHTML`、高さ制限）
- [x] `src/components/screens/PresentationMode.tsx`: body を Markdown整形表示
- [x] `src/stores/uiStore.ts`: `isPresentationOrderOpen` 状態 + `setPresentationOrderOpen`・`reorderPresentationNodes` アクション追加
- [x] `src/components/panels/PresentationOrderPanel.tsx` 新規作成: 発表順序編集モーダル（↑↓・×・クリア・発表開始）
- [x] `src/App.tsx`: `PresentationOrderPanel` を追加
- [x] `src/components/toolbar/Toolbar.tsx`: 発表ボタンを `setPresentationOrderOpen(true)` に変更

**完了条件**: AI生成ノードのタイトルが短く本文が分離される / ノード上・右パネル・プレゼン画面でMarkdownが整形表示される / ツールバー発表ボタンからパネルを開いて順序を編集・発表開始できる

---

### Phase 19: Google認証UXの改善（約2日）

**目標**: 認証切れ・エラー時にユーザーが迷わず復帰でき、接続状態が常に明確である

**背景（現状の課題）**:
- Drive保存が401になると「再度サインインしてください」トーストが出るだけで、復帰にはヘッダーのボタンを自分で探す必要がある
- アクセストークン更新タイマー（`setTimeout`）はバックグラウンドタブでブラウザにスロットリングされるため、タブ復帰直後の保存が401になることがある
- `useGoogleAuth` の `error_callback` で `err.type`（`popup_failed_to_open` 等）が英語の生文字列のままトースト表示される
- どのGoogleアカウントで接続しているか画面のどこにも表示されない
- サインアウトが確認なしで即実行され、Drive自動保存が止まることの説明がない

#### タスク

**A. トーストのアクションボタン対応（共通基盤・B と Phase 20 以降で使用）**
- [ ] `src/stores/uiStore.ts`: `Toast` インターフェースに `action?: { label: string; onClick: () => void }` を追加。`addToast` のシグネチャを `addToast(message, type, action?)` に拡張（action 付きトーストは自動消滅を 4秒→8秒 に延長）
- [ ] `src/components/common/Toast.tsx`: `toast.action` があればメッセージの下に小さなボタン（primary色・下線スタイル）を表示。クリックで `action.onClick()` を実行してから `removeToast(id)`

**B. 401時のサイレント再認証＋保存の自動リトライ**
- [ ] `src/hooks/useGoogleAuth.ts`: `silentReauth(): void` を追加して return オブジェクトに含める。実装: `localStorage.getItem(AUTO_AUTH_FLAG) === 'true'` かつ `tokenClientRef.current` が存在する場合のみ、`isAutoAuthRef.current = true` をセットして `requestAccessToken({ prompt: '' })` を呼ぶ。条件を満たさない場合は何もしない
- [ ] `src/hooks/useAutoSave.ts`: シグネチャを `useAutoSave(accessToken: string | null, auth: { silentReauth: () => void; signIn: () => void })` に変更
  - `reauthAttemptedRef = useRef(false)` を追加
  - `performSave` の 401 エラー時: `reauthAttemptedRef.current === false` なら ① `reauthAttemptedRef.current = true` ② `pendingRetryRef.current = true` ③ `auth.silentReauth()` を呼び、**トーストは出さない**（saveStatus は `'error'` のままにする）
  - 既に `reauthAttemptedRef.current === true` の場合（サイレント再認証後も401）: 「Googleドライブの認証が切れました」トーストを **「再接続」アクション付き**（`action.onClick = auth.signIn`）で表示
  - `useEffect(() => { ... }, [accessToken])` を追加: accessToken が non-null に変化したとき `reauthAttemptedRef.current = false` にリセットし、`pendingRetryRef.current === true` なら `pendingRetryRef.current = false` にして `scheduleSave()` で保存をリトライ
- [ ] `src/App.tsx`: `useAutoSave(googleAuth.accessToken, { silentReauth: googleAuth.silentReauth, signIn: googleAuth.signIn })` に呼び出しを変更

**C. バックグラウンド復帰時のトークン失効チェック**
- [ ] `src/hooks/useGoogleAuth.ts`: `isGisReady` 後の `useEffect` 内で `visibilitychange` リスナーを追加。`document.hidden === false` になったとき sessionStorage の `TOKEN_EXPIRY_KEY` を読み、**失効済みまたは残り5分未満** かつ `AUTO_AUTH_FLAG === 'true'` なら `requestAccessToken({ prompt: '' })`（`isAutoAuthRef.current = true` を立てる）。十分残っていれば何もしない。クリーンアップでリスナー解除

**D. 接続アカウント（メールアドレス）の表示**
- [ ] `src/hooks/useGoogleAuth.ts`: `SCOPES` を `'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email'` に変更。トークン取得成功時（callback内）に `fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer <token>' } })` で `email` を取得し、state に `userEmail: string | null` を追加して保存。取得失敗は無視（email 表示なしで継続）。`localStorage.setItem('googleUserEmail', email)` にも保存し、`signOut` で削除。`GoogleAuthState` 型と return に `userEmail` を追加
- [ ] `src/components/common/Header.tsx`: 「接続済み」ボタンをクリックでドロップダウンメニュー表示に変更（Toolbar の整列メニューと同じ「外クリックで閉じる」パターン）。メニュー内容: ①メールアドレス（クリック不可・truncate・text-xs gray） ②区切り線 ③「マップ一覧」（`setMapListOpen(true)`） ④「サインアウト」（下記F の確認ダイアログ）。既存の独立「マップ一覧」ボタンはこのドロップダウンに統合して削除（モバイル用アイコンボタンは残す）
- [ ] `src/components/screens/FileOpenDashboard.tsx`: 未サインイン時、`localStorage.getItem('googleUserEmail')` があればサインインボタンの下に「前回: xxx@gmail.com」を text-xs gray で表示

**E. 認証エラーメッセージの日本語化**
- [ ] `src/hooks/useGoogleAuth.ts`: `function friendlyAuthError(type: string): string | null` を追加し `error_callback` で使用。マッピング: `popup_closed` → `null`（表示しない・現状維持） / `popup_failed_to_open` → 「ポップアップがブロックされました。ブラウザのポップアップ設定を確認してください」 / `access_denied` → 「Googleへのアクセスが許可されませんでした」 / その他 → 「Google認証でエラーが発生しました（{type}）」

**F. サインアウト確認ダイアログ**
- [ ] `src/components/common/Header.tsx`: サインアウト押下時に直接 `onGoogleSignOut()` せず `openConfirmDialog({ title: 'サインアウト', message: 'Googleドライブへの自動保存が停止します。編集内容はこの端末のローカルには保存され続けます。', confirmLabel: 'サインアウト', danger: true, onConfirm: onGoogleSignOut })` を呼ぶ

**ドキュメント更新**
- [ ] `docs/design.md` の認証まわりの設計（silentReauth・userEmail・visibilitychange チェック）を更新
- [ ] `docs/requirements.md` に「認証切れ時の自動復帰」「接続アカウント表示」要件を追記

**完了条件**: トークン失効後の保存がユーザー操作なしで再開される。サイレント再認証も失敗した場合はトーストの「再接続」1クリックで復帰できる。接続中のGoogleアカウントが確認できる

---

### Phase 20: ファイル保存・読み込みUXの改善（約2日） ✅ 完了（2026-06-18）

**目標**: 「前回の続き」へ確実に戻れ、保存状態がいつでも把握・操作できる

**背景（現状の課題）**:
- `useAutoSave` は常に localStorage にも保存している（`saveMapLocally`）のに、起動ダッシュボードに「前回の作業を再開」がなく、**未サインイン・オフラインだと前回の作業に戻る手段がない**（最重要）
- `FileOpenDashboard` に閉じるボタンがなく、ヘッダーから誤って開くとマップを選び直すしかない
- 手動保存（Ctrl+S）がなく、3秒デバウンス中にタブを閉じると Drive に保存されない。`beforeunload` 警告もない
- ダッシュボードの Drive ファイル一覧から削除・複製ができない（削除は `MapListPanel` のみ）
- 保存先が Drive なのかローカルのみなのかの表示がない

#### タスク

**A. 「前回の作業を再開」カード（最優先）**
- [x]✅ `src/services/storageService.ts`: `loadMapLocally()` の戻り値を `MapFile | null` に型付けし、`nodes` が配列でない場合は `null` を返す検証を追加
- [x]✅ `src/components/screens/FileOpenDashboard.tsx`: Drive セクションの**上**に「前回の作業を再開」カードを追加。`loadMapLocally()` が non-null のとき表示し、タイトル・`updatedAt`（formatDate）・ノード数を表示。サインイン状態に関係なく（オフラインでも）表示する
  - クリック時: `loadFromSerialized(data.nodes, data.edges)` → `setMapTitle(data.title)` → `setCurrentMapId(data.mapId ?? null)` → `setPresentationNodeIds(data.presentationNodeIds ?? [])` → `setSaveStatus('saved')` → `setFileDashboardOpen(false)`
  - **注意**: `currentFileId` は localStorage から復元済みのため触らない（同じ Drive ファイルへの保存を継続させる）

**B. ダッシュボードを閉じられるように**
- [x]✅ `FileOpenDashboard.tsx`: 右上に X ボタンを追加して `setFileDashboardOpen(false)`。同条件で Esc キーでも閉じる（削除確認ダイアログ表示中の Esc はそちらを優先）
  - 実装変更: 表示条件は `nodes.length > 0` ではなく `uiStore.hasActiveMap`（新設）を使用。mapStore は初期状態でもルートノードを1件持つため `nodes.length > 0` では初回起動を判別できない。`hasActiveMap` は `setFileDashboardOpen(false)` 時に自動で true になる（閉じる経路はマップ選択・新規作成・インポート後のみという不変条件を利用）

**C. 手動保存（Ctrl+S）**
- [x]✅ `src/stores/uiStore.ts`: `saveRequestId: number`（初期値0）と `requestSave: () => void`（`set((s) => ({ saveRequestId: s.saveRequestId + 1 }))`）を追加
- [x]✅ `src/hooks/useAutoSave.ts`: `useEffect` で `saveRequestId` の変化を購読（`useUIStore.subscribe` の差分比較パターン）。変化したらデバウンスタイマーをクリアして即 `setSaveStatus('saving')` → `void performSave()`。**`autoSave` 設定が off でも手動保存は実行する**
- [x]✅ `src/hooks/useKeyboardShortcuts.ts`: `Ctrl+S` → `e.preventDefault()` + `ui.requestSave()`。モーダル抑制チェックより前・テキスト入力中（`isEditing`）ガードよりも前に配置（入力中でもブラウザの保存ダイアログを抑止して保存できるように）
- [x]✅ `src/components/common/KeyboardShortcutsModal.tsx`: Ctrl+S の行を追加

**D. 保存先と最終保存時刻の表示**
- [x]✅ `src/stores/uiStore.ts`: `lastSavedAt: string | null` + `setLastSavedAt(iso: string)` を追加。`useAutoSave.performSave` の成功パス（Drive成功時とローカルのみ成功時の両方）でセット
- [x]✅ `src/components/common/Header.tsx`: 保存ステータス表示を「保存済み · Drive」「保存済み · ローカル」形式に変更（判定: `isSignedIn && currentFileId` → Drive、それ以外 → ローカル）。`title` 属性に「最終保存 HH:mm:ss / クリックで今すぐ保存」を設定し、クリックで `requestSave()`

**E. ファイル一覧の行操作（削除・複製）と絞り込み**
- [x]✅ `FileOpenDashboard.tsx`: 各 Drive ファイル行に hover で表示（`group-hover:opacity-100`）される「複製」「削除」アイコンボタンを追加（行クリックの open と干渉しないよう `stopPropagation`。行は button のネスト回避のため div + onClick に変更）
  - 削除: `openConfirmDialog`（danger・ファイル名入りメッセージ）→ `deleteMap(accessToken, file.id)` → 一覧から除去。削除対象が `currentFileId` と一致したら `setCurrentFileId(null)` + `setCurrentMapId(null)`
  - 複製: `loadMap(accessToken, file.id)` で内容取得 → `mapId: uuidv4()`・`title: 元タイトル + ' のコピー'`（同名がある場合は連番付与で一意化。saveMap の同名 PATCH 上書きを回避）→ `saveMap(..., null, newMapId)` → 一覧再取得。処理中はスピナー表示
- [x]✅ Drive ファイルが8件超のとき、一覧上部に絞り込み input を表示（ファイル名部分一致・大文字小文字無視・ローカル state）

**F. タブを閉じる際の未保存ガード**
- [x]✅ `src/App.tsx`: `useEffect`（マウント時1回）で `beforeunload` を購読。ハンドラ内で `useUIStore.getState().saveStatus` を読み、`'unsaved'` または `'saving'` のとき `e.preventDefault()` + `e.returnValue = ''`。クリーンアップで解除

**実装中に行った付随修正**
- [x]✅ z-index 調整: `ConfirmDialog` を z-60 → z-70、`Toast` を z-50 → z-80 に変更（ダッシュボード z-60 portal の上に確認ダイアログ・トーストが表示されるように）
- [x]✅ `FileOpenDashboard` の Drive 読み込み・JSONインポートで `presentationNodeIds` を復元（MapListPanel は復元していたがダッシュボード側が欠落していた）。新規作成時は発表リストをクリア

**ドキュメント更新**
- [x]✅ `docs/design.md` のストレージ設計（saveRequestId・lastSavedAt・hasActiveMap・ローカル復元フロー・z-index 規約・Ctrl+S）を更新
- [x]✅ `docs/requirements.md` に「2.3.1.1 保存・復元のUX（Phase 20）」を追記、複製・削除要件を更新

**完了条件**: オフライン・未サインインでも前回の作業に1クリックで復帰できる。Ctrl+S で即時保存でき、未保存のままタブを閉じようとすると警告される。ダッシュボードから削除・複製ができる

---

### Phase 21: レイアウト・整列機能の強化（約3日）

**目標**: 手動配置の微調整が簡単になり、自動整列の挙動が追える

**背景（現状の課題）**:
- 自動整列は全ノード一括のみで、複数選択したノードを揃える・等間隔に並べる手段がない
- 整列実行時にノードが瞬間移動し、どのノードがどこへ動いたか追えない
- **不具合**: `FloatingEdge.tsx` が `label`・`markerStart` を `BaseEdge` に渡しておらず、エッジの「ラベルを編集」「双方向」が**機能していない**（mapStore 側のデータは正しく更新されるが描画されない）
- ツールバーの「ノード追加」がビューポート左上付近固定で、既存ノードと重なりやすい
- グリッドスナップがない

#### タスク

**A. FloatingEdge の不具合修正（ラベル・双方向矢印）**
- [ ] `src/components/canvas/FloatingEdge.tsx`: `EdgeProps` から `label` と `markerStart` も受け取り、`markerStart` は `BaseEdge` にそのまま渡す。`getBezierPath(args)` の返り値を `[edgePath, labelX, labelY]` で受け、`label` があれば `@xyflow/react` の `EdgeLabelRenderer` で `transform: translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` の位置に白背景（dark対応）の小ラベル（text-xs・px-1.5・rounded）を描画
- [ ] 動作確認: エッジ右クリック→「ラベルを編集」の文字が線上に表示される。「双方向」で両端に矢印が付く。保存→再読込後も維持される

**B. 複数選択ノードの整列・分布**
- [ ] `src/stores/mapStore.ts` にアクションを追加:
  ```ts
  alignSelectedNodes: (type: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom') => void
  distributeSelectedNodes: (direction: 'horizontal' | 'vertical') => void
  ```
  - 対象: `selected && type !== 'groupNode'` かつ **`parentId === undefined`** のノードのみ（グループ子ノードは座標系が異なるため除外）。対象が2未満（distribute は3未満）なら何もしない
  - サイズは `n.measured ?? { width: 160, height: 60 }` を使用
  - `left`: 最小 `position.x` に揃える / `right`: 最大 `position.x + width` に右端を揃える / `center-h`: 各ノード中心xの平均値に中心を揃える / `top`・`bottom`・`center-v` は y 軸で同様
  - `distribute`: 対象を中心座標でソートし、両端ノードは固定、中間ノードの**中心**が等間隔になるよう配置
  - 変更前スナップショットを `past` に push（既存アクションと同じパターン）
- [ ] `src/components/canvas/ContextMenu.tsx`: ノードメニューで `nodes.filter((n) => n.selected && !n.parentId && n.type !== 'groupNode').length >= 2` のとき「整列」セクション（Divider区切り）を追加: 「⬅ 左揃え」「⬆ 上揃え」「↔ 左右中央」「↕ 上下中央」、3個以上なら「⇿ 横に等間隔」「⇳ 縦に等間隔」も表示。各項目はアクション実行後 `closeContextMenu()`

**C. 整列アニメーション**
- [ ] `src/stores/mapStore.ts` に追加:
  ```ts
  setNodesNoHistory: (nodes: IdeaNode[]) => void  // set({ nodes }) のみ。履歴に積まない
  commitNodesWithHistory: (originalNodes: IdeaNode[], finalNodes: IdeaNode[]) => void
  // → set((state) => ({ nodes: finalNodes, past: pushPast(state.past, { nodes: [...originalNodes], edges: [...state.edges] }), future: [] }))
  ```
- [ ] `src/utils/mapLayout.ts` に追加:
  ```ts
  export function animateNodePositions(
    from: Node<IdeaNodeData>[],
    to: Node<IdeaNodeData>[],
    onFrame: (nodes: Node<IdeaNodeData>[]) => void,
    onDone: () => void,
    duration = 400
  ): () => void  // キャンセル関数を返す
  ```
  - `requestAnimationFrame` ループ。`easeInOutCubic(t)` で補間。`to` の各ノードについて `from` に同 id があれば position を補間、なければ `to` の値をそのまま使う。最終フレームで `onDone()`
- [ ] `src/components/toolbar/Toolbar.tsx`: `handleRadialLayout` / `handleDagreLayout` を変更:
  1. `const original = nodes`（現在配列を保持）
  2. `const laid = applyXxx(...)`
  3. `animateNodePositions(original, laid, setNodesNoHistory, () => { commitNodesWithHistory(original, laid); fitView({ padding: 0.15, duration: 400 }) })`
  4. 実行中フラグ（`useRef<boolean>`）で多重実行をガード（アニメーション中は整列メニューの再実行を無視）
  - **重要**: アニメーション中の各フレームは履歴に積まないこと。整列後に Undo を1回押すと整列前の配置に戻ることを確認する

**D. グリッドスナップ**
- [ ] `src/stores/settingsStore.ts`: `snapToGrid: boolean`（default `false`）+ `setSnapToGrid` を追加し、`partialize` にも含める
- [ ] `src/components/canvas/IdeaCanvas.tsx`: `<ReactFlow snapToGrid={snapToGrid} snapGrid={[20, 20]} ...>` を追加
- [ ] `src/components/toolbar/Toolbar.tsx`: 整列ドロップダウン内の末尾に Divider ＋「グリッドにスナップ」トグル項目（有効時は ✓ を表示。クリックしてもメニューは閉じない）

**E. ノード追加位置の改善（重なり回避）**
- [ ] `src/utils/mapLayout.ts`: `export function findFreePosition(desired: { x: number; y: number }, existingNodes: Node<IdeaNodeData>[]): { x: number; y: number }` を追加 — desired を起点に、既存ノードと `|dx| < 200 && |dy| < 80` で重なる間、y を 90px ずつ下にずらす（最大10回）
- [ ] `src/components/toolbar/Toolbar.tsx` `handleAddNode`: `getViewport` 計算をやめ、`screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })` で画面中央に変更し、`findFreePosition` を通してから `addNode`
- [ ] `src/stores/mapStore.ts` `addConnectedNode`: グループ外分岐の `finalPosition` 決定後に `findFreePosition(finalPosition, state.nodes)` を適用

**F. エッジスタイル設定（任意・低優先）**
- [ ] `src/stores/settingsStore.ts`: `edgeStyle: 'bezier' | 'smoothstep' | 'straight'`（default `'bezier'`）+ setter + partialize
- [ ] `src/components/canvas/FloatingEdge.tsx`: `useSettingsStore((s) => s.edgeStyle)` を参照し `getBezierPath` / `getSmoothStepPath` / `getStraightPath` を切り替え（引数 `args` は共通で流用可）
- [ ] `src/components/panels/SettingsPanel.tsx`: ノード形状設定の隣に3択UIを追加（既存の nodeShape と同じUIパターン）

**ドキュメント更新**
- [ ] `docs/design.md` の「状態管理設計」（mapStore 新アクション）「コンテキストメニュー設計」（整列セクション）を更新
- [ ] `docs/requirements.md` に整列・スナップ・エッジスタイル要件を追記

**完了条件**: 複数選択→右クリックで整列・等間隔配置ができ、自動整列がアニメーションし Undo 1回で戻る。エッジラベルと双方向矢印が表示される

---

### Phase 22: アイデア編集UXの改善（約3日）

**目標**: キーボードとダブルクリックだけでテンポよくマップを広げられる

**背景（現状の課題）**:
- **到達不能コード**: `IdeaNode.tsx` のインライン編集（`isEditing`）は blur/Escape で false にする処理だけ残っており、true にする経路が存在しない（ダブルクリックは詳細モーダルに割り当て済み）。タイトルを1行直すだけでもモーダルを開く必要がある
- 新規ノード作成後にタイトル編集が自動で始まらず、「新しいアイデア」のまま放置されがち
- マインドマップ定番の Enter（兄弟ノード追加）がない（Tab の子追加はある）
- 矢印キーでノード間の選択移動ができない
- `NodeDetailPanel` が Esc・背景クリックで閉じない
- コピー&ペーストでノード間のエッジが複製されない（ノードだけバラバラに貼り付く）

#### タスク

**A. インライン編集の復活（ダブルクリック＝タイトル編集）**
- [ ] `src/stores/uiStore.ts`: `editingNodeId: string | null` + `setEditingNodeId(id: string | null)` を追加
- [ ] `src/components/canvas/IdeaNode.tsx`: ローカル `isEditing` state を廃止し `useUIStore` の `editingNodeId === id` で編集状態を判定。`handleDoubleClick` を `openNodeDetail(id)` から `setEditingNodeId(id)` に変更。blur / Enter（Shiftなし）/ Escape で `setEditingNodeId(null)`（既存のコミット・復元ロジックは維持）
- [ ] 詳細モーダルへの導線を維持・補強: NodeActionBar「詳細」・右クリック「詳細を開く」は既存のまま。`IdeaNode` の📝本文バッジに `onClick={(e) => { e.stopPropagation(); openNodeDetail(id) }}` を追加し `cursor-pointer` に
- [ ] `src/hooks/useKeyboardShortcuts.ts`: `F2` で `ui.selectedNodeId` があれば `ui.setEditingNodeId(ui.selectedNodeId)`
- [ ] `src/components/canvas/ContextMenu.tsx`: ノードメニューの先頭付近に「✏️ 名前を変更」（shortcut表示 `F2`）を追加 → `setEditingNodeId(targetId)` + `closeContextMenu()`
- [ ] 確認: 編集中（textarea フォーカス中）は既存の `isEditing` ガードによりショートカットが発火しないこと

**B. 作成直後に編集モード開始**
- 対象経路: ①キャンバスダブルクリック（`IdeaCanvas.handleDoubleClickOnPane`）②ツールバー「ノード追加」③Tab（子追加）④右クリック「アイデアを作成」「アイデアを作成（接続）」⑤Enter（兄弟追加・下記C）
- [ ] 各経路で `addNode` / `addConnectedNode` の返り値 id を受けて `setSelectedNodeId(id)` + `setEditingNodeId(id)` を呼ぶ
- [ ] `IdeaNode` の textarea は表示時に `select()` されるため、そのままタイプすれば「新しいアイデア」が上書きされる（既存挙動を確認）

**C. Enter で兄弟ノード追加**
- [ ] `src/stores/mapStore.ts`: `addSiblingNode(nodeId: string): string | null` を追加 — `edges.find((e) => e.target === nodeId)` で最初の親エッジを探す。親があれば `addConnectedNode(親id)` を呼んで返す。親がなければ選択ノードの直下（`x` 同じ、`y + (measured?.height ?? 60) + 30`、`findFreePosition` 適用）に独立ノードを作成して id を返す
- [ ] `src/hooks/useKeyboardShortcuts.ts`: 修飾キーなし `Enter`（`ui.selectedNodeId` あり・編集中でない・モーダル抑制チェック通過後）→ `addSiblingNode` → 返り値 id を選択＋編集開始
- [ ] `src/components/common/KeyboardShortcutsModal.tsx`: Enter / F2 / 矢印キーの行を追加

**D. 矢印キーによるノード選択移動**
- [ ] `src/stores/mapStore.ts`: `selectOnlyNode(id: string): void` を追加（全ノードの `selected` フラグを `n.id === id` に設定する単純 `set`。履歴に積まない）
- [ ] `src/hooks/useKeyboardShortcuts.ts`: 矢印キー（`ui.selectedNodeId` あり・修飾なし）で方向別の最近傍ノードへ選択を移動:
  - 現在ノードの絶対中心 `(cx, cy)`（`parentId` があれば親グループ position を加算）から各候補ノード中心へのベクトル `(dx, dy)` を計算
  - ArrowRight: `dx > 0` かつ `|dy| <= |dx| * 1.2` を満たす候補のうちユークリッド距離最小のノード。他の方向も同様（軸を入れ替え）
  - 候補は `type !== 'groupNode'` のノードのみ。該当なしなら何もしない（`preventDefault` もしない）
  - 移動先確定時: `e.preventDefault()` → `map.selectOnlyNode(id)` + `ui.setSelectedNodeId(id)`

**E. 詳細モーダル（NodeDetailPanel）の操作性**
- [ ] `src/components/panels/NodeDetailPanel.tsx`: close 処理を `commitAndClose()` に集約（`titleInput`/`bodyInput` の未コミット値を `updateNodeTitle`/`updateNodeBody` で保存してから `closeNodeDetail()`。blur が走らない閉じ方への対策）
- [ ] 背景（最外 div）クリックで `commitAndClose()`（内側カードは既存の `stopPropagation` あり）
- [ ] `useEffect` の keydown で Escape → `commitAndClose()`。本文 textarea 内 `Ctrl+Enter` → `commitAndClose()`

**F. コピー&ペーストでエッジも複製**
- [ ] `src/stores/mapStore.ts`: `clipboard` を `{ nodes: IdeaNode[]; edges: Edge[] }` に変更（初期値 `{ nodes: [], edges: [] }`・`reset` も更新）
  - `copyNodes`: 選択ノードに加えて、`source`・`target` の両方が選択集合に含まれるエッジも保存
  - `paste`: `Map<oldId, newId>` を作ってノードを複製した後、保存エッジを `makeEdge({ source: map.get(e.source)!, target: map.get(e.target)!, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle }, Boolean(e.markerStart))` で再生成し `label` も引き継ぐ
- [ ] `src/hooks/useKeyboardShortcuts.ts` と `src/components/canvas/ContextMenu.tsx` の `clipboard.length` 参照を `clipboard.nodes.length` に修正（参照箇所を grep して全て直す）

**ドキュメント更新**
- [ ] `docs/design.md` の「状態管理設計」（editingNodeId・clipboard 構造変更・新アクション）と「コンテキストメニュー設計」（名前を変更）を更新
- [ ] `docs/requirements.md` のノード編集要件（ダブルクリック挙動の変更・キーボード操作）を修正・追記

**完了条件**: ダブルクリックでその場でタイトル編集でき、Enter / Tab / F2 / 矢印キーだけで連続的にマップを広げられる。コピペで接続ごと複製される

---

### Phase 23: AI連携UXの改善（約3日）

**目標**: AI機能の待ち時間・失敗・結果確認のストレスをなくす

**背景（現状の課題）**:
- APIキー未設定のままAIパネルを開くと、実行ボタンを押した後にエラーで知らされる（事前ガイドがない）
- チャット応答が全文一括表示で長い応答の体感が悪い。生成のキャンセルもできない
- `generateSuggestions` の `max_tokens: 1024` では提案数が多い（8〜10件＋body付き）場合に JSON が途中で切れて解析エラーになりうる
- API エラー（401/429/529/ネットワーク）が生メッセージのまま表示される
- 提案をマップに追加しても画面外に配置されると気づけない
- `chatWithMap` がマップコンテキストを最初のユーザーメッセージに埋め込んでおり、`system` パラメータを使っていない

#### タスク

**A. APIキー未設定時のガイド**
- [ ] `src/components/panels/AISuggestionPanel.tsx` / `AIChatPanel.tsx` / `MapAnalysisPanel.tsx`: `useSettingsStore` の `apiKey` が空文字のとき、パネル本文を空状態UIに差し替える: 🔑アイコン＋「Claude APIキーが必要です」見出し＋「AI機能を使うには Anthropic の APIキーを設定してください」1行＋「設定を開く」ボタン（`setSettingsOpen(true)`）。実行ボタン・入力欄は表示しない

**B. エラーメッセージの共通整形**
- [ ] `src/services/claudeService.ts`: 末尾に追加:
  ```ts
  export function toFriendlyAIError(e: unknown): string
  ```
  `Anthropic.APIError` を `instanceof` 判定し `status` で分岐: 401 → 「APIキーが無効です。設定画面で確認してください」 / 429 → 「レート制限に達しました。1分ほど待ってから再試行してください」 / 529 → 「Claude APIが混雑しています。しばらく待ってから再試行してください」 / `Anthropic.APIConnectionError` → 「ネットワークエラーです。接続を確認してください」 / それ以外は `e instanceof Error ? e.message : 'エラーが発生しました'`
- [ ] `AISuggestionPanel` / `AIChatPanel` / `MapAnalysisPanel` の catch 節をすべて `toFriendlyAIError(e)` に統一

**C. チャットのストリーミング表示＋停止ボタン＋system化**
- [ ] `src/services/claudeService.ts`: `chatWithMap` のシグネチャを変更:
  ```ts
  export async function chatWithMap(
    req: ChatWithMapRequest,
    onText?: (partialText: string) => void,
    signal?: AbortSignal
  ): Promise<{ content: string; actions: ChatAction[] }>
  ```
  - `systemContext` を messages への埋め込みではなく `system` パラメータで渡す（毎回最新のマップが反映され、履歴の改変が不要になる）。`messages` は会話履歴をそのまま渡す
  - `client.messages.stream({ model, max_tokens: 2048, system, messages }, { signal })` を使用。`text` デルタを蓄積し、`onText(累積テキストから /```actions[\s\S]*$/ を除去したもの)` を都度呼ぶ（actions ブロックの途中表示を防ぐ）
  - 完了後は従来どおり actions をパースして返す。Abort 時はそれまでの content（actions は空配列）を返す
- [ ] `src/stores/uiStore.ts`: `updateLastChatMessage(content: string)` を追加（`chatMessages` 末尾が assistant ならその `content` を置換）
- [ ] `src/components/panels/AIChatPanel.tsx`: 送信時に空 content の assistant メッセージを先に `addChatMessage` → `onText` で `updateLastChatMessage`。完了時に actions を最終メッセージに反映。`isChatLoading` 中は送信ボタンを「■ 停止」表示に変え、クリックで `AbortController.abort()`（`useRef<AbortController | null>` で保持）

**D. 提案生成の堅牢化とキャンセル**
- [ ] `src/services/claudeService.ts`: `generateSuggestions` / `analyzeMap` / `suggestConnections` / `suggestClusters` の `max_tokens` を `2048` に引き上げ
- [ ] `generateSuggestions(req, signal?: AbortSignal)` に signal を追加（`client.messages.create({...}, { signal })`）
- [ ] `src/components/panels/AISuggestionPanel.tsx`: 生成中（`isAILoading`）はローディング表示の横に「キャンセル」ボタンを表示。abort 時はローディング解除のみ（エラー表示しない。`e.name === 'AbortError'` または `Anthropic.APIUserAbortError` を判定）

**E. 提案追加後のフォーカス移動**
- [ ] `src/components/panels/AISuggestionPanel.tsx`: `useReactFlow()` の `fitView` を使い、`handleAddSelected` 完了後に `fitView({ nodes: [{ id: 選択ノードid }, ...追加ノードidの配列], padding: 0.3, duration: 500 })` を実行（追加先が兄弟モードの場合は親ノード id を含める）

**ドキュメント更新**
- [ ] `docs/design.md` の「AIサービス設計」（chatWithMap の system 化・ストリーミング・toFriendlyAIError）を更新
- [ ] `docs/requirements.md` のAI機能要件（ストリーミング・キャンセル・エラー表示）を追記

**完了条件**: APIキー未設定でも迷わず設定に辿り着ける。チャットが逐次表示され停止できる。提案10件でも解析エラーにならず、追加後に追加先へ視点が移動する

---

### Phase 24: 全般UX・品質改善（約2日）

**目標**: 個別機能に属さない横断的な体験品質を引き上げる（追加提案分）

**背景（現状の課題）**:
- ダークモード対応が Header・一部パネルのみで、Toolbar / NodeActionBar / キャンバス背景・MiniMap / 整列ドロップダウン等がライト配色固定（ダークテーマにすると混在して見える）
- ノード数が増えると画面外ノードも全て DOM 描画される
- ウェルカドモーダルにキーボード操作の案内がない

#### タスク

**A. ダークモードの網羅**
- [ ] `src/components/toolbar/Toolbar.tsx`: コンテナ（`bg-white border-gray-200`）とすべてのボタン・ドロップダウンに `dark:` クラスを追加（`dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700` 等。Header・既存パネルの配色に合わせる）
- [ ] `src/components/canvas/IdeaCanvas.tsx`:
  - `NodeActionBar` のコンテナ・ボタンに dark クラス追加
  - `useSettingsStore((s) => s.theme)` を参照し、`<Background color={theme === 'dark' ? '#374151' : '#e5e7eb'} ...>` に変更
  - `MiniMap` / `Controls` に theme 条件で `!bg-gray-800` 系クラスを付与（className を三項演算子で切替）
  - エンプティ状態のテキストに `dark:text-gray-500` 等を追加
- [ ] `src/components/common/SearchBar.tsx` / `ConfirmDialog.tsx` / `Toast.tsx` / `ContextMenu.tsx` の dark 対応漏れを確認して補完（ContextMenu は MenuItem に dark クラスあり・コンテナ側を確認）
- [ ] 確認方法: テーマを切り替えて全UI（ツールバー・メニュー・モーダル・トースト・キャンバス）を目視確認

**B. 大規模マップのパフォーマンス**
- [ ] `src/components/canvas/IdeaCanvas.tsx`: `<ReactFlow onlyRenderVisibleElements ...>` を追加（画面外ノードの DOM 描画をスキップ）
- [ ] 動作確認: 100ノード規模のマップでパン・ズームが滑らかなこと。発表モード・検索ハイライトに副作用がないこと（`onlyRenderVisibleElements` は画面外ノードを非表示にするだけで状態は保持される）

**C. ウェルカム・ヘルプ導線**
- [ ] `src/components/common/WelcomeModal.tsx`: 3ステップの末尾に「`Ctrl+/` でいつでもショートカット一覧を表示できます」の1行を追加
- [ ] `src/components/common/KeyboardShortcutsModal.tsx`: Phase 19〜23 で追加したショートカット（Ctrl+S / Enter / F2 / 矢印キー）が漏れなく載っていることを確認

**ドキュメント更新**
- [ ] `docs/design.md`（テーマ設計・パフォーマンス方針）、`docs/requirements.md`（非機能要件: ダークモード網羅・大規模マップ）を更新

**完了条件**: ダークテーマで配色の混在がなくなる。100ノード規模でも操作が滑らか

---

### Phase 19〜24 の実装順について

各フェーズは独立して実装可能（依存は Phase 19-A のトースト基盤 → 19-B のみ）。推奨順序は効果の大きい順に **20（ファイル）→ 22（編集）→ 19（認証）→ 23（AI）→ 21（レイアウト）→ 24（全般）**。ただし Phase 21-A（FloatingEdge のラベル・双方向矢印の不具合修正）だけは独立した小修正なので最初に着手してよい。

---

## 2. Google Cloud Project 設定（開発者向け）

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

## 3. 開発環境セットアップ

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

## 4. スケジュール概要

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
| Phase 11 | デバイス間連携 & スタートアップ体験改善 | 4日 |
| Phase 12 | ノードUX細部改善 & グループ化 | 3日 |
| Phase 13 | AI機能の改善 | 2日 |
| Phase 14 | AIチャット & マップ対話 | 3日 |
| Phase 15 | プレゼンテーションモード | 3日 |
| Phase 16 | Google Drive 保存のデータ消失バグ修正 | 1日 ✅ |
| Phase 17 | mapId による衝突検出 | 1日 ✅ |
| Phase 18 | UX 小改善バッチ | 1日 |
| Phase 19 | Google認証UXの改善 | 2日 |
| Phase 20 | ファイル保存・読み込みUXの改善 | 2日 |
| Phase 21 | レイアウト・整列機能の強化 | 3日 |
| Phase 22 | アイデア編集UXの改善 | 3日 |
| Phase 23 | AI連携UXの改善 | 3日 |
| Phase 24 | 全般UX・品質改善 | 2日 |
| **Phase 1-4 合計** | | **約8日** |
| **Phase 5-11 合計** | | **約20日** |
| **Phase 12-15 合計** | | **約11日** |
| **Phase 16-18 合計** | | **約3日** |
| **Phase 19-24 合計（UX改善）** | | **約15日** |
| **全体合計** | | **約57日** |

---

## 5. リスクと対策

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
| APIキー同期パスワードの忘れ | パスワードを忘れた場合はDriveから読み込めなくなる（APIキーを再入力すれば継続利用可能）。UIに「パスワードを忘れた場合は再入力してください」と明示する |
| GIS Token自動再認証の失敗 | prompt:'' でポップアップが開く場合（ブラウザ設定によりブロックされることがある）は、ユーザーにサインインボタンを提示してフォールバック |
| Drive settings.json の競合 | 複数デバイスから同時に設定を保存した場合は上書きになる（現実的に同時操作は稀なため許容。APIキーは同一のことがほとんど） |
| Phase 19: userinfo.email スコープ追加による再同意 | 既存ユーザーは初回のみ同意ポップアップが再表示される。サイレント再認証が新スコープで失敗した場合はサインインボタンへフォールバック（既存の error_callback フローで担保） |
| Phase 21: 整列アニメーション中の Undo 不整合 | アニメーションフレームは `setNodesNoHistory` で履歴に積まず、完了時に `commitNodesWithHistory(original, laid)` で変更前スナップショットを明示的に渡す。実行中フラグで多重実行を防止 |
| Phase 22: Enter 兄弟追加と既存操作の競合 | input/textarea フォーカス中は既存の isEditing ガードで除外。ConfirmDialog の Enter 確認とはモーダル抑制チェックの順序で共存させる |
| Phase 23: ストリーミング中の actions ブロック露出 | 表示用テキストから ```actions 以降を正規表現で除去してから onText に渡し、パースは完了後にのみ実行する |
| Phase 23: chatWithMap の system 化による挙動変化 | 旧履歴（コンテキスト埋め込み済み第1メッセージ）はセッション内のみ保持のため移行処理は不要。チャット履歴クリアで初期化できる |
