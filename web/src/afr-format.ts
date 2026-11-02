/** Display AFR percentages and percentage-point deltas without changing their numeric values. */
export function formatAfr(value: number): string {
  return value.toFixed(3);
}

/** Reading-case prose contains AFR percentages; keep its source text unchanged. */
export function formatAfrProse(text: string): string {
  return text.replace(
    /(-?\d+(?:\.\d+)?)%/g,
    (_match: string, value: string) => `${formatAfr(Number(value))}%`,
  );
}
