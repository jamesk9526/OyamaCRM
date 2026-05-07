import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
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
