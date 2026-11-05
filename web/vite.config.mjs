import { defineConfig } from 'vite';
import { presentationCapsulesPlugin } from './scripts/presentation-capsules-plugin.mjs';
import { minimizedJsonPlugin } from './scripts/minimized-json.mjs';
import { localpostPlugin } from './scripts/localpost-plugin.mjs';

export default defineConfig({
  plugins: [minimizedJsonPlugin(), presentationCapsulesPlugin(), localpostPlugin()],
  build: {
    minify: 'oxc',
    cssMinify: 'lightningcss',
    sourcemap: false,
  },
});
