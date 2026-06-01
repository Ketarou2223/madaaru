# まだある？ — 運用メモ（人間用）

> 自分が後で見返すための実務メモ。「どうやって動かす」「詰まったらどこを見る」をまとめる。
> 開発の規約はAI用の `CLAUDE.md`、新チャットへの引き継ぎは `HANDOFF.md`。
> **最終更新：2026-05-31**

---

## これは何

消耗品が切れる前に教えてくれるアプリ。本番URL：**https://madaaru.vercel.app**
スマホで開いて「ホーム画面に追加」するとアプリみたいに使える（PWA）。

## 構成（ざっくり）

- アプリ本体（画面＋裏の処理）＝ **Vercel** で動いてる。
- データの保管＝ **Neon**（PostgreSQLデータベース）。
- ログイン＝ **Google**。
- コード置き場＝ GitHub（`Ketarou2223/madaaru`）。`git push` するとVercelが自動で再デプロイ。

## 日常の使い方

1. 品目を追加（右下の＋）。
2. 買ったら「買った」。減ってきたら「まだある？」タブにカードが出る。
3. カードを**左スワイプ＝買う**／**右スワイプ＝まだ大丈夫**（→ たくさん/ふつう/きれそう を選ぶ）。
4. 「きれそう」にしたものは買い物リスト下に提案として出る。

## 開発で触るとき

```bash
# 開発サーバを立てる（手元で確認）
npm run dev          # → http://localhost:3000

# DBの構造を変えたら反映（schema を変えた後だけ）
npm run db:push

# 本番に反映
git add .
git commit -m "変更内容"
git push             # Vercelが自動でデプロイ
```

## 環境変数（4つ）

`.env.local`（手元）と Vercel の Environment Variables（本番）の両方に、同じ値で入っている：

- `DATABASE_URL` … Neonの接続文字列
- `AUTH_SECRET` … セッション用の秘密鍵
- `AUTH_GOOGLE_ID` … GoogleのクライアントID
- `AUTH_GOOGLE_SECRET` … Googleのクライアントシークレット

※ `.env.local` は**GitHubに上げない**（`.gitignore`で除外済み）。値はここにも書かない。

## 詰まったときの早見表

| 症状 | 多い原因 | 見るところ |
|---|---|---|
| 本番が全部404 | Vercelの Framework Preset が Other | Vercel → Settings → Build and Deployment → **Next.js**にしてRedeploy |
| ログインで `redirect_uri_mismatch` | 開いてるドメインのURIがGoogle未登録 | Google Cloud Console → クライアント → リダイレクトURIに `https://(そのドメイン)/api/auth/callback/google` を追加 |
| db:push が `injected env (0)` | `.env.local` が読めてない/空 | `.env.local` の `DATABASE_URL` 行があるか、`=`前後にスペースが無いか |
| 右スワイプで残量保存時にエラー | `stock_level`列が未反映 | `npm run db:push` を実行 |

## Google OAuth に登録済みのリダイレクトURI（3つ）

- `http://localhost:3000/api/auth/callback/google`
- `https://madaaru-git-main-ketarou2223s-projects.vercel.app/api/auth/callback/google`
- `https://madaaru.vercel.app/api/auth/callback/google`

→ 新しいドメインでアクセスするなら、その形でURIを追加する。

## お金まわり

- Vercel / Neon / Google ともに無料枠で運用中。新規課金しない方針。
- Neonは無アクセスが続くと自動でスリープ（次アクセスで復帰）。自分用なら問題なし。
