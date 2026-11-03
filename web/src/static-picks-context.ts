export type StaticPicksContext = {
  contractVersion: 1;
  sourceIndexSha256: string;
  latestSnapshotId: string;
  asOfQuarter: string | null;
};
export function parseStaticPicksContext(value: unknown): StaticPicksContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid static picks context');
  }
  const row = value as Record<string, unknown>;
  if (
    Object.keys(row).sort().join(',') !==
      'asOfQuarter,contractVersion,latestSnapshotId,sourceIndexSha256' ||
    row.contractVersion !== 1 ||
    typeof row.sourceIndexSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(row.sourceIndexSha256) ||
    typeof row.latestSnapshotId !== 'string' ||
    !row.latestSnapshotId ||
    (row.asOfQuarter !== null &&
      (typeof row.asOfQuarter !== 'string' || !/^\d{4}-Q[1-4]$/.test(row.asOfQuarter)))
  ) {
    throw new Error('Invalid static picks context');
  }
  return row as StaticPicksContext;
}
