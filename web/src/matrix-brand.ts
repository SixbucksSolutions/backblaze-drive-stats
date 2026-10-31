import { contrastRatio } from './matrix-contrast.ts';

/** Brand/category fills are exact; heatmap accessibility remapping is separate. */
export const VENDOR_COLORS: Readonly<Record<string, string>> = Object.freeze({
  Seagate: '#6EBE49', Toshiba: '#CC0000', 'WDC/HGST': '#005195',
});
export function vendorPaint(vendor: string) {
  const background = VENDOR_COLORS[vendor] ?? '#485963';
  const foreground = contrastRatio('#000000', background) >= contrastRatio('#FFFFFF', background) ? '#000000' : '#FFFFFF';
  return { background, foreground, contrast: contrastRatio(foreground, background) };
}
