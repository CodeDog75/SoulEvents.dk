import { createRequire } from "node:module";

process.env.NODE_ENV ??= "production";

const require = createRequire(import.meta.url);
const nextPlugin = require("@next/eslint-plugin-next");
const nextParser = require("eslint-config-next/parser");
const reactPlugin = require("eslint-plugin-react");
const reactHooksPlugin = require("eslint-plugin-react-hooks");
const globals = require("globals");

const jsTsFiles = ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"];
const compatibilityTypescriptPlugin = {
  rules: {
    "no-explicit-any": {
      create() {
        return {};
      },
    },
  },
};

const eslintConfig = [
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
  },
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "dist/**", "build/**", "next-env.d.ts"],
  },
  {
    files: jsTsFiles,
    plugins: {
      "@next/next": nextPlugin,
      "@typescript-eslint": compatibilityTypescriptPlugin,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    languageOptions: {
      parser: nextParser,
      parserOptions: {
        requireConfigFile: false,
        sourceType: "module",
        allowImportExportEverywhere: true,
        babelOptions: {
          presets: ["next/babel"],
          caller: {
            supportsTopLevelAwait: true,
          },
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "react/no-unknown-property": "off",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/jsx-no-target-blank": "off",
    },
  },
];

export default eslintConfig;
