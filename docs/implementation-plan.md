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

## 7. スケジュール概要

| フェーズ | 内容 | 目安期間 |
|----------|------|----------|
| Phase 1 | 基盤構築（マインドマップUI） | 2日 |
| Phase 2 | AI（Claude）連携 | 2日 |
| Phase 3 | Googleドライブ連携 | 2日 |
| Phase 4 | UX改善・仕上げ | 2日 |
| **合計** | | **約8日** |

---

## 8. リスクと対策

| リスク | 対策 |
|--------|------|
| Claude APIのCORS制限 | Anthropic SDKはブラウザから直接呼び出し可能（CORS対応済み） |
| Google OAuthの設定ミス | セットアップ手順書を詳細に用意、エラーメッセージをわかりやすく表示 |
| スマホでのReact Flowパフォーマンス | ノード数が多い場合は仮想化、タッチイベントの最適化 |
| APIキーの漏洩リスク | localStorageに暗号化して保存、サーバーには一切送信しない旨を明示 |
| Googleドライブの競合 | 自動保存はデバウンス処理+楽観的更新で対応 |
