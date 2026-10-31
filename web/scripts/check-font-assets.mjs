import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../public/fonts/', import.meta.url));
const provenance = JSON.parse(readFileSync(join(root, 'provenance.json'), 'utf8'));
let fonts = 0,
  licenses = 0;
for (const asset of provenance.assets) {
  if (basename(asset.file) !== asset.file || asset.modified !== false) {
    throw new Error('Unexpected font asset record');
  }
  const data = readFileSync(join(root, asset.file));
  if (
    data.length !== asset.sizeBytes ||
    createHash('sha256').update(data).digest('hex') !== asset.sha256
  ) {
    throw new Error(`Font provenance mismatch: ${asset.file}`);
  }
  if (asset.file.endsWith('.woff2')) {
    if (data.subarray(0, 4).toString() !== 'wOF2') {
      throw new Error('Invalid WOFF2 asset');
    }
    fonts++;
  } else {
    if (!data.toString('utf8').includes('SIL OPEN FONT LICENSE Version 1.1')) {
      throw new Error('Full font license is missing');
    }
    licenses++;
  }
}
if (fonts !== 3 || licenses !== 2) {
  throw new Error('Expected three font assets and both full licenses');
}
const notice = readFileSync(join(root, 'NOTICE.txt'), 'utf8');
if (
  !notice.includes('Inter Project Authors') ||
  !notice.includes('JetBrains Mono Project Authors')
) {
  throw new Error('Font credit notice is incomplete');
}
console.log('Pinned fonts, unmodified source hashes and both OFL notices verified.');
