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
    "model": "claude-sonnet-5",
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

### Phase 14: AIチャット & マップ対話（約3日） ✅ 完了（2026-08-05）

**目標**: AIを「マップ全体と対話できる思考パートナー」に昇格させる

#### 設計方針
- 現在のAI機能（ノード個別拡張、マップ分析）に加え、自由形式のチャットでマップについて議論できる
- チャット履歴はセッション内のみ保持（Drive保存は行わない）
- AIはマップの全ノード（最大50件）・エッジ・カテゴリ情報をコンテキストとして保持した上で回答
- AIレスポンスに ```actions``` ブロックを埋め込み、パースしてアクションボタンを表示

#### タスク

**AIチャットパネル** (`src/components/panels/AIChatPanel.tsx`)
- [x]✅ ヘッダーに「AIチャット」ボタンを追加（マップ分析ボタンの隣、青系カラー）
- [x]✅ サイドパネル形式のチャットUI（メッセージ履歴 + 入力フォーム）
- [x]✅ `claudeService.ts` に `chatWithMap(messages, mapContext)` 関数を追加
  - 初回メッセージにマップ全体のコンテキストを埋め込み
  - 以降は会話履歴を引き継いで連続対話（最大40件まで保持）
- [x]✅ AIの回答にマップ操作の提案が含まれる場合、ワンクリックで実行できるアクションボタンを表示
  - `addNode`（ノード追加）・`connectNodes`（ノード接続）・`updateNode`（ノード更新）の3種類

**コンテキスト認識機能**
- [x]✅ チャット中に `@ノード名` でノードを参照できる（オートコンプリート付き、↑↓/Enter/Tab/Esc対応）
- [x]✅ 選択中のノードがある場合は「このノードについて」のクイック質問チップを表示
  - 「深掘り」「反論」「アクション化」「関連提案」「次のステップ」の5種類
- [x]✅ `Ctrl+Shift+C` でチャットパネルをトグル
- [x]✅ 型定義追加: `ChatMessage`, `ChatAction`, `ChatActionType`, `MapContext`, `ChatWithMapRequest`
- [x]✅ `uiStore` に `isChatPanelOpen`, `chatMessages`, `isChatLoading` と対応アクションを追加

#### 動作確認（Phase 31・Playwright + preview ビルド・API はモック・2026-08-05）

> `docs/review/ux.md` の Phase 14 チェックリスト15項目に対応。Anthropic API は `window.fetch` を差し替えた SSE モックで代替し、ストリーミング・中断・エラー分岐を実挙動で確認した。

- [x]✅ 1. APIキー未設定でチャットを開く → 🔑・「設定を開く」ボタンが出て入力欄は非表示
- [x]✅ 2. メッセージ送信 → ローディングドット3点 → 逐次表示（途中128字→完了150字）→ 完了
- [x]✅ 3. 生成中に■停止 → 途中まで（112字）のテキストが残り、続けて再送信できる
- [x]✅ 4. `@ノード名` オートコンプリート（候補4件・↓Enter／Tab で挿入・↑で戻る・Esc で閉じる）
- [x]✅ 5. クイック質問チップ5種はノード選択で表示。**@メンションを入力しても消えない**（`selectedNode` 依存の仕様。ux.md の「@メンション後に消える」は誤った期待値）
- [x]✅ 6. `addNode` アクションボタン → ノード追加＋「「〜」を追加しました」トースト
- [x]✅ 7. 同一アクションを2回クリックすると同名ノードが2つできる（重複ガードなしを仕様として確認）
- [x]✅ 8. 42件送信後にチャット表示は40件（先頭が破棄される `slice(-40)`）
- [x]✅ 9. 「クリア」→ **確認ダイアログが出る**（Phase 30 で追加済み。ux.md の「確認なし」は旧仕様）
- [x]✅ 10. `Ctrl+Shift+C` でパネルをトグルできる
- [x]✅ 11. PC ではマスクが `display:none` で、パネル外クリックでも閉じない
- [x]✅ 12. スマホのパネル外タップで閉じる → **修正して達成**。当初はパネル（`w-full h-full`）がマスクを完全に覆い到達不可だったため、`h-[85%]` の下部シートに変更して上部15%でマスクをタップできるようにした
- [x]✅ 13. ネットワークエラー → 「ネットワークエラーです。接続を確認してください」
- [x]✅ 14. 429 → 「レート制限に達しました。1分ほど待ってから再試行してください」（SDK の自動リトライ後）
- [x]✅ 15. ノード55件のマップでチャット → system に `[m1]`〜`[m50]` の50件のみ・総数は「ノード数: 55件」と記載。@メンションしたノードを先頭に寄せてから 50 件で切る仕様

**完了条件**: マップを見ながらAIとフリーフォームで対話でき、会話の流れでノード追加・接続を実行できる → 達成

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

### Phase 18: UX 小改善バッチ ✅ 完了（2026-08-05）

**背景**: AI生成ノードのタイトルが長すぎる・Markdownが生テキストで表示される・プレゼンテーション順序を後から編集できないという複数の小さなUX課題を一括で解決する。

#### タスク
- [x]✅ `src/utils/markdown.ts` 新規作成: `renderMarkdownSimple` を共通ユーティリティとして抽出
- [x]✅ `src/types/index.ts`: `AISuggestion.text` → `AISuggestion.title` + `body?: string` に変更、`ChatAction.body?: string` 追加
- [x]✅ `src/services/claudeService.ts`: `generateSuggestions` のプロンプト・JSONスキーマを `title`/`body` 分離仕様に更新
- [x]✅ `src/stores/mapStore.ts`: `addNode()` シグネチャに `body?: string` 追加
- [x]✅ `src/components/panels/AISuggestionPanel.tsx`: `text` → `title` 参照を修正、提案カードにbodyプレビュー表示、addNodeにbodyを渡す
- [x]✅ `src/components/panels/AIChatPanel.tsx`: `handleAction` の addNode 呼び出しに `action.body` を渡す
- [x]✅ `src/components/panels/NodeDetailPanel.tsx`: `isPreview` デフォルト `false` → `true`、`renderMarkdownSimple` を共通ユーティリティからインポート
- [x]✅ `src/components/canvas/IdeaNode.tsx`: body を `renderMarkdownSimple` で整形表示（`dangerouslySetInnerHTML`、高さ制限）
- [x]✅ `src/components/screens/PresentationMode.tsx`: body を Markdown整形表示
- [x]✅ `src/stores/uiStore.ts`: `isPresentationOrderOpen` 状態 + `setPresentationOrderOpen`・`reorderPresentationNodes` アクション追加
- [x]✅ `src/components/panels/PresentationOrderPanel.tsx` 新規作成: 発表順序編集モーダル（↑↓・×・クリア・発表開始）
- [x]✅ `src/App.tsx`: `PresentationOrderPanel` を追加
- [x]✅ `src/components/toolbar/Toolbar.tsx`: 発表ボタンを `setPresentationOrderOpen(true)` に変更

#### 動作確認（Phase 31・Playwright + preview ビルド・2026-08-05）

> `docs/review/ux.md` の Phase 18 チェックリスト9項目に対応。

- [x]✅ 1. AI提案のプロンプトに「簡潔なタイトル（20字以内）」「title は短く端的に。詳細・補足・具体例は body に記述」が含まれる（送信リクエストの実物で確認）
- [x]✅ 2. AI提案カードの body プレビューが `-webkit-line-clamp: 2` で表示され、採用したノードに body が入る
- [x]✅ 3. ノード上の📝バッジをクリックすると詳細パネルが開く
- [x]✅ 4. `NodeDetailPanel` は既定でプレビュー表示（トグルが「✏️ 編集」）、`## 見出し`・`**太字**`・`- 箇条書き` が `h2`/`strong`/`li` に整形される
- [x]✅ 5. 発表画面でも body が `strong`・`li` に整形表示される
- [x]✅ 6. **導線が Phase 24 で変わっている**: ツールバーの「発表」は左＝直接発表開始／右のドロップダウン「発表順を編集してから発表」が `PresentationOrderPanel` を開く（計画時の「発表ボタン＝パネルを開く」ではない）
- [x]✅ 7. `PresentationOrderPanel` の ↑↓ で順序が入れ替わり、番号バッジも更新される
- [x]✅ 8. 「発表開始」で発表モードに入る（ヘッダー非表示・カウンタ表示）
- [x]✅ 9. `ChatAction.body` 付きアクションで作成したノードに📝バッジが付き、詳細パネルに本文が入る

**完了条件**: AI生成ノードのタイトルが短く本文が分離される / ノード上・右パネル・プレゼン画面でMarkdownが整形表示される / 発表順序パネルを開いて順序を編集・発表開始できる → 達成（パネルへの導線は Phase 24 でドロップダウン配下に変更済み）

---

### Phase 19: Google認証UXの改善（約2日） ✅ 完了（2026-06-18）

**目標**: 認証切れ・エラー時にユーザーが迷わず復帰でき、接続状態が常に明確である

**背景（現状の課題）**:
- Drive保存が401になると「再度サインインしてください」トーストが出るだけで、復帰にはヘッダーのボタンを自分で探す必要がある
- アクセストークン更新タイマー（`setTimeout`）はバックグラウンドタブでブラウザにスロットリングされるため、タブ復帰直後の保存が401になることがある
- `useGoogleAuth` の `error_callback` で `err.type`（`popup_failed_to_open` 等）が英語の生文字列のままトースト表示される
- どのGoogleアカウントで接続しているか画面のどこにも表示されない
- サインアウトが確認なしで即実行され、Drive自動保存が止まることの説明がない

#### タスク

**A. トーストのアクションボタン対応（共通基盤・B と Phase 20 以降で使用）**
- [x]✅ `src/stores/uiStore.ts`: `Toast` インターフェースに `action?: { label: string; onClick: () => void }` を追加。`addToast` のシグネチャを `addToast(message, type, action?)` に拡張（action 付きトーストは自動消滅を 4秒→8秒 に延長）
- [x]✅ `src/components/common/Toast.tsx`: `toast.action` があればメッセージの下に小さなボタン（primary色・下線スタイル）を表示。クリックで `action.onClick()` を実行してから `removeToast(id)`

**B. 401時のサイレント再認証＋保存の自動リトライ**
- [x]✅ `src/hooks/useGoogleAuth.ts`: `silentReauth(): void` を追加して return オブジェクトに含める。実装: `localStorage.getItem(AUTO_AUTH_FLAG) === 'true'` かつ `tokenClientRef.current` が存在する場合のみ、`isAutoAuthRef.current = true` をセットして `requestAccessToken({ prompt: '' })` を呼ぶ。条件を満たさない場合は何もしない
- [x]✅ `src/hooks/useAutoSave.ts`: シグネチャを `useAutoSave(accessToken: string | null, auth: { silentReauth: () => void; signIn: () => void })` に変更
  - `reauthAttemptedRef = useRef(false)` を追加
  - `performSave` の 401 エラー時: `reauthAttemptedRef.current === false` なら ① `reauthAttemptedRef.current = true` ② `pendingRetryRef.current = true` ③ `auth.silentReauth()` を呼び、**トーストは出さない**（saveStatus は `'error'` のままにする）
  - 既に `reauthAttemptedRef.current === true` の場合（サイレント再認証後も401）: 「Googleドライブの認証が切れました」トーストを **「再接続」アクション付き**（`action.onClick = auth.signIn`）で表示
  - `useEffect(() => { ... }, [accessToken])` を追加: accessToken が non-null に変化したとき `reauthAttemptedRef.current = false` にリセットし、`pendingRetryRef.current === true` なら `pendingRetryRef.current = false` にして `scheduleSave()` で保存をリトライ
- [x]✅ `src/App.tsx`: `useAutoSave(googleAuth.accessToken, { silentReauth: googleAuth.silentReauth, signIn: googleAuth.signIn })` に呼び出しを変更

**C. バックグラウンド復帰時のトークン失効チェック**
- [x]✅ `src/hooks/useGoogleAuth.ts`: `isGisReady` 後の `useEffect` 内で `visibilitychange` リスナーを追加。`document.hidden === false` になったとき sessionStorage の `TOKEN_EXPIRY_KEY` を読み、**失効済みまたは残り5分未満** かつ `AUTO_AUTH_FLAG === 'true'` なら `requestAccessToken({ prompt: '' })`（`isAutoAuthRef.current = true` を立てる）。十分残っていれば何もしない。クリーンアップでリスナー解除

**D. 接続アカウント（メールアドレス）の表示**
- [x]✅ `src/hooks/useGoogleAuth.ts`: `SCOPES` を `'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email'` に変更。トークン取得成功時（callback内）にメールアドレスを取得し、state に `userEmail: string | null` を追加して保存。取得失敗は無視（email 表示なしで継続）。`localStorage.setItem('googleUserEmail', email)` にも保存し、`signOut` で削除。`GoogleAuthState` 型と return に `userEmail` を追加
- [x]✅ `src/components/common/Header.tsx`: 「接続済み」ボタンをクリックでドロップダウンメニュー表示に変更（Toolbar の整列メニューと同じ「外クリックで閉じる」パターン）。メニュー内容: ①メールアドレス（クリック不可・truncate・text-xs gray） ②区切り線 ③「マップ一覧」（`setMapListOpen(true)`） ④「サインアウト」（下記F の確認ダイアログ）。既存の独立「マップ一覧」ボタンはこのドロップダウンに統合して削除（モバイル用アイコンボタンは残す）
- [x]✅ `src/components/screens/FileOpenDashboard.tsx`: 未サインイン時、`localStorage.getItem('googleUserEmail')` があればサインインボタンの下に「前回: xxx@gmail.com」を text-xs gray で表示

**E. 認証エラーメッセージの日本語化**
- [x]✅ `src/hooks/useGoogleAuth.ts`: `function friendlyAuthError(type: string): string | null` を追加し `error_callback` で使用。マッピング: `popup_closed` → `null`（表示しない・現状維持） / `popup_failed_to_open` → 「ポップアップがブロックされました。ブラウザのポップアップ設定を確認してください」 / `access_denied` → 「Googleへのアクセスが許可されませんでした」 / その他 → 「Google認証でエラーが発生しました（{type}）」

**F. サインアウト確認ダイアログ**
- [x]✅ `src/components/common/Header.tsx`: サインアウト押下時に直接 `onGoogleSignOut()` せず `openConfirmDialog({ title: 'サインアウト', message: 'Googleドライブへの自動保存が停止します。編集内容はこの端末のローカルには保存され続けます。', confirmLabel: 'サインアウト', danger: true, onConfirm: onGoogleSignOut })` を呼ぶ

**ドキュメント更新**
- [x]✅ `docs/design.md` の認証まわりの設計（silentReauth・userEmail・visibilitychange チェック）を更新
- [x]✅ `docs/requirements.md` に「認証切れ時の自動復帰」「接続アカウント表示」要件を追記

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

### Phase 21: レイアウト・整列機能の強化（約3日）✅ 完了（2026-06-20）

**目標**: 手動配置の微調整が簡単になり、自動整列の挙動が追える

**背景（現状の課題）**:
- 自動整列は全ノード一括のみで、複数選択したノードを揃える・等間隔に並べる手段がない
- 整列実行時にノードが瞬間移動し、どのノードがどこへ動いたか追えない
- **不具合**: `FloatingEdge.tsx` が `label`・`markerStart` を `BaseEdge` に渡しておらず、エッジの「ラベルを編集」「双方向」が**機能していない**（mapStore 側のデータは正しく更新されるが描画されない）
- ツールバーの「ノード追加」がビューポート左上付近固定で、既存ノードと重なりやすい
- グリッドスナップがない

#### タスク

**A. FloatingEdge の不具合修正（ラベル・双方向矢印）**
- [x]✅ `src/components/canvas/FloatingEdge.tsx`: `EdgeProps` から `label` と `markerStart` も受け取り、`markerStart` は `BaseEdge` にそのまま渡す。`getBezierPath(args)` の返り値を `[edgePath, labelX, labelY]` で受け、`label` があれば `@xyflow/react` の `EdgeLabelRenderer` で `transform: translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` の位置に白背景（dark対応）の小ラベル（text-xs・px-1.5・rounded）を描画
- [x]✅ 動作確認: エッジ右クリック→「ラベルを編集」の文字が線上に表示される。「双方向」で両端に矢印が付く。保存→再読込後も維持される

**B. 複数選択ノードの整列・分布**
- [x]✅ `src/stores/mapStore.ts` にアクションを追加:
  ```ts
  alignSelectedNodes: (type: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom') => void
  distributeSelectedNodes: (direction: 'horizontal' | 'vertical') => void
  ```
  - 対象: `selected && type !== 'groupNode'` かつ **`parentId === undefined`** のノードのみ（グループ子ノードは座標系が異なるため除外）。対象が2未満（distribute は3未満）なら何もしない
  - サイズは `n.measured ?? { width: 160, height: 60 }` を使用
  - `left`: 最小 `position.x` に揃える / `right`: 最大 `position.x + width` に右端を揃える / `center-h`: 各ノード中心xの平均値に中心を揃える / `top`・`bottom`・`center-v` は y 軸で同様
  - `distribute`: 対象を中心座標でソートし、両端ノードは固定、中間ノードの**中心**が等間隔になるよう配置
  - 変更前スナップショットを `past` に push（既存アクションと同じパターン）
- [x]✅ `src/components/canvas/ContextMenu.tsx`: ノードメニューで `nodes.filter((n) => n.selected && !n.parentId && n.type !== 'groupNode').length >= 2` のとき「整列」セクション（Divider区切り）を追加: 「⬅ 左揃え」「⬆ 上揃え」「↔ 左右中央」「↕ 上下中央」、3個以上なら「⇿ 横に等間隔」「⇳ 縦に等間隔」も表示。各項目はアクション実行後 `closeContextMenu()`

**C. 整列アニメーション**
- [x]✅ `src/stores/mapStore.ts` に追加:
  ```ts
  setNodesNoHistory: (nodes: IdeaNode[]) => void  // set({ nodes }) のみ。履歴に積まない
  commitNodesWithHistory: (originalNodes: IdeaNode[], finalNodes: IdeaNode[]) => void
  // → set((state) => ({ nodes: finalNodes, past: pushPast(state.past, snapshot(originalNodes, state.edges)), future: [] }))
  ```
  - `syncGroupMeasured` ヘルパーを抽出し、`setNodes` / `setNodesNoHistory` / `commitNodesWithHistory` で共通使用
- [x]✅ `src/utils/mapLayout.ts` に追加:
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
- [x]✅ `src/components/toolbar/Toolbar.tsx`: `handleRadialLayout` / `handleDagreLayout` を変更:
  1. `const original = nodes`（現在配列を保持）
  2. `const laid = applyXxx(...)`
  3. `animateNodePositions(original, laid, setNodesNoHistory, () => { commitNodesWithHistory(original, laid); fitView({ padding: 0.15, duration: 400 }) })`
  4. 実行中フラグ（`useRef<boolean>`）で多重実行をガード（アニメーション中は整列メニューの再実行を無視）
  - **重要**: アニメーション中の各フレームは履歴に積まないこと。整列後に Undo を1回押すと整列前の配置に戻ることを確認する

**D. グリッドスナップ**
- [x]✅ `src/stores/settingsStore.ts`: `snapToGrid: boolean`（default `false`）+ `setSnapToGrid` を追加し、`partialize` にも含める
- [x]✅ `src/components/canvas/IdeaCanvas.tsx`: `<ReactFlow snapToGrid={snapToGrid} snapGrid={[20, 20]} ...>` を追加
- [x]✅ `src/components/toolbar/Toolbar.tsx`: 整列ドロップダウン内の末尾に Divider ＋「グリッドにスナップ」トグル項目（有効時は ✓ を表示。クリックしてもメニューは閉じない）

**E. ノード追加位置の改善（重なり回避）**
- [x]✅ `src/utils/mapLayout.ts`: `export function findFreePosition(desired: { x: number; y: number }, existingNodes: Node<IdeaNodeData>[]): { x: number; y: number }` を追加 — desired を起点に、既存ノードと `|dx| < 200 && |dy| < 80` で重なる間、y を 90px ずつ下にずらす（最大10回）
- [x]✅ `src/components/toolbar/Toolbar.tsx` `handleAddNode`: `getViewport` 計算をやめ、`screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })` で画面中央に変更し、`findFreePosition` を通してから `addNode`
- [x]✅ `src/stores/mapStore.ts` `addConnectedNode`: グループ外分岐の `finalPosition` 決定後に `findFreePosition(finalPosition, state.nodes)` を適用

**F. エッジスタイル設定（任意・低優先）**
- [x]✅ `src/stores/settingsStore.ts`: `edgeStyle: 'bezier' | 'smoothstep' | 'straight'`（default `'bezier'`）+ setter + partialize
- [x]✅ `src/components/canvas/FloatingEdge.tsx`: `useSettingsStore((s) => s.edgeStyle)` を参照し `getBezierPath` / `getSmoothStepPath` / `getStraightPath` を切り替え（引数 `args` は共通で流用可）
- [x]✅ `src/components/panels/SettingsPanel.tsx`: ノード形状設定の隣に3択UIを追加（既存の nodeShape と同じUIパターン）

**ドキュメント更新**
- [x]✅ `docs/design.md` の「状態管理設計」（settingsStore の `edgeStyle` 追加）「FloatingEdge エッジスタイル切替」を更新
- [x]✅ `docs/requirements.md` にエッジスタイル切替要件を追記

**完了条件**: 複数選択→右クリックで整列・等間隔配置ができ、自動整列がアニメーションし Undo 1回で戻る。エッジラベルと双方向矢印が表示される

---

### Phase 22: アイデア編集UXの改善（約3日）✅ 完了（2026-06-18）

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
- [x]✅ `src/stores/uiStore.ts`: `editingNodeId: string | null` + `setEditingNodeId(id: string | null)` を追加
- [x]✅ `src/components/canvas/IdeaNode.tsx`: ローカル `isEditing` state を廃止し `useUIStore` の `editingNodeId === id` で編集状態を判定。`handleDoubleClick` を `openNodeDetail(id)` から `setEditingNodeId(id)` に変更。blur / Enter（Shiftなし）/ Escape で `setEditingNodeId(null)`（既存のコミット・復元ロジックは維持）
- [x]✅ 詳細モーダルへの導線を維持・補強: NodeActionBar「詳細」・右クリック「詳細を開く」は既存のまま。`IdeaNode` の📝本文バッジに `onClick={(e) => { e.stopPropagation(); openNodeDetail(id) }}` を追加し `cursor-pointer` に
- [x]✅ `src/hooks/useKeyboardShortcuts.ts`: `F2` で `ui.selectedNodeId` があれば `ui.setEditingNodeId(ui.selectedNodeId)`
- [x]✅ `src/components/canvas/ContextMenu.tsx`: ノードメニューの先頭付近に「✏️ 名前を変更」（shortcut表示 `F2`）を追加 → `setEditingNodeId(targetId)` + `closeContextMenu()`
- [x]✅ 確認: 編集中（textarea フォーカス中）は既存の `isEditing` ガードによりショートカットが発火しないこと

**B. 作成直後に編集モード開始**
- 対象経路: ①キャンバスダブルクリック（`IdeaCanvas.handleDoubleClickOnPane`）②ツールバー「ノード追加」③Tab（子追加）④右クリック「アイデアを作成」「アイデアを作成（接続）」⑤Enter（兄弟追加・下記C）
- [x]✅ 各経路で `addNode` / `addConnectedNode` の返り値 id を受けて `setSelectedNodeId(id)` + `setEditingNodeId(id)` を呼ぶ
- [x]✅ `IdeaNode` の textarea は表示時に `select()` されるため、そのままタイプすれば「新しいアイデア」が上書きされる（既存挙動を確認）

**C. Enter で兄弟ノード追加**
- [x]✅ `src/stores/mapStore.ts`: `addSiblingNode(nodeId: string): string | null` を追加 — `edges.find((e) => e.target === nodeId)` で最初の親エッジを探す。親があれば `addConnectedNode(親id)` を呼んで返す。親がなければ選択ノードの直下（`x` 同じ、`y + (measured?.height ?? 60) + 30`、`findFreePosition` 適用）に独立ノードを作成して id を返す
- [x]✅ `src/hooks/useKeyboardShortcuts.ts`: 修飾キーなし `Enter`（`ui.selectedNodeId` あり・編集中でない・モーダル抑制チェック通過後）→ `addSiblingNode` → 返り値 id を選択＋編集開始
- [x]✅ `src/components/common/KeyboardShortcutsModal.tsx`: Enter / F2 / 矢印キーの行を追加

**D. 矢印キーによるノード選択移動**
- [x]✅ `src/stores/mapStore.ts`: `selectOnlyNode(id: string): void` を追加（全ノードの `selected` フラグを `n.id === id` に設定する単純 `set`。履歴に積まない）
- [x]✅ `src/hooks/useKeyboardShortcuts.ts`: 矢印キー（`ui.selectedNodeId` あり・修飾なし）で方向別の最近傍ノードへ選択を移動:
  - 現在ノードの絶対中心 `(cx, cy)`（`parentId` があれば親グループ position を加算）から各候補ノード中心へのベクトル `(dx, dy)` を計算
  - ArrowRight: `dx > 0` かつ `|dy| <= |dx| * 1.2` を満たす候補のうちユークリッド距離最小のノード。他の方向も同様（軸を入れ替え）
  - 候補は `type !== 'groupNode'` のノードのみ。該当なしなら何もしない（`preventDefault` もしない）
  - 移動先確定時: `e.preventDefault()` → `map.selectOnlyNode(id)` + `ui.setSelectedNodeId(id)`

**E. 詳細モーダル（NodeDetailPanel）の操作性**
- [x]✅ `src/components/panels/NodeDetailPanel.tsx`: close 処理を `commitAndClose()` に集約（`titleInput`/`bodyInput` の未コミット値を `updateNodeTitle`/`updateNodeBody` で保存してから `closeNodeDetail()`。blur が走らない閉じ方への対策）
- [x]✅ 背景（最外 div）クリックで `commitAndClose()`（内側カードは既存の `stopPropagation` あり）
- [x]✅ `useEffect` の keydown で Escape → `commitAndClose()`。本文 textarea 内 `Ctrl+Enter` → `commitAndClose()`

**F. コピー&ペーストでエッジも複製**
- [x]✅ `src/stores/mapStore.ts`: `clipboard` を `{ nodes: IdeaNode[]; edges: Edge[] }` に変更（初期値 `{ nodes: [], edges: [] }`・`reset` も更新）
  - `copyNodes`: 選択ノードに加えて、`source`・`target` の両方が選択集合に含まれるエッジも保存
  - `paste`: `Map<oldId, newId>` を作ってノードを複製した後、保存エッジを `makeEdge({ source: map.get(e.source)!, target: map.get(e.target)!, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle }, Boolean(e.markerStart))` で再生成し `label` も引き継ぐ
- [x]✅ `src/hooks/useKeyboardShortcuts.ts` と `src/components/canvas/ContextMenu.tsx` の `clipboard.length` 参照を `clipboard.nodes.length` に修正（参照箇所を grep して全て直す）

**ドキュメント更新**
- [x]✅ `docs/design.md` の「状態管理設計」（editingNodeId・clipboard 構造変更・新アクション）と「コンテキストメニュー設計」（名前を変更）を更新
- [x]✅ `docs/requirements.md` のノード編集要件（ダブルクリック挙動の変更・キーボード操作）を修正・追記

#### G. ヘルプ導線（追加 2026-06-18）

- [x]✅ `src/components/toolbar/Toolbar.tsx`: 全体表示ボタンの右端に ❓ help-circle アイコンボタンを追加。`onClick={() => setShortcutsModalOpen(true)}`、`title="操作ガイド・ショートカット (Ctrl+/)"`
- [x]✅ `src/components/toolbar/BottomNav.tsx`: 「設定」ボタンの右に「ヘルプ」ボタンを追加。help-circle アイコン＋「ヘルプ」ラベル。`onClick={() => setShortcutsModalOpen(true)}`
- [x]✅ `src/components/common/KeyboardShortcutsModal.tsx`: モーダル見出しを「操作ガイド」に変更。「マウス・タッチ操作」セクションを追加（ダブルクリック・右クリック・ドラッグ・Shift+クリック・ロングプレス）
- [x]✅ `src/components/common/WelcomeModal.tsx`: 最終ステップに操作ガイドへの誘導文を追加

**完了条件**: ダブルクリックでその場でタイトル編集でき、Enter / Tab / F2 / 矢印キーだけで連続的にマップを広げられる。コピペで接続ごと複製される

---

### Phase 23: AI連携UXの改善（約3日） ✅ 完了（2026-06-19）

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
- [x]✅ `src/components/panels/AISuggestionPanel.tsx` / `AIChatPanel.tsx` / `MapAnalysisPanel.tsx`: `useSettingsStore` の `apiKey` が空文字のとき、パネル本文を空状態UIに差し替える: 🔑アイコン＋「Claude APIキーが必要です」見出し＋「AI機能を使うには Anthropic の APIキーを設定してください」1行＋「設定を開く」ボタン（`setSettingsOpen(true)`）。実行ボタン・入力欄は表示しない

**B. エラーメッセージの共通整形**
- [x]✅ `src/services/claudeService.ts`: 末尾に追加:
  ```ts
  export function toFriendlyAIError(e: unknown): string
  ```
  `Anthropic.APIError` を `instanceof` 判定し `status` で分岐: 401 → 「APIキーが無効です。設定画面で確認してください」 / 429 → 「レート制限に達しました。1分ほど待ってから再試行してください」 / 529 → 「Claude APIが混雑しています。しばらく待ってから再試行してください」 / `Anthropic.APIConnectionError` → 「ネットワークエラーです。接続を確認してください」 / それ以外は `e instanceof Error ? e.message : 'エラーが発生しました'`
- [x]✅ `AISuggestionPanel` / `AIChatPanel` / `MapAnalysisPanel` の catch 節をすべて `toFriendlyAIError(e)` に統一

**C. チャットのストリーミング表示＋停止ボタン＋system化**
- [x]✅ `src/services/claudeService.ts`: `chatWithMap` のシグネチャを変更:
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
- [x]✅ `src/stores/uiStore.ts`: `updateLastChatMessage(content: string)` を追加（`chatMessages` 末尾が assistant ならその `content` を置換）
- [x]✅ `src/components/panels/AIChatPanel.tsx`: 送信時に空 content の assistant メッセージを先に `addChatMessage` → `onText` で `updateLastChatMessage`。完了時に actions を最終メッセージに反映。`isChatLoading` 中は送信ボタンを「■ 停止」表示に変え、クリックで `AbortController.abort()`（`useRef<AbortController | null>` で保持）

**D. 提案生成の堅牢化とキャンセル**
- [x]✅ `src/services/claudeService.ts`: `generateSuggestions` / `analyzeMap` / `suggestConnections` / `suggestClusters` の `max_tokens` を `2048` に引き上げ
- [x]✅ `generateSuggestions(req, signal?: AbortSignal)` に signal を追加（`client.messages.create({...}, { signal })`）
- [x]✅ `src/components/panels/AISuggestionPanel.tsx`: 生成中（`isAILoading`）はローディング表示の横に「キャンセル」ボタンを表示。abort 時はローディング解除のみ（エラー表示しない。`e.name === 'AbortError'` または `Anthropic.APIUserAbortError` を判定）

**E. 提案追加後のフォーカス移動**
- [x]✅ `src/components/panels/AISuggestionPanel.tsx`: `useReactFlow()` の `fitView` を使い、`handleAddSelected` 完了後に `fitView({ nodes: [{ id: 選択ノードid }, ...追加ノードidの配列], padding: 0.3, duration: 500 })` を実行（追加先が兄弟モードの場合は親ノード id を含める）

**ドキュメント更新**
- [x]✅ `docs/design.md` の「AIサービス設計」（chatWithMap の system 化・ストリーミング・toFriendlyAIError）を更新
- [x]✅ `docs/requirements.md` のAI機能要件（ストリーミング・キャンセル・エラー表示）を追記

**完了条件**: APIキー未設定でも迷わず設定に辿り着ける。チャットが逐次表示され停止できる。提案10件でも解析エラーにならず、追加後に追加先へ視点が移動する

---

### Phase 24: 全般UX・品質改善（約2日）✅ 完了（2026-06-20）

**目標**: 個別機能に属さない横断的な体験品質を引き上げる（追加提案分）

**背景（現状の課題）**:
- ダークモード対応が Header・一部パネルのみで、Toolbar / NodeActionBar / キャンバス背景・MiniMap / 整列ドロップダウン等がライト配色固定（ダークテーマにすると混在して見える）
- ノード数が増えると画面外ノードも全て DOM 描画される
- ウェルカムモーダルにキーボード操作の案内がない（既に Phase 22 G で対応済みと確認）

#### タスク

**A. ダークモードの網羅**
- [x]✅ `src/components/toolbar/Toolbar.tsx`: コンテナ（`bg-white border-gray-200`）とすべてのボタン・ドロップダウンに `dark:` クラスを追加。BottomNav も同様に対応（`dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400` 等、Header・既存パネルの配色基準に統一）
- [x]✅ `src/components/toolbar/BottomNav.tsx`: `<nav>` に `dark:bg-gray-800 dark:border-gray-700` を追加。各ボタンに `dark:text-gray-400` を追加（追加ボタンの `text-primary-600` はそのまま維持）
- [x]✅ `src/components/canvas/IdeaCanvas.tsx`:
  - `useSettingsStore((s) => s.theme)` を参照し、`<Background color={theme === 'dark' ? '#374151' : '#e5e7eb'} ...>` に変更（既存 `snapToGrid` と同じ store から取得）
  - `<ReactFlow colorMode={theme}>` を追加。Controls / MiniMap / 組み込みUIをダーク化
  - `Controls` / `MiniMap` の `className` を三項演算子で切り替え（`!border-gray-700 !bg-gray-800` vs `!border-gray-200`）
  - `NodeActionBar` のコンテナ・ボタンに dark クラス追加（`dark:bg-gray-800 dark:border-gray-700` 等）
  - エンプティ状態のテキストに `dark:text-gray-500` / `dark:text-gray-600` を追加
- [x]✅ `src/components/common/WelcomeModal.tsx`: モーダルカード `dark:bg-gray-800`、非アクティブインジケーター `dark:bg-gray-700`、タイトル `dark:text-gray-100`、説明 `dark:text-gray-400`、スキップボタン `dark:text-gray-500 dark:hover:text-gray-300` を追加
- [x]✅ ContextMenu.tsx / ConfirmDialog.tsx / SearchBar.tsx / Toast.tsx / Header.tsx は既にダーク対応済みのため変更なし

**B. 大規模マップのパフォーマンス（エクスポート干渉対策付き）**
- [x]✅ `src/stores/uiStore.ts`: `renderAllNodes: boolean`（初期値 `false`）と `setRenderAllNodes: (v: boolean) => void` を追加（インターフェースと実装の両方）
- [x]✅ `src/components/canvas/IdeaCanvas.tsx`: `uiStore` から `renderAllNodes` を購読し、`<ReactFlow onlyRenderVisibleElements={!renderAllNodes}>` を追加（通常は全要素を可視判定でスキップ＝最適化ON）
- [x]✅ `src/components/panels/ExportImportPanel.tsx`: `handleImageExport` を変更。撮影前に `setRenderAllNodes(true)` + 2フレーム分の `requestAnimationFrame` 待機 → `exportMapAsImage` 実行 → `finally` で `setRenderAllNodes(false)`。画面外ノードの欠落を防ぐ旨のコメントあり

**C. ウェルカム・ヘルプ導線（コード確認のみ・変更なし）**
- [x]✅ 実コード確認の結果、`WelcomeModal.tsx` のヘルプ誘導文（「❓ ボタン（または Ctrl + /）でいつでも操作ガイドを確認できます」）は Phase 22 G で対応済み。`KeyboardShortcutsModal.tsx` の Ctrl+S / Enter / F2 / 矢印キーも Phase 22 で対応済みのため、新規変更なし

**ドキュメント更新**
- [x]✅ `docs/design.md`（「14. テーマ設計」に Phase 24 対応内容追記、「4.2 uiStore」に `renderAllNodes` 追加、「16. 大規模マップのパフォーマンス」セクション新設）
- [x]✅ `docs/requirements.md`（「3.2 パフォーマンス」に大規模マップ対応追記、「3.2.1 ダークモード」セクション新設）
- [x]✅ `docs/implementation-plan.md`（Phase 24 を ✅ 完了（2026-06-20）に更新）

**完了条件**: ダークテーマで配色の混在がなくなる。100ノード規模でも操作が滑らか

---

### Phase 19〜24 の実装順について

各フェーズは独立して実装可能（依存は Phase 19-A のトースト基盤 → 19-B のみ）。推奨順序は効果の大きい順に **20（ファイル）→ 22（編集）→ 19（認証）→ 23（AI）→ 21（レイアウト）→ 24（全般）**。ただし Phase 21-A（FloatingEdge のラベル・双方向矢印の不具合修正）だけは独立した小修正なので最初に着手してよい。

---

### Phase 25: スマホ表示・レイアウトの最適化（約2日）🔨 実装済み（実機確認待ち）

**目標**: スマホでどのパネル・メニューも画面内に収まり、はみ出し・見切れ・横スクロールが起きない。

**背景（現状の課題）**:
- 右サイドパネルが固定幅でキャンバスを圧迫してはみ出す: `AIChatPanel` = `w-96`(384px)、`PresentationMode` = `w-[480px]`、`MapAnalysisPanel` = `max-w-md` 右固定
- `ContextMenu` の縦位置が `window.innerHeight - 360` の固定計算で小型端末で見切れる
- `Header` のボタンが横一列に詰まる／マップタイトル入力が `max-w-48` で狭い
- iOS のノッチ・ホームインジケーター（セーフエリア）未対応
- `BottomNav` の「追加」が `Math.random()*200` でランダム配置され重なりやすい

> **方針**: PC の挙動（右クリック・ハンドルドラッグ・ショートカット）を一切壊さず、スマホ用の経路を**追加**する。判定は Tailwind `sm:`(640px) ブレークポイントを基本とし、JS 判定が要る箇所のみ `window.innerWidth < 640` を使う。既存で下部シート化済みの `NodeDetailPanel` / `AISuggestionPanel`（`items-end sm:items-center`）をレスポンシブのパターン基準とする。

#### A. 右サイドパネル／オーバーレイのレスポンシブ化
- [x]✅ `src/components/panels/AIChatPanel.tsx`: ルートを `w-96` → `w-full sm:w-96`（モバイル全幅、PC 384px）。背景マスク（`inset-0 bg-black/30`）は **`sm:hidden`（モバイル限定）** で敷き、パネル外タップで閉じる。PC はマスクなしでキャンバスと共存（設計判断）
- [x]✅ `src/components/panels/MapAnalysisPanel.tsx`: パネル本体 `max-w-md` → `w-full sm:max-w-md`（既に `inset-0` マスクあり。モバイル全幅化のみ）
- [x]✅ `src/components/screens/PresentationMode.tsx`: スライドパネル `w-[480px]` → モバイルは下部シート（`w-full max-h-[55vh]`・`justify-end` で下端固定・`mb-14` でナビバー回避）／`sm:` で従来の右 480px。下部ナビバー（前へ/次へ/終了）は流用
- [x]✅ `src/components/panels/NodePanel.tsx`: 現状 `hidden sm:flex w-60`。モバイルは `NodeActionBar`（Phase 26 で拡張）が代替するため非表示のまま（変更なし・確認済み）

#### B. ヘッダー・ボトムナビの最適化
- [x]✅ `src/components/common/Header.tsx`: マップタイトル入力を `max-w-32 sm:max-w-48` に。右側ボタン群は既存の `sm:` 出し分けで詰まらないことを確認
- [x]✅ `src/components/toolbar/BottomNav.tsx`: `handleAddNode` のランダム配置を撤廃し、`screenToFlowPosition` で画面中央 → `findFreePosition` を通して追加。追加後は `setSelectedNodeId` + `setEditingNodeId` で即編集開始（Toolbar.handleAddNode と同じパターン）
- [x]✅ `BottomNav` に **Undo / Redo / 検索** ボタンを追加（計9ボタン）。`overflow-x-auto justify-start gap-1` + 各ボタン `flex-shrink-0` で横スクロール対応。Undo/Redo は `mapStore.undo/redo`（`past`/`future` 長で `disabled`）、検索は `uiStore.setSearchOpen(true)`
- [x]✅ `src/components/toolbar/Toolbar.tsx`: ドロップダウンは `bottom-full` 上方向開きで画面外に出ないことを確認（変更なし）

#### C. コンテキストメニュー／ポップアップの位置補正
- [x]✅ `src/components/canvas/ContextMenu.tsx`: 縦位置 `window.innerHeight - 360` の固定値を撤廃し、`useRef` + `useLayoutEffect` でメニュー実寸を測って画面内にクランプする
- [x]✅ モバイル（`< 640px`）では中央でなく**画面下部のシート**として表示する分岐を追加（横幅 100%・タップ領域 `py-3`）。Phase 26-B のロングプレス起動と組み合わせる
- [x]✅ `NodeActionBar`（`IdeaCanvas.tsx` 内）の `left` を半幅でクランプし画面端で見切れないようにした（Phase 31 で推定値120px → `useLayoutEffect` による実寸計測に変更）

#### D. セーフエリア・ビューポート対応
- [x]✅ `index.html`: viewport meta に `viewport-fit=cover` を追加
- [x]✅ `BottomNav` と `Toast` の下端に `pb-[env(safe-area-inset-bottom)]` を適用（iOS ホームインジケーターとの被り回避）。`Header` 上端のノッチ対応・`100dvh` は現状維持で実機判断とする
- [x]✅ アドレスバー伸縮の 100vh ズレは現状 `height:100%` のため影響限定的と判断し現状維持（実機確認で再判断）

#### ドキュメント更新（必須）
- [x]✅ `docs/design.md`: 「17. レスポンシブ／モバイル設計（Phase 25）」節を新設（`sm:` 基準・下部シートパターン・セーフエリア規約・パネル幅方針）
- [x]✅ `docs/requirements.md`: 「4.4.1 スマホ表示・レイアウト要件（Phase 25）」を追記

#### 動作確認（Phase 31・Playwright + Chromium タッチエミュレーション 375×667・2026-08-05）

- [x]✅ 1. `AIChatPanel` が全幅表示（375×667）
- [x]✅ 2. **修正して達成**: スマホ用マスク（`sm:hidden bg-black/30`）はパネル本体（`w-full h-full`）に完全に覆われて到達できなかった。`AIChatPanel` を `h-[85%]` の下部シートに変更し、上部15%（y=40 付近）でマスクに到達・タップで閉じられることを確認
- [x]✅ 3. `PresentationMode` がスマホで下部シート（375×238px・55vh=367px 以内・下端 611px でナビバーを回避）
- [x]✅ 4. コンテキストメニューが下部シート（幅375・下端667・`rounded-t-2xl`）
- [x]✅ 5. メニュー項目のタップ領域は最小 44px（`py-3`）
- [x]✅ 6. BottomNav「追加」で画面中央に既存ノードと重ならないノードが作られ、即編集モードになる
- [x]✅ 7. BottomNav の10ボタン（追加/元に戻す/やり直し/検索/**発表**/拡大/全体/縮小/設定/ヘルプ）に横スクロールで到達できる
- [x]✅ 8. `BottomNav`・`Toast` に `pb-[env(safe-area-inset-bottom)]`、viewport meta に `viewport-fit=cover` がある（実際の余白量は実機のみ判定可）
- [x]✅ 9. Toast は `bottom: 80px` で BottomNav（上端600px）に被らない
- [x]✅ 10. **修正して達成**: `NodeActionBar` のクランプが推定半幅120pxのままだと実幅320px（半幅160px）に足りず右端が32pxはみ出していた。実寸計測に変更して左右端どちらのノードでも画面内に収まることを確認
- [ ] 11. ダブルタップでのノード作成: エミュレータでは2連続タップから `dblclick` が合成されず作成されない。代替（BottomNav「追加」・pane 長押しメニュー）があるため実用上は塞がれない → 実機確認が必要
- [x]✅ 12（追加）. **修正して達成**: キャンバス列・React Flow・body がいずれも 375px に収まる（BottomNav のみ内部スクロール 491px）。修正前はキャンバス列が 452px に広がり右端が見切れていた

#### 実装上の判明事項（Phase 31 の検証で判明）

- **`ContextMenu` の実寸クランプが効いていなかった**: `useEffect([contextMenu])` の `setClampedPos(null)` が `useLayoutEffect` の計測結果を毎回打ち消し、推定値（高さ200px固定）のまま描画されていた。PC 1440×900 でノードメニュー（実高334px）を画面下部で開くと下端が126pxはみ出し、「ノードを削除」等に到達できない状態だった。リセットを削除し、カテゴリ サブメニュー展開時も測り直すよう `showCategories` を依存に追加して解消（Phase 25-C の完了条件を満たすための修正）。
- **`NodeActionBar` の `BAR_HALF_WIDTH` 定数（120px）は実幅と乖離していた**: 実際のバーは320px（半幅160px）。定数クランプでは 375px 幅で右端がはみ出すため、`useLayoutEffect` で実寸を測って使う方式に変更した。
- **キャンバス列そのものがビューポートより広がっていた**: `IdeaCanvas` のルート列に `min-w-0` が無く、横スクロールする `BottomNav` の min-content 幅（9ボタンで約413px・10ボタンで491px）がフレックスアイテムの自動最小幅になっていた。375px の端末でキャンバスが 452px に広がり右端のノードがタップできない状態だったため `min-w-0` を追加した。**Phase 25 の完了条件「はみ出し・見切れが発生しない」を最も根本的に破っていた不具合**で、BottomNav にボタンを1つ足した時点で顕在化した。

**完了条件**: iPhone SE 幅（375px）で全パネル・メニューが画面内に収まり、横スクロール・見切れが発生しない。BottomNav から追加（中央・非重複）・Undo/Redo・検索ができる。→ エミュレーション上は達成（項目11のみ実機確認待ち）

---

### Phase 26: スマホ タッチ操作の充実（約3日）🔨 実装済み（実機確認待ち）

**目標**: 指だけでノードの作成・接続・編集・整理・AI 拡張がすべて完結する。

**背景（現状の課題）**:
- **エッジが引けない**: 接続ハンドルは 11px・`opacity:0` でホバー時のみ表示（`index.css`）。タッチにはホバーがなく事実上接続不能
- **右クリックメニューがタッチで開けない**: 削除・コピー・カテゴリ変更・整列・グループ化など主要操作が `ContextMenu.tsx` に集約されているが、起動は `onContextMenu`（右クリック）のみ
- **キーボード依存**: Undo/Redo・検索・Tab/Enter/矢印・削除などにスマホ向けの代替 UI がない

> **採用方針（2026-06-27 ユーザー合意）**: エッジ作成は**接続モード方式**（ノード選択→「接続」ボタン→相手ノードをタップ）、メニューは**ロングプレスでコンテキストメニュー**を開く（AI 拡張は選択時の `NodeActionBar` に残す）。いずれも PC の既存経路（ハンドルドラッグ・右クリック）に対する**追加**であり、PC 挙動は変更しない。

#### A. 接続モード方式のエッジ作成（最優先）
- [x]✅ `src/stores/uiStore.ts`: `connectingFromNodeId: string | null` と `setConnectingFromNodeId(id)` を追加（`isPresentationMode` 等と同じ追加パターン）
- [x]✅ `src/stores/mapStore.ts`: 既存 `onConnect` / `makeEdge` を流用する `connectNodes(source, target)` アクションを追加（ハンドルは `ConnectionMode.Loose` のため未指定で可。`past` への push を忘れない）
- [x]✅ `IdeaCanvas.tsx` の `NodeActionBar`: 「🔗 接続」ボタンを追加。タップで `setConnectingFromNodeId(selectedNodeId)`
- [x]✅ 接続モード中の UI:
  - 画面上部に固定バナー「接続先のノードをタップ」＋「キャンセル」を表示（`createPortal`）
  - `handleNodeClick` を拡張: `connectingFromNodeId` があり別ノードをタップしたら `connectNodes` で確定し null に。同ノード／空白タップでキャンセル
  - 接続中は対象候補ノードをハイライトする視覚フィードバック
- [x]✅ PC のハンドルドラッグ接続は現状維持

#### B. ロングプレスでコンテキストメニュー
- [x]✅ `src/components/canvas/IdeaNode.tsx`: `handleTouchStart` のロングプレス（500ms）動作を「AI パネルを開く」から「コンテキストメニューを開く」に変更。`touch.clientX/clientY` を取得して `openContextMenu({ type: 'node', x, y, targetId: id })` を呼ぶ（AI 拡張は `NodeActionBar` に残るため失われない）
- [x]✅ `src/components/canvas/IdeaCanvas.tsx`: キャンバス（pane）にもロングプレス用 `onTouchStart/End/Move` を追加し、空白長押しで `type: 'pane'` メニュー（アイデアを作成・貼り付け）を開く
- [x]✅ ロングプレス発火時に `navigator.vibrate?.(10)` で触覚フィードバック（対応端末のみ・任意）
- [x]✅ スクロール／ドラッグ開始でタイマーをキャンセル（既存 `onTouchMove={handleTouchEnd}` を踏襲）
- [x]✅ メニュー本体は Phase 25-C の下部シート表示と連携

#### C. キーボード依存操作のタッチ代替（仕上げ）
- [x]✅ コンテキストメニュー経由で到達できる操作（削除・コピー・貼り付け・名前変更・接続作成・整列・グループ化）を棚卸しし、ロングプレスメニューから**すべて**到達できることを確認（「🔗 接続を作成」を `ContextMenu.tsx` の node メニューに追加）
- [x]✅ 発表モード（`PresentationMode.tsx`）の前へ/次へ/終了がタッチで操作できることを確認（Phase 15 実装済みの下部ナビバー）。スワイプ送りは任意
- [x]✅ `src/components/common/KeyboardShortcutsModal.tsx` の操作ガイドに「スマホでの代替操作」を追記

#### D. ノードドラッグ／パン競合の調整
- [x]✅ コードのデフォルトは現状維持（`selectionOnDrag` 未設定・タッチ一本指ドラッグはパン）。実機チューニングはユーザーが行う前提

#### ドキュメント更新（必須）
- [x]✅ `docs/design.md`: 「状態管理設計」に `uiStore.connectingFromNodeId`・`mapStore.connectNodes` を追記。「コンテキストメニュー設計」にロングプレス起動を追記（17.8節を新設）
- [x]✅ `docs/requirements.md`: スマホ操作要件（接続モード・ロングプレスメニュー・タッチ代替）を追記（4.4.2節を追加）

#### 動作確認（Phase 31・Playwright + Chromium タッチエミュレーション 375×667・2026-08-05）

**接続モード（A）とメニュー内容は自動確認で達成。長押しジェスチャ自体（B）はエミュレータで再現できないため実機確認が必須。**

- [ ] 1. ノード長押し（500ms）でメニューが開く → **エミュレータでは判定不可**（下記「長押しの実態」参照）。長押し相当の `contextmenu` を送ればノードメニュー10項目が下部シートで開くことは確認済み
- [ ] 2. キャンバス空白の長押しで pane メニュー → 同上。`contextmenu` 経由では「アイデアを作成／グループを作成／ここに貼り付け」が下部シートで開くことを確認済み
- [ ] 3. 長押し中のドラッグでキャンセル → 1 が再現できないため検証不可・実機確認が必要
- [x]✅ 4. `NodeActionBar`「🔗 接続」で全幅バナー＋キャンセルボタンが表示され、ActionBar は非表示になる
- [x]✅ 5. 接続モード中に別ノードをタップ → エッジ1本追加＋「接続しました」トースト
- [x]✅ 6. 接続モード中に同ノードをタップ → エッジを増やさずモード解除
- [x]✅ 7. 接続モード中に空白タップ → モード解除
- [x]✅ 8. 接続元ノードに `outline: rgb(99,102,241) solid 2px`
- [x]✅ 9. **【最優先】接続モード中は `contextmenu` 経路でもメニューが開かない**（接続先・接続元どちらでも。接続モードも維持される）＝ Phase 30 で入れた `IdeaCanvas.handleNodeContextMenu` のガードが効いている
- [ ] 10. ピンチズーム → 実機確認が必要（エミュレータのマルチタッチ認識は実機と異なる）
- [ ] 11. 一本指ドラッグでのパン → 実機確認が必要
- [ ] 12. ノードドラッグとパンの競合 → 実機確認が必要
- [x]✅ C. 発表モードの「前へ／次へ／終了」がタップで動作（1/2 →次へ→ 2/2 →前へ→ 1/2 →終了で復帰）
- [x]✅ D（追加）. BottomNav「発表」→ 発表順序パネル →「発表開始」でスマホからも発表モードに入れる

#### 実装上の判明事項（Phase 31 の検証で判明）

- **長押しの実態**: Chromium のタッチエミュレーション（CDP `Input.dispatchTouchEvent`）では長押しで `contextmenu` が合成されず、`IdeaNode.handleTouchStart` / `IdeaCanvas.handlePaneTouchStart` の React `onTouchStart` も React Flow の d3-drag が `stopImmediatePropagation` するため呼ばれない。**つまり 500ms タイマー実装は実質使われず、実機でメニューを開いているのはブラウザ由来の `contextmenu` イベント**（Phase 30 の判明事項と一致）。エミュレータで検証できるのは「`contextmenu` が来たときの挙動」までで、長押しが `contextmenu` を発火するかは端末・ブラウザ依存のため実機確認が必要。
- **メニューを開いたまま指を離せるかは未解決**: `ContextMenu` のオーバーレイは `onClick` で無条件に閉じるため、実機が長押し直後の `touchend` から click を合成する場合はメニューが即閉じる。エミュレータでは長押し自体が再現できず判定できなかった → 実機確認が必要（再現したら「表示直後の click を無視する」対策を入れる）。
- **スマホから発表モードに入る導線がなかった（Phase 31 で追加）**: `Toolbar` は `hidden sm:flex`、`BottomNav` に発表ボタンなし、コンテキストメニューにも開始項目がなく、スマホ単体では発表を開始できなかった（`Ctrl+P` のみ）。`BottomNav` に「発表」ボタン（`setPresentationOrderOpen(true)`・件数バッジ付き）を追加して解消。PC の Toolbar と違いリストが空でも `disabled` にせず、パネルの空状態で追加方法を案内する。

**完了条件**: スマホで ①ノードを選んで「接続」→相手タップでエッジが引ける ②ロングプレスで全操作メニューが開く ③Undo/Redo・検索・追加・編集・AI 拡張が指だけで完結する。PC の右クリック・ハンドルドラッグ・ショートカットは従来どおり動作する。→ ①③とメニュー内容は達成、②の長押しジェスチャは実機確認待ち

---

> **Phase 27〜31 について**: Phase 1〜26 完了時点で実施したコードレビュー（セキュリティ・リファクタリング・パフォーマンス・UX の4観点 + 相互検証 + Web調査）の結果に基づく品質改善フェーズ群。詳細な根拠と検証済みの指摘は [docs/review/](review/) 配下（`findings-summary.md` が統合版）を参照。一次レビューの誤り（行数の過大申告、react-markdown 使用の誤認、IndexedDB 移行案の無効性など）は検証で訂正済み。

### Phase 27: セキュリティ & 確定バグ修正（約2日） 🔨 実装済み（確認中）

**目標**: レビューで確定したセキュリティ課題と明確なバグを優先的に解消する。

> **設計判断**: 一次レビューの「IndexedDB の `extractable:false` 鍵へ移行」案は、Web検証により無効と判明（XSS が成立すれば鍵素材なしで復号に使われるため localStorage と同等リスク）。代わりに **APIキーをマスターパスワード方式（起動時1回入力・既存の同期パスワードと統合）** に変更する。Claude API のブラウザ直接呼び出し（BYOK）は Anthropic 公式が許容するパターンのため維持し、被害上限の案内で緩和する。

#### A. APIキー保管のマスターパスワード方式（同期パスワードと統合）
- [x] `utils/encryption.ts` のハードコードパスフレーズ `'ideamap-v1'`（`deriveKey`）を廃止（移行専用の `decryptLegacyApiKey` として隔離）
- [x] APIキーをユーザー設定のマスターパスワードで暗号化して localStorage に保存（新キー `ideamap-apikey-mp`、JSON `{ v: 2, encrypted, salt }`）
- [x] アプリ起動時、暗号化済みキーがある場合のみマスターパスワード入力プロンプトを表示し、復号して `settingsStore.apiKey`（メモリ）に展開（`initApiKey()`）
- [x] マスターパスワードと既存の `syncPassword`（Drive同期）を1つのパスワードに統合（`setMasterPassword()` が置換）
- [x] 後方互換: 旧方式（ハードコード鍵）で保存済みのキーは初回起動時に検出し、自動移行 + マスターパスワード設定を促す
- [x] `docs/design.md` / `docs/requirements.md` のAPIキー暗号化方式の記述を更新

#### B. Markdown 描画のサニタイズ強化
- [x] `DOMPurify` を導入し、`utils/markdown.ts` の `renderMarkdownSimple()` 出力をホワイトリスト sanitize（`ALLOWED_TAGS: ['h1','h2','h3','strong','em','code','li','br']`、`ALLOWED_ATTR: ['class']`）
- [x] 4箇所（`IdeaNode.tsx` / `PresentationMode.tsx` / `NodeDetailPanel.tsx` / `NodePanel.tsx`）の `dangerouslySetInnerHTML` 経路が sanitize 済み出力を使うことを確認（変更不要）
- ※ react-markdown への移行は過剰（Tailwind クラス互換問題 + バンドル増）と検証で結論済み。DOMPurify 単体（gzip +約7-10KB）を採用

#### C. 確定バグ・依存更新
- [x] `uiStore.ts` `setSearchOpen` のバグ修正（`open ? {} : { searchQuery: '' }` に修正）
- [x] `vite` を 8.0.16+ に更新（8.1.0 に更新済み、CVE-2026-53571 解消）
- [x] APIキー入力欄（`SettingsPanel`）に「Anthropic Console で利用上限を設定」「このアプリ専用のキーを推奨」の注意書きを追加

**完了条件**: APIキーがマスターパスワードで実効的に暗号化され、起動時1回の入力で利用できる。Markdown が DOMPurify でサニタイズされる。検索バーのバグと vite 脆弱性が解消される。

---

### Phase 28: パフォーマンス最適化（約2日）✅ 完了（2026-08-05）

**目標**: 初回ロード時間と、ノード数増加時の再レンダリング負荷を軽減する。

> 根拠: `docs/review/performance.md` / `validation-tech.md`。着手時の実測は 845.81kB 単一チャンク（gzip 247.86kB）。

#### タスク
- [x]✅ `vite.config.ts` にベンダー分割を追加（react-vendor / flow / ai）
- [x]✅ `IdeaNode.tsx` の2つの `nodes.find()` セレクタを1つに統合し `useShallow` を適用。`NodeActionBar` の二重 `find()` も絶対座標を返す1セレクタに統合
- [x]✅ `IdeaCanvas.tsx` の `displayNodes` / `displayEdges` を廃止し、dim/ハイライト状態を `FocusStateContext`（`src/hooks/useNodeFocus.ts`）で配って各ノード・エッジが自己判定する設計に変更
- [x]✅ パネル群 / `Toolbar` / `Header` / `BottomNav` / `SearchBar` / `PresentationMode` のストア全体購読を、必要プロパティのみのセレクタ（`useShallow`）に変更。描画に使わない `nodes` / `edges` はハンドラ内の `useMapStore.getState()` に置換
- [x]✅ `html-to-image` / `@dagrejs/dagre` を動的 import に変更し、エクスポート・整列実行時に遅延ロード

#### 実装上の判明事項（計画からの変更点）

- **`manualChunks` は使えない**: Vite 8 は rolldown ベースになり `build.rollupOptions` / `manualChunks` のオブジェクト形式が非対応（deprecated）。`build.rolldownOptions.output.codeSplitting.groups` を使用した。
- **`@anthropic-ai/sdk` の `tools/` 配下はチャンクに含めてはいけない**: `tools/agent-toolset/` は `node:util` の `promisify` 等をトップレベルで呼ぶ。通常は遅延チャンクに分離されブラウザで評価されないが、`ai` グループに取り込むと起動時に評価されて `(0, X.promisify) is not a function` で**アプリが起動しなくなる**（実際に発生し、`test` 関数で `sdk/tools/` を除外して解消）。
- **フォーカス状態の Context 値をドラッグ中に変えない工夫が必要**: グループの親子関係を `nodes` から取ると毎フレーム再計算されるため、`useShallow` で比較できる文字列配列として購読している。

#### 計測結果

| | 初回ロードで読む JS | gzip |
|---|---|---|
| Phase 27 時点 | 861.68 kB（単一チャンク + node 遅延分） | 254.03 kB |
| Phase 28 後 | 801.65 kB（index / react-vendor / flow / ai の4チャンク） | 231.63 kB |

`dagre.esm` 39.43 kB・`html-to-image` 12.51 kB は整列・エクスポート実行時まで読み込まれない。Vite の 500kB 超過警告も解消。

#### 動作確認（Playwright + preview ビルド）

- [x]✅ アプリ起動・新規マップ作成・ノード追加（コンソールエラーなし）
- [x]✅ フォーカスモード: 選択ノードと隣接ノードが opacity 1、その他が 0.15、接続エッジが opacity 1。選択解除で全ノード 1 に復帰
- [x]✅ 発表モード: カレントノードが opacity 1、その他が 0.1
- [x]✅ 接続モード: 接続元ノードに `rgb(99,102,241)` 2px のアウトライン、接続先タップでエッジ作成
- [x]✅ 整列（dagre 左→右）: 遅延ロード後にレイアウト適用
- [x]✅ PNG エクスポート: html-to-image の遅延ロード後にダウンロード成功

**完了条件**: バンドルが複数チャンクに分割され初回ロードが軽くなる。ドラッグ・ノード選択時の不要な全再描画が減る。→ 達成

---

### Phase 29: リファクタリング & 技術的負債返済（約2日）✅ 完了（2026-08-05）

**目標**: 動作を変えずに保守性を上げる。検証で「肥大化」は `mapStore.ts`（1032行）のみと確定したため対象を限定する。

> 根拠: `docs/review/refactoring.md` / `validation-tech.md`。`claudeService.ts`(400行)・`AIChatPanel.tsx`(460行) は通常サイズのため分割対象外。

#### タスク
- [x]✅ Claude Sonnet 5 へのモデル更新（`AIModel` 型・既定値・設定UI・保存済み設定の読み替え）
- [x]✅ `claudeService.ts` の `new Anthropic()` 5重複を `createClient(apiKey)` ヘルパーに集約
- [x]✅ `mapStore.ts` のグループジオメトリ4関数（`computePushOut` / `findOverlappingGroup` / `isOutsideParent` / `syncGroupMeasured`）を `utils/groupGeometry.ts` へ抽出し、`applyGroupPushOut` との重複を解消
- [x]✅ `mapStore.ts` を軽量スライス分割（履歴 / ノード / エッジ / グループ操作 / ドキュメント）。全面再構成はせず責務ごとのファイル分割に留める
- [x]✅ 小規模DRY: APIキー未設定の空状態を `ApiKeyRequired` コンポーネントに共通化（3パネル）、`expandGroupIds` ヘルパーで重複解消、後方互換処理を `utils/mapFileCompat.ts` に集約
- [x]✅ `uiStore.ts` のフェーズコメントを意味ベースの記述に整理（CLAUDE.md コメント方針）

#### Sonnet 5 移行の内訳

| 変更点 | 内容 |
|---|---|
| モデルID | `claude-sonnet-4-6` → `claude-sonnet-5`（`AIModel` 型・`SettingsPanel` の選択肢・`DEFAULT_AI_MODEL`） |
| 保存済み設定 | `persist` に `version: 1` + `migrate` を追加。localStorage と Drive の旧IDを `normalizeAiModel` で現行IDへ読み替え、未知の値も既定モデルへ倒す |
| `thinking` | 全リクエストに `thinking: { type: 'disabled' }` を明示。Sonnet 5 は省略時に adaptive thinking が既定で有効になり、`max_tokens` 2048〜4096 の枠を思考トークンに取られてJSONが途中で切れるため |

> **移行対象外だった破壊的変更**: Sonnet 5 では `budget_tokens`・`temperature`/`top_p`/`top_k`・assistant プレフィルが 400 になるが、本アプリはいずれも未使用のためコード変更不要だった。

#### 検証結果

- `npm run build`（tsc + vite）通過。lint の指摘件数は変更前と同一（既存の 14 errors / 3 warnings のみ、新規増加なし）
- Playwright スモークテスト（preview ビルド）: 新規作成 → ノード追加（2件）→ 右クリック「アイデアを作成（接続）」でエッジ生成 → 元に戻す（エッジ消滅）→ やり直し（エッジ復活）。コンソールエラーなし

#### 動作確認（手動・2026-08-05 実施）

- [x]✅ AI提案・マップ分析・つながり提案・クラスタ提案・AIチャットが Sonnet 5 で正常に応答する（JSONの途中切れがないこと）
- [x]✅ Claude Haiku 4.5 を選択した場合も同5機能が正常に応答する（`thinking: disabled` が受理されること）
- [x]✅ Phase 29 以前から使っているブラウザで、設定の使用モデルが自動的に「Claude Sonnet 5」になっている
- [x]✅ グループ操作: ドラッグでのグループ出入りダイアログ、枠外への押し出し、整列後の押し出し
- [x]✅ Undo/Redo がノード・エッジ・グループ操作すべてで従来どおり動く
- [x]✅ マップの保存・読み込み（旧フォーマットのファイルを含む）

**完了条件**: mapStore のジオメトリ計算が分離・テスト可能になり、Anthropic クライアント生成と空状態UIが一元化される。既存の動作は不変。→ 達成

---

### Phase 30: UX 改善バッチ（約2日）✅ 完了（2026-08-05）

**目標**: 日常操作の摩擦と一貫性の欠如を解消する。

> 根拠: `docs/review/ux.md` / `validation-ux.md`。UX高-7（selectedNodeId 残存）は検証で誤検知と判明したため除外済み。

#### タスク
- [x]✅ `AISuggestionPanel.tsx` にダークモード対応（`dark:` クラス）を追加（他パネルと統一）
- [x]✅ `NodeDetailPanel.tsx` の Esc / 背景クリックの挙動を統一（「破棄して閉じる」。未コミットの変更があるときだけ3択確認）。IdeaNode インライン編集（Esc=破棄）と整合させる
- [x]✅ `NodeActionBar` の削除に確認を追加（接続線がある場合のみ。右クリックメニューと同じ `ConfirmDialog` パターン）
- [x]✅ AIチャット履歴クリアに確認ダイアログを追加
- [x]✅ 接続モード中のロングプレス二重発火を防ぐガードを `IdeaNode.handleTouchStart` に追加（`connectingFromNodeId` があればタイマーを張らない）＋ `IdeaCanvas.handleNodeContextMenu` にも同じガード（下記「判明事項」参照）
- [x]✅ エッジ／グループのラベル編集の `window.prompt`（`ContextMenu.tsx` 2箇所）を `InputDialog`（`ConfirmDialog` 同型）に置換
- [x]✅ アクセシビリティ: `ConfirmDialog` に `role="dialog"` / `aria-modal`、チャットに `aria-live`、コンテキストメニューに `role="menu"` / `menuitem`、モーダルのフォーカストラップを追加
- [x]✅ グループ削除ダイアログの文言バグ修正（`ContextMenu.tsx`）、操作ガイドに `Ctrl+Shift+C` を追記
- [x]✅ 追加対応: `SettingsPanel` / `MapListPanel` のダークモード対応（レビューは AISuggestionPanel だけを未対応としていたが、実機確認でこの2つも `dark:` クラスが0件と判明。完了条件「全パネルで一貫」を満たすため同時に対応）

#### 実装上の判明事項（計画からの変更点）

- **接続モード中の長押しメニューは `contextmenu` 経路が本命**: React Flow のノードはドラッグ用に d3-drag が `touchstart` を `stopImmediatePropagation()` するため、`IdeaNode` の `onTouchStart` はタッチ環境では発火しない（Chromium のタッチエミュレーションで確認）。実機で長押しメニューが開くのはブラウザが発火する `contextmenu` → `IdeaCanvas.handleNodeContextMenu` 経由。計画どおりのガードに加えて、こちらにも `connectingFromNodeId` ガードを入れて初めて意図した挙動になる。
- **NodeDetailPanel の破棄は blur との競合を先回りする必要がある**: 確認ダイアログへフォーカスが移る際の `blur` で先に保存されてしまうため、①ダイアログを開く**前**に `skipBlurCommit` を立てる、②背景クリックは `onClick` ではなく `onMouseDown` で受ける、の2点が必須だった（最初の実装では「破棄」を選んでも保存されていた）。
- **ConfirmDialog にフォーカストラップを入れると Enter が二重発火する**: 確定ボタンにフォーカスがある状態で `Enter` を押すと、ボタンの click と `window` の keydown ハンドラが両方走る。keydown 側で `target.tagName !== 'BUTTON'` を条件にして解消。
- **モーダルが重なるとフォーカストラップ同士が競合する**: 詳細パネルの上に確認ダイアログが出るケース。DOM 上で最後にある `[role="dialog"]` を最前面とみなし、それ以外のトラップは Tab 処理を降りる方式にした。
- **カテゴリ色を背景に敷く要素はダーク対応しない**: カテゴリ行・カテゴリチップは明るいパステル背景が固定なので、文字色を反転させると読めなくなる。トグルのつまみも暗色トラックとの対比のため白のまま。
- **グループ削除ダイアログは文言修正のみ**: `validation-ux.md` の裁定どおり、2択ボタンを増やさず「子ノードを残したい場合は『グループを解除』を使ってください」と案内する文言に変更した（同じメニュー内に解除項目があるため）。

#### 検証結果

- `npm run build`（tsc + vite）通過。lint の指摘件数は変更前と同一（既存の 14 errors / 3 warnings のみ、新規増加なし）
- Playwright（preview ビルド）で PC 22項目・スマホ6項目・AIチャット6項目を自動確認、コンソールエラーなし

#### 動作確認（Playwright + preview ビルド・2026-08-05）

- [x]✅ ダーク: AISuggestionPanel / SettingsPanel / MapListPanel の背景・文字・入力欄がダーク配色になる（`rgb(31,41,55)`）
- [x]✅ NodeActionBar の🗑（接続線あり）で確認ダイアログが出る。キャンセルでノードが残る
- [x]✅ ConfirmDialog: `role="dialog"` / `aria-labelledby`、初期フォーカス＝確定ボタン、Tab がダイアログ内に留まる
- [x]✅ NodeDetailPanel: タイトル編集中に Esc → 破棄確認が出る →「破棄して閉じる」で元のタイトルのまま
- [x]✅ エッジ「ラベルを編集」→ InputDialog（入力欄に初期フォーカス）→ Enter でラベル反映
- [x]✅ グループ「ラベルを編集」→ InputDialog → 保存でグループ名反映
- [x]✅ グループ削除ダイアログの文言が「選択してください」を含まない新文言になっている
- [x]✅ コンテキストメニューに `role="menu"` / `role="menuitem"`（10項目）
- [x]✅ 操作ガイドに「AIチャットパネルをトグル（Ctrl+Shift+C）」が載っている
- [x]✅ スマホ（420×860・タッチ）: 接続モードのタップでエッジ作成、その後メニューが開かない
- [x]✅ スマホ: 通常時は長押し（contextmenu）でメニューが開く／接続モード中は開かない
- [x]✅ AIチャット: `role="log"` / `aria-live="polite"`、履歴クリアで確認ダイアログ → キャンセルで残る・実行で空状態

**完了条件**: ダークモードが全パネルで一貫し、削除・履歴クリアの誤操作が確認で防がれ、Esc の挙動が統一される。→ 達成

---

### Phase 31: 「実装済み（確認中）」フェーズの動作確認 & 確定（約2日）🔨 自動確認済み（実機確認待ち）

**目標**: Phase 14 / 18 / 25 / 26 を動作確認し、ステータスを確定する。

> 根拠: `docs/review/ux.md` の動作確認チェックリスト（Phase14:15項目・Phase18:9項目・Phase25:11項目・Phase26:12項目）。

#### タスク
- [x]✅ Phase 14（AIチャット）15項目を確認（ストリーミング・停止・@メンション・アクション実行・履歴上限・エラー分岐・50件コンテキスト）
- [x]✅ Phase 18（UX小改善）9項目を確認（title/body 分離・Markdown 整形・発表順序パネル）
- [x]✅ Phase 25（スマホ表示）11項目＋追加1項目のうち11項目を自動確認（残る1項目はダブルタップで実機依存）
- [x]✅ Phase 26（スマホタッチ）接続モード（A）5項目・メニュー内容・発表モード操作を自動確認
- [x]✅ 検証中に見つかった不具合5件を修正（`ContextMenu` の実寸クランプが効かない／`NodeActionBar` の推定半幅不足／チャットパネルのマスク到達不可／スマホの発表開始導線なし／キャンバス列の `min-w-0` 欠落）
- [x]✅ 確認済み項目を `[x]✅` に更新し、Phase 14/18 の見出しを `✅ 完了（2026-08-05）` に更新
- [ ] **残（後回し・2026-08-05 ユーザー判断）: スマホ実機確認**（下記チェックリスト）。**最優先**: 接続モード中ロングプレス二重発火（Phase 30 で対策済み。`contextmenu` 経路でのガードは自動確認で PASS。実機の長押し発火タイミングは端末依存のため要確認）
- [ ] 残（後回し）: ノード長押し → メニューが**開いたまま指を離せるか**。再現するなら `ContextMenu` のオーバーレイ側でメニュー表示直後の click を無視する対策を入れる
- [x]✅ 積み残し2件を対応（AIChatPanel を下部シート化してマスクを機能させる／BottomNav に「発表」ボタンを追加）。対応中にキャンバス列の横幅バグ（`min-w-0` 欠落）も検出して修正

#### 自動確認の方法

`ideamap/dist`（preview ビルド）に対し Playwright（`playwright` は devDependency に導入済み）で PC 1440×900 とスマホ 375×667（`hasTouch` / `isMobile` / iPhone SE 相当）の2構成を実行。Anthropic API は `window.fetch` を差し替えた SSE モックで代替し、逐次表示・中断・429・ネットワークエラーを実挙動で確認した。最終結果は **PC 25項目すべて PASS / スマホ 30項目中 23 PASS・残り7件は実機依存で判定不可**（不具合として検出した5件はすべて修正済み）。コンソールエラーは全ページで0件。

#### 実機確認チェックリスト（ユーザー実施・**後回し**）

> **2026-08-05 判断**: 実機確認は後回しとし、Phase 32 以降を先に進める。
> 影響範囲は「長押しジェスチャ・ピンチ／パン・セーフエリア実効値」に限られ、いずれも**モノレポ移行（Phase 33）で挙動が変わる箇所ではない**。ただし Phase 33 の判定条件「移行前後で挙動が変わっていないこと」について、**スマホ実機の移行前基準は未取得**である点に留意すること（移行後に実機で問題が出た場合、移行が原因かどうかの切り分けができない）。

| # | 確認項目 | 判定基準 |
|---|---|---|
| 1 | 接続モード中にノードを長押しする（**最優先**） | メニューが開かず、指を離した後にも開かない。タップならエッジが作成される |
| 2 | 通常時にノードを長押しする | 500ms 前後でメニューが開き、**指を離してもメニューが残る**（即閉じるなら要対策） |
| 3 | 通常時にキャンバス空白を長押しする | pane メニュー（アイデアを作成／グループを作成／貼り付け）が開く |
| 4 | 長押ししながら指をずらす | メニューが開かない（スクロール／ドラッグが優先される） |
| 5 | キャンバスをピンチする | ズームできる |
| 6 | 一本指でドラッグする | キャンバスがパンする |
| 7 | ノードをドラッグする | ノードが移動する（パンと競合しない。競合するなら操作手順を要検討） |
| 8 | キャンバス空白をダブルタップする | ノードが作られる（作られなくても BottomNav「追加」と長押しメニューで代替可） |
| 9 | ホームインジケーター付き端末で BottomNav / Toast を見る | インジケーターに被らない（`env(safe-area-inset-bottom)` の実効値確認） |
| 10 | アドレスバーを伸縮させる | レイアウトが崩れない・下端が隠れない |

#### Phase 31 で追加対応した3件（2026-08-05）

| # | 内容 | 対応 |
|---|---|---|
| 1 | `AIChatPanel` のスマホ用マスクがパネル本体（`w-full h-full`）に覆われて到達できず、外タップで閉じられなかった | `h-[85%] rounded-t-2xl` の下部シートに変更し、上部15%にマスクを露出（`NodeDetailPanel` / `AISuggestionPanel` と同じ下部シートパターンに統一）。入力欄に `pb-[calc(0.75rem+env(safe-area-inset-bottom))]` を追加。PC は `sm:` 側で従来どおり右384px・全高 |
| 2 | スマホから発表モードを開始する導線がなかった（`Toolbar` は `hidden sm:flex`） | `BottomNav` に「発表」ボタン（10個目・件数バッジ付き）を追加し、発表順序パネルを開く。空リストでも `disabled` にせずパネルの空状態で案内（案内文も「右クリック（スマホは長押し）」に修正） |
| 3 | **上記2の対応中に検出**: `IdeaCanvas` のルート列に `min-w-0` が無く、横スクロールする `BottomNav` の min-content 幅がフレックスアイテムの最小幅になってキャンバス列が 375px → 452px に広がり、右端が見切れて右端のノードがタップできなかった | ルート列に `min-w-0` を追加。ボタン9個の時点でも 413px と超過しており、Phase 25 の完了条件を根本的に破っていた |

**完了条件**: Phase 14/18/25/26 が動作確認済みになり、「実装済み（確認中）」状態が解消される。→ Phase 14/18 は達成。Phase 25/26 は自動確認できた項目をすべて確定し、実機に依存する項目のみ残（上記チェックリスト）。

---

## 1-B. デスクトップアプリ版（Phase 32〜38）

ここから先は **デスクトップアプリ版（Tauri v2）の開発と、Web版とのコア共通化**のフェーズです。

**着手前に必ず [docs/desktop/README.md](desktop/README.md) を読んでください。** フレームワーク選定の根拠・モノレポ構成・Adapter 設計・Ollama 連携の詳細設計はすべて `docs/desktop/` 配下にあり、本節はそのタスク分解のみを扱います。ドキュメント間で結論が食い違う箇所は `docs/desktop/README.md` §3 の裁定が優先されます。

**目的**: ローカルLLM（Ollama）を使えるようにすること。ブラウザからは CORS 制約で `http://localhost:11434` に安定アクセスできないため、Tauri の Rust プロセス経由でアクセスする。

**前提**: Phase 31 の完了。モノレポ移行（Phase 33）は「移行前後で挙動が変わっていないこと」を判定条件にするため、`🔨 実装済み（確認中）` のフェーズが残っていると不具合の切り分けができなくなる。

> 2026-08-05 時点の状況: Phase 31 の自動確認は完了し、Phase 14/18 は確定済み。残りはスマホ実機に依存する項目（長押しジェスチャ・ピンチ／パン・セーフエリア実効値）のみで、いずれも**モノレポ移行で挙動が変わる箇所ではない**ため、Phase 32 の着手は妨げない。**実機確認は後回しとする判断（2026-08-05）**のため、Phase 33 の前後比較はスマホ実機については基準未取得のまま進むことになる（Phase 31 の実機確認チェックリスト冒頭の注記を参照）。

| Phase | 内容 | 目安 | 主参照 |
|---|---|---|---|
| 32 | LLMプロバイダ抽象化（Claude のみ） | 2日 | [llm-abstraction.md](desktop/llm-abstraction.md) |
| 33 | モノレポ移行 | 5日 | [architecture.md](desktop/architecture.md) |
| 34 | Tauri デスクトップ版の骨格 | 5日 | [platform-integration.md](desktop/platform-integration.md) |
| 35 | **Ollama 統合（主目的の達成）** | 4日 | [llm-abstraction.md](desktop/llm-abstraction.md) |
| 36 | ビルド・配布・自動更新 | 3日 | [platform-integration.md](desktop/platform-integration.md) |
| 37 | デスクトップ固有UX | 3日 | [platform-integration.md](desktop/platform-integration.md) |
| 38 | （任意）デスクトップ版 Google Drive 連携 | 3日 | [platform-integration.md](desktop/platform-integration.md) §3.8 |

---

### Phase 32: LLMプロバイダ抽象化（Claude のみ）（約2日）✅ 完了（2026-08-05）

**目標**: 既存 Web 版の挙動を一切変えずに、`claudeService.ts` を `LLMProvider` インタフェースの背後に隠す。Ollama 対応の下地を作る。

> 参照: `docs/desktop/llm-abstraction.md` §2〜3・§7（Step 1-2）。モノレポ移行前なので配置は `ideamap/src/services/llm/`。Phase 33 で `packages/core/src/llm/` へ `git mv` する。

#### タスク
- [x]✅ `src/services/llm/types.ts` に `LLMProvider` / `LLMRequest` / `LLMError`（`kind: 'auth' | 'rateLimit' | 'connection' | 'notFound' | 'parse' | 'aborted' | 'unknown'`）/ `ProviderCapabilities` / `ModelInfo` を定義
- [x]✅ `src/services/llm/jsonUtils.ts` に既存の `sanitizeJsonString` / `safeParseJson` / `AIParseError` を移設
- [x]✅ `src/services/llm/claudeProvider.ts` に `ClaudeProvider` を実装（`complete` / `completeJson` / `stream` / `listModels` / `capabilities`）。`Anthropic.APIError` → `LLMError` の変換をここに閉じ込める
- [x]✅ `claudeService.ts` の5関数（`generateSuggestions` / `analyzeMap` / `suggestConnections` / `suggestClusters` / `chatWithMap`）を、**関数シグネチャを変えずに** `ClaudeProvider` へ委譲するだけの実装に変更
- [x]✅ `toFriendlyAIError` を `LLMError.kind` ベースの実装に置き換え（表示文言は現状と1文字も変えない）
- [x]✅ `analyzeMap` / `suggestConnections` / `suggestClusters` に欠けていた `AbortSignal` 対応を追加（既存の実装漏れの解消）
- [x]✅ `docs/design.md` の「9. Claude API連携設計」を LLMProvider 構成に更新

**完了条件**: `src/components/panels/*.tsx` に差分が無いこと（`git diff` で確認）。`npm run build` が通る。AI提案・チャット・分析・接続提案・クラスタ提案の5機能が変更前と同じ入出力になる。401 / 429 / 529 / ネットワークエラーの4パターンで従来と同一の日本語メッセージが出る。

#### 動作確認（新旧サービスのA/B比較・Playwright + Vite dev・fetch モック・2026-08-05）

旧 `claudeService.ts`（`git show HEAD:` で取得）と新実装を**同一プロセス・同一モックレスポンス**に対して並走させ、①送信リクエストボディ ②UIが参照する値（戻り値・`toFriendlyAIError` の文字列・`instanceof AIParseError`・`rawResponse`・`AISuggestionPanel` のキャンセル判定式）を比較した。検証用ファイルは確認後に削除済み。

- [x]✅ 全23シナリオで**送信リクエストボディが完全一致**（`model` / `max_tokens` / `thinking` / `system` / `messages` すべて）。リトライ回数も一致（429・529・ネットワークは SDK 既定で3回）
- [x]✅ `generateSuggestions`: 正常 / JSONブロックなし / 壊れたJSON / `suggestions` 非配列 の4パターンで戻り値・エラー文言が一致
- [x]✅ `analyzeMap` / `suggestConnections` / `suggestClusters`: 正常・件数不足の早期 `[]`・壊れたJSON（`AIParseError` が `rawResponse` 付きで伝播）が一致
- [x]✅ `chatWithMap`: ストリーミング（SSEモック）で `onText` の累積テキスト列・最終 `content`・`actions` パースが一致。中断時も部分テキスト返却が一致
- [x]✅ **401 / 429 / 529 / ネットワークエラーの4パターンで日本語メッセージが完全一致**（+ 400 のような他ステータスで `e.message` がそのまま出ることも一致）
- [x]✅ 唯一の差分は**中断時の例外オブジェクトそのもの**（旧: `APIUserAbortError`「Request was aborted.」／新: `LLMError(kind='aborted')`「キャンセルされました」）。ただし `AISuggestionPanel` のキャンセル判定式は新旧とも `true` になり**エラー表示に到達しない**ため、ユーザーから見える差分はゼロ
- [x]✅ `git status` で `src/components/panels/*.tsx` に差分なし（変更は `claudeService.ts` と新規 `src/services/llm/` のみ）
- [x]✅ `npm run build` 通過。`npm run lint` は新規3ファイル・`claudeService.ts` とも指摘ゼロ（既存14件のエラーは Phase 31 以前からの別ファイル由来）

#### 積み残し（Phase 35 Step 6 で対応）
- `MapAnalysisPanel` のキャンセルUI追加（サービス層は `signal` 対応済み・UI未接続）。Phase 32 の完了条件が「パネルに差分なし」のため見送った
- `claudeService.ts` の移行用アダプタ（`toLegacySuggestionParseError` / `toLegacyAnalysisParseError`）の削除。エラー表示を `LLMError.kind` ベースへ統一するタイミングで不要になる
- 対応モデル一覧の二重管理解消（`ClaudeProvider.listModels()` と `SettingsPanel.tsx` の `<option>`）

---

### Phase 33: モノレポ移行（約5日）🔨 実装済み（実機確認待ち）

**目標**: 既存 Web 版を壊さずに `packages/core` / `packages/ui` / `packages/platform` / `apps/web` へ分割し、デスクトップ版を追加できる土台を作る。

> 参照: `docs/desktop/architecture.md` §2〜5（移行手順 Step 0〜7）。**各ステップの完了判定条件を満たすまで次に進まないこと。** 「ファイル移動のみ」と「ロジック変更」のコミットを必ず分離する。

#### タスク
- [x] Step 0: `feature/monorepo-migration` ブランチ作成。移行前ベースライン（`npm run build` 通過・`npm run lint` は 14 errors / 3 warnings）を記録
- [x] Step 1: ルートに `pnpm-workspace.yaml` / `package.json` / `tsconfig.base.json` / `tsconfig.json` / `eslint.config.js` を追加（既存 `ideamap/` はまだ動かさない）
- [x] Step 2: `git mv ideamap apps/web`。`package.json` の `name` を `@ideamap/web` に変更。npm → pnpm へ移行し、依存は移行前ロックファイルの版に固定（後述）
- [x] Step 3: `packages/platform` 新設（Adapter インタフェース＋`setPlatform`/`getPlatform` レジストリのみ。未参照）
- [x] Step 4: `apps/web/src/platform/*.web.ts` を既存サービスのラッパーとして作成（**未接続**）
- [x] Step 5-1: `types/index.ts` を `packages/core` へ移動
- [x] Step 5-2a: `mapLayout.ts` / `groupGeometry.ts` / `mapFileCompat.ts` を `packages/core` へ移動
- [x] Step 5-3: `uiStore.ts` を移動し、`saveDriveFileId`/`loadDriveFileId` 直呼びを `getPlatform().storage` 経由に置換
- [x] Step 5-2b: `mapStore.ts` と `stores/map/*` を無改修で `packages/core` へ移動
- [x] Step 5-4: `settingsStore.ts` を移動し、`encryption.ts` 呼び出しを `getPlatform().secret` へ。Drive 同期は `apps/web` からのコールバック注入に変更
- [x] Step 6b: Phase 32 で作った `src/services/llm/` を `packages/core/src/llm/` へ移動し、HTTP 呼び出しを `getPlatform().http` 経由に変更（`claudeService.ts` → `aiService.ts`）
- [x] Step 6a-1: `packages/ui` へコンポーネント・hooks を移動（Google 依存のないものをまとめて）。`useGoogleAuth` と `FileOpenDashboard` / `MapListPanel` は `apps/web` に残す
- [x] Step 6a-2: `exportService` を分割（画像/JSON/Markdown → `packages/ui`、共有URL → `apps/web`）。`useAutoSave` を `FileAdapter` 経由に。クリップボードを `SystemAdapter` 経由に
- [x] Step 7: `App` を `packages/ui` の共通シェルにし、Google 依存を props（`cloudAuth` / `mapListSlot` / `dashboardSlot` / `onGenerateShareUrl`）で受け取る形に整理。`apps/web/src/WebApp.tsx` を新設し、`main.tsx` で `setPlatform(webPlatform)` してからレンダーする
- [x] Step 9: GitHub Actions を pnpm ワークスペース対応に更新（`apps/web/dist` を配信）
- [x] `import/no-restricted-paths` ＋ `no-restricted-imports` ＋ `no-restricted-globals` で依存方向違反を検出できるようにする
- [x] `CLAUDE.md` にモノレポ構成のルールを反映（「移行後に適用」の但し書きを削除）
- [x] `docs/design.md` の「1. アーキテクチャ概要」「3. プロジェクト構成」をモノレポ構成に更新

**完了条件**: `pnpm build` が全パッケージで通る。Web版の全機能（マップ作成・Undo/Redo・保存・Drive同期・AI提案・エクスポート・プレゼンモード）が移行前と同じ動作をする。GitHub Pages へのデプロイが成功する。依存方向違反が ESLint で検出される。

#### 動作確認（移行前ビルドとの A/B スモークテスト・Playwright + preview ビルド・2026-08-06）

移行前コミット（`5ec6ca1`）を git worktree に展開して `npm ci && npm run build` した「移行前ビルド」と、
移行後ビルドに対して**同一の Playwright スクリプト17項目を並走**させ、全項目の結果が一致することを確認した。
Anthropic API はルート傍受でモックしている。検証スクリプトは確認後に削除済み。

- [x] 起動・ファイルダッシュボード表示・新規作成でキャンバスに入る
- [x] 初期ノードの描画、テーマ切替（`<html>` の `dark` クラス）
- [x] ノード選択 + Tab で子ノード追加 → Ctrl+Z で取り消し → Ctrl+Y でやり直し（エッジ本数で判定）
- [x] ノード右クリックのコンテキストメニュー表示
- [x] JSON エクスポート（ダウンロード内容が `MapFile` 形式・`version: '1.0'`）
- [x] Markdown エクスポート（`# 見出し` と `- **タイトル**` のツリー生成）
- [x] 共有URL生成（`map=` を含む URL が入力欄に入る）
- [x] 設定パネルの表示
- [x] APIキー入力 → マスターパスワード設定 → `ideamap-apikey-mp` に v2 形式で保存され**平文を含まない**
- [x] リロード後にロック状態になる／誤ったパスワードを拒否する／正しいパスワードで解錠できる
- [x] AI拡張が Anthropic API を呼び、送信ボディの `x-api-key` / `model` / `max_tokens` / `thinking: disabled` が一致し、提案がUIに反映される
- [x] `currentFileId` がリロードをまたいで復元される
- [x] 全項目で console error / pageerror がゼロ（移行前ビルドも同様）
- [x] `pnpm build` 通過。CSS 出力 46.38 kB・`ai` チャンク 144.40 kB は移行前と一致（CSS 出力はその後 2026-08-07 のカーソル可視化修正で 48.64 kB に増加。掴むカーソルの SVG データURI 2本が増えた分。`ai` チャンクは 144.40 kB のまま不変）
- [x] `pnpm lint` は 16 problems（移行前 17 から `storageService` の空 catch 1件が減っただけで、新規指摘ゼロ）
- [x] 意図的な違反ファイル3件で依存方向ルールが5件すべてエラー検出することを確認（core→ui、platform→core、ui→apps の相対 import、core での `localStorage`/`fetch` 直呼び）

#### 実機確認が必要な項目（未実施）

Playwright では確認できていないため、`pnpm dev` での手動確認が必要。

- [ ] Google Drive へのサインイン → マップの保存・読み込み・一覧・削除
- [ ] Drive 保存の 401 リトライ（サイレント再認証 → 再接続トースト）
- [ ] 別デバイスとの衝突ダイアログ（「上書き保存」「最新版を読み込む」）
- [ ] 設定のDrive同期（`saveSettingsToDrive` / `loadSettingsFromDrive`）
- [ ] PNG / SVG の画像エクスポート（SVG は出力ファイルがXMLとして解析できない不具合を 2026-08-07 に修正済み。再確認が必要。詳細は下記「実機確認で見つかった不具合の修正」を参照）
- [ ] プレゼンテーションモード
- [ ] GitHub Pages へのデプロイ成功（`main` へマージ後）

#### 実機確認で見つかった不具合の修正（2026-08-07）

上記の実機確認を進める中で2件の不具合が見つかり、修正した。コードは修正済み・ビルド確認済みだが、ユーザーによる再度の実機確認はまだ行っていないため、上の実機確認チェックリストの該当項目は `[ ]` のままにしている。

- **SVG エクスポートが壊れたファイルを出力していた**（`packages/ui/src/services/exportService.ts` の `exportMapAsImage`）: `html-to-image` の `toSvg()` が返すのは SVG 本体ではなく `data:image/svg+xml;charset=utf-8,<percent-encoded XML>` というデータURL文字列だった。それをそのままファイル内容として書き出していたため、出力した `.svg` をブラウザで開くと `error on line 1 at column 1: Start tag expected, '<' not found` になっていた。PNG と同じ `dataUrlToBlob()` でデコードしてから `downloadBlob()` する実装に統一して解消した（下記「積み残し」も参照）。実際の `html-to-image` 1.11.13 を headless Chrome で動かし、修正後のファイル内容が `<svg xmlns=...` で始まり `DOMParser` の `image/svg+xml` パースが通ること、日本語も保持されること、画像としてデコードできる（400x200）ことを確認した
- **キャンバスの「掴む」カーソルがライトモードで見えない**（`packages/ui/src/index.css`）: ブラウザ標準の `grab`/`grabbing` カーソルはフチが細く、ライトモードのキャンバス背景色 `#f9fafb` と同化して見えなかった。白い手に黒フチ（塗り `#ffffff` + フチ `#1f2937`、24×24、ホットスポット `11 12`）を回した自前の SVG カーソルを定義し、`.react-flow__pane.draggable` 等に `!important` 付きで適用して解消した（詳細は `docs/design.md` §14）。ライトでは黒フチが、ダークでは白い塗りが背景から浮くためテーマ分岐は設けていない。build 順・dev 順の両方の CSS 読み込み順で `getComputedStyle` を確認し、pane/node の grab・grabbing、`.tap-connect` の crosshair の5パターンと `.dark` 切替の挙動が期待どおりになることを確認した

いずれの修正もビルド・lint には影響なし。`pnpm build` 通過（CSS 出力は前述のとおり 48.64 kB）。`pnpm lint` は 16 problems（13 errors, 3 warnings）で Phase 33 完了時と同数、新規指摘なし。

#### 移行に伴う判断（設計ドキュメントからの差分）

| # | 事項 | 判断 |
|---|---|---|
| 1 | 依存バージョン | ロックファイル破棄で依存が drift し `@xyflow/react` 12.11 の型変更でビルドが落ちたため、**全依存を移行前ロックファイルの版に固定**した。「移行前後で挙動が変わっていないこと」が判定条件のフェーズなので依存更新は混ぜない |
| 2 | Step 5-2 と 5-3 の順序 | `mapStore` が `uiStore` に依存するため入れ替えた。逆順だと core の `mapStore` が `apps/web` の `uiStore` を import することになり依存方向に違反する |
| 3 | project references | パッケージ間に composite なプロジェクト参照は張らない。ソース直接参照方式では参照先に `composite: true` と emit が要求されて成立しない（TS6306 / TS6310）ため、ルートの solution ファイルからのみ参照する |
| 4 | `FileAdapter` のマップ内容の型 | `MapFile` ではなく `unknown`。`packages/platform` → `packages/core` の循環依存を避けるため（既存 `googleDriveService` も同じ扱い） |
| 5 | `SecretAdapter` の拡張 | `getSecret`/`setSecret` に `passphrase` 引数と、旧形式移行用の `hasLegacySecret`/`getLegacySecret`/`clearLegacySecret` を追加。Web のマスターパスワード方式と Phase 27 以前のキー移行を維持するため |
| 6 | `FileAdapter` の追加メソッド | `exportBlob`（PNG/SVG/Markdown の書き出し）・`saveLocalMirror`（ローカル控え）・`isRemoteReady` を追加。`saveFileAs` はマップ本体の保存専用のため |
| 7 | `HttpAdapter.getFetch()` | `@anthropic-ai/sdk` の `fetch` 差し替え口に渡すために追加 |
| 8 | `settingsStore` の `persist` | zustand 既定の localStorage のまま据え置き（Phase 34 で対応。理由はコード内 NOTE 参照） |
| 9 | ESLint 設定の一本化 | `apps/web/eslint.config.js` を削除しルートに集約。ESLint 10 は lint 対象ファイル側から設定を探索するため、両方あると typescript-eslint がプロジェクトルートを判別できず全ファイル parse error になる |

#### 積み残し

- ~~SVG エクスポートは `toSvg` が返すデータURL文字列をそのままファイル内容として書き出している（移行前からのバグ）。Phase 33 の判定条件が「移行前と同じ動作」のため本フェーズでは修正していない~~ → **解消済み（2026-08-07）**。実機確認で発覚し、PNG と同じ `dataUrlToBlob()` 経由のデコードに統一して修正した（詳細は上記「実機確認で見つかった不具合の修正」を参照）
- `packages/ui` のコンポーネントに `showCloudAuth` などデスクトップ向けの分岐を入れたが、実際の動作確認は Phase 34 で行う

---

### Phase 34: Tauri デスクトップ版の骨格（約5日）✅ 完了（2026-08-07）

**目標**: `apps/desktop` を新設し、ウィンドウが起動してマップ編集とローカルファイル保存ができる状態にする。Ollama 連携はまだ含まない。

> 参照: `docs/desktop/platform-integration.md` §3〜5・§7、`docs/desktop/architecture.md` §5 Step 8。設計からの差分は `docs/desktop/README.md` §3.1-D。

#### タスク
- [x]✅ Windows 開発環境セットアップ（Rust ツールチェーン / MSVC Build Tools / WebView2）。**すべて導入済みだった**（rustc 1.97.1 stable-msvc / Visual Studio Build Tools 2022（VC.Tools.x86.x64）/ WebView2 Runtime 151.0.4129.59）
- [x]✅ **最優先の検証**: Tauri の空ウィンドウで React Flow を表示し、①日本語IME入力が正常か ②大規模マップの描画性能が実用範囲か を確認する。**ここが致命的なら ADR-001 §6 に従いフレームワーク選定をやり直す** → **どちらも問題なし**（2026-08-07・Windows 11 + WebView2 151 の実機）。ADR-001 の結論は維持
- [x] `apps/desktop` を作成（Vite + `src-tauri`）。`packages/ui` / `packages/core` を参照する
- [x] `tauri.conf.json` と `capabilities/*.json` を作成。CSP と `fs` / `dialog` / `store` / `http` のスコープを最小権限で設定（`main-window` / `file-access` / `ai-http` の3ファイル）
- [x] `apps/desktop/src/platform/*.desktop.ts` に Adapter を実装
  - [x] `StorageAdapter`: `@tauri-apps/plugin-store`（`$APPCONFIG/app-data.json`）
  - [x] `FileAdapter`: `@tauri-apps/plugin-dialog` の `open`/`save` ＋ `@tauri-apps/plugin-fs`
  - [x] `SecretAdapter`: OSキーチェーン（`keyring` crate v4 をラップした Tauri コマンド4本）。`isPassphraseFree: true`
  - [x] `HttpAdapter`: `@tauri-apps/plugin-http`
  - [x] `SystemAdapter`: クリップボード（`plugin-clipboard-manager`）、`opener`、ウィンドウ `close-requested` による終了前確認
- [x] `main.tsx` で `setPlatform(desktopPlatform)` を呼ぶ
- [x] 自動保存の書き込み先を「開いているファイル」に切り替え。ファイル未確定時は `$APPLOCALDATA/autosave/<mapId>.ideamap`
- [x] APIキー入力時にマスターパスワードを要求しない分岐（`SecretAdapter.isPassphraseFree` を見る）
- [x]✅ Web専用機能（Drive同期・GIS認証・共有URL）がデスクトップ版UIに出ないことを確認
- [x] `settingsStore` の zustand `persist` を StorageAdapter 経由へ（Phase 33 からの積み残し #8）。`skipHydration: true` ＋ `restorePersistedState()` を初回レンダー前に await
- [x] `docs/requirements.md` にデスクトップ版の機能要件を追記

**完了条件**: `pnpm tauri dev` でウィンドウが起動する。マップの作成・編集・Undo/Redo・ローカルファイルへの保存と読み込み・Claude API でのAI提案が動作する。日本語入力に問題がない。アプリ再起動後も設定とAPIキーが復元される（マスターパスワード入力なしで）。

#### 動作確認（CDP 経由の自動検証・2026-08-07）

WebView2 を `--remote-debugging-port` 付きで起動し、Playwright を CDP でアタッチして検証した。検証スクリプトは確認後に削除済み。

- [x]✅ `pnpm tauri dev` でウィンドウが起動する（`cargo check` 通過。dev ビルドで起動しウィンドウタイトル「IdeaMap」を確認）
- [x]✅ 起動画面がデスクトップ版のもの（新規作成／ファイルを開く／最近開いたファイル）で、Google・Drive・サインインの文字列が画面上に一切ない
- [x]✅ ヘッダーが `IdeaMap 未保存 · ローカル AIチャット マップ分析` で、Drive接続ボタンが出ない。設定パネルに Drive同期セクションとマスターパスワード欄が出ない
- [x]✅ APIキーの説明文が「この端末のOSキーチェーンにのみ保存されます」に切り替わる
- [x]✅ `MasterPasswordModal` が一度も表示されない（`initApiKey` が `isPassphraseFree` 分岐に入るため `apiKeyLock` が `locked` にならない）
- [x]✅ OSキーチェーンの往復（`set_secret` → `has_secret` → `get_secret` → `clear_secret`）。日本語を含む値 `probe-値-123` がそのまま戻る
- [x]✅ `HttpAdapter` が Rust 側の http プラグイン経由で発行され、`ai-http` capability の許可URLが通る
- [x]✅ 自動保存が `$APPLOCALDATA/com.ideamap.desktop/autosave/<mapId>.ideamap` を書き、UTF-8 の正しい JSON（`title: "新しいマップ"`）になっている。保存表示が「保存済み · ローカル」になる
- [x]✅ `$APPCONFIG/com.ideamap.desktop/app-data.json` に `ideamap-welcomed` / `ideamap-settings`（zustand persist のペイロード）/ `last-autosave-path` が入る＝StorageAdapter への移行が効いている
- [x]✅ 再起動後、起動画面の「前回の作業を再開」に前回の自動保存が出る
- [x]✅ `fs:scope` が効いている。`~/Documents` 直下を直接読むと `forbidden path` で拒否される
- [x]✅ リリースビルド（`tauri build --no-bundle`）が通り、生成した exe が **本番CSP**（`devCsp` ではない方）で起動・描画・自動保存まで動く
- [x]✅ 全工程で console error / pageerror がゼロ
- [x]✅ `pnpm typecheck` 通過。`pnpm lint` は 16 problems（13 errors, 3 warnings）で Phase 33 完了時と同数、`apps/desktop` の新規指摘はゼロ
- [x]✅ Web版の `pnpm build` に影響なし（CSS 48.64 kB・`ai` チャンク 144.40 kB とも Phase 33 と一致）

#### 実機確認（`pnpm dev:desktop`・2026-08-07）

合成入力では再現できない項目をユーザーが手動で確認した。

- [x]✅ **日本語IME入力**（README §5 #1・最優先）。ノードのインライン編集・タイトル・AIチャット入力で変換が正常に確定する
- [x]✅ **大規模マップの描画性能**（README §5 #2）。パン・ズーム・ドラッグが実用範囲
- [x]✅ ネイティブの「開く」ダイアログで `.ideamap` を選んで読み込める。**README §5 #6（`fs:scope` 外のパスが dialog の実行時許可で読み書きできるか）もこれで解消**
- [x]✅ 「名前を付けて保存」ダイアログが出て、選んだパスに書き込める
- [x]✅ マップの編集・Undo/Redo（Ctrl+Z / Ctrl+Y）
- [x]✅ Claude API でAI提案が動く
- [x]✅ 未保存のまま閉じたときのネイティブ確認ダイアログ
- [x]✅ エクスポート（PNG / SVG / Markdown / JSON）が保存ダイアログ経由で書き出せる
- [x]✅ 再起動後、「最近開いたファイル」から前回のファイルを開ける（`tauri-plugin-persisted-scope` による scope 引き継ぎが効いている）
- [x]✅ 再起動後もAPIキーが復元される。マスターパスワードは要求されない

#### 実装時の判断（設計ドキュメントからの差分）

`docs/desktop/README.md` §3.1-D に表としてまとめた。要点のみ再掲する。

| # | 事項 | 判断 |
|---|---|---|
| 1 | capability の分割 | `main-window` / `file-access` / `ai-http` の3つ。`ollama-http` は Anthropic API と同じ「AIプロバイダへの通信」なので `ai-http` に統合。`google-oauth` はスコープ外、`updater` は Phase 36 |
| 2 | ダイアログで選んだパスの `fs` 許可 | `fs:scope` はアプリ専用ディレクトリのみに絞り、`tauri-plugin-persisted-scope` で dialog の実行時許可を次回起動へ引き継ぐ。`$HOME/Documents/**` の明示追加より攻撃面が狭い |
| 3 | `FileAdapter.origin` の追加 | `useAutoSave` が `origin: 'cloud'` 決め打ちで `FileRef` を組んでいたため。platform 型・web 実装・desktop 実装の3点を同時に追加 |
| 4 | `AutoSaveOptions.createNewFileOnSave` | Web=true / Desktop=false。false ではデバウンス保存がローカル控えだけで完了し、実ファイルの新規作成は明示保存（Ctrl+S）に限る。無いと3秒ごとに保存ダイアログが出る |
| 5 | `keyring` crate | v4 の `keyring::v1::Entry` を自前の Tauri コマンドで薄くラップ。§4.2 のコード例（v3 相当）とは API が異なる。コミュニティプラグインは使わない |
| 6 | `dragDropEnabled` | `false`。React Flow との競合（README §5 #7）が未検証のため、D&D を扱う Phase 37 で有効化して検証する |
| 7 | ダッシュボードの共通化 | `startNewMap` / `openLoadedMap` / `useDashboardEscapeToClose` を `packages/ui/src/hooks/useFileDashboard.ts` に切り出し、Web版 `FileOpenDashboard` とデスクトップ版 `DesktopFileDashboard` の両方から使う |
| 8 | Vite の watch 除外 | `apps/desktop/vite.config.ts` で `**/src-tauri/**` を watch から外す。cargo が書き込み中の DLL を Vite が監視すると EBUSY で dev サーバーごと落ちる |
| 9 | dev ポート | デスクトップ版は 5174（Web版の 5173 と分ける）。`strictPort: true` にして、ポート衝突時に別ポートへ逃げてウィンドウが空白になるのを防ぐ |

#### 積み残し

- 自動保存の控え（`$APPLOCALDATA/autosave/<mapId>.ideamap`）は mapId ごとに増え続ける。古いものの掃除は未実装（Phase 37 の「最近開いたファイル」整備とあわせて対応する）
- `tauri.conf.json` の `version` は `0.1.0` の直書き。`package.json` との同期方針は Phase 36 で決める
- Ollama への到達確認は capability の許可設定までで、実際の Ollama 通信は Phase 35

---

### Phase 35: Ollama 統合（約4日）🔨 実装済み（確認中）

**目標**: **本計画の主目的。** デスクトップ版でローカルLLM（Ollama）を選択して、AI機能が動く状態にする。

> 参照: `docs/desktop/llm-abstraction.md` §3〜7（Step 3-7）・§8（API調査結果）。設計からの差分は `docs/desktop/README.md` §3.1-E。

#### タスク
- [x]✅ `packages/core/src/llm/ollamaProvider.ts` を実装（`/api/chat` を使用、NDJSON ストリーミングの手動パース、`format` への JSON Schema 指定、`/api/tags` + `/api/ps` によるモデル一覧取得）。全リクエストに `think: false` を付与し、HTTP 400 のときだけ `think` を外して1回だけ再送するフォールバックを追加
- [x] `HttpAdapter` に `canAccessLocalServers: boolean` を追加（`packages/platform` の型・`apps/web`・`apps/desktop` の3点。Web=false / Desktop=true）。プロバイダ切り替えUIの表示判定に使う
- [x] `apps/desktop/src-tauri/capabilities/ai-http.json` の Ollama 到達先を `http://localhost:11434/*` 固定から `http://localhost:*/*` ＋ `http://127.0.0.1:*/*` に拡大（接続先URLでポートを変更できるようにするため）
- [x]✅ `HttpAdapter` 経由で Ollama に到達できることを実機確認。デスクトップ実機（`pnpm dev:desktop`）で Rust 側 `plugin-http` 経由の `/api/tags` `/api/ps` `/api/chat` すべてに到達。**`OLLAMA_ORIGINS` の追加設定は不要だった**（README §5 #4 を解消）
- [x] 型移行: `AIModel`（Claude専用 union）を `AIModelSelection { provider, model }` へ。`settingsStore` を `llmProvider` / `claudeModel` / `ollamaModel` / `ollamaBaseUrl` に分割
- [x] zustand `persist` の `version` + `migrate` で旧 `localStorage` データを無破壊移行（`version: 1 → 2`。旧 `aiModel` を `claudeModel` に移し、`llmProvider` は必ず `'claude'` で初期化）
- [x] Drive の `AppSettings` を `version: '2.0'` に。旧 `1.0` を読んでもエラーにならないこと（`model` フィールドの意味は変えていないため後方互換。Ollama の接続先URL・モデルは同期対象に含めない）
- [x] 設定UIにプロバイダ切り替え・エンドポイントURL設定・接続テスト・インストール済みモデル一覧を追加。Web版ではプロバイダ切り替えUIを表示しない（`HttpAdapter.canAccessLocalServers` で判定）
- [x] Ollama 未起動時のエラー表示とガイダンス（`ollama serve` / `ollama pull` の案内、コピーボタン付き。モデル0件時の空状態も追加）
- [x] 各パネルの呼び出しを `getActiveProvider(settings)` から得た `LLMProvider` を渡す方式に変更（`useActiveProvider` フック経由）。`claudeService.ts` → `aiService.ts` のリネームは Phase 33 で実施済みのため、本フェーズでは `SuggestionRequest` 等の `apiKey`/`model` → `provider` へのシグネチャ変更のみ実施
- [x] 小型モデル向けの出力安定化（`completeJson` の `temperature: 0` は Ollama のみ、スキーマのプロンプト埋め込み `jsonInstructionSuffix`、パース失敗時の1回リトライ `completeJsonWithRetry`）
- [x]✅ `MapAnalysisPanel` の3機能にキャンセルUIを追加（Phase 32 の積み残し。`llm-abstraction.md` §7 Step 2 の未達項目）。ローカルLLMは応答が長くかかりうるため
- [x] 日本語対応モデルでの実用性確認（Gemma 3 / Qwen3 / ELYZA-JP-8B など）※Qwen3.6（36B）でチャット・マップ分析は確認済み。小型モデルでの評価はユーザー手動確認待ち
- [x] `docs/design.md` の「9. AI連携設計」に Ollama を反映。`docs/requirements.md` にローカルLLM要件を追記

**完了条件**: デスクトップ版でプロバイダを Ollama に切り替え、接続テストとモデル一覧取得が成功する。ローカルモデルでアイデア提案・AIチャット・マップ分析・接続提案・クラスタ提案の5機能が動作する。旧形式の `localStorage` データで起動してもエラーなく移行される。Web版は見た目・挙動とも Phase 34 以前と一致する。

#### 検証済み（Node から Provider を直接実行・Ollama 0.32.6 / Windows 11・2026-08-07）

`HttpAdapter` をスタブして `OllamaProvider` を直接動かして確認した。デスクトップアプリの実機上での確認ではない点に注意。

- [x]✅ `listModels()` — `/api/tags` + `/api/ps` から `qwen3.6:latest | 36.0B / Q4_K_M / 22.3GB / 256Kコンテキスト | loaded=true` を取得
- [x]✅ `complete()` / `completeJson()`（JSON Schema制約付き。2件の配列を正しくパース）/ `stream()`（NDJSON・12チャンク）
- [x]✅ `stream()` の中断 — 例外を投げず、途中までの累積テキストを返す
- [x]✅ 404（未インストールモデル）→ `LLMError('notFound')` に `ollama pull <model>` の案内
- [x]✅ 到達不可（`http://127.0.0.1:9`）→ `LLMError('connection')`
- [x]✅ `completeJson()` の中断 → `LLMError('aborted')`・`name === 'AbortError'`
- [x]✅ `/api/tags` の `details.context_length` が実コンテキスト長を返す（Ollama 0.32系）。`docs/desktop/README.md` §5 #5 の解消材料
- [x]✅ `format` にJSON Schemaオブジェクトを渡す構造化出力が 0.32.6 で動作（`docs/desktop/README.md` §5 #3 の実測値。ただし「どのバージョンから」の下限は未確定のまま）
- [x]✅ 思考モデル（qwen3.6）は `think: false` を送らないと思考トークンが `num_predict` を食って出力が途中で切れる（`done_reason: 'length'`）ことを確認。全リクエストへの `think: false` 付与で解消
- [x]✅ `settingsStore` の persist マイグレーション4ケース（StorageAdapter をスタブして `restorePersistedState()` 相当を実行）
  - v1（`aiModel: 'claude-haiku-4-5-20251001'`）→ `llmProvider: 'claude'` / `claudeModel` に引き継ぎ。テーマ・提案数・エッジ形状など他項目も保持
  - v0（`aiModel: 'claude-sonnet-4-6'` ＝廃止済みID）→ `claudeModel: 'claude-sonnet-5'` に正規化
  - v2（`llmProvider: 'ollama'` / カスタムURL）→ migrate が走らず、そのまま復元
  - 保存データ無し → 既定値（`claude` / `claude-sonnet-5` / `http://localhost:11434`）

#### 動作確認（デスクトップ実機・CDP 経由の自動検証・2026-08-07）

`pnpm dev:desktop` を `--remote-debugging-port` 付きで起動し、Playwright を CDP でアタッチして検証した。検証スクリプトは確認後に削除済み。**ここで通った経路は Rust 側 `plugin-http` 経由の実通信**であり、Node スタブでの確認とは別物。

- [x]✅ 設定パネルに「AIプロバイダ」セクションが出る（デスクトップ版のみ）。Ollama を選ぶと「Ollama（ローカル）」セクションに切り替わり、Claude API セクションが隠れる
- [x]✅ 接続先URLの初期値が `http://localhost:11434`。接続テストが成功し「接続成功 / 1個のモデルが見つかりました」を表示
- [x]✅ モデル一覧に `qwen3.6:latest（36.0B / Q4_K_M / 22.3GB / 256Kコンテキスト）` が出て、自動で選択される
- [x]✅ AIチャットが Ollama で動く（9.1秒で日本語の応答。`/api/chat` のストリーミング）
- [x]✅ マップ分析が Ollama で動く（12ノードのマップを4.4秒で分析。`format` へのJSON Schema指定 → `completeJson` のパース成功）
- [x]✅ 分析実行中にキャンセルボタンが表示され、押すとローディングが解除されエラートーストも出ない
- [x]✅ 全工程で console error / pageerror がゼロ。**検証中に見つけた `The resource id ... is invalid` の未処理例外（`AbortSignal.timeout()` と `plugin-http` のボディ解放の二重解放）は修正済み**

#### 実装時の判断（設計ドキュメントからの差分）

`docs/desktop/README.md` §3.1-E に表としてまとめた。要点のみ再掲する。

| # | 事項 | 判断 |
|---|---|---|
| 1 | プラットフォーム判定 | `llm-abstraction.md` §6.1 の `isDesktopRuntime()`（`'__TAURI_INTERNALS__' in window`）は使わず、`HttpAdapter.canAccessLocalServers` を Adapter 経由で判定する。README §3.2 の「`setPlatform()` 注入に統一」という裁定と整合させるため |
| 2 | `completeJson` の `temperature: 0` | Ollama のみに適用し、Claude は SDK 既定のまま。`llm-abstraction.md` §4.2 は「両方」としていたが、「Web版は Phase 34 以前と挙動が一致する」という完了条件を優先した |
| 3 | Claude 向けプロンプト | スキーマのプロンプト埋め込みは Ollama のときだけ。Claude に送るプロンプト文字列は Phase 34 以前と1文字も変わらない |
| 4 | `maxContextTokens` | `OllamaProvider.capabilities` は固定値 8192 のまま。実コンテキスト長は `ModelInfo.contextTokens` として `/api/tags` から取り、設定UIの表示に使う（`capabilities` はコンストラクタ時点で確定させたいが、実長はモデル選択後にしか分からないため） |
| 5 | `think: false` | 全リクエストで送る。400 のときだけ `think` を外して1回だけ再送するフォールバックあり |
| 6 | `ai-http` capability | `http://localhost:*/*` / `http://127.0.0.1:*/*` に拡大。接続先URL設定でポートを変更可能にするため。ホストは localhost 系に限定したままなので攻撃面は localhost 上のサービスに限られる |
| 7 | Phase 32 の移行用アダプタ削除 | `toLegacySuggestionParseError` / `toLegacyAnalysisParseError` を削除し `LLMError` に一本化。UI の生レスポンスコピーは `LLMError.rawResponse` から取る（`llm-abstraction.md` §7 Step 6 の予告どおり） |
| 8 | モデル一覧取得のタイムアウト | `AbortSignal.timeout()` ではなく `AbortController` ＋ `setTimeout` にし、読了時に `clearTimeout` する。`plugin-http` が abort でボディを解放するため、読了後の発火が二重解放になり実機で未処理例外になった |
| 9 | 分析3機能のキャンセルUI | `MapAnalysisPanel` に `AbortController` とキャンセルボタンを追加。Phase 32 の積み残しをここで解消した |

#### 残りの手動確認項目

- デスクトップアプリ上で、Ollama を選んだ状態でのアイデア提案・接続提案・クラスタ提案（チャットとマップ分析は CDP 検証で確認済み）
- 日本語対応モデル（Gemma 3 / Qwen3 / ELYZA-JP-8B など小型モデル）での実用性確認。とくに `suggestClusters` のようなネストしたJSONの追従率
- Ollama 未起動・モデル0件・接続先URL誤りの各エラーガイダンスの実機表示
- 旧形式 `localStorage`（`aiModel` のみ保持）での**実アプリ起動時**のマイグレーション（Node 上ではストアの migrate を直接実行して確認済み）、旧 `version: '1.0'` の Drive 設定ファイルの読み込み
- Web版が Phase 34 以前と一致すること（プロバイダ切り替えUIが出ない・Claude で5機能が従来どおり動く）
- Web検索トグルをオンにした **AIチャット・マップ分析（全体分析）** が検索結果を踏まえた回答を返すこと。アイデア提案での実検索・出典表示はユーザーが確認済み（下記「追加実装」参照）

#### 追加実装: AIに聞く前のWeb検索（2026-08-08）

**目標**: アイデア提案・AIチャット・マップ分析（全体分析）でAIに聞く前にWeb検索を選べるようにし、学習データより新しい情報を踏まえて回答させる。デスクトップ版のみ（ollama.com の Web Search API を利用するため）。

> 参照: 判断の詳細は `docs/desktop/README.md` §3.1-E、Ollama Web Search API の調査結果は `docs/desktop/llm-abstraction.md` §8.3。

##### タスク
- [x] `packages/core/src/llm/webSearch.ts` を新規実装。`OllamaWebSearchClient`（`POST https://ollama.com/api/web_search` に Bearer認証）、5件・600文字切り詰め、15秒タイムアウト（`AbortController` + `clearTimeout`。`AbortSignal.timeout()` は不使用）、`formatWebSearchBlock()` でプロンプト注入用ブロックに整形
- [x] `packages/core/src/llm/aiService.ts` に `WebSearchOptions`（`webSearch?` / `onWebSearchResults?`）を追加。`generateSuggestions` / `analyzeMap` / `chatWithMap` が受け取り、未指定なら検索を実行せずプロンプトも Phase 35 本体と1文字も変わらない
- [x] `ChatWithMapRequest` を `WebSearchOptions` 継承に変更（`packages/core/src/types/index.ts`）
- [x] `settingsStore` に `webSearchApiKey`（`SecretAdapter` の別スロット `webSearchApiKey`・永続化しない）・`webSearchEnabled`（persist 対象）と `setWebSearchApiKey` / `setWebSearchEnabled` を追加。`isPassphraseFree` が `false` のプラットフォーム（Web版）では保管しない
- [x] `packages/ui/src/hooks/useWebSearch.ts` を新規実装。`isAvailable`（`HttpAdapter.canAccessLocalServers`）・`isConfigured`・`enabled`・`client` を返す共通フック
- [x] `packages/ui/src/components/common/WebSearchToggle.tsx` を新規実装（`WebSearchToggle` トグル・`WebSearchSources` 出典表示リスト）
- [x] `AISuggestionPanel` / `AIChatPanel` / `MapAnalysisPanel` にトグルと出典表示を追加。マップ分析は全体分析タブにのみ設置（つながり・グループはマップ内部の構造を扱うため外部情報が効かない）
- [x] `SettingsPanel` に `WebSearchSection` を追加（`canAccessLocalServers` が `true` のときのみ描画）。APIキー入力・ollama.com のキー発行ページへのリンク・検索テスト・キー削除・既定オン/オフトグル・検索クエリが ollama.com に送信される旨の注意書き
- [x] `apps/desktop/src-tauri/capabilities/ai-http.json` に `https://ollama.com/api/*` を追加
- [x] `docs/requirements.md` / `docs/design.md` / `docs/implementation-plan.md` / `docs/desktop/README.md` / `docs/desktop/llm-abstraction.md` を更新

**完了条件**: デスクトップ版の3機能（アイデア提案・AIチャット・マップ分析の全体分析）で、Web検索トグルをオンにすると ollama.com の検索結果を踏まえた回答が返り、参照した情報源がUIに表示される。オフのとき・Web版では Phase 35 本体までと挙動が変わらない。

##### 裏取り済みの事実（2026-08-08実測）
- `POST https://ollama.com/api/web_search` はキー無しで HTTP 401 `{"error":"Unauthorized"}` を返す
- レスポンス形状は `{"results":[{"title","url","content"}]}`、リクエストは `{query, max_results}`（既定5・上限10）。`web_fetch` エンドポイントも存在するが未使用
- APIキーは https://ollama.com/settings/keys で発行（無料アカウントが必要）

##### 動作確認（デスクトップ実機・CDP 経由の自動検証・2026-08-08）

まずダミーキーで設定UIとエラー分類を確認した（確認後にキーは削除済み）。**その後ユーザーが有効なAPIキーで実検索まで確認し、Web検索そのものは動作した。** 出典リンクが開かない不具合が見つかり、下記「外部リンクの修正」で解消している。

- [x]✅ 設定パネルに「Web検索」セクションが出る（デスクトップ版のみ）。APIキー入力欄があり、キー未設定のうちは「検索テスト」「キーを削除」「既定でWeb検索を使う」が出ない
- [x]✅ キーを保存すると上記3つが出る。キーを削除すると元の状態に戻る
- [x]✅ **無効なキーで「検索テスト」を実行すると「Web検索のAPIキーが無効です。設定画面で ollama.com のAPIキーを確認してください。」が出る。** リクエストが Rust 側 `plugin-http` から実際に ollama.com へ届き（＝`ai-http` capability の許可URLが効いている）、401 が `LLMError('auth')` に正しく分類されていることの確認になる
- [x]✅ アイデア提案・AIチャット・マップ分析（全体分析タブ）にWeb検索トグルが出る。設定の「既定でWeb検索を使う」の状態が各パネルへ引き継がれる
- [x]✅ マップ分析の「つながり」タブにはトグルが出ない
- [x]✅ 全工程で console error / pageerror がゼロ
- [x]✅ **有効なAPIキーでの実検索**（ユーザー確認・2026-08-08）。アイデア提案で検索結果を踏まえた5件の提案が生成され、参照した情報源5件が一覧表示された

##### 外部リンクの修正（2026-08-08）

出典リンクをクリックしてもブラウザが開かない不具合が見つかった。原因は `opener` プラグインの**URLスコープ未設定**。

- [x]✅ `main-window` capability の `opener:allow-open-url` を**スコープ付き**に変更（`https://*` / `http://*`）。`opener:allow-open-url` は「コマンドを呼んでよい」だけの許可で、URLスコープが空だと `openUrl()` は全て拒否される。Phase 34 では外部リンクを実際に押していなかったため発覚しなかった
- [x]✅ `packages/ui/src/components/common/ExternalLink.tsx` を新規追加し、`SystemAdapter.openExternalUrl` 経由に統一。素の `<a target="_blank">` はデスクトップ版の WebView では無反応になるため、`SettingsPanel` の Anthropic Console リンク2箇所も置き換えた
- [x]✅ CDP 検証: `plugin:opener|open_url` が拒否されずに実行される。設定パネルの「ollama.com でキーを発行」「Anthropic Console」がボタンとして描画され、クリックしてもエラーが出ない。console error / pageerror ゼロ

---

### Phase 36: ビルド・配布・自動更新（約3日）🔨 実装済み（確認中）

**目標**: 他人にインストーラを配れる状態にする。

> 参照: `docs/desktop/platform-integration.md` §6。設計からの差分は `docs/desktop/README.md` §3.1-F。

#### タスク
- [x] GitHub Actions で Windows（MSI/NSIS）・macOS（dmg、aarch64/x64）をビルドするワークフローを作成（`.github/workflows/release-desktop.yml`、`tauri-apps/tauri-action@v0`）。ビルド前に `verify-version` ジョブでバージョンの一貫性とタグの一致を検査する
- [x] GitHub Releases への成果物公開（`releaseDraft: true` で下書きとして作成。`checksums` ジョブがリリース成果物から `SHA256SUMS.txt` を集計して添付する）
- [x] `tauri-plugin-updater` の設定（署名鍵を生成し、公開鍵を `tauri.conf.json` の `plugins.updater.pubkey` にコミット。秘密鍵は GitHub Secrets `TAURI_SIGNING_PRIVATE_KEY`/`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` に登録する運用。`apps/desktop/src/updater.ts` に起動時自動チェックと、設定パネルの `UpdaterSection` による手動チェックを実装）
- [x]✅ バージョニング方針の決定（ルート `package.json` の `version` を単一の真実にし、`scripts/sync-version.mjs` が `apps/web`・`apps/desktop`・`src-tauri/tauri.conf.json`・`src-tauri/Cargo.toml` の4ファイルへ配る。`node scripts/sync-version.mjs --check` を実行し全ファイルの一致を確認済み）
- [x] コード署名なし配布時の SmartScreen / Gatekeeper 警告に対するユーザー向け案内文を README に用意（README.md「初回起動時の警告について」節、SHA256チェックサムの検証手順、リリース手順を追加）
- [ ] インストール〜起動〜アップデートの一連の流れを、開発機以外で確認

**完了条件**: タグを打つと Windows・macOS 向けインストーラが自動ビルドされ Releases に公開される。インストールしたアプリが起動し、新バージョン公開時に自動更新が動作する。

上記のうち「タグを打っての実ビルド」「開発機以外での実機確認」「GitHub Secrets への署名鍵登録」は未実施のため、完了条件は実装面（コード・CI設定）でのみ満たしている。詳細は「残りの手動確認項目」を参照。

#### 実装時の判断（設計ドキュメントからの差分）

`docs/desktop/README.md` §3.1-F に表としてまとめた。要点のみ再掲する。

| # | 事項 | 判断 |
|---|---|---|
| 1 | バージョニング | ルート `package.json` の `version` を単一の真実にし、`scripts/sync-version.mjs` が `apps/web/package.json`・`apps/desktop/package.json`・`apps/desktop/src-tauri/tauri.conf.json`・`apps/desktop/src-tauri/Cargo.toml` の4ファイルへ配る。`--check` でCIがズレを検出する。初期バージョンは `0.1.0`。Web版とデスクトップ版で同じ番号を共有し、Gitタグは `desktop-v<version>` |
| 2 | `tauri.conf.json` の `version` への相対パス指定（README §5 #9） | 指定できることを実測で確認したが採用しなかった。数値直書き＋同期スクリプト方式のまま統一している |
| 3 | 自動更新の実装 | `tauri-plugin-updater` + `tauri-plugin-process`。JS依存・Rust依存・`lib.rs` 登録・`capabilities/updater.json` の4点を揃えた。Rust依存は `[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]` に置き、`lib.rs` では `#[cfg(desktop)]` で登録。エンドポイントは `https://github.com/mayamaura/ai-idea-map/releases/latest/download/latest.json`。起動5秒後の自動チェック（失敗・更新なしは無言）と設定パネルの手動チェック（結果を必ず返す）の2経路。更新適用前に `flushPendingSave()` で自動保存を最大10秒待って確定させる |
| 4 | updater の通信とCSP | 更新の取得は Rust 側（reqwest）が行うため WebView の CSP には関係しない。`tauri.conf.json` の `csp`/`devCsp` は変更していない |
| 5 | `settingsExtraSections` スロット | `packages/ui` からプラットフォーム実装へ依存させないため、設定パネル末尾への差し込み口を `App` の props として追加（既存の `mapListSlot`/`dashboardSlot` と同じ方針）。デスクトップ版が `UpdaterSection`（バージョン表示＋更新を確認）を渡す |

#### 検証済み

- [x]✅ `cargo check`（`apps/desktop/src-tauri`）通過。`tauri-plugin-updater` / `tauri-plugin-process` の依存追加後もビルドエラーなし
- [x]✅ `tauri.conf.json` の `version` に `package.json` への相対パス文字列（`"../../../package.json"`）を指定できるかを実測。`cargo check`（tauri-build）と `pnpm --filter @ideamap/desktop exec tauri inspect wix-upgrade-code`（tauri CLI）の両方が成功し、存在しないパス（`"../../nonexistent-package.json"`）では両方とも「`tauri.conf.json > version` must be a semver string」で失敗することを確認した（＝パスとして解決されている）。詳細は `docs/desktop/README.md` §5「Phase 36 で解消した項目」参照
- [x]✅ `node scripts/sync-version.mjs --check` — ルート・`apps/web`・`apps/desktop`・`src-tauri/tauri.conf.json`・`src-tauri/Cargo.toml` の5箇所すべてが `0.1.0` で一致
- [x]✅ `pnpm typecheck`（`tsc -b`）通過
- [x]✅ `pnpm lint` — 16 problems（13 errors・3 warnings）。Phase 36 の変更前と同数で、すべて既存ファイル（`useAutoSave.ts` 等）由来。Phase 36 の新規ファイル（`updater.ts`・`UpdaterSection.tsx`・`sync-version.mjs`）に起因する指摘はゼロ

#### 残りの手動確認項目

- GitHub Secrets（`TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`）の登録
- `desktop-v<version>` タグを打っての実ビルド（`release-desktop.yml` の実走）
- ビルドされたインストーラでの、インストール〜起動〜自動更新の一連の流れの確認（開発機以外の実機が必要）

---

### Phase 37: デスクトップ固有UX（約3日）🔨 実装済み（確認中）

**目標**: 「ネイティブアプリらしさ」を足す。

> 参照: `docs/desktop/platform-integration.md` §3.4〜3.7。設計からの差分は `docs/desktop/README.md` §3.1-G。

#### タスク
- [x] `.ideamap` 拡張子の OS 関連付け（`bundle.fileAssociations`）を追加し、`tauri-plugin-single-instance` を（他プラグインより先に）登録して2つ目のプロセスの起動引数を既存ウィンドウへ `ideamap://open-map-file` イベントで転送する（`launch.rs`）。起動引数のパスへの `fs` 許可は `grant_fs_access()` が `FsExt::try_fs_scope()` と `tauri::scope::Scopes` の両方に明示的に付与する（ダイアログを介さないため Phase 34 の実行時許可の仕組みが効かないため）
- [x]✅ 起動引数を渡した2つ目のプロセス起動での単一インスタンス化・fsスコープ付与を実機確認（下記「動作確認」参照）。**OSのファイル関連付け経由での実際のダブルクリック起動は未確認**（下記「残りの手動確認項目」参照）
- [x] ファイルのドラッグ&ドロップ受け入れ（`FileDropOverlay.tsx`、`getCurrentWebview().onDragDropEvent`）。`dragDropEnabled` を `false` → `true` に変更
- [x]✅ React Flow のノードドラッグ操作と競合しないことを実機確認（`docs/desktop/README.md` §5「Phase 37 で解消した項目」で #7 を解消）。ドロップハンドラの動作もイベント注入で確認したが、**OSからの実際のドロップ操作は未確認**
- [x]✅ `tauri-plugin-window-state` でウィンドウ位置・サイズを記憶。実機でウィンドウを移動・リサイズして再起動し、復元されることを確認
- [x]✅ 外部でファイルが変更された場合の検知（`externalChange.ts`、ウィンドウ `onFocusChanged` 時に `mtime` 比較 → 再読み込み確認ダイアログ）を実機確認
- [x] アプリ内「最近開いたファイル」リスト（**Phase 34 で実装済み**。`FileAdapter.listRecent()` + `DesktopFileDashboard`）。OSの「最近使った項目」統合は本フェーズでも未着手のまま（任意項目）
- [x] エクスポート（JSON/画像/Markdown）を `dialog.save()` ＋ `fs` 書き込みに変更（**Phase 34 で実装済み**。`FileAdapter.exportBlob`）
- [x]✅ 共有URL機能の代替案内（`ExportImportPanel` の共有タブを「JSONファイルとして共有」の案内に変更。タブ自体は隠さない）を実機確認

**完了条件**: エクスプローラから `.ideamap` をダブルクリックでアプリが開く。ドラッグ&ドロップでマップを読み込める。前回のウィンドウ位置・サイズで起動する。

上記のうち「エクスプローラからの実際のダブルクリック起動」「エクスプローラから実際にファイルを掴んでのドロップ操作」「macOS の `RunEvent::Opened` 経路」は未実施のため、完了条件は実装面・CDPによるシミュレーション確認でのみ満たしている。詳細は「残りの手動確認項目」を参照。

#### 実装時の判断（設計ドキュメントからの差分）

`docs/desktop/README.md` §3.1-G に表としてまとめた。要点のみ再掲する。

| # | 事項 | 判断 |
|---|---|---|
| 1 | `.ideamap` 関連付け + single-instance | `bundle.fileAssociations` で `.ideamap` を登録。`tauri-plugin-single-instance` を**最初に**登録し、2つ目のプロセスの引数を既存ウィンドウへ転送する。`launch.rs` が起動引数からマップファイルらしきパス（`.ideamap`/`.json`、`-` 始まりのオプションは除外、先頭の実行ファイル自身は飛ばす）を1つ選び `PendingLaunchFile` に保持し、フロントは `take_launch_file` コマンドで1回だけ取り出す。2つ目のインスタンスからは `ideamap://open-map-file` イベントで届く。macOS は起動引数ではなく `RunEvent::Opened` で届くため、`run(context)` ではなく `build()` + `run(closure)` に変更した（**macOS 実機は未検証**） |
| 2 | 起動引数のパスへの fs スコープ付与 | capabilities の `fs:scope` はアプリ専用ディレクトリのみで、ユーザーが選んだパスは dialog プラグインが実行時に許可を足す設計（Phase 34 の裁定）。**ダブルクリック起動は dialog を通らないため**、`launch.rs` の `grant_fs_access()` が `FsExt::try_fs_scope()` と `tauri::scope::Scopes` の両方に `allow_file()` を明示的に呼ぶ。これが無いと `forbidden path` で読み込みに失敗する。**ドラッグ&ドロップは Tauri 本体が Drop イベント処理の中で同じ許可を出すため不要**（`tauri` 2.11.5 の `manager/webview.rs` の `DragDropEvent::Drop` 分岐で確認済み） |
| 3 | ドラッグ&ドロップ | `dragDropEnabled` を `false` → `true` に変更。`FileDropOverlay.tsx` が `onDragDropEvent` を購読し、ドラッグ中はオーバーレイを表示。`.ideamap`/`.json` 以外は案内トースト、未保存の変更があるときは確認ダイアログを挟む |
| 4 | ウィンドウ状態の記憶 | `tauri-plugin-window-state` を追加。Rust側だけで完結し JS からは呼ばないため capability の追加は不要。`WindowEvent::CloseRequested`/`Moved`/`Resized` と `RunEvent::Exit` で保存する。`SystemAdapter.onBeforeExit` の `window.destroy()` 経路でも `RunEvent::Exit` は発火するため保存される |
| 5 | 外部ファイル変更の検知 | `externalChange.ts` が `onFocusChanged` を購読し、前面復帰時に `FileAdapter.getMetadata()` で mtime を取り直す。**初回は基準の記録のみでダイアログを出さない**（開いた直後の誤検知防止）。基準は `max(記録した mtime, uiStore.lastSavedAt)` に `MTIME_TOLERANCE_MS`（2000ms）を足したもの。超えたときだけ確認ダイアログを出し、未保存の変更があれば文言を変え `danger: true` にする。**「キャンセル」を選んでも基準を進め、同じ内容で繰り返し尋ねない**。ファイルシステム監視（`notify` crate）は初期リリースにはオーバースペックとして見送り（`platform-integration.md` §3.7） |
| 6 | 共有URLの代替案内 | `ExportImportPanel` は `onGenerateShareUrl` が未指定でも「共有」タブ自体は隠さず、「JSONファイルとして共有」の案内（JSON書き出しボタン＋なぜ共有URLが無いかの説明）を表示する。Web版の表示は変わらない |

#### 動作確認（デスクトップ実機・CDP + PowerShell・2026-08-08）

`pnpm dev:desktop` を `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222` 付きで起動し、Playwright を CDP でアタッチして検証した。検証スクリプトは確認後に削除済み。

- [x]✅ React Flow のノードドラッグが `dragDropEnabled: true` でも効く（140,84 px 移動）
- [x]✅ WebView 内の HTML5 `dragstart` が発火する（`PresentationOrderPanel` の並べ替えが依存している）
- [x]✅ `.ideamap` を引数に付けて2つ目のプロセスを起動 → プロセスは増えず（single-instance が効いている）、動作中のインスタンスがそのファイルを開いた（タイトル「起動引数テスト用マップ」・ノード3件）。このファイルは `fs:scope` の外にあり dialog も通していないため、`grant_fs_access()` が効いていることの確認になる
- [x]✅ ウィンドウを (200,120) 1180x760 に動かして閉じ、再起動すると同じ位置・サイズで復元された
- [x]✅ 外部ファイル変更の検知: ①1回目のフォーカス復帰ではダイアログが出ない（基準の記録のみ）②外部からファイルを書き換えて2回目のフォーカス復帰で「ファイルが外部で変更されています」ダイアログが出る ③「読み込み直す」でタイトルとノード数が更新される（3件→4件）④3回目のフォーカス復帰では再度尋ねない
- [x]✅ ドロップ処理: Tauri の drag-drop イベントを webview に注入して `FileDropOverlay` のハンドラを検証。ドラッグ中にオーバーレイが出て、ドロップで消える。対象外の拡張子では案内トーストが出る。fs スコープ済みのファイルをドロップするとそのマップが開く。**ただし OS からの実ドロップ経路（実際にエクスプローラからファイルを掴んで落とす）は CDP から再現できないため未検証**
- [x]✅ 設定パネルの「アプリ情報」にバージョン 0.1.0 が出て、「更新を確認」が結果を返す（リリース未公開のため「更新の確認に失敗しました: Could not fetch a valid release JSON from the remote」。これは想定どおり）
- [x]✅ 共有タブが「JSONファイルとして共有」の案内になっている
- [x]✅ 全工程で console error / pageerror がゼロ
- [x]✅ `cargo test`（`launch.rs`）— 引数パースのユニットテスト4件が通過
- [x]✅ `pnpm typecheck` 通過。`pnpm lint` は 16 problems（13 errors・3 warnings）で Phase 36 と同数・すべて既存ファイル由来

#### Web版に影響が出ていないことの確認（`pnpm dev` + Edge・2026-08-08）

`ExportImportPanel` は Web版と共通のコンポーネントなので、共有タブの変更が Web版の挙動を変えていないことを別途確認した。

- [x]✅ 共有タブに従来どおり「共有リンクを生成」が出る（「JSONファイルとして共有」の代替案内は出ない）
- [x]✅ 「共有リンクを生成」で実際に `?map=...` 付きの共有URLが生成される
- [x]✅ 設定パネルに「アプリ情報」セクションが出ない（`settingsExtraSections` はデスクトップ版のみ）
- [x]✅ console error / pageerror がゼロ

#### 残りの手動確認項目

- エクスプローラから実際に `.ideamap` をダブルクリックしての起動（インストーラを入れて拡張子を OS に登録する必要があるため、`pnpm dev:desktop` では確認できない）
- エクスプローラから実際にファイルを掴んでウィンドウへドロップする操作
- macOS の `RunEvent::Opened` 経路（macOS 実機が未入手）
- OSの「最近使った項目」「ジャンプリスト」統合（未解決事項 #8・任意項目のため未着手）

---

### Phase 38: デスクトップ版 Google Drive 連携（約3日）🔨 実装済み（確認中）

**目標**: デスクトップ版からも Google Drive 同期を使えるようにする。

> 参照: `docs/desktop/platform-integration.md` §3.8。Google は組み込みWebViewからの OAuth を `disallowed_useragent` でブロックするため、Web版の GIS ポップアップ方式は使えない。設計からの差分は `docs/desktop/README.md` §3.1-H。

#### タスク
- [x]✅ **Google Cloud Console で「デスクトップアプリ」種別の OAuth クライアントIDを新規発行**（コードでは完結しない開発者の手作業。手順は `docs/desktop/platform-integration.md` §3.8 の「Google Cloud Console 側の設定手順」。2026-08-09 に発行・`apps/desktop/.env` へ設定し、実機でのサインインまで確認済み）
- [x] ループバックサーバ（`http://127.0.0.1:<port>`）＋ PKCE によるOAuthフローを実装（`src-tauri/src/oauth.rs`。`std::net::TcpListener` の自前実装で、`tauri-plugin-oauth` は使わない）
- [x] `opener` プラグインで OS 既定ブラウザに認可URLを開く（`main-window` capability の `opener:allow-open-url` が `https://*` を許可済みのため追加変更なし）
- [x] 取得したリフレッシュトークンを OSキーチェーンに保存（`SecretAdapter` の `googleRefreshToken` スロット。既存の汎用コマンド4本をそのまま使うため Rust 側の追加は不要）
- [x] `googleDriveService.ts` を `packages/core/src/services/driveService.ts` に移し、Web/Desktop 双方から使えるようにする（`fetch` → `HttpAdapter.request`、`FormData`/`Blob` → `multipart/related` の手組み）
- [x] `useGoogleAuth` の消費インタフェース（`isSignedIn`/`accessToken`/`signIn`/`signOut`/`userEmail`/`silentReauth`/`clientIdMissing`）を保ったまま、デスクトップ用に `useDesktopGoogleAuth` として別実装（Web版の `useGoogleAuth` は無変更）
- [x] デスクトップ版 `FileAdapter` を `FileRef.origin` で Drive とローカルに振り分ける複合アダプタ化。`uiStore` に `currentFileOrigin` を追加し `currentFileId` と対で永続化
- [x] 起動画面に Google ドライブ欄を追加（`DriveSection.tsx`。接続・一覧・開く・「いま開いているマップをドライブに保存」）
- [x] `docs/desktop/README.md` §3.1 の裁定を「デスクトップも Drive 対応」に更新（§3.1-H に設計判断12項目、§5 に未検証事項 #11〜#13 を追加）

**完了条件**: デスクトップ版から Google サインインでき、Web版と同じマップを開いて保存できる。

**現状**: **認可フローは 2026-08-09 に実機で疎通した**（クライアントID／シークレットを発行 → OS既定ブラウザで認可 → ループバックで受領 → Drive へアクセスできることを確認）。ここで `client_secret` が必須であることが判明し、実装と設計ドキュメントを修正している（下記「実装時の判断」#4）。

ただし**完了条件はまだ未達**。疎通で通ったのは認証と GET 系（マップ一覧の取得）までで、**書き込み経路（`multipart/related` の手組みアップロード）は未確認**。マップ一覧の表示は GET だけで成立し、`IdeaMap` フォルダの作成も素の JSON POST なので、これらが通ってもアップロードの検証にはならない。下記「残りの手動確認項目」を参照。

#### 実装時の判断（設計ドキュメントからの差分）

`docs/desktop/README.md` §3.1-H に表としてまとめた。要点のみ再掲する。

| # | 事項 | 判断 |
|---|---|---|
| 1 | ループバックサーバの実装 | `tauri-plugin-oauth` を使わず自前（`oauth.rs`）。必要なのは「1本の GET のクエリを読む」ことだけで、プラグインを足すと4点セット（JS依存・Rust依存・`lib.rs` 登録・capability）の保守が増える。自作コマンドは capability の管轄外なので `keychain.rs` と同じ構成に収まる |
| 2 | PKCE の `code_challenge` | Rust 側で計算（`sha2` + `base64` を追加）。`crypto.subtle` はセキュアコンテキストでしか使えず、Tauri の WebView でそれが保証されるかを実測していないため。`code_verifier`/`state` の生成は制約のない `crypto.getRandomValues` で JS 側 |
| 3 | `access_type=offline` | **送らない。** Google 公式が installed app について「リフレッシュトークンは常に返る」と明記しており、認可パラメータ表にも存在しない。Web server フロー向けの知識を持ち込まない |
| 4 | `client_secret` | **必須**（`VITE_GOOGLE_DESKTOP_CLIENT_SECRET`）。当初は「PKCE 併用時は省略可」と判断していたが、実機で 400 `invalid_request` "client_secret is missing." が返って覆った。公開クライアントなので機密ではなく、防御は PKCE が担う |
| 5 | `redirect_uri` | `http://127.0.0.1:<port>`。`localhost` はファイアウォールで弾かれうると Google 公式が明記しているため使わない。ポートは毎回 OS から借りる（事前登録不要） |
| 6 | メールアドレス | スコープに `openid email` を足し ID トークンの `email` クレームから読む。Web版のように `userinfo` を叩かないので HTTP 許可が1つ減る |
| 7 | アップロード | `FormData`/`Blob` をやめ `multipart/related` を文字列で手組み。plugin-http への `FormData` の挙動が未検証なのに対し、文字列ボディは両アプリで同じ経路を通る。**Web版の保存経路も同時に変わる** |
| 8 | 保存先の判別 | `uiStore.currentFileOrigin` を追加し `currentFileId` と対で永続化。`FileAdapter.origin` の意味が「唯一の保存先」から「未指定時の既定」に変わった |
| 9 | 既定の保存先 | ローカルのまま。`saveFileAs`（Ctrl+S の新規保存）はネイティブ保存ダイアログ。Drive へ上げるのは起動画面からの明示操作だけ |
| 10 | CSP | **変更しない。** `HttpAdapter` 経由は Rust 側の plugin-http が発行するため WebView の CSP を通らない。Phase 35 の Anthropic API が `connect-src` 未記載で動いている実績が裏付け。許可は capability（`google-drive.json`）だけ |
| 11 | 設定（`settings.json`）の Drive 同期 | スコープ外。デスクトップ版はマスターパスワードを持たない一方、Drive の `settings.json` は暗号化が前提のため。`setAppSettingsSync()` は未注入のまま |
| 12 | `clearDriveCache()` | settings.json の fileId キャッシュも一緒に消すよう修正した。移設前は `clearSettingsCache()` がどこからも呼ばれておらず、アカウント切替時に前アカウントの fileId が残る状態だった |
| 13 | 設定パネルの `DriveSyncSection` | `showCloudSync`（＝`cloudAuth` の有無）に `SecretAdapter.isPassphraseFree` が false という条件を足した。デスクトップ版に `cloudAuth` を渡した副作用で「マスターパスワード & Drive同期」欄が出てしまい、押すと `setAppSettingsSync` 未注入で失敗するため。#11 と対の変更 |
| 14 | ヘッダーの保存先表示 | `isSignedIn && currentFileId` に `currentFileOrigin === 'cloud'` を足した。デスクトップ版はサインイン中にローカルファイルを開いている状態がありえ、そのままだと「Drive」と誤表示するため |

#### 検証（2026-08-09）

- [x]✅ `cargo test --lib` — 13件通過。うち Phase 38 分は9件で、内訳は RFC 7636 の PKCE 検証ベクタとの一致、認可コードのパーセントデコード（`4%2FabC` → `4/abC`）、リクエストライン解析、そして**実ソケット往復4件**（認可コード受領で 200 と完了ページを返す／`state` 不一致は 400 で捨てる／`/favicon.ico` では待機を続ける／`error=access_denied` をエラーとして返す）
- [x]✅ `pnpm typecheck` 通過
- [x]✅ `pnpm build`（Web版）・`pnpm --filter @ideamap/desktop build`（デスクトップ版フロントエンド）ともに成功
- [x]✅ `pnpm lint` — 16 problems（13 errors・3 warnings）。Phase 36・37 と同数で、すべて既存ファイル由来。Phase 38 の新規ファイルに起因する指摘はゼロ

#### 実機での確認（デスクトップ実機・2026-08-09）

- [x]✅ 「デスクトップアプリ」種別の OAuth クライアントID／シークレットの発行と `apps/desktop/.env` への設定
- [x]✅ 実機でのサインイン（OS既定ブラウザで認可画面が出る → `http://127.0.0.1:<port>` に戻る → アプリがサインイン済みになる → Drive へアクセスできる）。ループバックサーバ・PKCE・トークン交換・`opener` 経由の外部ブラウザ起動が一通り通ったことになる
- [x]✅ `client_secret` が必須であることが判明（省略時は 400 `invalid_request` "client_secret is missing."）。実装・`.env.example`・設計ドキュメントを修正済み

#### 残りの手動確認項目

- [x]✅ **デスクトップ版 Drive の実機認可（2026-08-17 ユーザー実機確認済み）**

**サインインは通ったが、通ったのは認証と GET 系まで。** マップ一覧の取得は GET だけ、`IdeaMap` フォルダの作成も素の JSON POST で成立するため、**書き込み経路はまだ一度も通っていない**。

- **`multipart/related` の手組みボディを Drive API が受け付けること（未検証事項 #11、最優先）。** 具体的には ①Drive のマップを開いて編集し自動保存が戻る（`PATCH`）②「いま開いているマップをドライブに保存」で新規作成される（`POST`）の2経路。**Web版の保存経路も同じ実装に変わったため Web版でも要確認**
- Drive のマップを開いた後、ヘッダーの保存先表示が「Drive」になり、ローカルファイルを開いたときは「ローカル」に戻ること
- アプリ再起動後にキーチェーンからサインイン状態が復元されること
- サインアウトで Google 側の許可が取り消され、Drive のマップを開いていた場合に保存先が外れること
- OAuth 同意画面を「本番環境」に切り替えないと、リフレッシュトークンが7日で失効すること（未検証事項 #13）

#### Web版に影響が出ていないことの確認（未実施）

Phase 38 は共通コード（`packages/core` / `packages/ui`）にも手を入れているため、**Web版の回帰確認が別途要る**。デスクトップ版のクライアントID発行を待たずに実施できる。

- [ ] マップの保存が従来どおり動く（**アップロードが `FormData` から `multipart/related` 手組みに変わっているため最重要**）。新規作成・上書き保存・タイトル変更のいずれも
- [ ] 設定パネルに「マスターパスワード（ローカル暗号化 & Drive同期）」欄が従来どおり出る（`isKeychainBacked` 条件を足したため）
- [ ] ヘッダーの保存先表示が Drive ファイルで「Drive」のままである（`currentFileOrigin` 条件を足したため）
- [ ] Phase 38 以前から使っているブラウザで、前回開いていた Drive ファイルへの保存が継続する（`restoreCurrentFileId` が origin 無しの永続値を `FileAdapter` の既定に寄せる挙動）
- [ ] マップ一覧・起動ダッシュボードからの読み込み・削除
- [ ] 設定の Drive 同期（保存・読み込み）
- [ ] console error / pageerror がゼロ

#### 追加実装: ヘッダーからの保存先切り替え導線（2026-08-09）

**目標**: 保存先（ローカル/Drive）を切り替える導線が起動画面の Drive 欄にしかなく、編集中の画面から見つけられなかったため、ヘッダーの「接続済み」メニューに双方向の切り替えを追加する。

##### タスク（ローカル→Drive）
- [x] `apps/desktop/src/saveToDrive.ts` を新規実装。`DriveSection.tsx` の `handleUpload` にインラインで書かれていた保存処理（`buildMapFile` → `saveMap` → `setCurrentFileId(fileId, 'cloud')`）を `saveCurrentMapToDrive(accessToken)` として切り出し、`DriveSection.tsx` はこれを呼ぶだけにした（`hasActiveMap` が `false` のときは何もしないガード込み）
- [x] `packages/ui` の `Header` に `onSaveToCloud?: () => void` を追加。「接続済み」ドロップダウンメニューに「このマップをドライブに保存」項目を追加（`onSaveToCloud` が指定され、かつ `currentFileOrigin !== 'cloud'` のときだけ表示）
- [x] `packages/ui` の `Header` に `showMapList?: boolean`（既定 `true`）を追加。デスクトップ版は `mapListSlot` を持たず、モバイル用アイコンボタンと「マップ一覧」メニュー項目が押しても何も起きない死んだ項目になっていたため、`App` が `showMapList={mapListSlot != null}` を渡して隠す（`AppProps` には足していない。`App` が持っている情報から算出できるため）
- [x] `apps/desktop/src/DesktopApp.tsx` から `onSaveToCloud={accessToken ? () => void saveCurrentMapToDrive(accessToken) : undefined}` を渡す配線を追加

##### タスク（Drive→ローカル。続く追加実装）
- [x] `apps/desktop/src/saveToLocal.ts` を新規実装。`saveCurrentMapToLocal()` が `buildMapFile(mapId)` を `getPlatform().file.saveFileAs(content, mapTitle)` に渡す。ネイティブ保存ダイアログの表示・ファイル書き込み・最近開いたファイルへの記録は既存の `desktopFileAdapter.saveFileAs`（`apps/desktop/src/platform/file.desktop.ts`）がすでに担うため、ここが追加でやるのは返ってきた `FileRef` で `setCurrentFileId(ref.id, ref.origin)` して以後の自動保存を切り替えるところだけ。`saveFileAs` が `null`（ダイアログのキャンセル）を返したときは失敗扱いにせず保存先も変えない。`hasActiveMap` が `false` のときは何もしない（`saveCurrentMapToDrive` と同じガード）
- [x] `packages/ui` の `Header`/`AppProps` に `onSaveToLocal?: () => void` を追加。「接続済み」メニューに「このマップをローカルに保存」項目を追加（`onSaveToLocal` が指定され、かつ `currentFileOrigin === 'cloud'` のときだけ表示）。表示条件が「このマップをドライブに保存」と逆なので、メニューには常にどちらか一方だけが出る
- [x] `apps/desktop/src/DesktopApp.tsx` から `onSaveToLocal={() => void saveCurrentMapToLocal()}` を渡す配線を追加。`onSaveToCloud` と異なりネイティブダイアログのみで完結するため `accessToken` に依存しない

**完了条件**: 型検査・ビルドが通過すること。ヘッダーからの保存先切り替え（両方向）の実機動作確認は別途行う。

##### 検証（2026-08-09、両方向とも同じセッションで確認）
- [x] `pnpm typecheck` 通過
- [x] `pnpm build`（Web版）・`pnpm --filter @ideamap/desktop build`（デスクトップ版フロントエンド）ともに成功

##### 残りの手動確認項目
- ヘッダーの「接続済み」メニューから「このマップをドライブに保存」を押し、ローカルのマップが Drive に保存されて以後の自動保存が Drive に向くこと（Phase 38 本体の Drive 書き込み経路の実機確認と合わせて行う）
- ヘッダーの「接続済み」メニューから「このマップをローカルに保存」を押し、保存ダイアログが出て、保存後は以後の自動保存がそのローカルファイルに向くこと。保存ダイアログをキャンセルした場合は保存先が変わらないこと
- Drive のマップを開いている間は「このマップをドライブに保存」ではなく「このマップをローカルに保存」だけが出ること（ローカルのマップを開いている間はその逆）
- デスクトップ版でヘッダーとモバイル用アイコンの「マップ一覧」項目が出ないこと。Web版では従来どおり出ること（回帰確認）

#### バグ修正: 本番ビルドから Ollama にアクセスできない（2026-08-09）

**症状**: `pnpm dev:desktop` では Ollama（`http://localhost:11434`）に到達できるが、`pnpm build:desktop` で作ったインストーラから入れたアプリでは「Ollamaがエラーを返しました（HTTP 403）」になる。

**原因**: `tauri-plugin-http` は webview の URL を `Origin` ヘッダとして毎リクエストに自動付与する。開発時の webview オリジンは `devUrl`（`http://localhost:5174`）で Ollama の既定 CORS 許可に収まるが、本番ビルドの webview オリジンは Windows では `http://tauri.localhost` になり既定許可に含まれず 403 が返る。実 Ollama への curl 検証で `Origin: http://tauri.localhost` → 403、`Origin: http://localhost:5174` → 200、Origin なし → 200 を確認した。「デスクトップ版は Rust 経由なのでブラウザの CORS 制約を受けない」という従来の説明は不正確で、正しくは「Origin ヘッダを送っていないから通る」だった（訂正は `docs/desktop/README.md` §3.3、`docs/desktop/llm-abstraction.md` §6.4、`docs/desktop/platform-integration.md` §5.2）。

##### タスク
- [x]✅ `apps/desktop/src-tauri/Cargo.toml` の `tauri-plugin-http` に `features = ["unsafe-headers"]` を追加（無いと JS 側から渡した `Origin` ヘッダが fetch 仕様の禁止ヘッダとして Rust 側で黙って捨てられる）
- [x]✅ `apps/desktop/src/platform/http.desktop.ts` に `withoutOrigin()` ヘルパーを追加し、`canReach` / `request` / `getFetch` の3経路すべてで `Origin: ''`（空文字）を送るようにした。plugin-http は空文字の `Origin` をヘッダごと削除する仕様のため、結果としてデスクトップ版の全 HTTP リクエストから `Origin` が消える

**完了条件**: デスクトップ版の本番ビルド（インストーラ経由でインストールしたアプリ）から Ollama の各エンドポイント（`/api/tags` 等）に到達できること。

**検証状況（2026-08-09）**: 原因の特定は実 Ollama サーバーへの curl 検証で行った（上記3パターン）。修正後は `pnpm typecheck` 通過・`pnpm build:desktop` 成功（msi / nsis の2バンドル生成）。本番ビルドの `target/release/ideamap-desktop.exe`（webview オリジンは本番と同じ `http://tauri.localhost`）を起動し、Ollama 側の `%LOCALAPPDATA%\Ollama\server.log` で `/api/version`・`/api/tags`・`/api/ps` がいずれも **200** で記録されることを確認した（修正前の同ログには同じ `/api/tags` が 403 で記録されていた）。インストーラから入れ直したアプリでの確認は同一バイナリのため省略。

---

### Phase 39: OpenAI プロバイダ対応 🔨 実装済み（確認中）

**目標**: LLMプロバイダに Claude・Ollama に続く3つ目として OpenAI を追加し、OpenAI の APIキーを持つユーザーにも対応する。

> 参照: `docs/desktop/llm-abstraction.md` §3.5、`docs/desktop/README.md` §3.1-I。

#### タスク
- [x] `OpenAIProvider`（`packages/core/src/llm/openaiProvider.ts`）を新規実装。`POST https://api.openai.com/v1/chat/completions` を呼ぶ。`listModels()` は `GET /v1/models` から動的取得し、IDのプレフィックス（`gpt-`/`o\d`）判定と除外パターンでチャット用モデルだけに絞り込む
- [x] 出力トークン数指定を `max_tokens` ではなく `max_completion_tokens` に統一（`max_tokens` は非推奨かつ reasoning 系モデルと非互換のため）
- [x] `completeJson` は `response_format: { type: 'json_object' }` を使用。`capabilities.structuredOutput` は `'prompt-only'`
- [x] reasoning 系モデルが `temperature` 指定で 400 を返す問題への対応として、HTTP 400 かつ `temperature`/`response_format` を含むリクエストのときだけそれらを外して1回だけ再送するフォールバックを実装（`OllamaProvider` の `think` フォールバックと同方式）
- [x] ストリーミング（SSE、`data: {...}` 行 / `data: [DONE]` 終端、`choices[0].delta.content` が差分）を実装
- [x] `packages/core/src/types/index.ts` の `LLMProviderId` に `'openai'` を追加
- [x] `AIModelSelection` 型と `settingsStore.getActiveModelSelection()` を削除（どこからも呼ばれていないデッドコードだったため）
- [x] `LLMError.provider` / `LLMProvider.id` にハードコードされていた `'claude' | 'ollama'` の union を `LLMProviderId` の import に統一（二重定義の解消）
- [x] `settingsStore` に `openaiApiKey`（`SecretAdapter` 管理・非永続）・`openaiModel`（永続化）を追加。`storeProviderSecret()` ヘルパーで Claude 以外のプロバイダの秘密情報の保存先選択（OSキーチェーン／マスターパスワード暗号化／メモリのみ）を共通化
- [x] `initApiKey` / `unlockApiKey` / `setMasterPassword` を Claude・OpenAI 両キー対応に拡張（Claudeキーが無くても OpenAI キーだけ保管されている場合があるため、両方の有無を見てから解錠を促す）
- [x] `providerFactory.ts`（`ProviderSettings` / `getActiveProvider` / `isProviderReady`）と `packages/ui/src/hooks/useActiveProvider.ts` を OpenAI 対応に更新
- [x] `ApiKeyRequired` を `isOllama` の二値分岐から `Record<LLMProviderId, {...}>` の文言テーブルに変更（プロバイダ追加時の文言追加漏れを型エラーで検出できるようにした）
- [x] Web版のキー保管（`apps/web/src/utils/encryption.ts` / `apps/web/src/platform/secret.web.ts`）を論理キー別に一般化。Claude APIキー（論理キー `'apiKey'`）だけは旧 localStorage キー名（`ideamap-apikey-mp`）を維持し既存ユーザーのデータをそのまま読めるようにした。関数名を `hasStoredSecret` / `setStoredSecretWithPassword` / `getStoredSecretWithPassword` / `clearStoredSecret` に改名（いずれも第1引数に論理キーを取る）
- [x] デスクトップ版 `apps/desktop/src-tauri/capabilities/ai-http.json` の `allow` に `https://api.openai.com/*` を追加（`tauri.conf.json` の CSP は変更なし。plugin-http は Rust 側から発行するため WebView の CSP を通らない）
- [x] 設定UI（`packages/ui/src/components/panels/SettingsPanel.tsx`）にOpenAIセクション（APIキー入力・接続テストによる動的モデル取得・`LLMError.kind` 別のエラー案内）を追加。プロバイダ切り替えUIをデスクトップ限定から全プラットフォーム表示に変更し、Ollamaの選択肢だけ `http.canAccessLocalServers` で出し分けるようにした（`showProviderSwitch` → `canUseOllama` に用途変更）。Claude/OpenAI 共通のAPIキー入力を `ApiKeyField` として切り出して再利用。ollama.com の Web検索セクションはデスクトップ限定のまま維持
- [x] `OpenAIProvider` の自己チェック（`packages/core/verify-openai.mts`、`pnpm check:openai`）を追加。`HttpAdapter` を差し替えて SSEパース（チャンク途中分割・累積・`[DONE]`終端）・400フォールバック（再送は1回だけ）・エラー分類・`listModels` の絞り込み・system プロンプト変換の9項目を検証する。テストランナーは導入せず `node:assert` と既存の `jiti` のみで動く

#### 調査結果（設計判断）
- **api.openai.com は CORS を許可している**。preflight を実測すると `Access-Control-Allow-Origin` にリクエスト元 Origin をそのままエコーし、`access-control-allow-headers: authorization,content-type` / `access-control-allow-methods: GET, OPTIONS, POST` を返す。Ollama と異なり、Web版のブラウザからも `HttpAdapter` 経由で直接呼び出せる
- **GitHub Copilot（GitHub Models）対応は見送った**。当初 `models.github.ai` を OpenAI 互換エンドポイントとして実装する方針だったが、GitHub Models は2026年7月30日に完全終了しており、実際にエンドポイントを叩くと `{"error":{"code":"github_models_retirement_brownout", ...}}` が返る。Copilotには他に公開APIが無く、`api.githubcopilot.com` はIDE用の内部APIで公開仕様が無いため採用しない

**完了条件**: 型検査・ビルドが通過し、OpenAIプロバイダでAI機能5種（アイデア提案・AIチャット・マップ分析・接続提案・クラスタ提案）が動作すること。

**現状**: 設定UIを含めてコード実装は完了し、`pnpm typecheck` / `pnpm build` / `pnpm check:openai`（自己チェック9項目）を通過している。`pnpm lint` はリポジトリ既存の13件のエラーが残るが、今回追加・変更したファイルからの指摘は無い。実機での疎通確認は未実施。

#### 残りの手動確認項目
- [x]✅ **OpenAI 実キーでの疎通（2026-08-17 ユーザー実機確認済み）**
- 実際のOpenAI APIキーでのアイデア提案・AIチャット・マップ分析・接続提案・クラスタ提案の動作確認
- 既定モデル `gpt-5.1` が実在するIDか（実キーでの `GET /v1/models` で確認する。無効なら `DEFAULT_OPENAI_MODEL` を差し替える）
- `listModels()` の絞り込み条件が、実際の `/v1/models` の一覧に対して妥当か（チャット用モデルの取りこぼし・不要なモデルの混入）
- reasoning系モデル（o-シリーズ等）で `temperature` 指定時の400エラー→フォールバック再送が実際に機能すること
- Web版ブラウザからの直接呼び出し（CORS許可）が実機で機能すること
- デスクトップ版から `https://api.openai.com` への到達確認（capability追加後）
- 設定UIでのプロバイダ切替・接続テスト・モデル取得のE2E確認
- Web版のキー保管の一般化（`encryption.ts`／`secret.web.ts`）による、既存ユーザーの Claude APIキーの読み込み継続（旧localStorageキー名を維持しているための回帰確認）
- Web版で Claude と OpenAI の両方のキーを保管したときの、マスターパスワードによる一括解錠（`unlockApiKey`）

---

### Phase 40: ドラッグ&ドロップ接続 🔨 実装済み（確認中）

**目標**: ノードをドラッグして別ノードに重ねてドロップするだけでエッジを作成できるようにする。ハンドルドラッグ・接続モードに続く3つ目のエッジ作成手段。

#### タスク
- [x] `packages/core/src/stores/uiStore.ts` に `dragOverNodeId` / `setDragOverNodeId` を追加（`dragOverGroupId` と同様の一時UI状態）
- [x] `packages/core/src/stores/map/edgeSlice.ts` に `connectDroppedNode(sourceId, targetId, returnPosition)` を実装。エッジ追加とドラッグしたノードの位置を開始位置へ戻す処理を1回の `set` にまとめ、`sourceId === targetId` または既に接続済み（向き問わず）なら何もしない
- [x] `packages/core/src/stores/map/nodeSlice.ts` の `onNodesChange` を修正し、`uiStore.dragOverNodeId` が立っている間はドロップ位置でのグループ出入り判定（「グループに追加」ダイアログ・押し出し）をスキップする（位置は直後に開始位置へ戻されるため）
- [x] `packages/ui/src/components/canvas/IdeaCanvas.tsx` に `handleNodeDragStart`（開始位置を記録）・`handleNodeDrag`（ドラッグ中のノード中心が未接続の別 `ideaNode` に重なっているかを判定しハイライト、複数選択ドラッグとグループノードは対象外）・`handleNodeDragStop`（重なっていれば `connectDroppedNode` を呼びエッジ作成＋位置を戻す）を実装し、`<ReactFlow>` に `onNodeDragStart` を追加
- [x] `packages/ui/src/components/canvas/IdeaNode.tsx` に `isDropTarget`（`dragOverNodeId === id`）による緑リング（`outline: 3px solid #10b981`）のハイライト表示を追加
- [x] ドロップ成功時にトースト「接続しました」を表示
- [x] エッジの向きを「重ねられた側（親）→ ドラッグした側（子）」に変更（新しいアイデアを作って親に重ねる操作が自然なため）
- [x] ドロップ先ノードの上に `NodeToolbar` でガイドツールチップ「ドロップでこのアイデアを親にして接続」を表示
- [x] Undo/Redo: React Flow が発火する `onNodesChange`（`dragging: false`）→ `onNodeDragStop` の順を利用し、前者が積んだドロップ直前のスナップショットに `connectDroppedNode`（`pushPast` なし）を相乗りさせることで、Undo 1回でエッジ作成と位置戻しをまとめて取り消せるようにした
- [x] `docs/design.md`・`docs/requirements.md` を更新

**完了条件**: 型検査・ビルドが通過し、ノードを別ノードにドラッグ&ドロップするとエッジが作成され、ドラッグしたノードが開始位置に戻ること。

#### 残りの手動確認項目
- 未接続のノード同士をドラッグ&ドロップしてエッジが作成され（矢印は重ねられた側→ドラッグした側）、ドラッグしたノードが開始位置に戻ること
- 重なっている間、相手ノードの上にガイド「ドロップでこのアイデアを親にして接続」が表示され、離れると消えること
- 既に接続済みの相手（順方向・逆方向・双方向）にドロップしても、エッジが増えず通常の移動として位置が確定すること
- 複数選択した状態でのドラッグでは、ハイライト・エッジ作成が発生しないこと
- グループノード同士、およびグループの子ノードを絡めたドラッグで意図しない動作がないこと（接続先ノードに重なっている間はグループへの出入り判定が抑制されること）
- ドロップ後の Undo 1回で、エッジ作成とノード移動の両方がまとめて取り消されること
- トースト「接続しました」が表示されること

---

### Phase 41: テスト基盤の導入（Vitest）（約3日）🔨 実装済み（確認中）

**目標**: `packages/core` にユニットテストを整備し、既存の手動検証スクリプト（`packages/core/verify-openai.mts` / `packages/core/verify-radial-layout.mts`）を Vitest に一本化する。CI（`.github/workflows/deploy.yml` / `.github/workflows/release-desktop.yml`）にテスト実行を組み込み、テストが赤ならデプロイ・リリースが止まるようにする。v1.0（信頼できる土台）の柱の一つ（`docs/roadmap.md` §3.2）。

#### Step1: Vitest 導入
- [x] ルートではなく `packages/core/package.json` の `devDependencies` に `vitest` を追加し、`"test": "vitest run"` スクリプトを定義した。ルート `package.json` の `scripts` には `"test": "pnpm -r run test"` を追加し、`test` スクリプトを持つワークスペースだけを再帰実行する形にした（`packages/ui`・`apps/*` は未整備のため現状は `packages/core` のみが実行される）（2026-08-17 実装）
- [x] `vitest.config.ts` はリポジトリルートではなく `packages/core` 配下に作成した。`test.include` は `src/**/*.test.ts`、`test.environment` は `'node'`（`packages/core` は DOM に依存しない純粋ロジックのみのため）。テストファイルは `describe`/`it`/`expect` を `vitest` から明示 import する方針とし、`globals: true` は設定していない（2026-08-17 実装）

#### Step2: mapStore（Undo/Redo・各スライス）のテスト
- [x] スライスごとのファイル分割ではなく `packages/core/src/stores/mapStore.test.ts`（16件）＋ `mapSnapshot.test.ts`（2件）の2ファイル構成で作成した。ノード操作（追加・改名・削除と past の積み方、undo/redo 往復）、`onNodesChange` のドラッグ中非履歴／確定時1回積み、エッジ操作（`onConnect`/`deleteEdge`/`connectDroppedNode` のガードと履歴相乗り）、グループ化・解除、`loadFromSerialized`/`reset`/`buildMapFile` をカバー（2026-08-17 実装）
- [x] **このテスト作成中に実バグを発見・修正**: ドラッグ確定時に取るスナップショットが最後の中間位置を捉えており、ノードドラッグ後の Undo が開始位置に戻らなかった。最初の `dragging: true` でドラッグ開始時点のスナップショットを控える方式に修正（`nodeSlice.ts`、コミット facf230）（2026-08-17 修正）

#### Step3: レイアウト計算のテスト（`verify-radial-layout.mts` の移植）
- [x] `packages/core/src/layout/mapLayout.test.ts`（13件）を作成し、`verify-radial-layout.mts` の全項目（6パターンの木・不均等な枝・孤立ノードで、矩形の非重なり・末端が親から400px以内）を `it.each` で移植。加えて dagre レイアウトの基本性質（ノード数維持・有限座標・rankdir の意味）と空入力・単一ノードの端ケースを追加。`groupGeometry.test.ts`（21件）も作成（2026-08-17 実装）
- [x] `packages/core/verify-radial-layout.mts` とルート `package.json` の `"check:radial"` スクリプトを削除した（2026-08-17 実装）

#### Step4: LLM プロバイダのパース処理のテスト（`verify-openai.mts` の移植）
- [x] `packages/core/src/llm/openaiProvider.test.ts`（13件）を作成し、`verify-openai.mts` の9項目（SSEパース・400フォールバック・エラー分類・`completeJson`・`listModels` 絞り込み・system プロンプト変換など）を移植（2026-08-17 実装）
- [x] `packages/core/verify-openai.mts` とルート `package.json` の `"check:openai"` スクリプトを削除した（2026-08-17 実装）
- [x] `packages/core/src/llm/jsonUtils.test.ts`（5件）を先行作成済み（コミット c24d4b7）
- [x] `packages/core/src/llm/ollamaProvider.test.ts`（17件）を作成。加えて計画になかった `claudeProvider.test.ts`（16件、SDK をモック fetch で検証）と `providerFactory.test.ts`（6件）も作成（2026-08-17 実装）

#### Step5: driveService のリクエスト組み立てのテスト
- [x] `packages/core/src/services/driveService.test.ts`（10件）を作成。PATCH/POST の分岐（fileId あり／なし／mapId 検索ヒット）、`multipart/related` ボディの構造検証、`folderIdCache`/`settingsFileIdCache` のキャッシュ効果と `clearDriveCache()`、401 エラーの伝播を HttpAdapter モックで検証。あわせて `passwordCrypto.test.ts`（8件）・`mapFileCompat.test.ts`（7件）も作成（2026-08-17 実装）

#### Step6: CI 組み込み
- [x] `.github/workflows/deploy.yml` の `build` ジョブに、`pnpm build` の前に `pnpm test` を実行するステップを追加した（テストが赤なら GitHub Pages へのデプロイが止まる）（2026-08-17 実装）
- [x] `.github/workflows/release-desktop.yml` は独立した `test` ジョブを新設せず、既存の `build` ジョブ（`pnpm install --frozen-lockfile` の直後、Tauri ビルドの前）に `pnpm test` ステップを追加する形にした（マトリクスビルド＝macOS 2種＋Windows のジョブごとにテストが再実行されるが、`needs` を増やしてジョブを分けるより変更が小さいため採用。`build` ジョブの `needs` は `verify-version` のまま変更していない）。テストが赤ければ Tauri ビルド・GitHub Release 公開が止まる（2026-08-17 実装、当初案の別ジョブ新設から変更）

#### Step7: ドキュメント更新
- [x] `CLAUDE.md`「開発環境」のコマンド一覧から `pnpm check:openai` の説明を削除し、`pnpm test` を追加した（2026-08-17 実装）
- [x] `docs/design.md` の放射状レイアウト検証の記述（旧 `pnpm check:radial` 参照）と §20 テスト基盤の verify スクリプト記述を Vitest ベースに更新した（2026-08-17 実装）
- [x] `docs/requirements.md` の非機能要件に「自動テストによる品質担保」の記述を追記した（§3.2 ではなく新設の §3.5 保守性・信頼性に配置）（2026-08-17 実装）

**実績**: テスト合計 132 件（12ファイル）が `pnpm test` で通過。型検査・lint への影響なし。

**完了条件**: `pnpm test` がローカルで通過し、`pnpm typecheck`/`pnpm build`/`pnpm lint` に影響がないこと。`verify-openai.mts`・`verify-radial-layout.mts`・対応する `package.json` スクリプト（`check:openai`/`check:radial`）が削除され、CI（`deploy.yml`・`release-desktop.yml`）にテスト実行ステップが追加されていること。

---

### Phase 42: セキュリティ仕上げ（約2日）🔨 実装済み（確認中）

**目標**: v1.0 の品質基盤として、Web版への CSP 追加・依存脆弱性の継続監視・Google OAuth 同意画面の本番公開化を行う（`docs/roadmap.md` §3.3）。

#### A. Web版への CSP 追加（現状デスクトップ版のみ CSP がある）
- [ ] Web版が実際に通信・読み込みしている外部オリジンを実コードから洗い出す。対象: `packages/core/src/llm/claudeProvider.ts`（`@anthropic-ai/sdk` の既定送信先 `api.anthropic.com`）、`packages/core/src/llm/openaiProvider.ts`（`https://api.openai.com`）、`packages/core/src/services/driveService.ts`・`apps/web/src/hooks/useGoogleAuth.ts`（`https://www.googleapis.com`、GIS のトークン取得先 `https://accounts.google.com`）、`apps/web/index.html`（`<script src="https://accounts.google.com/gsi/client">`）。`packages/core/src/llm/webSearch.ts` の `ollama.com`/`docs.ollama.com` はデスクトップ限定機能で Web版からは到達しないため対象外とする根拠も記録する
- [ ] 洗い出した結果を元に `apps/web/index.html` の `<head>` に `<meta http-equiv="Content-Security-Policy">` タグを追加する。`connect-src` は上記で洗い出したオリジンのみに限定し、`script-src` に `https://accounts.google.com` を追加する（GIS スクリプト読み込み用）。`default-src 'self'` を基本とし、`style-src`/`img-src`/`font-src` 等は `pnpm build` の出力（`apps/web/dist`）が実際に何を読み込むか確認しながら決める（デスクトップ版の `apps/desktop/src-tauri/tauri.conf.json` の `csp`/`devCsp` を参考にする）
- [ ] `pnpm build` → `pnpm preview` で CSP 追加後に主要機能（AI提案・AIチャット・Google Drive 連携・GISログイン）がブロックされずに動作することを、ブラウザ開発者ツールの CSP 違反ログで確認する

#### B. 依存脆弱性の継続監視
- [x] `.github/dependabot.yml` を新規作成した。`package-ecosystem: npm`（ディレクトリ `/`、pnpm workspace のルート lockfile を対象）・`cargo`（ディレクトリ `/apps/desktop/src-tauri`）に加え、計画時点になかった `github-actions`（ディレクトリ `/`）も対象に追加した。いずれも週次スケジュールで、minor/patch 更新は1本のPRにグループ化し `open-pull-requests-limit: 5` を設定（`docs/roadmap.md` §3.3 の「Dependabot または `pnpm audit` の CI 組み込み」のうち、追加のCI実行時間を要さずPRベースで継続監視できる Dependabot を採用する）（2026-08-17 実装）

#### C. Google OAuth 同意画面の「In production」化
- [ ] **これはコードで完結しない開発者の手作業である。** Google Cloud Console の OAuth 同意画面設定で公開ステータスを「テスト」から「本番」に変更する。「Testing」のままだとリフレッシュトークンが7日で失効する既知課題（`docs/roadmap.md` §1、本ドキュメント §2「Google Cloud Project 設定」）を解消する
- [ ] 本ドキュメント §2「Google Cloud Project 設定（開発者向け）」に、OAuth 同意画面を本番公開する手順（アプリ情報入力・スコープ確認・Google の審査要否の確認）を追記する

#### ドキュメント更新
- [ ] `docs/design.md` に Web版 CSP の設計判断（許可オリジンの一覧と理由、デスクトップ版 CSP との差分）を追記する
- [ ] `docs/requirements.md` §3.3（セキュリティ）に CSP・Dependabot・OAuth本番化の記述を追記する

**完了条件**: `apps/web/index.html` に CSP メタタグが追加され、`pnpm build` → `pnpm preview` で主要機能が CSP 違反なく動作すること。`.github/dependabot.yml` が追加されていること。OAuth 本番化はユーザーの手作業のため、手順書への追記をもって完了とする（実施自体はユーザー判断で別途行う）。

---

### Phase 43: エラー可視化と性能ベースライン（約3日）🔨 実装済み（確認中）

**目標**: グローバルエラーハンドラでエラーをローカルログ（リングバッファ）に蓄積し、設定パネルからエクスポートできるようにする。500/1000ノードのベンチマークマップで初期描画・ドラッグ・自動整列・Undo の所要時間を計測して記録する（対策は計測後に別フェーズで判断し、本フェーズでは先回りの最適化を行わない）。外部エラー監視サービス（Sentry等）は導入しない方針（`docs/roadmap.md` §3.4、§8）。

#### A. エラーログのローカル蓄積とエクスポート
- [x] `ErrorLogEntry` 型は `packages/core/src/types/index.ts` ではなく `packages/core/src/services/errorLog.ts` 内に定義した（`time`/`source`/`message`/`stack`/`count`。`count` は同一エラーの連続発生を1件に畳むためのフィールドで計画時点にはなかった）（2026-08-17 実装）
- [x] `errorLogStore.ts`（zustandストア）は作らず、`packages/core/src/services/errorLog.ts` にモジュール内メモリキャッシュ＋`StorageAdapter`（キー `ideamap-error-log`、`storage.getItem`/`setItem`/`removeItem`）永続化の関数群（`recordError`/`getErrorLog`/`clearErrorLog`/`exportErrorLog`）として実装した。表示は件数と一覧程度でReact状態として配る必要が薄いと判断し専用ストアは見送った。上限件数は計画の100件ではなく200件（2026-08-17 実装）
- [x] グローバルエラーハンドラは `apps/web/src/main.tsx` / `apps/desktop/src/main.tsx` に個別配線せず、両アプリが共有する `packages/ui/src/App.tsx` の `AppInner` から `packages/ui/src/hooks/useGlobalErrorLog.ts`（`window` の `error`/`unhandledrejection` を購読し `recordError` を呼ぶ）を1箇所で呼ぶ形にした。React のレンダーエラー用 ErrorBoundary は今回のスコープに含めず見送った（捕捉対象は未処理の `window`/Promise エラーのみ）（2026-08-17 実装）
- [x] `packages/ui/src/components/panels/SettingsPanel.tsx` に `ErrorLogSection` を追加した。記録件数が0件のときは非表示。エクスポートは `errorLog.ts` 内の `exportErrorLog()` が `getPlatform().file.exportBlob()` を直接呼ぶ形にした（JSON文字列化ではなくテキスト形式で書き出す）。計画にはなかった「消去」ボタン（`clearErrorLog()`）も追加した（2026-08-17 実装）
- [x] `docs/design.md`・`docs/requirements.md` を更新した（2026-08-17 実装）

#### B. 性能ベースライン計測
- [x] 計画の `scripts/generate-benchmark-map.mjs` ではなく `scripts/bench-core.mts`（`pnpm bench:core`）として実装した。ベンチマップ生成（固定シードの擬似乱数で再現性を確保、`--emit` で `.ideamap` 書き出し）と、ブラウザ外で測れる範囲（自動整列・シリアライズ/パース）の計測を1本にまとめている（2026-08-17 実装）
- [x] 計測結果（Node 24 / 開発機、3回実行の中央値）:
  - **500ノード**: 放射状レイアウト 1.2ms / dagre 89ms / シリアライズ 0.20ms / パース 0.21ms / JSON 87KB
  - **1000ノード**: 放射状レイアウト 1.7ms / dagre 245ms / シリアライズ 0.40ms / パース 0.41ms / JSON 175KB
  - **結論: 対策（最適化）は不要**。dagre の 245ms もオンデマンド操作（整列ボタン）のため許容範囲（2026-08-17 計測）
- [ ] ブラウザ側の初期描画・ドラッグの計測（`--emit` した `.ideamap` を実アプリで開いて確認）。`onlyRenderVisibleElements` 導入済み（Phase 28）のため優先度は低い

**完了条件**: グローバルエラーハンドラが動作し、型検査・ビルドが通過すること。設定パネルからエラーログをエクスポートできること。500/1000ノードの計測結果が本ドキュメントに記録されていること。最適化の実施は本フェーズのスコープ外。

---

### Phase 44: ブレインダンプ→マップ生成 🔨 実装済み（確認中）

**目標**: テキストを貼り付けると AI が構造を抽出してマップを生成する。新規マップ作成と既存マップへの追記の両方に対応し、「白紙のキャンバス問題」を解消する（v1.1「入口と出口」の1つ目、`docs/roadmap.md` §4.1）。

#### A. 型定義とAI抽出ロジック
- [x] `ExtractedNode` 型は計画通りの構造（`{ tempId: string; title: string; body?: string; categoryId?: string; parentTempId?: string; parentNodeId?: string }`）だが、`packages/core/src/types/index.ts` ではなく `packages/core/src/llm/aiService.ts` 内に定義した（`sanitizeExtractedNodes` と同じファイルに閉じるため）（2026-08-17 実装）
- [x] `packages/core/src/llm/aiService.ts` に `EXTRACT_MAP_SCHEMA` と `extractMapFromText(req, signal?)` を計画通り追加した。`existingNodes` は `{ id: string; title: string }[]`（`body` は含めない、計画より簡略化）。実装は `generateSuggestions` と同じ `completeJsonWithRetry` パターン（2026-08-17 実装）
- [x] 防御的検証は `sanitizeExtractedNodes()` として実装した。ただし計画の「`tempId` 欠落は `uuid` で補完」ではなく、**`tempId` または `title` が空の要素はそのまま除外する**方式にした（uuid補完だと他ノードの `parentTempId` からの参照が意味不明な形で残ってしまうため、除外の方が単純で安全と判断）（2026-08-17 実装）
- [x] `aiService.test.ts` は本フェーズでは作成しなかった。代わりに `packages/core/src/services/textToMap.test.ts`（10件）で `sanitizeExtractedNodes`/`buildMapFragmentFromExtracted` の防御的検証（tempId重複・不明な親・循環参照・空タイトル除外）を検証している。`extractMapFromText` 自体のプロンプト構築のユニットテストは未着手（2026-08-17 実装）

#### B. テキスト→マップ変換ロジック（`packages/core`）
- [x] `packages/core/src/services/textToMap.ts` を新規作成した。シグネチャは計画と異なり `buildMapFragmentFromExtracted(extracted: ExtractedNode[], existing?: { nodes: SerializedNode[] }): Promise<MapFragment>`（`categories` 引数は不要だった。`applyRadialLayout` が非同期のため戻り値も `Promise` になった）。`ExtractedNode[]` を仮の `Node<IdeaNodeData>[]`／`Edge[]` に変換して `applyRadialLayout` に座標計算を委譲する点は計画通り（2026-08-17 実装）
- [x] 追記モード時のオフセット計算（`computeOffset`: 既存マップの外接矩形の右端＋200pxを起点に平行移動、Y座標は既存マップの最小Yに揃える）を計画通り実装した（2026-08-17 実装）
- [x] `packages/core/src/services/textToMap.test.ts` を作成した（10件。計画の4パターンに加え、tempId重複・空タイトル除外・座標の有限値チェックも追加）（2026-08-17 実装）

#### C. UI: ExportImportPanel のインポートタブ拡張
- [x] `ExportImportPanel.tsx` のインポートタブに「AIで構造化（ブレインダンプ）」セクション（チェックボックスで開閉）を追加した。テキストエリア＋「新規マップとして生成」／「現在のマップに追記」トグル＋生成ボタン、ローディング中はキャンセルボタンを表示（`AbortController`）（2026-08-17 実装）
- [x] 生成ボタンの実装は計画通り（`extractMapFromText` → `buildMapFragmentFromExtracted` → `loadFromSerialized`）。新規モードは `reset()` してから `loadFromSerialized`、タイトルは貼り付けテキストの1行目（30字まで）を使う（2026-08-17 実装）
- [x] `ApiKeyRequired` によるAPIキー未設定時の案内を実装した（2026-08-17 実装）
- [x] 成功時・失敗時（`toFriendlyAIError(e)`）のトースト表示を実装した（2026-08-17 実装）

#### D. ドキュメント更新
- [x] `docs/design.md` §9.4.1（AI連携設計）に `extractMapFromText`/`sanitizeExtractedNodes` の仕様を、§11.9（ノード配置ロジック）に `buildMapFragmentFromExtracted` の座標計算方針を追記した（2026-08-17 実装）
- [x] `docs/requirements.md` §2.3.3 に「ブレインダンプ→マップ生成」の機能要件を追記した（2026-08-17 実装）

**残りの手動確認項目**:
- [ ] 実際にAPIキー／Ollamaで議事録・メモ風のテキストを貼り付け、AIが妥当な階層構造を抽出できることを確認する
- [ ] 「現在のマップに追記」を複数回実行し、新規ブロックが重ならず右側に積み上がることを確認する
- [ ] 小型ローカルモデル（Ollama）が壊れたJSON（tempId重複・循環参照）を返した場合でも、生成自体が失敗せずルート化されることを確認する

**完了条件**: 型検査・ビルド・`pnpm test` が通過すること。ExportImportPanel のインポートタブから、貼り付けたテキストがAIによって構造化され、新規マップ生成／既存マップへの追記のどちらでも動作すること。

---

### Phase 45: マップ→成果物生成 🔨 実装済み（確認中）

**目標**: マップ（または選択ノードのサブツリー）から AI が Markdown 成果物（構造化ドキュメント／プレゼン構成／タスクリスト）を生成する。ストリーミング表示→コピー／ファイル保存までを1パネルで完結させる（v1.1「入口と出口」の2つ目、`docs/roadmap.md` §4.2）。

#### A. AI生成ロジック（`packages/core`）
- [x] `packages/core/src/llm/aiService.ts` に `generateArtifactFromMap(req: GenerateArtifactRequest, onText?, signal?): Promise<string>` を追加した。`req = { provider, mapContext, format: 'document' | 'slides' | 'tasks', focusNodeIds? }`。`format` ごとにプロンプト文言（`ARTIFACT_FORMAT_INSTRUCTIONS`）を切り替える点は計画通り（2026-08-17 実装）
- [x] 実装は `chatWithMap` の `system` パラメータ方式ではなく、ノード一覧・接続関係・フォーマット別指示をすべて1つの user メッセージに組み立てて `provider.stream()` に渡す方式にした（2026-08-17 実装）
- [x] **`focusNodeIds` のフィルタは計画（呼び出し側=UIの責務）ではなく、`generateArtifactFromMap` 関数の内部で行う実装にした。** `mapContext.nodes`/`edges` は絞り込まれていない全体を渡す前提で、関数内で `focusNodeIds` の `Set` によりフィルタしてからプロンプトを組み立てる（呼び出し側の `ArtifactPanel` は `useSubtreeNodeIds()` の結果をそのまま渡すだけでよく、フィルタロジックが1箇所に集約される）。`docs/design.md` §9.4.2 もこの実態に合わせて記述した（2026-08-17 実装、docs 訂正）
- [x] `aiService.test.ts` は Phase 44 の時点では作成されていなかったため本フェーズで新規作成した（6件）。`focusNodeIds` によるフィルタ・フォーマット別プロンプト分岐・ストリーミングコールバックを検証する（2026-08-17 実装）

#### B. サブツリー抽出（`packages/ui`）
- [x] `packages/ui/src/hooks/useSubtreeNodeIds.ts` を新規作成した。`uiStore.selectedNodeId` を起点に `mapStore` の edges（source→target、親→子）をBFSしてサブツリーのID集合を返す。**計画の「選択なしは空集合」ではなく、選択なし（または選択IDがマップ上に存在しない）のとき `null` を返す**方式にした（空集合だと「サブツリー0件」と区別がつかないため）。呼び出し側は `null` を「マップ全体を対象」と解釈する（2026-08-17 実装、docs 訂正）

#### C. 新パネル `ArtifactPanel`
- [x] `packages/core/src/stores/uiStore.ts` に `isArtifactPanelOpen`/`setArtifactPanelOpen` を追加した（2026-08-17 実装）
- [x] `packages/ui/src/components/panels/ArtifactPanel.tsx` を新規作成した。フォーマット選択（document/slides/tasks）→対象範囲表示（`selectedNodeId` があるときだけ「選択中のノードから n 件を対象」と表示し、**チェックボックスではなくトグルボタン**でマップ全体に切替可能）→生成ボタン→ストリーミング中のMarkdownプレビュー→完了後に「コピー」／「.mdで保存」ボタン。ローディング・キャンセル・エラー表示は `MapAnalysisPanel.tsx`/`AIChatPanel.tsx` と同じパターン（2026-08-17 実装）
- [x] `packages/ui/src/App.tsx` に `<ArtifactPanel />` を追加し、`packages/ui/src/index.ts` から export した（2026-08-17 実装）

#### D. 入口
- [x] `Header.tsx` の「マップ分析」ボタンの隣に「成果物を作成」ボタン（デスクトップ幅用・モバイル用アイコンボタンの2つ）を追加した（2026-08-17 実装）
- [x] `ExportImportPanel.tsx` のエクスポートタブに「AIで成果物を生成」への導線を追加した（2026-08-17 実装）

#### E. ドキュメント更新
- [x] `docs/design.md` §9.4.2 に `generateArtifactFromMap` の仕様、§5.11 に `ArtifactPanel`/`useSubtreeNodeIds` を追記した（2026-08-17 実装）
- [x] `docs/requirements.md` §2.2.7 に「マップ→成果物生成」の機能要件を追記した（2026-08-17 実装）

**残りの手動確認項目**:
- [ ] 実際にAIを呼び出し、document/slides/tasksの3形式それぞれで指示通りの構成（見出しレベル、Marpの`---`区切り、`- [ ]`チェックボックス）になっているか確認する
- [ ] ノード選択時に「選択サブツリーのみ」と「マップ全体」を切り替えて生成し、対象範囲が正しく変わることを確認する
- [ ] 生成したMarpスライドMarkdownを実際にMarpでレンダリングして崩れがないか確認する
- [ ] .md保存とクリップボードコピーをWeb版・デスクトップ版の両方で確認する

**完了条件**: 型検査・ビルド・`pnpm test` が通過すること。ArtifactPanel から構造化ドキュメント／プレゼン構成／タスクリストの3形式を生成でき、ストリーミング表示・コピー・.md保存が動作すること。選択ノードがある場合はサブツリーのみを対象にできること。

---

### Phase 46: 思考フレームワークテンプレート 🔨 実装済み（確認中）

**目標**: SWOT・KPT・5Whys・オズボーンのチェックリスト・マンダラートをテンプレートマップとして用意し、新規作成時に選べるようにする（v1.1「入口と出口」の3つ目、`docs/roadmap.md` §4.3）。専用プロンプトは作らず、テンプレート各ノードの `body` に「何を書く欄か」を書いておくことで、既存のAI提案（`generateSuggestions` 等）がその文脈をそのまま読む設計にする

#### A. テンプレート定義（`packages/core`）
- [x] `packages/core/src/templates/mapTemplates.ts` を新規作成した。`MapTemplate` は計画に `mapTitle` フィールド（`name`＝一覧表示名とは別に、新規マップのタイトル初期値を持つ）を加えた形で実装した。SWOT／KPT／5Whys／オズボーンのチェックリスト／マンダラートの5種、各ノードの座標は `applyRadialLayout` を通さない手組みの静的データ、`body` に記入ガイド文を入れる点は計画通り（データ定義自体は Phase 46 起票前のコミット 2613628 で先行実装済みだった）（2026-08-17 実装）
- [x] `packages/core/src/templates/mapTemplates.test.ts` を作成した（12件。テンプレートID／ノードIDの一意性、エッジが実在ノードのみ参照すること、ノード矩形が重ならないこと、全ノードに `body` があることを検証）（2026-08-17 実装）

#### B. UI: テンプレート選択モーダルと起動導線
- [x] `packages/ui/src/hooks/useFileDashboard.ts` に `startNewMapFromTemplate(templateId)` を追加した。手順は計画通り（`reset()` → `loadFromSerialized` → `setMapTitle(template.mapTitle)`（計画の `template.name` ではなく専用フィールド） → `setCurrentFileId(null)` → `setCurrentMapId(null)` → `setPresentationNodeIds([])` → `setSaveStatus('unsaved')` → `setFileDashboardOpen(false)`）。`packages/ui/src/index.ts` から export した（2026-08-17 実装）
- [x] `packages/ui/src/components/common/TemplatePickerModal.tsx` を新規作成した。`MAP_TEMPLATES` を一覧表示し、選択すると `onSelect(id)` 経由で呼び出し元に通知する（`createPortal` で body 直下に描画）（2026-08-17 実装）
- [x] **計画は `uiStore` に `isTemplatePickerOpen`/`setTemplatePickerOpen` を追加し `App.tsx` に `<TemplatePickerModal />` を常設する想定だったが、実装ではグローバルストアを経由しない方式にした。** 開閉状態は `FileOpenDashboard.tsx`/`DesktopFileDashboard.tsx` それぞれのローカル state（`showTemplates`）で管理し、各ダッシュボードが `<TemplatePickerModal>` を直接レンダリングする（起動画面限定の一時的なUI状態のため、他パネルと違いグローバルストアに置く必要性が薄いと判断）（2026-08-17 実装、docs 訂正）

#### C. 両アプリのダッシュボードに導線を追加
- [x] `apps/web/src/components/screens/FileOpenDashboard.tsx` と `apps/desktop/src/components/DesktopFileDashboard.tsx` の両方に、「新規作成」ボタンの隣へ「テンプレート」ボタンを追加した。押下でローカル state を `true` にし `TemplatePickerModal` を開く。選択時は `startNewMapFromTemplate(id)` を呼んでモーダルとダッシュボードを閉じる（2026-08-17 実装）

#### D. ドキュメント更新
- [x] `docs/design.md` §21 に `MapTemplate` の型定義を、§5.1.3 に `TemplatePickerModal`/`startNewMapFromTemplate`（実装のローカルstate方式）を追記した（2026-08-17 実装）
- [x] `docs/requirements.md` §2.3.4 に「テンプレートから作成」の機能要件を追記し、§8（将来的な拡張・スコープ外）から「テンプレートマップの提供」の行を削除した（2026-08-17 実装）

**残りの手動確認項目**:
- [ ] Web版・デスクトップ版それぞれの起動画面から5種のテンプレートを実際に選択し、初期ノード配置が意図通り表示されることを確認する
- [ ] テンプレートから作成したマップでAI提案（アイデア拡張）を実行し、`body` の記入ガイドが提案内容に反映されることを確認する
- [ ] テンプレートから作成後の保存が新規ファイルとして行われ、前回開いていたファイルを上書きしないことを確認する

**完了条件**: 型検査・ビルド・`pnpm test` が通過すること。Web版・デスクトップ版のいずれのダッシュボードからも「テンプレートから作成」でテンプレートを選択し、SWOT等の初期ノード配置でマップが開始できること。

---

### Phase 47: AIガーデナー（マップレビュー） 🔨 実装済み（確認中）

**目標**: マップ全体を庭師のようにレビューし、「深掘り」「統合」「橋渡し」「問いかけ」の4種の提案をワンクリックで適用できるようにする。既存の分析3タブ（全体分析・つながり・グループ化）と並ぶ第4のタブとして `MapAnalysisPanel` に統合する（v1.2「育てるAI」の1つ目、`docs/roadmap.md` §5.1）。

**設計判断（起票時点）**: 「長く放置されているノード」の判定は、`IdeaNodeData`/`SerializedNode` に時刻フィールド（`updatedAt` 等）を持たないため、本フェーズでは**構造的指標のヒューリスティック**で代替する（子を持たない葉ノードで本文が空、または `createdBy: 'ai'` のまま子も本文も追加されていない、など）。時刻ベースの正確な「放置期間」判定はスキーマ変更を伴うため v1.3（`docs/roadmap.md` §6.1、Phase 49想定）に送る。

#### A. 構造的指標とAIレビューロジック（`packages/core`）
- [x] `packages/core/src/services/mapReview.ts` を新規作成し、`findNeglectedNodeIds(nodes: { id: string; body?: string; createdBy: 'user' | 'ai' }[], edges: { source: string; target: string }[]): string[]` を計画通り実装した。「子ノードを持たない（`edges` に `source` として現れない）」かつ「`body` が空、または `createdBy === 'ai'`」を満たすノードIDを返す純粋関数（LLM呼び出しなし）（2026-08-17 実装）
- [x] `packages/core/src/services/mapReview.test.ts` を作成した（5件。葉ノード＋空本文／`createdBy: 'ai'`／子あり／本文あり／空白のみの本文の組み合わせを網羅）（2026-08-17 実装）
- [x] `packages/core/src/types/index.ts` に `GardenerSuggestion`（`{ kind: 'deepen' | 'merge' | 'bridge' | 'question'; reason: string; targetNodeIds: string[]; title?: string; body?: string }`）を計画通り追加した（2026-08-17 実装）
- [x] `packages/core/src/llm/aiService.ts` に `GARDENER_SCHEMA` と `reviewMap(req: ReviewMapRequest, signal?: AbortSignal): Promise<GardenerSuggestion[]>` を計画通り追加した（max_tokens は 3072）。`req = { provider, nodes: { id, title, body?, categoryId?, createdBy }[], edges: { source, target }[], categories }`。実装内で `findNeglectedNodeIds` を呼び、結果を「【放置されている可能性のあるノード（参考）】」セクションとしてプロンプトに埋め込んだ上で `completeJsonWithRetry` を使う。プロンプトに4種の提案の判断基準を明記し、最大6件までに絞るよう指示する（2026-08-17 実装）
- [x] パース結果の防御的検証（`Array.isArray(parsed.suggestions)`、`targetNodeIds` が配列でなければ空配列に落とす）を計画通り実装した（2026-08-17 実装）
- [x] `packages/core/src/llm/aiService.test.ts` に `reviewMap` のテストを4件追加した（放置ノード候補の埋め込み／参考セクション省略／`suggestions` 非配列時の空配列フォールバック／`targetNodeIds` 非配列時の空配列フォールバック）（2026-08-17 実装）

#### B. mapStore: ノード統合アクション（`packages/core`）
- [x] `packages/core/src/stores/map/types.ts` の `NodeSlice` に `mergeNodes: (keepId: string, mergeId: string) => void` を計画通り追加した（2026-08-17 実装）
- [x] `packages/core/src/stores/map/nodeSlice.ts` に `mergeNodes` を実装した。`mergeId` の `body` を `keepId` の `body` に連結（`\n\n` 区切り、両方空なら `undefined`）し、`mergeId` に接続していたエッジを `keepId` へ張り替え（張替えで自己ループになるものは除外、向き問わず同じペアになったものは1本に絞る）、`mergeId` を削除する。1回の `set`・`pushPast` 1回でまとめる（2026-08-17 実装）
- [x] `packages/core/src/stores/mapStore.test.ts` に `mergeNodes` のテストを追加した（本文連結・エッジ張替え・重複エッジの除外・Undo で元に戻ることを1テストで検証）（2026-08-17 実装）

#### C. UI: MapAnalysisPanel に「ガーデナー」タブを追加
- [x] `packages/core/src/stores/uiStore.ts` に `gardenerSuggestions: GardenerSuggestion[]` と `setGardenerSuggestions` を計画通り追加した（2026-08-17 実装）
- [x] `packages/ui/src/components/panels/MapAnalysisPanel.tsx` の `TabKey` に `'gardener'` を追加し、タブラベル `🌱 ガーデナー` を追加した。`handleReviewMap`（`handleAnalyze` と同じ loading/abort/エラー処理パターン）で `reviewMap` を呼び `setGardenerSuggestions` に格納する（2026-08-17 実装）
- [x] ガーデナータブの提案カードは `kind` ごとに表示・適用ボタンを計画通り出し分けた:
  - `deepen`: 対象ノードのタイトルと `title`/`body`（深掘り案）を表示し、適用ボタンで `calcSuggestionPositions(targetNode.x, targetNode.y, 1, nodes)` の位置に `addNode(title, x, y, 'ai', '#f3f4ff', undefined, body)` → `onConnect({ source: targetNode.id, target: newId, ... })`
  - `merge`: `targetNodeIds` 2件のタイトルを並べて表示し、適用ボタンで `mergeNodes(targetNodeIds[0], targetNodeIds[1])` を呼ぶ
  - `bridge`: `targetNodeIds` 2件を矢印アイコン付きのカードで表示し、適用ボタンは既存の `addSuggestedEdge(targetNodeIds[0], targetNodeIds[1])` をそのまま呼ぶ
  - `question`: `title`/`body` を表示し、適用ボタンで `targetNodeIds[0]` があれば `calcSuggestionPositions` でその近くに配置して接続、なければ `findFreePosition({ x: 0, y: 0 }, nodes)` で独立ノードとして追加する（**計画の「`addConnectedNode` 相当」ではなく、deepen と共通の1つの分岐にまとめて実装した**。対象ノードの有無だけで配置ロジックを出し分ける形の方が実装がシンプルだったため）（2026-08-17 実装、docs 訂正）
  - 適用済みの提案は `appliedGardener: Set<number>` に index を積み、カードを `opacity-50` にして「適用済み」ボタン表示に変える（一覧からは取り除かない。他タブの `dismissedConnections`/`appliedClusters` と同じ「取り除かず無効化」方式）（2026-08-17 実装、docs 訂正）
- [x] エラー表示・キャンセルボタン・ローディング表示は既存3タブの `CancelButton`/`rawErrorResponse` の仕組みをそのまま再利用した（2026-08-17 実装）

#### D. ドキュメント更新
- [x] `docs/design.md` §9.4.3（AI連携設計）に `reviewMap`・`GARDENER_SCHEMA`・「放置ノード」の構造的指標という設計判断を追記し、§4.1（mapStore）に `mergeNodes` を追記した（2026-08-17 実装）
- [x] `docs/requirements.md` §2.2.8 に「AIガーデナー（マップレビュー）」の機能要件を追記した。「放置ノード判定は時刻ではなく構造的指標による」旨を明記した（2026-08-17 実装）

**残りの手動確認項目**:
- [ ] 実際にAPIキー／Ollamaでマップをレビューし、放置ノードを含むマップで deepen 提案が意味のある内容になることを確認する
- [ ] merge 提案を適用し、本文の連結・エッジの張替え・重複排除後の見た目が破綻しないことを確認する
- [ ] bridge・question 提案を適用し、いずれも Undo 1回で元に戻ることを確認する
- [ ] 小型ローカルモデル（Ollama）で `targetNodeIds` が単一文字列など壊れた形で返っても、UI がクラッシュせず空配列として扱われることを確認する

**完了条件**: 型検査・ビルド・`pnpm test` が通過すること。ガーデナータブから4種の提案が表示され、それぞれのワンクリック適用（deepen/merge/bridge/question）が動作し、各適用が Undo 1回で取り消せること。

---

### Phase 48: ペルソナ壁打ち会議 🔨 実装済み（確認中）

**目標**: ノードを指定して複数ペルソナ（楽観家・批評家・顧客・投資家などのプリセット＋自由入力）に意見を出させ、選択した意見を子ノードとして一括追加する（v1.2「育てるAI」の2つ目、`docs/roadmap.md` §5.2）。

#### A. mapStore: 複数ノード一括追加アクション（`packages/core`）
- [x] `packages/core/src/stores/map/types.ts` の `NodeSlice` に `addNodesWithEdges: (nodes: IdeaNode[], edges: Edge[]) => void` を計画通り追加した。1回の `set` でノード配列とエッジ配列をまとめて追加し、`past` に1回だけ積む（2026-08-17 実装）
- [x] `packages/core/src/stores/map/nodeSlice.ts` に実装した（2026-08-17 実装）
- [x] `packages/core/src/stores/mapStore.test.ts` に `addNodesWithEdges` のテストを追加した（ノード・エッジがまとめて追加されること、`past` が1回しか積まれないこと、Undo 1回で全て取り消せることを1テストで検証）（2026-08-17 実装）
- [x] **計画にはなかった追加対応**: `addNodesWithEdges` を `PersonaDebatePanel`（`packages/ui`）から呼ぶために `@ideamap/core` の公開APIとして必要になり、あわせてテストで使う `makeEdge`（`packages/core/src/stores/map/constants.ts`）も外部から import できるようにするため、`packages/core/src/index.ts` に `export * from './stores/map/constants'` を追加した。それまで `constants.ts` は `mapStore.ts` 経由の再エクスポートがなく、`packages/ui`/テストから `makeEdge`/`DEFAULT_NODE_COLOR` 等を直接 import できなかった（2026-08-17 実装、docs 訂正）
- [x] **注記（本フェーズのタスクではない）**: `documentSlice.ts` の `loadFromSerialized` は `past: [], future: []` で履歴を消去するため、Phase 44 の「既存マップへの追記」モード（`ExportImportPanel.tsx` が `loadFromSerialized([...既存, ...新規], ...)` を呼ぶ実装）は追記のたびに Undo 履歴が失われている。`addNodesWithEdges` はこの問題も解消できるため、将来 Phase 44 の追記処理をこのアクションに置き換える余地があるが、対象ファイルが異なるため本フェーズのスコープには含めない（2026-08-17 実装）

#### B. AI壁打ちロジック（`packages/core`）
- [x] `packages/core/src/types/index.ts` に `PersonaOpinion`（`{ persona: string; opinions: { title: string; body: string }[] }`）を計画通り追加した（2026-08-17 実装）
- [x] `packages/core/src/llm/aiService.ts` に `DEBATE_SCHEMA` と `debateNode(req: DebateNodeRequest, signal?: AbortSignal): Promise<PersonaOpinion[]>` を計画通り追加した（max_tokens は 3072）。`req = { provider, mapContext: MapContext, nodeId: string, personas: string[] }`。`mapContext.nodes` から `nodeId` に対応するノードを探しタイトル・本文を組み込み（見つからなければ `対象ノードが見つかりません` を投げる）、`mapContext.edges` から1ホップ隣接ノードを「つながっているアイデア」として提示する。1回の `completeJsonWithRetry` 呼び出しで `personas` の全員分の意見をまとめて構造化出力させる（2026-08-17 実装）
- [x] パース結果の防御的検証（`personas` が配列でなければ `AIからの応答形式が正しくありません` を投げる、各ペルソナの `opinions` が配列でなければ空配列に落とす）を計画通り実装した（2026-08-17 実装）
- [x] `packages/core/src/llm/aiService.test.ts` に `debateNode` のテストを4件追加した（対象ノード・隣接ノード（1ホップのみ）・ペルソナ一覧のプロンプト埋め込み／対象ノード不在時のエラー／`personas` 非配列時のエラー／`opinions` 非配列時の空配列フォールバック）（2026-08-17 実装）

#### C. UI: 新パネル `PersonaDebatePanel` と入口
- [x] `packages/core/src/stores/uiStore.ts` に `isPersonaDebatePanelOpen`/`setPersonaDebatePanelOpen`・`personaDebateResult: PersonaOpinion[]`/`setPersonaDebateResult`・`isPersonaDebateLoading`/`setPersonaDebateLoading` を計画通り追加した（対象ノードIDは既存の `selectedNodeId` を再利用し、専用の state は持たない）（2026-08-17 実装）
- [x] `packages/ui/src/components/panels/PersonaDebatePanel.tsx` を新規作成した。プリセットペルソナ（楽観家・批評家・顧客・投資家）のトグルチップ＋自由入力テキストボックス（追加ボタンまたは Enter でリストに足す）→「議論を始める」ボタン→ローディング（`CancelButton`/`AbortController` パターン踏襲）→ペルソナごとに意見カードを表示し、`personaIdx-opinionIdx` をキーにした `Set<string>` でペルソナ×意見の組を個別に選択可能にする（生成直後は全件選択済み）→「選択した意見を子ノードとして追加」ボタンで、選択された意見それぞれに対して `calcSuggestionPositions(selectedNode.position.x, selectedNode.position.y, count, nodes)` で位置を求めた `IdeaNode[]` と、選択ノードへの `makeEdge({ source, target, sourceHandle: 'right', targetHandle: 'left' })` の `Edge[]` を組み立てて `addNodesWithEdges` を1回呼ぶ。追加後は選択ノード＋新規ノード群へ `fitView` する（2026-08-17 実装）
- [x] `packages/ui/src/App.tsx` に `<PersonaDebatePanel />` を追加し、`packages/ui/src/index.ts` から export した（2026-08-17 実装）
- [x] `packages/ui/src/components/canvas/ContextMenu.tsx` のノードメニューに、既存の `✦ AIで拡張`（`setAIPanelOpen(true)`）の直後へ `🎭 ペルソナで壁打ち` 項目を計画通り追加した（2026-08-17 実装）
- [x] `packages/ui/src/components/panels/NodeDetailPanel.tsx` のヘッダーの `AI拡張` ボタンの隣に壁打ち起動ボタン（`🎭 壁打ち`）を追加した（2026-08-17 実装）

#### D. ドキュメント更新
- [x] `docs/design.md` §9.4.4（AI連携設計）に `debateNode`・`DEBATE_SCHEMA` を追記し、§4.1（mapStore）に `addNodesWithEdges` を追記し、§5.12（コンポーネント設計）に `PersonaDebatePanel` を追記し、§5.4（ContextMenu）に「ペルソナで壁打ち」項目を追記した（2026-08-17 実装）
- [x] `docs/requirements.md` §2.2.9 に「ペルソナ壁打ち会議」の機能要件を追記した（2026-08-17 実装）

**残りの手動確認項目**:
- [ ] ContextMenu・NodeDetailPanel の両方から壁打ちパネルを開けることを実機で確認する
- [ ] プリセットペルソナと自由入力ペルソナを組み合わせて実際にAI呼び出しを行い、ペルソナごとの意見が意味のある内容になることを確認する
- [ ] 意見の個別選択（一部だけ採用）で選んだ分だけ子ノードが追加され、Undo 1回で全て取り消せることを確認する
- [ ] 小型ローカルモデル（Ollama）で複数ペルソナを指定した場合の応答品質・所要時間を確認する

**完了条件**: 型検査・ビルド・`pnpm test` が通過すること。ContextMenu またはノード詳細から壁打ちパネルを開き、プリセット／自由入力ペルソナで意見を生成し、選択した意見を子ノードとして一括追加でき、その追加が Undo 1回で取り消せること。

---

### Phase 49: スキーマバージョニングとノードのリッチ化

**目標**: `.ideamap` ファイルフォーマットにバージョン管理基盤を整備し、それを土台にノードへ「更新日時」「URLリンク」「画像添付」を追加する。データ形式に手を入れる最初のフェーズのため、まずマイグレーション基盤（A）を作ってから個別のスキーマ拡張（B〜D）に進む（v1.3「記憶と表現」の1つ目、`docs/roadmap.md` §6.1）。

**現状確認（起票時点）**: `MapFile.version`（`packages/core/src/types/index.ts`）は `packages/core/src/stores/mapSnapshot.ts` の `buildMapFile()` が保存のたびに固定文字列 `'1.0'` を書き込むだけで、読み込み側でバージョンを判定する処理は存在しない。`packages/core/src/stores/map/documentSlice.ts` の `loadFromSerialized(nodes, edges)` は `SerializedNode[]`/`SerializedEdge[]` しか受け取らず `version` を見ない。`packages/ui/src/services/exportService.ts` の `importFromJson()` もコメントは「バージョン互換チェック付き」だが実装は `nodes`/`edges` が配列であることの確認のみ。`packages/core/src/utils/mapFileCompat.ts` は `readNodeTitle`/`readEdgeHandles` というフィールド単位の後方互換ヘルパーのみを持ち、バージョン単位のマイグレーションの仕組みはまだない。

#### A. スキーマバージョニング基盤（最初に着手。以後の全スキーマ変更の下敷き）
- [ ] `packages/core/src/utils/mapFileCompat.ts` に `CURRENT_MAP_FILE_VERSION`（現行値 `'1.0'` を踏襲）と `migrateMapFile(file: MapFile): { file: MapFile; warning?: string }` を追加する。`version` を判定し、現行より古ければ段階的マイグレーション関数を順に適用して最新へ書き換える（起票時点で `'1.0'` 以外の実データは存在しないため、初回実装は「`version` を最新値に揃えて返すだけ」の恒等マイグレーションでよいが、以後のバージョンアップ時にこの関数へ1ステップずつ追加していく構造にする）。`version` が `CURRENT_MAP_FILE_VERSION` より新しい（未知の将来バージョン）場合は読み込み自体は試みたうえで、`warning` に「このファイルは新しいバージョンで作成されています。一部のデータが読み込めない可能性があります」を設定して返す
- [ ] `packages/core/src/utils/mapFileCompat.test.ts` に `migrateMapFile` のテスト（現行バージョンはそのまま／`version` 欠落は補完／未知の新バージョンは警告つきで返し中身はそのまま読める）を追加する
- [ ] `buildMapFile()`（`packages/core/src/stores/mapSnapshot.ts`）が書き込む `version` を、ハードコードの `'1.0'` から `CURRENT_MAP_FILE_VERSION` 参照に変更する
- [ ] `migrateMapFile` を、外部ファイル起源の `MapFile` を読み込む次の6箇所へ配線する（`loadFromSerialized` に渡す直前で呼び、`warning` があればトースト表示する）。`packages/core/src/index.ts` は既に `export * from './utils/mapFileCompat'` 済みのため追加の export 作業は不要:
  - `packages/ui/src/hooks/useFileDashboard.ts` の `openLoadedMap()`（Web版 Driveファイル選択・デスクトップ版ダッシュボード・`apps/desktop/src/openMap.ts` の Ctrl+O ダイアログの共通経路）
  - `apps/web/src/components/screens/FileOpenDashboard.tsx` の `handleResumeLocal()`（ローカル控えの再開）
  - `apps/web/src/components/panels/MapListPanel.tsx` の `handleLoad()`
  - `apps/web/src/WebApp.tsx` の `useShareUrlImport()`（共有URLインポート）
  - `packages/ui/src/hooks/useAutoSave.ts` の衝突ダイアログ `secondaryAction`（「最新版を読み込む」、約149行目）
  - `packages/ui/src/services/exportService.ts` の `importFromJson()`（JSONファイルインポート）

#### B. ノード単位の `updatedAt`
- [ ] `packages/core/src/types/index.ts` の `IdeaNodeData`/`SerializedNode` に `updatedAt?: string`（ISO 8601）を追加する
- [ ] `packages/core/src/stores/map/nodeSlice.ts` の内容編集アクション（`updateNodeTitle`/`updateNodeBody`/`updateNodeColor`/`updateNodeCategory`/`mergeNodes`〔keep側〕/`applyClusterCategory`、実コードで確認したこの6箇所）で対象ノードの `data.updatedAt` を `new Date().toISOString()` に更新する。本フェーズ C/D で追加する `updateNodeUrl`/`updateNodeImage` にも同様に刻印する
- [ ] `documentSlice.ts` の `loadFromSerialized`/`getSerializedNodes` で `updatedAt` をそのまま往復させる（旧ファイルは `undefined` のままにし、マイグレーションで値を捏造しない）
- [ ] `packages/core/src/stores/mapStore.test.ts` に、上記アクションが `updatedAt` を更新すること・`loadFromSerialized` が `updatedAt` を保持することのテストを追加する
- [ ] `packages/core/src/services/mapReview.ts` の `findNeglectedNodeIds` を拡張し、`updatedAt` を持つノードは経過日数ベースの判定（放置期間の閾値はタスク実施時に決める。例: 30日）に、持たないノード（旧ファイル）は現行の構造的ヒューリスティック（葉ノードかつ本文が空、または `createdBy: 'ai'` のまま子も本文も追加されていない）にフォールバックする。呼び出し元 `packages/core/src/llm/aiService.ts` の `reviewMap`（`ReviewMapRequest.nodes` に渡すノード情報へ `updatedAt` を追加）も合わせて更新する
- [ ] `packages/core/src/services/mapReview.test.ts` に時刻ベース判定のテスト（`updatedAt` あり・放置期間内／超過、`updatedAt` なしは従来どおり構造的指標）を追加する

#### C. URLリンク
- [ ] `packages/core/src/types/index.ts` の `IdeaNodeData`/`SerializedNode` に `url?: string` を追加する
- [ ] `packages/core/src/stores/map/types.ts` の `NodeSlice` に `updateNodeUrl: (id: string, url: string) => void` を追加し、`nodeSlice.ts` に実装する（`updateNodeBody` と同じ形。B の `updatedAt` 刻印を含む）
- [ ] `packages/ui/src/components/panels/NodeDetailPanel.tsx` の本文欄の下に URL 入力欄を追加し、blur で `updateNodeUrl` を呼ぶ
- [ ] `packages/ui/src/components/canvas/IdeaNode.tsx` に、`url` があるときノード下部へドメイン名（`new URL(url).hostname`。不正なURLはチップを表示しない）のリンクチップを表示する。クリックで `getPlatform().system.openExternalUrl(url)` を呼ぶ（`packages/platform/src/types.ts` の `SystemAdapter.openExternalUrl` は既存メソッドのため Adapter 追加は不要）
- [ ] **OGPタイトルの自動取得はしない。** Web版は外部サイトのHTML取得がブラウザのCORSで失敗し、Phase 42 で追加した CSP の `connect-src`（Anthropic/OpenAI/Google APIのみ許可）にも合致しない。デスクトップ版は `apps/desktop/src-tauri/capabilities/*.json` のホスト許可が既存 capability（`ai-http`/`google-drive` 等）の用途に合わず、任意ドメインへの許可を広げるのは `CLAUDE.md` の「安易に `$HOME/**` を足さない」と同種の既存方針（許可範囲を機能単位に絞る）に反するため見送る。この判断を `docs/design.md` に明記する

#### D. 画像添付
- [ ] `packages/core/src/types/index.ts` の `IdeaNodeData`/`SerializedNode` に `image?: string`（data URL）を追加する
- [ ] `packages/core/src/stores/map/types.ts` の `NodeSlice` に `updateNodeImage: (id: string, image: string | undefined) => void` を追加し、`nodeSlice.ts` に実装する（B の `updatedAt` 刻印を含む）
- [ ] `packages/ui/src/utils/imageResize.ts`（新規）に `resizeImageToDataUrl(file: File, maxDimension = 640, maxBytes = 200_000): Promise<string>` を実装する。`<canvas>`/`Image`/`FileReader` を使うブラウザ標準APIのみの実装とし、`packages/ui/src/services/exportService.ts` が既に `FileReader` を、`ExportImportPanel.tsx` が既に `<input type="file">` を Adapter を介さず直接使っている前例に倣う。長辺 `maxDimension` にリサイズしJPEG品質を段階的に下げながら `maxBytes` 以下に収める
- [ ] `packages/ui/src/components/panels/NodeDetailPanel.tsx` に画像選択 `<input type="file" accept="image/*">`・プレビュー・削除ボタンを追加し、選択時に `resizeImageToDataUrl` → `updateNodeImage` を呼ぶ
- [ ] `packages/ui/src/components/canvas/IdeaNode.tsx` に `image` があるときノード内にサムネイル（`<img>`、高さ上限つき）を表示する
- [ ] **ファイルサイズが `.ideamap` / Drive保存 / 共有URLにそのまま乗る制約と、縮小して埋め込む設計判断**を `docs/design.md` に明記する。別ファイル管理（Drive上の別オブジェクト参照等）はWeb版・デスクトップ版でストレージの扱いが大きく異なり v1 では過剰と判断し見送る旨も記載する
- [ ] `apps/web/src/services/shareUrl.ts` の `URL_SIZE_WARNING`（50000文字超で `tooLarge` を返す既存ロジック）が画像添付後のマップでも従来どおり機能することを確認する。ロジック変更は不要で、画像付きノードを含む閾値超のマップを作って Web版で共有URL生成時に警告が出ることを手動確認する

#### E. 互換性・エクスポートへの影響確認
- [ ] `packages/ui/src/services/exportService.ts` の `exportAsJson`/`exportAsMarkdown` が新フィールド（`updatedAt`/`url`/`image`）を持つノードでも壊れないことを確認する。`exportAsJson` は `MapFile` をそのまま `JSON.stringify` するため追加対応不要と見込まれる。`exportAsMarkdown` は現状 `url`/`image` を無視して見出し・本文のみ出力する想定で、対応するかはタスク実施時に決める
- [ ] A で追加する `migrateMapFile` のテストに、`updatedAt`/`url`/`image` を持たない旧ファイルが例外なく読み込めるケースを含める

#### F. ドキュメント更新
- [ ] `docs/design.md` に「マップファイルのバージョニングとマイグレーション」の節を新設し `migrateMapFile`/`CURRENT_MAP_FILE_VERSION` の設計を記載する。§6（型定義）に `updatedAt`/`url`/`image` を追記し、§9（AI連携設計）の放置ノード判定の記述を時刻ベース優先の説明に更新し、§5.3（IdeaNode）・NodeDetailPanel の節にリンクチップ・サムネイル・画像リサイズの仕様を追記する
- [ ] `docs/requirements.md` §2.3（データ管理）に「ファイルフォーマットのバージョニング」を追記し、機能要件として「URLリンク」「画像添付」を追記する

**完了条件**: 型検査・ビルド・`pnpm test` が通過すること。既存の（`version: '1.0'` の）`.ideamap` ファイルが警告なく読み込めること。新規保存時に `version` とノードの `updatedAt` が書き込まれること。NodeDetailPanel から URL・画像を設定でき、キャンバス上にリンクチップ・サムネイルが表示されること。OGPタイトルを自動取得しない理由が `docs/design.md` に明記されていること。

---

### Phase 50: バージョン履歴とタイムラプス再生

**目標**: 保存のたびにローカルへスナップショットを蓄積し、履歴パネルから閲覧・復元できるようにする。おまけとして、マップが育っていく過程をアニメーション再生する「タイムラプス再生」を実装する。Google Drive の revisions API 連携は本フェーズで起票するが実機確認が必要なため優先度低とする（v1.3「記憶と表現」の2つ目、`docs/roadmap.md` §6.2）。Phase 49 で整備するスキーマバージョニング基盤（`MapFile.version`／`migrateMapFile`）の上に構築するため、Phase 49 完了後に着手する。

#### A. ローカルスナップショット（`packages/core`）
- [ ] `packages/core/src/services/mapHistory.ts`（新規）に `MapSnapshotEntry`（`{ time: string; mapFile: MapFile }`）と、`packages/core/src/services/errorLog.ts` と同じ「StorageAdapter 経由 + プロセス内メモリキャッシュ」パターンで `recordSnapshot(mapId: string, mapFile: MapFile): Promise<void>` / `getSnapshots(mapId: string): Promise<readonly MapSnapshotEntry[]>` / `clearSnapshots(mapId: string): Promise<void>` を実装する。ストレージキーは `ideamap-history-${mapId}`（`errorLog.ts` は単一キーだが、履歴はマップごとに肥大化するため mapId 単位で分離する）
- [ ] リングバッファは上限20件（超過分は古い順に破棄）。1件あたりのサイズ上限（例: 2MB。Phase49 D の画像添付でスナップショットが肥大化しうるため）を超える `mapFile` は `nodes`/`edges` はそのまま保存しつつ各ノードの `image` フィールドだけ省いて記録する（履歴プレビュー・復元では画像が欠けるトレードオフを許容する。理由を実装コメントに残す）
- [ ] `recordSnapshot` は同一 `mapId` への直前の記録と内容が同一（`nodes`/`edges` の JSON 文字列比較）なら追記しない（無変更の保存が続いてもリングバッファを浪費しないため）
- [ ] `packages/core/src/services/mapHistory.test.ts` を作成する。リングバッファの上限、サイズ上限超過時の `image` 省略、無変更時のスキップ、`mapId` ごとの分離を検証する
- [ ] `packages/ui/src/hooks/useAutoSave.ts` の `performSave` 内、保存が成功して `setSaveStatus('saved')` を呼ぶ2箇所（新規保存確定時・上書き保存成功時）で `recordSnapshot(mapFile.mapId, mapFile)` を呼ぶ。`canPersist` が false のローカル控えのみの分岐（保存先未確定時のデバウンス保存）では呼ばない（正式な保存ではないため）

#### B. 履歴パネル（`packages/ui`）
- [ ] `packages/core/src/stores/uiStore.ts` に `isHistoryPanelOpen`/`setHistoryPanelOpen` を追加する（`isArtifactPanelOpen`/`setArtifactPanelOpen` と同じ形）
- [ ] `packages/ui/src/components/panels/HistoryPanel.tsx`（新規）を作成する。開いたら `uiStore.currentMapId` を元に `getSnapshots` を呼び、日時・ノード数の一覧を表示する。一覧から選ぶと、選択スナップショットの `nodes`/`edges` を件数・タイトル一覧としてパネル内に表示する読み取り専用プレビューを出す（既存キャンバスは書き換えない）
- [ ] 「この時点に復元」ボタン: `openConfirmDialog` で確認 → 確定で、まず現在のマップを `recordSnapshot(currentMapId, buildMapFile(currentMapId))` で退避してから（復元により失われる直前の状態を残すため）、選択スナップショットを `loadFromSerialized(snapshot.mapFile.nodes, snapshot.mapFile.edges)` で復元し、`mapTitle`/`presentationNodeIds` も反映する。`documentSlice.ts` の `loadFromSerialized` は `past: [], future: []` で Undo 履歴を消す仕様のため、復元操作自体はこの1回の `loadFromSerialized` で完結させ、「取り消し」は直前状態を退避したスナップショットから再度復元する形で提供する（Undo 1回では戻せないことを `docs/design.md` に明記する）
- [ ] `packages/ui/src/App.tsx` に `<HistoryPanel />` を追加し、`packages/ui/src/index.ts` から export する
- [ ] `packages/ui/src/components/common/Header.tsx` に、既存の「マップ分析」「成果物を作成」ボタン（デスクトップ幅ラベル付き・モバイル幅アイコンのみの2ボタン構成）と同じパターンで「履歴」ボタンを追加し `setHistoryPanelOpen(true)` を呼ぶ

#### C. タイムラプス再生
- [ ] `packages/core/src/stores/uiStore.ts` に `isTimelapsePlaying`/`setTimelapsePlaying` を追加する
- [ ] `HistoryPanel.tsx` に「タイムラプス再生」ボタンを追加する。押下前に `getSerializedNodes()`/`getSerializedEdges()`/`mapTitle` を退避し、`setTimelapsePlaying(true)` → スナップショット列を古い順に一定間隔（例: 800ms）で `loadFromSerialized(snapshot.mapFile.nodes, snapshot.mapFile.edges)` に適用してキャンバス上でマップが育つ過程を再生する
- [ ] `packages/ui/src/components/canvas/IdeaCanvas.tsx` に、`isTimelapsePlaying` のとき編集操作を無効化する全面オーバーレイ（`pointer-events-none` の半透明バナー「タイムラプス再生中」＋独立した停止ボタンだけ `pointer-events-auto`）を追加する。既存の `PresentationMode`（`isPresentationMode` フラグで `App.tsx` が排他的に切り替える構成）とは異なり、タイムラプスはキャンバス自体の描画を使い回すためオーバーレイ方式にする
- [ ] 再生終了（最後のスナップショットまで進む、または停止ボタン）で、押下前に退避した `nodes`/`edges`/`mapTitle` を `loadFromSerialized` で復元し `setTimelapsePlaying(false)` にする。**この復元によって再生開始前の Undo 履歴（`past`/`future`）は失われる**（`loadFromSerialized` の既存仕様）。再生は読み取り専用の演出機能であり、実行前に確認ダイアログで「実行中の Undo 履歴は再生後に失われます」旨を明示することで許容する。この制約を `docs/design.md` に明記する

#### D. Google Drive revisions（実機確認が必要・優先度低）
- [ ] **本タスクは起票のみとし、実装優先度は低い。** `packages/core/src/services/driveService.ts`（現状 `listMaps`/`saveMap`/`loadMap`/`deleteMap`/`fetchMapAppProperties`/`saveAppSettings`/`loadAppSettings` のみで revisions 系のAPIは未実装）に、Drive revisions API（`GET /files/{fileId}/revisions`・`GET /files/{fileId}/revisions/{revisionId}?alt=media`）を呼ぶ `listMapRevisions`/`loadMapRevision` を追加する
- [ ] `HistoryPanel.tsx` に、Web版かつ Drive 保存のマップを開いているときだけ「Driveの変更履歴」タブ（またはセクション）を追加し、A のローカル履歴と別枠で表示・復元できるようにする
- [ ] **実機確認が必要な理由**: Drive revisions は既定で「一定期間または一定世代数を超えると自動削除される」「`keepForever` フラグを立てないと保持されない」など運用上の挙動が実ファイルでの検証なしには確定できない。Web版の GIS トークンのスコープ（現状 `drive.file` 相当）で revisions エンドポイントに到達できるかも未確認。これらを本ドキュメントの実機確認項目として残す

#### E. ドキュメント更新
- [ ] `docs/design.md` に `mapHistory.ts`（リングバッファ設計・サイズ上限・画像省略ルール）・`HistoryPanel`・タイムラプス再生（Undo履歴が失われる制約）の設計を追記する。Drive revisions は「実装済みだが実機確認待ち」であることが分かるように明記する
- [ ] `docs/requirements.md` に「バージョン履歴」「タイムラプス再生」の機能要件を追記する

**完了条件**: 型検査・ビルド・`pnpm test` が通過すること。保存のたびにローカル履歴が蓄積され、履歴パネルから一覧・プレビュー・復元ができること。タイムラプス再生でマップの成長過程がアニメーション表示され、終了後に再生前の状態へ戻ること。Drive revisions 連携はコードとしては動作するが、実機確認未了である旨が本ドキュメントに明記されていること。

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
| Phase 21 | レイアウト・整列機能の強化 | 3日 ✅ |
| Phase 22 | アイデア編集UXの改善 | 3日 |
| Phase 23 | AI連携UXの改善 | 3日 |
| Phase 24 | 全般UX・品質改善 | 2日 ✅ |
| Phase 25 | スマホ表示・レイアウト最適化 | 2日 |
| Phase 26 | スマホ タッチ操作の充実 | 3日 |
| Phase 27 | セキュリティ & 確定バグ修正 | 2日 |
| Phase 28 | パフォーマンス最適化 | 2日 |
| Phase 29 | リファクタリング & 技術的負債返済 | 2日 |
| Phase 30 | UX 改善バッチ | 2日 ✅ |
| Phase 31 | 「確認中」フェーズの動作確認 & 確定 | 2日 🔨（実機確認のみ残） |
| Phase 32 | LLMプロバイダ抽象化（Claude のみ） | 2日 ✅ |
| Phase 33〜38 | デスクトップ版（モノレポ移行〜配布・任意のDrive連携） | 約23日 |
| **Phase 1-4 合計** | | **約8日** |
| **Phase 5-11 合計** | | **約20日** |
| **Phase 12-15 合計** | | **約11日** |
| **Phase 16-18 合計** | | **約3日** |
| **Phase 19-24 合計（UX改善）** | | **約15日** |
| **Phase 25-26 合計（スマホ対応）** | | **約5日** |
| **Phase 27-31 合計（品質改善）** | | **約10日** |
| **Phase 32-38 合計（デスクトップ版）** | | **約25日** |
| **全体合計** | | **約97日** |

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
| Phase 25: 下部シートとデスクトップ中央表示の分岐 | `window.innerWidth < 640` で分岐し、画面回転・リサイズ時はメニューを開き直して再評価する（開いたまま追従はしない） |
| Phase 26: 接続モードとノードタップ選択の競合 | 接続モード中は `handleNodeClick` で接続確定を最優先に分岐し通常の選択処理をスキップ。上部バナーで状態を常時明示し、空白タップ・キャンセルで必ず解除できるようにする |
| Phase 26: ロングプレスとドラッグ・スクロールの競合 | `onTouchMove` でタイマーをクリアする既存パターンを踏襲し、移動を伴うジェスチャではメニューを発火させない。500ms 閾値で短タップとも区別する |
| Phase 27: マスターパスワード移行 | 旧ハードコード鍵で暗号化済みの localStorage の APIキーは新方式で復号できないため、初回起動時にマスターパスワード設定（または再入力）を促す。未設定時は AI 機能を無効化し案内を表示する |
| Phase 27: react-markdown 不使用前提の sanitize | 描画は独自 `renderMarkdownSimple` + `dangerouslySetInnerHTML`。ライブラリ移行ではなく DOMPurify で出力をホワイトリスト sanitize し、既存コンポーネントの変更を最小化する |
