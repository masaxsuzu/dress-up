# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ドキュメントマップ（作業前に該当領域のものを読む）

| 対象 | 読む |
|------|-----|
| どのファイルに何があるか (全ファイル 1 行索引) | `docs/codemap.md` |
| アーキテクチャ / bindings / API ルート / スキーマ / 認証 | `docs/architecture.md` |
| テストの書き方・共有ヘルパー | `docs/testing.md` |
| PR プレビュー環境の仕組み・セットアップ | `docs/preview-deployments.md` |

## Commands

```bash
npm run dev                # dev サーバ (OpenNext shim で CF bindings 有効)
npm run build              # production build
npm run preview            # CF ビルド + wrangler dev
npm run deploy             # CF ビルド + wrangler deploy
npm run cf-typegen         # wrangler.toml から cloudflare-env.d.ts 再生成

npm test                   # vitest (unit + integration)
npm run test:e2e           # Playwright (AI API はモック)
npm run lint               # eslint (flat config, type-checked)

npm run db:migrate:local   # ローカル D1 にマイグレーション
npm run db:migrate:remote  # 本番 D1 にマイグレーション
npm run db:console:local -- "SELECT * FROM clothing_items"   # ad-hoc クエリ
```

## ハードルール

- **`process.env` 禁止** — `DB`/`IMAGES`/`GEMINI_API_KEY`/`ASSETS` は Cloudflare bindings。API ルートは `route()` ラッパー（`lib/route-handler.ts`）が `env`/`user`/`params` を自動抽出するので、route body 内で `getCloudflareContext`/`getUserEmail`/`await args.params` を手動で呼ばない
- **JSON body は `parseJson(req, ZodSchema)`**、エラーレスポンスは全ルート `{ error: string }`
- **全 D1 クエリは `user_email` でスコープ**（`lib/db.ts`/`lib/profile.ts` の第一非 db 引数）。`/api/images` は owner check 必須
- **Gemini 503/429 でリトライしない**（Worker レスポンス期限のため）。即エラー返却、ユーザが UI で再試行
- **D1 の配列フィールドは JSON 文字列**（`lib/db.ts:rowToItem` でパース）。スキーマ後方互換は取らない
- **`schema/clothing.ts` が data shape の source of truth**。`lib/vlm.ts` の tool 入力 JSON Schema は手動同期が必要
- テストは `test/helpers/` / `e2e/helpers.ts` の共有ヘルパーを使う（重複ボイラープレート禁止）

## モデルティア・ルーティング（コスト最適化）

セッション既定は `claude-sonnet-5`（`.claude/settings.json`）。メインループが**上位モデル（Fable/Opus）で動いている場合**は役割を分離する:

- **メインループ（高価）**: 計画・設計判断・調査のまとめ・self-review・マージ判断・ユーザ対話のみ
- **実行（安価）**: 計画確定後のコード実装・テスト作成・機械的リファクタは Agent tool で `full-stack-developer`（`model: claude-sonnet-5` 指定済み）に委譲する。委譲プロンプトには対象ファイル・期待する変更・検証コマンド（`npx tsc --noEmit` / `npm test`）を明記
- 例外: 数行の trivial な修正は委譲コスト（コンテキスト転送）の方が高いのでメインループが直接行ってよい
- メインループが Sonnet 以下のときは委譲不要（既に安い）

## PR babysitter（このリポのデフォルト動作）

**PR を作ったら必ず babysit する。** `create_pull_request` 成功直後に同じ owner/repo/pullNumber で `subscribe_pr_activity` を呼ぶ（ユーザに聞かない）。続けて `ScheduleWakeup`（sentinel `<<autonomous-loop-dynamic>>`）を設定:

- **check が in_progress/queued の間: 90s burst**（CI は約 100s。webhook は CI 成功を届けないため）
- **全 check 完了後: 3600s fallback**（merge / push / conflict の取りこぼし用）

各 wake で `pull_request_read` (method=`get_check_runs`) を 1 回だけ呼び、次の delay を決める。タイトループ禁止。PR が merge/close されたら購読は自動解除、再購読しない。

**イベント対応:** 小さく確実に直せる → 即 fix & push / 曖昧・アーキテクチャに関わる → `AskUserQuestion` / bot 通知 → 一行で流す。ユーザのレビューコメントは auto-merge gate より優先。

**Auto-merge gate**（open thread も actionable も無いとき）:

1. `get_check_runs` で全 check `status: completed` を確認（未完なら次の wake まで待つ）
2. 全 check `conclusion: "success"`（失敗は `get_job_logs` で診断 → fix or ask）
3. `/self-review <PR>` を実行。verdict を PR コメントに投稿: `✓ clean` → 次へ / `⚠ suspicious` → `AskUserQuestion` / `✗ broken` → 同ブランチで fix push → step 1 へ
4. PR body の `## Test plan` の `- [ ]` を全て `- [x]` に更新（`update_pull_request`）→ `merge_pull_request`（`merge_method: "merge"`）。head ブランチはリポ設定で自動削除される
