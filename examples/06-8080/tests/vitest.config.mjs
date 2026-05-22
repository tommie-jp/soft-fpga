import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 60000,   // WASM初期化に時間がかかる場合に備えて長めに設定
    hookTimeout: 60000,
    globals: false,
    include: ['**/*.test.mjs'],
  },
});
