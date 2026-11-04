import { defineConfig } from 'vite';
import { presentationCapsulesPlugin } from './scripts/presentation-capsules-plugin.mjs';
import { minimizedJsonPlugin } from './scripts/minimized-json.mjs';
import { devDiagnosticsPlugin } from './scripts/dev-diagnostics.mjs';

export default defineConfig({
  plugins: [minimizedJsonPlugin(), presentationCapsulesPlugin(), devDiagnosticsPlugin()],
  build: {
    minify: 'oxc',
    cssMinify: 'lightningcss',
    sourcemap: false,
  },
});
