# まだある？ — 消耗品管理アプリ

「切らさない」ための最小限のアプリ。量を正確に管理するのではなく、**次にいつ切れるか**を予測して教えてくれます。

---

## セットアップ手順

### 1. 環境変数ファイルを作成

```bash
cp .env.local.example .env.local
```

### 2. Neon データベースを作成

1. [neon.tech](https://neon.tech) でアカウント作成 → 新しいプロジェクト作成
2. ダッシュボード左メニュー → **Connection Details** → **Connection string** をコピー
3. `.env.local` の `DATABASE_URL` に貼り付け

### 3. Auth.js シークレットを生成

```bash
npx auth secret
```

出力された値を `.env.local` の `AUTH_SECRET` に貼り付け。

### 4. Google OAuth クライアントを作成

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials** → **OAuth client ID を作成**
2. アプリケーションの種類: **ウェブ アプリケーション**
3. 以下を設定：
   - **承認済みの JavaScript 生成元**: `http://localhost:3000`
   - **承認済みのリダイレクト URI**: `http://localhost:3000/api/auth/callback/google`
4. **クライアント ID** をコピー → `.env.local` の `AUTH_GOOGLE_ID` に貼り付け
5. **クライアント シークレット** をコピー → `.env.local` の `AUTH_GOOGLE_SECRET` に貼り付け

### 5. テーブルを作成

```bash
npm run db:push
```

### 6. ローカル起動

```bash
npm run dev
```

`http://localhost:3000` にアクセスしてログインできれば完了。

---

## Vercel へのデプロイ

### 1. Vercel プロジェクト作成 & Neon 連携

Vercel ダッシュボード → **Add New Project** → GitHub リポジトリを選択

**または** Neon の Vercel Integration（推奨）:
- [vercel.com/integrations/neon](https://vercel.com/integrations/neon) から追加すると `DATABASE_URL` が自動設定される

### 2. Vercel の環境変数に以下を登録

| キー | 値 |
|------|-----|
| `DATABASE_URL` | Neon の接続文字列 |
| `AUTH_SECRET` | `npx auth secret` で生成した値 |
| `AUTH_GOOGLE_ID` | Google OAuth クライアント ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth クライアント シークレット |

### 3. Google OAuth のリダイレクト URI を追加

Google Cloud Console → OAuth クライアントの設定 → **承認済みのリダイレクト URI** に追加:

```
https://your-app.vercel.app/api/auth/callback/google
```

### 4. デプロイ後にテーブルを作成

Vercel 上の環境変数で `DATABASE_URL` を設定したあと、ローカルから `npm run db:push` を実行すると本番 DB にもテーブルが作成されます。

---

## 予測ロジックの調整

`lib/prediction.ts` の `PREDICTION_CONFIG` を編集することで動作を調整できます：

```typescript
export const PREDICTION_CONFIG = {
  QTY_COEFFICIENTS: {
    more: 1.3,    // 多い = 1.3倍長持ち
    normal: 1.0,  // ふつう = 基準
    less: 0.7,    // 少なめ = 0.7倍
  },
  STILL_CORRECTION_FACTOR: 0.1,     // 「まだある」1回で10%延長
  STILL_CORRECTION_MAX_FACTOR: 1.5, // 最大50%延長
}
```

## PWA アイコンについて

`public/icon.svg` はプレースホルダーです。本番では PNG アイコン（192×192、512×512）に差し替えると iOS での表示が改善されます：

1. `public/icon-192.png` と `public/icon-512.png` を作成
2. `app/manifest.ts` の icons 配列はすでに参照済みなのでそのままでOK

---

## スクリプト一覧

| コマンド | 内容 |
|----------|------|
| `npm run dev` | ローカル開発サーバー |
| `npm run build` | プロダクションビルド |
| `npm run db:push` | スキーマをDBに反映（マイグレーションなし） |
| `npm run db:studio` | Drizzle Studio（DB GUI）起動 |
