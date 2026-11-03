import { vendorPaint } from './matrix-brand.ts';
import { contrastRatio } from './matrix-contrast.ts';

/** Card-only Toshiba shade keeps ordinary-size model text above 7:1 contrast. */
export function pickBrandPaint(vendor: string) {
  if (vendor === 'Toshiba') {
    const background = '#B40000';
    const foreground = '#FFFFFF';
    return { background, foreground, contrast: contrastRatio(foreground, background) };
  }
  return vendorPaint(vendor === 'WD' ? 'HGST/WD' : vendor);
}
