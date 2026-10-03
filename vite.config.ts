/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    // The Firebase SDK chunk is legitimately large and intentionally isolated. Raising the limit
    // silences the warning for that one case; app-code chunks are still held to the default 500 kB.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // The Firebase SDK (Auth + Storage + Firestore) is a large dependency that changes only
        // when the SDK is upgraded. Splitting it out keeps it in its own long-lived chunk, so an
        // app-code deploy does not force every visitor to re-download it — and it stops the SDK
        // pushing the entry chunk past Vite's 500 kB warning threshold.
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
});
