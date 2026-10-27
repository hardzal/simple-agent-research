import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/offline.ts"],
    testTimeout: 5000,
  },
});
