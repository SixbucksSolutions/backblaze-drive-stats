/** Presentation-only nominal per-drive TB; retain source precision in metadata and fleet totals. */
export function nominalCapacityTB(capacityTB: number | null | undefined): number | null {
  if (
    capacityTB === null ||
    capacityTB === undefined ||
    !Number.isFinite(capacityTB) ||
    capacityTB <= 0
  ) {
    return null;
  }
  // Published HDD sizes are at least 1 TB. Preserve smaller values rather than rounding to zero.
  return capacityTB >= 1 ? Math.round(capacityTB * 10) / 10 : capacityTB;
}
