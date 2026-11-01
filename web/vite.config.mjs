import { defineConfig } from 'vite';
import { minimizedJsonPlugin } from './scripts/minimized-json.mjs';

export default defineConfig({
  plugins: [minimizedJsonPlugin()],
  build: {
    minify: 'oxc',
    cssMinify: 'lightningcss',
    sourcemap: false,
  },
});
