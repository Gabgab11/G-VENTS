import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // next-intl imports "next/server" without an extension, which Node's ESM loader can't resolve;
    // letting Vitest bundle it resolves the import as Next.js does.
    server: { deps: { inline: ["next-intl"] } },
  },
});
