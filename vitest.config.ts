import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // `packages/*` entra porque la lógica pura de @sfs/db también se
    // testea; los scripts del paquete (migrate, seed) no son importables,
    // así que lo que vale la pena cubrir se extrae a módulos sin efectos.
    include: ["src/**/*.test.{ts,tsx}", "packages/*/src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
