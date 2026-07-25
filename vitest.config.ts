import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    // テストはソースの隣に colocate する (app/**)。test/ 配下に残るのは
    // 未 colocate の共有 lib のテストと test/helpers/ のみ。
    include: ["app/**/*.test.ts", "test/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: [
        "lib/**/*.ts",
        "schema/**/*.ts",
        "app/api/**/route.ts",
        // 機能固有 lib は app/api/**/_lib/ に colocate 済み
        "app/api/**/_lib/**/*.ts",
      ],
      exclude: [
        // colocate したテスト自身を計測対象に含めない
        // (`_lib/**/*.ts` が `_lib/vlm.test.ts` にもマッチするため必須)
        "**/*.test.ts",
        // UI helpers (React only), 画像リサイズ (browser canvas)、static maps はテスト対象外。
        "lib/labels.ts",
        "lib/resize-image.ts",
        "lib/ui.ts",
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
