import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Local runs share the machine with other sessions; CI keeps Vitest's default.
    ...(process.env['CI'] === undefined ? { maxWorkers: 3 } : {}),
    projects: [
      'packages/domain',
      'packages/application',
      'packages/contracts',
      'packages/infrastructure',
      'packages/ui',
    ],
  },
});
