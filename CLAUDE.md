# CLAUDE.md — IdeaMap プロジェクト

## プロジェクト概要

AIと一緒に育てるアイデアマップアプリ。React Flow でノード・エッジを管理し、Claude API でアイデアを拡張する。バックエンドなしのフロントエンドのみ SPA。

ソースコードは `packages/`（core・ui・platform）と `apps/`（web・desktop）に分かれている（Phase 33 でモノレポ化、Phase 34 でデスクトップ版 Tauri シェルを追加）。

---

## サブエージェントへの作業委譲

**この節はユーザーからの常時の委譲依頼である。** Claude Code は既定では「ユーザーが明示的に頼まないかぎりサブエージェントを起動しない」が、このプロジェクトでは下記の条件に当てはまる作業を**あらかじめ委譲を依頼されたもの**として扱う。委譲してよいか確認を取る必要はなく、そのまま Agent tool を呼ぶこと。委譲した旨を長々と説明する必要もない。

### 委譲する — 次のいずれかに当てはまったら Agent tool を呼ぶ

| 作業 | モデル |
|---|---|
| 4ファイル以上を読む調査・影響範囲の洗い出し | `sonnet` |
| `docs/` 配下のドキュメント作成・更新 | `sonnet` |
| 新フェーズの計画立案（`implementation-plan.md` への起票） | `sonnet` |
| 1パッケージ内で完結する機能実装・リファクタリング | `sonnet` |
| テストの作成・実行と失敗の修正 | `sonnet` |
| Web検索を伴う技術調査 | `sonnet` |
| 差分レビュー・規約違反チェック | `sonnet` |
| 一括リネーム・定型置換・ログや出力の要約・リンク切れチェック | `haiku` |
| コミットメッセージの作成 | `haiku` |

**独立したタスクは1メッセージ内で並列に投げる。** 依存関係があるときだけ逐次にする。

### 委譲しない — 親エージェントが直接やる

- ユーザーとの認識合わせ・仕様の確認
- 複数の成果物にまたがる最終的な整合性の判断と、矛盾の裁定
- `main` へのコミット実行
- 2〜3ファイルで終わる小さな修正（委譲するほうが遅い）

### 委譲するときの書き方

- サブエージェントは**コンテキストを引き継がない。** プロンプトには「読むべきファイルの絶対パス」「前提となる決定事項」「出力先ファイル」「完了条件」を必ず書く。あわせて「推測で書かず、必ず実コードを読む／裏取りする」ことを毎回指示する。
- 設計ドキュメントを複数のサブエージェントに並列で書かせると**結論が食い違う。** 親エージェントが矛盾を検出して裁定し、裁定内容を各ドキュメントにも注記すること（`docs/desktop/README.md` §3 が実例）。
- サブエージェントの報告を鵜呑みにしない。生成物は親エージェントが必ず確認する。

### プロジェクト定義のサブエージェント

`.claude/agents/` に定義済み。上表の条件に当てはまる作業は、汎用エージェントではなくこちらを優先して使う。

| 名前 | 用途 |
|---|---|
| `doc-sync` | コード変更に合わせた `docs/` 3点＋`docs/desktop/` の更新 |
| `phase-planner` | `implementation-plan.md` への新フェーズ起票 |
| `monorepo-guard` | 依存方向・Adapter 経由・パッケージ責務の違反チェック |

---

## ドキュメント管理ルール

`docs/` 以下の3ファイルは常に最新の状態を保つこと。**コードを変更したら、対応するドキュメントを同じコミットまたは直後のコミットで必ず更新する。** ドキュメント更新は任意ではなく開発作業の一部として扱う。

| ファイル | 役割 | 更新ポイント |
|---|---|---|
| [docs/requirements.md](docs/requirements.md) | 機能要件・非機能要件（WHAT） | 新機能を実装したら対応する機能要件に追記。仕様変更があれば既存要件を修正 |
| [docs/design.md](docs/design.md) | アーキテクチャ・型定義・設計判断（HOW） | 型定義（`types/index.ts`）・ストア設計・コンポーネント設計の変更、新サービス追加時に必ず反映 |
| [docs/implementation-plan.md](docs/implementation-plan.md) | フェーズ・タスク・進捗管理（WHEN） | タスク完了時に `[x]` と完了日を記録。新フェーズは `## 1. 実装フェーズ` セクションの**末尾**に追加する（他セクションの後ろに置かない） |

デスクトップアプリ版（Tauri v2）とモノレポ化については、上記3ファイルに加えて `docs/desktop/` 配下に詳細設計がある。**デスクトップ版・モノレポ・LLM抽象化に関わる作業をするときは、必ず [docs/desktop/README.md](docs/desktop/README.md) を先に読むこと。** ドキュメント間で結論が食い違う箇所は同ファイル §3 の裁定が優先される。

| ファイル | 役割 |
|---|---|
| [docs/desktop/README.md](docs/desktop/README.md) | **入口。** 決定事項サマリ・矛盾の裁定・ロードマップ・未検証事項 |
| [docs/desktop/adr-001-framework-selection.md](docs/desktop/adr-001-framework-selection.md) | フレームワーク選定（Tauri v2）の根拠 |
| [docs/desktop/architecture.md](docs/desktop/architecture.md) | モノレポ構成と Platform Adapter 設計 |
| [docs/desktop/llm-abstraction.md](docs/desktop/llm-abstraction.md) | `LLMProvider` 抽象化と Ollama 連携 |
| [docs/desktop/platform-integration.md](docs/desktop/platform-integration.md) | Tauri 固有機能・配布・開発環境 |

---

## 開発環境

pnpm workspaces のモノレポ。コマンドはすべてリポジトリのルートで実行する。

```bash
pnpm install       # 依存インストール（初回・依存追加時）
pnpm dev           # Web版の開発サーバー起動（http://localhost:5173）
pnpm build         # 型検査（tsc -b）+ Web版のプロダクションビルド
pnpm preview       # ビルド結果を確認
pnpm lint          # 全パッケージの ESLint
pnpm typecheck     # 型検査のみ
pnpm check:openai  # OpenAIProvider の自己チェック（SSEパース・400フォールバック・エラー分類）
pnpm dev:desktop   # デスクトップ版を起動（Vite は 5174、Tauri がウィンドウを開く）
pnpm build:desktop # デスクトップ版のインストーラをビルド
```

必要な環境変数（`apps/web/.env` に設定）:
```
VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
```

デスクトップ版の Google Drive 連携を使う場合は `apps/desktop/.env` にも設定する（雛形は `apps/desktop/.env.example`）。**Web版とは別に「デスクトップアプリ」種別のクライアントIDを発行する必要がある**（手順は `docs/desktop/platform-integration.md` §3.8）。未設定でもアプリは動く。
```
VITE_GOOGLE_DESKTOP_CLIENT_ID=xxxx.apps.googleusercontent.com
```

デスクトップ版のビルドには Rust ツールチェーン（`stable-msvc`）・Visual Studio Build Tools 2022 の C++ ワークロード・WebView2 ランタイムが必要（手順は `docs/desktop/platform-integration.md` §7）。

---

## Git 運用

- **`main` に直接コミットしてよい**（個人開発のため。ブランチを切る必要はない）。
- コミットは1つの意味のある単位でまとめる。ファイル移動とロジック変更は別コミットに分ける。
- コード変更と対応するドキュメント更新は同じコミットに含める。

---

## コーディング規約

### 全般
- TypeScript の型を省略しない。`any` は使わない。
- コンポーネントファイルは `PascalCase`、hooks は `camelCase` で `use` プレフィックス。
- コメントは「なぜそうしたか」のみ書く。コードが説明する内容は書かない。

### 状態管理
- マップデータ（ノード・エッジ・Undo/Redo）は `mapStore` のみで管理する。
- UI状態（パネル開閉・ダイアログ・トースト）は `uiStore` のみで管理する。
- React Flow の削除キーイベント（`deleteKeyCode`）は `null` に設定し、削除操作は必ず `mapStore` 経由で行う（Undo対応のため）。

### Undo/Redo
- ユーザーの意図的な操作はすべて `mapStore` の `past` に積む。
- `onNodesChange` のドラッグ中（`dragging=true`）は履歴に積まない。
- React Flow 組み込みの変更イベント経由でノード・エッジを変更する場合は `onNodesChange`/`onEdgesChange` に任せ、直接 `set` しない。

### コンテキストメニュー
- メニューは `createPortal(content, document.body)` で `<body>` 直下にレンダリングする（z-index問題の回避）。
- メニュー表示中はキーボードショートカットを抑制する（`uiStore.contextMenu` チェック）。

### Google Drive
- 実体は `packages/core/src/services/driveService.ts`（Web版・デスクトップ版の共通）。通信は `getPlatform().http.request` 経由で、`fetch` を直接呼ばない。
- `folderIdCache` / `settingsFileIdCache` はプロセス内メモリキャッシュ。アクセストークンが変わった場合は `clearDriveCache()` を呼ぶ（両方まとめて消える）。
- ファイル保存は既存 fileId があれば `PATCH`、なければ `POST`（マルチパートアップロード）。ボディは `FormData` ではなく `multipart/related` を文字列で手組みする（Tauri の plugin-http で `FormData` の挙動が未検証なため）。
- アクセストークンは Adapter の引数に現れないため、各アプリが `setDriveAccessToken()` で `FileAdapter` に流し込む。

---

## モノレポ構成

### ディレクトリと責務

| パッケージ | 置くもの | 置いてはいけないもの |
|---|---|---|
| `packages/core` | 型定義、Zustandストア、レイアウト計算、`LLMProvider` 実装などの純粋ロジック | `.tsx` のUI、`localStorage`/`window`/`document`/`fetch` の直接呼び出し |
| `packages/ui` | Reactコンポーネント、UI hooks | 特定プラットフォームの外部サービス依存、`localStorage` 等の直接呼び出し |
| `packages/platform` | Adapter の**型定義**と `setPlatform`/`getPlatform` レジストリのみ | Adapter の実装、`@tauri-apps/*` や `window.google` への依存 |
| `apps/web` | Web版シェル、Adapter Web実装、GIS認証、共有URL | `packages/*` に置くべき汎用ロジックの重複実装 |
| `apps/desktop` | Tauri シェル、Adapter Desktop実装、`src-tauri`、ループバック+PKCE の Google 認証 | Web専用機能（GIS認証・共有URL）の持ち込み |

### 守るべきルール

- 依存方向は `apps/* → packages/ui → packages/core → packages/platform` の**一方向のみ**。逆方向の import は禁止（相対パス越えは `import/no-restricted-paths`、`@ideamap/*` 指定は `no-restricted-imports` で検出される）。
- `packages/core` と `packages/ui` から `localStorage`・`sessionStorage`・`fetch`・Google Drive API・GIS認証・`<a download>` を**直接呼ばない**。必ず `getPlatform()` 経由で Adapter を使う。
- `getPlatform()` はモジュールのトップレベルではなく、必ず関数の内部（ストアのアクション、イベントハンドラ、`useEffect`）で呼ぶ。`setPlatform()` より先に評価されるのを防ぐため。
- Adapter にメソッドを追加するときは、`packages/platform` の型追加・`apps/web` 実装・`apps/desktop` 実装の3点を**同一コミット内で揃える**。
- 新機能を実装する前に「このロジックは Web版・デスクトップ版で同じ動作か？」を自問する。Yes ならロジックは `packages/core`、UIは `packages/ui`。No なら Adapter にメソッドを追加して両アプリに実装する。
- Web版とデスクトップ版で同じロジックを別々に書かない。それが起きたら `packages/core` に上げる合図。
- 移行作業中は「ファイル移動（`git mv`）のみのコミット」と「ロジック変更のコミット」を必ず分離する。

### 永続化状態の復元

`settingsStore` の zustand `persist` と `uiStore` の `currentFileId` は StorageAdapter 経由（非同期）で読む。ストア生成時には読めないため、各アプリの `main.tsx` が `restorePersistedState()`（`packages/core/src/stores/bootstrap.ts`）を **await してから最初のレンダーを行う**。順序を崩すとテーマ既定値でのちらつきと、前回ファイルへの誤保存が起きる。

### デスクトップ版（`apps/desktop`）で気をつけること

- Tauri プラグインを追加したら、JS 側の依存（`apps/desktop/package.json`）・Rust 側の依存（`src-tauri/Cargo.toml`）・`lib.rs` への登録・`capabilities/*.json` への権限追加の**4点を揃える**。どれか1つでも欠けると実行時に権限エラーになる。
- `capabilities/*.json` は機能単位で分ける（`main-window` / `file-access` / `ai-http` / `google-drive` / `updater`）。`fs:scope` はアプリ専用ディレクトリ（`$APPCONFIG` / `$APPLOCALDATA`）のみで、ユーザーが選んだパスは dialog プラグインの実行時許可 ＋ `tauri-plugin-persisted-scope` に任せる。安易に `$HOME/**` を足さない。新しい通信先を許すときは、既存 capability の説明文に合わないなら新しいファイルを作る。
- `#[tauri::command]` で自作したコマンド（`keychain` / `launch` / `oauth`）は capability の管轄外で、`lib.rs` の `generate_handler!` に登録するだけで呼べる。権限追加が要るのはプラグインのコマンドだけ。
- CSP は `tauri.conf.json` の `csp`（本番）と `devCsp`（開発）の両方にある。片方だけ直すと本番ビルドで壊れる。ただし `HttpAdapter` 経由の通信は Rust 側の plugin-http が発行するため CSP を通らない（許可は capability 側で行う）。
- `tauri-plugin-http` は webview の URL を `Origin` ヘッダとして自動付与する。開発時（`devUrl`）は Ollama の既定 CORS 許可に収まるが、本番ビルドの webview オリジン（Windows は `http://tauri.localhost`）は含まれず 403 になる。`Cargo.toml` 側で `unsafe-headers` feature を有効にし、JS 側で `Origin: ''` を送って落とす（`apps/desktop/src/platform/http.desktop.ts`）。
- `src-tauri` は Vite の watch から除外してある（`vite.config.ts`）。cargo が書き込み中の DLL を監視すると EBUSY で dev サーバーごと落ちるため、外さないこと。

### Web専用として `apps/web` に残っているもの

`useGoogleAuth`（GIS認証）・`MapListPanel`／`FileOpenDashboard`（Drive一覧・起動画面）・`storageService`・`shareUrl`（共有URL）・`encryption`（APIキーの保存先）。
これらを `packages/ui` から使いたくなったら、直接 import せず `App` の props（`cloudAuth` / `mapListSlot` / `dashboardSlot` / `onGenerateShareUrl` / `settingsExtraSections`）で渡す。

Drive の REST 呼び出し（`driveService`）は Phase 38 で `packages/core` に移り、**Web専用ではなくなった**。Web版とデスクトップ版で認証方式だけが異なる（GIS のトークンモデル / ループバック+PKCE）。

---

## 作業パターン

### 新しいノードアクションを追加する
1. `packages/core/src/types/index.ts` に必要な型を追加
2. `packages/core/src/stores/map/*.ts` の該当スライスにアクションを追加（`past` への push を忘れずに）
3. `packages/ui/src/components/canvas/ContextMenu.tsx` にメニュー項目を追加
4. `packages/ui/src/hooks/useKeyboardShortcuts.ts` にショートカットを追加（任意）
5. **必ず** `docs/design.md` の「状態管理設計」「コンテキストメニュー設計」を更新
6. **必ず** `docs/requirements.md` に対応する機能要件を追記・修正

### 新しいパネル（サイドパネル）を追加する
1. `packages/core/src/stores/uiStore.ts` に `isXxxOpen` と `setXxxOpen` を追加
2. `packages/ui/src/components/panels/XxxPanel.tsx` を作成
3. `packages/ui/src/App.tsx` にコンポーネントを追加し、`packages/ui/src/index.ts` から export する
4. **必ず** `docs/design.md` の「コンポーネント設計」を更新
5. **必ず** `docs/requirements.md` に対応する機能要件を追記・修正

### フェーズを完了したとき
1. **必ず** `docs/implementation-plan.md` の該当フェーズのタスクのステータスを更新（下記フォーマットを参照）
2. **必ず** `docs/design.md` を確認し、型定義・ストア・コンポーネントの変更を反映
3. **必ず** `docs/requirements.md` を確認し、新機能・仕様変更を反映

---

## implementation-plan.md タスクステータス管理

タスクは「実装済み」と「動作確認済み」の2段階で管理する。

| タスク | 意味 | 更新タイミング |
|---|---|---|
| `[ ]` | 未着手 | — |
| `[x]` | 実装済み（コード完成・ビルド通過） | コードを書いたとき |
| `[x]✅` | 動作確認済み（手動テスト・品質確認完了） | 手動テストで動作を確認したとき |

| フェーズ見出し | 意味 | 更新タイミング |
|---|---|---|
| （なし） | 未着手または進行中 | — |
| `🔨 実装済み（確認中）` | コード完成済み・動作確認前 | フェーズ内に `[x]` が出たとき |
| `✅ 完了（YYYY-MM-DD）` | 全タスクが動作確認済み | フェーズ内の全タスクが `[x]✅` になったとき |
