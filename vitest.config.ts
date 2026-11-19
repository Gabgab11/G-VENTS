import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // tsconfig keeps JSX for Next ("preserve"); component tests compile it with the automatic runtime.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    // Design-system tests render components to markup: readable class names from CSS modules.
    css: { include: [/\.module\.css$/], modules: { classNameStrategy: "non-scoped" } },
    // next-intl imports "next/server" without an extension, which Node's ESM loader can't resolve;
    // letting Vitest bundle it resolves the import as Next.js does.
    server: { deps: { inline: ["next-intl"] } },
  },
});
