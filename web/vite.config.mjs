import { defineConfig } from 'vite';
import { presentationCapsulesPlugin } from './scripts/presentation-capsules-plugin.mjs';
import { minimizedJsonPlugin } from './scripts/minimized-json.mjs';

export default defineConfig({
  plugins: [minimizedJsonPlugin(), presentationCapsulesPlugin()],
  build: {
    minify: 'oxc',
    cssMinify: 'lightningcss',
    sourcemap: false,
  },
});
