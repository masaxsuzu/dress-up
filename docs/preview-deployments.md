# PR プレビュー環境

`.github/workflows/preview.yml` が PR push のたびに **同じ `dress-up` Worker に preview バージョンをアップロード**し、PR にコメントで URL を貼る。Worker は 1 つだが、preview バージョンには **PR 番号の下 1 桁** (`pr-0` 〜 `pr-9`) で分けた D1 / R2 が紐付くので、同時並行 PR でもデータが混ざらない。

## スロット割当ルール

| PR # | Slot | D1 | R2 |
|---|---|---|---|
| 1, 11, 21, ... | `pr-1` | `dress-up-pr-1` | `dress-up-images-pr-1` |
| 2, 12, 22, ... | `pr-2` | `dress-up-pr-2` | `dress-up-images-pr-2` |
| ... | ... | ... | ... |
| 10, 20, 30, ... | `pr-0` | `dress-up-pr-0` | `dress-up-images-pr-0` |

**スロット交代時の reset**: 例えば PR #1 が `pr-1` スロットで動いた後に PR #11 が push されると、`pr-1` スロットの D1 全テーブルを空にし、R2 全 object を削除してから PR #11 用にデプロイする (同じ PR が連続 push した場合は reset しない — デバッグ中のデータを保持)。判定は **直近 version の tag が `pr-<同じ PR 番号>` か** で行う。

**前提**: 同時並行 11 PR 以上は想定していない (個人開発)。

## 初期セットアップ (1 回だけ)

```bash
# 1. 10 個の D1 + R2 をまとめて作る
./scripts/setup-pr-previews.sh

# 2. 出力された 10 個の database_id を wrangler.toml の REPLACE_ME_PR_N に貼り付け

# 3. 各スロットにスキーマを当てる (スクリプトの最後にも同じコマンドを案内)
for i in 0 1 2 3 4 5 6 7 8 9; do
  npx wrangler d1 migrations apply "dress-up-pr-${i}" --remote --env "pr-${i}"
done

# 4. 変更を commit / push
git add wrangler.toml && git commit -m "Wire up 10 PR preview slots" && git push

# 5. シークレットは Worker 単位 (バージョン単位ではない) なので、本番 deploy.yml
#    が put した GEMINI_API_KEY を preview バージョンも共有する。追加手作業は不要。
```

### Preview URL を有効化 (Cloudflare ダッシュボード側で 1 回)

`wrangler.toml` の `preview_urls = true` だけでは効かないことがある。確実にやるには:

1. [Cloudflare ダッシュボード](https://dash.cloudflare.com) → Workers & Pages → `dress-up`
2. **Settings** → **Domains & Routes** → **Preview URLs** を **Enabled** に
3. 以降の `versions upload` で `Version Preview URL: https://<id>-dress-up.<acct>.workers.dev` が出力される

これを有効化していない場合、CI は Version ID だけを PR にコメントし、URL は手動で構築する必要がある (`https://<version-id>-dress-up.<your-workers-subdomain>.workers.dev`)。

## 旧 `[env.preview]` ブロックについて

以前は全 PR で `dress-up-preview` D1 / `dress-up-images-preview` R2 を共有していた。per-digit 分離に移行したため、旧 `[env.preview]` ブロックは wrangler.toml から削除済み。共有していた D1 / R2 は Cloudflare ダッシュボードから手動で削除してよい (移行後は誰も触らない)。

## 旧 `dress-up-preview` Worker について

さらに以前は別 Worker (`dress-up-preview`) を作っていたが、Worker 統合により**不要**になった。Cloudflare ダッシュボードから手動で削除してよい。
