# テスト

```bash
npm test                   # vitest (unit: test/lib/**, integration: test/api/**)
npm run test:coverage      # vitest + v8 coverage
npm run test:e2e           # Playwright (e2e/**)
```

## 構成

- **Unit** (`test/lib/**`) — `lib/*` と `schema/*` を単体で
- **Integration** (`test/api/**`) — `route()` を端から端まで（auth ヘッダ → env → handler → Response）
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

const { extractAttributes } = await import("@/lib/vlm"); // モック後に dynamic import
```

- Gemini モックは **top-level で `installGenAIMock()`** → 対象モジュールは `await import()` で後から読む
- e2e のセレクタはページ側の `data-testid` / ラベルと同期を保つ（変更時は両方直す）
