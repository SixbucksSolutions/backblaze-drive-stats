import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

process.env.DRIVE_STATS_DIAGNOSTICS = '1';
const server = await createServer({
  root: resolve(dirname(fileURLToPath(import.meta.url)), '..'),
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
});
let stopping = false;
async function stop() {
  if (stopping) {
    return;
  }
  stopping = true;
  try {
    await server.close();
  } catch {
    process.exitCode = 1;
  }
}
process.once('SIGINT', () => void stop());
process.once('SIGTERM', () => void stop());
await server.listen();
server.printUrls();
