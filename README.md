# dress-up

Personal digital wardrobe app — Cloudflare Workers + Next.js.

[![CI](https://github.com/masaxsuzu/dress-up/actions/workflows/ci.yml/badge.svg)](https://github.com/masaxsuzu/dress-up/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/masaxsuzu/REPLACE_GIST_ID/raw/dress-up-coverage.json)](https://github.com/masaxsuzu/dress-up/actions/workflows/ci.yml)

## Stack

- **Runtime**: Cloudflare Workers (via @opennextjs/cloudflare)
- **Framework**: Next.js 16 App Router
- **Storage**: Cloudflare D1 (SQLite) + R2 (objects)
- **AI**: Google Gemini 2.5 (attribute extraction, outfit recommendation, image generation)
- **Auth**: Cloudflare Access (Zero Trust)

## Development

```bash
npm run dev          # Next.js dev server with Cloudflare bindings
npm run build        # Production build
npm run preview      # Build + local Cloudflare Worker

npm test             # Unit tests (vitest)
npm run test:coverage
npm run test:e2e     # Playwright

npm run db:migrate:local
```

## Coverage badge setup (one-time)

1. Create a public Gist at <https://gist.github.com> with a file named `dress-up-coverage.json` (any content).
2. Copy the Gist ID from the URL (`gist.github.com/masaxsuzu/<ID>`).
3. Create a PAT at <https://github.com/settings/tokens> with **Gist** scope.
4. In this repo → Settings → Secrets → add `GIST_BADGE_TOKEN` = the PAT.
5. In this repo → Settings → Variables → add `COVERAGE_GIST_ID` = the Gist ID.
6. Replace `REPLACE_GIST_ID` in the badge URL above with the real Gist ID.

After the next push to `main` the badge auto-updates on every CI run.
