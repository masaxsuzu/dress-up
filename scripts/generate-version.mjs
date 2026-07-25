#!/usr/bin/env node
// app/_lib/version.ts (gitignored) を生成する。npm ci の prepare フックと
// next.config.ts の両方から呼ばれる — 前者は tsc/eslint が動く前の安全網、
// 後者は次コミットへの追従 (npm run dev/build のたびに最新化)。
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
);

let commit = "unknown";
try {
  commit = execSync("git rev-parse --short=7 HEAD", {
    stdio: ["ignore", "pipe", "ignore"],
  })
    .toString()
    .trim();
} catch {
  // .git が無い環境ではフォールバックのまま
}

writeFileSync(
  new URL("../app/_lib/version.ts", import.meta.url),
  `// scripts/generate-version.mjs が生成する。手動編集は次回生成で上書きされる。\nexport const APP_VERSION = "${pkg.version}+${commit}";\n`,
);
