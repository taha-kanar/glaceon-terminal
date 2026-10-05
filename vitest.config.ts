import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/domain',
      'packages/application',
      'packages/contracts',
      'packages/infrastructure',
      'packages/ui',
    ],
  },
});
