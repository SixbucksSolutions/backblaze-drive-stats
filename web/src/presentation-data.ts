import type {
  Context,
  InventoryModel,
  Reference,
  SnapshotDescriptor,
  SupportingQuarter,
} from './production-data.ts';
import type { MatrixSnapshot } from './matrix-data.ts';
import type { CapacityPoint } from './capacity-report.ts';
import type { AfrTimelineData } from './afr-timeline-data.ts';

export const PRESENTATION_VERSION = 1;
export type DisplayDescriptor = Omit<SnapshotDescriptor, 'context' | 'matrix'> & {
  context: Omit<Context, 'inventory'> & {
    inventory: Pick<InventoryModel, 'modelId' | 'vendor' | 'modelNumber'>[];
  };
};
export type CapsuleReference = Reference;
export type CapsuleBinding = {
  artifactType: 'backblaze-presentation';
  contractVersion: 1;
  snapshotId: string;
  asOfQuarter: string;
  contextSha256: string;
  sourceManifestSha256: string;
  descriptor: Reference;
};
export type MatrixCapsule = CapsuleBinding & {
  kind: 'matrix';
  quarter: null;
  body: MatrixSnapshot;
};
export type ReportCapsule = CapsuleBinding & {
  kind: 'report';
  quarter: string;
  body: {
    descriptor: DisplayDescriptor;
    quarter: SupportingQuarter | null;
    capacityHistory: readonly CapacityPoint[];
  };
};
export type TimelineCapsule = CapsuleBinding & {
  kind: 'timeline';
  quarter: null;
  body: AfrTimelineData;
};
export type PresentationCapsule = MatrixCapsule | ReportCapsule | TimelineCapsule;
export type CatalogueSnapshot = {
  snapshotId: string;
  asOfQuarter: string;
  contextSha256: string;
  sourceManifestSha256: string;
  descriptor: Reference;
  matrix: CapsuleReference;
  timeline?: CapsuleReference;
  reports: {
    quarter: string;
    status: 'complete' | 'partial' | 'missing' | 'unpublished';
    ref: CapsuleReference;
  }[];
};
export type PresentationCatalogue = {
  contractVersion: 1;
  sourceIndexSha256: string;
  latestSnapshotId: string;
  snapshots: CatalogueSnapshot[];
};

// This dedicated transport validator checks shapes and finite numeric leaves only.
// Canonical semantic validation and projection equivalence remain mandatory build gates.
type Rule = string | number | { [key: string]: Rule } | Rule[];
const s = 'string',
  n = 'number',
  nn = 'number|null',
  q = 'quarter',
  h = 'hash';
const ref = { path: 'sourcePath', sha256: h, sizeBytes: 'positiveInteger' };
const asset = { path: 'assetPath', sha256: h, sizeBytes: 'positiveInteger' };
const evidence = { id: s, sha256: h, url: 'url' };
const status = '=complete|partial|missing|unpublished';
const aggregate = { count: nn, new: nn, capacityTB: nn };
const deltaReason =
  '=previous_complete|first_quarter|previous_unavailable|current_incomplete|invalid_capacity';
const scope = {
  models: [{ modelId: s, ...aggregate }],
  totals: aggregate,
  manufacturers: [
    { vendor: s, ...aggregate, populationShare: nn, newShare: nn, capacityShare: nn },
  ],
  capacityDeltaTB: nn,
  capacityDeltaReason: deltaReason,
};
const descriptor = {
  artifactType: '=snapshot_descriptor',
  contractVersion: '=2.0.0',
  contextSha256: h,
  context: {
    snapshotId: s,
    asOfQuarter: q,
    cutoffDate: s,
    generatedAt: s,
    kind: '=sample|backblaze',
    generatorRevision: s,
    sourceManifestSha256: h,
    versions: {
      normalization: s,
      classification: s,
      selection: s,
      cohort: s,
      rate: s,
      capacity: s,
    },
    sourceDomain: {
      historyStartQuarter: q,
      firstPublishedDate: s,
      throughDate: s,
      evidence: [evidence],
    },
    provenance: { label: s, credit: s, url: 'url' },
    selection: {
      'minimumCapacityTB?': n,
      'excludedModelIds?': [s],
      contextModelIds: [s],
      analysisModelIds: [s],
      purchaseDefaultModelIds: [s],
      historicalReferenceModelIds: [s],
      positiveSeed: {
        version: s,
        modelIds: [s],
        evidence: [evidence],
        asOfQuarter: q,
        patternsSha256: h,
      },
    },
    coverage: [
      {
        quarter: q,
        status,
        expectedDays: n,
        observedDays: n,
        firstObservedDate: 'string|null',
        lastObservedDate: 'string|null',
        knownObservationRows: nn,
        reason: s,
        datacenterFieldAvailable: 'boolean',
        evidence: [evidence],
      },
    ],
    inventory: [{ modelId: s, vendor: s, modelNumber: s }],
  },
  quarters: [{ quarter: q, status, payload: ['nullable', ref] }],
};
const supporting = {
  artifactType: '=supporting_quarter',
  contractVersion: '=2.0.0',
  contextSha256: h,
  snapshotId: s,
  asOfQuarter: q,
  quarter: q,
  status: '=complete|partial',
  capacityBasis: '=observed-identity-capacity-mode-v2',
  scopes: { selected_hdd: scope, all_supplied: scope },
  datacenters: {
    fieldAvailable: 'boolean',
    knownLocationPopulationShare: nn,
    locations: [{ name: s, count: nn, capacityTB: nn }],
  },
};
const metrics = {
  afr: nn,
  afrDelta: nn,
  count: nn,
  populationDelta: nn,
  new: nn,
  retired: nn,
  failed: nn,
};
const components = { failures: n, driveDays: n, complete: 'boolean' };
const domain = {
  sampleCount: n,
  observedMinimum: nn,
  observedMedian: nn,
  observedMaximum: nn,
  knots: [{ value: n, color: s }],
  'emptyColor?': s,
};
const cell = {
  quarter: 'quarter|null',
  relativeQuarter: n,
  state: '=eligible|below_threshold|source_incomplete|source_missing|unpublished|snapshot_end',
  metrics,
  'raw?': ['string|null'],
  'coordinates?': [s],
  'quarterComponents?': components,
  'cumulativeComponents?': components,
  'quarterAfr?': nn,
  'deltaBaseline?': [
    'nullable',
    {
      kind: '=initial_subtract_zero|initial_zero_delta|Change since prior eligible quarter',
      priorQuarter: 'quarter|null',
      elapsedQuarters: nn,
      afr: nn,
      count: nn,
    },
  ],
  'retirementInference?': s,
  'rateUnavailableReason?': 'string|null',
  'coverage?': s,
  'productionEvidence?': [{ label: s, value: s }],
  'observations?': { count: nn, new: nn, failed: nn, retired: nn },
};
const matrix = {
  id: s,
  label: s,
  kind: '=production',
  'rateLabel?': s,
  'matrixCalculationVersion?': s,
  'hddScopeDescription?': s,
  sourceUrl: 'url|null',
  sourceHash: h,
  cutoff: 'string|null',
  models: [
    {
      id: s,
      name: s,
      vendor: s,
      'capacityTB?': nn,
      cells: [cell],
      anchor: 'quarter|null',
      'preEligibility?': components,
      'finalEligible?': s,
      'asOfStatus?': s,
    },
  ],
  domains: {
    afr: domain,
    afrDelta: domain,
    count: domain,
    populationDelta: domain,
    new: domain,
    retired: domain,
    failed: domain,
  },
  extent: n,
  versions: s,
  notice: s,
};
const binding = {
  artifactType: '=backblaze-presentation',
  contractVersion: 1,
  snapshotId: s,
  asOfQuarter: q,
  contextSha256: h,
  sourceManifestSha256: h,
  descriptor: ref,
};
function check(value: unknown, rule: Rule, depth = 0): void {
  if (depth > 30) {
    throw new Error('Presentation structure exceeds depth bound');
  }
  if (typeof rule === 'number') {
    if (value !== rule) {
      throw new Error('Unsupported presentation contract');
    }
    return;
  }
  if (typeof rule === 'string') {
    let valid = false;
    if (rule.endsWith('|null') && value === null) {
      return;
    }
    const base = rule.replace(/\|null$/, '');
    if (base === 'null') {
      valid = value === null;
    } else if (base === 'string') {
      valid = typeof value === 'string' && value.length <= 100_000;
    } else if (base === 'number') {
      valid = typeof value === 'number' && Number.isFinite(value);
    } else if (base === 'boolean') {
      valid = typeof value === 'boolean';
    } else if (base === 'positiveInteger') {
      valid =
        typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        value > 0 &&
        value <= 100_000_000;
    } else if (base === 'url') {
      if (typeof value === 'string' && value.length <= 100_000) {
        try {
          const url = new URL(value);
          valid = url.protocol === 'https:' && !url.username && !url.password;
        } catch {
          valid = false;
        }
      }
    } else if (base === 'hash') {
      valid = typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
    } else if (base === 'quarter') {
      valid = typeof value === 'string' && /^\d{4}-Q[1-4]$/.test(value);
    } else if (base === 'assetPath') {
      valid =
        typeof value === 'string' &&
        /^\/assets\/[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8,}\.json$/.test(value);
    } else if (base === 'sourcePath') {
      valid =
        typeof value === 'string' &&
        /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+[.-][a-f0-9]{64}\.json$/.test(value);
    } else if (base.startsWith('=')) {
      valid = typeof value === 'string' && base.slice(1).split('|').includes(value);
    }
    if (!valid) {
      throw new Error('Invalid presentation scalar');
    }
    return;
  }
  if (Array.isArray(rule)) {
    if (rule[0] === 'nullable') {
      if (value !== null) {
        check(value, rule[1]!, depth + 1);
      }
      return;
    }
    if (!Array.isArray(value) || value.length > 100_000) {
      throw new Error('Invalid presentation array');
    }
    for (const child of value) {
      check(child, rule[0]!, depth + 1);
    }
    return;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid presentation object');
  }
  const object = value as Record<string, unknown>;
  const fields = Object.entries(rule);
  const keys = new Set(fields.map(([key]) => key.replace(/\?$/, '')));
  if (Object.keys(object).some((key) => !keys.has(key))) {
    throw new Error('Unexpected presentation field');
  }
  for (const [field, child] of fields) {
    const key = field.replace(/\?$/, '');
    if (!Object.hasOwn(object, key)) {
      if (field.endsWith('?')) {
        continue;
      }
      throw new Error('Missing presentation field');
    }
    check(object[key], child, depth + 1);
  }
}
export function parsePresentationCapsule(value: unknown): PresentationCapsule {
  if (!value || typeof value !== 'object' || !('kind' in value)) {
    throw new Error('Invalid presentation capsule');
  }
  if (value.kind === 'matrix') {
    check(value, { ...binding, kind: '=matrix', quarter: 'null', body: matrix });
  } else if (value.kind === 'timeline') {
    check(value, {
      ...binding,
      kind: '=timeline',
      quarter: 'null',
      body: {
        snapshotId: s,
        asOfQuarter: q,
        sourceManifestSha256: h,
        rateVersion: s,
        models: [
          {
            id: s,
            name: s,
            vendor: s,
            capacityTB: nn,
            firstQuarter: q,
            points: [
              {
                quarter: q,
                relativeQuarter: 'positiveInteger',
                cumulativeAfr: nn,
                quarterlyAfr: nn,
                count: nn,
                failures: n,
                driveDays: n,
                coverage: status,
                historyComplete: 'boolean',
              },
            ],
          },
        ],
      },
    });
  } else if (value.kind === 'report') {
    check(value, {
      ...binding,
      kind: '=report',
      quarter: q,
      body: {
        descriptor,
        quarter: ['nullable', supporting],
        capacityHistory: [
          {
            quarter: q,
            status,
            count: nn,
            capacityTB: nn,
            capacityDeltaTB: nn,
            capacityDeltaReason: `${deltaReason}|unavailable`,
            reason: s,
          },
        ],
      },
    });
  } else {
    throw new Error('Unsupported presentation kind');
  }
  const capsule = value as PresentationCapsule;
  if (capsule.kind === 'matrix') {
    if (
      capsule.body.id !== capsule.snapshotId ||
      capsule.body.sourceHash !== capsule.sourceManifestSha256
    ) {
      throw new Error('Mixed matrix presentation binding');
    }
  } else if (capsule.kind === 'timeline') {
    const timeline = capsule.body;
    if (
      timeline.snapshotId !== capsule.snapshotId ||
      timeline.asOfQuarter !== capsule.asOfQuarter ||
      timeline.sourceManifestSha256 !== capsule.sourceManifestSha256
    ) {
      throw new Error('Mixed timeline presentation binding');
    }
    const ordinal = (quarter: string) => Number(quarter.slice(0, 4)) * 4 + Number(quarter.at(-1));
    if (new Set(timeline.models.map((model) => model.id)).size !== timeline.models.length) {
      throw new Error('Duplicate timeline model');
    }
    for (const model of timeline.models) {
      let previous = '';
      for (const point of model.points) {
        if (
          point.quarter <= previous ||
          point.quarter < model.firstQuarter ||
          point.quarter > timeline.asOfQuarter ||
          point.relativeQuarter !== ordinal(point.quarter) - ordinal(model.firstQuarter) + 1 ||
          point.failures < 0 ||
          point.driveDays < 0 ||
          (point.count !== null && point.count < 0) ||
          (point.cumulativeAfr !== null && point.cumulativeAfr < 0) ||
          (point.quarterlyAfr !== null && point.quarterlyAfr < 0) ||
          ((point.coverage !== 'complete' || point.driveDays === 0) &&
            (point.cumulativeAfr !== null || point.quarterlyAfr !== null))
        ) {
          throw new Error('Invalid timeline point');
        }
        previous = point.quarter;
      }
    }
  } else {
    const display = capsule.body.descriptor;
    if (
      display.contextSha256 !== capsule.contextSha256 ||
      display.context.snapshotId !== capsule.snapshotId ||
      display.context.asOfQuarter !== capsule.asOfQuarter ||
      display.context.sourceManifestSha256 !== capsule.sourceManifestSha256
    ) {
      throw new Error('Mixed display presentation binding');
    }
    const row = display.quarters.find((item) => item.quarter === capsule.quarter);
    if (!row || (row.payload === null) !== (capsule.body.quarter === null)) {
      throw new Error('Mixed report quarter binding');
    }
    const quarter = capsule.body.quarter;
    if (
      quarter &&
      (quarter.contextSha256 !== capsule.contextSha256 ||
        quarter.snapshotId !== capsule.snapshotId ||
        quarter.asOfQuarter !== capsule.asOfQuarter ||
        quarter.quarter !== capsule.quarter ||
        quarter.status !== row.status)
    ) {
      throw new Error('Mixed supporting presentation binding');
    }
    const history = capsule.body.capacityHistory;
    const expected = display.quarters
      .filter((item) => item.quarter <= capsule.asOfQuarter)
      .toSorted((a, b) => a.quarter.localeCompare(b.quarter));
    if (
      history.length !== expected.length ||
      history.some(
        (item, index) =>
          item.quarter !== expected[index]!.quarter || item.status !== expected[index]!.status,
      )
    ) {
      throw new Error('Mixed capacity presentation binding');
    }
  }
  return capsule;
}
export function parsePresentationCatalogue(value: unknown): PresentationCatalogue {
  check(value, {
    contractVersion: 1,
    sourceIndexSha256: h,
    latestSnapshotId: s,
    snapshots: [
      {
        snapshotId: s,
        asOfQuarter: q,
        contextSha256: h,
        sourceManifestSha256: h,
        descriptor: ref,
        matrix: asset,
        'timeline?': asset,
        reports: [{ quarter: q, status, ref: asset }],
      },
    ],
  });
  const result = value as PresentationCatalogue;
  if (
    !result.snapshots.length ||
    result.snapshots.length > 1000 ||
    !result.snapshots.some((item) => item.snapshotId === result.latestSnapshotId) ||
    new Set(result.snapshots.map((item) => item.snapshotId)).size !== result.snapshots.length
  ) {
    throw new Error('Invalid presentation snapshot catalogue');
  }
  for (const snapshot of result.snapshots) {
    if (
      !snapshot.reports.length ||
      new Set(snapshot.reports.map((item) => item.quarter)).size !== snapshot.reports.length
    ) {
      throw new Error('Invalid presentation quarter catalogue');
    }
  }
  return result;
}
