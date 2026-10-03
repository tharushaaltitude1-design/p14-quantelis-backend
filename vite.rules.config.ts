/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

/**
 * Rules tests only. Deliberately separate from `vite.config.ts` so the emulator-backed suite never
 * runs as part of `npm test`, and so its plain-node environment cannot affect the jsdom app tests.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests-rules/**/*.test.ts'],
    // Each emulator round trip is real I/O; the default 5s would flake on the first cold start.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});