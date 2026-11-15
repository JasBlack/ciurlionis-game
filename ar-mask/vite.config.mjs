// Mask Layer: a static build with every path relative, so dist/ can be served from any folder.
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));

export default {
  root: here,
  base: './',
  publicDir: 'public',
  optimizeDeps: { entries: ['index.html'] },
  build: {
    target: 'es2022',
    outDir: `${here}dist`,
    emptyOutDir: true,
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: 4000,
  },
};
