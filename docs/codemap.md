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
| `app/recommend/_components/*.tsx` | 提案ページ専用コンポーネント (下記「機能ごとの colocation」参照) |
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

`recommend` 機能の UI は `app/recommend/_components/` に colocate 済み（下記参照）。他機能から参照されない限りここには置かない。

## lib/ (ロジック。全て unit テスト対象)

| ファイル | 役割 |
|---|---|
| `lib/route-handler.ts` | `route()` ラッパー: env/user/params 抽出 (全 API ルートが使用) |
| `lib/api-response.ts` | `{ error }` 形状の統一レスポンス + `parseJson` |
| `lib/auth.ts` | Cloudflare Access ヘッダから user email 抽出 (`dev@local` フォールバック) |
| `lib/db.ts` | clothing_items の D1 CRUD + `rowToItem` |
| `lib/profile.ts` | profile テーブルの D1 読み書き |
| `lib/r2.ts` | R2 キー生成・アップロード・所有チェック |
| `lib/outfit-layout.ts` | 提案アイテムの main/side 振り分け（**未使用**。どこからも import されていない。削除候補として要判断） |
| `lib/gallery-filters.ts` | ギャラリー絞り込み + URL パラメータ変換 (純粋関数) |
| `lib/stats.ts` | ワードローブ統計の集計 (純粋関数) |
| `lib/labels.ts` | enum → 日本語ラベル + `itemLabel` |
| `lib/season.ts` | 月 → シーズン判定 |
| `lib/sanitize.ts` | ファイル名等のサニタイズ |
| `lib/resize-image.ts` | クライアント側の画像縮小 |
| `lib/export-pdf.ts` | アイテム一覧を写真付き PDF に書き出す (クライアント専用、canvas ラスタライズで日本語描画) |
| `lib/ui.ts` | 共有インラインスタイル定数 |
| `lib/version.ts` | **gitignore 対象・自動生成**。`scripts/generate-version.mjs` が `package.json` の version + git commit sha から書き出す。`APP_VERSION` を export |

## schema/ (Zod、data shape の source of truth)

| ファイル | 役割 |
|---|---|
| `schema/clothing.ts` | 服アイテム (VLM → Input → Item の層構造) |
| `schema/profile.ts` | プロフィール |
| `schema/recommend.ts` | 提案 (リクエスト / draft / Proposal)。ページ/コンポーネント (client) と `_lib` (server) の両方から参照される型契約なので、他の `schema/*` 同様 top-level に置く (feature フォルダには入れない) |

## ファイル配置方針 (Next.js 公式「機能/ルートで分割」戦略)

[Next.js 公式](https://nextjs.org/docs/app/getting-started/project-structure) が挙げる 3 つの整理戦略のうち **「Split project files by feature or route」** を採用する（公式は「正解はない、選んで一貫させよ」という立場）:

> globally shared code is stored at the root of the `app` directory, but context-specific application code is co-located within the directories of the route segments it applies to.

**ルール:**
- **消費元が 1 ルートだけのファイルは、そのルートセグメント配下に colocate する**（`_components/` `_lib/`）。`_` プレフィックスは Next.js の private folder 規約でルーティング対象外になる
- **複数ルートから使われるものだけ**を全体共有として置く
- **テストはソースの隣に置く**（`app/api/extract/_lib/vlm.test.ts` のように）。ルート自体の integration テストは `route.test.ts` としてルートの隣

移行は 3 PR に分割して進行中。**PR1 (このコミット) = API 側**:

| 場所 | 内容 |
|---|---|
| `app/api/extract/_lib/vlm.ts` | 写真 → 属性抽出 (Gemini function calling)。`extract` ルート専用 |
| `app/api/items/[id]/iconize/_lib/icon-prompt.ts` | アイコン化のプロンプト組み立て。`iconize` ルート専用 |
| `app/api/recommend/_lib/*.ts` `app/api/outfit-image/_lib/*.ts` | PR #128 で移動済み |
| `app/api/**/route.test.ts` | 各ルートの integration テスト (旧 `test/api/*.test.ts`) |
| `app/api/**/_lib/*.test.ts` | 各 `_lib` の unit テスト (旧 `test/lib/*.test.ts`) |
| `app/recommend/_components/*.tsx` | 提案ページ専用 UI (PR #128) |

**PR2 (予定)**: ページ側 — route group `app/(home)/` + gallery / stats の colocate
**PR3 (予定)**: 共有コード — `app/_lib/` `app/_components/` への集約 + 残りのテスト colocate

**colocate しないもの:**
- `schema/*` — client と server 双方が参照する型契約。CLAUDE.md のハードルールが参照先として名指ししているため top-level に固定
- `test/helpers/` — 全テストが使う共有テストインフラ (`d1` `r2` `factories` `gemini` `route-runner`)

**colocate に伴う設定側の変更点 (見落とすと壊れる):**
- `vitest.config.ts` — `test.include` に `app/**/*.test.ts` を追加。`coverage.exclude` に `**/*.test.ts` が**必須**（`app/api/**/_lib/**/*.ts` が `_lib/vlm.test.ts` にもマッチしてテスト自身を計測対象にしてしまうため）
- `eslint.config.mjs` — テスト用のルール緩和 override を「置き場所 (`test/**`)」ではなく**ファイル名 (`**/*.test.{ts,tsx}`)** で対象指定するよう変更（colocate 後は `test/**` に当たらなくなり `no-unnecessary-type-assertion` 等で lint が落ちる）

## test/ / e2e/

- `app/**/*.test.ts` — colocate 済みのテスト（上記「ファイル配置方針」参照）
- `test/lib/**` — **未 colocate の共有 lib** の unit（PR3 で移動予定）
- `app/api/extract/_lib/vlm-schema-sync.test.ts` — `vlm.ts` の TOOL_SCHEMA と `schema/clothing.ts` の Zod スキーマの同期検証
- `test/helpers/` / `e2e/helpers.ts` — 共有ヘルパー (`docs/testing.md` 参照)
- `e2e/*.spec.ts` — registration / filter / icons / recommend / api / export-pdf の 6 本

## その他

- `migrations/` — D1 マイグレーション (連番 SQL)
- `wrangler.toml` — 本番 + pr-0〜pr-8 プレビュースロットの bindings
- `.github/workflows/` — ci.yml (`test` ジョブ: lint+unit+e2e、`Build (deploy parity)` ジョブ: OpenNext ビルド) / preview.yml (PR プレビュー) / deploy.yml (main)
- `.github/workflows/codeql.yml` — CodeQL 静的解析 (push/PR to main + 週次)
- `.github/workflows/dependabot-automerge.yml` — Dependabot patch/minor の auto-merge 有効化 (major は対象外)
- `.github/dependabot.yml` — npm / github-actions の週次依存更新
- `scripts/` — プレビュー環境セットアップ・検証、`generate-version.mjs`（`lib/version.ts` 生成、`npm ci` の `prepare` フックと `next.config.ts` から呼ばれる）
