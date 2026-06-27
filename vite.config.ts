import { defineConfig } from "vitest/config";

export default defineConfig({
  publicDir: false,
  build: {
    outDir: "public",
    emptyOutDir: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
