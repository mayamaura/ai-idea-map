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

## よくある作業パターン

### 新しいノードアクションを追加する
1. `src/types/index.ts` に必要な型を追加
2. `src/stores/mapStore.ts` にアクションを追加（`past` への push を忘れずに）
3. `src/components/canvas/ContextMenu.tsx` にメニュー項目を追加
4. `src/hooks/useKeyboardShortcuts.ts` にショートカットを追加（任意）
5. `docs/design.md` の「状態管理設計」「コンテキストメニュー設計」を更新

### 新しいパネル（サイドパネル）を追加する
1. `src/stores/uiStore.ts` に `isXxxOpen` と `setXxxOpen` を追加
2. `src/components/panels/XxxPanel.tsx` を作成
3. `src/App.tsx` にコンポーネントを追加
4. `docs/design.md` の「コンポーネント設計」を更新

### フェーズを完了したとき
1. `implementation-plan.md` の該当フェーズのタスクを `[x]` にし、完了日を記録
2. 新しい設計・型が増えていれば `design.md` を更新
3. 新機能が要件定義に反映されていなければ `requirements.md` を更新
