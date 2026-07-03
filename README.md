# dress-up

自分専用のデジタルワードローブアプリ。写真から服を登録（Gemini VLM で属性抽出）、ギャラリー検索、ゴーストマネキンアイコン生成、TPO ベースのコーデ提案、全身イメージ生成。全て Cloudflare（Workers / D1 / R2 / Access）上で動く。

## クイックスタート

```bash
npm install
npm run db:migrate:local   # ローカル D1 にスキーマ適用
npm run dev                # http://localhost:3000
```

Gemini を使う機能（抽出・提案・画像生成）には `GEMINI_API_KEY` が必要（本番は `wrangler secret put GEMINI_API_KEY`）。

## テスト

```bash
npm test           # unit + integration (vitest)
npm run test:e2e   # e2e (Playwright、AI API はモック)
```

## ドキュメント

| ドキュメント | 内容 |
|---|---|
| [docs/architecture.md](docs/architecture.md) | 機能・技術スタック・API・スキーマ・認証・設計判断 |
| [docs/testing.md](docs/testing.md) | テスト構成と共有ヘルパー |
| [docs/preview-deployments.md](docs/preview-deployments.md) | PR プレビュー環境（スロット式 D1/R2） |
| [CLAUDE.md](CLAUDE.md) | Claude Code 向け運用ルール |

## デプロイ

`main` への push で CI が wrangler デプロイ。PR は同一 Worker のプレビューバージョン（PR 番号 % 9 のスロットに専用 D1/R2）が自動で立つ。
