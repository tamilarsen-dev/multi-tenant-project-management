import globals from "globals";
import base from "../../eslint.config.js";

export default [
  ...base,
  { languageOptions: { globals: globals.node } },
  {
    // ADR-0009 / architecture.md §7.2: only src/db and *.repository.ts import Prisma
    // (values or types). Services get runInTransaction and Tx from db/transaction.
    files: ["src/**/*.ts"],
    ignores: ["src/db/**", "src/**/*.repository.ts", "src/generated/**", "src/server.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/generated/prisma/**", "@prisma/*", "**/db/client.js"],
              message: "Prisma is only used in src/db and *.repository.ts (ADR-0009).",
            },
          ],
        },
      ],
    },
  },
];
