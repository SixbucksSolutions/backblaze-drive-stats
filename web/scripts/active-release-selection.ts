// Publication contract for the complete historical 2.1 refresh. Browser readers
// remain version-compatible; only active-release gates require this exact set.
export const activeReleaseSelection = Object.freeze({
  latestQuarter: '2026-Q2',
  quarters: Object.freeze(
    Array.from({ length: 53 }, (_, offset) => {
      const ordinal = 2013 * 4 + 1 + offset;
      return `${Math.floor(ordinal / 4)}-Q${(ordinal % 4) + 1}`;
    }),
  ),
  requiredRateVersion: '2.1.0',
  requiredSelectionVersion: '2.1.0',
  requiredCohortVersion: '2.1.0',
  requiredMinimumCapacityTB: 1.0,
  requiredSnapshotCount: 53,
  requireViewAvailability: true,
});
