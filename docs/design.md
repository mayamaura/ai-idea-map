# アイデア拡張メモアプリ 設計書

**作成日**: 2026-05-30  
**バージョン**: 1.0

---

## 1. アーキテクチャ概要

フロントエンドのみのSPAとして構成する。バックエンドサーバーは持たない。

Phase 33 でモノレポへ移行し、プラットフォーム差分を Platform Adapter で吸収する構成になった。
アプリ本体（`packages/core` / `packages/ui`）は「どこに保存するか」「誰が HTTP を送出するか」を知らない。

```
apps/web（Web版シェル）                    apps/desktop（Phase 34 で追加）
  └ Adapter の Web 実装を setPlatform()      └ Adapter の Tauri 実装を setPlatform()
        │                                          │
        └──────────────┬───────────────────────────┘
                       ▼
   packages/ui（React コンポーネント・UI hooks）
                       │
                       ▼
   packages/core（型・Zustand ストア・レイアウト計算・LLMProvider）
                       │  getPlatform() で参照
                       ▼
   packages/platform（Adapter の型定義と registry のみ）

Adapter が吸収する差:
  StorageAdapter … 設定・最近使ったマップ（Web=localStorage）
  FileAdapter   … マップの読み書き・書き出し（Web=Google Drive + <a download>）
  SecretAdapter … APIキーの保管（Web=マスターパスワード + AES-GCM）
  HttpAdapter   … HTTP の送出（Web=ブラウザの fetch。ここが Ollama の CORS 回避点）
  SystemAdapter … クリップボード・外部URL・終了前確認・通知
```

Web版は引き続きバックエンドサーバーを持たない SPA で、Anthropic API と Google Drive API を
ブラウザから直接叩き、localStorage に永続化する。

> **デスクトップアプリ版について（Phase 34 で骨格を実装）**
> Tauri v2 によるデスクトップアプリ版（`apps/desktop`）の骨格を実装し、マップ編集とローカルファイル保存ができる状態になっています。目的であるローカルLLM（Ollama）連携は Phase 35 で対応します。
> 設計は [desktop/README.md](desktop/README.md) を起点とする `docs/desktop/` 配下を参照してください。第18章に要点を記載しています。

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

Phase 33 で pnpm workspaces のモノレポへ移行した。詳細な設計根拠は
[desktop/architecture.md](desktop/architecture.md)、パッケージ間の裁定は
[desktop/README.md](desktop/README.md) §3 を参照。

```
ai-idea-map/
├── pnpm-workspace.yaml
├── package.json                     # ワークスペースルート（dev / build / lint / typecheck / test / sync-version）
├── tsconfig.json                    # 各プロジェクトを束ねる solution ファイル
├── tsconfig.base.json               # 共有 compilerOptions
├── eslint.config.js                 # 共有設定 + 依存方向の強制ルール
├── scripts/sync-version.mjs         # ルート package.json の version を4ファイルへ配布（Phase 36。--check でCIが検査）
├── .github/workflows/release-desktop.yml # デスクトップ版のビルド・GitHub Releases公開（Phase 36）
│
├── packages/
│   ├── platform/                    # Platform Adapter の「型」と registry のみ（他パッケージに依存しない）
│   │   └── src/
│   │       ├── types.ts             # StorageAdapter / FileAdapter / SecretAdapter / HttpAdapter / SystemAdapter
│   │       ├── registry.ts          # setPlatform / getPlatform
│   │       └── index.ts
│   │
│   ├── core/                        # 型・ストア・純粋ロジック・LLM 抽象化（UI を持たない）
│   │   ├── vitest.config.ts         # Vitest 設定（test.include: src/**/*.test.ts、Phase 41）
│   │   └── src/
│   │       ├── types/index.ts       # 型定義
│   │       ├── stores/
│   │       │   ├── mapStore.ts      # マップ状態のストア本体（スライスを合成するだけ）
│   │       │   ├── map/             # mapStore のスライス（Phase 29 で分割）
│   │       │   │   ├── types.ts     # IdeaNode / Snapshot / 各スライスの型・MapState
│   │       │   │   ├── constants.ts # ノード色・矢印マーカー・初期ノード・makeEdge（Phase 48 で packages/core の index.ts から export）
│   │       │   │   ├── history.ts   # past / future / undo / redo・snapshot / pushPast
│   │       │   │   ├── nodeSlice.ts # ノード追加・編集・削除・整列・コピー＆ペースト
│   │       │   │   ├── edgeSlice.ts # エッジ作成・向き変更・ラベル・削除
│   │       │   │   ├── groupSlice.ts   # グループ作成・所属変更・押し出し
│   │       │   │   └── documentSlice.ts # ロード・シリアライズ・リセット
│   │       │   ├── uiStore.ts       # UI状態。currentFileId・currentFileOrigin の永続化は StorageAdapter 経由
│   │       │   ├── settingsStore.ts # 設定状態。APIキーは SecretAdapter、Drive 同期は注入
│   │       │   └── mapSnapshot.ts   # buildMapFile(mapId) — 保存用スナップショットの組み立て（Phase 38）
│   │       ├── llm/                 # LLMプロバイダ抽象化（Phase 32 → Phase 33 で移動 → Phase 35 で Ollama 追加 → Phase 39 で OpenAI 追加）
│   │       │   ├── types.ts         # LLMProvider / LLMRequest / LLMError / isAbortError ほか
│   │       │   ├── jsonUtils.ts     # sanitizeJsonString / safeParseJson / AIParseError
│   │       │   ├── jsonUtils.test.ts # Vitest（Phase 41）。テスト対象と同じディレクトリに同居させる方式
│   │       │   ├── claudeProvider.ts # ClaudeProvider（Anthropic SDK 依存をここに閉じ込める）
│   │       │   ├── ollamaProvider.ts # OllamaProvider（/api/chat・/api/tags・/api/ps、Phase 35）
│   │       │   ├── openaiProvider.ts # OpenAIProvider（/v1/chat/completions・/v1/models、Phase 39）
│   │       │   ├── providerFactory.ts # settingsStore の状態から LLMProvider を生成（Phase 35、Phase 39 で OpenAI 対応）
│   │       │   └── aiService.ts     # AI機能9関数（旧 claudeService.ts。Phase 44 で extractMapFromText、Phase 45 で generateArtifactFromMap、Phase 47 で reviewMap、Phase 48 で debateNode 追加）
│   │       ├── services/
│   │       │   ├── driveService.ts  # Google Drive REST の薄いラッパー（Phase 38 で apps/web から移設。Web/Desktop共通、HttpAdapter経由）
│   │       │   ├── errorLog.ts      # 未捕捉エラーのリングバッファ（最大200件・StorageAdapter永続化、Phase 43）
│   │       │   ├── mapReview.ts     # 放置ノードの構造的指標検出（findNeglectedNodeIds、Phase 47）
│   │       │   └── textToMap.ts     # AI抽出結果 → SerializedNode/Edge 変換（buildMapFragmentFromExtracted、Phase 44）
│   │       ├── templates/mapTemplates.ts # 思考フレームワークのテンプレートマップ5種（Phase 46）
│   │       ├── layout/
│   │       │   ├── mapLayout.ts     # ノード自動配置ロジック（dagre・円形配置）
│   │       │   └── groupGeometry.ts # グループとノードの当たり判定・押し出し計算
│   │       ├── crypto/passwordCrypto.ts # PBKDF2 + AES-GCM の純粋関数
│   │       ├── utils/mapFileCompat.ts   # 旧バージョンのマップファイル互換処理
│   │       └── index.ts
│   │
│   └── ui/                          # React コンポーネントと UI hooks
│       ├── tailwind-preset.js       # デザイントークンの共有プリセット
│       └── src/
│           ├── App.tsx              # 共通シェル。プラットフォーム固有部分は props で受け取る
│           ├── index.css
│           ├── components/
│           │   ├── canvas/          # IdeaCanvas / IdeaNode / GroupNode / FloatingEdge / ContextMenu
│           │   ├── panels/          # NodePanel / NodeDetailPanel / AISuggestionPanel / SettingsPanel /
│           │   │                    # ExportImportPanel / MapAnalysisPanel / AIChatPanel / PresentationOrderPanel /
│           │   │                    # ArtifactPanel（Phase 45）/ PersonaDebatePanel（Phase 48）
│           │   ├── screens/         # PresentationMode
│           │   ├── toolbar/         # Toolbar（PC用）/ BottomNav（スマホ用）
│           │   └── common/          # Header / Toast / ConfirmDialog / InputDialog / SearchBar /
│           │                        # WelcomeModal / MasterPasswordModal / KeyboardShortcutsModal / ApiKeyRequired /
│           │                        # TemplatePickerModal（Phase 46）
│           ├── hooks/               # useAutoSave / useKeyboardShortcuts / useFocusTrap /
│           │                        # useNodeFocus / useOnlineStatus / useActiveProvider（Phase 35）/
│           │                        # useGlobalErrorLog（Phase 43）/ useSubtreeNodeIds（Phase 45）
│           ├── services/exportService.ts # 画像・JSON・Markdown の書き出しとインポート
│           ├── utils/markdown.ts    # Markdown→HTML変換ユーティリティ
│           └── index.ts
│
└── apps/
    ├── web/                         # Web版シェル（GitHub Pages 配信）
    │   ├── index.html
    │   ├── vite.config.ts           # base: '/ai-idea-map/'
    │   ├── tailwind.config.js       # packages/ui のプリセットを読み込む
    │   └── src/
    │       ├── main.tsx             # setPlatform → setAppSettingsSync → restorePersistedState() を await → render
    │       ├── WebApp.tsx           # Google 依存を集約し <App> に props で渡すシェル
    │       ├── platform/            # Adapter の Web 実装
    │       │   ├── storage.web.ts   # localStorage
    │       │   ├── file.web.ts      # Google Drive + ローカル控え + <a download>
    │       │   ├── secret.web.ts    # マスターパスワード方式（encryption.ts）
    │       │   ├── http.web.ts      # ブラウザの fetch
    │       │   ├── system.web.ts    # クリップボード / 外部URL / beforeunload / トースト
    │       │   └── index.ts
    │       ├── components/
    │       │   ├── panels/MapListPanel.tsx      # Drive のマップ一覧（Web専用）
    │       │   └── screens/FileOpenDashboard.tsx # 起動時のファイル選択（Web専用）
    │       ├── hooks/useGoogleAuth.ts   # GIS 認証（Web専用）
    │       ├── services/                # googleDriveService.ts は Phase 38 で packages/core/src/services/driveService.ts へ移設
    │       │   ├── storageService.ts     # localStorage のラッパー
    │       │   └── shareUrl.ts           # 共有URLの生成・解析（Web専用）
    │       ├── utils/encryption.ts       # APIキーの保存先（暗号化本体は core）
    │       └── types/google.d.ts         # GIS の型宣言
    │
    └── desktop/                     # デスクトップ版シェル（Tauri v2、Phase 34 で追加）
        ├── package.json
        ├── vite.config.ts           # devUrl 用に固定ポート 5174・strictPort（Tauri のウィンドウが空白になるのを防ぐ）
        ├── src-tauri/
        │   ├── tauri.conf.json      # ウィンドウ設定・CSP・capabilities・plugins.updater の割り当て・bundle.fileAssociations（Phase 36 で updater、Phase 37 で fileAssociations・dragDropEnabled: true）
        │   ├── Cargo.toml           # updater/process/single-instance/window-state は cfg(not(android/ios)) の対象外ターゲットに限定（Phase 36・Phase 37）
        │   ├── capabilities/        # main-window / file-access / ai-http / google-drive / updater の5ファイル（§18.5、google-drive は Phase 38、updater は Phase 36。single-instance/window-state はJSから呼ばないためcapability不要）
        │   └── src/
        │       ├── lib.rs           # プラグイン登録・invoke_handler（updater/process は #[cfg(desktop)]、Phase 36）。single-instance を最初に登録し `build()` + `run(closure)` 形式に変更（Phase 37）。`oauth::OauthServer` を `.manage()` し oauth コマンド2本を登録（Phase 38）
        │       ├── keychain.rs      # OSキーチェーン操作（has/get/set/clear_secret コマンド）
        │       ├── launch.rs        # `.ideamap` 起動引数の取り出し・2つ目インスタンスへの転送・fs スコープ付与（Phase 37、§18.8）
        │       └── oauth.rs         # Google OAuth ループバックサーバ（`start_oauth_loopback` / `cancel_oauth_loopback`、Phase 38、§18.9）
        └── src/
            ├── main.tsx             # setPlatform → restorePersistedState() を await → render
            ├── DesktopApp.tsx       # デスクトップ版シェル。Ctrl+O でネイティブ「開く」ダイアログ、起動5秒後の自動更新チェック（Phase 36）、起動引数ファイルの取り込みと外部変更検知の購読（Phase 37）、Drive アクセストークンを FileAdapter へ流し込む配線（Phase 38）
            ├── openMap.ts           # ファイルを開く共通処理（ダッシュボードと Ctrl+O が共用）
            ├── saveToDrive.ts       # いま開いているマップを Drive へ保存する共通処理（起動画面の DriveSection とヘッダーが共用、Phase 38 追加実装）
            ├── saveToLocal.ts       # いま開いているマップをローカルへ保存し直す処理（saveToDrive.ts の逆方向、ヘッダー専用、Phase 38 追加実装）
            ├── launchFile.ts        # `.ideamap` ダブルクリック起動・2つ目インスタンスからのイベントの受け入れ（Phase 37）
            ├── externalChange.ts    # 外部でのファイル変更検知（フォーカス復帰時に mtime 比較、Phase 37。Drive 上のマップは mtime を持たないため対象外、Phase 38）
            ├── updater.ts           # 自動更新のチェック・ダウンロード・適用（Phase 36）
            ├── googleAuth.ts        # ループバック + PKCE の認可フロー（signInWithGoogle / refreshAccessToken / revokeGoogleToken、Phase 38、§18.9）
            ├── hooks/useDesktopGoogleAuth.ts # Drive 認証状態フック。Web版 useGoogleAuth と同じ形の状態を返す（Phase 38）
            ├── components/
            │   ├── DesktopFileDashboard.tsx # 起動画面（最近開いたファイル・自動保存からの復帰・Googleドライブ欄、Phase 38 で DriveSection を追加）
            │   ├── DriveSection.tsx         # 起動画面の Google ドライブ欄（サインイン・一覧・開く・Driveへ保存、Phase 38）
            │   ├── FileDropOverlay.tsx      # ファイルドラッグ&ドロップ受け入れのオーバーレイ（Phase 37）
            │   └── UpdaterSection.tsx       # 設定パネル末尾の「アプリ情報」セクション（バージョン表示・手動更新チェック、Phase 36）
            └── platform/            # Adapter の Desktop 実装
                ├── index.ts
                ├── store.desktop.ts   # tauri-plugin-store の LazyStore 共有インスタンス（$APPCONFIG/app-data.json）
                ├── storage.desktop.ts # StorageAdapter
                ├── file.desktop.ts    # FileAdapter。`FileRef.origin` で分岐する複合アダプタ（ローカルファイル + 自動保存 + 最近開いたファイル、'cloud' は core の driveService 経由、Phase 38）
                ├── secret.desktop.ts  # SecretAdapter（OSキーチェーン、isPassphraseFree: true）
                ├── http.desktop.ts    # HttpAdapter（tauri-plugin-http）
                └── system.desktop.ts  # SystemAdapter（クリップボード・外部URL・終了前確認）
```

### 3.1 パッケージの責務と依存方向

| パッケージ | 置くもの | 置いてはいけないもの |
|---|---|---|
| `packages/platform` | Adapter の型定義と `setPlatform`/`getPlatform` | Adapter の実装、他パッケージへの依存 |
| `packages/core` | 型・ストア・レイアウト計算・暗号化・`LLMProvider`・Google Drive REST（`driveService.ts`、Phase 38） | `.tsx` のUI、`localStorage`/`fetch` の直接呼び出し |
| `packages/ui` | React コンポーネント・UI hooks | Google Drive / GIS 認証など特定プラットフォーム依存 |
| `apps/web` | Web版シェル、Adapter Web実装、GIS認証、共有URL | `packages/*` に置くべき汎用ロジックの重複実装 |
| `apps/desktop` | Tauri シェル、Adapter Desktop実装、`src-tauri`（Phase 34 で追加）、ループバック+PKCE認証（Phase 38） | Web専用機能（GIS認証・共有URL）の持ち込み |

依存方向は `apps/* → packages/ui → packages/core → packages/platform` の一方向のみ。
ESLint の `import/no-restricted-paths`・`no-restricted-imports`・`no-restricted-globals` で機械的に検出する。

**Phase 38 での変更**: Google Drive の REST 呼び出し自体（`googleDriveService.ts`）は `packages/core/src/services/driveService.ts` へ移り、Web版・デスクトップ版の両方から使う。一方、認証（Web版=GIS のポップアップ、デスクトップ版=ループバック+PKCE）とマップ一覧UI（`MapListPanel`/`FileOpenDashboard` と `DriveSection`/`DesktopFileDashboard`）は別実装のまま各 `apps/*` に残る（`docs/desktop/README.md` §3.1・§3.1-H）。

`getPlatform()` はモジュールのトップレベルではなく必ず関数の内部で呼ぶ
（`setPlatform()` より先に評価されるのを防ぐため）。

### 3.2 settingsStore の永続化と Adapter 接続（Phase 34 で解消）

Phase 33 時点では `settingsStore` の `persist` が zustand 既定の localStorage のままだった（StorageAdapter は非同期でハイドレーションが1マイクロタスク遅れ、初回描画がテーマ既定値で走ってちらつくため）。Phase 34 で StorageAdapter 経由の永続化に統一し、`skipHydration: true` と `restorePersistedState()` による明示的な復元に置き換えた。詳細は §4.3・§4.4 を参照。

---

## 4. 状態管理設計

### 4.1 mapStore（packages/core/src/stores/mapStore.ts）

マップの実体データと操作履歴を管理する中心的なストア。

**Phase 29 でスライス分割**: 実装は `packages/core/src/stores/map/` 配下の5スライス（history / node / edge / group / document）に分かれ、`mapStore.ts` はそれらを合成するだけになった。スライスは同じ `set`/`get` で `MapState` 全体を触れるため、`deleteNodes` がエッジも消すようなスライスをまたぐ更新はそのまま書ける。利用側のインタフェース（`useMapStore` から取れるアクション）は分割前と同一。

| スライス | 責務 |
|---|---|
| `history.ts` | `past` / `future` / `undo` / `redo`、履歴ヘルパー `snapshot` / `pushPast` |
| `nodeSlice.ts` | ノードの追加・更新・削除・整列・コピー＆ペースト、`onNodesChange` |
| `edgeSlice.ts` | エッジの作成・向き変更・ラベル編集・削除、`onEdgesChange` / `onConnect` |
| `groupSlice.ts` | グループ作成・解除・所属変更・枠外への押し出し |
| `documentSlice.ts` | `loadFromSerialized` / `getSerialized*` / `reset` / `pendingFitView` |


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
- `updateNodeTitle`, `updateNodeBody`, `updateNodeColor`, `updateNodeCategory`, `updateNodeUrl`, `updateNodeImage` — ノード更新。この6アクションに加え `mergeNodes`（keep側）・`applyClusterCategory` を含む計8箇所で、対象ノードの `data.updatedAt` を `new Date().toISOString()` に刻印する（Phase 49。AIガーデナーの放置ノード判定 §9.4.3 で使う）
- `deleteNode`, `deleteNodes`, `deleteSelected`, `deleteNodeEdges` — 削除系
- `reverseEdge`, `toggleEdgeDirection`, `updateEdgeLabel`, `deleteEdge` — エッジ操作
- `copyNodes`, `paste` — コピー・ペースト（Phase 22: `copyNodes` は選択ノード間のエッジも保存、`paste` は `Map<oldId,newId>` でエッジを再生成）
- `mergeNodes(keepId, mergeId)` — ノード統合（AIガーデナー「統合」提案の適用、Phase 47、§9.4.3）。`mergeId` の本文を `keepId` に連結し、`mergeId` 宛のエッジを `keepId` へ張り替え（張替えで自己ループになるものは除外、向き問わず同じペアになったものは1本に絞る）、`mergeId` を削除する。1回の `set`・`pushPast` 1回
- `addNodesWithEdges(nodes, edges)` — ノード配列とエッジ配列をまとめて1回の `set` で追加し、`past` に1回だけ積む（Phase 48）。ループで `addNode`/`onConnect` を繰り返すと1操作ごとに履歴が積まれ Undo が1ノードずつになってしまうため、「1操作＝複数ノード＋エッジ」向けの汎用アクションとして用意した。ペルソナ壁打ち（`PersonaDebatePanel`、§5.12）の子ノード一括追加で使用
- `alignSelectedNodes(type)` — 複数選択ノードを整列（Phase 21）。`'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom'`。`selected && !parentId && type !== 'groupNode'` のノードが対象（2件未満は何もしない）。変更前スナップショットを `past` に push
- `distributeSelectedNodes(direction)` — 複数選択ノードを等間隔配置（Phase 21）。`'horizontal' | 'vertical'`。対象3件未満は何もしない。中心座標でソートし、両端固定で中間を等間隔補間
- `setNodes(nodes)` — ノード配列を更新し履歴に積む。内部で `syncGroupMeasured` を通してグループノードの `measured` を同期
- `setNodesNoHistory(nodes)` — ノード配列を更新するが履歴に積まない（アニメーション途中フレーム用）（Phase 21）
- `commitNodesWithHistory(originalNodes, finalNodes)` — 最終フレームを確定し、整列前スナップショットを `past` に1回積む（Phase 21）
- `connectNodes(source, target)` — 接続モード方式のエッジ作成（Phase 26）。`onConnect` に委譲して履歴push・矢印マーカー付与・`addEdge` 重複排除を再利用。`source === target` のときは何もしない
- `connectDroppedNode(droppedId, parentId, returnPosition)` — ドラッグ&ドロップ接続（Phase 40、§5.2.1）。重ねられた側（親）→ ドラッグした側（子）のエッジ追加と、ドラッグしたノードを `returnPosition`（ドラッグ開始位置）へ戻す処理を1回の `set` にまとめる。`pushPast` はしない（§8.2 の履歴相乗り）。`droppedId === parentId`、または既に接続済み（向き問わず）なら何もしない
- `undo`, `redo` — 履歴操作
- `loadFromSerialized`, `getSerializedNodes`, `getSerializedEdges` — シリアライズ（旧 `text` フィールドを `title` に自動マイグレーション）。`updatedAt`/`url`/`image`（Phase 49）はそのまま往復させ、欠落している旧ファイルの値を捏造しない

内部ヘルパー（Phase 29 で `packages/core/src/layout/groupGeometry.ts` に集約）:
- `computePushOut(pos, measured, groupNodes, fallbackSize?)` — フリーノードをグループ枠外へ最小移動距離で押し出す。mapStore のドラッグ処理と `mapLayout.applyGroupPushOut` の両方から使う（Phase 29 で重複実装を統合。整列時は 192×64、ドラッグ時は 160×60 をフォールバックサイズに使う差分は引数で吸収）
- `findOverlappingGroup(pos, measured, groupNodes)` / `isOutsideParent(pos, measured, parentGroup)` / `clampInsideParent(...)` — グループ出入りダイアログの判定と位置補正
- `getGroupSize(group)` — `style.width/height` が number のときだけ採用し、それ以外は 400×300 を返す
- `syncGroupMeasured(nodes)` — グループノードの `style.width/height` を `measured` に同期。`setNodes` / `setNodesNoHistory` / `commitNodesWithHistory` で共通使用（Phase 21: `setNodes` から抽出）
- `expandGroupIds(ids, nodes)` — 削除対象にグループが含まれるとき子ノードIDも加えた集合を返す。`deleteNodes` / `deleteSelected` / `deleteGroupWithChildren` で共通使用（Phase 29）

### 4.2 uiStore（packages/core/src/stores/uiStore.ts）

UIの表示状態と、現在開いているマップのメタ情報（タイトル・fileId）を管理する。原則副作用なしだが、例外として `setCurrentFileId(id, origin?)` のみ fileId を `StorageAdapter`（キー `ideamap-drive-fileid`）と、保存先の種別（`origin`）を同じく `StorageAdapter`（キー `ideamap-file-origin`、Phase 38）と同期する。起動時の復元は非同期の `restoreCurrentFileId()` が担い、各アプリの `main.tsx` が最初のレンダー前に呼ぶ（`stores/bootstrap.ts` の `restorePersistedState()`、§4.4、Phase 34）。

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
| `currentFileId` | `string \| null` | 現在開いているファイルの ID（Web=Drive の fileId、Desktop=Drive の fileId またはローカル絶対パス、null=未保存の新規/インポート）。fileId の単一の真実源。`setCurrentFileId` で `StorageAdapter` と同期 |
| `currentFileOrigin` | `FileRef['origin'] \| null`（`'cloud' \| 'local'`） | `currentFileId` が指す保存先の種別（Phase 38）。デスクトップ版が Drive 上のマップとローカルファイルを同じ `useAutoSave` 経由で扱うために追加した。Web版は常に `'cloud'`。`currentFileId` が `null` のときだけ `null` になる。Phase 38 より前に永続化された値には origin が無いため、`restoreCurrentFileId()` はそれを読んだとき `FileAdapter.origin`（既定値）に寄せる（当時は保存先がアプリごとに1つだけだったので、これが正しい復元になる） |
| `toasts` | `Toast[]` | トースト通知リスト（4秒後自動削除） |
| `contextMenu` | `ContextMenuState \| null` | 右クリックメニューの表示状態 |
| `confirmDialog` | `ConfirmDialogState \| null` | 確認ダイアログの表示状態 |
| `inputDialog` | `InputDialogState \| null` | 1行入力ダイアログの表示状態（`window.prompt` の代替）（Phase 30） |
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
| `gardenerSuggestions` | `GardenerSuggestion[]` | AIガーデナー（マップレビュー）の提案リスト（Phase 47） |
| `isArtifactPanelOpen` | `boolean` | AI成果物生成パネル（`ArtifactPanel`）の開閉（Phase 45） |
| `isHistoryPanelOpen` | `boolean` | バージョン履歴パネル（`HistoryPanel`）の開閉（Phase 50） |
| `isTimelapsePlaying` | `boolean` | タイムラプス再生中フラグ（Phase 50）。`true` の間はキャンバスの編集操作・キーボードショートカット・ツールバー類をブロックする |
| `isPersonaDebatePanelOpen` | `boolean` | ペルソナ壁打ちパネル（`PersonaDebatePanel`）の開閉（Phase 48）。対象ノードIDは `selectedNodeId` を再利用し、専用の状態は持たない |
| `personaDebateResult` | `PersonaOpinion[]` | ペルソナ壁打ちのAI応答結果（Phase 48） |
| `isPersonaDebateLoading` | `boolean` | ペルソナ壁打ちのAI呼び出し中フラグ（Phase 48） |
| `isChatPanelOpen` | `boolean` | AIチャットパネルの開閉（Phase 14） |
| `chatMessages` | `ChatMessage[]` | チャット履歴（セッションメモリのみ、最大40件）（Phase 14） |
| `isChatLoading` | `boolean` | AIチャット応答待ちフラグ（Phase 14） |
| `isPresentationMode` | `boolean` | 発表モード中フラグ（Phase 15） |
| `isPresentationOrderOpen` | `boolean` | 発表順序編集モーダルの開閉（Phase 18） |
| `presentationNodeIds` | `string[]` | 発表順序を保持したノードIDリスト（Phase 15） |
| `presentationCurrentIndex` | `number` | 現在表示中のインデックス（0-based）（Phase 15） |
| `renderAllNodes` | `boolean` | 画像エクスポート時のみ true。`onlyRenderVisibleElements` を一時無効化して全ノードをDOM描画させ、マップ全体エクスポートの欠落を防ぐ（Phase 24） |
| `connectingFromNodeId` | `string \| null` | 接続モード中の接続元ノードID。null=接続モードでない。`setConnectingFromNodeId(id)` で更新（Phase 26） |
| `dragOverNodeId` | `string \| null` | ドラッグ中のノードが重なっている接続先候補ノードID（ドロップでエッジ作成・緑リング表示、§5.2.1）。null=重なりなし。`setDragOverNodeId(id)` で更新（Phase 40） |

### 4.3 settingsStore（packages/core/src/stores/settingsStore.ts）

設定と永続化を担当。APIキーはマスターパスワード方式で暗号化して保存（Phase 27〜）。

| 状態 | 型 | 説明 |
|------|-----|------|
| `apiKey` | `string` | Claude APIキー（メモリ上・永続化しない） |
| `llmProvider` | `LLMProviderId` | `claude \| ollama \| openai`（Phase 39 で `openai` を追加）。Web版は常に `'claude'`（切り替えUIを出さない）（Phase 35）。設定UI側の全プラットフォーム対応は別途進行中 |
| `claudeModel` | `string` | `claude-sonnet-5 \| claude-haiku-4-5-20251001`（旧 `aiModel` を改名。Phase 35） |
| `openaiApiKey` | `string` | OpenAI APIキー（メモリ上・永続化しない、`SecretAdapter` の `openaiApiKey` スロットに保管）（Phase 39） |
| `openaiModel` | `string` | OpenAI の使用モデル（`/v1/models` の `id`）。未選択は `''`（`OpenAIProvider` が既定モデル `DEFAULT_OPENAI_MODEL`＝`'gpt-5.1'` にフォールバック）（Phase 39） |
| `ollamaModel` | `string` | Ollama の使用モデル（`/api/tags` の `name`）。未選択は `''`（Phase 35） |
| `ollamaBaseUrl` | `string` | Ollama の接続先URL。既定値は `OllamaProvider.DEFAULT_OLLAMA_BASE_URL`（`http://localhost:11434`）（Phase 35） |
| `webSearchApiKey` | `string` | ollama.com の Web Search APIキー（メモリ上・永続化しない、`SecretAdapter` の `webSearchApiKey` スロットに保管。Claude用の `apiKey` スロットとは別）（Phase 35 追加実装） |
| `webSearchEnabled` | `boolean` | AIに聞く前にWeb検索するか。アイデア提案・AIチャット・マップ分析（全体分析）の3機能で共有するトグル（`persist` 対象、既定 `false`）（Phase 35 追加実装） |
| `suggestionCount` | `number` | AI提案件数（3〜7） |
| `autoSave` | `boolean` | 自動保存のオン/オフ |
| `theme` | `Theme` | `light \| dark` |
| `nodeShape` | `NodeShape` | `rounded \| ellipse \| hexagon`（ノード形状） |
| `categories` | `Category[]` | カテゴリ一覧（デフォルト7件＋ユーザー追加分、localStorage永続化） |
| `snapToGrid` | `boolean` | グリッドスナップの有効/無効（default: `false`、localStorage永続化）（Phase 21） |
| `edgeStyle` | `EdgeStyle` | `bezier \| smoothstep \| straight`（エッジ描画パス種別、default: `'bezier'`、localStorage永続化）（Phase 21-F） |
| `syncPassword` | `string` | マスターパスワード（ローカル暗号化とDrive同期で共用・永続化しない） |
| `apiKeyLock` | `'none' \| 'locked' \| 'unlocked'` | APIキーのロック状態（`none`=未保存、`locked`=要復号、`unlocked`=メモリ展開済み・永続化しない） |
| `needsMasterPasswordSetup` | `boolean` | 移行後またはキー入力後にパスワード設定を促すセッションフラグ（永続化しない） |
| `masterPasswordPromptDismissed` | `boolean` | 「スキップ」したセッションフラグ（永続化しない） |

**永続化（`persist` ミドルウェア、Phase 34 で StorageAdapter 経由に変更）:**
- `storage` は `createJSONStorage(() => ({ getItem/setItem/removeItem }))` で `getPlatform().storage` に委譲する（Web=localStorage、Desktop=`@tauri-apps/plugin-store`）
- `skipHydration: true`。ストア生成時には自動復元されず、`stores/bootstrap.ts` の `restorePersistedState()`（§4.4）を各アプリの `main.tsx` が最初のレンダー前に `await` する
- `partialize` で `apiKey` / `openaiApiKey`（Phase 39） / `webSearchApiKey`（Phase 35 追加実装） / `syncPassword` / ロック状態を除いた項目のみ永続化（`openaiModel` は永続化対象）
- `version: 2`（Phase 35。Phase 29〜34 は `version: 1`）+ `migrate`: v1→v2 で `aiModel` を `llmProvider`（常に `'claude'` で初期化）・`claudeModel`・`ollamaModel`・`ollamaBaseUrl` に分割する。`claudeModel` は `normalizeClaudeModel`（旧 `normalizeAiModel` を改名）で現行IDへ読み替える。廃止した `claude-sonnet-4-6` や未知の値は既定モデル（`claude-sonnet-5`）へ倒す。Drive から設定を読み込む `loadSettingsFromDrive` も同じ関数を通す。**Ollama の接続先URL・モデルは Drive 同期対象に含めない**（端末ローカルのサービスを指すため、他デバイスに同期しても意味がない）。**OpenAI の APIキー・使用モデルも Drive 同期対象に含めない**（Phase 39。`saveSettingsToDrive`/`loadSettingsFromDrive` は Claude APIキー・Claudeモデルのみを扱う従来のまま）。`openaiModel` を永続化フィールドに加えたが初期値は `''` のため、`version` は 2 のまま据え置き `migrate` の変更は不要だった

**APIキー管理アクション（Phase 27 / Phase 34 で `SecretAdapter.isPassphraseFree` 分岐を追加 / Phase 39 で OpenAI キーを対応に追加）:**
- `secret.isPassphraseFree` が `true`（デスクトップ版のOSキーチェーン）のときは、マスターパスワードの概念を経由しない。`setApiKey` は `syncPassword` を無視して `secret.setSecret(key)` にそのまま預け、即座に `apiKeyLock: 'unlocked'` にする。`initApiKey` も起動時に `secret.getSecret()` を読むだけで `apiKeyLock` を `'locked'` にしないため、`MasterPasswordModal` は一度も表示されない
- `initApiKey()` — 起動時に呼ぶ（旧 `loadApiKey` を置換）。`isPassphraseFree` でない場合: Claude・OpenAI いずれかの新形式キーあり→`locked`、旧形式（ハードコード鍵、Claudeキーのみ存在）あり→自動移行・`unlocked`・`needsMasterPasswordSetup=true`、なし→`none`（Phase 39: Claudeキーが無くても OpenAI キーだけ保管されている場合があるため、両方の有無を見てから判定する）
- `unlockApiKey(password)` — マスターパスワードで Claude・OpenAI 両方のキーをまとめて復号し `unlocked` にする（Phase 39。同じマスターパスワードで暗号化されているため、1件でも保管があればパスワード検証になる）
- `setMasterPassword(password)` — マスターパスワードを設定し、メモリ上の apiKey・openaiApiKey を新形式で再暗号化する（旧形式が存在するのは Claude キーのみのため、削除は Claude キーだけ行う）
- `dismissMasterPasswordPrompt()` — 設定促進をセッション中スキップ

**OpenAIキー管理アクション（Phase 39）:**
- `storeProviderSecret(secretKey, value, syncPassword)` — Claude 以外のプロバイダの秘密情報を保管する内部ヘルパー。保存先の選び方（OSキーチェーン／マスターパスワード暗号化／メモリのみ保持して `needsMasterPasswordSetup` を立てる）は `setApiKey` と同じ規則に揃えている。`apiKeyLock` は Claude APIキー専用の状態なので触らない
- `setOpenaiApiKey(key)` — `storeProviderSecret()` 経由で `SecretAdapter` の `openaiApiKey` スロットに保管
- `setOpenaiModel(model)` — 選択モデルを更新（`persist` 対象）

**モデル選択アクション（Phase 35・Phase 39 で OpenAI 対応を追加）:**
- `setLlmProvider(provider)` / `setClaudeModel(model)` / `setOpenaiModel(model)` / `setOllamaModel(model)` / `setOllamaBaseUrl(url)`
- `packages/core/src/llm/providerFactory.ts` の `getActiveProvider(settings)` / `isProviderReady(settings)`（§9.0.1）が `llmProvider` / `apiKey` / `claudeModel` / `openaiApiKey` / `openaiModel` / `ollamaModel` / `ollamaBaseUrl` の7項目から `LLMProvider` インスタンスと準備状態を導出する。**旧 `getActiveModelSelection()` セレクタと `AIModelSelection` 型はどこからも呼ばれていなかったため Phase 39 で削除した**（§6）

**Web検索キー管理アクション（Phase 35 追加実装）:**
- `setWebSearchApiKey(key)` — `secret.isPassphraseFree`（デスクトップ版のOSキーチェーン）のときだけ `secret.setSecret('webSearchApiKey', key)` に保管する。Web版では保管先を持たせない。キーを空にすると `webSearchEnabled` も自動で `false` に戻す
- `setWebSearchEnabled(enabled)` — 3機能で共有するトグル
- `initApiKey()` は `secret.isPassphraseFree` のときだけ、起動時に Claude APIキーと合わせて `webSearchApiKey` もキーチェーンから読む

### 4.4 bootstrap.ts — 永続化状態の復元（packages/core/src/stores/bootstrap.ts、Phase 34）

`StorageAdapter` が非同期なため、ストア生成時には設定と `currentFileId` を読めない。`restorePersistedState()` は `useSettingsStore.persist.rehydrate()` と `useUIStore.getState().restoreCurrentFileId()` を `Promise.all` で並行実行し、両方の完了を待つ1つの関数にまとめている。

各アプリの `main.tsx`（`apps/web/src/main.tsx` / `apps/desktop/src/main.tsx`）は `setPlatform()` の直後にこれを呼び、`.finally()` で初回の `createRoot(...).render()` を行う。レンダー後に復元すると、テーマが既定値（`light`）で一瞬描画されてちらつき、`currentFileId` が未復元のまま自動保存が走って別ファイルを新規作成してしまうため、レンダー前に完了させる設計にしている。

---

## 5. コンポーネント設計

### 5.1 App（packages/ui/src/App.tsx）

`ReactFlowProvider` でアプリ全体をラップ。`AppInner` で以下のフックを最上位でマウント:
- `useKeyboardShortcuts()` — グローバルキーイベント
- `useAutoSave(options)` — マップ変更監視と自動保存。保存先は `FileAdapter`。
  `options.onSaveError(err, attempt)` が `'retry'` を返すと `credentialKey` 更新時に再保存する（Phase 19 / Phase 33）

Phase 33 以降、プラットフォーム固有の部分は props で受け取る（`AppProps`）:

| props | 用途 | Web版が渡すもの |
|---|---|---|
| `cloudAuth` | クラウド認証の状態。未指定ならクラウド関連UIを描画しない | `useGoogleAuth()` の戻り値 |
| `autoSave` | 自動保存の可否とエラー時の扱い | アクセストークンと 401 リトライ方針 |
| `mapListSlot` | クラウドのマップ一覧パネル | `<MapListPanel>` |
| `dashboardSlot` | 起動時のファイル選択画面 | `<FileOpenDashboard>` |
| `onGenerateShareUrl` | 共有URL生成。未指定でも「共有」タブは出るが、「JSONファイルとして共有」の代替案内になる（Phase 37） | `generateShareUrl` |
| `settingsExtraSections`（Phase 36） | 設定パネル末尾に足すプラットフォーム固有セクション。未指定なら何も描画しない | （Web版は渡さない） |
| `onSaveToCloud`（Phase 38 追加実装） | いま開いているマップをクラウドへ保存し直す。`Header` の「接続済み」メニューに「このマップをドライブに保存」項目を出す（未指定、または `currentFileOrigin === 'cloud'` のときは出さない） | （Web版は渡さない） |
| `onSaveToLocal`（Phase 38 追加実装） | いま開いているマップをローカルファイルへ保存し直す（`onSaveToCloud` の逆方向）。`Header` の同メニューに「このマップをローカルに保存」項目を出す（未指定、または `currentFileOrigin !== 'cloud'` のときは出さない） | （Web版は渡さない） |

`cloudAuth` の有無は `SettingsPanel` にも `showCloudSync`（`cloudAuth != null`）として伝播する（Phase 34）。**Phase 38 でデスクトップ版も `cloudAuth` を渡すようになったため、この条件だけでは足りなくなった。** `SettingsPanel` は `showCloudSync` に加えて `isKeychainBacked`（`SecretAdapter.isPassphraseFree`）が false であることも条件にし、`DriveSyncSection`（マスターパスワード設定を兼ねた設定の Drive 同期）を Web版でだけ描画する。デスクトップ版はマスターパスワードを持たず `setAppSettingsSync()` も未注入のため、出してしまうと押した時点で失敗する（`docs/desktop/README.md` §3.1-H #12・#13）。

ヘッダーの保存先表示（`saveTarget`）も同じ理由で条件を足した。`isSignedIn && currentFileId` だけだと、デスクトップ版でサインイン中にローカルファイルを開いている状態を「Drive」と誤表示するため、`currentFileOrigin === 'cloud'` を加えている（Phase 38、§4.2）。

`settingsExtraSections` は `SettingsPanel` に `extraSections` props としてそのまま渡り、設定パネル最後尾（「保存」セクションの後）に描画される。`packages/ui` からプラットフォーム実装への依存を避けるための注入口で、デスクトップ版は `<UpdaterSection>`（バージョン表示・更新チェック、Phase 36）を渡す（§18.7）。

`Header` の `showMapList` は `App` が `mapListSlot != null` から算出して渡す（Phase 38 追加実装。`AppProps` には現れない）。`mapListSlot` を持たないデスクトップ版では、モバイル用アイコンボタンと「接続済み」メニューの「マップ一覧」項目が押しても何も起きなかったため、`showMapList` が `false` のときはどちらも描画しない。

終了前確認は `SystemAdapter.onBeforeExit`、ウェルカム表示フラグは `StorageAdapter` 経由。

テーマ適用: `settingsStore.theme` に応じて `<html>` の `dark` クラスを切替。

発表モード中（`isPresentationMode: true`）: ヘッダー・NodePanel・各種サイドパネルを非表示。`PresentationMode` コンポーネントが全面オーバーレイとして表示される。

### 5.1.1 PresentationMode（packages/ui/src/components/screens/PresentationMode.tsx）

`createPortal(content, document.body)` で `<body>` 直下にレンダリング（z-index: 100）。`isPresentationMode: false` のとき `null` を返す。

内部で `useReactFlow().fitView` を呼び出し、`presentationCurrentIndex` が変わるたびにカレントノードへズームアニメーション（duration: 600ms, padding: 0.4, maxZoom: 1.5）。

**レイアウト:**
- 左エリア（`flex-1`）: `pointer-events: none` でキャンバスへのクリックをスルー
- 右スライドパネル（`w-[480px]`）: カレントノードのタイトル（text-4xl）＋本文（text-xl）＋ドットインジケーター
- 下部ナビバー（`fixed bottom-0`）: 前へ/次へボタン、X/N カウンター、終了ボタン

### 5.1.2 ファイルダッシュボードの共通化（packages/ui/src/hooks/useFileDashboard.ts、Phase 34）

起動画面（ダッシュボード）は保存先の既定が Web版=Google Drive、デスクトップ版=ローカルファイルで異なるため、コンポーネント自体は別物のまま（`apps/web/src/components/screens/FileOpenDashboard.tsx` と `apps/desktop/src/components/DesktopFileDashboard.tsx`）だが、「マップを決めてキャンバスに入る」までのストア操作は同一なので `useFileDashboard.ts` に集約している。デスクトップ版は Phase 38 で `DesktopFileDashboard.tsx` に Google ドライブ欄（`DriveSection.tsx`、§18.9）を追加し、ローカルファイルと Drive のどちらからも開けるようになった。

| エクスポート | 用途 |
|---|---|
| `startNewMap()` | 新規マップを作ってキャンバスに入る（`mapStore.reset()` → タイトル・`currentFileId`・`currentMapId`・発表順序・保存状態を初期化 → ダッシュボードを閉じる） |
| `openLoadedMap(data, fileId, fallbackTitle, origin?)` | 読み込んだ `MapFile` をストアへ反映してキャンバスに入る。`fileId`（Web=Drive の fileId、Desktop=Drive の fileId またはローカル絶対パス）が `null` のときは保存先未確定を意味し、以後の保存は新規作成 or 保存ダイアログに進む。`origin`（Phase 38）は `setCurrentFileId` にそのまま渡り、以後の自動保存の向き先を決める。省略時は `FileAdapter` の既定に従う |
| `useDashboardEscapeToClose()` | マップを開いた後の再表示時のみ `Esc` でダッシュボードを閉じるキーハンドラ（`hasActiveMap` かつ確認ダイアログ非表示のときだけ発火） |

`DesktopFileDashboard` はマウント時に `getPlatform().file.listRecent()` で最近開いたファイル一覧を、`loadLastAutosave()`（`apps/desktop/src/platform/file.desktop.ts` が named export）で自動保存の控えを取得して「前回の作業を再開」カードに表示する。ファイルを開く経路（一覧クリック・「ファイルを開く」ボタン）は `apps/desktop/src/openMap.ts` の `openMapFile()` に集約し、`Ctrl+O`（`DesktopApp.tsx`）とダッシュボードの両方から同じ関数を呼ぶことで状態遷移を一本化している。

### 5.1.3 TemplatePickerModal（packages/ui/src/components/common/TemplatePickerModal.tsx、Phase 46）

`MAP_TEMPLATES`（`packages/core/src/templates/mapTemplates.ts`）を一覧表示し、選択すると `useFileDashboard.ts` の `startNewMapFromTemplate(templateId)` を呼ぶモーダル。`createPortal(content, document.body)` で `<body>` 直下に描画する（`z-[60]` でダッシュボードより手前）。

開閉状態は uiStore ではなく、`apps/web/src/components/screens/FileOpenDashboard.tsx` / `apps/desktop/src/components/DesktopFileDashboard.tsx` それぞれのローカル state（`showTemplates`）で管理する。両ダッシュボードの「新規作成」ボタンの隣に「テンプレート」ボタンを追加し、`<TemplatePickerModal>` を直接レンダリングする（`App.tsx` には追加しない）。

`startNewMapFromTemplate(templateId)`（`useFileDashboard.ts`）は `startNewMap()` と同じ「保存先の紐付けをリセットする」手順を踏む: `mapStore.reset()` → `loadFromSerialized(template.nodes, template.edges)` → `setMapTitle(template.mapTitle)` → `setCurrentFileId(null)` → `setCurrentMapId(null)` → `setPresentationNodeIds([])` → `setSaveStatus('unsaved')` → `setFileDashboardOpen(false)`。

### 5.2 IdeaCanvas（packages/ui/src/components/canvas/IdeaCanvas.tsx）

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
- `onNodeDragStart` / `onNodeDrag` / `onNodeDragStop` → ドラッグ&ドロップ接続（Phase 40、§5.2.1）

フォーカス／発表／接続モードの dim は `FocusStateContext` 経由で各ノード・エッジに配る（§16.3）。`<ReactFlow>` に渡す `nodes` / `edges` はストアの配列そのままで、加工しない。

### 5.2.1 ドラッグ&ドロップ接続（Phase 40）

ノードをドラッグして別の `ideaNode` に重ねると、ドロップでエッジを作成できる。ハンドルドラッグ・接続モード（§17.8「接続モード方式」）に続く3つ目のエッジ作成手段。

- `handleNodeDragStart` — ドラッグ開始位置を `dragStartPosRef` に記録する（Undo/接続後にノードを戻す位置）
- `handleNodeDrag` — ドラッグ中のノードの中心座標が、未接続の別 `ideaNode` の矩形に入っているかを毎フレーム判定する。子ノードの `position` は親相対のため、絶対座標に直してから判定する。対象が見つかれば `uiStore.setDragOverNodeId(id)` でハイライト（緑リング＋ガイドツールチップ「ドロップでこのアイデアを親にして接続」、§5.3）。複数選択ドラッグ（掴んだノード以外にも `selected` があるとき）とグループノードは対象外
- 既に接続済みの相手（`source`/`target` の向き・双方向を問わず）はハイライトされず、ドロップしても何も起きない＝通常の移動として扱う（誤操作でのエッジ削除事故を防ぐ設計判断）
- 接続先ノードに重なっている間はグループのドロップハイライト（`dragOverGroupId`）を消し、接続先ノードを優先する
- `handleNodeDragStop` — `dragOverNodeId` が立っていれば `mapStore.connectDroppedNode(draggedId, targetId, startPosition)` を呼び、重ねられた側（親）→ ドラッグした側（子）のエッジを作成すると同時にドラッグしたノードを開始位置へ戻す（「重ねる」は接続ジェスチャであって移動ではない。新しいアイデアを作って親に重ねる操作が自然なため、重ねられた側を親とする）。トースト「接続しました」を表示
- `nodeSlice.onNodesChange` は `uiStore.dragOverNodeId` が立っている間、ドロップ位置でのグループ出入り判定（「グループに追加」ダイアログ・押し出し）を行わない。位置は直後に開始位置へ戻されるため、判定しても意味がない
- Undo/Redo の扱い（履歴への相乗り）は §8.2 を参照

### 5.3 IdeaNode（packages/ui/src/components/canvas/IdeaNode.tsx）

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
- ドロップ接続先候補（`dragOverNodeId === id`、Phase 40・§5.2.1）: 緑リング `outline: 3px solid #10b981` ＋ `NodeToolbar` によるガイドツールチップ「ドロップでこのアイデアを親にして接続」（ズーム非依存）

**関連リンク・画像添付（Phase 49）:**
- `data.image` があれば本文の下にサムネイル（`<img>`、`max-h-20 object-cover`）を表示する
- `data.url` があれば `new URL(url).hostname` で取得したドメイン名をリンクチップ（`🔗 ドメイン名`）として表示する。不正なURL（`new URL()` が例外を投げる）はチップ自体を表示しない。クリックで `getPlatform().system.openExternalUrl(url)` を呼ぶ（`SystemAdapter.openExternalUrl` は既存メソッド。§5.10 の `ExternalLink` と同じ Adapter 経由だが、IdeaNode 自身がボタンとして実装しておりコンポーネント共有はしていない）

**インライン編集（タイトルのみ）（Phase 22）:**
- ダブルクリック / F2 / 右クリック「名前を変更」で `uiStore.editingNodeId` を設定 → textarea 表示
- Enter (Shift なし) または blur でコミット、Escape で変更破棄
- 本文があるノードは左上に 📝 バッジを表示。バッジクリック → `openNodeDetail(id)`（詳細モーダルへの導線を維持）
- 本文の冒頭をノードカード内にプレビュー表示（2行）
- ノード作成直後（キャンバスダブルクリック・ツールバー追加・Tab・Enter・右クリック作成）は自動で編集モード開始

**モバイル対応:**
- ロングプレス 500ms → 選択 + AI提案パネルを開く
- `onTouchMove` でロングプレスタイマーをキャンセル（誤発火防止）

### 5.4 ContextMenu（packages/ui/src/components/canvas/ContextMenu.tsx）

`createPortal(content, document.body)` で `<body>` 直下にレンダリング（z-index問題を回避）。

メニュー位置の調整:
```typescript
const left = Math.max(8, Math.min(x, window.innerWidth - MENU_WIDTH - 8))
const top = Math.max(8, Math.min(y, window.innerHeight - 320))
```

| メニュー種別 | 表示項目 |
|---|---|
| node | **名前を変更（F2）**（Phase 22）/ 詳細を開く / アイデアを作成（接続）/ AIで拡張 / 🎭 ペルソナで壁打ち（Phase 48）/ コピー / 発表に追加（または発表から除外）/ カテゴリを変更 / **整列セクション**（Phase 21・選択2件以上で表示）/ 接続線のみ削除 / ノードを削除 |
| edge | 向きを反転 / 双方向切替 / ラベルを編集 / 線を削除 |
| pane | アイデアを作成（作成後インライン編集開始・Phase 22）/ グループを作成 / ここに貼り付け |

**整列セクション（Phase 21）**: ノードメニューで `alignableCount >= 2`（`selected && !parentId && type !== 'groupNode'` の件数）のとき Divider 付きで追加。⬅ 左揃え / ⬆ 上揃え / ↔ 左右中央 / ↕ 上下中央。`alignableCount >= 3` のとき追加で ⇿ 横に等間隔 / ⇳ 縦に等間隔。各項目は `run()` ヘルパー経由でアクション実行後 `closeContextMenu()`。

**ラベル編集（Phase 30）**: エッジの「ラベルを編集」・グループの「ラベルを編集」は `window.prompt` をやめ、`uiStore.openInputDialog()`（§5.6.1）を経由する。グループ名は空入力時に `'グループ'` へフォールバック、エッジラベルは空入力＝ラベル削除。

**アクセシビリティ（Phase 30）**: メニュー本体に `role="menu"` とメニュー種別ごとの `aria-label`、各項目に `role="menuitem"`、Divider に `role="separator"` を付与。カテゴリ一覧は `role="group"` ＋ 各項目 `role="menuitemradio"` / `aria-checked`、「カテゴリを変更」項目には `aria-haspopup` / `aria-expanded` を付ける。

### 5.5 WelcomeModal（packages/ui/src/components/common/WelcomeModal.tsx）

初回起動時のみ表示。`localStorage.getItem('ideamap-welcomed')` がなければ表示し、閉じ時にセット。  
3ステップ（アイデア追加 / 接続 / AI拡張）のスライドモーダル。`createPortal` で `<body>` に描画。  
最終ステップ（3ステップ目）に「❓ ボタンまたは Ctrl+/ で操作ガイドを確認できます」のヒントを表示（Phase 22 G）。

### 5.5.1 KeyboardShortcutsModal（packages/ui/src/components/common/KeyboardShortcutsModal.tsx）

`uiStore.isShortcutsModalOpen` で制御。`createPortal` で `<body>` に描画。  
`Ctrl+/` ショートカットのほか、Toolbar の ❓ ボタン（デスクトップ）・BottomNav の「ヘルプ」ボタン（モバイル）から開ける（Phase 22 G）。  
**見出し**: 「操作ガイド」（Phase 22 G で「キーボードショートカット」から変更）。  
**内容**: キーボードショートカット（基本操作・ノード編集・表示検索・検索バー内・ダイアログ）＋マウス・タッチ操作セクション。  
「表示・検索」セクションには実装済みの `Ctrl+Shift+C`（AIチャット）と `Ctrl+P`（発表モード）も記載する（Phase 30 で追記）。

### 5.6 ConfirmDialog（packages/ui/src/components/common/ConfirmDialog.tsx）

取り消しにコストがある操作の前に表示する共通ダイアログ。呼び出し元は `uiStore.openConfirmDialog()`。

**表示する操作（Phase 30 時点）**

| 操作 | 条件 | 呼び出し元 |
|---|---|---|
| ノード削除（右クリックメニュー） | 接続線があるときのみ | `ContextMenu.handleDeleteNode` |
| ノード削除（NodeActionBar の 🗑） | 接続線があるときのみ（Phase 30） | `IdeaCanvas.NodeActionBar.handleDelete` |
| グループと子ノードの削除 | 常に | `ContextMenu.handleDeleteGroupChoice` |
| AIチャットの履歴クリア | 常に（Phase 30） | `AIChatPanel.handleClearHistory` |
| ノード詳細の編集破棄 | 未コミットの変更があるときのみ（Phase 30） | `NodeDetailPanel.requestClose` |
| 共有URLインポート・保存衝突 | — | `App` / `useAutoSave` |

- `Enter` → 確認、`Escape` → キャンセル（ショートカット有効）。ただしボタンにフォーカスがある状態の `Enter` はボタン自身の click に任せ、二重実行を防ぐ（Phase 30）
- `confirmDialog` 表示中はキャンバス操作ショートカット全体を抑制
- `role="dialog"` / `aria-modal` / `aria-labelledby` を付与し、`useFocusTrap` で確定ボタンへ初期フォーカス＋Tab をダイアログ内に閉じ込める（Phase 30）

### 5.6.1 InputDialog（packages/ui/src/components/common/InputDialog.tsx）（Phase 30）

`window.prompt` の代替となる1行入力ダイアログ。`uiStore.openInputDialog()` で開く。エッジのラベル編集・グループ名の編集で使用（`window.prompt` はスマホでフォーカスやスタイルが破綻するため置換）。

| `InputDialogState` | 型 | 説明 |
|---|---|---|
| `title` / `message` | `string` | 見出しと補足文 |
| `initialValue` / `placeholder` | `string` | 入力欄の初期値とプレースホルダ |
| `confirmLabel` | `string` | 確定ボタンのラベル（既定 `'保存'`） |
| `allowEmpty` | `boolean` | 空文字での確定可否（既定 `true`。エッジラベルは空＝削除） |
| `onSubmit` / `onCancel` | `(value: string) => void` / `() => void` | 確定時（trim 済みの値）・キャンセル時 |

- 入力状態は内部の `DialogContent` にマウント単位で持たせ、開くたびに `initialValue` から始まる（`MasterPasswordModal` と同じ方式）
- `Enter` で確定、`Escape` / 背景クリック / キャンセルで中断。`useFocusTrap` で入力欄に初期フォーカス
- `inputDialog` 表示中はキャンバス操作ショートカットを抑制（`useKeyboardShortcuts`）

### 5.6.2 useFocusTrap（packages/ui/src/hooks/useFocusTrap.ts）（Phase 30）

モーダル内に Tab フォーカスを閉じ込め、閉じたときに開く前の要素へフォーカスを戻す共通フック。`useFocusTrap(containerRef, active, initialFocusRef?)`。

- 適用先: `ConfirmDialog`（初期フォーカス＝確定ボタン）/ `InputDialog`（＝入力欄）/ `NodeDetailPanel` / `KeyboardShortcutsModal` / `MasterPasswordModal`
- モーダルが重なった場合（詳細パネルの上に確認ダイアログ等）は、DOM 上で最後にある `[role="dialog"]` を最前面とみなし、そこだけがトラップを効かせる

### 5.7 ApiKeyRequired（packages/ui/src/components/common/ApiKeyRequired.tsx）（Phase 29 / Phase 35 でプロバイダ分岐を追加 / Phase 39 で OpenAI 分岐を追加）

AI機能の前提設定が未完了のときに AI系パネル（AISuggestionPanel / MapAnalysisPanel / AIChatPanel）が表示する空状態。3パネルで重複していたマークアップを共通化したもの。

| Props | 型 | 説明 |
|---|---|---|
| `onOpenSettings` | `() => void` | 「設定を開く」押下時の処理。呼び出し元パネルを閉じて設定パネルを開く |
| `className` | `string` | 配置差分の吸収用。既定は `'flex-1 p-6'`、AISuggestionPanel のみ `'px-5 py-10'` |
| `providerId` | `LLMProviderId`（既定 `'claude'`） | Phase 35 追加。文言をプロバイダごとに切り替える |

**Phase 39 で `isOllama` の二値分岐から `Record<LLMProviderId, { icon, title, hint }>` の文言テーブル（`MISSING_SETUP`）に変更した。** プロバイダを追加したとき文言の追加漏れを型エラーで検出できる。`ollama` は 🖥️「使用するOllamaモデルが未選択です／設定画面の『AIプロバイダ』で接続テストを実行し、モデルを選んでください」、`openai` は 🔑「OpenAI APIキーが必要です／AI機能を使うには OpenAI の APIキーを設定してください」（`claude` と同じ 🔑 アイコン）。

ボタン配色は `primary-600` に統一（旧 AIChatPanel の `blue-500` から変更）。呼び出し元3パネルは `useActiveProvider()` の `providerId` をそのまま渡す（§9.0.1）。

### 5.8 NodeDetailPanel の閉じ方（Phase 30）

入力欄の `blur` で保存する仕組みは維持したうえで、閉じる操作の意味を IdeaNode のインライン編集（Esc=破棄）と揃えた。

| 操作 | 挙動 |
|---|---|
| `Esc` / 背景クリック | 未コミットの変更がなければそのまま閉じる。あれば「編集内容を破棄しますか？」を表示（3択: キャンセル / 保存して閉じる / 破棄して閉じる） |
| ✕ ボタン | 保存して閉じる（`title` / `aria-label` に明示） |
| `Ctrl+Enter`（本文） | 保存して閉じる |

実装上の要点:

- 未コミット判定は `titleInput !== node.data.title || bodyInput !== (node.data.body ?? '') || urlInput !== (node.data.url ?? '')`（Phase 49 で `urlInput` を追加）。blur 済みの変更はストアへ反映され差分にならないため、確認が出るのは「入力途中で閉じたとき」だけになる。
- 破棄経路では `skipBlurCommit` ref を立てて `handleTitleBlur` / `handleBodyBlur` / `handleUrlBlur` を無効化する。**確認ダイアログを開く前に立てる**のが重要で、ダイアログへフォーカスが移る際の `blur` で先に保存されてしまうのを防ぐ。キャンセル時は false に戻す。
- 背景クリックは `onClick` ではなく `onMouseDown` で受ける。`click` まで待つと先に `blur` が走り、破棄を選ぶ前に保存されてしまうため。

**関連リンク・画像添付の入力欄（Phase 49）:**
- URL欄はタイトル・本文と同じ blur-commit パターン（`urlInput` state → blur で `updateNodeUrl(id, urlInput.trim())`）
- 画像は `<input type="file" accept="image/*">` で選択すると即座に `resizeImageToDataUrl()`（`packages/ui/src/utils/imageResize.ts`）→ `updateNodeImage(id, dataUrl)` を呼ぶ（blur 待ちなし・isDirty の対象外）。処理中は「処理中...」表示でボタンを無効化し、失敗時は `addToast('画像の処理に失敗しました', 'error')`。プレビュー右上の削除ボタンで `updateNodeImage(id, undefined)` を呼ぶ
- `resizeImageToDataUrl(file, maxDimension = 640, maxBytes = 200_000)`: `FileReader`/`Image`/`<canvas>` というブラウザ標準APIのみで実装（Platform Adapter を介さない）。長辺を `maxDimension` にリサイズし、JPEG品質を 0.9 から 0.1 刻みで下げながら `toDataURL()` の文字列長が `maxBytes` 以下になるまで再エンコードする

**設計判断（Phase 49）:**
- **OGPタイトルの自動取得はしない。** Web版は外部サイトのHTML取得がブラウザのCORSで失敗し、`apps/web/vite.config.ts` の CSP `connect-src`（Anthropic/OpenAI/Google APIのみ許可）にも合致しない。デスクトップ版も `apps/desktop/src-tauri/capabilities/*.json` のホスト許可が既存 capability（`ai-http`/`google-drive` 等、§18.5）の用途に合わず、任意ドメインへの許可を広げるのは既存方針（許可範囲を機能単位に絞る）に反するため見送った
- **画像は別ファイル管理せず data URL で埋め込む。** 添付画像は `.ideamap` / Drive保存 / 共有URL にそのままサイズが乗る（リサイズ後でも最大約200KB相当）。Drive上の別オブジェクト参照等の別ファイル管理は、Web版・デスクトップ版でストレージの扱いが大きく異なり過剰と判断し v1 では見送った。共有URLの `URL_SIZE_WARNING`（`apps/web/src/services/shareUrl.ts`、50000文字超で警告）は画像添付後も既存ロジックのまま機能する

### 5.9 WebSearchToggle / WebSearchSources（packages/ui/src/components/common/WebSearchToggle.tsx）・useWebSearch（packages/ui/src/hooks/useWebSearch.ts、Phase 35 追加実装）

`useWebSearch()` が Web検索の状態をまとめて返す共通フック。`AISuggestionPanel` / `AIChatPanel` / `MapAnalysisPanel` の3パネルがこれを呼ぶ。

| 戻り値 | 型 | 説明 |
|---|---|---|
| `isAvailable` | `boolean` | トグルをUIに出してよいか。`getPlatform().http.canAccessLocalServers` を `useState` の遅延初期化で1度だけ読む |
| `isConfigured` | `boolean` | `webSearchApiKey !== ''` |
| `enabled` / `setEnabled` | `boolean` / `(v: boolean) => void` | `settingsStore` の `webSearchEnabled` をそのまま公開する |
| `client` | `WebSearchClient \| undefined` | `isAvailable && isConfigured && enabled` のときだけ `OllamaWebSearchClient` を生成（`useMemo`）。それ以外は `undefined` |

`WebSearchToggle` と `WebSearchSources` はどちらも `state: UseWebSearch` を受け取る表示コンポーネント。

- `WebSearchToggle` — `isAvailable` が `false` なら何も描画しない（Web版では常に非表示）。`isConfigured` が `false` なら「🔎 Web検索を使うにはAPIキーの設定が必要です」というボタンを表示し、押下で `onOpenSettings` props（呼び出し元パネルを閉じて設定パネルを開く）を実行する。設定済みならチェックボックス（`state.enabled` / `state.setEnabled`）を表示する
- `WebSearchSources` — 直近の実行で参照した `WebSearchResult[]` をタイトル＋リンクの一覧で表示する。リンクは §5.10 の `ExternalLink` を使い既定ブラウザで開く。結果が0件なら何も描画しない

### 5.10 ExternalLink（packages/ui/src/components/common/ExternalLink.tsx、Phase 35 追加実装）

外部サイトへのリンクは**すべてこのコンポーネントを経由する**。内部では `getPlatform().system.openExternalUrl(href)` を呼ぶ（Web版は `window.open`、デスクトップ版は `@tauri-apps/plugin-opener` の `openUrl()`）。

素の `<a href="..." target="_blank">` を使ってはいけない。デスクトップ版の WebView は新規ウィンドウを開かない設定のため、クリックしても無反応になる。

あわせてデスクトップ版では `main-window` capability の `opener:allow-open-url` を**スコープ付き**で書く必要がある（§18.5）。`opener:allow-open-url` は「コマンドを呼んでよい」という許可でしかなく、URLスコープが空のままだと `openUrl()` は例外を投げて全て拒否される。

各パネルは `useState<WebSearchResult[]>` で `searchSources` を持ち、`aiService.ts` に渡す `onWebSearchResults` コールバックで更新する。新しい実行を開始するたびに空配列にリセットする（§9.10）。

### 5.11 ArtifactPanel（packages/ui/src/components/panels/ArtifactPanel.tsx、Phase 45）

マップ（または選択ノードのサブツリー）から `generateArtifactFromMap`（§9.4.2）を呼び、Markdown成果物をストリーミング生成する右スライドパネル。`App.tsx` に常設し、`uiStore.isArtifactPanelOpen` で開閉する。入口はヘッダーの「成果物を作成」ボタンと `ExportImportPanel` のエクスポートタブ。

- 形式選択（`document` / `slides` / `tasks`）→ 対象範囲表示（`useSubtreeNodeIds()` が `null` でなければ「選択中のノードから n 件を対象」、トグルボタンでマップ全体に切替可）→ 生成ボタン → ストリーミングプレビュー（`<pre>`）→ 完了後に「コピー」（`getPlatform().system.copyToClipboard`）／「.mdで保存」（`getPlatform().file.exportBlob`）
- ローディング・キャンセル（`AbortController`）・APIキー未設定時の `ApiKeyRequired` 表示は他のAIパネルと同じパターン
- `useSubtreeNodeIds()`（`packages/ui/src/hooks/useSubtreeNodeIds.ts`）: `uiStore.selectedNodeId` を起点に `mapStore` の edges（source→target、親→子）をBFSしたノードID集合を返す。選択なしなら `null`（＝マップ全体扱い）。`nodes`/`edges` は `useShallow` で id と `source>target` 文字列だけを購読し、ドラッグ中の座標更新では再計算しない

### 5.12 PersonaDebatePanel（packages/ui/src/components/panels/PersonaDebatePanel.tsx、Phase 48）

選択ノードについて複数ペルソナの意見を `debateNode`（§9.4.4）で生成し、選んだ意見を選択ノードの子ノードとして一括追加するモーダルパネル。`App.tsx` に常設し、`uiStore.isPersonaDebatePanelOpen` で開閉する。入口はノードの `ContextMenu`「🎭 ペルソナで壁打ち」（§5.4）と `NodeDetailPanel` の「🎭 壁打ち」ボタン。いずれも `setSelectedNodeId(targetId)` → `setPersonaDebatePanelOpen(true)` を呼ぶ（対象ノードIDに専用の state は持たず `selectedNodeId` を再利用）。

- **ペルソナ選択**: プリセット4種（楽観家・批評家・顧客・投資家）のトグルチップ＋自由入力（追加ボタンまたは Enter でリストに追加）。プリセットの選択集合（`Set`）と自由入力の配列をマージした `activePersonas` をリクエストに渡す。1件も選ばれていなければ生成不可
- **意見の選択**: 生成結果はペルソナごとにカード表示し、`personaIdx-opinionIdx` をキーにした `Set<string>`（`selectedOpinions`）で意見単位にチェックボックス選択できる。生成直後は全件が選択済みの状態になる
- **子ノード追加**: `handleAddSelected` が選択された意見それぞれについて `calcSuggestionPositions(selectedNode.position.x, selectedNode.position.y, count, nodes)` で位置を求めた `IdeaNode[]` と、選択ノードへの `makeEdge({ source: selectedNode.id, target: n.id, sourceHandle: 'right', targetHandle: 'left' })` の `Edge[]` を組み立て、`addNodesWithEdges`（§4.1）を1回呼ぶ。追加後は選択ノード＋新規ノード群へ `fitView` する
- ローディング・キャンセル（`AbortController`）・APIキー未設定時の `ApiKeyRequired` 表示は他のAIパネルと同じパターン

### 5.13 HistoryPanel（packages/ui/src/components/panels/HistoryPanel.tsx、Phase 50）

保存のたびに記録されるバージョン履歴（`mapHistory.ts`、§22.1）の一覧・復元・タイムラプス再生の入口。`App.tsx` に常設し `uiStore.isHistoryPanelOpen` で開閉する。入口はヘッダーの「履歴」ボタン（§13 の抑制対象外、`Header.tsx` に「マップ分析」「成果物を作成」と同じデスクトップ幅ラベル付き・モバイル幅アイコンのみの2ボタン構成で追加）。

- 開いたら `uiStore.currentMapId` を元に `getSnapshots(mapId)` を呼び、日時・ノード数/エッジ数の一覧を表示する。行をクリックすると開閉し、開いた行にタイトルとノードタイトル一覧（最大30件、以降は「他 n 件」表示）の読み取り専用プレビューを表示する（既存キャンバスは書き換えない）
- **「この時点に復元」**: `openConfirmDialog` で確認 → 確定で、まず現在の状態を `recordSnapshot(currentMapId, buildMapFile(currentMapId))` で退避してから（復元により失われる直前の状態を残すため）、選択スナップショットを `loadFromSerialized(snapshot.mapFile.nodes, snapshot.mapFile.edges)` で復元し、`mapTitle`/`presentationNodeIds` も反映する。`documentSlice.ts` の `loadFromSerialized` は `past: [], future: []` で Undo 履歴を消す仕様のため、**この復元操作自体は Undo 1回では戻せない**。「取り消し」は直前状態を退避したスナップショットから再度復元する形で提供する
- **「タイムラプス再生」**: 確認ダイアログ（Undo履歴が失われる旨の案内）→ `startTimelapse(snapshots)`（§22.3）を呼びパネルを閉じる

---

## 6. 型定義（packages/core/src/types/index.ts）

```typescript
interface Category {
  id: string
  name: string
  color: string        // hex カラーコード
  icon: string         // 絵文字
  description?: string
}

type LLMProviderId = 'claude' | 'ollama' | 'openai'  // Phase 39 で 'openai' 追加

interface IdeaNodeData extends Record<string, unknown> {
  title: string        // ノードタイトル（旧 text から Phase 7 でリネーム）
  body?: string        // 詳細メモ（Markdown）
  color: string        // hex カラーコード（カテゴリから派生）
  createdBy: 'user' | 'ai'
  categoryId?: string  // Category.id への参照
  updatedAt?: string   // ノード単位の最終更新日時（ISO 8601）。旧ファイル由来は undefined（Phase 49）
  url?: string         // 関連リンク（Phase 49）
  image?: string       // 添付画像（data URL、クライアント側でリサイズ済み。Phase 49）
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
  updatedAt?: string   // ノード単位の最終更新日時（ISO 8601）。旧ファイル由来は undefined（Phase 49）
  url?: string         // 関連リンク（Phase 49）
  image?: string       // 添付画像（data URL、クライアント側でリサイズ済み。Phase 49）
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

// Phase 47: AIガーデナー（マップレビュー）
interface GardenerSuggestion {
  kind: 'deepen' | 'merge' | 'bridge' | 'question'
  reason: string                // 提案理由（1文）
  targetNodeIds: string[]       // 意味は kind により変わる: deepen/question=対象1件（question はなければ空配列） / merge/bridge=対象2件
  title?: string                 // deepen・question で新規追加するノードのタイトル
  body?: string                  // deepen・question で新規追加するノードの本文（省略可）
}

// Phase 48: ペルソナ壁打ち会議
interface PersonaOpinion {
  persona: string
  opinions: { title: string; body: string }[]  // 1ペルソナ分の意見（複数件になりうる）
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

### 7.4 マップファイルのバージョニングとマイグレーション（packages/core/src/utils/mapFileCompat.ts、Phase 49）

`readNodeTitle`/`readEdgeHandles`（§7.3 の実体、フィールド単位の後方互換ヘルパー）とは別に、`MapFile.version` を見てファイル全体をバージョン単位で移行する仕組みを同じファイルに持つ。

```typescript
export const CURRENT_MAP_FILE_VERSION = '1.0'

export function migrateMapFile(file: MapFile): { file: MapFile; warning?: string }
```

- `version` が現行と同じ・または欠落しているファイルは、`version` を現行値に揃えて（値を捏造せず）そのまま返す
- `version` が現行より古いファイルは、`MIGRATION_STEPS`（`{ from: string; migrate: (file: MapFile) => MapFile }[]`、バージョンごとの段階的変換関数を積む配列）を順に適用してから現行バージョンへ書き換える。**初回実装時点では現行バージョンより古い実データが存在しないため `MIGRATION_STEPS` は空**で、`migrateMapFile` は事実上「`version` を揃えるだけの恒等変換」になる。以後バージョンを上げるときはここへ1ステップずつ追加していく
- `version` が現行より新しい（未知の将来バージョン）ファイルは、読み込み自体は試みたうえで `warning: 'このファイルは新しいバージョンで作成されています。一部のデータが読み込めない可能性があります'` を添えて返す
- `buildMapFile()`（`packages/core/src/stores/mapSnapshot.ts`）は保存のたびに `version: CURRENT_MAP_FILE_VERSION` を書き込む。`ExportImportPanel.tsx` の `getMapFile()`（Markdown/JSONエクスポート用）も同じ定数を参照する

**配線箇所（外部ファイル起源の `MapFile` を読み込むすべての経路）**: `migrateMapFile` を呼び、`warning` があれば `addToast(warning, 'info')` で通知する。
- `packages/ui/src/hooks/useFileDashboard.ts` の `openLoadedMap()`（Web版 Driveファイル選択・デスクトップ版ダッシュボード・`apps/desktop/src/openMap.ts` の Ctrl+O ダイアログの共通経路）
- `apps/web/src/components/screens/FileOpenDashboard.tsx` の `handleResumeLocal()`（ローカル控えの再開）
- `apps/web/src/components/panels/MapListPanel.tsx` の `handleLoad()`
- `apps/web/src/WebApp.tsx` の `useShareUrlImport()`（共有URLインポート）
- `packages/ui/src/hooks/useAutoSave.ts` の衝突ダイアログ `secondaryAction`（「最新版を読み込む」）
- `packages/ui/src/services/exportService.ts` の `importFromJson()`（JSONファイルインポート）。戻り値が `MapFile` から `{ file: MapFile; warning?: string }` に変わったため、呼び出し元の `ExportImportPanel.tsx` も分割代入に合わせて変更済み

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

**履歴への相乗り（Phase 40: ドラッグ&ドロップ接続、§5.2.1）:**
React Flow はドラッグ終了時に `onNodesChange`（`dragging: false`）→ `onNodeDragStop` の順で発火する。前者がドロップ直前の位置を反映したスナップショットを `past` に積んだ直後、後者から呼ばれる `connectDroppedNode` は `pushPast` せずにエッジ追加とドラッグしたノードの位置を開始位置へ戻す処理を行う。こうして直前のスナップショットに相乗りさせることで、Undo 1回で「エッジ作成＋位置が戻る」を丸ごと取り消せる（`connectDroppedNode` 自身が積むと、Undo 1回目が「エッジだけ消えて重なった位置に戻る」という中間状態になってしまう）。

### 8.3 操作フロー

```
Undo: past の末尾を復元 → 現在状態を future 先頭に追加 → past から末尾を除去
Redo: future の先頭を復元 → 現在状態を past 末尾に追加 → future から先頭を除去
```

---

## 9. AI連携設計（packages/core/src/llm/）

### 9.0 LLMProvider 抽象化（Phase 32・Phase 35 で `OllamaProvider` を追加）

**「APIを呼ぶ部分」と「エラー分類」だけ**を `LLMProvider` の背後に隠した。プロンプト構築とJSON抽出はプロバイダ非依存なので `aiService.ts` / `llm/jsonUtils.ts` 側に残る。

```
aiService.ts             … プロンプト構築・戻り値整形（5関数は req.provider に渡された LLMProvider を使う。Phase 33 で claudeService.ts から改名）
  ├─ llm/claudeProvider.ts   … Anthropic SDK 呼び出し・例外→LLMError 変換（SDK依存はこのファイルのみ）
  ├─ llm/ollamaProvider.ts   … Ollama REST API（/api/chat・/api/tags・/api/ps）呼び出し（Phase 35）
  ├─ llm/providerFactory.ts  … settingsStore の状態から LLMProvider を生成（Phase 35、§9.0.1）
  ├─ llm/types.ts     … LLMProvider / LLMRequest / LLMError / ProviderCapabilities / ModelInfo
  └─ llm/jsonUtils.ts … sanitizeJsonString / safeParseJson / AIParseError
```

**`LLMProvider` の4メソッド**

| メソッド | 用途 | Claude 実装 | Ollama 実装（Phase 35） | OpenAI 実装（Phase 39） |
|---|---|---|---|---|
| `complete(req, signal?)` | 非ストリーミング補完 | `messages.create` | `POST /api/chat`（`stream: false`）。`think: false` を付与 | `POST /v1/chat/completions`（`stream: false`）。出力上限は `max_tokens` ではなく `max_completion_tokens` |
| `completeJson<T>(req, schema?, signal?)` | 構造化出力 | `complete` の応答から最初の `{...}` を正規表現抽出し `safeParseJson`。`schema` は無視（`structuredOutput: 'prompt-only'`） | `format` に `schema`（省略時は `'json'`）を渡し制約付きデコードさせる。`temperature: 0` を明示指定 | `response_format: { type: 'json_object' }` を指定し、応答から最初の `{...}` を正規表現抽出（`structuredOutput: 'prompt-only'`。`json_object` はスキーマを取らないため `schema` 引数は無視） |
| `stream(req, onText, signal?)` | ストリーミング補完 | `messages.stream` + `.on('text')`。`onText` には**累積テキスト**を渡す | NDJSON を `ReadableStream` から手動パース（改行区切りで1行1JSONオブジェクト）。行ごとの `message.content` を累積して渡す | SSE（`data: {...}` の行が並び `data: [DONE]` で終端）を `ReadableStream` から手動パース。`choices[0].delta.content` を累積して渡す |
| `listModels()` | モデル一覧 | 固定リスト（`supportsModelListing: false`） | `GET /api/tags` + `GET /api/ps`（ロード済み判定）。`ModelInfo.contextTokens` は `/api/tags` の `details.context_length`（Ollama 0.32系以降が返す）から取得 | `GET /v1/models` を呼び、ID が `gpt-` または `o` + 数字で始まるものだけを候補にし、埋め込み・音声・画像系（`embedding`/`whisper`/`tts`/`dall-e` 等）を除外して絞り込む（§9.1.3） |

`OllamaProvider` は `complete`/`completeJson`/`stream` すべてに `think: false` を送る。思考モデル（qwen3 系など）は思考トークンが `num_predict` の枠を食い、出力が `done_reason: 'length'` で途中停止することを実測で確認したため（`ClaudeProvider` が `thinking: { type: 'disabled' }` を送るのと同じ理由）。`think` を解釈しないモデル・バージョンの組み合わせに備え、HTTP 400 が返ったときだけ `think` を外して1回だけ再送するフォールバックを持つ。

`OpenAIProvider` も同じ設計のフォールバックを持つ（Phase 39）。reasoning 系モデル（o-シリーズ等）は `temperature` を指定すると 400 を返す（無視ではなくエラー）ため、HTTP 400 が返り、かつ送信済みボディに `temperature` または `response_format` が含まれるときだけ、それらを外して1回だけ再送する。

**設計判断（`docs/desktop/llm-abstraction.md` からの意図的な差分。Phase 32 分＋Phase 35 分。詳細は `docs/desktop/README.md` §3.1-B・§3.1-E）**

- **中断時の `stream()` は throw せず、それまでの累積テキストを返す。**（Phase 32）呼び出し側（`chatWithMap`）は戻り値の後に `signal?.aborted` を見て分岐する。設計書の §3.3 は「`LLMError('aborted')` を catch する」例だったが、`ClaudeProvider` のコード例（累積テキストを return）の方に合わせた。`OllamaProvider` も同じ規約に揃えている。
- **`LLMError` の `kind === 'aborted'` のときだけ `name` を `'AbortError'` にする。**（Phase 32）`AISuggestionPanel` が `name === 'AbortError'` でキャンセルを判定しているため。
- **`capabilities.maxContextTokens` はモデル別**（Phase 32、Claude: Sonnet 5 = 1M / Haiku 4.5 = 200K）。`OllamaProvider` は固定値 8192 のまま据え置き、実際のコンテキスト長は `ModelInfo.contextTokens`（§9.1.2）として設定UIの表示にのみ使う（`capabilities` はコンストラクタ時点で確定させる必要があるが、実長はモデル選択後にしか分からないため。Phase 35）。
- **`toFriendlyAIError` は kind を見るが文言は上書きしない**（Phase 32、`e.message` をそのまま返す）。同じ `connection` でも Claude と Ollama で案内文が変わるため、文言の単一の置き場所を Provider 側にした。
- **`completeJson` の `temperature: 0` は Ollama のみに適用する**（Phase 35）。`llm-abstraction.md` §4.2 は「両方」としていたが、Web版の挙動を Phase 34 以前と一致させることを優先し `ClaudeProvider` 側は変更していない。
- **Phase 32 の移行用アダプタ（`toLegacySuggestionParseError` / `toLegacyAnalysisParseError`）は Phase 35 で削除した。** エラーは `LLMError` に一本化し、UIの「生レスポンスをコピー」導線は `LLMError.rawResponse` から直接取る（`MapAnalysisPanel.tsx`）。

### 9.0.1 プロバイダの解決（`providerFactory.ts` / `useActiveProvider`、Phase 35・Phase 39 で OpenAI 対応）

```typescript
// packages/core/src/llm/providerFactory.ts
interface ProviderSettings {
  llmProvider: LLMProviderId
  apiKey: string
  claudeModel: string
  ollamaModel: string
  ollamaBaseUrl: string
  openaiApiKey: string
  openaiModel: string
}
function getActiveProvider(s: ProviderSettings): LLMProvider   // llmProvider に応じて ClaudeProvider / OllamaProvider / OpenAIProvider を生成
function isProviderReady(s: ProviderSettings): boolean          // Claude: apiKey !== '' / Ollama: ollamaModel !== '' / OpenAI: openaiApiKey !== ''
```

`packages/ui/src/hooks/useActiveProvider.ts` は上記2関数を `settingsStore` に接続する共通フック。`useShallow` で該当7項目だけを購読し `{ provider, isReady, providerId }` を返す。`AISuggestionPanel` / `AIChatPanel` / `MapAnalysisPanel` はいずれもこのフックから `provider` を取得して `aiService.ts` の各関数に渡す（Phase 34 以前の `apiKey`/`aiModel` の直接購読を置き換えた）。

### 9.1 ブラウザからの直接呼び出し

`dangerouslyAllowBrowser: true` で Anthropic SDK をブラウザから直接使用。APIキーはユーザー管理（サーバー経由なし）。

クライアント生成は `ClaudeProvider.client()` に集約する（Phase 29 の `createClient(apiKey)` を Phase 32 で Provider 内へ移設）。

**`thinking: { type: 'disabled' }` を全リクエストに付ける理由（Phase 29）**: Claude Sonnet 5 は `thinking` を省略すると adaptive thinking が既定で有効になる（Sonnet 4.6 までは無効が既定）。本アプリの呼び出しは `max_tokens` 2048〜4096 の短いJSON／チャット応答が中心で、枠を思考トークンに取られると出力が途中で切れてパースに失敗する。品質より応答の確実性と体感速度を優先し、明示的に無効化している。Phase 32 以降は `ClaudeProvider` が全リクエストに付与する。

### 9.1.1 対応モデル

| モデルID | 表示名 | コンテキスト長 | 位置づけ |
|---|---|---|---|
| `claude-sonnet-5` | Claude Sonnet 5（高品質） | 1M | 既定。Phase 29 で `claude-sonnet-4-6` から更新 |
| `claude-haiku-4-5-20251001` | Claude Haiku 4.5（高速・低コスト） | 200K | コスト重視時の選択肢 |

一覧は `ClaudeProvider.listModels()`（`CLAUDE_MODELS` 定数）と `SettingsPanel.tsx` の `<option>` に二重で存在する。Phase 35 では Ollama 側の一覧のみ `listModels()` 由来（§9.1.2）に一本化し、Claude 側は静的な `<option>` のまま据え置いた（`supportsModelListing: false` で一覧が固定リストのため、二重管理の実害が小さいと判断）。

### 9.1.2 Ollama のモデル一覧とコンテキスト長（Phase 35）

`OllamaProvider.listModels()` は `/api/tags`（インストール済みモデル）と `/api/ps`（ロード中モデル）を呼び、次の `ModelInfo` を返す。

| フィールド | 由来 | 備考 |
|---|---|---|
| `id` / `label` | `/api/tags` の `name` | 例: `gemma3:12b` |
| `description` | `/api/tags` の `details.parameter_size` / `quantization_level` ／ サイズ（GB換算）／ `Kコンテキスト`表示 | 例: `12.2B / Q4_K_M / 8.1GB / 32Kコンテキスト` |
| `sizeBytes` | `/api/tags` の `size` | |
| `contextTokens` | `/api/tags` の `details.context_length` | Ollama 0.32系以降が返すフィールド。無ければ `undefined`（`llm-abstraction.md` §8.2 で「未確認」としていたモデルファミリーごとの `/api/show` フィールド名調査が不要になった） |
| `loaded` | `/api/ps` に同名の `name` が含まれるか | `true` なら初回応答が速い旨を選択UIに表示 |

`DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434'` は `ollamaProvider.ts` にあり、`settingsStore` の `ollamaBaseUrl` の初期値・`migrate` の補完値として使う。

`/api/tags` と `/api/ps` のタイムアウト（5秒）には **`AbortSignal.timeout()` を使ってはいけない**。`tauri-plugin-http` は signal の abort を受けるとレスポンスボディを解放する（`fetch_cancel_body`）ため、読み終わったあとにタイマーが発火すると解放済みリソースの二重解放になり、デスクトップ実機で `The resource id ... is invalid` の未処理例外が出る。`AbortController` ＋ `setTimeout` にして、応答を読み切った時点で `clearTimeout` する（`OllamaProvider.getWithTimeout()`）。

### 9.1.3 OpenAI のモデル一覧（Phase 39）

`OpenAIProvider.listModels()` は `GET /v1/models` を呼び、返ってきた ID を機械的に絞り込む。`/v1/models` は埋め込み・音声・画像モデルまで含み用途を判別できるフィールドを持たないため、ID のプレフィックス（`/^(gpt-|o\d)/`）で候補を絞ったうえで、`embedding|whisper|tts|dall-e|moderation|audio|realtime|transcribe|image|instruct|sora` のいずれかを含む ID を除外する（`NON_CHAT_PATTERN`）。タイムアウト（10秒）は §9.1.2 の `OllamaProvider` と同じ理由で `AbortController` ＋ `setTimeout` を使う。

`DEFAULT_OPENAI_MODEL = 'gpt-5.1'` は初回のみ使う既定値で、実際の選択肢は `listModels()` の動的一覧から選ぶ。`capabilities.maxContextTokens` はモデルごとに異なるが `ProviderCapabilities` はコンストラクタ時点で確定させる必要があるため、`OllamaProvider`（固定値 8192）と同じ制約でUI表示専用の代表値（`FALLBACK_MAX_CONTEXT_TOKENS = 400_000`）を固定で持つ。

### 9.2 プロンプト設計（`generateSuggestions` / `SuggestionRequest`）

`generateSuggestions(req: SuggestionRequest, signal?)` は `req` の各フィールドをプロンプトの各セクションへ機械的に対応させる。値が空・未指定のフィールドはセクションごと省略される。

| プロンプトのセクション見出し | 由来フィールド |
|---|---|
| 【選択されたアイデア】＋【選択ノードの詳細メモ】 | `selectedNodeTitle` / `selectedNodeBody` |
| 【つながっているアイデア】 | `connectedNodes`（選択ノードの1ホップ隣接ノード。タイトル＋本文先頭80字） |
| 【マップ全体の文脈（参考）】 | `allNodeTitles`（先頭10件） |
| 【あなたへの指示】 | `userInstruction` |
| 【除外してほしいアイデア（重複禁止）】 | `excludedTexts` |
| 【このアイデアは以下の親ノードの子として追加されます】＋【既存の兄弟アイデア（重複禁止）】 | `parentNodes` / `siblingNodes`（`mode === 'sibling'` のときのみ出力） |

`AISuggestionPanel.buildBaseRequest()` が組み立てる `req.mode`（`'child' | 'sibling'`）によって、重複回避の相手（≒`excludedTexts` の由来）が変わる:
- **子モード**（`mode: 'child'`）: 選択ノードの既存の子ノードのタイトルを `excludedTexts` として渡す。既存の子は `connectedNodes` にも含まれるが、そこでは親や無関係な接続先と混ざったフラットな一覧になり「重複禁止の相手」と認識されないため、`buildBaseRequest` が `excludedTexts` に明示的に渡し直している。
- **兄弟モード**（`mode: 'sibling'`）: 既存の兄弟は `siblingNodes` 経由でプロンプトの「【既存の兄弟アイデア（重複禁止）】」に渡る（Phase 13）。`excludedTexts` はここでは使わない。
- **個別再生成**（`handleRegenerate`）: モードに関わらず、上記の `excludedTexts` を**上書きせず**、同一バッチ内の他の提案タイトルを結合して渡す。

提案タイプ: `関連 / 深掘り / 対比 / 応用`

### 9.3 レスポンス解析

`ClaudeProvider.completeJson()` がJSON部分をregexで抽出する（Claudeの前置き説明文への耐性）:
```typescript
const jsonMatch = text.match(/\{[\s\S]*\}/)
return safeParseJson<T>(jsonMatch[0])
```

`safeParseJson` は素の `JSON.parse` に失敗したら `sanitizeJsonString`（文字列値内の未エスケープ制御文字を修正）で再試行し、それでも失敗したら `AIParseError`（`rawResponse` 付き）を投げる。`MapAnalysisPanel` はこの `rawResponse` を「AIの生レスポンスをコピー」に使う。

### 9.4 各関数の仕様（Phase 23 / Phase 32）

| 関数 | max_tokens | 備考 |
|---|---|---|
| `generateSuggestions(req, signal?)` | 2048 | signal で途中キャンセル可 |
| `analyzeMap(req, signal?)` | 2048 | Phase 32 で `signal` 追加、Phase 35 で UI 接続 |
| `suggestConnections(req, signal?)` | 2048 | Phase 32 で `signal` 追加、Phase 35 で UI 接続 |
| `suggestClusters(req, signal?)` | 4096 | Phase 32 で `signal` 追加、Phase 35 で UI 接続 |
| `chatWithMap(req, onText?, signal?)` | 2048 | ストリーミング + system パラメータ化 |
| `extractMapFromText(req, signal?)` | 4096 | Phase 44。`completeJsonWithRetry` 方式（§9.4.1） |
| `generateArtifactFromMap(req, onText?, signal?)` | 4096 | Phase 45。ストリーミング方式（§9.4.2） |
| `reviewMap(req, signal?)` | 3072 | Phase 47。`completeJsonWithRetry` 方式（§9.4.3） |
| `debateNode(req, signal?)` | 3072 | Phase 48。`completeJsonWithRetry` 方式（§9.4.4） |

分析系3関数の `signal` は Phase 32 でサービス層まで通したが `MapAnalysisPanel` 側のUIが無かった。Phase 35 で `abortRef`（`AbortController`）と3タブ共通の `CancelButton` を追加し、キャンセル時は `isAbortError(e)` で握り潰してトーストを出さないようにしている。ローカルLLMは応答が長くかかりうるため必要性が上がったことが理由。

**Phase 35 でのシグネチャ変更:** 5関数すべての `*Request` インタフェースにあった `apiKey: string` / `model: AIModel` の2フィールドを `provider: LLMProvider` に統合した。呼び出し側（各パネル）は `useActiveProvider()`（§9.0.1）で解決済みの `LLMProvider` をそのまま渡す。

`generateSuggestions` / `analyzeMap` / `suggestConnections` / `suggestClusters` は機能ごとの JSON Schema 定数（`SUGGESTIONS_SCHEMA` / `MAP_ANALYSIS_SCHEMA` / `CONNECTIONS_SCHEMA` / `CLUSTERS_SCHEMA`、`aiService.ts` 内）を `completeJsonWithRetry(provider, req, schema, signal)` に渡すようになった。

- `jsonInstructionSuffix(provider, schema)` — プロンプト末尾に付けるスキーマ提示。`provider.capabilities.structuredOutput === 'json-schema'`（＝Ollama）のときだけ `\n\n出力は以下のJSON Schemaに厳密に従ってください:\n${JSON.stringify(schema)}` を追加する。Claude 向けプロンプト文字列は Phase 34 以前と1文字も変わらない。
- `completeJsonWithRetry(provider, req, schema, signal)` — `provider.completeJson()` が `LLMError('parse')` を投げたら1回だけ「直前の応答はJSONとして解析できませんでした（エラー: …）。同じ内容をJSON形式で出力し直してください」という修復メッセージを追加して再試行する。2回目の失敗はそのまま呼び出し元（`LLMError.rawResponse` 経由でUIの「生レスポンスをコピー」導線）に投げる。

### 9.4.1 ブレインダンプ→マップ生成（`extractMapFromText` / `sanitizeExtractedNodes`、Phase 44）

```typescript
export interface ExtractedNode {
  tempId: string
  title: string
  body?: string
  categoryId?: string
  parentTempId?: string   // 新規ノード同士の親子（他の ExtractedNode.tempId を指す）
  parentNodeId?: string   // 追記モード時、既存マップのノードにぶら下げる場合の実ノードID
}
```

`ExtractedNode` は `packages/core/src/types/index.ts` ではなく `aiService.ts` 内に定義されている（`sanitizeExtractedNodes` と同じファイルに閉じたいため）。`extractMapFromText(req: { provider, text, categories, existingNodes? }, signal?)` は貼り付けテキスト（先頭 8000 文字に切り詰め）から `EXTRACT_MAP_SCHEMA` に従う `ExtractedNode[]` を `completeJsonWithRetry` で取得し、`sanitizeExtractedNodes()` を通してから返す。`existingNodes`（追記モード時）はプロンプトに「追記先の既存マップのノード」として埋め込まれ、AIはそこにある `id` を `parentNodeId` に使ってよい。

`sanitizeExtractedNodes(raw)` は小型モデルが作りやすい壊れた構造を防御的に補正する（欠損を補完するのではなく、**壊れた要素をルート扱いに落とす**ことで後段が必ず木構造を組めるようにする）:
- `tempId` が無い／`title` が空の要素は除外する
- `tempId` が重複する場合は後勝ち（`Map` の上書き）で1件になる
- 存在しない `tempId` を指す `parentTempId` は `undefined` に落とす（ルート化）
- `parentTempId` を辿って同じノードを2回踏む＝循環参照になっている要素も、巻き込まれた側をすべてルート化する

### 9.4.2 マップ→成果物生成（`generateArtifactFromMap`、Phase 45）

```typescript
export type ArtifactFormat = 'document' | 'slides' | 'tasks'

export interface GenerateArtifactRequest {
  provider: LLMProvider
  mapContext: MapContext
  format: ArtifactFormat
  focusNodeIds?: string[]
}
```

`chatWithMap` と違い `system` パラメータは使わず、ノード一覧・接続関係・フォーマット別の指示文（`ARTIFACT_FORMAT_INSTRUCTIONS`）をすべて1つの user メッセージに組み立てて `provider.stream()` に渡す。

**`focusNodeIds` のフィルタは関数内部で行う。** `mapContext.nodes`/`edges` を呼び出し側で絞り込む設計ではなく、`generateArtifactFromMap` が `focusNodeIds` の `Set` で `mapContext` 全体をフィルタしてからプロンプトを組み立てる（`ArtifactPanel` は `useSubtreeNodeIds()` の結果をそのまま `focusNodeIds` として渡すだけでよい）。

### 9.4.3 AIガーデナー（マップレビュー、`reviewMap`、Phase 47）

```typescript
interface ReviewMapRequest {
  provider: LLMProvider
  nodes: { id: string; title: string; body?: string; categoryId?: string; createdBy: 'user' | 'ai'; updatedAt?: string }[]
  edges: { source: string; target: string }[]
  categories: Category[]
}
```

`reviewMap(req, signal?)` は `findNeglectedNodeIds`（`packages/core/src/services/mapReview.ts`）の結果を「【放置されている可能性のあるノード（参考）】」セクションとしてプロンプトに埋め込んだ上で `completeJsonWithRetry` を呼び、`GARDENER_SCHEMA` に従う `{ suggestions: GardenerSuggestion[] }` を取得する。プロンプトには4種の提案（深掘り／統合／橋渡し／問いかけ）の判断基準を明記し、最大6件までに絞るよう指示する。放置ノードが1件もなければ参考セクション自体を省略する。`targetNodeIds` が配列でない要素は空配列に落とす（小型モデルの逸脱への防御）。

`findNeglectedNodeIds(nodes, edges)` は「子ノードを持たない（`edges` の `source` に現れない）葉ノード」を対象に、**ノードが `updatedAt`（Phase 49）を持つ場合は経過日数（`NEGLECTED_DAYS_THRESHOLD = 30`日）で判定し、持たない場合（旧ファイル由来）は従来どおり「`body` が空、または `createdBy === 'ai'`」の構造的指標にフォールバックする**純粋関数（LLM呼び出しなし）。呼び出し元 `MapAnalysisPanel.tsx` は `mapContext.nodes` に `updatedAt` を含めて渡す。

### 9.4.4 ペルソナ壁打ち会議（`debateNode`、Phase 48）

```typescript
interface DebateNodeRequest {
  provider: LLMProvider
  mapContext: MapContext
  nodeId: string
  personas: string[]
}
```

`debateNode(req, signal?)` は `mapContext.nodes` から `nodeId` に一致するノードを探し（見つからなければ `対象ノードが見つかりません` を投げる）、そのタイトル・本文と、1ホップ隣接ノード（`mapContext.edges` を双方向に探索した結果）を「つながっているアイデア」としてプロンプトに埋め込む。`personas` 全員分の意見を **1回の `completeJsonWithRetry` 呼び出し**でまとめて構造化生成する（ペルソナごとに個別に呼ぶとAPI呼び出しがペルソナ数倍になるため、`generateSuggestions` が1回で複数件出す設計と同じ考え方）。`DEBATE_SCHEMA` に従う `{ personas: PersonaOpinion[] }` を取得し、`personas` が配列でなければ `AIからの応答形式が正しくありません` を投げ、各ペルソナの `opinions` が配列でなければ空配列に落とす（小型モデルの逸脱への防御）。

### 9.5 chatWithMap のストリーミング設計（Phase 23）

```typescript
export async function chatWithMap(
  req: ChatWithMapRequest,
  onText?: (partialText: string) => void,
  signal?: AbortSignal,
): Promise<{ content: string; actions: ChatAction[] }>
```

- `systemContext`（マップコンテキスト文字列）を **`system` パラメータ**で渡す。`messages` は会話履歴をそのままマップ（最初のユーザーメッセージへの埋め込みなし）。
- `ClaudeProvider.stream()` が `client.messages.stream({ model, max_tokens: 2048, thinking, system, messages }, { signal })` で逐次受信する。
- `onText` コールバックには `/```actions[\s\S]*$/` を除去した累積テキストを都度渡す（actions ブロックの途中表示防止）。除去は provider の外側（`chatWithMap`）で行うプロバイダ非依存のロジック。
- Abort 時（`APIUserAbortError` または `signal.aborted`）: provider がそれまでの累積テキストを return し、`chatWithMap` が `signal?.aborted` を見て「actions 除去済みテキスト + `actions: []`」を返す。throw しない。
- 完了後: `/```actions\n([\s\S]*?)\n```/` で actions をパースして返す。

### 9.6 エラー分類と toFriendlyAIError（Phase 23 / Phase 32 で LLMError ベースに移行）

`ClaudeProvider.toLLMError()` が Anthropic SDK の例外を `LLMError` に変換する（判定順は `APIUserAbortError` → `APIConnectionError` → `APIError`。後者2つは `APIError` のサブクラスのため先に検査）:

| 条件 | `kind` | メッセージ |
|---|---|---|
| `APIUserAbortError` / `name === 'AbortError'` | `aborted` | 「キャンセルされました」（`name` は `'AbortError'`） |
| `APIConnectionError` | `connection` | 「ネットワークエラーです。接続を確認してください」 |
| `APIError` status 401 | `auth` | 「APIキーが無効です。設定画面で確認してください」 |
| status 429 | `rateLimit` | 「レート制限に達しました。1分ほど待ってから再試行してください」 |
| status 529 | `unknown` | 「Claude APIが混雑しています。しばらく待ってから再試行してください」 |
| 他の `APIError` | `unknown` | `e.message` |
| それ以外 | `unknown` | `e instanceof Error ? e.message : 'エラーが発生しました'` |

```typescript
export function toFriendlyAIError(e: unknown): string
```

`LLMError` なら `kind === 'aborted'` のときだけ「キャンセルされました」、それ以外は `e.message` をそのまま返す。`LLMError` 以外（`AIParseError`・アダプタが戻した `Error`）は従来どおり `e.message`。**表示文言は Phase 31 以前と完全に同一**（Phase 32 で old/new を同一モックに対してA/B比較して確認済み）。

**`OllamaProvider` のエラー分類（Phase 35）:** `ClaudeProvider.toLLMError()` とは別に、`OllamaProvider` 内で次の判定を行う。

| 条件 | `kind` | メッセージ |
|---|---|---|
| `http.request()` が例外を投げ、`signal?.aborted` でない | `connection` | 「Ollamaに接続できませんでした。Ollamaが起動しているか、接続先URLが正しいか確認してください。」 |
| HTTP 404 | `notFound` | 「モデル「\<model\>」が見つかりません。「ollama pull \<model\>」でモデルを取得してください。」（`rawResponse` にレスポンス本文を保持） |
| `signal?.aborted` | `aborted` | 「キャンセルされました」（`name` は `'AbortError'`） |
| 他の非2xxレスポンス | `unknown` | 「Ollamaがエラーを返しました（HTTP \<status\>）」 |

Node から `OllamaProvider` を直接動かし、404・到達不可（`http://127.0.0.1:9`）・`completeJson()` の中断の3パターンで上記どおりの `kind` になることを確認済み（2026-08-07・Ollama 0.32.6）。

**`OpenAIProvider` のエラー分類（Phase 39）:**

| 条件 | `kind` | メッセージ |
|---|---|---|
| `http.request()` が例外を投げ、`signal?.aborted` でない | `connection` | 「OpenAIに接続できませんでした。ネットワーク接続を確認してください。」 |
| HTTP 401 / 403 | `auth` | 「OpenAIの認証に失敗しました。APIキーが有効か設定画面で確認してください。」 |
| HTTP 404 | `notFound` | 「モデル「\<model\>」が見つかりません。設定画面で使用モデルを選び直してください。」 |
| HTTP 429 | `rateLimit` | エラーレスポンスの `error.message`（無ければ「OpenAIのレート制限に達しました。しばらく待ってから再試行してください。」）。頻度超過と課金枠切れの両方が429で返るため原因の切り分けは応答本文に委ねる |
| `signal?.aborted` | `aborted` | 「キャンセルされました」（`name` は `'AbortError'`） |
| 他の非2xxレスポンス | `unknown` | エラーレスポンスの `error.message`（無ければ「OpenAIがエラーを返しました（HTTP \<status\>）」） |

HTTP 400 のときは §9.0 の `temperature`/`response_format` フォールバック再送を先に試み、それでも失敗したら上表のとおり通常のエラー分類にかかる。

### 9.7 updateLastChatMessage（uiStore — Phase 23）

```typescript
updateLastChatMessage: (content: string) => void
```

`chatMessages` 配列の末尾メッセージが `role === 'assistant'` の場合のみ、その `content` を置換した新配列をセットする。ストリーミング中にデルタを逐次反映するために使用。

### 9.8 プロバイダ切り替えUIの表示判定（`HttpAdapter.canAccessLocalServers`、Phase 35）

`packages/platform` の `HttpAdapter` に `readonly canAccessLocalServers: boolean` を追加した（Web実装=`false`、Desktop実装=`true`）。ブラウザから Ollama を叩く構成は `OLLAMA_ORIGINS` というユーザー環境依存の設定に阻まれ安定提供できないため、**プロバイダ切り替えUIそのものを Web版には出さない**。判定はランタイム種別の直接判定（`'__TAURI_INTERNALS__' in window` 等）ではなく Adapter 経由にしている（`docs/desktop/README.md` §3.1-E、`llm-abstraction.md` §6.1 からの差分）。

`SettingsPanel.tsx` は `const [showProviderSwitch] = useState(() => getPlatform().http.canAccessLocalServers)` という遅延初期化で1度だけ読む（`isKeychainBacked` と同じパターン。レンダー本体で `getPlatform()` を呼ぶと `setPlatform()` 前の評価に晒されるため）。

### 9.9 設定UI: AIプロバイダ切り替えと Ollama セクション（`SettingsPanel.tsx`、Phase 35）

`showProviderSwitch` が `true` のときだけ「AIプロバイダ」セクション（Claude API / Ollama の2択ボタン）を描画する。選んだプロバイダに応じて、既存の「Claude API」セクション（APIキー入力・モデル選択）と新設の `OllamaSection` を排他表示する。

**`OllamaSection` の構成:**

| 要素 | 内容 |
|---|---|
| 接続先URL入力 | `ollamaBaseUrl` を編集。「接続テスト」ボタン押下で `setOllamaBaseUrl` に反映してから疎通確認する |
| 疎通確認 | `new OllamaProvider(baseUrl, ollamaModel).listModels()` を呼ぶだけ（`/api/tags` が疎通確認とモデル一覧取得を兼ねる）。パネルを開いた直後に1回だけ自動実行する（`useRef` の初回フラグでガード） |
| 成功時 | 「✅ 接続成功 / N個のモデルが見つかりました」。選択中の `ollamaModel` が一覧に無ければ先頭のモデルへ自動で寄せる |
| 失敗時 | `LLMError.kind` が `connection` なら `ollama serve` の実行案内、`notFound` なら `ollama pull <model>` の案内。いずれも `CommandHint`（コマンド文字列＋コピーボタン）を添える |
| モデル0件 | 空状態として `ollama pull gemma3:4b` の案内＋日本語対応モデル（gemma3 / qwen3 / elyza-jp）のおすすめ文言 |
| モデル選択 | `<select>`。各 `<option>` に `ModelInfo.label` と `description`（パラメータ数/量子化/サイズ/コンテキスト長）、`loaded` なら「⚡ロード済み」を付記 |

`CommandHint`（コマンド文字列＋コピーボタン、`getPlatform().system.copyToClipboard()` 経由）と `SuggestionCountField`（AI提案数スライダー）は Claude セクションと `OllamaSection` の両方から使う共通コンポーネントとして切り出した。

### 9.10 Web検索（packages/core/src/llm/webSearch.ts、Phase 35 追加実装・デスクトップ版のみ）

AIに聞く前に、ollama.com の Web Search API（`docs.ollama.com/capabilities/web-search`）で最新情報を取得し、プロンプトに埋め込む。**`LLMProvider` の外側**に置いた独立機能で、Claude / Ollama どちらを使っていても利用できる（`docs/desktop/llm-abstraction.md` §2.6）。

```typescript
export interface WebSearchResult {
  title: string
  url: string
  content: string
}

export interface WebSearchClient {
  search(query: string, signal?: AbortSignal): Promise<WebSearchResult[]>
}

export class OllamaWebSearchClient implements WebSearchClient { /* POST https://ollama.com/api/web_search */ }

export function formatWebSearchBlock(results: WebSearchResult[]): string
```

| 項目 | 内容 |
|---|---|
| エンドポイント | `POST https://ollama.com/api/web_search`。ローカルの Ollama サーバーではなく ollama.com のホスト型API。認証は `Authorization: Bearer <ollama.com APIキー>`（Claude APIキーとは別スロット、§4.3） |
| リクエスト | `{ query, max_results: 5 }`（APIの上限は10だが本アプリでは5件に固定） |
| レスポンス | `{ results: [{ title, url, content }] }` |
| 取り込み量 | 1件あたり本文を600文字に切り詰める（`truncate()`）。公式ドキュメントは「検索結果は数千トークンになるためコンテキスト長32K以上を推奨」とするが、本アプリはスニペット利用に限定してローカル小型モデルでも破綻しない量に抑えている |
| タイムアウト | 15秒。`AbortSignal.timeout()` は使わず `AbortController` ＋ `clearTimeout`（§9.1.2 と同じ理由。`tauri-plugin-http` の abort によるレスポンスボディの二重解放を避けるため） |
| エラー分類 | HTTP 401/403 → `auth`、429 → `rateLimit`、他の非2xx → `unknown`、通信不可 → `connection`。いずれも `LLMError`（`provider: 'ollama'`）として投げ、検索失敗はAI呼び出しごと失敗させる（検索失敗を握り潰さない。ユーザーが明示的に検索をオンにしているため） |
| HTTP呼び出し | `getPlatform().http.request()` 経由（`packages/core` から `fetch` を直接呼ばない規約に従う） |

**`aiService.ts` への注入（`WebSearchOptions`）:**

```typescript
export interface WebSearchOptions {
  webSearch?: WebSearchClient
  /** 実際に参照した検索結果。UIの出典表示に使う */
  onWebSearchResults?: (results: WebSearchResult[]) => void
}
```

`generateSuggestions` / `analyzeMap` / `chatWithMap` の3関数の `*Request` インタフェースがこれを継承する（`ChatWithMapRequest` は `packages/core/src/types/index.ts` 側、他2つは `aiService.ts` 内のローカル `interface` で継承）。`webSearch` が未指定なら `buildWebContext()` が即座に空文字を返し、**プロンプトは Web検索非対応時（Phase 35 本体）と1文字も変わらない**。`suggestConnections` / `suggestClusters` は対象外（ノード間の関係・グループ化はマップ内部の構造を扱うため外部情報が効かない）。

| 関数 | 検索クエリの作り方 |
|---|---|
| `generateSuggestions` | 起点ノードのタイトル＋ユーザーの追加指示（`[selectedNodeTitle, userInstruction].filter(Boolean).join(' ')`） |
| `analyzeMap` | 先頭5ノードのタイトル |
| `chatWithMap` | 直近のユーザー発言（`messages` を逆順に見て最初に見つかる `role === 'user'`） |

検索結果は `formatWebSearchBlock()` で「【Web検索で取得した最新情報】」ブロックに整形し、各関数のプロンプトの他のコンテキストセクションの直後（本文セクションの前）に挿入する。ブロックには「学習データより新しい可能性があるため、内容が食い違う場合はこちらを優先してください」という指示を添える。`onWebSearchResults` には実際に参照した検索結果を渡し、呼び出し元（各パネル）が§5.9の `WebSearchSources` で出典表示に使う。

### 9.11 設定UI: Web検索セクション（`SettingsPanel.tsx`、Phase 35 追加実装）

`showProviderSwitch`（`canAccessLocalServers` の遅延初期化値、§9.8）が `true` のときだけ `WebSearchSection` を描画する（Web版には出さない）。`OllamaSection` と並ぶ独立したセクションで、プロバイダ選択（Claude / Ollama）とは無関係に常に表示される。

| 要素 | 内容 |
|---|---|
| APIキー入力 | `password` 入力。保存済みキーは `••••••••••••••••` でマスク表示し、「変更」ボタンで再入力状態にする |
| キー発行リンク | `getPlatform().system.openExternalUrl('https://ollama.com/settings/keys')` |
| 注意書き | 「Web検索はローカルのOllamaではなく ollama.com のサービスを使います。検索クエリ（ノードのタイトルやチャットの入力）は ollama.com に送信されます」を明記 |
| 検索テスト | `new OllamaWebSearchClient(webSearchApiKey).search('Ollama')` を実行し、成功件数またはエラーメッセージをトースト表示 |
| キー削除 | `setWebSearchApiKey('')`。`webSearchEnabled` も自動で `false` に戻る（§4.3の `settingsStore` の挙動） |
| 既定トグル | 「既定でWeb検索を使う」チェックボックス。`webSearchApiKey` が設定済みのときだけ表示する |

---

## 10. APIキー暗号化設計（apps/web/src/utils/encryption.ts）

### 10.1 新形式（Phase 27〜）: マスターパスワード方式

- ストレージキー: 論理キーごとに別スロット（`storageKey(key)`）。**Claude APIキー（論理キー `'apiKey'`）だけは既存ユーザーのデータをそのまま読めるよう旧キー名 `localStorage['ideamap-apikey-mp']` を維持**し、それ以外（Phase 39 の `'openaiApiKey'` 等）は `localStorage['ideamap-secret-<key>-mp']` を使う（JSON `{ v: 2, encrypted, salt }` は共通）
- 暗号化: PBKDF2（100k iterations, SHA-256）+ AES-GCM 256bit
- パスワード: ユーザーが任意に設定するマスターパスワード（Drive同期と共用の `syncPassword`）。全論理キーで共通のパスワードを使う
- マスターパスワード未設定時はメモリのみで保持（セッション終了で消える）
- サーバーへの送信なし

**ヘルパー関数（export、Phase 39 で論理キー別に一般化・改名）:**
- `hasStoredSecret(key)` — 新形式キーの有無（旧 `hasStoredApiKey()` を改名し `key` 引数を追加）
- `hasLegacyApiKey()` — 旧形式キーの有無（移行チェック用。旧形式が存在するのは Claude キーのみのため key 引数は無いまま）
- `getLegacyApiKey()` — 旧形式を復号して返す（自動移行用）
- `clearLegacyApiKey()` — 旧形式キーとsaltを削除
- `setStoredSecretWithPassword(key, value, password)` — 新形式で保存（旧 `setStoredApiKeyWithPassword(key, password)` を改名し `key` 引数を追加）
- `getStoredSecretWithPassword(key, password)` — 新形式から復号（誤パスワードは throw、旧 `getStoredApiKeyWithPassword(password)` を改名）
- `clearStoredSecret(key)` — 新形式キーを削除（旧 `clearStoredApiKey()` を改名）

`apps/web/src/platform/secret.web.ts`（`webSecretAdapter`）はこれらの関数をそのまま呼ぶ薄いラッパーで、`SecretAdapter.getSecret`/`setSecret`/`clearSecret` の `key` 引数を上記の論理キーへ渡す（Phase 39 以前は `key` 引数を無視して常に Claude キー扱いだった）。現状この経路を使うのは Claude APIキー（`'apiKey'`）と OpenAI APIキー（`'openaiApiKey'`）の2種類（`webSearchApiKey` はデスクトップ版のOSキーチェーン専用でWeb版には保管先が無い、§4.3）。

### 10.2 旧形式（Phase 27 以前）: ハードコードパスフレーズ（非推奨・移行専用）

- ストレージキー: `localStorage['ideamap-apikey-enc']`（saltは`ideamap-salt`）
- パスフレーズ: `'ideamap-v1'`（ハードコード）→セキュリティ上問題のある方式。新規暗号化には使わない
- 旧形式の復号専用関数 `decryptLegacyApiKey()` を `encryption.ts` に隔離して残す（移行専用・非推奨）

### 10.3 Markdownサニタイズ（Phase 27〜）

`utils/markdown.ts` の `renderMarkdownSimple()` が DOMPurify でホワイトリストサニタイズを実施:
- `ALLOWED_TAGS`: `h1, h2, h3, strong, em, code, li, br`
- `ALLOWED_ATTR`: `class`
- 呼び出し4箇所（IdeaNode / PresentationMode / NodeDetailPanel / NodePanel）は変更不要

### 10.4 MasterPasswordModal（packages/ui/src/components/common/MasterPasswordModal.tsx）

`createPortal(content, document.body)` で `<body>` 直下にレンダリング（z-index: 80）。
- **解錠モード**（`apiKeyLock==='locked'`・未スキップ）: パスワード入力 → `unlockApiKey()`。誤りはインラインエラー。「スキップ」「パスワードを忘れた場合」ボタン
- **設定モード**（`needsMasterPasswordSetup`・未スキップ）: `setMasterPassword()` を呼ぶ。任意なのでスキップ可
- Esc でスキップ（`dismissMasterPasswordPrompt()`)

---

## 11. ノード配置ロジック（packages/core/src/layout/mapLayout.ts）

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
- **Phase 28**: dagre を動的 import に変更したため `applyDagreLayout` / `applyRadialLayout` は `Promise<Node[]>` を返す。呼び出し側（`Toolbar.runLayout`）で `await` する

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

### 11.8 放射状自動整列（`applyRadialLayout`）— balloon レイアウト

ルート（入力エッジなしのトップレベルノード）を中心 `(0,0)` に置き、**各ノードのまわりに自分の子を配置する** balloon レイアウト。深さごとの同心リングに載せる方式だと、外周のリングが全体のノード数で決まるため、末端が親から極端に離れてしまう。そのため「サブツリー単位で場所を確保する」方式を採る。

計算の中心にあるのは `subtreeRadius`（そのノードのサブツリー全体を包む円の半径）。再帰で下から求める。

| 手順 | 内容 |
|---|---|
| ① 子ごとの距離 | 子 `c` を親から `max(240, 親の外接半径 + subtreeRadius(c) + 48)` の距離に置く。子ごとに距離が違うので、小さい枝は親のすぐそば、大きい枝だけ遠くに離れる |
| ② 角度の間隔 | 隣り合う子の円が触れ合わない角度を余弦定理から逆算（`chord ≧ 両者の半径 + 48`）。合計が使える角度を超えるあいだ、その親の全リングを 1.12 倍ずつ広げる |
| ③ 扇の向き | ルートは 360°。それ以外は親と反対方向を中心に、**必要角の 1.25 倍**（上限 240°）だけ広げる。上限まで広がるのは子が多くて詰まっているときだけ |
| ④ 子の並び順 | 大きいサブツリーを扇の中央（＝親の真正面）に、小さいものを端に寄せる。端の子は親の横に回り込むため、そこに大きな枝が来ると全体が親の背後へはみ出す |
| ⑤ 包含半径 | `subtreeRadius(親) = max(距離ᵢ + subtreeRadius(子ᵢ))` |

重なりが起きないのは、①で親の矩形が子の円に食い込まないことと、②で兄弟の円が交わらないことが同時に保証されるため（サブツリー全体がその円に収まるので、円が交わらなければ中身も交わらない）。ノードの外接半径は矩形の対角線の半分を使う。

座標は中心基準で計算し、最後にノードサイズの半分を引いて左上座標に直す（グループノードは `style.width/height` の実サイズを使う）。孤立ノード（ルートから到達できないノード）は木全体の外側に横並びで置く。

検証は `packages/core/src/layout/mapLayout.test.ts`（`pnpm test` で実行。Phase 41 で `verify-radial-layout.mts` から移植）。木の幅・深さを変えた6パターン＋枝ごとに子の数が違う木＋孤立ノードありで、**全ノードの矩形が重ならないこと**と**末端が親から 400px 以内にあること**を検証する。後者が本方式を採った理由そのものなので、半径の決め方を変えるときはここを見る。

### 11.9 ブレインダンプ結果のマップ変換（`buildMapFragmentFromExtracted`、packages/core/src/services/textToMap.ts、Phase 44）

`extractMapFromText`（§9.4.1）が返した `ExtractedNode[]` を、実際にマップへ読み込める `{ nodes: SerializedNode[]; edges: SerializedEdge[] }` に変換する。独自のレイアウト計算はせず、`applyRadialLayout`（§11.8）にそのまま乗せる:

1. `sanitizeExtractedNodes()` を再度通す（冪等なので害はなく、この関数を直接テストするときに壊れた入力にも単体で耐えられる）
2. 各 `ExtractedNode` を仮の `Node<IdeaNodeData>[]` に、`parentTempId` を持つものだけを `Edge[]`（新規ノード同士の親子関係）に変換して `applyRadialLayout(nodes, edges)` へ渡す
3. 追記モード（`existing.nodes` 指定時）は、レイアウト結果を「既存マップの外接矩形の右端 + 200px」を起点に平行移動する（`computeOffset`。Y座標は既存マップの最小Yに揃える）。新規マップ時はオフセットなし
4. エッジは new→new（`parentTempId` 由来）を優先し、無ければ existing→new（`parentNodeId` が既存ノードIDを指す場合のみ）を追加する。存在しない `parentNodeId` は無視されエッジを作らない

検証は `packages/core/src/services/textToMap.test.ts`（10件）。親子関係・孤立ノード・循環参照・既存ノードへの接続・追記時のオフセット計算・tempId重複・空タイトル除外をカバーする。

---

## 12. Google Drive連携設計

本章は Web版の実装（GIS 認証・`MapListPanel`/`FileOpenDashboard`）を記述する。REST 呼び出しの実体（§12.2・§12.3）は Phase 38 で `packages/core/src/services/driveService.ts` に移り、デスクトップ版もここを共有している。デスクトップ版固有の認証フロー（ループバック+PKCE）と起動画面の Drive UI（`DriveSection`）は §18.9 を参照。

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

### 12.2 フォルダ管理（packages/core/src/services/driveService.ts、Phase 38 で apps/web から移設）

- フォルダ名: `IdeaMap`（存在しない場合は自動作成）
- フォルダIDはプロセス内メモリキャッシュ（`folderIdCache`）で再取得を防ぐ。`settings.json` の fileId も同様に `settingsFileIdCache` でキャッシュする
- `clearDriveCache()` はアクセストークンが変わったとき（サインアウト・アカウント切替）に呼ぶ。Phase 38 で `settingsFileIdCache` も一緒に破棄するようになった（同じ Drive アカウントに紐づくため）

### 12.3 ファイル保存戦略

```
Google Drive/
└── IdeaMap/
    └── {title}.json      # multipart/related アップロード（PATCH/POST）
```

- 既存ファイル（fileId あり）: `PATCH` で上書き
- 新規ファイル: `POST` でマルチパートアップロード
- **アップロードの組み立て（Phase 38 で変更）**: `FormData`/`Blob` ではなく `uploadType=multipart` の `multipart/related` ボディを文字列で手組みする（`buildMultipartBody`）。`packages/core` は通信を `HttpAdapter.request` 経由で行う必要があり、Tauri の `plugin-http` へ `FormData` を渡したときの挙動が未検証だったため、Web版・デスクトップ版のどちらでも同じ経路で通る文字列ボディに統一した。**この変更は Web版の保存経路にも及ぶ**
- fileId は `uiStore.currentFileId` を単一の真実源とし、`setCurrentFileId` 経由で `StorageAdapter`（キー `ideamap-drive-fileid`）に同期する。ロード／新規作成／インポート／保存後／サインアウトはすべてこのアクションを通すため、新規作成時に前マップの fileId が残って別ファイルを上書き消失させる事故を構造的に防ぐ
- 保存時は Drive ファイルの `appProperties: { mapId }` も更新する。`appProperties` は JSON 内容をダウンロードせずに照合できる軽量なメタデータとして衝突チェックに使用

### 12.4 自動保存（packages/ui/src/hooks/useAutoSave.ts）

Phase 33 で `packages/ui` に汎用化され、Web版・デスクトップ版が同じフックを共有する。保存先の実体は `FileAdapter` に委ねているため、以下は Web版目線の記述だが、デスクトップ版は「Google Drive」を「ローカルファイル」、「`accessToken` あり」を「常に true（`remoteReady`）」に読み替える。

**Phase 38 以降のデスクトップ版**: デスクトップ版は Drive とローカルの両方を扱えるようになったため、保存先の判別は `accessToken` の有無ではなく `uiStore.currentFileOrigin`（§4.2）で行う。`useAutoSave` は `currentFileId` から組み立てる `FileRef.origin` に `currentFileOrigin ?? file.origin` を使う（マップを開いたときに記録した値を優先し、無ければ `FileAdapter` の既定＝ローカルにフォールバック）。`remoteReady` はローカルファイルシステムが常に使えるため常に `true` を渡し、Drive 側の 401 は `AutoSaveOptions.onSaveError` が `currentFileOrigin === 'cloud'` のときだけキーチェーンでの再認証にルーティングする（`apps/desktop/src/DesktopApp.tsx`）。

- `useMapStore.subscribe()`（ノード・エッジ変更）に加え、`useUIStore.subscribe()` で `mapTitle` 変更も監視（差分比較で mapTitle のみ拾い、パネル開閉等の他UI状態変更では保存しない）。両者は同一デバウンスタイマーを共有
- デバウンス: 変更から **3000ms** 後に保存実行
- **手動保存（Phase 20）**: `uiStore.saveRequestId` の変化も購読し、変化時はデバウンスをスキップして即時保存する。`settingsStore.autoSave` が off でも手動保存は常に実行される。トリガーは `Ctrl+S` とヘッダーの保存ステータスクリック
- 保存先 fileId は `uiStore.currentFileId` を参照。`POST` で採番された id は `setCurrentFileId` で反映し、次回以降は同じファイルへ `PATCH`
- 保存優先順位: Google Drive（accessToken あり）→ localStorage（オフライン）。localStorage への保存（`saveMapLocally`）は Drive 保存の成否に関わらず毎回実行される
- **`createNewFileOnSave`（`AutoSaveOptions`、Phase 34）**: 保存先が未確定（`currentFileId === null`）のデバウンス保存で、実ファイルを新規作成してよいかを制御する。Web版は `true`（Driveへ黙って新規作成する、従来通りの挙動）。デスクトップ版は `false` — `true` のままだと3秒ごとに「名前を付けて保存」ダイアログが出てしまうため、保存先未確定のデバウンス保存は `file.saveLocalMirror()`（自動保存領域への書き込み）だけで完了とし、実ファイルの新規作成は明示保存（`Ctrl+S`・ヘッダークリック、`performSave(true)`）のときだけ許す
- 保存ステータスは `uiStore.saveStatus` で管理しヘッダーに表示。表示は「保存済み · Drive」「保存済み · ローカル」形式（`isSignedIn && currentFileId` → Drive）。保存成功時に `uiStore.lastSavedAt` を更新し、ツールチップに最終保存時刻を表示
- **未保存ガード（Phase 20 / Phase 33 で `SystemAdapter.onBeforeExit` に一般化）**: `App.tsx` が `saveStatus` が `unsaved`/`saving` のとき終了を止める。Web=`beforeunload`、Desktop=ウィンドウの `close-requested` イベント＋ネイティブ確認ダイアログ（`ask()`）
- **保存ダイアログのキャンセル（Phase 34、デスクトップ版のみ発生）**: `saveFileAs` が `null` を返す（ユーザーがダイアログをキャンセル）と、失敗扱いにはせず `saveStatus` を `'unsaved'` に戻して次の操作を待つ
- **バージョン履歴への記録（Phase 50）**: 保存が成功した直後（新規保存確定時・上書き保存成功時のどちらも通る1箇所）で `recordSnapshot(mapFile.mapId, mapFile)` を呼ぶ（§22.1）。保存先未確定のローカル控えのみの分岐（`createNewFileOnSave: false` のデバウンス保存）では呼ばない（正式な保存ではないため）

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

## 13. キーボードショートカット設計（packages/ui/src/hooks/useKeyboardShortcuts.ts）

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
- タイムラプス再生中（`isTimelapsePlaying`、Phase 50）
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

### Phase 30 による取りこぼしの解消

Phase 24 の「全面化」後も `dark:` クラスが1つもないコンポーネントが残っていたため、Phase 30 で解消した。

| コンポーネント | 対応内容 |
|---|---|
| `AISuggestionPanel` | パネル全体（ヘッダー・提案カード・入力欄・フッター）にダーク配色を追加 |
| `SettingsPanel` | 同上。入力欄・セレクトには `dark:bg-gray-700 dark:text-gray-100` を明示 |
| `MapListPanel` | 同上 |

**インライン `backgroundColor` を持つ要素は対象外**とする。カテゴリ行・カテゴリチップ・ノード本体はユーザーが選んだ明るいパステル色を背景に敷くため、文字色をダークで反転させると読めなくなる（`SettingsPanel` のカテゴリ一覧、`AISuggestionPanel` のカテゴリチップ、`IdeaNode` / `GroupNode`）。トグルのつまみのように暗色トラックとの対比で成立している要素も同様に白のまま残す。

`Toast` は彩度の高い背景色＋白文字で元からテーマ非依存のため変更不要。

### Phase 33 によるキャンバスの掴むカーソル可視化（2026-08-07）

ブラウザ標準の `grab`/`grabbing` カーソルはフチが細く、ライトモードのキャンバス背景色 `#f9fafb` と同化して見えない不具合があった。`packages/ui/src/index.css` で、白い手に黒フチ（塗り `#ffffff` + フチ `#1f2937`）を回した自前の SVG データURIカーソル（24×24、ホットスポット `11 12`）へ差し替えている。

**テーマ分岐は設けていない。** ライトでは黒フチが、ダークでは白い塗りが背景から浮くため、1種類で両テーマとも視認できる。

SVG は「黒で図形を1回描いてから、同じ図形を白で描き直す」二度塗り構成になっている。図形ごとに `stroke` を引くと指と手のひらの重なりに内側の線が出てしまうため。指と指の 0.7px の隙間だけ1回目の黒が残り、関節の区切り線として機能する。

**寸法の決め方**: 指幅 2.1・フチ `stroke-width: 2`（＝外側に 1px）は、標準カーソル並みの細さと白背景での視認性の折衷点。これより太くすると手がぼってりして不格好になり、これよりフチを細くすると 24px でラスタライズしたときフチが灰色に潰れて白背景から浮かなくなる。

適用先は `.react-flow__pane.draggable` / `.react-flow__nodesselection-rect` / `.react-flow__node.draggable`（grab）と `.react-flow__pane.dragging` / `.react-flow__node.draggable.dragging`（grabbing）。

**`!important` を付けている理由**: `@xyflow/react/dist/style.css` の同名ルールと詳細度が同じ（0,2,0）で、しかも CSS の読み込み順が dev（`index.css` が先）と build（React Flow の CSS が先）で入れ替わるため、読み込み順に依存せず確実に上書きするには `!important` が必要になる。既存の `.tap-connect .react-flow__node { cursor: crosshair }`（[17.8 スマホ タッチ操作](#178-スマホ-タッチ操作phase-26)の接続モード）も、この掴むカーソルに詳細度で負けないよう `!important` を付けたうえで CSS 内の後方に配置している。

---

## 16. 大規模マップのパフォーマンス（Phase 24 / Phase 28）

### 16.1 onlyRenderVisibleElements

`<ReactFlow onlyRenderVisibleElements={!renderAllNodes}>` を有効化し、ビューポート外のノードの DOM 描画をスキップする。ノード数が多いマップでのパン・ズームの描画負荷を軽減する。

### 16.2 エクスポート干渉対策（renderAllNodes フラグ）

`exportService` の画像エクスポートは `.react-flow__viewport` の DOM を直接 html-to-image で撮影する。`onlyRenderVisibleElements` が有効な状態では画面外ノードが DOM から除外されるため、「マップ全体」モードでエクスポートすると画面外ノードが欠落する。

**対策**: `uiStore.renderAllNodes` フラグを用意し、`ExportImportPanel.handleImageExport` が以下の手順で切り替える。
1. 撮影前に `setRenderAllNodes(true)` を呼ぶ
2. React Flow が全ノードを DOM に描画するのを待つ（2フレーム分の `requestAnimationFrame` を await）
3. `exportMapAsImage(...)` を実行
4. `finally` ブロックで `setRenderAllNodes(false)` に戻す（成功・失敗どちらでも戻す）

### 16.2.1 PNG/SVG書き出しのデータURLデコード（Phase 33 不具合修正・2026-08-07）

`html-to-image` の `toPng`/`toSvg` はどちらも画像本体ではなく、`data:image/png;base64,...` または `data:image/svg+xml;charset=utf-8,<percent-encoded XML>` という**データURL文字列**を返す。`exportMapAsImage`（`packages/ui/src/services/exportService.ts`）は `dataUrlToBlob()` でこれをデコードしてバイト列の `Blob` に戻し、`getPlatform().file.exportBlob()`（`downloadBlob()` 経由）でファイルとして書き出す。

SVGは移行直後この変換を行わず、`toSvg()` が返すデータURL文字列をそのままファイル内容として書き出していた。そのため出力した `.svg` の先頭が `data:image/svg+xml;charset=utf-8,` から始まり、ブラウザが XML として解析できない不具合があった（`error on line 1 at column 1: Start tag expected, '<' not found`）。PNG と同じ `dataUrlToBlob()` → `downloadBlob()` の経路に統一して解消した。

### 16.3 フォーカス表示の Context 配布（`packages/ui/src/hooks/useNodeFocus.ts`）（Phase 28）

フォーカスモード（選択ノードと直接接続だけを明るく表示）・発表モード・接続モードの dim / 強調は、**ノード配列に `style` を差し込まない**。

**Phase 27 以前の実装と問題**: `IdeaCanvas` の `displayNodes` / `displayEdges` が `nodes.map((n) => ({ ...n, style: { ...n.style, opacity } }))` で新しいノードオブジェクトを生成していた。選択が変わるたびに全ノードが新しい参照になるため、React Flow は「全ノードが変化した」と判断して全ノードを再描画していた。

**Phase 28 の設計**:

| 責務 | 実装 |
|---|---|
| 状態の算出 | `IdeaCanvas` が `FocusState`（`selectedNodeId` / `highlightNodeIds` / `presentationNodeId` / `isPresentationMode` / `connectingFromNodeId`）を `useMemo` で1回だけ組み立てる |
| 状態の配布 | `FocusStateContext.Provider` で配る。`<ReactFlow nodes={nodes} edges={edges}>` には**ストアの配列をそのまま**渡す |
| 自ノードの判定 | `IdeaNode` / `GroupNode` が `useNodeFocus(id)` を呼び、自分の `opacity` と `isConnectSource` だけを受け取る |
| 自エッジの判定 | `FloatingEdge` が `useEdgeFocusOpacity(source, target)` を呼ぶ |

**dim 値**: ノードはフォーカス時 `0.15` / 発表モード時 `0.1`、エッジはフォーカス時 `0.1` / 発表モード時 `0.05`。接続元ノードは `outline: 2px solid #6366f1`。検索・カテゴリフィルタの dim（`0.2`）とは `Math.min` で合成する。

**ドラッグ中に Context 値を変えないための工夫**: `highlightNodeIds` の算出にはグループの親子関係が必要だが、`nodes` を依存に入れるとドラッグの毎フレームで再計算されてしまう。そのため親子関係は「`id|parentId` を連結した**文字列配列**」として購読する。

```ts
const groupChildPairs = useMapStore(
  useShallow((s) => s.nodes.filter((n) => n.parentId).map((n) => `${n.id}|${n.parentId}`))
)
```

ドラッグでは配列の内容が変わらないので `useShallow` が同一と判定し、`focusState` の参照も変わらない。結果としてドラッグ中はノード・エッジの再描画が発生しない。

### 16.4 Zustand セレクタ方針（Phase 28）

`useMapStore()` / `useUIStore()` のようなストア全体購読は、無関係な状態変化でもコンポーネントを再描画させる。特に `mapStore.nodes` はドラッグ中に毎フレーム更新されるため影響が大きい。以下の方針で購読を絞る。

| パターン | 指針 |
|---|---|
| 複数の値・アクションが必要 | `useShallow` でオブジェクトを返すセレクタにする（アクションは参照が安定しているため再描画を誘発しない） |
| 描画に使わず実行時にだけ必要（AI 送信・整列・エクスポート等） | 購読せず、ハンドラ内で `useMapStore.getState()` から読む |
| 単一ノードだけ必要 | `useMapStore((s) => s.nodes.find((n) => n.id === id))` |
| 真偽値・件数だけ必要 | `useMapStore((s) => s.past.length > 0)` のようにプリミティブを返す |
| パネルが閉じている間は不要 | `useMapStore((s) => (isOpen ? s.nodes : NO_NODES))` のように**モジュールレベルの固定参照**へフォールバックする（`SearchBar` / `AIChatPanel` のメンション候補） |

`IdeaNode` は `color` と `categoryId` をストアから直接読むために `nodes.find()` を2回走らせていた（全ノード × 毎更新）。Phase 28 で `useShallow` による1セレクタに統合した。`NodeActionBar` の親ノード探索も、絶対座標 `{ x, y }` だけを返す1セレクタに統合している。

### 16.5 バンドル分割と動的 import（Phase 28）

**分割前**: 単一チャンク 845.81 kB（gzip 247.86 kB）。Vite が 500 kB 超の警告を出していた。

**`vite.config.ts` の設定**: Vite 8 は rolldown ベースのため `build.rolldownOptions.output.codeSplitting.groups` を使う（`rollupOptions` は deprecated、`manualChunks` はオブジェクト形式が非対応）。

| グループ | 対象 |
|---|---|
| `react-vendor` | `react` / `react-dom` / `scheduler` |
| `flow` | `@xyflow/react` |
| `ai` | `@anthropic-ai/sdk`（ただし `sdk/tools/` 配下を除く） |

> **`sdk/tools/` を除外する理由**: `@anthropic-ai/sdk` の `tools/agent-toolset/` は `node:util` の `promisify` などをモジュールのトップレベルで呼ぶ。通常は動的 import 経由の遅延チャンクに分離されブラウザでは評価されないが、グループ指定で eager なベンダーチャンクに取り込むと起動時に評価されて `(0, X.promisify) is not a function` で**アプリが起動しなくなる**。

**動的 import 化**:

- `utils/mapLayout.ts`: `@dagrejs/dagre` をモジュールスコープの `loadDagre()`（Promise キャッシュ）で遅延ロード。`applyDagreLayout` / `applyRadialLayout` が `async` になり、`Toolbar` の整列ハンドラも `async`（共通の `runLayout()` ヘルパーに集約、失敗時はトースト表示）。
- `services/exportService.ts`: `html-to-image` を `exportMapAsImage()` 内で `await import('html-to-image')` する。

**分割後（初回ロードで読むチャンクのみ）**: `index` 289.79 / `react-vendor` 189.64 / `flow` 177.26 / `ai` 144.40 / runtime 0.56 = 801.65 kB（gzip 231.63 kB）。`dagre.esm` 39.43 kB と `html-to-image` 12.51 kB は整列・エクスポート実行時まで読み込まれない。500 kB 警告も解消。

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

---

## 17. レスポンシブ／モバイル設計（Phase 25）

スマホ（特に iPhone SE 幅 375px）で全パネル・メニューが画面内に収まり、はみ出し・見切れ・横スクロールが起きないようにする。**PC の既存挙動（右クリック・ハンドルドラッグ・ショートカット・キャンバスと共存するチャットパネル等）は一切変更せず、スマホ用の経路を「追加」する**方針。

### 17.1 ブレークポイント方針

- 基本は Tailwind の `sm:`（640px）プレフィックスで分岐する。デフォルト（モバイル）クラスを書き、`sm:` 以上で PC 挙動を上書きする。
- CSS だけで表現できない判定（DOM 実寸での分岐など）に限り JS で `window.innerWidth < 640` を使う。
- 一時的に表示される UI（コンテキストメニュー等）はマウント時に1度だけモバイル判定すれば足り、リサイズ・回転への追従は不要（開き直しで再評価）。

### 17.2 下部シートパターン（標準）

モバイルでは中央/右固定ダイアログを画面下部のシートとして出す。基準実装は `NodeDetailPanel` / `AISuggestionPanel`：

- オーバーレイ親: `fixed inset-0 flex items-end sm:items-center justify-center`（モバイル下端寄せ → PC 中央）
- パネル本体: `w-full sm:max-w-*`（モバイル全幅 → PC 最大幅制限）、`rounded-t-2xl sm:rounded-2xl`、`max-h-[85vh]` 等で高さ制限

### 17.3 パネル幅・マスク方針

| コンポーネント | モバイル | PC（`sm:`以上） | マスク |
|---|---|---|---|
| `AIChatPanel` | 下部シート（`w-full h-[85%] rounded-t-2xl`、上部15%にマスクを露出） | `w-96`（右384px・全高） | **モバイル限定**（`sm:hidden` の `bg-black/30` を背面 z-30 に。PC はマスクなしでキャンバス操作と共存） |
| `MapAnalysisPanel` | `w-full` | `max-w-md`（右448px） | 既存 `inset-0` マスク（共通） |
| `PresentationMode` | 下部シート（`w-full max-h-[55vh]`、`justify-end` で下端固定、ナビバー回避に `mb-14`） | 右480px・全高（`sm:w-[480px] sm:h-full`） | なし（スペーサは `pointerEvents:none` でキャンバス追従） |
| `NodePanel` | 非表示（`hidden`、NodeActionBar が代替） | `sm:flex w-60` | — |

**原則**: 背景マスクで PC のキャンバス操作を妨げてはならない。PC で共存させたいパネル（AIChatPanel）のマスクは `sm:hidden` にする。

> **マスクは必ず露出させること（Phase 31 で修正）**: `AIChatPanel` は当初モバイルでも `h-full` の全画面表示で、背面マスクがパネル本体に完全に覆われてタップできず「外タップで閉じる」が成立していなかった。`h-[85%]` の下部シートに変更して上部15%にマスクを露出させ、17.2 の下部シートパターンに揃えた。**モバイルでマスクを持つ全画面級のパネルを追加するときは、マスクに到達できる余白を必ず残すこと**（`document.elementFromPoint()` で到達可能か検証できる）。

### 17.4 コンテキストメニューの位置補正（`ContextMenu.tsx`）

- 旧実装の縦位置固定値 `window.innerHeight - 360` を撤廃。`useRef` + `useLayoutEffect` でメニュー DOM の実寸（`offsetWidth/offsetHeight`）を測り、`Math.max(8, Math.min(pos, viewport - size - 8))` で画面内にクランプする。
- **計測結果をリセットする副作用を置いてはならない（Phase 31 で修正）**: `useEffect([contextMenu])` 側で `setClampedPos(null)` していたため、パッシブ効果が `useLayoutEffect` の計測結果を毎回打ち消し、推定値（高さ200px固定）のまま描画されていた。結果としてノードメニュー（実高334px）を画面下部で開くと下端が画面外に出て「ノードを削除」等に到達できなかった。リセットは削除し、`showCategories`（カテゴリ サブメニューの展開で高さが変わる）を計測効果の依存に追加している。
- モバイル（`window.innerWidth < 640`）では絶対配置をやめ、`fixed bottom-0 left-0 right-0 w-full rounded-t-2xl` の下部シートとして表示。項目のタップ領域を `py-3 sm:py-1.5` に拡大。背景の `fixed inset-0` はタップで閉じるマスクとして流用。
- メニュー項目の内容（node/edge/pane/group）は不変。表示器の枠だけをレスポンシブ化する。
- **Phase 26 追加**: モバイルでは `IdeaNode.tsx` の `onTouchStart` 長押し（500ms）でコンテキストメニューを起動する。`touch.clientX/clientY` を `setTimeout` の外のローカル変数に取り込み `openContextMenu({ type: 'node', x, y, targetId: id })` を呼ぶ。`navigator.vibrate?.(10)` で触覚フィードバック（対応端末のみ）。pane（空白）の長押しは `IdeaCanvas.tsx` の `onTouchStart` で同様に処理。

### 17.5 NodeActionBar の画面端クランプ（`IdeaCanvas.tsx`）

ズーム/パン追従（`useViewport` + `flowToScreenPosition`）で算出した `left` を半幅でクランプ（`Math.max(halfWidth+8, Math.min(screenX, innerWidth - halfWidth - 8))`）して画面端でも横方向に見切れないようにする。`translateX(-50%)` 追従は維持。

半幅は **`useLayoutEffect` でバー DOM の `offsetWidth` を測った実測値**を使う（Phase 31 で修正）。当初は定数 `BAR_HALF_WIDTH = 120` を使っていたが、実際のバーは 320px（半幅160px）あり、375px 幅の端末では右端が約32pxはみ出していた。定数 `BAR_HALF_WIDTH_ESTIMATE` は初回描画のフォールバックとしてのみ残す。計測は `[selectedNodeId, halfWidth]` を依存に取り、差が 0.5px 以下なら再設定しないことで更新ループを防ぐ。

### 17.6 セーフエリア・ビューポート規約

- `index.html` の viewport meta に `viewport-fit=cover` を付与（ノッチ端末でセーフエリア変数を有効化）。
- 画面下端に固定する UI には `pb-[env(safe-area-inset-bottom)]` を付与し、iOS ホームインジケーターとの被りを回避（対象: `BottomNav`、`Toast`）。
- ルートは `height: 100%`（`index.css`）で運用。アドレスバー伸縮の影響は限定的なため `100dvh` は現状未採用（必要時に検討）。

### 17.7 BottomNav（モバイル専用ツールバー）

- `sm:hidden` でモバイルのみ表示。「追加」は `screenToFlowPosition` → `findFreePosition`（[11.5](#115-ノード追加位置の重なり回避findfreeposition-phase-21)）→ `addNode` → `setSelectedNodeId`/`setEditingNodeId` で中央・非重複に追加し即編集（Toolbar と同一パターン。旧 `Math.random()` 配置は撤廃）。
- 追加・元に戻す・やり直し・検索・**発表**・拡大・全体・縮小・設定・ヘルプの計10ボタン。`overflow-x-auto justify-start gap-1` + 各ボタン `flex-shrink-0` で横スクロールにより全ボタンへ到達。Undo/Redo は `mapStore.undo/redo`（`past`/`future` の長さで `disabled`）、検索は `uiStore.setSearchOpen(true)`。
- 「発表」（Phase 31 追加）は `setPresentationOrderOpen(true)` で発表順序パネルを開く。`Toolbar` が `hidden sm:flex` のためスマホでは**ここが発表モードへの唯一の入口**。PC の Toolbar と違いリストが空でも `disabled` にせず、パネルの空状態で追加方法を案内する。発表リストが1件以上ならバッジで件数を表示。
- **`IdeaCanvas` のルート列には `min-w-0` が必須**（Phase 31 で修正）。BottomNav は横スクロールするが、その min-content 幅（10ボタンで約491px）がフレックスアイテムの自動最小幅になり、`min-w-0` がないとキャンバス列が 375px のビューポートより広くなって右端が見切れる（React Flow の座標系ごと画面外に出るため、右端のノードがタップできなくなる）。

### 17.8 スマホ タッチ操作（Phase 26）

**PC の既存挙動（右クリックメニュー・ハンドルドラッグ接続・キーボードショートカット・キャンバスと共存するパネル）は一切変更しない**方針。スマホ用の経路を「追加」する。

#### 接続モード方式（エッジ作成）

- `uiStore.connectingFromNodeId: string | null` で接続元ノードを管理。
- ノード選択後、`NodeActionBar` の「🔗 接続」ボタンをタップ → `setConnectingFromNodeId(selectedNodeId)` で接続モードに入る。
- 接続モード中は画面上部に `createPortal` で固定バナー（「接続先のノードをタップ」＋「キャンセル」ボタン）を表示（z-index: 45）。
- `handleNodeClick` を拡張: `connectingFromNodeId` が真で別ノードをタップ → `mapStore.connectNodes(connectingFromNodeId, node.id)` → `setConnectingFromNodeId(null)` → トースト「接続しました」。同じノードをタップ → 接続モード解除のみ。
- `handlePaneClick` で `setConnectingFromNodeId(null)` を呼び、空白タップでもキャンセル。
- `displayNodes` の `useMemo` に分岐を追加: 接続モード中は接続元ノードに `outline: '2px solid #6366f1'` を付与。
- 接続中だけ `<ReactFlow>` に `className="tap-connect"` を付与し、`index.css` で `.tap-connect .react-flow__node { cursor: crosshair !important; }` を適用。掴むカーソル（[14. テーマ設計](#14-テーマ設計)参照）と詳細度が同じため、`!important` かつ CSS 内で後方に配置することで優先させている（Phase 33）。

#### ロングプレス起動

- `IdeaNode.tsx`: `handleTouchStart(e: React.TouchEvent)` で `e.touches.length === 1` のみ処理。座標を先にローカル変数に取り込んで 500ms タイマーを張る。発火時に `openContextMenu({ type: 'node', x, y, targetId: id })` → `navigator.vibrate?.(10)`。
- `IdeaCanvas.tsx`: 外側ラッパ div に `onTouchStart/End/Move` を追加。対象が `.react-flow__pane` 上かつ `.react-flow__node` でない場合のみ 500ms タイマーで `openContextMenu({ type: 'pane', x, y, flowPosition })` → `navigator.vibrate?.(10)`。`touchmove/touchend` でタイマー解除（パン・スクロールと競合させない）。`preventDefault` は呼ばない（React Flow のパン/ピンチを保護）。
- `ContextMenu.tsx` の node メニューに「🔗 接続を作成」を追加 → `setConnectingFromNodeId(targetId)` で接続モード開始。

> **実際に効いている経路（Phase 30・31 の検証結果）**: 上記2つの `onTouchStart` タイマーは、React Flow の d3-drag が `touchstart` を `stopImmediatePropagation()` するため React のバブル経由では呼ばれない。タッチ端末で実際にメニューを開いているのは**ブラウザが長押しで発火する `contextmenu`**（`IdeaCanvas.handleNodeContextMenu` / `handlePaneContextMenu`）である。したがって長押し関連の仕様変更・不具合対応は `contextmenu` 側を主経路として扱うこと。タイマー実装は非タッチ環境と将来の保険として残している。

#### 接続モード中のメニュー抑止（Phase 30）

接続モード中の長押し／タップは「接続先の選択」が目的なので、コンテキストメニューを開く経路を2つとも塞ぐ。

| 経路 | 対策 |
|---|---|
| `IdeaNode.handleTouchStart` の 500ms タイマー | 先頭で `if (connectingFromNodeId) return`（タイマー自体を張らない） |
| ブラウザが長押しで発火する `contextmenu`（`IdeaCanvas.handleNodeContextMenu`） | `preventDefault()` の直後に `if (connectingFromNodeId) return` |

> **検証で判明**: React Flow のノードはドラッグ用に d3-drag が `touchstart` を `stopImmediatePropagation()` するため、`IdeaNode` の `onTouchStart` はタッチ環境では実質発火しない（Chromium のタッチエミュレーションで確認）。実機で長押しメニューが開くのはブラウザの `contextmenu` 経由。したがって実効的なガードは後者だが、将来ドラッグ設定が変わった場合に備えて前者も残している。

---

## 18. デスクトップアプリ版とコア共通化（Phase 32〜）

**詳細設計は [desktop/README.md](desktop/README.md) を起点とする `docs/desktop/` 配下にあります。** 本章はその要点と、本書（Web版設計）との関係のみを記載します。移行完了時には本書の第1章・第3章・第9章・第10章・第12章を新構成に書き換えます。

### 18.1 目的

**ローカルLLM（Ollama, `http://localhost:11434`）を使うこと。** ブラウザから localhost の Ollama を叩く構成は CORS 設定（`OLLAMA_ORIGINS`）がユーザー環境に依存し、GitHub Pages 配信の Web 版では安定提供できません。Tauri の Rust プロセス経由（`tauri-plugin-http`）ならブラウザの CORS 制約を受けません。

### 18.2 技術選定

| 項目 | 決定 |
|---|---|
| フレームワーク | Tauri v2 |
| リポジトリ構成 | pnpm workspaces のモノレポ |
| プラットフォーム差の吸収 | Platform Adapter を `setPlatform()` でシングルトン注入 |
| LLM 抽象化 | `LLMProvider` インタフェース（`ClaudeProvider` / `OllamaProvider`） |
| デスクトップの保存先 | ローカルファイル（`.ideamap`、実体はJSON）中心 |
| APIキー保管 | デスクトップは OSキーチェーン（マスターパスワード不要） |

選定理由と却下した候補は [desktop/adr-001-framework-selection.md](desktop/adr-001-framework-selection.md) を参照。

### 18.3 目標構成

```
ai-idea-map/
├── packages/
│   ├── core/          型・Zustandストア・レイアウト計算・LLMProvider（純粋ロジック）
│   ├── ui/            Reactコンポーネント・UI hooks
│   └── platform/      Platform Adapter の型定義とレジストリのみ
└── apps/
    ├── web/           Web版シェル。Adapter Web実装・Google Drive同期・GIS認証・共有URL
    └── desktop/       Tauri v2 シェル。Adapter Desktop実装・src-tauri
```

依存方向は `apps/* → packages/ui → packages/core → packages/platform` の一方向。逆方向の import は `eslint-plugin-import` の `import/no-restricted-paths` で検出します。

### 18.4 Platform Adapter

| Adapter | 責務 | Web実装 | Desktop実装（`apps/desktop/src/platform/*.desktop.ts`） |
|---|---|---|---|
| `StorageAdapter` | Key-Value 永続化 | `localStorage` | `@tauri-apps/plugin-store`（`LazyStore('app-data.json')`、`$APPCONFIG` 配下） |
| `FileAdapter` | マップファイルの読み書き | Google Drive API / ブラウザダウンロード | `@tauri-apps/plugin-dialog`（開く/保存ダイアログ）+ `@tauri-apps/plugin-fs`（読み書き・自動保存領域）+ `'cloud'` origin は `packages/core` の `driveService`（Web版と共通、Phase 38） |
| `SecretAdapter` | APIキー等の秘密情報 | WebCrypto（PBKDF2+AES-GCM）+ localStorage | OSキーチェーン。Rust 側の `keyring` crate（`src-tauri/src/keychain.rs`）を4つの Tauri コマンドでラップし `invoke()` から呼ぶ |
| `HttpAdapter` | HTTP 呼び出し | `fetch` | `@tauri-apps/plugin-http` の `fetch`（Rust の reqwest から発行するためブラウザの CORS プリフライトは受けないが、webview の Origin ヘッダは自動付与されるため、本番ビルドでは `unsafe-headers` feature ＋ Origin 除去が別途必要だった） |
| `SystemAdapter` | クリップボード・外部URL・終了前確認・通知 | ブラウザAPI（`navigator.clipboard`・`beforeunload`） | `@tauri-apps/plugin-clipboard-manager`（クリップボード）/ `@tauri-apps/plugin-opener`（外部URL）/ `@tauri-apps/api/window` の `onCloseRequested` + `@tauri-apps/plugin-dialog` の `ask()`（終了前確認） |

**`HttpAdapter` が本計画で最も重要な接続点です。** `packages/core` の `LLMProvider` 実装は `fetch` を直接呼ばず必ず `getPlatform().http` を経由し、デスクトップ版ではそれが Rust 側の HTTP クライアントに解決されることで、ブラウザの CORS プリフライトを経由せず Ollama へ到達できます。ただし plugin-http は webview の Origin ヘッダを自動付与するため、本番ビルドでは別途 Origin を落とす対応が必要でした（詳細は [desktop/README.md](desktop/README.md) §3.3 の訂正）。

**`HttpAdapter.canAccessLocalServers`（Phase 35 で追加）**: Web=`false` / Desktop=`true` の読み取り専用プロパティ。`SettingsPanel` がプロバイダ切り替えUIを描画するかどうかの判定に使う（§9.8）。

**`FileAdapter.origin`（Phase 34 で追加）**: Adapter が扱う保存先の種別を `'cloud' | 'local'` で公開する読み取り専用プロパティ。`useAutoSave` が `currentFileId` から `FileRef` を組み立てる際に `origin` を決め打ちできないため追加した。Web実装は常に `'cloud'`、Desktop実装は常に `'local'` を返す。**Phase 38 でこの値の意味が変わった**: デスクトップ版の `desktopFileAdapter` は Drive とローカルの両方を扱う複合アダプタになり、`origin` は「この Adapter が扱う唯一の保存先」ではなく「保存先が未指定のときの既定（＝ローカル）」を表す。実際にどちらを使うかは呼び出し側が渡す `FileRef.origin`（`'cloud' | 'local'`）で都度決まる（§4.2 `currentFileOrigin`）。

**`SecretAdapter.isPassphraseFree`**（Phase 33 で追加・Phase 34 で初めて `true` の実装が入った）: Desktop実装は常に `true` を返し、`SettingsPanel` はこの値を起動時に一度だけ読んで「キーはこの端末のOSキーチェーンにのみ保存されます」／「キーはこのブラウザにのみ保存されます」の文言を出し分ける。

インタフェースの完全な型定義は [desktop/architecture.md](desktop/architecture.md) §3、Phase 33/34 での変更点は [desktop/README.md](desktop/README.md) §3.1-C・§3.1-D にあります。

### 18.5 Tauri の capabilities と CSP（`apps/desktop/src-tauri`、Phase 34）

権限は `main-window` / `file-access` / `ai-http` / `google-drive`（Phase 38）の4つの capability ファイル（`src-tauri/capabilities/*.json`）に分割し、`tauri.conf.json` の `app.security.capabilities` で読み込む。

| capability | 許可する権限 |
|---|---|
| `main-window` | ウィンドウの基本操作（タイトル変更・閉じる・破棄）、`dialog`（open/save/ask/message）、クリップボード書き込み、外部URLオープン、`store` |

| `file-access` | `fs`（読み書き・mkdir・remove・stat・exists）。`fs:scope` は `$APPCONFIG` と `$APPLOCALDATA` 配下のみに限定する |
| `ai-http` | `http:default` に AIプロバイダの通信先のみ許可（`https://api.anthropic.com/*`・`https://api.openai.com/*`（Phase 39）・`https://ollama.com/api/*`・`http://localhost:*/*`・`http://127.0.0.1:*/*`）。ポート部分はワイルドカードにしており、設定UIで Ollama の接続先URLのポートを変更できる（Phase 35。ホストは localhost 系に限定したままなので攻撃面は localhost 上のサービスに限られる）。Ollama・OpenAI 用に別ファイルを作らず、Anthropic API と同じ「AIプロバイダへの通信」として統合している。`https://ollama.com/api/*` は Web検索API（`/api/web_search`）向けに Phase 35 の追加実装で加えた（§9.10） |
| `google-drive`（Phase 38） | `http:default` に `https://oauth2.googleapis.com/*`（トークン交換・失効）・`https://www.googleapis.com/*`（Drive API）のみ許可。認可画面自体は `opener` で OS 既定ブラウザに出すため `accounts.google.com` はここに含めない（§18.9） |

**外部URLオープンのスコープ**: `opener:allow-open-url` は文字列でそのまま並べると**URLスコープが空になり `openUrl()` が全て拒否される**。`{ "identifier": "opener:allow-open-url", "allow": [{ "url": "https://*" }, { "url": "http://*" }] }` の形で書く（Phase 35 追加実装で修正。プラグインの `opener:default` は `mailto:` / `tel:` とファイルマネージャ起動も含むため、本アプリは必要な http/https だけに絞っている）。

**ダイアログで選んだパスへの `fs` 許可**: `fs:scope` はアプリ専用ディレクトリだけに絞り、ユーザーが「開く/保存」ダイアログで選んだ任意のパスは `dialog` プラグインが実行時に付与する一時許可に任せる。この許可を次回起動でも有効にする（＝「最近開いたファイル」を再度開ける）ため、`tauri-plugin-persisted-scope` を依存に追加し、`lib.rs` で **`fs` プラグインより後に**登録している。任意のディレクトリを `fs:scope` に静的追加するより攻撃面が狭い（「ユーザーが一度選んだファイルだけ」に限定できる）。

**CSP**: `default-src 'self'; script-src 'self'` を基本とし、`img-src` はデータURL・Blob・`asset:`（Tauri のアセットプロトコル）を許可、`connect-src` は `ipc:` と `http://ipc.localhost`（Tauri の内部通信）に加えデータURL・Blobを許可する。開発時（`devCsp`）のみ Vite の HMR 用に `script-src 'unsafe-inline'` と `ws://localhost:5174` / `http://localhost:5174` を追加で許可する。**Phase 38 で Google Drive・トークンエンドポイントへの通信を追加したが、`csp`/`devCsp` は変更していない**。これらの通信は `HttpAdapter.request` 経由＝Rust 側の `plugin-http` が発行するため WebView の CSP を通らず、許可は capability（`google-drive`）側だけで足りる。Phase 35 の Anthropic API・ollama.com が `connect-src` に無いまま動いている実績が同じ理屈の裏付けになっている。

ウィンドウは `dragDropEnabled: true`（Phase 34 時点は `false` で様子見していたが、Phase 37 で React Flow との非競合を実機確認したうえで有効化した。§18.8）、クリップボードは `navigator.clipboard` ではなく `@tauri-apps/plugin-clipboard-manager` を使う（WebView のセキュアコンテキスト判定に依存しないため）。

### 18.6 本書の既存章への影響

| 本書の章 | 移行後の変更 |
|---|---|
| 1. アーキテクチャ概要 | Web版/デスクトップ版の2構成に書き換え |
| 3. プロジェクト構成 | モノレポ構成に書き換え |
| 9. Claude API連携設計 | 見出しは既に「AI連携設計」化済み。`LLMProvider` と `OllamaProvider` の反映は Phase 35 で完了（§9.0〜9.9）。Web検索（`LLMProvider` の外側の独立機能）を Phase 35 の追加実装で反映（§9.10〜9.11）。`OpenAIProvider` を Phase 39 で追加（§9.0〜9.1.3・§9.6） |
| 10. APIキー暗号化設計 | `SecretAdapter` 経由に。デスクトップはOSキーチェーンで暗号化不要。Phase 39 で論理キー別（Claude／OpenAI）に一般化 |
| 12. Google Drive連携設計 | REST 呼び出し（§12.2・§12.3）は Phase 38 で `packages/core` に共通化。認証・UIは Web版が本章、デスクトップ版が §18.9 に別記 |

### 18.7 ビルド・配布・自動更新（`apps/desktop`、Phase 36）

**バージョニング**: ルート `package.json` の `version`（初期値 `0.1.0`）を単一の真実にし、`scripts/sync-version.mjs` が `apps/web/package.json`・`apps/desktop/package.json`・`apps/desktop/src-tauri/tauri.conf.json`・`apps/desktop/src-tauri/Cargo.toml` の4ファイルへ配る。`pnpm check-version`（`--check` フラグ）はズレていると非ゼロ終了するため、`.github/workflows/release-desktop.yml` の `verify-version` ジョブがビルド前に実行し、タグ（`desktop-v<version>`）とルートの `version` の一致も検査する。

**配布**: `desktop-v*` タグの push で起動する GitHub Actions（`tauri-apps/tauri-action@v0`）が Windows（msi/nsis）・macOS（aarch64/x64 の dmg）をビルドし、`releaseDraft: true` で GitHub Releases の下書きを作る（内容確認後に手動公開するまで自動更新の参照先にならない）。`checksums` ジョブがリリース成果物から `SHA256SUMS.txt` を生成して添付する。

**自動更新**: `tauri-plugin-updater` + `tauri-plugin-process`。Rust依存は `src-tauri/Cargo.toml` の `[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]` に置き、`lib.rs` では `#[cfg(desktop)]` でプラグインを登録する（モバイル向けビルドを対象外にするため）。権限は `capabilities/updater.json`（`updater:default` / `process:allow-restart`）。`apps/desktop/src/updater.ts` が更新チェックを提供する。

| 経路 | 呼び出し元 | 結果の扱い |
|---|---|---|
| 起動時自動チェック | `scheduleStartupUpdateCheck()`（`DesktopApp.tsx` の `useEffect`、起動5秒後） | 失敗・更新なしは無言（`silent: true`） |
| 手動チェック | 設定パネルの `UpdaterSection`（`checkForUpdate(false)`） | 結果を必ずトースト/ダイアログで返す |

更新が見つかると `ask()` でユーザーに確認し、承諾されたら `flushPendingSave()` でデバウンス待ちの自動保存（`uiStore.saveStatus`）を最大10秒待って確定させてから `update.downloadAndInstall()` → `relaunch()` する。更新パッケージの署名検証は Rust 側（`tauri-plugin-updater`）が公開鍵（`tauri.conf.json` の `plugins.updater.pubkey`）で行うため、コード署名証明書が無くても配布後の改ざんは検出できる。更新の取得自体は Rust 側（reqwest）が行うため、WebView の CSP（`csp`/`devCsp`）には関係せず、Phase 36 で変更していない。

### 18.8 デスクトップ固有UX（`apps/desktop`、Phase 37）

**ファイル関連付け + 多重起動防止**: `tauri.conf.json` の `bundle.fileAssociations` で `.ideamap` を OS に登録し、`tauri-plugin-single-instance` を他のプラグインより先に登録する（2つ目のプロセスの引数を既存ウィンドウへ転送するため）。`apps/desktop/src-tauri/src/launch.rs` が起動引数からマップファイルらしきパス（`.ideamap`/`.json`、`-` 始まりのオプションは除外）を1つ選び `PendingLaunchFile` に保持し、フロントは `take_launch_file` コマンド（`apps/desktop/src/launchFile.ts`）で1回だけ取り出す。2つ目のインスタンスからは `ideamap://open-map-file` イベントで届く。macOS は起動引数ではなく `RunEvent::Opened` でファイルパスを受け取るため、`lib.rs` は `tauri::Builder::run(context)` ではなく `build(context)` → `app.run(closure)` の形に変更している（macOS 実機は未検証）。

**起動引数のパスへの `fs` 許可**: §18.5 のとおり `fs:scope` はアプリ専用ディレクトリのみで、ユーザーが選んだパスは `dialog` プラグインが実行時に許可を足す設計（Phase 34）。ダブルクリック起動は `dialog` を通らないため、`launch.rs` の `grant_fs_access()` が `FsExt::try_fs_scope()` と `tauri::scope::Scopes` の両方に `allow_file()` を明示的に呼ぶ。これが無いと `forbidden path` で読み込みに失敗する。一方ドラッグ&ドロップは Tauri 本体が Drop イベント処理の中で同じ許可を出すため不要（`tauri` 2.11.5 の `DragDropEvent::Drop` 分岐で確認済み）。

**ドラッグ&ドロップ**: `app.windows[].dragDropEnabled` を `false` → `true` に変更。`apps/desktop/src/components/FileDropOverlay.tsx` が `getCurrentWebview().onDragDropEvent` を購読し、ドラッグ中はオーバーレイを表示、`.ideamap`/`.json` 以外は案内トーストを出す。未保存の変更があるときは確認ダイアログを挟む。React Flow のノード操作は HTML5 の drag&drop ではなくポインタイベント（d3-drag）で実装されているため、OSレベルのファイルドロップとは競合しない（実機確認済み。`docs/desktop/README.md` §5「Phase 37 で解消した項目」）。

**ウィンドウ状態の記憶**: `tauri-plugin-window-state` を追加。Rust 側だけで完結し JS からは呼ばないため capability の追加は不要。`WindowEvent::CloseRequested`/`Moved`/`Resized` と `RunEvent::Exit` で保存し、`SystemAdapter.onBeforeExit` の `window.destroy()` 経路でも `RunEvent::Exit` は発火するため保存される。

**外部でのファイル変更検知**: `apps/desktop/src/externalChange.ts` が `getCurrentWindow().onFocusChanged` を購読し、前面に戻ったときに `FileAdapter.getMetadata()` で mtime を取り直す。同じファイルについて初回は基準を記録するだけでダイアログを出さない（開いた直後の誤検知防止）。基準は `max(記録した mtime, uiStore.lastSavedAt)` に `MTIME_TOLERANCE_MS`（2000ms）の余裕を足したもの。超えたときだけ確認ダイアログを出し、未保存の変更があれば文言を変えて `danger: true` にする。「キャンセル」を選んだ場合も基準を進め、同じ内容を繰り返し尋ねない。ファイルシステム監視（`notify` crate）は初期リリースにはオーバースペックと判断し見送った。**Phase 38 で `currentFileOrigin === 'cloud'` のときは検知対象から外した**（Drive の `getMetadata` は `appProperties.mapId` のみを返し mtime を持たないため）。

**共有URLの代替**: `ExportImportPanel`（`packages/ui`）は `onGenerateShareUrl` が未指定でも「共有」タブ自体は隠さず、「JSONファイルとして共有」の案内（JSON書き出しボタン＋共有URLが無い理由の説明）を表示する（§5.1）。Web版（`onGenerateShareUrl` あり）の表示は変わらない。

**アプリ内「最近開いたファイル」リスト**（Phase 34 で実装済み）: `FileAdapter.listRecent()` と `DesktopFileDashboard` が既に提供している（§5.1.2）。OSの「最近使った項目」「ジャンプリスト」への統合は任意機能として未着手（`docs/desktop/platform-integration.md` §8）。

設計からの差分・実機確認の詳細は `docs/desktop/README.md` §3.1-G、`docs/implementation-plan.md` Phase 37 を参照。

設計ドキュメントからの差分は `docs/desktop/README.md` §3.1-F、実装・検証状況は `docs/implementation-plan.md` Phase 36 を参照。

### 18.9 デスクトップ版 Google Drive 連携（`apps/desktop`、Phase 38）

Web版で作ったマップをデスクトップ版からもそのまま開けるようにする機能。既定の保存先はローカルファイルのままで（§18.1〜18.3）、Drive は起動画面またはヘッダーから明示的に選ぶ「もう一つの保存先」として並ぶ（ヘッダーからの導線は Phase 38 への追加実装、2026-08-09）。

**認証がWeb版と別方式になる理由**: Google は組み込み WebView からの認可リクエストを `disallowed_useragent` で拒否するため、Web版の GIS ポップアップはデスクトップ版では使えない。代わりに認可画面を OS 既定ブラウザで開き、ループバック（`http://127.0.0.1:<port>`）+ PKCE（RFC 8252）で受け取る方式にした。

**フロント側（`apps/desktop/src/googleAuth.ts`）**:
- クライアントIDは `VITE_GOOGLE_DESKTOP_CLIENT_ID`（Google Cloud Console で「デスクトップアプリ」種別として発行。Web版の `VITE_GOOGLE_CLIENT_ID` とは別物で使い回せない）。未設定でもアプリは動き、起動画面のドライブ欄が案内表示になるだけ（`isDesktopClientIdMissing`）
- スコープは `https://www.googleapis.com/auth/drive.file openid email`。`openid email` は接続アカウントのメールアドレス取得用で、Web版のように `userinfo` エンドポイントは叩かず、トークンエンドポイントが返す ID トークン（JWT）の `email` クレームをデコードして読む（TLS 経由で直接受け取ったものなので署名検証は省略）
- PKCE の `code_verifier` / `state` は `crypto.getRandomValues`（セキュアコンテキストの制約を受けない）で生成し、`code_challenge`（S256）は Rust 側の `start_oauth_loopback` コマンドに `code_verifier` を渡して計算してもらう。`crypto.subtle` は Tauri の WebView でセキュアコンテキストとして使えるか未実測なため、使わずに済む設計にしてある
- `redirect_uri` は `http://127.0.0.1:<port>`（`localhost` はファイアウォールで弾かれうるとGoogle公式が明記しているため使わない）。ポートは `start_oauth_loopback` が毎回 OS から借りる（デスクトップアプリ種別は redirect URI の事前登録が不要）
- `access_type=offline` は送らない（installed app は常にリフレッシュトークンが返るとGoogle公式が明記）。`client_secret` も既定では送らず、要求される構成のときだけ `VITE_GOOGLE_DESKTOP_CLIENT_SECRET`（任意）で渡す
- ブラウザは `@tauri-apps/plugin-opener` の `openUrl()` で開く。認可結果は `ideamap://oauth-callback` イベントで1回だけ届く（購読はブラウザを開く前に張る）

**Rust側（`apps/desktop/src-tauri/src/oauth.rs`）**: `tauri-plugin-oauth` は使わず、`std::net::TcpListener` を使った自前のループバックサーバ。理由は「1本の GET のクエリを読む」だけで足り、プラグインを増やすと JS依存・Rust依存・`lib.rs` 登録・capability の4点を揃える保守コストが増えるため。自前コマンド（`start_oauth_loopback` / `cancel_oauth_loopback`）はアプリ自身のコマンドなので capability の管轄外で、`keychain.rs` と同じ構成に揃う。`code_challenge_s256` は `sha2` + `base64` クレートで計算し、RFC 7636 Appendix B の検証ベクタと一致することをユニットテストで確認している。待ち受けは最大 `LISTEN_TIMEOUT`（300秒）で打ち切り、`state` 不一致・`/favicon.ico` へのアクセス・ユーザーの拒否（`error=access_denied`）をそれぞれ区別してフロントへ通知する。`lib.rs` は `OauthServer`（起動中サーバの停止フラグ）を `.manage()` し、2本のコマンドを `invoke_handler` に登録する。

**トークンの保管**: リフレッシュトークンは `SecretAdapter` の `googleRefreshToken` スロット（OSキーチェーン）。アクセストークンはメモリのみ（`useDesktopGoogleAuth` の state）。メールアドレスは表示用なので `StorageAdapter`（キー `ideamap-google-email`）に置く。アクセストークンは有効期限の300秒前（`REFRESH_MARGIN_SEC`）に自動更新をスケジュールし、起動時はキーチェーンにリフレッシュトークンが残っていれば自動でサインイン状態を復元する。リフレッシュに失敗した場合（Testing 公開ステータスの7日制限・ユーザーによる取り消し）は黙ってサインアウト状態に戻す。

**`useDesktopGoogleAuth`（`apps/desktop/src/hooks/useDesktopGoogleAuth.ts`）**: Web版 `useGoogleAuth` と同じ形の状態（`isSignedIn` / `accessToken` / `isLoading` / `error` / `userEmail` / `signIn` / `signOut` / `silentReauth`）を返し、`App` の `cloudAuth` prop・`useAutoSave` の 401 リトライから見て等価に扱えるようにしている。中身は別物（GIS のポップアップではなくループバック+PKCE）。サインアウト時は Google 側のトークンを失効させ、キーチェーンとメールアドレスの永続化を消し、`clearDriveCache()` を呼ぶ。**Drive 上のマップを開いたままサインアウトした場合は `uiStore.currentFileOrigin === 'cloud'` を見て `currentFileId` をクリアする**（ローカルファイルを開いている場合は保存先を保つため触らない）。

**起動画面の Drive UI（`apps/desktop/src/components/DriveSection.tsx`）**: `DesktopFileDashboard`（§5.1.2）に組み込まれる。サインイン前は接続ボタンと案内文、サインイン後は `listMaps()`（`packages/core` の `driveService`）で取得した一覧・開くボタン・「いま開いているマップをドライブに保存」ボタンを表示する。

**マップを Drive へ保存する共通処理（`apps/desktop/src/saveToDrive.ts`、Phase 38 追加実装）**: `saveCurrentMapToDrive(accessToken)` が、`buildMapFile(mapId)`（§4章 stores/mapSnapshot.ts）でスナップショットを組み立て `saveMap(token, title, content, null, mapId)` で保存し、成功したら `setCurrentFileId(fileId, 'cloud')` で以後の自動保存を Drive に向けるところまでを担う。`hasActiveMap` が `false`（マップ未読込）のときは何もしない。もとは `DriveSection.tsx` の `handleUpload` にインラインで書かれていたが、`openMap.ts` が「開く」処理を一本化しているのと同じ理由で、複数の呼び出し元（`DriveSection` の「いま開いているマップをドライブに保存」ボタンと、下記のヘッダーからの導線）から使えるよう切り出した。`DriveSection.tsx` はこの関数を呼び、成功時に Drive 一覧を再取得するだけになっている。

**ヘッダーからの保存先切り替え（Phase 38 追加実装）**: `Header`（`packages/ui`）の「接続済み」ドロップダウンメニューに「このマップをドライブに保存」項目を追加した（`onSaveToCloud` prop、§5.1）。ローカルのマップを開いている（`currentFileOrigin !== 'cloud'`）ときだけ表示する。`DesktopApp.tsx` は `onSaveToCloud={accessToken ? () => void saveCurrentMapToDrive(accessToken) : undefined}` を渡す。編集中の画面からは保存先切り替えの導線が起動画面にしかなく見つけにくかったため、ヘッダーからも直接切り替えられるようにした。元のローカルファイルは上げた時点の内容のまま残り、以後は更新されない。

**逆方向: ヘッダーからローカルへ保存し直す（`apps/desktop/src/saveToLocal.ts`、Phase 38 への続く追加実装）**: `saveCurrentMapToLocal()` が `buildMapFile(mapId)` のスナップショットを `getPlatform().file.saveFileAs(content, mapTitle)` に渡す。保存ダイアログの表示・ファイル書き込み・最近開いたファイルへの記録は既存の `desktopFileAdapter.saveFileAs`（§18.1〜18.3、`apps/desktop/src/platform/file.desktop.ts`）がすでに担っているため、ここが追加でやるのは返ってきた `FileRef` で `setCurrentFileId(ref.id, ref.origin)` して以後の自動保存をそのローカルファイルへ向けるところだけ。`saveFileAs` が `null`（保存ダイアログのキャンセル）を返した場合は失敗扱いにせず保存先も変えない。`hasActiveMap` が `false` のときは何もしない（`saveCurrentMapToDrive` と同じガード）。`Header` には `onSaveToLocal` prop（§5.1）を追加し、メニューに「このマップをローカルに保存」を `currentFileOrigin === 'cloud'` のときだけ表示する。「このマップをドライブに保存」とは表示条件が逆なので、メニューには常にどちらか一方だけが出る（サインアウト項目のように両方常時表示ではない）。`DesktopApp.tsx` は `onSaveToLocal={() => void saveCurrentMapToLocal()}` を渡す。`onSaveToCloud` と異なりネイティブダイアログのみで完結するため `accessToken` に依存しない。Drive 側のファイルは切り替えた時点の内容のまま残り、以後は更新されない。

**`desktopFileAdapter`（`apps/desktop/src/platform/file.desktop.ts`）**: `setDriveAccessToken(token)` でモジュール内変数にトークンを流し込む（`DesktopApp.tsx` が `accessToken` の変化を `useEffect` で反映する、Web版の `googleDriveService` と同じ形）。`openFile` / `saveFile` / `deleteFile` / `getMetadata` は `ref.origin === 'cloud'` のときだけ `packages/core` の `driveService`（`loadMap` / `saveMap` / `deleteMap` / `fetchMapAppProperties`）に処理を委譲し、それ以外はこれまで通りローカルファイルを扱う。`saveLocalMirror`（自動保存領域への書き込み）と `exportBlob` は Drive 化しておらず常にローカルのまま。

**`DesktopApp.tsx` の配線**: `cloudAuth = useDesktopGoogleAuth()` を生成し、`accessToken` の変化を `setDriveAccessToken` へ渡す。`useAutoSave` の `autoSave.remoteReady` は常に `true`（ローカルファイルシステムは常に使える）。`onSaveError` は `uiStore.currentFileOrigin === 'cloud'` のときだけ 401 をキーチェーンでの `silentReauth()` にルーティングし、再試行後も失敗すれば「再接続」アクションボタン付きトーストを出す（§12.4「Phase 38 以降のデスクトップ版」）。

**設定（`settings.json`）の Drive 同期は対象外**: デスクトップ版は APIキーを OSキーチェーンに置きマスターパスワードを持たないため、マスターパスワード暗号化が前提の `settings.json` 同期とは相性が悪い。`apps/desktop/src/main.tsx` は `setAppSettingsSync()`（§4.3）を注入していない。

設計からの差分・未検証事項の詳細は `docs/desktop/README.md` §3.1-H、実装・検証状況は `docs/implementation-plan.md` Phase 38 を参照。

---

## 19. エラーログ設計（packages/core/src/services/errorLog.ts、Phase 43）

未捕捉エラーを外部監視サービス（Sentry等）に送らず、端末内にのみ蓄積する方針（`docs/roadmap.md` §3.4）。専用の zustand ストアは作らず、モジュール内キャッシュを持つサービス関数群のみで構成する（表示は件数と一覧程度で済み、React 状態として配る必要が薄いため）。

- **`ErrorLogEntry`**: `{ time: string, source: string, message: string, stack?: string, count: number }`。`time` は ISO 8601、`count` は同一エラー（`source` と `message` が一致）が連続したときにエントリを増やさずまとめるためのフィールド（レンダーループ等でのログ肥大化を防ぐ）
- **永続化**: `getPlatform().storage`（`StorageAdapter`）のキー `ideamap-error-log` に JSON 文字列で保存する。読み込みは初回のみで、以後はプロセス内キャッシュ（モジュールレベルの `cache` 変数）を正として保存時に上書きする
- **上限件数**: `MAX_ENTRIES = 200`。超過分は古いエントリから切り詰める
- **API**: `recordError(source, error)`（記録。エラーハンドラから呼ばれるため内部で例外を握りつぶし決して throw しない）／`getErrorLog()`（一覧取得）／`clearErrorLog()`（全消去）／`exportErrorLog()`（テキストファイルとして書き出し。空なら何もせず `false` を返す。書き出しは `getPlatform().file.exportBlob()` を直接呼ぶ）
- **記録元（`packages/ui/src/hooks/useGlobalErrorLog.ts`）**: `window` の `error`/`unhandledrejection` イベントを購読し `recordError('window.onerror', ...)` / `recordError('unhandledrejection', ...)` を呼ぶ。Web版・デスクトップ版ともに WebView の `window` イベントで拾えるため `packages/ui` に置き、両アプリが共有する `App.tsx` の `AppInner` から1箇所で呼ぶ（各アプリの `main.tsx` に個別配線しない）。React のレンダーエラー用の ErrorBoundary は対象外（未処理の `window`/Promise エラーのみを捕捉する）
- **UI（`SettingsPanel.tsx` の `ErrorLogSection`）**: 記録件数が0件のときはセクション自体を非表示にする。「エクスポート」「消去」の2ボタンのみの最小UI

---

## 20. テスト基盤（Vitest、Phase 41〜）

自動テストは `packages/core` から導入する（Web版・デスクトップ版で共通する純粋ロジックを優先する方針）。`packages/ui`・`apps/*` は未整備。

- **配置**: `packages/core/vitest.config.ts`（`test.include: ['src/**/*.test.ts']`、`test.environment: 'node'`）。テストファイルはテスト対象と同じディレクトリに `*.test.ts` として同居させる方式（例: `src/llm/jsonUtils.ts` に対して `src/llm/jsonUtils.test.ts`）
- **import方針**: `describe`/`it`/`expect` は `vitest` から明示 import する。`globals: true` は設定していない
- **実行**: ルート `package.json` の `"test": "pnpm -r run test"` が、`"test"` スクリプトを持つワークスペース（現状は `packages/core` の `"test": "vitest run"` のみ）を再帰実行する
- **型検査との関係**: テストファイルは `packages/core/tsconfig.json` の `include: ["src"]` に含まれるため、`pnpm typecheck`（`tsc -b`）の対象にもなる
- **CI連携**: `.github/workflows/deploy.yml` の `build` ジョブ、`.github/workflows/release-desktop.yml` の `build` ジョブがそれぞれ `pnpm install` の直後・本体ビルドの前に `pnpm test` を実行する。テストが赤ければデプロイ・リリースの後続ステップが止まる
- **旧・手動検証スクリプトとの関係**: `verify-openai.mts` は `src/llm/openaiProvider.test.ts` へ、`verify-radial-layout.mts` は `src/layout/mapLayout.test.ts` へ全項目を移植済みで、`.mts` 本体と `check:openai`/`check:radial` スクリプトは削除した（Phase 41 Step3・Step4）

---

## 21. テンプレートマップ設計（packages/core/src/templates/mapTemplates.ts、Phase 46）

```typescript
export interface MapTemplate {
  id: string
  name: string        // テンプレート一覧に表示する名前
  description: string // 一覧に表示する1行説明
  mapTitle: string    // 新規マップのタイトル初期値（name とは別フィールド）
  nodes: SerializedNode[]
  edges: SerializedEdge[]
}

export const MAP_TEMPLATES: readonly MapTemplate[]
export function getMapTemplate(id: string): MapTemplate | undefined
```

SWOT分析／KPTふりかえり／なぜなぜ分析（5 Whys）／オズボーンのチェックリスト／マンダラートの5種を静的データとして定義する。各テンプレートの座標は `applyRadialLayout` 等のレイアウト計算を通さず手組みで指定する（マンダラートの3×3グリッド、オズボーンの9方向配置など、放射状レイアウトの形と合わないため）。

**専用プロンプトを作らない設計**: 各ノードの `body` に「その欄に何を書くか」の記入ガイド文を持たせておく。既存のAI提案（`generateSuggestions` 等、§9.2）はノードの `body` をプロンプトの文脈にそのまま含めるため、テンプレート専用のプロンプト分岐を用意しなくてもフレームワークの観点に沿った提案が出る。

利用側は `startNewMapFromTemplate(templateId)`（`packages/ui/src/hooks/useFileDashboard.ts`、§5.1.3）。検証は `packages/core/src/templates/mapTemplates.test.ts`（12件）で、テンプレートID・ノードIDの一意性、エッジが実在ノードのみを参照すること、ノード矩形が重ならないこと、全ノードに `body` があることを検証する。

---

## 22. バージョン履歴とタイムラプス再生（Phase 50）

保存のたびにローカルへスナップショットを蓄積し、履歴パネル（`HistoryPanel`、§5.13）から閲覧・復元できる機能と、蓄積したスナップショットを古い順に再生する「タイムラプス再生」機能。Phase 49 で整備したスキーマバージョニング基盤（`MapFile.version`／`migrateMapFile`、§7.4）の上に構築する。

### 22.1 mapHistory.ts（packages/core/src/services/mapHistory.ts）

`errorLog.ts`（§19）と同じ「`StorageAdapter` 経由 + プロセス内メモリキャッシュ」パターンを踏襲するが、履歴はマップごとに肥大化するため、単一キーではなく `mapId` ごとにストレージキーを分離する（`ideamap-history-${mapId}`）。記録の失敗はアプリ動作に影響させない（このモジュールは決して throw しない）。

```typescript
export interface MapSnapshotEntry {
  time: string      // ISO 8601
  mapFile: MapFile
}

export function recordSnapshot(mapId: string, mapFile: MapFile): Promise<void>
export function getSnapshots(mapId: string): Promise<readonly MapSnapshotEntry[]>
export function clearSnapshots(mapId: string): Promise<void>
```

- **保持件数**: `mapId` ごとに最新 `MAX_ENTRIES = 20` 件（リングバッファ、超過分は古い順に `splice` で切り詰める）
- **サイズ上限**: 1件あたり `MAX_ENTRY_SIZE = 2 * 1024 * 1024`（文字数換算、JSON文字列はほぼ1文字=1バイトの data URL が支配的なため十分な近似）を超える場合、`nodes` の `image` フィールドだけを省いて保存する（Phase 49 の画像添付でスナップショットが肥大化しうるため）。プレビュー・復元では画像が欠けるトレードオフを許容する
- **無変更のスキップ**: `recordSnapshot` は直前のエントリと `nodes`/`edges` が JSON文字列比較で同一なら追記しない（無変更の保存が続いてもリングバッファを浪費しないため）
- **呼び出し元**: `packages/ui/src/hooks/useAutoSave.ts` の `performSave` 内、保存が成功して `setSaveStatus('saved')` を呼ぶ箇所（新規保存確定時・上書き保存成功時のどちらも同じ1箇所を通る）。`canPersist` が false のローカル控えのみの分岐では呼ばない（§12.4）
- **検証**: `packages/core/src/services/mapHistory.test.ts`。リングバッファの上限、サイズ上限超過時の `image` 省略、無変更時のスキップ、`mapId` ごとの分離を検証する

### 22.2 HistoryPanel

コンポーネント設計は §5.13 を参照。

### 22.3 タイムラプス再生（packages/ui/src/services/timelapsePlayer.ts）

再生開始（`HistoryPanel`）と停止（`IdeaCanvas` のオーバーレイ）がコンポーネントをまたぐため、React state ではなく `errorLog.ts` と同じ発想のモジュール内シングルトン（`timerId`／`restoreState`）でタイマーと再生前スナップショットを保持する。

```typescript
export function startTimelapse(snapshots: readonly MapSnapshotEntry[]): void
export function stopTimelapse(): void
```

- `startTimelapse`: 現在の `nodes`/`edges`/`mapTitle` を `restoreState` に退避 → `uiStore.setTimelapsePlaying(true)` → スナップショットを古い順に `INTERVAL_MS = 800`ms 間隔で `loadFromSerialized(snapshot.mapFile.nodes, snapshot.mapFile.edges)` に適用する。最後まで再生し終えると自動的に終了処理（`finish()`）を呼ぶ
- `stopTimelapse`（＝`finish()`）: タイマーを止め、`restoreState` から `loadFromSerialized`/`setMapTitle` で再生前の状態へ戻し、`setTimelapsePlaying(false)` にする。**この復元によって再生開始前の Undo 履歴（`past`/`future`）は失われる**（`loadFromSerialized` の既存仕様）。再生は読み取り専用の演出機能であり、実行前に `HistoryPanel` の確認ダイアログで「実行中のUndo履歴は再生後に失われます」旨を明示することで許容する

**IdeaCanvas 側のブロック（`isTimelapsePlaying`、Phase 50）**:
- `nodesDraggable`/`nodesConnectable`/`elementsSelectable` を `false` にする（`isPresentationMode` と同じ扱い）
- ノードクリック・ダブルクリック・各種右クリックメニューのハンドラを早期 return で無効化する
- `Toolbar`/`BottomNav`/`NodeActionBar` を非表示にする（発表モードと同じ非表示切り替え）
- `useKeyboardShortcuts` の抑制条件に追加（§13）
- 全面を覆う代わりに `pointer-events-none` の半透明バナー「⏱ タイムラプス再生中」＋独立した停止ボタン（`pointer-events-auto`）を `createPortal` で重ねる。既存の `PresentationMode`（`isPresentationMode` フラグで `App.tsx` が排他的に切り替える構成）とは異なり、タイムラプスはキャンバス自体の描画を使い回すためオーバーレイ方式にする
- **既知の未対応範囲**: `NodeDetailPanel` など、キャンバス外に残る他パネル経由の編集操作は `isTimelapsePlaying` でガードしていない（選択ノードIDがスナップショット間で解決できる限り開き続けられる）。実運用で問題が出たら各パネルの編集操作にも `isTimelapsePlaying` ガードを追加する（実装コード中の `ponytail:` コメントに同旨の記載あり）

### 22.4 Google Drive revisions 連携（未実装・優先度低）

Drive revisions API（`GET /files/{fileId}/revisions`・`GET /files/{fileId}/revisions/{revisionId}?alt=media`）を使った変更履歴連携は起票のみで実装していない。`driveService.ts`（§12.2）には `listMapRevisions`/`loadMapRevision` に相当する関数は存在しない。Drive revisions の保持期間・世代数の運用挙動と、Web版 GIS トークンのスコープ（現状 `drive.file` 相当）で到達できるかが実機未確認のため、優先度を下げて `docs/implementation-plan.md` に起票のみ残している。
