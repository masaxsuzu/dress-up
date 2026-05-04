# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Next.js dev server (with Cloudflare bindings via OpenNext shim)
npm run build        # Next.js production build
npm run preview      # Build for Cloudflare + run locally via wrangler dev
npm run deploy       # Build for Cloudflare + deploy via wrangler
npm run cf-typegen   # Regenerate cloudflare-env.d.ts from wrangler.toml bindings

# D1 migrations
npm run db:migrate:local   # Apply migrations to local D1 (for dev)
npm run db:migrate:remote  # Apply migrations to production D1

# Ad-hoc D1 queries (local)
npm run db:console:local -- "SELECT * FROM clothing_items"
```

There is no test suite or lint script yet.

## Architecture

This is a personal digital wardrobe app (dress-up) running entirely on Cloudflare infrastructure. The MVP scope is clothing item registration only: photo upload → Claude VLM attribute extraction → save to D1 → view in gallery.

### Cloudflare bindings

All runtime dependencies are Cloudflare bindings, accessed in every route/page via:

```ts
const { env } = await getCloudflareContext({ async: true });
```

| Binding | Type | Purpose |
|---------|------|---------|
| `env.DB` | D1Database | Clothing item metadata (SQLite) |
| `env.IMAGES` | R2Bucket | Uploaded clothing photos |
| `env.ANTHROPIC_API_KEY` | string (secret) | Claude API key for VLM extraction |
| `env.ASSETS` | Fetcher | Static asset serving |

**Never use `process.env` for these** — they are Cloudflare bindings, not Node.js env vars. `ANTHROPIC_API_KEY` must be set as a Wrangler secret (`wrangler secret put ANTHROPIC_API_KEY`).

### Data flow for item registration

1. `POST /api/extract` — receives a multipart form with the image file, stores it in R2 (`lib/r2.ts:putImage`), then calls `lib/vlm.ts:extractClothing` which sends the image to Claude Haiku via the Anthropic SDK using forced tool use (`extract_clothing_attributes`). Returns `{ imageKey, extraction }`.
2. The client (`app/add/page.tsx`) lets the user review and edit the extracted attributes. If VLM fails, an empty form is shown for manual entry.
3. `POST /api/items` — validates the payload against `ClothingItemInputSchema` (Zod) and inserts into D1.

### Schema source of truth

`schema/clothing.ts` is the single source of truth for all data shapes. It defines three layered Zod schemas:

- `VLMExtractionSchema` — what Claude returns (no imageKey, no timestamps)
- `ClothingItemInputSchema` — extends VLM with `brand`, `notes`, `imageKey` (what the client POSTs)
- `ClothingItemSchema` — extends input with `id`, `createdAt`, `updatedAt` (what D1 returns)

The VLM tool input schema in `lib/vlm.ts` must be kept in sync with `VLMExtractionSchema` manually (it's a plain JSON Schema object for the Anthropic SDK, not derived from Zod).

### D1 serialization

D1 is SQLite. Array fields (`colors`, `season`, `occasion`, `tags`) are stored as JSON strings and parsed in `lib/db.ts:rowToItem`. **Schema backward compatibility is intentionally not maintained** — breaking schema changes require dropping and re-entering data.

### Image serving

Images stored in R2 as `items/<uuid>.<ext>` are proxied through `GET /api/images/[...key]` — the frontend never accesses R2 directly.

### Authentication

No auth code exists in the app. The app is protected by Cloudflare Access (Zero Trust) configured externally, with an email allowlist. Do not add auth middleware to the codebase.

### OpenNext / Cloudflare Pages

- `next.config.ts` calls `initOpenNextCloudflareForDev()` to shim Cloudflare bindings during `npm run dev`
- `open-next.config.ts` and `wrangler.toml` configure the Cloudflare Workers deployment
- `wrangler.toml` has `database_id = "REPLACE_ME"` — the real D1 database ID must be substituted before deploying
