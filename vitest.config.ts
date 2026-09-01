import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    css: false,
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  esbuild: {
    jsx: "automatic",
  },
});
