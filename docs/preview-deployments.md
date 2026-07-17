# PR プレビュー環境

`.github/workflows/preview.yml` が PR push のたびに **同じ `dress-up` Worker に preview バージョンをアップロード**し、PR にコメントで URL を貼る。Worker は 1 つだが、preview バージョンには **PR 番号を 9 で割った余り** (`pr-0` 〜 `pr-8`) で分けた D1 / R2 が紐付くので、同時並行 PR でもデータが混ざらない。Cloudflare D1 無料枠 10 のうち 1 つを本番に使い、残り 9 をプレビューに当てている。

## スロット割当ルール

`slot = PR_NUMBER % 9` (0〜8)

| PR # | Slot | D1 | R2 |
|---|---|---|---|
| 9, 18, 27, ... | `pr-0` | `dress-up-pr-0` | `dress-up-images-pr-0` |
| 1, 10, 19, ... | `pr-1` | `dress-up-pr-1` | `dress-up-images-pr-1` |
| 2, 11, 20, ... | `pr-2` | `dress-up-pr-2` | `dress-up-images-pr-2` |
| ... | ... | ... | ... |
| 8, 17, 26, ... | `pr-8` | `dress-up-pr-8` | `dress-up-images-pr-8` |

**スロット reset**: PR push のたびに、割り当てられたスロットの D1 全テーブルを空にし、R2 全 object を削除してからデプロイする。同じ PR の連続 push でもデータは消える (デバッグ中の手入力データを保つ仕組みは無し)。

**前提**: 同時並行 10 PR 以上は想定していない (個人開発)。

## 初期セットアップ (1 回だけ)

```bash
# 1. 9 個の D1 + R2 をまとめて作る
./scripts/setup-pr-previews.sh

# 2. 出力された 9 個の database_id を wrangler.toml の各 [env.pr-N] に貼り付け
#    (このリポでは PR #63 でセット済み)

# 3. 各スロットにスキーマを当てる (スクリプトの最後にも同じコマンドを案内)
for i in 0 1 2 3 4 5 6 7 8; do
  npx wrangler d1 migrations apply "dress-up-pr-${i}" --remote --env "pr-${i}"
done

# 4. シークレットは Worker 単位 (バージョン単位ではない) なので、本番 deploy.yml
#    が put した GEMINI_API_KEY を preview バージョンも共有する。追加手作業は不要。
```

### Preview URL を有効化 (Cloudflare ダッシュボード側で 1 回)

`wrangler.toml` の `preview_urls = true` だけでは効かないことがある。確実にやるには:

1. [Cloudflare ダッシュボード](https://dash.cloudflare.com) → Workers & Pages → `dress-up`
2. **Settings** → **Domains & Routes** → **Preview URLs** を **Enabled** に
3. 以降の `versions upload` で `Version Preview URL: https://<id>-dress-up.<acct>.workers.dev` が出力される

これを有効化していない場合、CI は Version ID だけを PR にコメントし、URL は手動で構築する必要がある (`https://<version-id>-dress-up.<your-workers-subdomain>.workers.dev`)。
