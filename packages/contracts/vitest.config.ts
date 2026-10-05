import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'contracts',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
