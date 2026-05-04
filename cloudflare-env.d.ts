// Manual binding types. Regenerate with `npm run cf-typegen` after editing wrangler.toml.
interface CloudflareEnv {
  DB: D1Database;
  IMAGES: R2Bucket;
  ASSETS: Fetcher;
  ANTHROPIC_API_KEY: string;
}
