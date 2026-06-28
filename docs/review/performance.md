# パフォーマンスレビュー — IdeaMap

> レビュー日: 2026-06-28  
> 対象コミット: main ブランチ（Phase 26 完了時点）

---

## 総評

個人用ツールとして数十〜数百ノード規模での利用を想定した場合、現時点でパフォーマンスの致命的な問題はない。ただし **バンドルが単一チャンク 811 kB**（gzip 235 kB）に集約されており、初回ロード時間に明確に影響が出る。コード分割を導入するだけで体感改善が見込める。次点として、`IdeaNode` が毎レンダリング `nodes.find()` を2回走らせている点と、`IdeaCanvas` の `displayNodes` が選択変化のたびに全ノードを `.map()` する点が、ノード数 100 超で実測遅延として現れうる。`useAutoSave` と自動保存の差分検出は問題ない設計。

---

## バンドルサイズ計測結果（`npm run build` 実測値）

| ファイル | raw | gzip |
|---|---|---|
| `dist/assets/index-*.js` | **811.58 kB** | 235.56 kB |
| `dist/assets/node-*.js` | 15.15 kB | 5.68 kB |
| `dist/assets/index-*.css` | 59.89 kB | 10.51 kB |
| **合計 JS** | **826.73 kB** | **241.24 kB** |

Vite 自身も `Some chunks are larger than 500 kB after minification.` 警告を出力。主要寄与ライブラリ（推定）:

- `@anthropic-ai/sdk` — Fetch ベースだが型定義を含む（推定 ~100 kB）
- `@xyflow/react` — フル React Flow（推定 ~200 kB）
- `@dagrejs/dagre` — グラフレイアウト（推定 ~50 kB）
- `html-to-image` — 画像エクスポート（推定 ~30 kB）

---

## 重要度別サマリ表

| # | 重要度 | タイトル | 対象ファイル |
|---|---|---|---|
| 1 | **高** | バンドル単一チャンク問題 | `vite.config.ts` |
| 2 | **高** | `IdeaNode` 内 `nodes.find()` 二重実行 | `IdeaCanvas.tsx` / `IdeaNode.tsx` |
| 3 | **高** | `displayNodes` の全ノード `.map()` が選択変化ごとに実行 | `IdeaCanvas.tsx` |
| 4 | **中** | `NodePanel` / `AIChatPanel` / `AISuggestionPanel` が `useMapStore()` でストア全体購読 | 各パネル |
| 5 | **中** | `NodeActionBar` が `useViewport()` で毎フレーム再描画 | `IdeaCanvas.tsx` |
| 6 | **中** | `Toolbar` がストア全体購読かつ3つの `useEffect` クリックアウト登録 | `Toolbar.tsx` |
| 7 | **中** | `Header` が `useUIStore()` でストア全体購読 | `Header.tsx` |
| 8 | **低** | 共有URL: `JSON.stringify` → base64 で URL サイズ肥大 | `exportService.ts` |
| 9 | **低** | `animate-node-enter` が全ノードに常時クラス適用 | `IdeaNode.tsx` |
| 10 | **低** | `useAutoSave` が `useMapStore.subscribe` でストア全変更をキャッチ | `useAutoSave.ts` |

---

## 詳細指摘

---

### 1. バンドル単一チャンク問題

- **重要度**: 高
- **対象ファイル**: `ideamap/vite.config.ts`
- **現状**: `vite.config.ts` に `build.rollupOptions` の設定がなく、すべてのコードが `index-*.js`（811 kB raw）に集約される。`@anthropic-ai/sdk`・`@dagrejs/dagre`・`html-to-image` は起動直後には不要だが初回ロード時に全部解析される。
- **パフォーマンスへの影響**: 低速回線・低スペックスマホでの初回表示が数秒遅延する可能性がある。また JS パース/コンパイル時間はバンドルサイズに比例するため、ミッドレンジスマホでも 300〜500 ms 追加コストが見込まれる。
- **推奨対応**:
  1. `vite.config.ts` に `build.rollupOptions.output.manualChunks` でベンダー分割を追加する:
     ```ts
     build: {
       rollupOptions: {
         output: {
           manualChunks: {
             'react-vendor': ['react', 'react-dom'],
             'flow': ['@xyflow/react'],
             'ai': ['@anthropic-ai/sdk'],
             'export': ['html-to-image', '@dagrejs/dagre'],
           }
         }
       }
     }
     ```
  2. `html-to-image` と `@dagrejs/dagre` は使用箇所（`exportService.ts`・`mapLayout.ts`）を動的 import に変えて遅延ロード化することも検討する（工数 中）。
- **推定工数**: 小（`manualChunks` 追記のみなら 30 分）

---

### 2. `IdeaNode` 内 `nodes.find()` 二重実行（全ノード毎レンダリング）

- **重要度**: 高
- **対象ファイル**: `ideamap/src/components/canvas/IdeaNode.tsx`（42–45 行）
- **現状**: `IdeaNode` は `memo` でラップされているが、内部で以下の2つの Zustand セレクタを持つ:
  ```ts
  const storeColor = useMapStore((s) => s.nodes.find((n) => n.id === id)?.data.color)
  const storeCategoryId = useMapStore((s) => s.nodes.find((n) => n.id === id)?.data.categoryId)
  ```
  これらは別個のサブスクリプションになるため、`mapStore` が更新されるたびに**各ノードが最大2回の `find()`** を実行する。100 ノードあれば 200 回の線形探索がひとつの更新ごとに走る。
- **パフォーマンスへの影響**: ドラッグ中（`onNodesChange` が高頻度で発火）に最も顕在化する。100 ノード × 2 セレクタ × 60 fps = 12,000 回/秒の `find()` が最悪ケース。
- **推奨対応**:
  1. 2つのセレクタを1つに統合する:
     ```ts
     const { color: storeColor, categoryId: storeCategoryId } = useMapStore(
       (s) => {
         const n = s.nodes.find((n) => n.id === id)
         return { color: n?.data.color, categoryId: n?.data.categoryId }
       }
     )
     ```
     ただし、オブジェクトを返すセレクタは毎回新参照になるため `useShallow` で浅い比較を付ける必要がある。
  2. 根本的には `useMapStore` が `Map<id, node>` 形式でノードを管理すれば O(1) ルックアップになる（ただし設計変更が大きい）。
- **推定工数**: 小（セレクタ統合 + `useShallow` 導入は 1 時間以内）

---

### 3. `displayNodes`/`displayEdges` の全ノード `.map()` が選択変化ごとに実行

- **重要度**: 高
- **対象ファイル**: `ideamap/src/components/canvas/IdeaCanvas.tsx`（237–276 行）
- **現状**:
  ```ts
  const displayNodes = useMemo(() => {
    // 選択時: 全ノードをループして highlightIds を判定し、毎回新オブジェクトを生成
    return nodes.map((n) =>
      highlightIds.has(n.id) ? n : { ...n, style: { ...n.style, opacity: 0.15 } }
    )
  }, [nodes, edges, selectedNodeId, ...])
  ```
  `selectedNodeId` が変わるたびに（ノード選択・解除のたびに）全ノードの `.map()` が走り、対象外ノードは毎回 `{ ...n, style: ... }` で新オブジェクトが生成される。これにより React Flow は「全ノードが変化した」と判断し、全ノードを再描画する可能性がある。
- **パフォーマンスへの影響**: ノード選択時に 100 ノードの再描画がトリガーされる。`displayEdges` も同様。エッジ数が多いマップで特に目立つ。
- **推奨対応**:
  1. 短期: `onlyRenderVisibleElements={true}`（デフォルト既に設定済み）は画面外を省くが、選択時の全ノード新オブジェクト生成問題は別問題。opacity を CSS カスタムプロパティか `data-dimmed` 属性で制御し、各ノードコンポーネント内で自身の状態だけを購読する設計に変更することが根本解決になる。
  2. 中期: `selectedNodeId` と `highlightIds` を `IdeaNode` 側でセレクタ購読し、各ノードが自分の dim 状態を判定する。`IdeaCanvas` 側では `displayNodes = nodes`（無変換）にすることで全ノード新オブジェクト問題がなくなる。
- **推定工数**: 中（設計変更が必要。数時間〜半日）

---

### 4. パネルコンポーネントが `useMapStore()` / `useUIStore()` でストア全体購読

- **重要度**: 中
- **対象ファイル**: `NodePanel.tsx`・`AIChatPanel.tsx`・`AISuggestionPanel.tsx`・`MapAnalysisPanel.tsx`・`NodeDetailPanel.tsx`
- **現状**: 各パネルが `useMapStore()` でストア全体を購読している。例:
  ```ts
  // NodePanel.tsx
  const { nodes } = useMapStore()  // nodes 全体を受け取る
  ```
  `nodes` 配列はドラッグ中に高頻度で更新されるため、**パネルが開いていなくても** `nodes` が更新されるたびにコンポーネントが再レンダリングされる。
- **パフォーマンスへの影響**: ドラッグ操作中にパネルが開いていると、毎フレームパネル全体が再描画される。パネルが閉じていても（`if (!isOpen) return null` の前にフックが走るため）セレクタは実行される。
- **推奨対応**: セレクタで必要なプロパティだけを選択する:
  ```ts
  // Before
  const { nodes } = useMapStore()
  const selectedNode = nodes.find((n) => n.id === selectedNodeId)

  // After: selectedNodeId が変わったときだけ再購読
  const selectedNode = useMapStore((s) => s.nodes.find((n) => n.id === selectedNodeId))
  ```
  または `useShallow` でプリミティブ値のみ抽出する。
- **推定工数**: 小（各パネル 10〜20 分）

---

### 5. `NodeActionBar` が `useViewport()` で毎フレーム再描画

- **重要度**: 中
- **対象ファイル**: `ideamap/src/components/canvas/IdeaCanvas.tsx`（30 行）
- **現状**:
  ```ts
  function NodeActionBar() {
    useViewport() // ズーム・パン変化時に再レンダリングしてバーを再配置
    const { deleteNode, nodes } = useMapStore()  // nodes 全体も購読
  ```
  `useViewport()` はパン・ズームのたびに再描画を強制する。加えて `useMapStore()` でストア全体を購読しているため、ドラッグ中は毎フレーム `NodeActionBar` がレンダリングされる。
- **パフォーマンスへの影響**: ドラッグ + パン同時操作時、`NodeActionBar` + `IdeaCanvas` の二重再描画が発生する。視覚的に `NodeActionBar` が不要なとき（`selectedNodeId === null`）も購読コストは発生する。
- **推奨対応**:
  1. `NodeActionBar` を `IdeaCanvas` から分離して `memo` でラップし、関係する props のみを渡す。
  2. `useMapStore` の購読を `deleteNode` アクションのみに絞る（`nodes` は `storeNode` のために参照しているが、`useMapStore(s => s.nodes.find(n => n.id === selectedNodeId))` で代替可能）。
- **推定工数**: 小（30 分〜1 時間）

---

### 6. `Toolbar` のストア全体購読と3系統の `useEffect` クリックアウト登録

- **重要度**: 中
- **対象ファイル**: `ideamap/src/components/toolbar/Toolbar.tsx`
- **現状**:
  ```ts
  const { addNode, nodes, edges, setNodesNoHistory, commitNodesWithHistory, undo, redo, past, future, deleteSelected } = useMapStore()
  const { selectedNodeId, ...(多数)... } = useUIStore()
  const { categories, snapToGrid, setSnapToGrid } = useSettingsStore()
  ```
  `nodes`・`edges`・`past`・`future` を購読しているため、ドラッグ中（`onNodesChange` 高頻度）に `Toolbar` が毎フレーム再描画される。undo/redo ボタンの活性状態判定のために `past.length > 0` が必要なのは理解できるが、`nodes` フル配列まで購読する必要はない。
  加えて3つのメニューそれぞれに独立した `useEffect` + `addEventListener` を持ち、メニューの開閉ごとに DOM イベントリスナーの付け外しが発生する。
- **パフォーマンスへの影響**: ドラッグ中のツールバー再描画がメインスレッドに負荷を加える。ドラッグアニメーション（60 fps）中に 10 以上の React コンポーネントが毎フレーム再描画されている状態になりうる。
- **推奨対応**:
  1. `nodes`・`edges` の購読を削除し、「ノード追加ボタン」に `useReactFlow()` 経由のビュー情報だけを使う。
  2. `past.length` / `future.length` のみセレクタで抽出する:
     ```ts
     const canUndo = useMapStore(s => s.past.length > 0)
     const canRedo = useMapStore(s => s.future.length > 0)
     ```
  3. クリックアウト検出は共通 `useClickOutside` フックに集約する。
- **推定工数**: 小〜中（セレクタ修正は 1 時間、フック共通化は別途）

---

### 7. `Header` が `useUIStore()` でストア全体購読

- **重要度**: 中
- **対象ファイル**: `ideamap/src/components/common/Header.tsx`（32 行）
- **現状**:
  ```ts
  const { mapTitle, setMapTitle, saveStatus, currentFileId, lastSavedAt, requestSave, setSettingsOpen, ... } = useUIStore()
  ```
  `useUIStore` はストア全体の変更で `Header` を再描画させる。チャットパネルのローディング状態・検索クエリ・コンテキストメニュー開閉といった `Header` に無関係な状態が変化するたびに `Header` がレンダリングされる。
- **パフォーマンスへの影響**: AI 応答ストリーミング中（`updateLastChatMessage` が高頻度で呼ばれる）に `Header` が毎フレーム再描画される。`saveStatus` のみ必要な視覚情報は少ないため、最小セレクタへの変更で抑制できる。
- **推奨対応**: `useShallow` または個別セレクタで `mapTitle`・`saveStatus`・`lastSavedAt` のみ購読する。
- **推定工数**: 小（30 分）

---

### 8. 共有URL: `JSON.stringify` → base64 で URL サイズ肥大

- **重要度**: 低
- **対象ファイル**: `ideamap/src/services/exportService.ts`（267–273 行）
- **現状**:
  ```ts
  const json = JSON.stringify(mapFile)
  const encoded = btoa(unescape(encodeURIComponent(json)))
  ```
  マップ全体を JSON 化し base64 エンコードして URL クエリパラメータに埋め込む。50,000 文字超で警告を出しているが、ノード 50 個・本文あり の場合は軽く超える可能性がある。`body` フィールドが長い場合に特に肥大する。
- **パフォーマンスへの影響**: URL 生成・解析のコスト自体は小さい（1 回限り）。ただし URL が長すぎるとブラウザのアドレスバーや一部のリンクプレビューで切り捨てられる。コスト面より機能面の問題。
- **推奨対応**: `body` フィールドを共有URLから除外するか、`pako`（zlib）で圧縮してから base64 化することで 50〜70% 削減できる。ただし依存追加が必要。現状の警告メカニズムがあるため緊急ではない。
- **推定工数**: 小（圧縮なし・body 除外のみなら 30 分）

---

### 9. `animate-node-enter` が全ノードに常時クラス適用

- **重要度**: 低
- **対象ファイル**: `ideamap/src/components/canvas/IdeaNode.tsx`（140 行）・`ideamap/src/index.css`
- **現状**:
  ```tsx
  <div className="relative group animate-node-enter ...">
  ```
  `animate-node-enter`（`node-scale-in` キーフレーム: 0.18s）はすべての `IdeaNode` に常時クラスとして付与されている。ファイルロード時に 100 ノードが一斉にアニメーションすると GPU コンポジット負荷が発生する。
- **パフォーマンスへの影響**: 初回ロード・ファイル読み込み後の一瞬（0.18 秒間）のみ。個人利用規模では体感しにくいが、マップが大きいほど GPU への負荷が集中する。
- **推奨対応**: アニメーションを「今追加されたノード」のみに適用する（`createdAt` タイムスタンプや新規フラグを `data` に持ち、追加直後のみクラスを付与してから外す）。ただし複雑化するため、数十ノード規模では現状維持でも問題ない。
- **推定工数**: 中（状態管理の変更が必要）

---

### 10. `useAutoSave` が `useMapStore.subscribe` でストア全変更をキャッチ

- **重要度**: 低
- **対象ファイル**: `ideamap/src/hooks/useAutoSave.ts`（211–217 行）
- **現状**:
  ```ts
  const unsubscribe = useMapStore.subscribe(() => scheduleSave())
  ```
  `mapStore` のいかなる更新でも `scheduleSave()` が呼ばれる。ドラッグ中（毎フレーム `onNodesChange`）は毎フレームデバウンスタイマーがリセットされる。
- **パフォーマンスへの影響**: `scheduleSave` 自体の処理は軽い（タイマーリセットのみ）。3 秒のデバウンスが最終的に1回保存するので**保存回数は問題なし**。ドラッグ終了後に3秒待つ設計は適切。実際の保存は差分検出なく全体を `JSON.stringify` するが、3秒に1回のドライブPATCH なので許容範囲。
- **推奨対応**: 現状は実用上問題なし。厳密に改善するなら `xyflow` の `position` 変化以外のデータ変化（`title`・`color`・新ノード追加等）のみをトリガーにする選択的購読に変更できるが、複雑化のリスクが効果を上回る。
- **推定工数**: 中（対応不要を推奨）

---

## 優先順位まとめ

高の指摘（3件）を優先して着手すること。特に指摘 1（バンドル分割）は `vite.config.ts` への数行追加だけで初回ロードが改善されるため最優先。

1. **バンドル分割**（工数 小・効果 大）→ 今すぐ着手
2. **`IdeaNode` の二重 `find()`**（工数 小・効果 中）→ バンドル分割の次
3. **`displayNodes` 全ノード map()**（工数 中・効果 大）→ ノード数が 100 を超えたら着手
4. 指摘 4〜7 の Zustand セレクタ最適化は、スムーズなドラッグ操作が体感的に劣化したと感じたタイミングでまとめて対処する
