import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'infrastructure',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
