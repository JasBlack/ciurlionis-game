// The game's build: index.html at the top of dist, every path relative, nothing from other hosts.
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));

export default {
  root: here,
  base: './',
  publicDir: 'public',
  resolve: { alias: [{ find: /^patch-block$/, replacement: `${here}lib/patch-block.js` }] },
  server: { watch: { ignored: ['**/vendor/**', '**/*.mp4'] } },
  optimizeDeps: { entries: ['index.html'] },
  build: {
    target: 'es2022',
    outDir: `${here}dist`,
    emptyOutDir: true,
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: 8000,
  },
};
