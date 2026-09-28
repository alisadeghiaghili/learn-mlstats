import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative base so the production bundle works from any directory (preview,
  // file://, GitHub Pages subpath) without rewriting asset URLs.
  base: "./",
  test: {
    include: ["src/**/*.test.ts"],
  },
});
