# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Loop / babysitter conventions

**Always babysit PRs you open.** Immediately after every successful `mcp__github__create_pull_request` (or any PR creation in this session), call `mcp__github__subscribe_pr_activity` with the same `owner` / `repo` / `pullNumber`. Do NOT ask the user first — this is the default behavior in this repo. After subscribing, set a ~1 hour `ScheduleWakeup` fallback (webhooks miss merge / new-push / conflict transitions) using the `<<autonomous-loop-dynamic>>` sentinel.

When the PR is merged or closed, the subscription is auto-cancelled; do not re-subscribe.

When handling `<github-webhook-activity>` events: tractable + small → fix and push immediately; ambiguous or architecturally significant → ask via `AskUserQuestion`; bot-generated / informational → skip with one-line acknowledgement.

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
| `env.ASSETS` | Fetcher | Static asset serving |

**Never use `process.env` for these** — they are Cloudflare bindings, not Node.js env vars. `GEMINI_API_KEY` must be set as a Wrangler secret (`wrangler secret put GEMINI_API_KEY`).

### Gemini usage (all via `@google/genai`)

| Use | Model | Where |
|-----|-------|-------|
| Attribute extraction (forced function calling) | `gemini-2.5-flash` | `lib/vlm.ts` |
| Outfit recommendation (multimodal, forced function calling) | `gemini-2.5-pro` | `lib/recommend.ts` |
| Icon generation + full-body outfit image | `gemini-2.5-flash-image` | `lib/outfit-image.ts`, `app/api/items/[id]/iconize/route.ts` (prompts in `lib/icon-prompt.ts`, `lib/outfit-prompt.ts`) |

No retry on Gemini 503/429 — long waits would hit the Worker response deadline and surface as "Load failed" in the browser. Errors return immediately; the user retries via UI buttons.

### API route wrapper

Every route handler under `app/api/**` is wrapped by `route()` (`lib/route-handler.ts`). The wrapper auto-extracts `env` (Cloudflare bindings), `user` (from Cloudflare Access header), and awaited `params` so handlers focus on logic.

```ts
// Static route
export const GET = route(async ({ env, user }) => { ... });

// Dynamic route (params is typed)
export const DELETE = route<{ id: string }>(async ({ env, user, params }) => { ... });

// JSON body parsing
const parsed = await parseJson(req, MyZodSchema);
if (!parsed.ok) return parsed.res;  // 400 with { error: string }
// use parsed.data
```

Do NOT call `getCloudflareContext`, `getUserEmail`, or `await args.params` manually inside route bodies — that's the wrapper's job.

### API routes

- `POST /api/extract` — multipart image → R2 → VLM extraction. On VLM failure still returns 200 with `extraction: null` (image is kept; user fills the form manually).
- `POST /api/items`, `GET/PATCH/DELETE /api/items/[id]` — CRUD. DELETE also removes the R2 image and icon.
- `POST /api/items/[id]/iconize` — generates a ghost-mannequin icon from the stored photo, saves to R2, sets `icon_key` in D1.
- `POST /api/recommend` — wardrobe + TPO → 3 proposals (each item is owned/buy mixed). After generating, saves the draft (ids + descriptions only) to `latest_recommendation` for the user.
- `GET /api/recommend/latest` — return the user's last saved recommendation, hydrating owned ids against the current wardrobe (deleted items get a "(アイテムが削除されました)" placeholder).
- `POST /api/outfit-image` — selected items → full-body outfit image (binary response). The user profile (gender, height/weight/body type, reference image) is loaded from D1 and folded into the prompt + a reference inlineData when present.
- `GET/PUT /api/profile` — single-row profile (gender / heightCm / weightKg / bodyType / referenceImageKey). `POST /api/profile/reference-image` (multipart) uploads the reference photo and returns its R2 key.
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

- Unit tests (`test/lib/**`) cover `lib/*` and `schema/*` in isolation. Route handler integration tests live in `test/api/**` and exercise `route()` end to end (auth header → env → handler → Response).
- E2E tests (`e2e/**`) never call real AI APIs: Gemini-dependent endpoints are mocked with Playwright `page.route()`. The dev server runs with real local D1/R2 bindings.

#### Shared test helpers (`test/helpers/`)

Use these instead of duplicating boilerplate:

| Helper | What it gives you |
|--------|-------------------|
| `factories.ts` | `makeItem()`, `makeItemInput()`, `makeItemUpdate()`, `makeProfile()`, `makeProfileInput()`, `SAMPLE_PROPOSALS`, `ALICE`, `BOB` |
| `d1.ts` | `createTestD1()` → `{ db, reset, dispose }` — Miniflare D1 with all migrations applied |
| `r2.ts` | `createTestR2()` → `{ bucket, reset, dispose }` — Miniflare R2 |
| `gemini.ts` | `installGenAIMock()` (hoisted `vi.mock` for `@google/genai`), `toolCallResponse(name, args)`, `imageResponse(mediaType?, base64?)` (default `"AAAA"` so `atob` doesn't blow up) |
| `route-runner.ts` | `setTestEnv({ DB, IMAGES, ... })` + `callRoute(handler, { user?, body?, formData?, params? })` for integration tests against route handlers |

Pattern: `beforeAll` creates D1/R2, `afterAll` disposes, `beforeEach` resets + `setTestEnv(...)`. Top-level `installGenAIMock()` (above any `import` from a Gemini-using module) is required because of `vi.mock` hoisting — use `const { foo } = await import("@/lib/foo")` to load the module after the mock is installed.

### Authentication & multi-tenancy

The app is protected externally by Cloudflare Access (Zero Trust) with an email allowlist — there is no auth middleware in the codebase. Every authenticated request from Access carries the header `Cf-Access-Authenticated-User-Email`. `lib/auth.ts` (`getUserEmail` / `getUserEmailFromHeaders`) extracts and lowercases that email, falling back to `dev@local` when the header is absent (local dev, e2e). All clothing items and profiles are scoped by `user_email`; every D1 query in `lib/db.ts` and `lib/profile.ts` takes the user email as its first non-`db` argument. `GET /api/images/[...key]` also runs an ownership check (`imageKeyOwnedBy`) so users can't read each other's photos by URL guessing.

### OpenNext / Cloudflare Workers

- `next.config.ts` calls `initOpenNextCloudflareForDev()` to shim Cloudflare bindings during `npm run dev`
- `open-next.config.ts` and `wrangler.toml` configure the Cloudflare Workers deployment
- `wrangler.toml` has `database_id = "REPLACE_ME"` — the real D1 database ID must be substituted before deploying
- CI (`.github/workflows/`) runs unit + e2e on PRs and deploys `main` via wrangler
- `.github/workflows/preview.yml` uploads a preview version to the **same `dress-up` Worker** on each PR push (via `wrangler versions upload --env preview`). The `[env.preview]` block keeps the Worker name but swaps the D1 / R2 bindings to `dress-up-preview` / `dress-up-images-preview` so preview versions can't touch production data. One-time setup is in `docs/preview-deployments.md`
