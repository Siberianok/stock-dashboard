import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const REPO_BASE_PATH = '/stock-dashboard/';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? REPO_BASE_PATH : '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setupTests.js',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: 'coverage',
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80,
    },
  },
}));
