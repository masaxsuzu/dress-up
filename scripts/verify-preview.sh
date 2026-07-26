#!/bin/bash
# preview deploy が「実際に動くか」を curl で叩いて確認する。
#
# 方針:
# - AI を使わない page / API は実際に round-trip まで叩く (登録→取得→削除)。
# - AI を使う endpoint (extract / recommend / iconize / outfit-image) は
#   ページ shell が 200 を返すかだけ確認、API 本体は叩かない (Gemini quota
#   を CI のたびに消費しない & 通常は失敗ハンドリングで握り潰される)。
#
# Cf-Access-Authenticated-User-Email ヘッダを付けない → app は dev@local
# fallback で動く。preview スロットは push のたび reset されてるので、
# 既存データ汚染も気にしなくてよい。
#
# Usage: scripts/verify-preview.sh <preview-url>
set -euo pipefail

URL=${1:?"usage: verify-preview.sh <url>"}
URL=${URL%/}  # strip trailing slash
FAILED=0

pass() { echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; FAILED=$((FAILED+1)); }
section() { echo; echo "== $1 =="; }

check_status() {
  local method="$1" path="$2" expected="$3"
  local actual
  actual=$(curl -sS -o /dev/null -w "%{http_code}" -X "$method" "$URL$path")
  if [ "$actual" = "$expected" ]; then
    pass "$method $path → $actual"
  else
    fail "$method $path → $actual (expected $expected)"
  fi
}

check_body_match() {
  local method="$1" path="$2" pattern="$3" label="$4"
  local body
  body=$(curl -sS -X "$method" "$URL$path")
  if echo "$body" | grep -qE "$pattern"; then
    pass "$label"
  else
    fail "$label (pattern not found: $pattern)"
  fi
}

# ---------------------------------------------------------------------------
# Pages: server-rendered shell が 200 で返ることだけ確認。AI を使うページ
# (/add /recommend) も page mount 時点では AI を呼ばないので 200 でよい。
# ---------------------------------------------------------------------------
section "Pages (HTML shell)"
check_status GET /          200
check_status GET /add       200
check_status GET /profile   200
check_status GET /recommend 200

# /profile はビルド時生成の APP_VERSION (lib/version.ts) を表示する。
# "v" と数値の間に React が hydration 用コメントを挟むため v は含めない。
check_body_match GET /profile '[0-9]+\.[0-9]+\.[0-9]+\+[0-9a-f]{7}' \
  "GET /profile に app version (semver+commit) が表示されている"

# ---------------------------------------------------------------------------
# Read-only APIs (no AI)
# ---------------------------------------------------------------------------
section "Read-only APIs"
check_status GET /api/items              200
check_status GET /api/profile            200
check_status GET /api/recommend/latest   200

# ---------------------------------------------------------------------------
# Mutating APIs (no AI) — upload → register → read → delete の round-trip
#
# imageKey は dummy 文字列では通らない。所有権は「サーバが発行した事実」で
# 決まるため、実際にアップロードして得た key でないと 400 になる
# (app/_lib/uploads.ts)。key を発行するルートのうち /api/extract は Gemini を
# 叩くので、AI を使わない /api/profile/reference-image を使う。prefix は
# 所有判定に関係しないので、得た key をそのままアイテムに使ってよい。
# ---------------------------------------------------------------------------
section "Mutating APIs (upload → register round-trip)"

# 1x1 透明 PNG (e2e/helpers.ts の TINY_PNG と同じバイト列)
TINY_PNG_B64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
tmp_png=$(mktemp /tmp/verify-preview-XXXXXX.png)
trap 'rm -f "$tmp_png"' EXIT
echo "$TINY_PNG_B64" | base64 -d > "$tmp_png"

up=$(curl -sS -X POST -F "file=@${tmp_png};type=image/png" "$URL/api/profile/reference-image")
image_key=$(echo "$up" | jq -r '.imageKey // empty' 2>/dev/null || echo "")
if [ -n "$image_key" ]; then
  pass "POST /api/profile/reference-image → $image_key"
else
  fail "POST /api/profile/reference-image: $up"
fi

if [ -n "$image_key" ]; then
  SAMPLE=$(jq -n --arg k "$image_key" '{category:"tops",subcategory:"verify",colors:[{name:"white",hex:"#ffffff"}],pattern:"solid",material:null,silhouette:null,season:["spring"],formality:2,occasion:[],tags:["__preview_verify__"],brand:null,notes:null,imageKey:$k}')

  resp=$(curl -sS -X POST -H "Content-Type: application/json" -d "$SAMPLE" "$URL/api/items")
  id=$(echo "$resp" | jq -r '.item.id // empty' 2>/dev/null || echo "")
  if [ -n "$id" ]; then
    pass "POST /api/items → id=$id"
  else
    fail "POST /api/items: $resp"
  fi

  if [ -n "$id" ]; then
    check_status GET    "/api/images/$image_key" 200
    check_status GET    "/api/items/$id"         200
    # DELETE は最後の参照を消すので、R2 実体と所有レコードも片付く
    check_status DELETE "/api/items/$id"         204
    check_status GET    "/api/images/$image_key" 404
  fi
fi

# ---------------------------------------------------------------------------
# AI-required endpoints — POST は叩かない (Gemini quota 節約 + 失敗時は
# サーバ側で握って 500 を返すので curl では区別しづらい)
# ---------------------------------------------------------------------------
section "AI-required endpoints (skipped — Gemini quota)"
echo "  - POST /api/extract           (skipped)"
echo "  - POST /api/recommend         (skipped)"
echo "  - POST /api/items/[id]/iconize (skipped)"
echo "  - POST /api/outfit-image      (skipped)"

# ---------------------------------------------------------------------------
section "Result"
if [ $FAILED -eq 0 ]; then
  echo "✓ All checks passed."
  exit 0
else
  echo "✗ $FAILED check(s) failed."
  exit 1
fi
