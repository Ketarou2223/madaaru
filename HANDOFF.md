# HANDOFF.md — Claude向け引き継ぎ（新チャット用）

> 別チャットの Claude にこのアプリを引き継ぐための資料。新しい会話で**これを貼れば文脈が立ち上がる**ことを目指す。
> 規約・詳細は `CLAUDE.md` に、運用手順は `README.md` にある。このファイルは「今どこまで出来ていて、次に何を考えるか」を伝える。
> **最終更新：2026-06-01（段階3-A：タブ下移動・無限ループ・3軸ジェスチャ分離）**

---

## 1行で言うと

消耗品の「次に切れる日」を予測して、切らす前に教えてくれるPWA。Next.js + Neon + Drizzle + Auth.js(Google)。Vercelで本番稼働中（`madaaru.vercel.app`）。

## 芯（ブレさせない）

「正確な在庫管理」ではなく「**切らしたをなくす**」。量は当てなくていい、切れるタイミングだけ当てる。設計思想は「ゼロ入力させず、提案→ユーザーが訂正」。数字を打たせない。

## 現状（できていること）

- Google認証でログイン可能（GitHubから移行済み。GitHubは使わない）。
- 3タブ構成が稼働：**買い物リスト／まだある？（起動時ホーム）／まだ大丈夫**。タブバーは画面下部に移動済み（段階3-A）。タブ列は無限ループ（円環）。3軸ジェスチャ（縦スクロール／カード横振り／タブバー横スワイプ）が物理分離されている。
- 「まだある？」タブで**スワイプ振り分け**：左=買い物リスト、右=3択ポップアップ（たくさんある/ふつう/きれそう）→まだ大丈夫。
- 右で「きれそう」を選んだものは買い物リスト下に**提案**として表示。
- 「まだ大丈夫」タブで**品目削除**：カード右上のゴミ箱→確認ダイアログ→削除（CASCADE で履歴も一括）。
- 「まだ大丈夫」「買い物リスト」の「買った」ボタン → BuyModal（量3択+日付）が**その場に正しく表示**。購入後は買い物リストから正しく消える（同日の `soon` レポートを購入で上書き。`createdAt` タイムスタンプ比較で修正）。
- **Tinder式スワイプ方向プレビュー（段階2完了）**：ドラッグ中にバッジ表示（しきい値前=淡い、超えると強調）。カード微傾き（最大3°）。`lib/swipe-config.ts` に定数集約。
  - まだある？：左=買い物リストへ / 右=まだ大丈夫（既存）
  - まだ大丈夫：左=**無効（段階3で再実装予定）**/ 右=買い物リストへ
  - 買い物リスト：左=買った（即購入、defaultで normal qty + today）/ 右=削除プレビュー（段階3予定）
- `StillOkItem` は `id / name / category / prediction / lastStockLevel` のみ。`lastReportId` は段階3で復活予定のため削除済み。
- **全操作にUndoトースト（5秒）**：左スワイプ・右スワイプ・「買った」・提案追加 → 「元に戻す」で該当行を即削除。`undoReport` / `undoPurchase` server action（所有者チェック付き）。スキーマ変更なし。削除のみ確認ダイアログのまま（Undo なし）。
- **Undo楽観更新**：「元に戻す」押下と同時にローカル状態で画面を戻す（`useOptimistic` の `addBack` アクション）。server action は `startTransition` 内で裏実行。失敗時は `onUndoError` でエラートースト。`UndoConfig` に `onUndoOptimistic?: () => void` を追加。各タブの `useOptimistic` を双方向化（remove/addBack）。
- 予測ロジック（`lib/prediction.ts`）：スパン加重平均、out真値優先、still＋stock_levelで補正、学習中/そこそこ/高めの精度表示。
- PWA：ホーム画面に追加可能。
- DB（Neon）に `items` / `purchases` / `reports`（`stock_level`列あり）+ Auth.jsテーブル。実DBで `purchases.item_id` / `reports.item_id` の ON DELETE CASCADE を確認済み（information_schema で delete_rule = CASCADE）。
- 本番デプロイ済み。Vercel Framework Preset = Next.js（重要：Otherにすると全404）。

## 確定している設計判断（蒸し返さない）

- **Undo 方式**：確認ダイアログではなく即実行＋Undoトースト（5秒）。破壊的な削除のみ確認ダイアログを継続。`undoReport`/`undoPurchase` が失敗した場合はエラートーストを表示（onUndo クロージャが throw → handleUndo で catch → onUndoError → showUndo でメッセージ表示）。「元に戻す」は楽観更新：`UndoToast.handleUndo` が `startTransition` 内で `onUndoOptimistic`（`useOptimistic` dispatch）を呼んでから server action を裏で実行。
- **SwipeCard 設計**：`children` + `leftConfig/rightConfig` を受け取る汎用ジェスチャーラッパー。カード固有の内容（名前・予測・ヒント行）は各タブのコンポーネントで管理。`cardClassName` propでカード背景色をオーバーライド可能。スワイプ方向の設定は `lib/swipe-config.ts` の `SWIPE_ACTIONS` 定数に集約。
- **ポップアップはすべて createPortal(document.body)**：TabShell のタブコンテナが `transform` を持つため、`fixed` 要素はポータル化必須。BuyModal / StockLevelPopup / 削除確認 / UndoToast すべてに適用済み。

- 認証はGoogleのみ。メール認証は当面入れない。
- DBは別プロジェクトにせず1つのNeonで運用（無料枠の都合。元計画はスキーマ相乗りだったが、本アプリは単独構成）。
- スコープ外：プッシュ通知 / Cron / レシートOCR・名寄せ / 家族共有。通知は「アプリ内表示」で当面いく方針。
- 予測係数は `PREDICTION_CONFIG` 等に集約し調整可能に保つ。

## 次に検討しうること（未着手・要相談）

- **段階3**：`items` にピン留め列（`pinned_until` など）を追加し、まだ大丈夫→まだある？の「そろそろ引き上げ」を再実装。同タイミングで買い物リストの右スワイプ削除も完成させる。`swipe-config.ts` の `sorosoro` 設定は再利用予定で残してある。
- 使い込んだ後の予測精度の検証（実データでスパンが妥当か）。
- タブ無限ループの挙動確認（端をまたいでもカクつかないか、ハイライトが正しく切り替わるか）。
- 当たってきたら：購入リンク（アフィリエイト）、家族共有、レシートOCR、プッシュ通知＋Cron。
- いずれも**芯（切らさない一点）を薄めないこと**が判断軸。機能を盛らない。

## 作業時の約束

- `CLAUDE.md` の規約に従う。
- `schema.ts` を変えたら `npm run db:push` が必要、と人間に伝える。
- 環境変数の実値は扱わない／書かない。`.env.local` はコミットしない。
- 構造変更をしたら4資料を同コミットで更新（更新ルールはCLAUDE.md末尾）。
