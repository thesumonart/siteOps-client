import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    globals: false,
    restoreMocks: true,
    /*
     * `src/lib/env.ts` validates at import time, so any test that reaches it —
     * directly or through the API client — needs both values present. Next
     * inlines these at build time; under Vitest they are ordinary environment
     * reads. Obvious placeholders: nothing here is real and no test may assert
     * on the values themselves.
     */
    env: {
      NEXT_PUBLIC_API_URL: 'http://localhost:4000',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    },
  },
});
