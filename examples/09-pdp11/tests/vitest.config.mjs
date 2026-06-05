import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 180000,   // V6 ブートに時間がかかるため長め
    hookTimeout: 180000,
    globals: false,
    include: ['**/*.test.mjs'],
  },
});
