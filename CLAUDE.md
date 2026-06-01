# CLAUDE.md — 「まだある？」開発規約

> このファイルは Claude Code が**毎セッションの冒頭で必ず読む**規約。
> アプリの正（ソース・オブ・トゥルース）はコードだが、**設計意図・制約・運用ルールはこのファイルが正**。
> コードと食い違いが出たら、まずこのファイルを疑い、実態に合わせて**このファイルを更新**すること（更新ルールは末尾）。

---

## このアプリは何か（絶対に外さない芯）

**「正確な在庫管理」ではなく「切らしたをなくす」アプリ。** 量を当てる必要はない。**次にいつ切れるか**だけ当たればいい。

設計思想（全機能で一貫）：**ゼロから入力させず、まず提案して、違うところだけユーザーが訂正する。** 数字は極力打たせない。

スコープ外（当面やらない）：プッシュ通知 / Cron / レシートOCR・名寄せ / 家族共有。
→ これらの実装を勝手に始めないこと。やるなら人間に確認してから。

---

## 技術スタック（確定）

- フロント/サーバ：**Next.js（App Router, TypeScript）**。Vercelにデプロイ。
- DB：**Neon（PostgreSQL）**。
- DBアクセス：**Drizzle ORM**。
- 認証：**Auth.js v5（NextAuth）+ Google OAuth のみ**。環境変数は `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`。
  - ※初期はGitHub認証だったが**Googleに完全移行済み**。GitHubプロバイダのコードを復活させないこと。
- PWA：manifest + Service Worker（アプリシェルのキャッシュのみ。プッシュ購読は実装しない）。
- ホスティング設定：Vercel の **Framework Preset = Next.js**（Otherにすると全ページ404になる。変更しないこと）。Root Directory = リポジトリ直下。

---

## 画面構造：3タブ（下タブバー・無限ループ ／ タブバースワイプとタップで移動）

```
[ 買い物リスト ]  ←  [ まだある？（ホーム） ]  →  [ まだ大丈夫 ]  →（循環）
```

### タブ移動（段階3-A〜）

- タブバーは**画面下部**（`height: 3.5rem` + `env(safe-area-inset-bottom)` パディング）。
- **タブ移動方法**：下タブバーのタップ、または下タブバー上での横スワイプ。カードエリアでの横スワイプはカード振り分けのみ（タブ移動に使わない）。
- **無限ループ**：3タブが円環状につながる。端でスワイプすると反対側のタブへ。
  - 実装：物理5パネル方式 `[stillok_clone | shopping | home | stillok | shopping_clone]`。
  - 起動時 `physicalIdx=2`（home）。clone位置(0/4)に到達したら `onTransitionEnd` でジャンプ（transition一瞬無効）。
  - 論理タブIDで管理（`PHYSICAL_LOGICAL` 配列）。インデックス依存なし。
  - **インデックス変更は必ず `goToPhysical(n)` 経由**。`physicalIdxRef.current` をステートより先に同期更新し [0,4] にクランプ。`setPhysicalIdx` を直接呼ばないこと（高速連打で白画面になる）。
  - **パネルとタブバーの完全統合トラック方式**：各スロットは `flex-col`（パネルコンテンツ + そのスロットのタブバー）。strip の `translateX` が両者をまるごと動かすため、別管理・別同期は一切ない。タブバーが transform コンテナ内に入るため `backdrop-blur` は `bg-white`（実色）を使うこと。
  - **タッチ検知は `outerRef`（flex-1 コンテナ）に設置**：タブバー領域の判定は Y 座標チェック `touchY >= window.innerHeight - 56`（h-14）で行う。SwipeCard の native `stopPropagation` がカードタッチを遮断し、Y チェックが第2の防衛線になる。

### ジェスチャ領域の分離（重要）

- **縦** → 各パネルの `overflow-y-auto` でブラウザネイティブスクロール。
- **カード上で横** → SwipeCard（カード振り分け）。`stopPropagation` 済み。
- **下タブバー上で横** → タブ切り替え。TabShell の `tabBarRef` にのみタッチリスナー。
- パネルエリアにタブ切り替えのタッチリスナーは存在しない（物理分離）。

### 各タブの振る舞い

- **まだある？（中央・ホーム）**：予測で「そろそろ切れそう」と判断された品目が自動で並ぶ。仕分けの起点。
  - **左スワイプ → 買い物リストへ**（`reports` に `soon`）→ Undo トースト5秒表示。
  - **右スワイプ → 3択ポップアップ**（たくさんある/ふつう/きれそう）→ `reports` に `still` + `stock_level`。「まだ大丈夫」へ → Undo トースト。
  - 右で「きれそう（`low`）」を選んだものは、**買い物リスト下部に「提案」として薄く表示**。
- **買い物リスト**：買うと確定したもの。「買った」ボタン（詳細入力）または**左スワイプ（即購入、normalのデフォルト）** → `purchases` に記録 → Undo トースト。右スワイプ=削除（段階3で実装予定、現状はプレビューのみ）。提案行の「追加」も Undo 可能。
- **まだ大丈夫**：手元にある所持品一覧。各カードに次に切れそうな日と精度バッジ（学習中/そこそこ/高め）。
  - **左スワイプ →「そろそろ」（まだある？へ）**：**段階3-Bで実装予定・現在無効**。`items` にピン留め列を追加して上書き分類する方式で再実装する。現状は `onSwipeLeft=undefined`（バッジ・色・ヒント不表示、スナップバック）。
  - **右スワイプ →「買い物リストへ」**：`reports` に `soon` 記録 → Undo トースト。
  - 「買った」ボタン → `purchases` 記録 → Undo トースト。
  - 各カード右上のゴミ箱ボタン → 確認ダイアログ → 品目削除（`deleteItem` server action。CASCADE で purchases / reports も一括削除）。削除は Undo 不可。
- **スワイプ方向プレビュー（Tinder式）**：ドラッグ中、カード上に操作名バッジを表示。しきい値（`SWIPE_THRESHOLD = 72px`）未満は淡く、超えたら色濃く強調。カードが微妙に傾く（最大3°）。設定は `lib/swipe-config.ts` に集約。
- **Undo トースト**：操作後5秒間、下タブバーより上に（`bottom: calc(3.5rem + env(safe-area-inset-bottom) + 0.75rem)`）表示。取消 action（`undoReport` / `undoPurchase`）でその操作の挿入行を1件削除。ユーザー所有チェック必須。スキーマ変更なし。
- **ポップアップ共通**：BuyModal / StockLevelPopup / 削除確認ダイアログ / UndoToast はすべて `createPortal(…, document.body)` で描画。TabShell のタブコンテナに `transform` があり `fixed` の基準がずれるため、必ず portal を使うこと。
- **FAB（品目追加）**：`fixed right-6` + `bottom: calc(3.5rem + env(safe-area-inset-bottom) + 1rem)` で下タブバーより上に配置。

---

## データモデル（Drizzle / Postgres）

- Auth.js adapter標準テーブル：`users` / `accounts` / `sessions` / `verification_tokens`
- `items`：id, user_id, name, category, created_at
- `purchases`：id, item_id, purchased_on, qty_tag(more/normal/less), created_at
- `reports`：id, item_id, reported_on, kind(soon/out/still), **stock_level(plenty/normal/low, null許容)**, created_at

全データは `user_id`（またはitem経由）で絞り、他ユーザーのデータが見えないようにすること。

---

## 予測ロジック（`lib/prediction.ts`）

- purchase間隔（スパン）を集計 → 直近重めの加重平均で基準間隔を算出。
- `out`報告があればそれを実際に切れた真値として優先。
- `still`報告で寿命を後ろ倒し。`stock_level`に応じて補正量を変える（plenty=大きめ / normal=標準 / low=ほぼ補正せず＋提案対象）。
- `qty_tag`で購入量を正規化。
- **係数・しきい値は `PREDICTION_CONFIG`（および `STOCK_LEVEL_CORRECTION` / `HOME_TAB_THRESHOLD_DAYS`）に集約**。ロジックを散らさず、ここを触れば調整できる状態を保つ。
- データ不足（スパン0件）では予測を出さず「学習中」。破綻させない。

---

## 主要コマンド

- 開発サーバ：`npm run dev`（→ http://localhost:3000）
- DBスキーマ反映：`npm run db:push`（**schema.tsを変えたら必ず実行**。ローカルと本番が同じ`DATABASE_URL`なら一度で両方反映）
- 本番反映：`git push`（Vercelが自動デプロイ）

---

## 触る時の注意（事故防止）

- **認証・DB接続・PWA設定・Vercelの Framework Preset を壊さない。**
- `schema.ts` を変更したら、コミット前に「`db:push` が必要」と人間に明示すること。
- 環境変数（`DATABASE_URL` / `AUTH_SECRET` / `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`）の**実値をコードやドキュメントに書かない**。`.env.local` は絶対にコミットしない。
- Google OAuth のリダイレクトURIは3つ登録想定（localhost / `madaaru-git-main-...vercel.app` / `madaaru.vercel.app`）。新ドメインが増えたらURI追加が必要、と人間に伝える。

---

## 更新ルール（整合性の維持）

**この4資料（CLAUDE.md / HANDOFF.md / README.md / DOCS_INDEX.md）は常に整合させること。**

1. コードに**構造的変更**（タブ追加、テーブル列変更、認証方式変更、コマンド変更、スコープ変更）を加えたら、**同じコミット内で関連資料を更新**する。
2. 特に CLAUDE.md（規約）と HANDOFF.md（現状）は、実態とズレた瞬間に価値を失う。実装後に必ず差分を反映。
3. 更新したら DOCS_INDEX.md の「最終更新」を直す。
4. 迷ったら、コードを正として資料を直す。資料に合わせてコードを歪めない。
