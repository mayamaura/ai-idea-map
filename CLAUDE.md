# CLAUDE.md — IdeaMap プロジェクト

## プロジェクト概要

AIと一緒に育てるアイデアマップアプリ。React Flow でノード・エッジを管理し、Claude API でアイデアを拡張する。バックエンドなしのフロントエンドのみ SPA。

ソースコードは `ideamap/` ディレクトリ以下にある。

---

## ドキュメント管理ルール

`docs/` 以下の3ファイルは常に最新の状態を保つこと。コードを変更したら必ず対応するドキュメントも更新する。

| ファイル | 役割 | 更新タイミング |
|---|---|---|
| [docs/requirements.md](docs/requirements.md) | 機能要件・非機能要件（WHAT） | 新機能追加・要件変更時 |
| [docs/design.md](docs/design.md) | アーキテクチャ・型定義・設計判断（HOW） | 設計変更・型変更・新コンポーネント追加時 |
| [docs/implementation-plan.md](docs/implementation-plan.md) | フェーズ・タスク・進捗管理（WHEN） | フェーズ完了・新フェーズ追加時 |

デスクトップアプリ版（Tauri v2）とモノレポ化については、上記3ファイルに加えて `docs/desktop/` 配下に詳細設計がある。**デスクトップ版・モノレポ・LLM抽象化に関わる作業をするときは、必ず [docs/desktop/README.md](docs/desktop/README.md) を先に読むこと。** ドキュメント間で結論が食い違う箇所は同ファイル §3 の裁定が優先される。

| ファイル | 役割 |
|---|---|
| [docs/desktop/README.md](docs/desktop/README.md) | **入口。** 決定事項サマリ・矛盾の裁定・ロードマップ・未検証事項 |
| [docs/desktop/adr-001-framework-selection.md](docs/desktop/adr-001-framework-selection.md) | フレームワーク選定（Tauri v2）の根拠 |
| [docs/desktop/architecture.md](docs/desktop/architecture.md) | モノレポ構成と Platform Adapter 設計 |
| [docs/desktop/llm-abstraction.md](docs/desktop/llm-abstraction.md) | `LLMProvider` 抽象化と Ollama 連携 |
| [docs/desktop/platform-integration.md](docs/desktop/platform-integration.md) | Tauri 固有機能・配布・開発環境 |

### 各ドキュメントの更新ポイント

- **requirements.md**: 新機能を実装したら対応する機能要件に追記。仕様変更があれば既存要件を修正。
- **design.md**: 型定義（`types/index.ts`）の変更、ストア設計の変更、コンポーネント設計の変更、新サービス追加時は必ず反映する。
- **implementation-plan.md**: フェーズのタスクが完了したら `[x]` をつけ、完了日を記録。新しい実装フェーズは `## 1. 実装フェーズ` セクションの末尾に追加する（他のセクションの後ろに置かない）。

---

## 開発環境

```bash
cd ideamap
npm run dev      # 開発サーバー起動（http://localhost:5173）
npm run build    # プロダクションビルド
npm run preview  # ビルド結果を確認
```

必要な環境変数（`.env` ファイルに設定）:
```
VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
```

---

## サブエージェントへの作業委譲

**タスクに落とせる作業は極力サブエージェントに委譲する。** コストと速度の最適化のため、タスクの重さに応じてモデルを使い分ける。

| モデル | 任せる作業 |
|---|---|
| **Sonnet 5**（`model: sonnet`） | 計画立案、設計ドキュメント作成、機能実装、リファクタリング、テスト作成・実行、調査（Web検索を伴う技術調査含む）、コードレビュー |
| **Haiku**（`model: haiku`） | 単純なコミットメッセージ作成とコミット、ファイル名の一括変更、定型的な置換、ログ・出力の要約、リンク切れチェックなどの機械的な確認 |

### 委譲のルール

- **独立したタスクは1メッセージ内で並列に投げる。** 依存関係がある場合のみ逐次実行する。
- サブエージェントは**コンテキストを引き継がない**。プロンプトには「読むべきファイルの絶対パス」「前提となる決定事項」「出力先ファイル」「完了条件」を明記する。「推測で書かず、必ず実コードを読む／裏取りする」ことを毎回指示する。
- 設計ドキュメントを複数のサブエージェントに並列で書かせた場合、**結論が食い違う。** 統合役（親エージェント）が矛盾を検出して裁定し、裁定内容を各ドキュメントにも注記すること（`docs/desktop/README.md` §3 が実例）。
- サブエージェントの報告を鵜呑みにしない。生成物は親エージェントが必ず確認する。
- 以下は委譲せず親エージェントが直接行う: ユーザーとの認識合わせ、複数の成果物にまたがる最終的な整合性の判断、`main` へのコミット。

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
- `googleDriveService.ts` の `folderIdCache` はプロセス内メモリキャッシュ。アクセストークンが変わった場合は `clearDriveCache()` を呼ぶ。
- ファイル保存は既存 fileId があれば `PATCH`、なければ `POST`（マルチパートアップロード）。

---

## モノレポ構成（Phase 33 移行後に適用）

**現在はまだ移行前**であり、ソースは `ideamap/` 配下の単一 Vite プロジェクトにある。以下は Phase 33（モノレポ移行）完了後に適用されるルール。移行を実施したら本節の「移行後に適用」の但し書きを削除すること。

### ディレクトリと責務

| パッケージ | 置くもの | 置いてはいけないもの |
|---|---|---|
| `packages/core` | 型定義、Zustandストア、レイアウト計算、`LLMProvider` 実装などの純粋ロジック | `.tsx` のUI、`localStorage`/`window`/`document`/`fetch` の直接呼び出し |
| `packages/ui` | Reactコンポーネント、UI hooks | 特定プラットフォームの外部サービス依存、`localStorage` 等の直接呼び出し |
| `packages/platform` | Adapter の**型定義**と `setPlatform`/`getPlatform` レジストリのみ | Adapter の実装、`@tauri-apps/*` や `window.google` への依存 |
| `apps/web` | Web版シェル、Adapter Web実装、Google Drive同期、GIS認証、共有URL | `packages/*` に置くべき汎用ロジックの重複実装 |
| `apps/desktop` | Tauri シェル、Adapter Desktop実装、`src-tauri` | Web専用機能（Drive同期・GIS認証・共有URL）の持ち込み |

### 守るべきルール

- 依存方向は `apps/* → packages/ui → packages/core → packages/platform` の**一方向のみ**。逆方向の import は禁止（`eslint-plugin-import` の `import/no-restricted-paths` で検出される）。
- `packages/core` と `packages/ui` から `localStorage`・`sessionStorage`・`fetch`・Google Drive API・GIS認証・`<a download>` を**直接呼ばない**。必ず `getPlatform()` 経由で Adapter を使う。
- `getPlatform()` はモジュールのトップレベルではなく、必ず関数の内部（ストアのアクション、イベントハンドラ、`useEffect`）で呼ぶ。`setPlatform()` より先に評価されるのを防ぐため。
- Adapter にメソッドを追加するときは、`packages/platform` の型追加・`apps/web` 実装・`apps/desktop` 実装の3点を**同一コミット内で揃える**。
- 新機能を実装する前に「このロジックは Web版・デスクトップ版で同じ動作か？」を自問する。Yes ならロジックは `packages/core`、UIは `packages/ui`。No なら Adapter にメソッドを追加して両アプリに実装する。
- Web版とデスクトップ版で同じロジックを別々に書かない。それが起きたら `packages/core` に上げる合図。
- 移行作業中は「ファイル移動（`git mv`）のみのコミット」と「ロジック変更のコミット」を必ず分離する。

### 上記「作業パターン」のパス読み替え

移行後は本ファイルの「新しいノードアクションを追加する」「新しいパネルを追加する」手順のパスを次のように読み替える。

| 移行前 | 移行後 |
|---|---|
| `src/types/index.ts` | `packages/core/src/types/index.ts` |
| `src/stores/*.ts` | `packages/core/src/stores/*.ts` |
| `src/components/**` | `packages/ui/src/components/**` |
| `src/hooks/*.ts` | `packages/ui/src/hooks/*.ts` |
| `src/services/claudeService.ts` | `packages/core/src/llm/aiService.ts` |

---

## 作業パターンと必須ドキュメント更新

**コードを変更したら、必ず対応するドキュメントを同じコミットまたは直後のコミットで更新すること。**
ドキュメント更新は任意ではなく開発作業の一部として扱う。

### 新しいノードアクションを追加する
1. `src/types/index.ts` に必要な型を追加
2. `src/stores/mapStore.ts` にアクションを追加（`past` への push を忘れずに）
3. `src/components/canvas/ContextMenu.tsx` にメニュー項目を追加
4. `src/hooks/useKeyboardShortcuts.ts` にショートカットを追加（任意）
5. **必ず** `docs/design.md` の「状態管理設計」「コンテキストメニュー設計」を更新
6. **必ず** `docs/requirements.md` に対応する機能要件を追記・修正

### 新しいパネル（サイドパネル）を追加する
1. `src/stores/uiStore.ts` に `isXxxOpen` と `setXxxOpen` を追加
2. `src/components/panels/XxxPanel.tsx` を作成
3. `src/App.tsx` にコンポーネントを追加
4. **必ず** `docs/design.md` の「コンポーネント設計」を更新
5. **必ず** `docs/requirements.md` に対応する機能要件を追記・修正

### フェーズを完了したとき
1. **必ず** `docs/implementation-plan.md` の該当フェーズのタスクのステータスを更新（下記フォーマットを参照）
2. **必ず** `docs/design.md` を確認し、型定義・ストア・コンポーネントの変更を反映
3. **必ず** `docs/requirements.md` を確認し、新機能・仕様変更を反映

---

## implementation-plan.md タスクステータス管理

タスクの進捗は「実装済み」と「動作確認済み」の2段階で管理する。

| マーカー | 意味 |
|---|---|
| `[ ]` | 未着手 |
| `[x]` | 実装済み（コード完成・ビルド通過） |
| `[x]✅` | 動作確認済み（手動テスト・品質確認完了） |

フェーズ見出しのステータス：

| 表記 | 意味 |
|---|---|
| （なし） | 未着手または進行中 |
| `🔨 実装済み（確認中）` | コード完成済み・動作確認前 |
| `✅ 完了（YYYY-MM-DD）` | 全タスクが動作確認済み |

### ステータス更新のタイミング

- **コードを書いたとき** → 該当タスクを `[x]` に更新（フェーズ見出しは `🔨 実装済み（確認中）`）
- **動作を手動テストで確認したとき** → 該当タスクを `[x]✅` に更新
- **フェーズ内の全タスクが `[x]✅` になったとき** → フェーズ見出しを `✅ 完了（YYYY-MM-DD）` に更新
