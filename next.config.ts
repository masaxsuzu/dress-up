import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {};

if (process.env.NODE_ENV !== "production") {
  // remoteBindings: false to avoid requiring a wrangler login for the
  // [ai] binding during local dev / CI e2e.
  initOpenNextCloudflareForDev({ remoteBindings: false });
}

export default nextConfig;
