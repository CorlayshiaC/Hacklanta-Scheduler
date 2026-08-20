import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const config = [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    // Agent 6 is the only owner of the Gemini SDK import: src/lib/ai/ is the one place in the
    // repo allowed to call it directly, everyone else goes through its typed exports (which are
    // themselves "server-only" and hard-fail if bundled client-side). See docs/contracts/ai.md.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/ai/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "@google/genai", message: "Import Gemini only from src/lib/ai/. See docs/contracts/ai.md." }],
        },
      ],
    },
  },
];

export default config;
