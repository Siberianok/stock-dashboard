import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function copyStaticFiles(files) {
  let outDir;
  let rootDir;

  return {
    name: 'copy-static-files',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
      rootDir = config.root;
    },
    closeBundle() {
      if (!outDir || !rootDir) {
        return;
      }

      for (const file of files) {
        const source = resolve(rootDir, file);

        if (!existsSync(source)) {
          continue;
        }

        const destination = resolve(rootDir, outDir, file);
        mkdirSync(dirname(destination), { recursive: true });
        copyFileSync(source, destination);
      }
    },
  };
}

export default defineConfig({
  base: '/stock-dashboard/',
  plugins: [react(), copyStaticFiles(['404.html', '.nojekyll'])],
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
