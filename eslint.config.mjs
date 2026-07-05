// @ts-check
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      ".open-next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      ".claude/**",
      ".wrangler/**",
      "cloudflare-env.d.ts",
      "next-env.d.ts",
      "*.config.{ts,mjs}",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // test/e2e はモック・アサーションの都合上、厳密な null チェックや
    // any の扱いが本番コードほど重要ではないため一部ルールを緩和する。
    files: ["test/**/*.{ts,tsx}", "e2e/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      // Cloudflare Workers 型の `Body.json<T>(): Promise<T>` はデフォルト型引数を
      // 持たないジェネリックのため、`(await res.json()) as X` は tsc 上必須。だが
      // このルールは "as X" が与えるコンテキスト型を使って再検証し「変化なし」と
      // 誤判定する (検証済み: 外すと tsc が TS18046 で落ちる)。test/e2e 全体で
      // このパターンが頻出するため個別 disable ではなくルールごと無効化する。
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
    },
  },
);
