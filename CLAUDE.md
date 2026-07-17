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

- **`process.env` 禁止**（eslint `no-restricted-properties` で強制。例外は `playwright.config.ts` のみ）— `DB`/`IMAGES`/`GEMINI_API_KEY`/`ASSETS` は Cloudflare bindings。API ルートは `route()` ラッパー（`lib/route-handler.ts`）が `env`/`user`/`params` を自動抽出するので、route body 内で `getCloudflareContext`/`getUserEmail`/`await args.params` を手動で呼ばない
- **JSON body は `parseJson(req, ZodSchema)`**、エラーレスポンスは全ルート `{ error: string }`
- **全 D1 クエリは `user_email` でスコープ**（`lib/db.ts`/`lib/profile.ts` の第一非 db 引数）。`/api/images` は owner check 必須
- **Gemini 503/429 でリトライしない**（Worker レスポンス期限のため）。即エラー返却、ユーザが UI で再試行
- **D1 の配列フィールドは JSON 文字列**（`lib/db.ts:rowToItem` でパース）。スキーマ後方互換は取らない
- **`schema/clothing.ts` が data shape の source of truth**。`lib/vlm.ts` の tool 入力 JSON Schema との同期は `test/lib/vlm-schema-sync.test.ts` が CI で検証する
- テストは `test/helpers/` / `e2e/helpers.ts` の共有ヘルパーを使う（重複ボイラープレート禁止）

## モデルティア・ルーティング（コスト最適化）

セッション既定は `claude-sonnet-5`（`.claude/settings.json`）。メインループが**上位モデル（Fable/Opus）で動いている場合**は役割を分離する:

- **メインループ（高価）**: 計画・設計判断・調査のまとめ・self-review・マージ判断・ユーザ対話のみ
- **実行（安価）**: 計画確定後のコード実装・テスト作成・機械的リファクタは Agent tool で `full-stack-developer`（`model: claude-sonnet-5` 指定済み）に委譲する。委譲プロンプトには対象ファイル・期待する変更・検証コマンド（`npx tsc --noEmit` / `npm test`）を明記
- 例外: 数行の trivial な修正は委譲コスト（コンテキスト転送）の方が高いのでメインループが直接行ってよい
- メインループが Sonnet 以下のときは委譲不要（既に安い）

## PR フロー（このリポのデフォルト動作: イベント駆動、ポーリング禁止）

`create_pull_request` 成功直後に同じ PR で:

1. `subscribe_pr_activity`（ユーザに聞かない。red check・レビューコメントは webhook で届く）
2. `/self-review <PR>` — **diff がアプリコード（`app/` `lib/` `components/` `schema/` `migrations/`）に触れる場合のみ**。テスト・docs・設定のみの diff はスキップ
3. verdict `✓ clean`（またはスキップ）→ `enable_pr_auto_merge`（MERGE）。以降は required checks green で GitHub 本体がマージする / `⚠ suspicious` → `AskUserQuestion` / `✗ broken` → fix push → 2 へ
4. **ここでターン終了。`ScheduleWakeup` でのポーリングはしない**（CI 成功の監視とマージ実行は GitHub の仕事）

PR body の `## Test plan` は**作成時点で検証済みの項目のみ、`- [x]` 済みで書く**。CI 項目は required checks が担うため書かない。

**イベント対応（webhook 駆動）:** red check → `get_job_logs` で診断 → 小さく確実に直せる → fix & push（auto-merge は維持され green で自動マージ）/ 曖昧・アーキテクチャに関わる → `AskUserQuestion` / bot 通知 → 一行で流す / merged → 完了報告。ユーザのレビューコメントは常に最優先。

auto-merge が有効化できない場合（リポ設定「Allow auto-merge」無効等）のみ旧手順にフォールバック: check 完了を待って全 `success` を確認 → `merge_pull_request`（`merge_method: "merge"`）。

## Dependabot PR の扱い

**patch / minor は自動**: `dependabot-automerge.yml` が auto-merge を有効化し、required checks（test / Build）green で GitHub 本体がマージする（rebase 待ち・SHA 照合も GitHub 側が処理）。エージェントの出番は以下のみ:

- **check が red の PR**: `/merge-deps` でトリアージ（構造的失敗ならマージ可、依存起因なら修正 or ignore）
- **major bump**: auto-merge 対象外。`/merge-deps` で判断。既知の非互換 major（例: workers-types v5 は wrangler の peerOptional `^4` により `npm ci` が ERESOLVE）は `@dependabot ignore this major version` + 理由コメントでクローズ
- preview は Dependabot PR ではスキップ（secrets 非供給のため、`preview.yml` の `if` 参照）
- CI 設定変更と依存マージが重なる場合は、**設定変更を先にマージして main が green になってから**依存 PR を処理する
