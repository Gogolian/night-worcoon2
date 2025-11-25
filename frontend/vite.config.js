import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 9001,
    open: true,
    proxy: {
      '/__api': {
        target: 'http://localhost:8079',
        changeOrigin: true
      }
    }
  }
});
