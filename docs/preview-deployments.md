# PR プレビュー環境

`.github/workflows/preview.yml` が PR push のたびに **同じ `dress-up` Worker に preview バージョンをアップロード**し、PR にコメントで URL を貼る。Worker は 1 つだが、preview バージョンには `[env.preview]` で指定した別の D1 / R2 が紐付くので本番データは触らない。

## 構成

| | 本番デプロイ | preview バージョン |
|---|---|---|
| Worker | `dress-up` | `dress-up` (同じ) |
| D1 | `dress-up` | `dress-up-preview` (全 PR で共有) |
| R2 | `dress-up-images` | `dress-up-images-preview` (全 PR で共有) |
| トリガ | main への push | PR の opened / synchronize / reopened |
| URL | カスタムドメイン (Cloudflare Access 越し) | `https://<version-id>-dress-up.<acct>.workers.dev` (**保護なし**) |

全 PR で preview リソースを共有しているので、**同時並行 PR ではデータが混ざる**。個人開発スケールでは許容、複数人で使うなら PR ごとに環境を切るほうがよい。

## 初期セットアップ (1 回だけ)

```bash
# 1. preview リソースを作る
wrangler d1 create dress-up-preview
# → 出力された database_id を控える

wrangler r2 bucket create dress-up-images-preview

# 2. wrangler.toml の [env.preview] にある database_id を
#    手順1の database_id に置き換えてコミット (本リポは既設定済み)

# 3. preview D1 にスキーマを当てる
wrangler d1 migrations apply dress-up-preview --remote --env preview

# 4. シークレットは Worker 単位 (バージョン単位ではない) なので、本番
#    deploy.yml が put した GEMINI_API_KEY を preview バージョンも共有する。
#    追加の手作業は不要。
```

### 5. Cloudflare ダッシュボードで Preview URLs を有効化

`wrangler.toml` の `preview_urls = true` だけでは効かないことがある (反映遅延 / 既存 Worker への上書き不可)。確実にやるには:

1. [Cloudflare ダッシュボード](https://dash.cloudflare.com) → Workers & Pages → `dress-up`
2. **Settings** → **Domains & Routes** → **Preview URLs** を **Enabled** に
3. 以降の `versions upload` で `Version Preview URL: https://<id>-dress-up.<acct>.workers.dev` が出力されるようになる

これを有効化していない場合、CI は Version ID だけを PR にコメントし、URL は手動で構築する必要がある (`https://<version-id>-dress-up.<your-workers-subdomain>.workers.dev`)。

## 旧 `dress-up-preview` Worker について

以前のセットアップでは別 Worker (`dress-up-preview`) を作っていたが、Worker 統合により**不要**になった。Cloudflare ダッシュボードから手動で削除してよい (D1 `dress-up-preview` と R2 `dress-up-images-preview` は引き続き使うので削除しない)。

以降は PR を出すたびにワークフローが自動で `versions upload` する。

## 認証

プレビュー URL (`*.workers.dev`) は **Cloudflare Access のポリシーが適用されない**。トレードオフ:

- 簡易: そのまま public で運用。short-lived な PR なので、URL が漏れない限り問題は少ない
- 安全: 本番 `dress-up` の Cloudflare Access App の Application Domains に `*-dress-up.<acct>.workers.dev` を追加して、preview URL も同じ allowlist で守る

## バージョンの掃除

`wrangler versions upload` は Worker の version 履歴に積み続けるが、Cloudflare 側で古い非アクティブ版は自動 prune される。手動掃除は基本不要。
