import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // API suites share a development database and organization-level runtime
    // settings. Running files concurrently lets one test overwrite another
    // test's configuration, producing false failures and masking real issues.
    fileParallelism: false,
    passWithNoTests: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["app/lib/**/*.ts", "server/src/routes/**/*.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
