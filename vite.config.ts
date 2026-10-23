import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  server: { proxy: { "/ws": { target: "ws://localhost:8787", ws: true } } },
});
