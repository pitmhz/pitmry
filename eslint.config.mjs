import next from "eslint-config-next/core-web-vitals";
import tsParser from "@typescript-eslint/parser";

// eslint-plugin-react 7.x is incompatible with ESLint 10's flat-config
// context API; the react rules crash the linter. Keep Next + hooks rules.
function withoutReactPlugin(configs) {
  return configs.map((c) => {
    if (!c || typeof c !== "object" || !c.rules || !c.plugins) return c;
    if (!("react" in c.plugins)) return c;
    const { react: _drop, ...plugins } = c.plugins;
    const rules = Object.fromEntries(
      Object.entries(c.rules).filter(([k]) => !k.startsWith("react/"))
    );
    return { ...c, plugins, rules };
  });
}

const config = [
  ...withoutReactPlugin(next),
  {
    // eslint-config-next currently bundles a Babel parser without ESLint 10's
    // scope-manager hook. The maintained TypeScript parser supports both JS
    // and TS and provides the required ESLint 10 API.
    files: ["**/*.{js,jsx,mjs,cjs}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      ".temp/**",
      "server/.retrieval-benchmark-*/**",
      "server/__pycache__/**",
      ".venv/**",
      "components/odysseyui/primitives/**",
    ],
  },
];

export default config;
