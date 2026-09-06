import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts (whose root is src/client for the app build).
// Tests run from the repo root so both unit and rules suites resolve.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
