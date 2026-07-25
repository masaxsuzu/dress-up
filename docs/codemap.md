# コードマップ

どのファイルを読めばいいかの索引。各ファイル先頭にも 1 行の目的コメントがある。

## app/ (ページ・API ルート)

| ファイル | 役割 |
|---|---|
| `app/(home)/page.tsx` | 一覧ページ (D1 から全アイテム取得 → Gallery)。URL は `/`（route group `(home)` は URL に出ない） |
| `app/(home)/_components/gallery.tsx` | 一覧のギャラリービュー (検索/チップ UI + グリッド) |
| `app/(home)/_lib/gallery-filters.ts` | ギャラリー絞り込み + URL パラメータ変換 (純粋関数) |
| `app/(home)/_lib/export-pdf.ts` | アイテム一覧を写真付き PDF に書き出す (クライアント専用、canvas ラスタライズで日本語描画) |
| `app/add/page.tsx` | 服追加フォーム (アップロード → /api/extract → 確認 → 保存) |
| `app/items/[id]/page.tsx` | アイテム詳細 (属性表・編集/アイコン化/削除ボタン) |
| `app/items/[id]/edit/page.tsx` | 編集フォーム (ClothingForm 再利用) |
| `app/items/[id]/delete-button.tsx` / `iconize-button.tsx` | 詳細ページのクライアントボタン |
| `app/recommend/page.tsx` | コーデ提案ページ (TPO 入力 → 3 案表示、保存提案の復元) |
| `app/recommend/_components/*.tsx` | 提案ページ専用コンポーネント |
| `app/profile/page.tsx` | プロフィール設定フォーム |
| `app/stats/page.tsx` | 統計ダッシュボード (server component → StatsView) |
| `app/stats/_components/stats.tsx` | 統計ビュー |
| `app/stats/_lib/stats.ts` | ワードローブ統計の集計 (純粋関数) |
| `app/layout.tsx` | ルートレイアウト (globals.css、BottomNav)。route group の外＝全ルート共通 |
| `app/globals.css` | ボトムナビ・レスポンシブヘッダの CSS |
| `app/api/**/route.ts` | API ルート — 一覧は `docs/architecture.md` の「API ルート」参照 |

## app/_components/ (複数ルートから使う共有 UI)

| ファイル | 役割 |
|---|---|
| `app/_components/clothing-form.tsx` | 追加/編集共通の属性フォーム (add / items/[id]/edit / profile / recommend の 4 ページが使用) |
| `app/_components/color-editor.tsx` | カラー配列の編集 UI (clothing-form の子) |
| `app/_components/tag-chip-input.tsx` | タグ・シーン等のチップ入力 (clothing-form の子) |
| `app/_components/add-button.tsx` | 「+ 服を追加」リンクボタン (home / add / bottom-nav が使用) |
| `app/_components/bottom-nav.tsx` | モバイル用ボトムナビ (5 タブ)。root layout 経由で全ページに出るグローバル UI |

単一ルートしか使わない UI はここには置かず、そのルート配下の `_components/` に colocate する（下記「ファイル配置方針」）。

## app/_lib/ (複数ルートから使う共有ロジック。全て unit テスト対象、テストは隣)

| ファイル | 役割 |
|---|---|
| `app/_lib/route-handler.ts` | `route()` ラッパー: env/user/params 抽出 (全 API ルートが使用) |
| `app/_lib/api-response.ts` | `{ error }` 形状の統一レスポンス + `parseJson` |
| `app/_lib/auth.ts` | Cloudflare Access ヘッダから user email 抽出 (`dev@local` フォールバック) |
| `app/_lib/db.ts` | clothing_items の D1 CRUD + `rowToItem` |
| `app/_lib/profile.ts` | profile テーブルの D1 読み書き |
| `app/_lib/r2.ts` | R2 キー生成・アップロード・所有チェック |
| `app/_lib/outfit-layout.ts` | 提案アイテムの main/side 振り分け（**未使用**。どこからも import されていない。削除候補として要判断） |
| `app/_lib/labels.ts` | enum → 日本語ラベル + `itemLabel` |
| `app/_lib/season.ts` | 月 → シーズン判定 |
| `app/_lib/sanitize.ts` | ファイル名等のサニタイズ (add / items/[id]/edit の 2 ページ) |
| `app/_lib/resize-image.ts` | クライアント側の画像縮小 (add / profile の 2 ページ) |
| `app/_lib/ui.ts` | 共有インラインスタイル定数 |
| `app/_lib/version.ts` | **gitignore 対象・自動生成**。`scripts/generate-version.mjs` が `package.json` の version + git commit sha から書き出す。`APP_VERSION` を export |

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

移行は 3 PR に分割して完了済み（#129 = API 側 / #130 = ページ側 / PR3 = 共有コード集約）。結果として **`lib/` と `components/` は消滅**し、アプリコードは全て `app/` 配下にある。

| 場所 | 内容 |
|---|---|
| `app/_lib/` `app/_components/` | 複数ルートから使う共有ロジック・UI（上記の表） |
| `app/(home)/` `app/stats/` | 一覧・統計ページ一式（`page.tsx` + `_components/` + `_lib/`） |
| `app/recommend/_components/` | 提案ページ専用 UI |
| `app/api/*/\_lib/` | そのルート専用のロジック（extract の vlm、iconize の icon-prompt、recommend、outfit-image） |
| `app/**/*.test.ts` `schema/*.test.ts` | 全テスト（ソースの隣） |

**route group `(home)` を使う理由**: 一覧ページはルートセグメント (`app/page.tsx`) なので、その専用コードを素直に置くと全体共有の `app/_components/` `app/_lib/` と同じ場所になり混ざる。`(home)` で囲むと **URL は `/` のまま**（route group は URL に現れない）で、共有と一覧専用を構造的に分離できる。ビルド出力のルート一覧が移動前後で不変であることを確認済み。

**colocate しないもの:**
- `schema/*` — client と server 双方が参照する型契約。CLAUDE.md のハードルールが参照先として名指ししているため top-level に固定（テストは `schema/clothing.test.ts` として隣に置く）
- `test/helpers/` — 全テストが使う共有テストインフラ (`d1` `r2` `factories` `gemini` `route-runner`)。テストからは `@/test/helpers/...` で参照する（相対パスは移動で壊れるため）

**この移行で実際に踏んだ設定側の罠（同種の移動をするとき必ず確認する）:**
- `vitest.config.ts` の **`test.include`** — ソースを置きうる場所を全部列挙しないと**テストが黙って発見されなくなる**。`schema/**/*.test.ts` を書き忘れて 8 件が消えた（テスト件数を移動前と突き合わせて発覚）
- `vitest.config.ts` の **`coverage.include`** — 移動先を足し忘れると**カバレッジから静かに漏れて数値が上がる**。ページ側 `_lib` の漏れで 81%→98% に「改善」した（数値が良くなったら疑う）
- `vitest.config.ts` の **`coverage.exclude`** — `**/*.test.ts` が必須。`_lib/**/*.ts` は `_lib/vlm.test.ts` にもマッチするのでテスト自身が計測対象になる
- `eslint.config.mjs` — テスト用のルール緩和 override を「置き場所 (`test/**`)」ではなく**ファイル名 (`**/*.test.{ts,tsx}`)** で指定する。置き場所基準だと colocate した瞬間に外れて lint が落ちる（92 errors で発覚）
- `.gitignore` / `scripts/generate-version.mjs` — 生成物 `version.ts` の出力先とignore パスの両方を追従させる

## test/ / e2e/

- `app/**/*.test.ts` / `schema/*.test.ts` — 全テストはソースの隣（上記「ファイル配置方針」参照）。ルートの integration テストは `route.test.ts`
- `app/api/extract/_lib/vlm-schema-sync.test.ts` — `vlm.ts` の TOOL_SCHEMA と `schema/clothing.ts` の Zod スキーマの同期検証
- `test/helpers/` / `e2e/helpers.ts` — 共有ヘルパー (`docs/testing.md` 参照)。`test/` 配下に残るのはこれだけ
- `e2e/*.spec.ts` — registration / filter / icons / recommend / api / export-pdf の 6 本

## その他

- `migrations/` — D1 マイグレーション (連番 SQL)
- `wrangler.toml` — 本番 + pr-0〜pr-8 プレビュースロットの bindings
- `.github/workflows/` — ci.yml (`test` ジョブ: lint+unit+e2e、`Build (deploy parity)` ジョブ: OpenNext ビルド) / preview.yml (PR プレビュー) / deploy.yml (main)
- `.github/workflows/codeql.yml` — CodeQL 静的解析 (push/PR to main + 週次)
- `.github/workflows/dependabot-automerge.yml` — Dependabot patch/minor の auto-merge 有効化 (major は対象外)
- `.github/dependabot.yml` — npm / github-actions の週次依存更新
- `scripts/` — プレビュー環境セットアップ・検証、`generate-version.mjs`（`app/_lib/version.ts` 生成、`npm ci` の `prepare` フックと `next.config.ts` から呼ばれる）
