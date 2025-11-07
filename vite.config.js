import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/stock-dashboard/',
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
});
