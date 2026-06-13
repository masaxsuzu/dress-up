# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Next.js dev server (with Cloudflare bindings via OpenNext shim)
npm run build        # Next.js production build
npm run preview      # Build for Cloudflare + run locally via wrangler dev
npm run deploy       # Build for Cloudflare + deploy via wrangler
npm run cf-typegen   # Regenerate cloudflare-env.d.ts from wrangler.toml bindings

# Tests
npm test                   # vitest (unit, test/lib/**)
npm run test:coverage      # vitest + v8 coverage
npm run test:e2e           # Playwright (e2e/**, mocks AI APIs via page.route)

# D1 migrations
npm run db:migrate:local   # Apply migrations to local D1 (for dev)
npm run db:migrate:remote  # Apply migrations to production D1

# Ad-hoc D1 queries (local)
npm run db:console:local -- "SELECT * FROM clothing_items"
```

There is no lint script yet.

## Architecture

This is a personal digital wardrobe app (dress-up) running entirely on Cloudflare infrastructure. Features: clothing item registration (photo → VLM attribute extraction → D1), gallery with filtering, ghost-mannequin icon generation per item, TPO-based outfit recommendation (or shopping suggestions when the wardrobe is insufficient), and on-demand full-body outfit image generation.

### Cloudflare bindings

All runtime dependencies are Cloudflare bindings, accessed in every route/page via:

```ts
const { env } = await getCloudflareContext({ async: true });
```

| Binding | Type | Purpose |
|---------|------|---------|
| `env.DB` | D1Database | Clothing item metadata (SQLite) |
| `env.IMAGES` | R2Bucket | Uploaded photos (`items/<uuid>.<ext>`) and icons (`icons/<item-id>.<ext>`) |
| `env.GEMINI_API_KEY` | string (secret) | Gemini API key (VLM, recommendation, image generation) |
| `env.PHOTOROOM_API_KEY` | string (optional secret) | Photoroom background removal (upload + icon cutout) |
| `env.ASSETS` | Fetcher | Static asset serving |

**Never use `process.env` for these** — they are Cloudflare bindings, not Node.js env vars. `GEMINI_API_KEY` must be set as a Wrangler secret (`wrangler secret put GEMINI_API_KEY`). `PHOTOROOM_API_KEY` is optional; when unset, background removal is skipped and icon transparency falls back to CSS `mix-blend-mode: multiply`.

### Gemini usage (all via `@google/genai`)

| Use | Model | Where |
|-----|-------|-------|
| Attribute extraction (forced function calling) | `gemini-2.5-flash` | `lib/vlm.ts` |
| Outfit recommendation (multimodal, forced function calling) | `gemini-2.5-pro` | `lib/recommend.ts` |
| Icon generation + full-body outfit image | `gemini-2.5-flash-image` | `lib/outfit-image.ts`, `app/api/items/[id]/iconize/route.ts` (prompts in `lib/icon-prompt.ts`, `lib/outfit-prompt.ts`) |

No retry on Gemini 503/429 — long waits would hit the Worker response deadline and surface as "Load failed" in the browser. Errors return immediately; the user retries via UI buttons.

### API routes

- `POST /api/extract` — multipart image → optional Photoroom cleanup → R2 → VLM extraction. On VLM failure still returns 200 with `extraction: null` (image is kept; user fills the form manually).
- `POST /api/items`, `GET/PATCH/DELETE /api/items/[id]` — CRUD. DELETE also removes the R2 image and icon.
- `POST /api/items/[id]/iconize` — generates a ghost-mannequin icon from the stored photo, saves to R2, sets `icon_key` in D1.
- `POST /api/recommend` — wardrobe + TPO → outfit (`item_ids`) or shopping list (discriminated union `kind`). Hallucinated item ids are filtered out.
- `POST /api/outfit-image` — selected items → full-body outfit image (binary response).
- `GET /api/images/[...key]` — R2 proxy; the frontend never accesses R2 directly.

All error responses have the shape `{ error: string }` (`lib/api-response.ts`). Zod validation failures are flattened into a single readable string.

### Schema source of truth

`schema/clothing.ts` is the single source of truth for all data shapes. It defines layered Zod schemas:

- `VLMExtractionSchema` — what Gemini returns (no imageKey, no timestamps)
- `ClothingItemInputSchema` — extends VLM with `brand`, `notes`, `imageKey` (what the client POSTs)
- `ClothingItemSchema` — extends input with `id`, `iconKey`, `createdAt`, `updatedAt` (what D1 returns)
- `ClothingItemUpdateSchema` — edit form shape (no imageKey)

`schema/recommend.ts` defines the recommendation input/draft shapes. The VLM tool input schema in `lib/vlm.ts` must be kept in sync with `VLMExtractionSchema` manually (it's a plain JSON Schema object for Gemini's function declarations, not derived from Zod).

### D1 serialization

D1 is SQLite. Array fields (`colors`, `season`, `occasion`, `tags`) are stored as JSON strings and parsed in `lib/db.ts:rowToItem`. **Schema backward compatibility is intentionally not maintained** — breaking schema changes require dropping and re-entering data.

### Testing conventions

- Unit tests (`test/lib/**`) mock `@google/genai` (`GoogleGenAI` constructor → `generateContent` mock) and use Miniflare for real D1/R2 behavior.
- E2E tests (`e2e/**`) never call real AI APIs: Gemini-dependent endpoints are mocked with Playwright `page.route()`. The dev server runs with real local D1/R2 bindings.

### Authentication

No auth code exists in the app. The app is protected by Cloudflare Access (Zero Trust) configured externally, with an email allowlist. Do not add auth middleware to the codebase.

### OpenNext / Cloudflare Workers

- `next.config.ts` calls `initOpenNextCloudflareForDev()` to shim Cloudflare bindings during `npm run dev`
- `open-next.config.ts` and `wrangler.toml` configure the Cloudflare Workers deployment
- `wrangler.toml` has `database_id = "REPLACE_ME"` — the real D1 database ID must be substituted before deploying
- CI (`.github/workflows/`) runs unit + e2e on PRs and deploys `main` via wrangler
- `.github/workflows/preview.yml` uploads a preview version to a separate `dress-up-preview` Worker on each PR push; staging D1 / R2 are shared across PRs. One-time setup is in `docs/preview-deployments.md`
