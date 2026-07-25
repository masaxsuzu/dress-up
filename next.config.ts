import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { execSync } from "node:child_process";

// lib/version.ts を現在の HEAD で最新化する (npm ci 時の prepare フックに
// 加えて、コミットをまたいで dev/build するたびに追従させる)。
execSync("node scripts/generate-version.mjs", { stdio: "inherit" });

const nextConfig: NextConfig = {};

initOpenNextCloudflareForDev();

export default nextConfig;
