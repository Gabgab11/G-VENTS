import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import { NOT_YET_TRANSLATED } from "./eslint.i18n-pending.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".open-next/**",
      ".wrangler/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    // Change 3 (FR-22.1): user-visible text lives in messages/, not in components. The admin
    // dashboard stays English (D69). NOT_YET_TRANSLATED lists files whose text moves in I3; it
    // only ever shrinks.
    files: ["src/**/*.tsx"],
    ignores: ["src/app/\\(site\\)/admin/**", ...NOT_YET_TRANSLATED],
    rules: {
      "react/jsx-no-literals": ["error", { noStrings: false, ignoreProps: true, allowedStrings: ["·", "—", "–", "-", "/", "|", "×", "…", "→", "←", "↑", "↓", "%", "+", "*", "(", ")", ":", ",", ".", "!", "?", "&nbsp;", "▾", "✓", "G-vent", "Z", "🌐"] }],
    },
  },
];

export default eslintConfig;
