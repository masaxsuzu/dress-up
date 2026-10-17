# dress-up

自分専用のデジタルワードローブアプリ。写真から服を登録（Gemini VLM で属性抽出）、ギャラリー検索、ゴーストマネキンアイコン生成、TPO ベースのコーデ提案、全身イメージ生成。全て Cloudflare（Workers / D1 / R2 / Access）上で動く。

## クイックスタート

```bash
npm install
npm run db:migrate:local   # ローカル D1 にスキーマ適用
npm run dev                # http://localhost:3000
```

Gemini を使う機能（抽出・提案・画像生成）には `GEMINI_API_KEY` が必要（本番は `wrangler secret put GEMINI_API_KEY`）。

## ワードローブ PDF のメール送信

一覧の「PDF を自分にメール」で、現在の絞り込み結果を写真付き PDF にし、
Cloudflare Access でログインした本人のメールアドレスに添付して送信する。
宛先の入力は不要。ブラウザ側で PDF を生成し、サーバ側が認証メールを宛先に設定する。
送信受付と実際の受信は異なるため、届かない場合は迷惑メールや Cloudflare の送信ログを確認する。

送信は [Cloudflare Email Service](https://developers.cloudflare.com/email-service/get-started/send-emails/)
の `send_email` binding を使う。外部のメールサービスや追加 API キーは不要。
自分のメールを Cloudflare の「確認済み宛先」に登録して使う。
確認済み宛先への送信は全プランで無料で、メールの送信枠にも算入されない
（[料金](https://developers.cloudflare.com/email-service/platform/pricing/)。Worker の実行料金は別）。

本番で有効にする手順:

1. Cloudflare DNS で管理する送信元ドメインで Email Routing を有効にする。
2. サイトにログインするメールアドレスを Email Routing の宛先に追加し、確認メールのリンクで認証する。サイトへのログイン認証とは別に必要。
3. そのドメインの送信元メールアドレスを `EMAIL_FROM` に設定する（例: `wardrobe@自分のドメイン`）。
4. `wrangler.toml` の `send_email` 設定を含めて Worker をデプロイする。

必要な Cloudflare Worker bindings（未設定時は送信せず、設定不足を表示する）:

| Binding | 用途 |
|---|---|
| `WARDROBE_EMAIL` | Cloudflare の `SendEmail` binding。`wrangler.toml` に設定済み |
| `EMAIL_FROM` | Email Routing / Email Service のドメインに属する送信元メールアドレス（表示名を含まないアドレスのみ） |

本番 Worker の `EMAIL_FROM` は `npx wrangler secret put EMAIL_FROM` で設定する。
送信元アドレスは API キーではないが、secret binding として設定すれば再デプロイ後も保持できる。
クラウド開発環境の変数設定だけでは、本番 Worker の bindings は設定されない。
`send_email` は環境間で継承されないため、PR プレビューでメールを有効にしたい場合は
対象 `env.pr-N` にも明示的な設定が必要（現在は本番のトップレベルだけに設定）。

添付 PDF の上限は 10 MB（確認済み宛先の総メール上限 25 MiB に MIME 化後も収まるサイズ）。
メール送信 API は、同一 origin からのリクエストと
Cloudflare Access の認証を必須とするため、Worker の直接 URL も必ず Access で保護する。
ローカル開発の `dev@local` では送信 API を拒否し、binding 自体もローカルシミュレーションにする
（`remote: true` を設定しない）。
E2E はメール送信をモックし、PDF の生成・送信リクエスト・受付表示・失敗後の再試行を検証する。
統合テストではローカル Cloudflare binding による PDF 添付の受付も検証する。外部へ実メールは送らない。

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
