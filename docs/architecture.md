# アーキテクチャ

自分専用のデジタルワードローブアプリ。全て Cloudflare 上で動く（Workers / D1 / R2 / Access、無料枠内）。

## 機能

1. 写真から服を登録（VLM で属性抽出 → ユーザ確認・編集 → 保存）
2. 一覧・検索（カテゴリ / シーズン / フリーテキスト / URL パラメータ絞り込み）
3. アイテムのアイコン化（ゴーストマネキン風サムネイル生成）
4. TPO ベースのコーデ提案（不足アイテムは買い足し提案）
5. 提案からの全身イメージ生成（新規提案は自動、保存提案の見返しはボタン）
6. 最新提案 1 セットを D1 に保存し `/recommend` 再訪時に復元
7. プロフィール（性別・身長・体重・体型・参考画像）を提案と画像生成に反映
8. 統計ダッシュボード（`/stats`）、モバイルはボトムナビゲーション

## 技術スタック

| 層 | 採用 |
|---|---|
| フロント | Next.js 16 App Router |
| ランタイム | Cloudflare Workers（@opennextjs/cloudflare 経由） |
| DB | D1（SQLite） |
| 画像 | R2 |
| 認証 | Cloudflare Access（Zero Trust、email allowlist） |
| AI | Gemini（@google/genai） |

## Cloudflare bindings

全ルート/ページで `route()` ラッパー経由（API）または `getCloudflareContext({ async: true })`（ページ）で取得。

| Binding | 型 | 用途 |
|---------|----|------|
| `env.DB` | D1Database | 服メタデータ |
| `env.IMAGES` | R2Bucket | 写真 `items/<uuid>.<ext>`、アイコン `icons/<item-id>.<ext>` |
| `env.GEMINI_API_KEY` | secret | Gemini API キー（`wrangler secret put` で設定） |
| `env.ASSETS` | Fetcher | 静的アセット |

## Gemini 使い分け

| 用途 | モデル | 場所 |
|-----|-------|------|
| 属性抽出（forced function calling） | `gemini-2.5-flash` | `lib/vlm.ts` |
| コーデ提案（マルチモーダル + forced function calling） | `gemini-2.5-pro` | `lib/recommend.ts` |
| アイコン生成・全身イメージ | `gemini-2.5-flash-image` | `lib/outfit-image.ts`、`app/api/items/[id]/iconize/route.ts`（プロンプトは `lib/icon-prompt.ts` / `lib/outfit-prompt.ts`） |

## API ルート

- `POST /api/extract` — multipart 画像 → R2 → VLM 抽出。VLM 失敗でも 200 + `extraction: null`（画像は保持、手動入力へ）
- `POST /api/items`、`GET/PATCH/DELETE /api/items/[id]` — CRUD。DELETE は R2 の画像・アイコンも削除
- `POST /api/items/[id]/iconize` — ゴーストマネキンアイコン生成 → R2 保存 → `icon_key` 更新
- `POST /api/recommend` — ワードローブ + TPO → 3 案。生成後 draft（ids + descriptions）を `latest_recommendation` に保存
- `GET /api/recommend/latest` — 保存済み提案を現在のワードローブで hydrate（削除済みは「(アイテムが削除されました)」）
- `POST /api/outfit-image` — 選択アイテム → 全身イメージ（バイナリ）。プロフィールをプロンプトに折込み
- `GET/PUT /api/profile`、`POST /api/profile/reference-image` — プロフィール（1 ユーザ 1 行）
- `GET /api/images/[...key]` — R2 プロキシ（owner check 付き。フロントは R2 に直接触らない）

エラーレスポンスは全ルート `{ error: string }`（`lib/api-response.ts`）。Zod エラーは 1 つの可読文字列に flatten。

## スキーマ（`schema/` が source of truth）

`schema/clothing.ts` のレイヤー構造:

- `VLMExtractionSchema` — Gemini が返す形（imageKey・timestamps なし）
- `ClothingItemInputSchema` — VLM + `brand`/`notes`/`imageKey`（クライアントが POST する形）
- `ClothingItemSchema` — Input + `id`/`iconKey`/`createdAt`/`updatedAt`（D1 が返す形）
- `ClothingItemUpdateSchema` — 編集フォーム（imageKey なし）

`schema/recommend.ts` が提案の input/draft 形。`lib/vlm.ts` の tool 入力 JSON Schema は `VLMExtractionSchema` と**手動で**同期（Zod から自動導出していない）。

## D1 シリアライズ

配列フィールド（`colors`/`season`/`occasion`/`tags`）は JSON 文字列で保存し `lib/db.ts:rowToItem` でパース。**スキーマ後方互換は取らない** — 破壊的変更時はデータを drop して再登録。

## 認証・マルチテナント

- 認証コードはリポジトリに 1 行もない。Cloudflare Access が外側で守る（email allowlist）
- Access が付与する `Cf-Access-Authenticated-User-Email` ヘッダを `lib/auth.ts` が抽出・小文字化。ヘッダ無し（ローカル/E2E）は `dev@local` にフォールバック
- 全アイテム・プロフィールは `user_email` でスコープ。`lib/db.ts` / `lib/profile.ts` の全クエリは user email を第一引数（`db` の次）に取る
- `GET /api/images/[...key]` は `imageKeyOwnedBy` で所有チェック（URL 推測対策）

## 設計判断

- **Gemini 503/429 でリトライしない** — Worker のレスポンス期限に引っかかりブラウザで "Load failed" になるため即エラー返却。ユーザが UI ボタンで再試行
- **VLM 失敗時も画像は残す** — 空フォームで手動入力可能に
- **画像配信は必ず `/api/images` 経由** — R2 直アクセスなし

## OpenNext / デプロイ

- `next.config.ts` の `initOpenNextCloudflareForDev()` が `npm run dev` 中の bindings をシム
- `open-next.config.ts` + `wrangler.toml` が Workers デプロイ設定
- CI（`.github/workflows/`）: PR で unit + e2e、`main` は wrangler でデプロイ
- PR プレビュー: `preview.yml` が同一 `dress-up` Worker にプレビューバージョンをアップロード。PR 番号 % 9 のスロット（`pr-0`〜`pr-8`）ごとに専用 D1/R2 が付くので本番・並行 PR とデータが混ざらない。詳細は `docs/preview-deployments.md`
