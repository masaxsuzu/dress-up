# コードマップ

どのファイルを読めばいいかの索引。各ファイル先頭にも 1 行の目的コメントがある。

## app/ (ページ・API ルート)

| ファイル | 役割 |
|---|---|
| `app/page.tsx` | 一覧ページ (D1 から全アイテム取得 → Gallery) |
| `app/add/page.tsx` | 服追加フォーム (アップロード → /api/extract → 確認 → 保存) |
| `app/items/[id]/page.tsx` | アイテム詳細 (属性表・編集/アイコン化/削除ボタン) |
| `app/items/[id]/edit/page.tsx` | 編集フォーム (ClothingForm 再利用) |
| `app/items/[id]/delete-button.tsx` / `iconize-button.tsx` | 詳細ページのクライアントボタン |
| `app/recommend/page.tsx` | コーデ提案ページ (TPO 入力 → 3 案表示、保存提案の復元) |
| `app/profile/page.tsx` | プロフィール設定フォーム |
| `app/stats/page.tsx` | 統計ダッシュボード (server component → StatsView) |
| `app/layout.tsx` | ルートレイアウト (globals.css、BottomNav) |
| `app/globals.css` | ボトムナビ・レスポンシブヘッダの CSS |
| `app/api/**/route.ts` | API ルート — 一覧は `docs/architecture.md` の「API ルート」参照 |

## components/

| ファイル | 役割 |
|---|---|
| `components/gallery.tsx` | 一覧のギャラリービュー (検索/チップ UI + グリッド) |
| `components/clothing-form.tsx` | 追加/編集共通の属性フォーム |
| `components/color-editor.tsx` | カラー配列の編集 UI |
| `components/tag-chip-input.tsx` | タグ・シーン等のチップ入力 |
| `components/add-button.tsx` | 「+ 服を追加」リンクボタン |
| `components/bottom-nav.tsx` | モバイル用ボトムナビ (5 タブ) |
| `components/stats.tsx` | 統計ビュー (集計は lib/stats.ts) |
| `components/recommend/proposal-card.tsx` | 提案 1 案のカード (画像 + 構成 + 説明) |
| `components/recommend/full-body-image.tsx` | 全身画像の生成・表示 (自動 or ボタン) |
| `components/recommend/proposal-item-row.tsx` | 提案内の 1 アイテム行 (所有/買い足し) |

## lib/ (ロジック。全て unit テスト対象)

| ファイル | 役割 |
|---|---|
| `lib/route-handler.ts` | `route()` ラッパー: env/user/params 抽出 (全 API ルートが使用) |
| `lib/api-response.ts` | `{ error }` 形状の統一レスポンス + `parseJson` |
| `lib/auth.ts` | Cloudflare Access ヘッダから user email 抽出 (`dev@local` フォールバック) |
| `lib/db.ts` | clothing_items の D1 CRUD + `rowToItem` |
| `lib/profile.ts` | profile テーブルの D1 読み書き |
| `lib/latest-recommendation.ts` | 提案 draft の保存/取得 |
| `lib/proposal-hydrate.ts` | draft → 現ワードローブで Proposal 復元 |
| `lib/r2.ts` | R2 キー生成・アップロード・所有チェック |
| `lib/vlm.ts` | 写真 → 属性抽出 (Gemini function calling) |
| `lib/recommend.ts` | ワードローブ + TPO → 3 案 (Gemini) |
| `lib/outfit-image.ts` | 全身コーデ画像生成 (Gemini flash-image) |
| `lib/outfit-prompt.ts` / `lib/icon-prompt.ts` | 画像生成プロンプト組み立て |
| `lib/outfit-layout.ts` | 提案アイテムの main/side 振り分け |
| `lib/gallery-filters.ts` | ギャラリー絞り込み + URL パラメータ変換 (純粋関数) |
| `lib/stats.ts` | ワードローブ統計の集計 (純粋関数) |
| `lib/labels.ts` | enum → 日本語ラベル + `itemLabel` |
| `lib/season.ts` | 月 → シーズン判定 |
| `lib/sanitize.ts` | ファイル名等のサニタイズ |
| `lib/resize-image.ts` | クライアント側の画像縮小 |
| `lib/ui.ts` | 共有インラインスタイル定数 |

## schema/ (Zod、data shape の source of truth)

| ファイル | 役割 |
|---|---|
| `schema/clothing.ts` | 服アイテム (VLM → Input → Item の層構造) |
| `schema/profile.ts` | プロフィール |
| `schema/recommend.ts` | 提案 (リクエスト / draft / Proposal) |

## test/ / e2e/

- `test/lib/**` — lib/schema の unit。`test/api/**` — route() 通しの integration
- `test/lib/vlm-schema-sync.test.ts` — `lib/vlm.ts` の TOOL_SCHEMA と `schema/clothing.ts` の Zod スキーマの同期検証
- `test/helpers/` / `e2e/helpers.ts` — 共有ヘルパー (`docs/testing.md` 参照)
- `e2e/*.spec.ts` — registration / filter / icons / recommend / api の 5 本

## その他

- `migrations/` — D1 マイグレーション (連番 SQL)
- `wrangler.toml` — 本番 + pr-0〜pr-8 プレビュースロットの bindings
- `.github/workflows/` — ci.yml (lint+unit+e2e) / preview.yml (PR プレビュー) / deploy.yml (main)
- `.github/workflows/codeql.yml` — CodeQL 静的解析 (push/PR to main + 週次)
- `.github/dependabot.yml` — npm / github-actions の週次依存更新
- `scripts/` — プレビュー環境セットアップ・検証
