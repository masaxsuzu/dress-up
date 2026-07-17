---
description: PR の diff を fresh-context subagent に judge させ verdict を PR コメント投稿。アプリコード diff のみ対象（CLAUDE.md「PR フロー」参照）。
argument-hint: "<PR number>"
---

# /self-review

3 値判定:
- ✓ clean — auto-merge 有効化へ進める
- ⚠ suspicious — `AskUserQuestion` で user に投げる
- ✗ broken — 同じブランチに修正 push し再レビュー

## 手順

1. `pull_request_read` で get / get_diff / get_files
2. diff がアプリコード（`app/` `lib/` `components/` `schema/` `migrations/`）に触れない場合はここで終了（コメント投稿も不要、スキップした旨だけ報告）
3. **判定は Agent tool の fresh-context subagent（general-purpose）に委譲する** — 実装した本人（メインループ）が採点しない（self-preference バイアス対策）。渡すのは diff・下チェックリスト・「正しさと要件に影響する問題のみ報告し、健全なコードに無理に指摘を作らない」という指示のみ。会話の文脈は渡さない
4. subagent の verdict と根拠をメインループが妥当性確認 → `add_issue_comment` で投稿（下フォーマット）

## チェックリスト (このリポ固有)

**Correctness:** `route()` wrapper 使用 / `user_email` scoping / `process.env` 不使用 / `atob` は valid base64 / Zod schema 変更時は migration & `db.ts:rowToItem` 整合

**Security:** `/api/images` の owner check / multipart upload の content-type & size 上限 / secret 直書き無し

**Tests:** `lib/*.ts` → `test/lib/*` / `app/api/**/route.ts` → `test/api/*` / e2e selector 整合

**Quality:** 規約準拠 (`route()`, shared helpers, factories) / commit message 具体的 / 無関係変更無し / ファイル追加・削除・移動があるのに `docs/codemap.md` 未更新なら suspicious

**Suspicious:** TODO/FIXME 残存 / `.skip`/`.only` / timeout 急増 / `as` 型 assertion 増

## 出力 (PR コメント本文)

```
**Self-review: <verdict>** (commit `<short-sha>`, fresh-context subagent による判定)
Static: <1 文>

[suspicious / broken のみ 1〜3 個の懸念点]
```

## ルール

- deploy 検証は required checks（preview を含む）が担うため、CI の完了を待たずに PR 作成直後に実行してよい
- レビュアには「欠陥を探せ」ではなく「正しさ・要件に影響するもののみ報告」と指示する（過剰指摘バイアス対策）
- verdict コメントは skip 時以外必須投稿
