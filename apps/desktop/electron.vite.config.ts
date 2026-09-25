import { defineConfig } from 'electron-vite';
import { resolve } from 'node:path';

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'electron/main.ts'),
          simulator: resolve(__dirname, 'electron/simulator/entry.ts'),
        },
      },
    },
  },

  preload: {
    build: {
      rollupOptions: {
        input: resolve(
          __dirname,
          'electron/preload.ts',
        ),
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },

  renderer: {
    root: resolve(__dirname),

    build: {
      rollupOptions: {
        input: resolve(
          __dirname,
          'index.html',
        ),
      },
    },
  },
});
