---
description: PR の diff (静的) + CI preview job (deploy 検証済) を judge して verdict を PR コメント投稿。babysitter gate 前段。
argument-hint: "<PR number>"
---

# /self-review

3 値判定:
- ✓ clean — gate を merge へ進める
- ⚠ suspicious — `AskUserQuestion` で user に投げる
- ✗ broken — 同じブランチに修正 push し gate Step 1 へ戻る

## 手順

1. `pull_request_read` で get / get_diff / get_files
2. 下チェックリスト通過 (diff ≤100 行は全読、超なら additions 多いファイル優先)
3. `pull_request_read get_check_runs` で `preview` ジョブ確認: success → deploy verify pass / failure/cancelled/skipped → broken
4. verdict 決定 → `add_issue_comment` で投稿 (下フォーマット)

## チェックリスト (このリポ固有)

**Correctness:** `route()` wrapper 使用 / `user_email` scoping / `process.env` 不使用 / `atob` は valid base64 / Zod schema 変更時は migration & `db.ts:rowToItem` 整合

**Security:** `/api/images` の owner check / multipart upload の content-type & size 上限 / secret 直書き無し

**Tests:** `lib/*.ts` → `test/lib/*` / `app/api/**/route.ts` → `test/api/*` / e2e selector 整合

**Quality:** 規約準拠 (`route()`, shared helpers, factories) / commit message 具体的 / 無関係変更無し

**Suspicious:** TODO/FIXME 残存 / `.skip`/`.only` / timeout 急増 / `as` 型 assertion 増

## 出力 (PR コメント本文)

```
**Self-review: <verdict>** (commit `<short-sha>`)
Static: <1 文>
Deploy: ✓ preview ジョブ green | ✗ preview ジョブ failure

[suspicious / broken のみ 1〜3 個の懸念点]
```

## ルール
- MCP github tool で完結 (skill / agent / Bash 不使用)
- 「他人の PR ならここ指摘するか」目線で甘くしない
- verdict コメント必須投稿
