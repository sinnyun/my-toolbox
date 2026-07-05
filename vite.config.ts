import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  clearScreen: false,
  build: {
    rollupOptions: {
      external: [/^@tauri-apps\/api/],
    },
  },
  server: {
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : process.env.DISABLE_HMR !== 'true'
        ? undefined
        : false,
    watch: process.env.DISABLE_HMR === 'true' ? null : {
      ignored: ['**/src-tauri/**'],
    },
  },
}));
