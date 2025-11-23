import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node.js environment for backend testing
    environment: 'node',

    // Explicit imports preferred (better IDE support and type checking)
    globals: false,

    // Test patterns
    include: ['**/*.{test,spec}.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],

    // Execution settings
    pool: 'forks',
    fileParallelism: true,

    // Timeouts (generous for API testing)
    testTimeout: 10000,
    hookTimeout: 10000,

    // Mock behavior
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      enabled: false,
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/types/**',
        '**/interfaces/**',
      ],
    },
  },
});
