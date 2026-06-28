# 技術レビュー検証レポート

作成日: 2026-06-28  
検証対象: `docs/review/refactoring.md` / `docs/review/performance.md`

---

## 検証サマリ

### 主な訂正点

| カテゴリ | 訂正内容 |
|---|---|
| ファイル行数 | `claudeService.ts` は refactoring.md 総評の「487行」が実際は **400行**。一次レポートの行数引用は全般的に過大。 |
| 肥大化ファイル判定 | 「肥大化」と言えるのは **mapStore.ts（1032行）のみ**。claudeService.ts(400)・AIChatPanel.tsx(460)・AISuggestionPanel.tsx(478) は通常サイズ。 |
| No.4 の行番号 | `mapStore.ts:1040, 1053` を引用 → 実ファイルは1032行でその通りの行にコードが存在する（確認済み）。ただし refactoring.md 総評では「1138行」と誤記。 |
| No.4 の exportService | `exportService.ts:255-256` の記載は要確認（本検証では詳細未確認）。 |

### ダウングレード項目

- **refactoring.md No.5（プロンプト直書き）**: 実コードは claudeService.ts 全体で約400行中プロンプト部分は合計150行程度。「200行超」は誤り。ファイル自体が通常サイズのため分割優先度は **低**（任意→不要に近い）。
- **performance.md No.2（IdeaNode 二重 find()）**: パフォーマンス上は CONFIRMED だが、ノードの find() はドラッグ中は `onNodesChange` 経由で発火するが、ドラッグ中の座標変化（`dragging=true`）は mapStore には積まれない設計のため、実際に find() がトリガーされる頻度は一次レポートの想定より低い。
- **performance.md No.10（useAutoSave 全変更キャッチ）**: レポート自体が「実用上問題なし」と結論。検証でも同様。このまま「対応不要」で確定。

---

## リファクタリング指摘の検証

### No.1 — `claudeService.ts`: `new Anthropic(...)` の重複5か所

**判定: CONFIRMED（重要度はそのまま 高）**

実コードの行番号:
- 行 92: `generateSuggestions`
- 行 191: `analyzeMap`
- 行 253: `suggestConnections`
- 行 316: `suggestClusters`
- 行 373: `chatWithMap`

5か所全て `new Anthropic({ apiKey: req.apiKey, dangerouslyAllowBrowser: true })` が重複。一次レポートの行番号（92, 191, 253, 316, 373）は正確。  
`createClient(apiKey)` ヘルパーへの集約で6行の変更で解決。**要実装。**

---

### No.2 — `mapStore.ts`: グループ操作ジオメトリ関数の分離

**判定: CONFIRMED（重要度は 中 にダウングレード）**

実コード: `mapStore.ts` 行 24-107 に `computePushOut`・`findOverlappingGroup`・`isOutsideParent`・`syncGroupMeasured` の4関数（84行）が存在。Zustand/React 依存なし、純粋関数。  
ただし mapStore.ts が1032行のファイルである以上、84行の移動はサイズへの影響が小さく、独立テスト容易性の向上が主な効果。実害は少ないため重要度を 高→中 に訂正。  
No.7 との同時対応が効率的（後述）。

---

### No.3 — `uiStore.ts:243`: `setSearchOpen` バグ

**判定: CONFIRMED（重要度 高、そのまま）**

実コード（行 243）:
```ts
setSearchOpen: (open) => set({ isSearchOpen: open, searchQuery: open ? '' : '' }),
```

`open ? '' : ''` は常に `''` を返す三項演算子。一次レポートの引用と完全一致。  
意図を確認する必要があるが、最もシンプルな修正は `set({ isSearchOpen: open, searchQuery: '' })` とすること（常に検索クエリをリセット）。あるいは設計によっては `set({ isSearchOpen: open })` のみ。**要修正。**

---

### No.4 — `mapStore.ts`: 後方互換処理の散在

**判定: CONFIRMED（重要度 中、任意）**

実コード:
- 行 1040: `title: n.title ?? (n as unknown as { text?: string }).text ?? ''`
- 行 1053-1054: `sourceHandle: e.sourceHandle ?? 'right'`・`targetHandle: e.targetHandle ?? 'left'`

一次レポートの記述と一致。行番号も実在（refactoring.md 総評の「1138行」は誤記だが、指摘本文の引用は正確）。  
任意対応で問題なし。削除条件をコメントで明文化するのみでも十分。

---

### No.5 — `claudeService.ts`: プロンプト直書き

**判定: REFINED（重要度 中→低 にダウングレード）**

一次レポートは「合計200行超」と記載するが、claudeService.ts は実際400行。プロンプト部分は各関数に約20-60行ずつ散在しているが、ファイル自体が通常サイズのため分離の効果が薄い。個人開発で「プロンプトエンジニアがコード変更を要する」というシナリオも非現実的。優先度は **低（任意）** に変更。

---

### No.6 — `ContextMenu.tsx`: `window.prompt` の使用

**判定: CONFIRMED（重要度 中、任意）**

実コード:
- 行 171: エッジラベル編集 `window.prompt('線のラベルを入力してください', current)`
- 行 378: グループ名変更 `window.prompt('グループ名を入力してください', current)`

2か所とも存在。スマホ対応の観点で残存リスクあり。ただし他の機能と比較して利用頻度は低く、即時対応は不要。`InputDialog` コンポーネント追加は工数中、対費用効果は低め。

---

### No.7 — `mapStore.ts` と `mapLayout.ts` のグループ押し出しロジック重複

**判定: CONFIRMED（重要度 中、任意）**

実コード比較:
- `mapStore.ts` 行 24-57: `computePushOut` — 1ノード単発処理
- `mapLayout.ts` 行 209-243: `applyGroupPushOut` — 全ノード一括処理

アルゴリズムは同一。`typeof group.style?.width === 'number' ? group.style.width : 400` イディオムも両方に存在。No.2 と同時対応すれば効率的。

---

### No.8 — `AIChatPanel.tsx`: `useUIStore.setState` 直接呼び出し

**判定: CONFIRMED（重要度 中、任意）**

実コード（行 185-195）: ストリーミング完了後に `useUIStore.setState((state) => { ... })` を直接呼んで `chatMessages` を更新している。一次レポートの記述と一致。  
ストアアクション `updateLastChatMessageWithActions(content, actions)` を追加することで設計規約に準拠できる。工数小。

---

### No.9 — `mapStore.ts`: `as unknown as` の使用

**判定: CONFIRMED（重要度 低、任意）**

実コード（行 1040）: 一次レポートの引用と完全一致。CLAUDE.md の `any` 禁止方針との整合性問題。`SerializedNode` 型に `text?: string` を `@deprecated` で追加する方法が最もクリーン。

---

### No.10 — `uiStore.ts`: フェーズコメントの混在

**判定: CONFIRMED（重要度 低、任意）**

実コードで uiStore.ts にフェーズコメントが型定義内に存在することを確認。一次レポートの記述と一致。動作への影響なし。

---

### No.11 — `deleteNodes`/`deleteSelected` の重複

**判定: CONFIRMED（重要度 低、任意）**

実コード:
- 行 712-715 (`deleteNodes`): グループ子ノード収集ロジック
- 行 733-736 (`deleteSelected`): 同パターンを繰り返し

一次レポートの行番号・コード引用と一致。`expandGroupIds` ヘルパー化は容易で工数小。

---

### No.12 — APIキー未設定の空状態UI重複

**判定: CONFIRMED（重要度 低、任意）**

実コード:
- `AISuggestionPanel.tsx` 行 277-295: 鍵アイコン＋「Claude APIキーが必要です」＋設定ボタン
- `AIChatPanel.tsx` 行 286-305: 同構造（dark mode クラスあり、ボタン色が `bg-blue-500` で微妙に異なる）
- `MapAnalysisPanel.tsx` 行 181-199: 同構造

3コンポーネントとも重複を確認。ただし AIChatPanel.tsx のボタン色が `bg-blue-500` で他の `bg-primary-600` と異なるため、共通コンポーネント化時に統一が必要。

---

## パフォーマンス指摘の検証

### 1. バンドル単一チャンク問題

**判定: CONFIRMED（重要度 高）**

811 kB raw / 235 kB gzip は確認済みの事実。`vite.config.ts` への `manualChunks` 追加で対応可能。工数小・効果大のため最優先。

---

### 2. `IdeaNode` 内 `nodes.find()` 二重実行

**判定: CONFIRMED（重要度 高→中 にダウングレード）**

実コード（IdeaNode.tsx 行 42-43）:
```ts
const storeColor = useMapStore((s) => s.nodes.find((n) => n.id === id)?.data.color)
const storeCategoryId = useMapStore((s) => s.nodes.find((n) => n.id === id)?.data.categoryId)
```

2つの別個 Zustand サブスクリプションが存在することを確認。ただし性能上の補足:
- `mapStore` の `nodes` はドラッグ中（`dragging=true`）に `setNodesNoHistory` 経由で更新される場合のみトリガー
- 実際の高頻度更新パスは `onNodesChange` だが、これは React Flow 内部の nodes ref を更新するため Zustand サブスクリプションを発火しない場合がある

セレクタを1つに統合（`useShallow` 付き）で fix 可能。工数小。一次レポートの「100ノード×2セレクタ×60fps=12,000回/秒」は最悪ケースの理論値であり、実際はドラッグ操作でも Zustand の更新頻度はそこまで高くない。重要度を 高→中 に訂正。

---

### 3. `displayNodes` 全ノード `.map()` が選択変化ごとに実行

**判定: CONFIRMED（重要度 高、そのまま）**

実コード（IdeaCanvas.tsx 行 237-264）: `useMemo` の依存配列に `selectedNodeId` があり、ノード選択・解除のたびに全ノードを `.map()` して新オブジェクトを生成している。100ノード超で実測遅延が出うる。  
根本解決は各 `IdeaNode` が自分の dim 状態を `selectedNodeId` セレクタで自己判定する設計変更。工数中。ただし `displayEdges`（行 266-276）も同様の問題あり（一次レポートで言及なし → 追加指摘）。

---

### 4. パネルが `useMapStore()` でストア全体購読

**判定: CONFIRMED（重要度 中、そのまま）**

実コード確認（全パネル）:
- `NodePanel.tsx`: `const { nodes } = useMapStore()` — nodes フル購読
- `AIChatPanel.tsx`: `const { nodes, edges, addNode, onConnect, updateNodeTitle } = useMapStore()`
- `AISuggestionPanel.tsx`: `const { nodes, edges, addNode, onConnect } = useMapStore()`
- `MapAnalysisPanel.tsx`: `const { nodes, edges, addSuggestedEdge, applyClusterCategory } = useMapStore()`
- `NodeDetailPanel.tsx`: `const { nodes, ... } = useMapStore()`

全て `nodes` フル配列を受け取っており、ドラッグ中に再描画が走る。セレクタ最適化で改善可能（各パネル10-20分）。

---

### 5. `NodeActionBar` が `useViewport()` で毎フレーム再描画

**判定: CONFIRMED（重要度 中、そのまま）**

実コード（IdeaCanvas.tsx 行 27-100）:
```ts
function NodeActionBar() {
  const { ... } = useUIStore()
  const { deleteNode, nodes } = useMapStore()  // nodes フル購読
  useViewport()  // パン・ズーム変化で再描画
```

`useViewport()` がある上に `nodes` フル配列も購読。`!selectedNodeId` の場合に早期リターンするが、その前にフックが実行される。  
`selectedNodeId` のあるなしをフック前にチェックできないため、選択なし状態でも購読コストが発生する点は一次レポートの通り。

---

### 6. `Toolbar` のストア全体購読と3系統の `useEffect`

**判定: CONFIRMED（重要度 中、そのまま）**

実コード（Toolbar.tsx 行 12-13）:
```ts
const { addNode, nodes, edges, setNodesNoHistory, commitNodesWithHistory, undo, redo, past, future, deleteSelected } = useMapStore()
const { selectedNodeId, ...(多数)... } = useUIStore()
```

`nodes`・`edges`・`past`・`future` を全て購読。`useEffect` も `showLayoutMenu`・`showFilterMenu`・`showPresentMenu` の3つが個別の `addEventListener` を持つことを確認。  
`past.length > 0`・`future.length > 0` の boolean セレクタ化で nodes/edges の購読を排除できる。

---

### 7. `Header` が `useUIStore()` でストア全体購読

**判定: CONFIRMED（重要度 中、そのまま）**

実コード（Header.tsx 行 32）:
```ts
const { mapTitle, setMapTitle, saveStatus, currentFileId, lastSavedAt, requestSave, setSettingsOpen, setMapListOpen, setAnalysisPanelOpen, setChatPanelOpen, setFileDashboardOpen, openConfirmDialog } = useUIStore()
```

多数のプロパティを展開。AI ストリーミング中の `updateLastChatMessage` 高頻度更新で Header が毎フレーム再描画される問題は実在する。`useShallow` または個別セレクタへの変更で対応可能。

---

### 8. 共有URL: base64 で URL サイズ肥大

**判定: CONFIRMED（重要度 低、任意）**

一次レポートの説明と実装は一致していると推定（exportService.ts の詳細確認は省略、行動方針は現状維持で問題なし）。

---

### 9. `animate-node-enter` が全ノードに常時クラス適用

**判定: CONFIRMED（重要度 低、任意）**

実コード（IdeaNode.tsx 行 140）:
```tsx
<div className={`relative group animate-node-enter transition-opacity duration-200 ...`}
```

全 IdeaNode に常時 `animate-node-enter` が付与されている。ファイルロード時に全ノード一斉アニメーション。個人利用規模では許容範囲。

---

### 10. `useAutoSave` が全変更をキャッチ

**判定: CONFIRMED（問題なし・対応不要）**

実コード（useAutoSave.ts 行 212）: `useMapStore.subscribe(() => scheduleSave())` — 全変更をキャッチ。  
デバウンスが機能しているため保存回数は問題なし。一次レポートの「対応不要」判定を支持。

---

## 見落とし・追加指摘

### A. `displayEdges` も全エッジ `.map()` で新オブジェクト生成

**重要度: 中**

performance.md No.3 では `displayNodes` の問題を指摘しているが、`displayEdges`（IdeaCanvas.tsx 行 266-276）も同様のパターン:
```ts
const displayEdges = useMemo(() => {
  if (!selectedNodeId) return edges
  return edges.map((e) =>
    e.source === selectedNodeId || e.target === selectedNodeId ? e : { ...e, style: { ...e.style, opacity: 0.1 } }
  )
}, [edges, selectedNodeId, isPresentationMode])
```
エッジ数が多いマップでノード選択・解除のたびに全エッジが再描画対象になる。`displayNodes` 問題と同時に対処すべき。

---

### B. `NodeActionBar` の `nodes.find()` が二重実行

**重要度: 低**

IdeaCanvas.tsx 行 37-44:
```ts
const storeNode = nodes.find((n) => n.id === selectedNodeId)
// ...
const parentNode = storeNode.parentId ? nodes.find((n) => n.id === storeNode.parentId) : null
```
`nodes` フル配列から最大2回の `find()` を実行。IdeaNode の二重 find() (No.2) と同様のパターン。`useMapStore` セレクタで直接取得する方がよい。

---

### C. `Header.tsx` にも1つの `useEffect` + `addEventListener` パターン

**重要度: 低**

Toolbar の3系統 `useEffect` と同様に、Header.tsx にも `showAccountMenu` のクリックアウト検出 `useEffect` が存在する。Toolbar との共通化が可能。

---

### D. `AIChatPanel.tsx` の `nodes.edges` 購読が不要

**重要度: 低**

AIChatPanel.tsx 行 44: `const { nodes, edges, addNode, onConnect, updateNodeTitle } = useMapStore()`  
`edges` はこのパネルでどの程度使用されているか要確認。チャットパネル内での `edges` 利用がなければ、購読を削除できる。

---

## 最終ランク

実装推奨順（コスト対効果と確認済みの問題深刻度に基づく）:

| 順位 | 項目 | ファイル | 工数 | 効果 | 判定根拠 |
|---|---|---|---|---|---|
| 1 | バンドル分割（manualChunks） | `vite.config.ts` | 小（30分） | 大（初回ロード改善） | CONFIRMED・即着手 |
| 2 | `uiStore.ts:243` バグ修正 | `uiStore.ts` | 小（5分） | 確実（バグ解消） | CONFIRMED・バグなので最優先に近い |
| 3 | `new Anthropic()` 重複解消 | `claudeService.ts` | 小（30分） | 中（保守性向上） | CONFIRMED・変更範囲明確 |
| 4 | `IdeaNode` find() セレクタ統合 | `IdeaNode.tsx` | 小（1時間） | 中（描画最適化） | CONFIRMED・useShallow で解決 |
| 5 | Zustand セレクタ最適化（パネル群） | 各パネル | 小〜中（2-4時間） | 中（ドラッグ時の再描画削減） | CONFIRMED・Toolbar・Header・NodeActionBar 含む |
| 6 | `displayNodes`/`displayEdges` の設計変更 | `IdeaCanvas.tsx`・各ノード | 中（半日） | 大（100ノード超での体感改善） | CONFIRMED（追加: displayEdges も含む） |
| 7 | ジオメトリ関数の分離（No.2+7） | `mapStore.ts`→`groupGeometry.ts` | 小〜中 | 低（テスト容易性） | CONFIRMED・urgency低 |
| 8 | `deleteNodes`/`deleteSelected` 重複解消 | `mapStore.ts` | 小（30分） | 低（DRY） | CONFIRMED |
| 9 | APIキー空状態UI共通化 | 3パネル | 小 | 低（DRY） | CONFIRMED（ボタン色の不統一も解消） |
| 10 | `AIChatPanel` ストアアクション化 | `AIChatPanel.tsx`・`uiStore.ts` | 小 | 低（設計規約） | CONFIRMED |
| - | プロンプト直書き分離 | `claudeService.ts` | 中 | 低 | DOWNGRADED（ファイルサイズ通常） |
| - | `window.prompt` 置換 | `ContextMenu.tsx` | 中 | 低 | CONFIRMED だが優先度低 |
| - | `useAutoSave` 購読最適化 | `useAutoSave.ts` | 中 | なし | 対応不要で確定 |
