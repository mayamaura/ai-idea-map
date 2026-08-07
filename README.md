# IdeaMap

AIと一緒に育てるアイデアマップ。ノードをつなぎながら思考を可視化し、Claude AIが新しいアイデアを提案してくれるウェブアプリです。

## 機能

- **マインドマップ** — ノードの追加・編集・削除・移動、ドラッグでエッジ接続
- **AI拡張** — ノードを選択してClaudeにアイデア提案を依頼、採用したものをそのまま追加
- **Googleドライブ連携** — マップをJSONとして保存・読み込み、変更時に自動保存
- **Undo/Redo** — Ctrl+Z / Ctrl+Y でいつでも操作を戻せる
- **自動整列** — dareレイアウトでノードをきれいに並べ直す
- **ダーク/ライトテーマ** — ヘッダーのボタンで切替、設定に永続化
- **レスポンシブ** — PC・スマホ両対応（タッチ操作、ボトムナビ）

## 技術スタック

| 分類 | 技術 |
|------|------|
| フレームワーク | React 18 + TypeScript |
| ビルド | Vite |
| マインドマップ | React Flow |
| スタイリング | Tailwind CSS |
| 状態管理 | Zustand |
| AI | Anthropic SDK (Claude) |
| ストレージ | Google Drive API + localStorage |

## ローカル開発

pnpm workspaces のモノレポです。コマンドはリポジトリのルートで実行します。

```bash
pnpm install
pnpm dev        # Web版 http://localhost:5173
pnpm build      # 型検査 + Web版のプロダクションビルド
```

| ディレクトリ | 中身 |
|---|---|
| `packages/platform` | Platform Adapter の型定義と registry |
| `packages/core` | 型・Zustand ストア・レイアウト計算・LLM 抽象化 |
| `packages/ui` | React コンポーネントと UI hooks |
| `apps/web` | Web版シェル（Google Drive 連携・GIS 認証・共有URL） |
| `apps/desktop` | デスクトップ版シェル（Tauri v2・ローカルファイル保存・OSキーチェーン） |

### デスクトップ版（Tauri v2・開発中）

ローカルLLM（Ollama）連携を目的としたデスクトップ版を `apps/desktop` で開発中です。マップはローカルの `.ideamap` ファイル（実体は Web版と同じ JSON）として保存し、APIキーは OSキーチェーンに置きます。Google Drive 同期と共有URLは Web版だけの機能です。

```bash
pnpm dev:desktop    # Tauri のウィンドウを起動（Vite は 5174）
pnpm build:desktop  # インストーラをビルド
```

ビルドには Rust ツールチェーン（`stable-msvc`）・Visual Studio Build Tools 2022 の C++ ワークロード・WebView2 ランタイムが必要です（[手順](docs/desktop/platform-integration.md#7-開発環境セットアップ手順windows)）。

## 使い方

1. ヘッダーの設定アイコンから **Claude APIキー** を入力
2. キャンバスをダブルクリックしてノードを追加
3. ノードを選択し「AIに拡張を依頼」でアイデアを展開
4. Googleアカウントでサインインするとドライブに自動保存（OAuth設定は不要）

## ドキュメント

- [要件定義書](docs/requirements.md)
- [設計書](docs/design.md)
- [実装計画書](docs/implementation-plan.md)
- [デスクトップ版・モノレポ設計](docs/desktop/README.md)
