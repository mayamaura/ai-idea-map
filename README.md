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

```bash
cd ideamap
npm install
npm run dev
```

## 使い方

1. ヘッダーの設定アイコンから **Claude APIキー** を入力
2. キャンバスをダブルクリックしてノードを追加
3. ノードを選択し「AIに拡張を依頼」でアイデアを展開
4. Googleアカウントでサインインするとドライブに自動保存（OAuth設定は不要）

## ドキュメント

- [要件定義書](docs/requirements.md)
- [実装計画書](docs/implementation-plan.md)
