import { defineConfig } from 'electron-vite';
import { resolve } from 'node:path';

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: resolve(
          __dirname,
          'electron/main.ts',
        ),
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
      },
    },
  },

  renderer: {
    root: resolve(__dirname, 'src'),

    build: {
      rollupOptions: {
        input: resolve(
          __dirname,
          'src/index.html',
        ),
      },
    },
  },
});