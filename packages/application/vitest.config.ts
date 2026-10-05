import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'application',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
