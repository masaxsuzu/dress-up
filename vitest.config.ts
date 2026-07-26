import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    // テストはソースの隣に colocate する。ソースが置かれうる場所を全て
    // 列挙すること — 取りこぼすとテストが黙って発見されなくなる
    // (schema/ を書き忘れて 8 件が消えた実績あり)。
    include: [
      "app/**/*.test.ts",
      "schema/**/*.test.ts",
      "migrations/**/*.test.ts",
    ],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: [
        // ロジックは全て app 配下の _lib/ に置く (全体共有は app/_lib/、
        // ルート固有は app/<route>/_lib/)。`app/**/_lib/` の ** は 0 段も
        // マッチするので app/_lib/ もこの 1 パターンで拾える。
        "app/**/_lib/**/*.ts",
        "app/api/**/route.ts",
        "schema/**/*.ts",
      ],
      exclude: [
        // colocate したテスト自身を計測対象に含めない
        // (`_lib/**/*.ts` が `_lib/vlm.test.ts` にもマッチするため必須)
        "**/*.test.ts",
        // UI helpers (React only)、static maps はテスト対象外。
        // canvas / createImageBitmap を使うモジュール (resize-image, export-pdf)
        // は test/helpers/browser.ts の fake で unit テスト済みなので除外しない。
        "app/_lib/labels.ts",
        "app/_lib/ui.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});
