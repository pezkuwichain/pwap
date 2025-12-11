import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import hooksPlugin from "eslint-plugin-react-hooks";
import refreshPlugin from "eslint-plugin-react-refresh";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "eslint.config.js",
      "postcss.config.js",
      "public/sdk_docs/**",
      "**/*.cjs",
      "*.cjs",
      "generate-docs-structure.cjs",
      "rebrand-rustdoc.cjs",
    ],
  },
  // Config for Node files
  {
    files: ["vite.config.ts", "tailwind.config.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parser: tseslint.parser,
      parserOptions: {
        project: "tsconfig.node.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Node-specific rules can go here
    },
  },
  // Config for React app files
  {
    files: ["src/**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    plugins: {
      react: pluginReact,
      "react-hooks": hooksPlugin,
      "react-refresh": refreshPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2020,
      },
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        project: "tsconfig.app.json", // Use the app-specific tsconfig
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...hooksPlugin.configs.recommended.rules,
      ...pluginReact.configs.recommended.rules,
      "react-refresh/only-export-components": "warn",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  // Override for UI components and contexts - allow non-component exports
  {
    files: [
      "src/components/ui/**/*.{ts,tsx}",
      "src/contexts/**/*.{ts,tsx}",
      "src/components/theme-provider.tsx",
    ],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  // Global recommended rules
  ...tseslint.configs.recommended
);