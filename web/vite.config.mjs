import { defineConfig } from 'vite';
import { presentationCapsulesPlugin } from './scripts/presentation-capsules-plugin.mjs';
import { minimizedJsonPlugin } from './scripts/minimized-json.mjs';
import { queuePlugin } from './scripts/queue-plugin.mjs';

export default defineConfig({
  plugins: [minimizedJsonPlugin(), presentationCapsulesPlugin(), queuePlugin()],
  build: {
    minify: 'oxc',
    cssMinify: 'lightningcss',
    sourcemap: false,
  },
});
