# リファクタリング・保守性レビュー

作成日: 2026-06-28

---

## 総評

フェーズを重ねながら段階的に機能拡張してきた結果、コア3ファイル（`mapStore.ts` 1138行・`claudeService.ts` 487行・`AISuggestionPanel.tsx` 513行）は現時点ではまだ読めるサイズ感に収まっている。ただし `mapStore.ts` はグループ操作ユーティリティ関数が上部に集積しており、ストア本体の中にジオメトリロジックが混在している点が主な肥大化原因。`claudeService.ts` では `new Anthropic(...)` の初期化が5か所に分散し、プロンプト組み立て部分が各関数に埋め込まれているため、モデル切り替えやAPIキー変更の影響範囲が広い。全体的に `any` 型の使用は1箇所のみで型規律は守られており、`deleteKeyCode=null`・`createPortal` 規約も遵守されているため、**緊急度の高い問題は少なく、優先して対処すべき箇所は限定的**である。

---

## 重要度別サマリ表

| No | 重要度 | 対象ファイル | 問題の概要 | 要否 |
|---|---|---|---|---|
| 1 | 高 | `claudeService.ts` | `new Anthropic(...)` の重複5か所 | 要 |
| 2 | 高 | `mapStore.ts` | グループ操作ジオメトリ関数をストアから分離 | 要 |
| 3 | 高 | `uiStore.ts:243` | `setSearchOpen` のバグ（無意味な三項演算子） | 要 |
| 4 | 中 | `mapStore.ts` | `loadFromSerialized` の後方互換処理（`text→title`・ハンドルフォールバック）が散在 | 任意 |
| 5 | 中 | `claudeService.ts` | プロンプト文字列の直書き（テスト困難・変更時の影響把握が難しい） | 任意 |
| 6 | 中 | `ContextMenu.tsx` | `window.prompt` の使用（2か所） | 任意 |
| 7 | 中 | `mapStore.ts` | `computePushOut` のロジックが `mapLayout.ts::applyGroupPushOut` と重複 | 任意 |
| 8 | 中 | `AIChatPanel.tsx` | `useUIStore.setState` を直接コンポーネント内から呼ぶ箇所 | 任意 |
| 9 | 低 | `mapStore.ts` | `loadFromSerialized` 内の `as unknown as { text?: string }` | 任意 |
| 10 | 低 | `uiStore.ts` | フェーズコメント（Phase 8/9/10…）が型定義に混在しインターフェースが散漫 | 任意 |
| 11 | 低 | `mapStore.ts` | `deleteNodes` / `deleteSelected` のグループ子ノード削除ロジック重複 | 任意 |
| 12 | 低 | `AISuggestionPanel.tsx`・`AIChatPanel.tsx`・`MapAnalysisPanel.tsx` | APIキー未設定の空状態JSXが3コンポーネントで完全コピー | 低 |

---

## 指摘詳細

---

### No.1 — `claudeService.ts`: `new Anthropic(...)` の重複5か所

- **重要度**: 高
- **対象ファイル**: `ideamap/src/services/claudeService.ts`（行 92, 191, 253, 316, 373）
- **現状**: `generateSuggestions`・`analyzeMap`・`suggestConnections`・`suggestClusters`・`chatWithMap` の各関数冒頭で `new Anthropic({ apiKey: req.apiKey, dangerouslyAllowBrowser: true })` をそれぞれ生成している。
- **問題**: APIキーやオプション（例: `dangerouslyAllowBrowser`）を変えたい場合に5か所を修正しなければならない。将来のプロキシURLや追加オプション追加時の変更漏れリスクが高い。
- **推奨対応**:
  ```ts
  function createClient(apiKey: string): Anthropic {
    return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  }
  ```
  各関数冒頭を `const client = createClient(req.apiKey)` に置き換える（6行の変更）。
- **要否判断**: **要** — 変更箇所が1か所に集約されるため保守性が上がる。変更量は少なく副作用なし。
- **推定工数**: 小

---

### No.2 — `mapStore.ts`: グループ操作ジオメトリ関数がストアに混在

- **重要度**: 高
- **対象ファイル**: `ideamap/src/stores/mapStore.ts`（行 24–107）
- **現状**: `computePushOut`・`findOverlappingGroup`・`isOutsideParent`・`syncGroupMeasured` の4関数（約84行）がストアファイルの先頭に置かれている。これらは純粋な座標計算で React/Zustand に依存しない。
- **問題**: ストア（状態管理）と座標計算（ドメインロジック）が同一ファイルに混在し、独立したユニットテストができない。`mapLayout.ts` の `applyGroupPushOut`（行 209–243）と `computePushOut`（行 24–57）はほぼ同一のアルゴリズムを重複実装している（後述 No.7）。
- **推奨対応**: `computePushOut`・`findOverlappingGroup`・`isOutsideParent`・`syncGroupMeasured` を `src/utils/mapLayout.ts` か新規 `src/utils/groupGeometry.ts` に移動し、`mapStore.ts` からは import して使う。
- **要否判断**: **要** — 責務分離の観点から明確な改善。`mapLayout.ts` の重複関数（No.7）と同時に解決できる。
- **推定工数**: 小〜中（移動自体は機械的だが、`applyGroupPushOut` との重複整理まで含めると中）

---

### No.3 — `uiStore.ts`: `setSearchOpen` に無意味な三項演算子（バグ）

- **重要度**: 高
- **対象ファイル**: `ideamap/src/stores/uiStore.ts`（行 243）
- **現状**:
  ```ts
  setSearchOpen: (open) => set({ isSearchOpen: open, searchQuery: open ? '' : '' }),
  ```
  `open ? '' : ''` は常に `''` を返す。検索バーを閉じた時に `searchQuery` をクリアする意図があるが、開いた時も閉じた時も同じ結果になっている。
- **問題**: おそらく `open ? '' : searchQuery` か `open ? searchQuery : ''` のどちらかが意図だった可能性が高い。現在は「閉じた時に検索クエリを維持してしまう」か「開いた時に既存クエリを消す」かの判断ができない。
- **推奨対応**: 要件に応じて以下のいずれかに修正:
  - 閉じた時にクエリをリセットする: `searchQuery: open ? '' : ''` → `searchQuery: ''`（常にリセットでよければ）
  - または単純に: `set({ isSearchOpen: open })`（`setSearchQuery` を別途呼ぶ設計の場合）
- **要否判断**: **要** — バグの可能性があるため確認・修正が必要。
- **推定工数**: 小

---

### No.4 — `mapStore.ts`: 後方互換処理（`text→title`・ハンドルフォールバック）の散在

- **重要度**: 中
- **対象ファイル**:
  - `ideamap/src/stores/mapStore.ts`（行 1040, 1053–1054）
  - `ideamap/src/services/exportService.ts`（行 255–256）
- **現状**:
  - `loadFromSerialized` 内で旧フォーマット対応: `n.title ?? (n as unknown as { text?: string }).text ?? ''`
  - 同関数内でハンドルフォールバック: `e.sourceHandle ?? 'right'`・`e.targetHandle ?? 'left'`
  - `exportService.ts` では `sourceHandle: 'right'`・`targetHandle: 'left'` をハードコード
- **問題**: これらは旧フォーマットのJSONに対応するためのコードだが、コメントが `// 旧フォーマット（text フィールド）との互換処理` のみで、いつ削除できるかの判断基準がない。マイグレーション済みデータしか存在しない状況なら削除可能だが、確認できない。
- **推奨対応**: ドキュメントに「v2.0 以降削除予定」などのバージョン注釈を追記し、将来の削除条件を明文化する。ハンドルフォールバック（`?? 'right'`）は FloatingEdge が ConnectionMode.Loose でハンドルを無視しているため実際には機能しておらず、`?? undefined` に変更可能。
- **要否判断**: **任意** — 動いているコードなので今すぐの対応は不要。ただし技術的負債として記録に残すこと推奨。
- **推定工数**: 小

---

### No.5 — `claudeService.ts`: プロンプト文字列の直書き

- **重要度**: 中
- **対象ファイル**: `ideamap/src/services/claudeService.ts`（各関数内の `prompt` 変数）
- **現状**: `generateSuggestions`・`analyzeMap`・`suggestConnections`・`suggestClusters`・`chatWithMap` の各関数内でプロンプトをテンプレートリテラルとして直接定義している（合計200行超）。
- **問題**: プロンプト品質の改善サイクルが開発者依存になり、プロンプトエンジニアがコード変更を要する。また、プロンプト単体のテストが書けない。長い文字列がビジネスロジックに埋め込まれているためコードの見通しが悪い。
- **推奨対応**: プロンプト組み立て関数を `src/prompts/` ディレクトリに分離し、各 `build*Prompt(req)` 関数として export する。`claudeService.ts` から呼び出す形にする。
- **要否判断**: **任意** — 現規模では大きな問題ではない。プロンプトが頻繁に変わる・チームが分担する場合は効果が高い。
- **推定工数**: 中

---

### No.6 — `ContextMenu.tsx`: `window.prompt` の使用（2か所）

- **重要度**: 中
- **対象ファイル**: `ideamap/src/components/canvas/ContextMenu.tsx`（行 171, 378）
- **現状**:
  - 行 171: エッジのラベル編集で `window.prompt('線のラベルを入力してください', current)`
  - 行 378: グループ名変更で `window.prompt('グループ名を入力してください', current)`
- **問題**: `window.prompt` はブラウザネイティブのモーダルであり、デザインの統一ができない。スマホでは挙動が不安定なブラウザも存在する。CLAUDE.md のコンテキストメニュー設計（`createPortal` でのレンダリング）とも整合性が取れていない。他の編集UIはすべてカスタムモーダルか `NodeDetailPanel` を利用しており、この2箇所だけが例外になっている。
- **推奨対応**: 既存の `ConfirmDialog` コンポーネントのインライン入力版を作るか、インライン編集（`input` を直接コンテキストメニュー内に表示）を実装する。あるいは小規模の `InputDialog` コンポーネントを `ConfirmDialog` と同じ構造で作成する。
- **要否判断**: **任意** — 機能的には動作しており緊急性はないが、スマホ体験・UIの統一という観点で対応を検討する価値あり。
- **推定工数**: 中

---

### No.7 — `mapStore.ts` と `mapLayout.ts` のグループ押し出しロジック重複

- **重要度**: 中
- **対象ファイル**:
  - `ideamap/src/stores/mapStore.ts`（行 24–57: `computePushOut`）
  - `ideamap/src/utils/mapLayout.ts`（行 209–243: `applyGroupPushOut`）
- **現状**: 両関数はほぼ同一のアルゴリズム（フリーノードとグループの重なり判定 → 最短方向に押し出す）を別々に実装している。`computePushOut` は1ノードに対して単発に呼ぶ形式、`applyGroupPushOut` は全ノードをまとめて処理する形式という違いはある。
- **問題**: アルゴリズムに修正が入ったとき（例: パディング追加、グループ枠サイズ取得ロジックの変更）に両方の修正が必要になる。実際に `typeof group.style?.width === 'number' ? group.style.width : 400` というイディオムも両箇所に重複している。
- **推奨対応**: `mapLayout.ts` に `computeNodePushOut(pos, measured, groupNodes)` として統合し、`mapStore.ts` はそれを import して使う（No.2と同時対応が効率的）。
- **要否判断**: **任意** — DRY原則の観点から改善価値あり。ただし両実装が現在乖離していないため緊急度は低い。
- **推定工数**: 小

---

### No.8 — `AIChatPanel.tsx`: `useUIStore.setState` をコンポーネントから直接呼ぶ

- **重要度**: 中
- **対象ファイル**: `ideamap/src/components/panels/AIChatPanel.tsx`（行 185–195）
- **現状**:
  ```ts
  useUIStore.setState((state) => {
    const msgs = state.chatMessages
    // ... chatMessages の末尾 assistant メッセージを更新
  })
  ```
  ストリーミング完了後に `useUIStore.setState` を直接呼んでいる。`uiStore` には同様の処理をする `updateLastChatMessage` アクションが既に存在するが、それは `content` のみを更新し `actions` を含められないため、コンポーネントが内部実装に直接アクセスしている。
- **問題**: CLAUDE.md の設計方針（UIストアの操作はストアのアクション経由）から逸脱している。テストしにくく、`chatMessages` の型構造が変わった際にコンポーネント側の修正が必要になる。
- **推奨対応**: `uiStore.ts` に `updateLastChatMessageWithActions(content: string, actions: ChatAction[])` アクションを追加し、コンポーネント側はそれを呼ぶ。
- **要否判断**: **任意** — 機能上の問題はないが、設計規約への遵守という観点から対応が望ましい。
- **推定工数**: 小

---

### No.9 — `mapStore.ts`: `as unknown as` の使用

- **重要度**: 低
- **対象ファイル**: `ideamap/src/stores/mapStore.ts`（行 1040）
- **現状**:
  ```ts
  title: n.title ?? (n as unknown as { text?: string }).text ?? '',
  ```
- **問題**: CLAUDE.md で `any` 禁止が明記されている。`as unknown as` は `any` の代替として同様のリスクを持つ型キャスト。旧フォーマット互換のための使用であり削除できないなら、少なくとも型を明示すべき。
- **推奨対応**: `SerializedNode` 型に `text?: string` フィールドを `@deprecated` コメント付きで追加し、明示的にアクセスする。または `'text' in n ? (n.text as string | undefined) : undefined` でナローイングする。
- **要否判断**: **任意** — 機能上の問題なし。型安全性の向上という観点での対応。
- **推定工数**: 小

---

### No.10 — `uiStore.ts`: フェーズコメントがインターフェース型定義に混在

- **重要度**: 低
- **対象ファイル**: `ideamap/src/stores/uiStore.ts`（行 67, 73, 79, 83, 87–95 など）
- **現状**: `UIState` インターフェース内に `// Phase 8: 検索 & フィルター`・`// Phase 10: AI高度化` 等のコメントが散在している。
- **問題**: インターフェース内のコメントは型の意味（「なぜ」）ではなく実装履歴（「いつ」）を語っており、CLAUDE.md の「コメントは『なぜそうしたか』のみ書く」方針と乖離している。今後フェーズが増えるとコメントが蓄積して可読性が下がる。
- **推奨対応**: フェーズコメントを削除し、プロパティに `JSDoc` で意味を説明するか、または型をグループ（AI関連・プレゼン関連等）に整理して別 `interface` に分ける。
- **要否判断**: **任意** — 動作に影響なし。コードの美観・規約整合の問題。
- **推定工数**: 小

---

### No.11 — `mapStore.ts`: `deleteNodes` と `deleteSelected` のグループ子削除ロジック重複

- **重要度**: 低
- **対象ファイル**: `ideamap/src/stores/mapStore.ts`（行 712–715, 733–736）
- **現状**:
  ```ts
  // deleteNodes 内 (行 712-715)
  state.nodes.filter((n) => idSet.has(n.id) && n.type === 'groupNode').forEach((g) => {
    state.nodes.filter((n) => n.parentId === g.id).forEach((n) => idSet.add(n.id))
  })

  // deleteSelected 内 (行 733-736)
  selNodes.filter((n) => n.type === 'groupNode').forEach((g) => {
    state.nodes.filter((n) => n.parentId === g.id).forEach((n) => deleteIds.add(n.id))
  })
  ```
  2か所で同じパターンのロジックを繰り返している。
- **問題**: グループ子ノードの収集ロジックを変更したい場合に2か所を修正する必要がある。
- **推奨対応**:
  ```ts
  function expandGroupIds(ids: Set<string>, allNodes: IdeaNode[]): Set<string> {
    allNodes.filter((n) => ids.has(n.id) && n.type === 'groupNode').forEach((g) => {
      allNodes.filter((n) => n.parentId === g.id).forEach((n) => ids.add(n.id))
    })
    return ids
  }
  ```
  として `mapStore.ts` の先頭付近に置き、両方から呼ぶ。
- **要否判断**: **任意** — 小規模な重複だが修正は容易。
- **推定工数**: 小

---

### No.12 — APIキー未設定の空状態UIが3コンポーネントで重複

- **重要度**: 低
- **対象ファイル**:
  - `ideamap/src/components/panels/AISuggestionPanel.tsx`（行 277–295）
  - `ideamap/src/components/panels/AIChatPanel.tsx`（行 285–305）
  - `ideamap/src/components/panels/MapAnalysisPanel.tsx`（行 181–199）
- **現状**: 鍵アイコン・「Claude APIキーが必要です」見出し・説明文・「設定を開く」ボタン の構造が3コンポーネントで完全にコピーされている。
- **問題**: 文言修正・スタイル変更の際に3か所を更新する必要がある。
- **推奨対応**:
  ```tsx
  // src/components/common/ApiKeyRequired.tsx
  export function ApiKeyRequired({ onOpenSettings }: { onOpenSettings: () => void }) { ... }
  ```
  を作成し、3コンポーネントから呼ぶ。
- **要否判断**: **任意** — 動作に問題なし。DRY原則の観点での改善。
- **推定工数**: 小

---

## 規約遵守状況（CLAUDE.md との照合）

| 規約項目 | 状況 |
|---|---|
| `any` 不使用 | ほぼ遵守。`as unknown as` が1か所（No.9） |
| `deleteKeyCode=null` | `IdeaCanvas.tsx` で遵守 |
| コンテキストメニューは `createPortal` | `ContextMenu.tsx` で遵守。他のモーダルも全て `createPortal` 使用 |
| 削除操作は `mapStore` 経由 | 遵守 |
| ドラッグ中は履歴に積まない | `onNodesChange` で `dragging=true` を除外して遵守 |
| UIストアへの操作はアクション経由 | `AIChatPanel.tsx` の1箇所で `useUIStore.setState` 直接呼び出し（No.8） |
| マップデータは `mapStore` のみ | `mapStore.ts` から `useUIStore.getState()` を呼ぶ箇所（トースト・確認ダイアログ）がある。ストアのアクション内からUIストアを呼ぶのは副作用として許容範囲だが、依存方向として留意 |
| コメントは「なぜ」のみ | `uiStore.ts` にフェーズコメントあり（No.10）。その他はおおむね遵守 |
| hooks 命名（`use` プレフィックス） | 遵守 |
| コンポーネントは `PascalCase` | 遵守 |
