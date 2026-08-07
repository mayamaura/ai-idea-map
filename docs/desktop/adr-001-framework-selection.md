# ADR-001: デスクトップアプリのフレームワーク選定

**作成日**: 2026-08-05
**ステータス**: 承認（Accepted）
**対象**: IdeaMap デスクトップ版

---

## 結論（先に要約）

**Tauri v2 を採用する。** 現状の安定版は 2026-07-01 リリースの Tauri 2.11.5 で、v2 系は 2024-10-02 の安定化以降 2年弱の運用実績があり、実運用に耐える成熟度に達していると判断した。決め手は次の3点。

1. デスクトップ版を作る最大の目的である「Ollama へのローカル HTTP アクセスの安定化」を、`tauri-plugin-http` の capabilities/scope 設定で明示的かつ安全に実現できる。
2. 既存 Web 版（Vite + React 19 + TypeScript + Tailwind + Zustand + React Flow）のフロントエンド資産をほぼそのまま流用でき、バックエンドは薄い Rust コマンド層に留められる。
3. バンドルサイズ・メモリ使用量で Electron に対し大きな優位があり、配布容量・常駐メモリを抑えられる。

一方で、Rust ツールチェーンの導入コスト、Windows/macOS 間の WebView レンダリング差異、コード署名なし配布時の SmartScreen/Gatekeeper 警告、日本語IME関連の既知不具合など、無視できない懸念点がある。これらは本 ADR の「4. 懸念と対策」で個別に対処方針を示す。いずれも致命的ではなく、回避策・運用でカバー可能と判断した。

なお、Anthropic 自身の Claude デスクトップアプリは Electron を採用している（開発効率・Web版とのコード共有・複数OSでの保守コストの単純化が理由と見られる）。この事実は Electron が「悪い選択」ではないことを示すが、IdeaMap の最優先目的（ローカルLLMへの安定アクセス）と、開発者が単独かつAIエージェント中心で開発する体制を踏まえると、今回は Tauri を優先する。

---

## 1. 背景と決定ドライバ

### 1.1 背景

IdeaMap は現在、バックエンドを持たない Vite + React SPA として GitHub Pages にホスティングされている。AI 連携は Anthropic Claude API を利用しているが、今後「ローカル LLM（Ollama）を使ってオフライン・低コストでアイデア拡張したい」という要望に応えるため、デスクトップアプリ版の開発を検討する。

ブラウザから `http://localhost:11434`（Ollama のデフォルトエンドポイント）へアクセスする場合、以下の制約に直面する。

- Ollama サーバーは既定で CORS ヘッダーを返さないため、ブラウザからの fetch はプリフライトで失敗する。`OLLAMA_ORIGINS` 環境変数での許可設定をユーザーに強制することになり、配布物として現実的でない。
- Chrome 131 以降は Private Network Access（PNA）の仕様強化により、パブリックオリジンからプライベートアドレス（localhost含む）への fetch に `Access-Control-Allow-Private-Network` ヘッダーを要求するようになっており、GitHub Pages（`https://`）から `http://localhost:11434` への接続はブラウザ側の制約が今後さらに強まる可能性がある。
- ブラウザ拡張機能や `chrome-extension://` オリジンを使う回避策はあるが、配布・保守の複雑さが増し、Web版の思想（バックエンドレス・シンプル）から外れる。

これらはブラウザのセキュリティモデルに起因する構造的な制約であり、Web版のままでは解決が難しい。デスクトップアプリとしてネイティブプロセスの中からHTTPリクエストを発行すればこの制約を回避できる。

### 1.2 決定ドライバ（評価軸）

| # | 評価軸 | 内容 |
|---|---|---|
| 1 | ローカルHTTPアクセスの自由度 | Ollama等 `localhost` への安定したHTTPアクセスが、ブラウザのCORS制約を受けずに行えるか |
| 2 | 既存資産の再利用性 | Vite + React 19 + TypeScript + Tailwind + Zustand + React Flow のフロントエンドをどれだけそのまま使えるか |
| 3 | バンドルサイズ・メモリ | 配布物のサイズ、常駐メモリ使用量 |
| 4 | Windows/macOS配布・コード署名 | インストーラー生成、コード署名の要否・コスト、未署名時の警告表示 |
| 5 | 自動更新 | アプリの自動アップデート機構の有無・成熟度 |
| 6 | 日本語IME入力の実績 | 日本語変換窓の位置・確定処理など、IME周りの既知不具合の有無 |
| 7 | React Flow等の重いCanvas UIとの相性 | ノード数の多いキャンバスの描画パフォーマンス、GPUアクセラレーション |
| 8 | AIエージェントによる開発しやすさ | Claude Code のようなAIエージェントが学習データ・ドキュメント量的に扱いやすいか |
| 9 | ライセンス | OSSライセンスの条件、商用配布への制約 |

---

## 2. 候補の比較

調査時点（2026年8月）で確認できた最新状況を基に、主要候補を比較する。**未確認**と明記した項目以外は Web 検索で裏取り済み。

### 2.1 候補一覧と最新バージョン状況（2026年8月時点で確認）

| フレームワーク | 最新安定版 | 状態 |
|---|---|---|
| Tauri v2 | 2.11.5（2026-07-01） | 安定・活発にメンテナンス継続中。2024-10-02 に v2 が安定版としてリリースされて以降、約1年10ヶ月の実運用実績。tauri-cli 2.11.4、@tauri-apps/api 2.11.1 も同時期にリリース。 |
| Electron | 安定版 41.2.1（2026-04-16時点）、nightly は 45.0.0系（2026-07-22時点） | OpenJS Foundation配下で継続的にメンテナンス。8週間ごとにメジャーバージョンリリース、直近3メジャーバージョンをサポート。 |
| Wails v3 | v3.0.0-rc.1 / beta.3 系（2026年8月時点） | **まだベータ〜RC段階**。安定版として案内されているのは Wails v2。公式ドキュメントも「v3が準備できるまでv2アプリはそのまま維持を推奨」としている。 |
| Neutralino.js | @neutralinojs/lib 6.9.0、@neutralinojs/neu 11.7.2（2026-06時点） | 開発は継続しているが、Tauri/Electronと比べてエコシステム・実績情報が薄い。 |
| PWA + ブラウザ拡張 | — | フレームワークではなくWeb標準の組み合わせ。上記1.1のCORS/PNA制約が本質的な壁として残る。 |

### 2.2 評価軸ごとの比較表

| 評価軸 | Tauri v2 | Electron | Wails v3 | Neutralino.js | PWA+拡張 |
|---|---|---|---|---|---|
| ①ローカルHTTPアクセス | ◎ `tauri-plugin-http` + capabilities/scope で `http://localhost:11434` を明示許可すれば、CORSの制約を受けずアクセス可能。または Rust側コマンドで直接HTTPを叩く経路も選べる | ◎ Node.js の `fetch`/`http` をメインプロセスから直接利用可能。CORS制約を受けない | ◎ Go バックエンドから直接HTTPアクセス可能。CORS制約なし | 〇 同様にネイティブ層からアクセス可能だが情報が少なく実績未確認 | △ 拡張機能なら `host_permissions` で可能だが、配布・審査・保守が複雑。PWA単体は不可（CORS/PNAの壁） |
| ②既存資産の再利用性 | ◎ フロントエンドはWebView内で動くReact/Viteアプリそのまま。ビルド成果物を `tauri.conf.json` の `frontendDist` に向けるだけで大部分が流用可能 | ◎ 同様にフロントエンドをそのまま利用可能。Node.js APIとの親和性も高い | 〇 フロントエンドは流用できるが、バックエンドはGo。TypeScript側のAI連携ロジック等はそのまま使えるが、v3はAPI変更中でドキュメントが流動的 | 〇 フロントエンドは流用可能。ただしAPIサーフェスがシンプルな分、高度な機能（システムトレイ等）はプラグイン依存 | ◎ 100%そのまま。ただしローカルLLM連携という主目的を達成できない |
| ③バンドルサイズ・メモリ | ◎ Hello World比較で Tauri 3.2MB 対 Electron 85MB（96%減）、アイドル時メモリ Tauri 42MB 対 Electron 168MB という比較データあり（出典に依存する目安値） | △ Chromiumをフルバンドルするため数十〜100MB超、メモリも大きい | ◎ Tauriに近い軽量さ（Goバイナリ＋システムWebView） | ◎ 各候補中最軽量クラスを謳う | ◎ 追加バンドル不要 |
| ④配布・コード署名 | 〇 Windows: MSI/NSISインストーラーを標準生成。署名は必須ではないが、未署名だとSmartScreen警告が出る。macOS: `.app`/`.dmg`生成、Apple Developer Program（年99ドル）加入でコード署名・公証(notarization)が可能 | 〇 electron-builder等でMSI/DMG生成可能。署名要件はTauriと同様 | 〇 Go標準のクロスコンパイルを活かせるが、v3のインストーラー機構はまだ発展途上（未確認点あり） | △ 軽量だが署名・配布まわりの実績情報が少ない | ◎ ブラウザ配布のみなら署名不要。拡張機能はストア審査が必要 |
| ⑤自動更新 | 〇 `tauri-plugin-updater` が公式提供。署名鍵による更新検証が必須（無効化不可）で、鍵管理の運用負荷がある | ◎ `electron-updater`が非常に成熟しており事例が豊富 | △ v3時点で自動更新機構の成熟度は未確認 | △ 情報不足、未確認 | 〇 PWAはService Worker経由で自動更新（ブラウザの仕組みに乗る） |
| ⑥日本語IME実績 | △ Tauri v2でLinux環境限定の「IME変換窓の位置がずれる」既知不具合（GitHub Issue #11412、2024-10-19報告、2026年8月時点でも "needs triage" のまま未修正）を確認。**Windows(WebView2)特有の同種issueは検索した範囲では見つからず**、影響はLinux限定と見られる | ◎ Chromiumベースで日本語入力の実績は長く、大きな既知問題は確認できず | △ 情報不足、未確認 | △ 情報不足、未確認 | ◎ 通常のブラウザと同じ入力体験 |
| ⑦React Flow等重いCanvas UI | 〇 Windows(WebView2)はChromiumベースでReact Flowの動作実績は問題なしと推測されるが、Tauri固有のベンチマーク記事は限定的。React Flow自体は仮想化（`onlyRenderVisibleElements`）を持ち大規模グラフに対応。**macOS(WKWebView)/Linux(WebKitGTK)でのCanvas/CSSフィルターのGPUアクセラレーション不足に関する既知issueあり（tauri-apps/tauri #4891 等）** | ◎ Chromiumで統一されているため、プラットフォーム差異が生じにくい | 〇 システムWebView依存のためTauriと同様の懸念がある（未確認） | 〇 同上（未確認） | ◎ 通常のブラウザ環境と同一 |
| ⑧AIエージェントによる開発しやすさ | 〇 Tauri v2は情報量が急増しており、Claude Code向けのTauri開発スキル・ガイド記事も複数存在。ただしRustのコマンド層はTS単独開発に比べ学習コストが乗る | ◎ JS/TSのみで完結し、AIエージェントの学習データ量・実績が最も豊富。Anthropic自身のClaudeデスクトップアプリも採用（開発効率と保守性が理由と見られる） | △ v3自体がAPI変動中でドキュメント・学習データが少なく、AIエージェントには不利 | △ 情報量が少なくAIエージェントの精度が出にくい可能性 | ◎ 通常のWeb開発と同じ |
| ⑨ライセンス | ◎ MIT/Apache-2.0のデュアルライセンス、商用利用に制約なし | ◎ MIT、商用利用に制約なし | ◎ MIT | ◎ MIT | ◎ 制約なし |

### 2.3 各候補の総評

**Tauri v2**: 最大の狙いである「ローカルLLMへの安定アクセス」と「軽量な配布物」を両立できる。Rustコマンド層の追加とプラットフォーム差異の吸収という追加コストを払う代わりに、軽量性とセキュリティモデル（capabilities/scopeによる明示的な権限管理）を得る設計。

**Electron**: 開発体験・実績・IME等の枯れた安定性では最も手堅い。バンドルサイズ・メモリ効率で劣るが、AIエージェント（Claude Code）にとっての「情報量の多さ」「Rust不要」というアドバンテージは大きい。Anthropic自身がClaudeデスクトップアプリで採用している事実は、この選択の妥当性を裏付ける。

**Wails v3**: Go言語習得コストに加え、2026年8月時点で v3 自体がRC/ベータ段階であり、本番プロダクトの技術基盤として選ぶには時期尚早。v2は安定しているが、開発が今後v3に集約されていく可能性が高く、今から v2 に乗るのは長期的なリスクがある。

**Neutralino.js**: 軽量だが、エコシステム・実績・日本語情報ともに手薄で、複雑なアプリ（React Flowを使うCanvas UI、AI連携）を支える実績が確認できなかった。

**PWA+ブラウザ拡張**: Web版の資産を100%流用できる点は魅力だが、本ADRの出発点である「Ollamaへの安定アクセス」という目的を、CORS/Private Network Access制約により本質的に解決できない。ブラウザ拡張に逃げても審査・配布・保守の複雑さがネイティブアプリ化とほぼ同等かそれ以上になり、メリットが薄い。

---

## 3. 決定

**Tauri v2 を第一候補として採用する。**

評価軸に紐づけた決定理由は以下のとおり。

- **①ローカルHTTPアクセス（最重要ドライバ）**: `tauri-plugin-http` の capabilities/scope 機構により、`http://localhost:11434` のような特定オリジンへのアクセスのみを明示的に許可できる。これはブラウザのCORS制約を受けない一方で、「WebViewから任意の場所に自由にアクセスできてしまう」というElectronのような無制限モデルとも異なり、許可リストを明示するTauriのセキュリティモデルは今回の用途（特定のローカルサービスへのアクセスに限定）に合致する。
- **②既存資産の再利用性**: Vite + React 19 のビルド成果物をそのまま `frontendDist` に指定でき、`mapStore`/`uiStore` などのZustandストア、React Flowベースのキャンバス実装は変更なしで動作させられる見込み。追加が必要なのはOllama通信用のRustコマンド（またはJS側からの`tauri-plugin-http`呼び出し）のみで、コアロジックの共通化という将来目標とも整合する。
- **③バンドルサイズ・メモリ**: Electron比で大幅に軽量。ユーザーのPC環境を問わず配布しやすい。
- **⑧AIエージェントによる開発**: Rust学習コストは追加負担だが、2026年時点でTauri v2向けのAIエージェント開発ガイド・スキルが複数確認でき、Claude Codeでの開発が現実的な水準に達していると判断した。Rustのコマンド層は薄く保つ設計とすることでリスクを抑える。
- **⑨ライセンス**: MIT/Apache-2.0で商用利用に制約なし。

一方、⑥日本語IME・⑦Canvas描画・④コード署名については明確な懸念が残るため、次章で個別に対策を定める。これらは「4. 懸念と対策」で示す回避策により許容範囲に収まると判断したが、対策を講じても実運用で致命的な問題が出た場合は「6. 再検討条件」に従いElectronへの切り替えを検討する。

---

## 4. Tauri を選ぶ場合の具体的懸念と対策

> **#3（日本語IME）と #4（React Flow の描画パフォーマンス）は Phase 34 で解消しました（2026-08-07）。**
> Windows 11 + WebView2 151.0.4129.59 の実機で、ノードのインライン編集・タイトル・AIチャット入力欄での日本語入力（変換・確定）に問題がないこと、
> 大規模マップでも描画が実用範囲であることをユーザーが手動確認済みです。**本 ADR の結論（Tauri v2 採用）を覆す条件には該当しませんでした。**
> macOS（WKWebView）での確認は実機がないため未実施で、#2 とあわせて Phase 36 のクロスプラットフォームビルド時に持ち越します。

| # | 懸念 | 詳細 | 対策 |
|---|---|---|---|
| 1 | Rustツールチェーン導入コスト | 開発者（および開発を担うAIエージェント）がRustに不慣れ。ビルドにはRust本体、Cargo、Windowsでは追加でMSVC Build Toolsが必要 | バックエンドのRustコードは「OllamaへのHTTPプロキシコマンド」「ファイルシステムアクセス」等、薄いラッパーに限定する。ビジネスロジック（プロンプト生成、状態管理等）はすべてTypeScript側（既存の`services/`層）に置き、Rust側にロジックを持ち込まない方針を徹底する。Claude Codeでの開発時は、Tauri公式ドキュメント・コマンド定義パターンをCLAUDE.md（デスクトップ版用）に明記し、毎回のエージェント判断のブレを減らす |
| 2 | WebView2（Windows）/WKWebView（macOS）のレンダリング差異 | WebView2はChromiumベースで自動更新されるが、WKWebViewはmacOSバージョンに紐づき機能差が生じる。CSS/JSの挙動が完全には一致しない | 開発初期からWindows実機とmacOS実機（またはGitHub Actions上のmacOSランナー）の両方でE2E確認を行う。Tailwindの使用機能を「主要ブラウザで広くサポートされる範囲」に留め、最新CSS機能への依存を避ける。Playwrightでの自動テストはあくまで参考値とし、実WebViewでの手動確認を必須工程とする |
| 3 | 日本語IME | Tauri v2でLinux限定のIME変換窓位置ずれの既知issue（#11412）を確認。Windows(WebView2)固有の深刻な既知issueは今回の調査範囲では見つからなかったが、「問題なし」の確証ではなく「未確認」の域を出ない | 開発着手後、最初期のマイルストーンでWindows実機での日本語入力（ノードタイトル・本文編集、AIチャット入力欄など）を重点的に手動テストする。問題が出た場合は、input/textarea要素をネイティブHTML要素のまま保ち、独自IME処理を実装しているコンポーネントがあれば見直す。Linux版の配布は当面計画にないため、Linux固有issueの影響は現時点で許容する |
| 4 | React Flowの描画パフォーマンス | macOS(WKWebView)/Linux(WebKitGTK)でCanvas/CSSフィルターのGPUアクセラレーションが不十分となる既知issueあり。ノード数が多いマップでの描画劣化リスク | React Flowの`onlyRenderVisibleElements`など既存の仮想化設定を確実に有効化する（Web版ですでに導入済みか設計書で確認・未導入なら追加する）。ノードに重いCSSフィルター・box-shadowの多用を避ける。開発後半でノード数の多いテストマップを使い、Windows/macOS双方で体感速度を比較検証する |
| 5 | TauriのCSPと`@anthropic-ai/sdk`のようなfetchベースSDKの扱い | Tauriは既定でCSPを適用し、外部への通信を制限する。`@anthropic-ai/sdk`や将来のOllamaクライアントがfetchを使う際、CSPの`connect-src`および`tauri-plugin-http`のURLスコープの両方で許可設定が必要 | `tauri.conf.json`の`app.security.csp`に`connect-src`として`https://api.anthropic.com`（Claude API）と`http://localhost:11434`（Ollama）を明示的に追加する。加えて`capabilities/*.json`で`tauri-plugin-http`の`http:default`権限に上記URLをglobパターンで登録する。CSPとcapabilitiesの二重管理になる点はチーム内ドキュメント（design.md）に明記し、新しい外部接続先を追加するたびに両方を更新する運用ルールとする |
| 6 | `tauri-plugin-http`によるローカルHTTPアクセス許可設定 | 既定では何も許可されておらず、明示的なオリジン許可が必要 | `capabilities/desktop.json`（仮）に `"http:default"` パーミッションと `"http:allow-fetch"` のスコープとして `http://localhost:11434/*` を登録する。Ollamaのポート番号をユーザーが変更できる設定UIを用意する場合、スコープを動的に広げることはできない（Tauriのスコープはビルド時定義が基本）ため、一般的なOllamaのデフォルトポート＋設定UIで数パターンの候補ポートを許可リストに含める、または`tauri-plugin-http`のランタイムスコープ変更API（利用可能な範囲）を検討する |
| 7 | コード署名なし配布時のSmartScreen/Gatekeeper警告 | Windows: 未署名だとSmartScreenの「発行元不明」警告が出る（実行自体は可能）。macOS: 未署名・未公証だと「Appleが検証できないため開けません」と表示され、実行のハードルがElectronでも同様に高い | 個人開発の初期フェーズでは配布時に警告が出ることを許容し、README/配布ページに「Windows: 詳細情報→実行、macOS: 右クリック→開く、またはターミナルで`xattr -cr`」といった回避手順を明記する。継続的に配布規模が広がる場合は、Windows用OV証明書（年約2〜4万円）とApple Developer Program（年99ドル）への加入を検討する。EV証明書は2024年以降SmartScreenの即時信頼を保証しなくなったため、コストに見合うかは配布規模次第で再検討する |

---

## 5. 却下した選択肢とその理由

| 選択肢 | 却下理由 |
|---|---|
| Electron | 技術的には実績・安定性・IME実績・自動更新の成熟度で最も安全な選択。ただし本プロジェクトの最優先目的である「軽量なローカルLLM連携アプリ」という方向性に対し、バンドルサイズ・メモリ効率で明確に劣る。Anthropic自身が採用しているという事実も検討材料としたが、Claudeデスクトップアプリのように複数OS・大規模チームでの保守性を最優先する状況とは開発体制が異なる（本プロジェクトは個人開発＋AIエージェント中心）ため、今回はTauriを優先。将来的にTauriの懸念（4章）が致命的と判明した場合の代替候補として保持する |
| Wails v3 | 2026年8月時点でv3自体がRC/ベータ段階であり、本番採用のリスクが高い。Go言語の学習コストも追加で発生する。安定版のv2を使う選択肢もあるが、開発リソースが今後v3に集中していく可能性が高く、今からv2に投資するのは長期的に見て得策ではないと判断 |
| Neutralino.js | エコシステム・実績情報が薄く、React Flowのような重いCanvas UIやAI連携を含む複雑なアプリでの採用事例を十分に確認できなかった。軽量さは魅力だが、情報不足によるリスクがTauriの懸念点よりも大きいと判断 |
| PWA + ブラウザ拡張 | 本ADRの出発点である「Ollamaへの安定したローカルHTTPアクセス」を、CORSおよびPrivate Network Access(PNA)の仕様強化により本質的に解決できない。ブラウザ拡張として実装する迂回策もあるが、審査・配布・保守の複雑さがネイティブアプリ化と同等以上になり、デスクトップアプリを新設する動機を弱める |

---

## 6. 結論を覆す可能性のある条件

以下のいずれかが発生した場合、本ADRの決定（Tauri v2採用）を再検討する。

1. **Windows(WebView2)環境で日本語IMEの重大な不具合が実機確認で見つかり、回避策が見当たらない場合。**（本ADRの調査ではWindows固有の深刻な既知issueは確認できなかったが、実運用での再現は別問題であるため）
2. **React Flowの描画パフォーマンスが、想定するノード数（数百〜千規模）でWKWebView/WebView2上で実用に耐えないレベルまで劣化し、最適化を尽くしても改善しない場合。**
3. **`tauri-plugin-http`のCSP/capabilities設定が、ユーザーが任意のOllamaポート・リモートLLMサーバーを設定できるようにする要件と根本的に相容れないことが判明した場合。**（現状はビルド時に許可URLを固定する設計を前提としている）
4. **Rustツールチェーンの導入・保守が、AIエージェント（Claude Code）による開発サイクルを著しく遅延させ、薄いコマンド層に留める方針では吸収しきれないと判明した場合。**
5. **Tauri本体、または依存する主要プラグイン（`tauri-plugin-http`、`tauri-plugin-updater`等）のメンテナンスが停滞・停止した場合。**
6. **配布規模が拡大し、Electronの成熟した自動更新・署名エコシステムの方が総保守コストを下げると判断できるだけの実績データが得られた場合。**

これらに該当する事象が発生した場合、代替候補として2章で比較したElectron（開発効率・実績重視）への切り替えを第一に検討する。

---

## 付録: 主な参照情報源

- [Tauri Ecosystem Releases](https://v2.tauri.app/release/) — Tauri 2.11.5（2026-07-01）等のバージョン情報
- [Tauri 2.0 Stable Release](https://v2.tauri.app/blog/tauri-20/)
- [Electron Releases](https://releases.electronjs.org/) / [Electron endoflife.date](https://endoflife.date/electron)
- [What's New in Wails v3](https://v3.wails.io/whats-new/) — v3のRC/ベータ状況
- [neutralinojs/lib npm](https://www.npmjs.com/package/@neutralinojs/lib)
- [Tauri HTTP Client Plugin](https://v2.tauri.app/plugin/http-client/) / [Capabilities | Tauri](https://v2.tauri.app/security/capabilities/) / [Content Security Policy (CSP) | Tauri](https://v2.tauri.app/security/csp/)
- [Tauri Windows Code Signing](https://v2.tauri.app/distribute/sign/windows/)
- [tauri-apps/tauri Issue #11412](https://github.com/tauri-apps/tauri/issues/11412) — Linux限定のIME窓位置issue
- [tauri-apps/tauri Issue #4891](https://github.com/tauri-apps/tauri/issues/4891) — Canvas/CSSフィルターのGPUアクセラレーション issue
- [React Flow Performance](https://reactflow.dev/learn/advanced-use/performance)
- [Why is Claude an Electron App?](https://www.dbreunig.com/2026/02/21/why-is-claude-an-electron-app.html) — Anthropic自身のClaudeデスクトップアプリの技術選定に関する分析記事
- [Ollama CORS / Private Network Access issue](https://github.com/ollama/ollama/issues/7000)
- [Apple Developer Program 費用（年99ドル）](https://developer.apple.com/macos/distribution/)
- [Windows code signing certificate 価格帯（年200〜500ドル程度）](https://www.ssldragon.com/ssl-certificates/code-signing/)
