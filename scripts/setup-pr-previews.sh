#!/bin/bash
# 一回だけ実行: 9 個の PR preview スロット (pr-0 〜 pr-8) を Cloudflare に作る。
# 出力された database_id を wrangler.toml の各 [[env.pr-N.d1_databases]] の
# database_id に貼り付けること。
#
# 前提: wrangler が cloudflare 認証済 (`wrangler whoami` で確認)。
set -euo pipefail

echo "== Creating 9 preview D1 + R2 slots (pr-0 〜 pr-8) =="
echo "(既に存在しても OK。「already exists」エラーは無視する)"
echo

for i in 0 1 2 3 4 5 6 7 8; do
  echo "---- pr-${i} ----"
  # D1: 新規作成、既存なら 409 を吐く。create の json 出力から id だけ拾う。
  out=$(npx wrangler d1 create "dress-up-pr-${i}" 2>&1 || true)
  id=$(echo "$out" | grep -oE '"database_id": *"[^"]+"' | head -n1 | sed 's/.*"\([^"]*\)"/\1/')
  if [ -n "$id" ]; then
    echo "  D1 id: ${id}"
  else
    # 既存なら d1 list から検索
    id=$(npx wrangler d1 list --json 2>/dev/null | jq -r ".[] | select(.name == \"dress-up-pr-${i}\") | .uuid" | head -n1)
    if [ -n "$id" ]; then
      echo "  D1 (existing): ${id}"
    else
      echo "  D1: id 取得失敗、wrangler の出力を確認:"
      echo "$out" | sed 's/^/    /'
    fi
  fi
  # R2: idempotent (already exists を許容)
  npx wrangler r2 bucket create "dress-up-images-pr-${i}" 2>&1 | grep -v "already exists" || true
  echo
done

echo "== Done =="
echo "次にやること:"
echo "  1. wrangler.toml を開き、各 [[env.pr-N.d1_databases]] の database_id を"
echo "     上で表示された D1 id (9 個、pr-0 〜 pr-8) に置き換える"
echo "  2. 各 D1 にマイグレーションを当てる:"
echo "     for i in 0 1 2 3 4 5 6 7 8; do"
echo "       npx wrangler d1 migrations apply \"dress-up-pr-\${i}\" --remote --env \"pr-\${i}\""
echo "     done"
echo "  3. 変更を commit/push"
