/** WCAG 2.2 relative-luminance contrast for opaque sRGB display colors. */
export const HEATMAP_CONTRAST_TARGET = 7.1;
export type CellPaint = Readonly<{ background: string; foreground: string; contrast: number }>;

function rgb(hex: string): number[] {
  if (!/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(hex)) {
    throw new Error('Expected an opaque sRGB hex color');
  }
  const expanded =
    hex.length === 4
      ? '#' +
        hex
          .slice(1)
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  return [1, 3, 5].map((offset) => parseInt(expanded.slice(offset, offset + 2), 16));
}
function hex(channels: number[]): string {
  return (
    '#' +
    channels
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}
export function relativeLuminance(color: string): number {
  const linear = rgb(color).map((value) => {
    const encoded = value / 255;
    return encoded <= 0.04045 ? encoded / 12.92 : ((encoded + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}
export function contrastRatio(first: string, second: string): number {
  const a = relativeLuminance(first),
    b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const paints = new Map<string, CellPaint>();
export function heatmapPaint(sourceFill: string): CellPaint {
  const channels = rgb(sourceFill),
    normalized = hex(channels);
  const existing = paints.get(normalized);
  if (existing) {
    return existing;
  }
  // Adjust only the presentation fill, after source-scale interpolation. Every
  // cell and legend uses the same mapping, independent of filters or viewport.
  const mixed = (amount: number) =>
    hex(channels.map((value) => Math.round(value + ((255 - value) * amount) / 255)));
  let low = 0,
    high = 255;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (contrastRatio('#000000', mixed(middle)) >= HEATMAP_CONTRAST_TARGET) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }
  const background = mixed(low);
  const result = Object.freeze({
    background,
    foreground: '#000000',
    contrast: contrastRatio('#000000', background),
  });
  paints.set(normalized, result);
  return result;
}
