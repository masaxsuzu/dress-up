# テスト

```bash
npm test                   # vitest (colocate 済み: app/**/*.test.ts、未移行の共有 lib: test/lib/**)
npm run test:coverage      # vitest + v8 coverage
npm run test:e2e           # Playwright (e2e/**)
```

## 構成

- **Unit** — テストは**ソースの隣**に置く（`app/api/extract/_lib/vlm.test.ts` のように）。未 colocate の共有 `lib/*` と `schema/*` のテストのみ `test/lib/**` に残っている（PR3 で移動予定。`docs/codemap.md`「ファイル配置方針」参照）
- **Integration** (`app/api/**/route.test.ts`) — `route()` を端から端まで（auth ヘッダ → env → handler → Response）。対象ルートの隣に置く
- **E2E** (`e2e/**`) — 実 AI API は呼ばない。Gemini 依存エンドポイントは Playwright `page.route()` でモック。dev サーバはローカル D1/R2 実 bindings で動く

## 共有ヘルパー

### `test/helpers/`（vitest 用）

| Helper | 提供物 |
|--------|-------|
| `factories.ts` | `makeItem()`、`makeItemInput()`、`makeItemUpdate()`、`makeProfile()`、`makeProfileInput()`、`SAMPLE_PROPOSALS`、`ALICE`、`BOB` |
| `d1.ts` | `createTestD1()` → `{ db, reset, dispose }` — 全マイグレーション適用済み Miniflare D1 |
| `r2.ts` | `createTestR2()` → `{ bucket, reset, dispose }` — Miniflare R2 |
| `gemini.ts` | `installGenAIMock()`（`@google/genai` の hoisted `vi.mock`）、`toolCallResponse(name, args)`、`imageResponse(mediaType?, base64?)`（デフォルト `"AAAA"` で `atob` が壊れない） |
| `route-runner.ts` | `setTestEnv({ DB, IMAGES, ... })` + `callRoute(handler, { user?, body?, formData?, params? })` |

### `e2e/helpers.ts`（Playwright 用）

| Export | 用途 |
|--------|-----|
| `TINY_PNG` | 1x1 透明 PNG バッファ（アップロード・画像モック用） |
| `clearItems(request)` | API 経由で全アイテム削除（テスト間の独立性） |

## パターン

```ts
// vitest: beforeAll で D1/R2 作成、afterAll で dispose、beforeEach で reset + setTestEnv
installGenAIMock(); // トップレベル必須 (vi.mock hoisting のため、Gemini を使うモジュールの import より前)

const { extractClothing } = await import("./vlm"); // モック後に dynamic import (colocate 済みなら相対)
```

- Gemini モックは **top-level で `installGenAIMock()`** → 対象モジュールは `await import()` で後から読む
- e2e のセレクタはページ側の `data-testid` / ラベルと同期を保つ（変更時は両方直す）
