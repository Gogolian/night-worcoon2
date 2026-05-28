import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

const apiProxy = {
  "/__api": {
    target: "http://localhost:8079",
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 9001,
    open: true,
    proxy: apiProxy,
  },
  preview: {
    port: 9001,
    proxy: apiProxy,
  },
});
