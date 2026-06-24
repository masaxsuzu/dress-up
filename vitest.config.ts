import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: [
        "lib/**/*.ts",
        "schema/**/*.ts",
        "app/api/**/route.ts",
      ],
      // UI helpers (React only), 画像リサイズ (browser canvas)、static maps はテスト対象外。
      exclude: [
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
