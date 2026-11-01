import { groupModels } from './matrix-selection.ts';

export const metrics = [
  'afr',
  'afrDelta',
  'count',
  'populationDelta',
  'new',
  'retired',
  'failed',
] as const;
export type Metric = (typeof metrics)[number];
export const metricLabels = [
  'AFR value',
  'AFR delta',
  'Count',
  'Population delta',
  'New',
  'Retired',
  'Failed',
];
export type Knot = { value: number; color: string };
export type Domain = {
  sampleCount: number;
  observedMinimum: number | null;
  observedMedian: number | null;
  observedMaximum: number | null;
  knots: Knot[];
  emptyColor?: string;
};
export type Components = { failures: number; driveDays: number; complete: boolean };
export type MatrixCell = {
  quarter: string | null;
  relativeQuarter: number;
  state: string;
  metrics: Record<Metric, number | null>;
  raw?: (string | null)[];
  coordinates?: string[];
  quarterComponents?: Components;
  cumulativeComponents?: Components;
  quarterAfr?: number | null;
  deltaBaseline?: {
    kind: string;
    priorQuarter: string | null;
    elapsedQuarters: number | null;
    afr: number | null;
    count: number | null;
  } | null;
  retirementInference?: string;
  rateUnavailableReason?: string | null;
  coverage?: string;
  productionEvidence?: { label: string; value: string }[];
  observations?: {
    count: number | null;
    new: number | null;
    failed: number | null;
    retired: number | null;
  };
};
export type MatrixModel = {
  id: string;
  name: string;
  vendor: string;
  cells: MatrixCell[];
  anchor: string | null;
  preEligibility?: Components;
  finalEligible?: string;
  asOfStatus?: string;
};
export type MatrixSnapshot = {
  id: string;
  label: string;
  kind: 'reference' | 'sample' | 'production';
  rateLabel?: string;
  sourceUrl: string | null;
  sourceHash: string;
  cutoff: string | null;
  models: MatrixModel[];
  domains: Record<Metric, Domain>;
  extent: number;
  versions: string;
  notice: string;
};
export type Workbook = {
  snapshot: string;
  source: { url: string; sha256: string };
  models: {
    model: string;
    vendor: string;
    rows: { display_ordinal: number; status: string; cells: [string, string | null][] }[];
  }[];
  color_rules: {
    numeric_count: number;
    minimum: string;
    median: string;
    maximum: string;
    stops: { resolved_value: string; css_color: string }[];
  }[];
};
export type Production = {
  snapshot: { id: string; asOfQuarter: string; cutoffDate: string };
  provenance: { sourceManifestSha256: string; dataSourceNotice: string };
  versions: Record<string, string>;
  display: { maxRelativeQuarter: number };
  colorScales: { domains: Record<Metric, Domain> };
  models: {
    modelId: string;
    modelNumber: string;
    vendor: string;
    cells: MatrixCell[];
    anchorQuarter: string;
    preEligibilityComponents: Components;
    finalEligibleQuarter: string;
    asOfStatus: string;
  }[];
};
export function adaptWorkbook(data: Workbook): MatrixSnapshot {
  return {
    id: data.snapshot,
    label: `${data.snapshot.replace('-', ' ')} · workbook reference`,
    kind: 'reference',
    sourceUrl: data.source.url,
    sourceHash: data.source.sha256,
    cutoff: null,
    extent: Math.max(24, ...data.models.map((m) => m.rows.length)),
    versions: 'Legacy retained-row / original workbook metrics',
    notice:
      'Reference only. Actual calendar quarters, cutoff, exposure and trailing-blank causes are unknown. Relative rows are retained positions, not proven elapsed calendar time.',
    domains: Object.fromEntries(
      data.color_rules.map((rule, i) => [
        metrics[i],
        {
          sampleCount: rule.numeric_count,
          observedMinimum: Number(rule.minimum),
          observedMedian: Number(rule.median),
          observedMaximum: Number(rule.maximum),
          knots: rule.stops.map((stop) => ({
            value: Number(stop.resolved_value),
            color: stop.css_color,
          })),
        },
      ]),
    ) as Record<Metric, Domain>,
    models: data.models.map((model) => ({
      id: model.model,
      name: model.model,
      vendor: model.vendor,
      anchor: null,
      cells: model.rows.map((row) => ({
        quarter: null,
        relativeQuarter: row.display_ordinal,
        state: row.status === 'retained' ? 'reference_observed' : 'trailing_blank_unknown',
        metrics: Object.fromEntries(
          row.cells.map((cell, i) => [metrics[i], cell[1] === null ? null : Number(cell[1])]),
        ) as Record<Metric, number | null>,
        raw: row.cells.map((c) => c[1]),
        coordinates: row.cells.map((c) => c[0]),
      })),
    })),
  };
}
export function adaptProduction(data: Production): MatrixSnapshot {
  return {
    id: data.snapshot.id,
    label: `${data.snapshot.asOfQuarter.replace('-', ' ')} · ${data.snapshot.id.replace('synthetic-', '').replace('-v1', '')} sample`,
    kind: 'sample',
    sourceUrl: null,
    sourceHash: data.provenance.sourceManifestSha256,
    cutoff: data.snapshot.cutoffDate,
    models: data.models.map((m) => ({
      id: m.modelId,
      name: m.modelNumber,
      vendor: m.vendor,
      cells: m.cells,
      anchor: m.anchorQuarter,
      preEligibility: m.preEligibilityComponents,
      finalEligible: m.finalEligibleQuarter,
      asOfStatus: m.asOfStatus,
    })),
    domains: data.colorScales.domains,
    extent: data.display.maxRelativeQuarter,
    versions: Object.entries(data.versions)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · '),
    notice: data.provenance.dataSourceNotice,
  };
}
export function interpolate(value: number | null, domain: Domain): string {
  const knots = domain.knots;
  if (value === null || !knots.length) {
    return domain.emptyColor ?? '#F2F2F2';
  }
  if (value <= knots[0]!.value) {
    return knots[0]!.color;
  }
  if (value >= knots.at(-1)!.value) {
    return knots.at(-1)!.color;
  }
  const hi = knots.findIndex((k) => k.value >= value),
    a = knots[hi - 1]!,
    b = knots[hi]!;
  const t = (value - a.value) / (b.value - a.value);
  return (
    '#' +
    [1, 3, 5]
      .map((offset) => {
        const lo = parseInt(a.color.slice(offset, offset + 2), 16),
          high = parseInt(b.color.slice(offset, offset + 2), 16);
        return Math.floor(lo + (high - lo) * t + 0.5)
          .toString(16)
          .padStart(2, '0');
      })
      .join('')
      .toUpperCase()
  );
}
export function cellAt(model: MatrixModel, index: number): MatrixCell {
  if (model.cells[index - 1]) {
    return model.cells[index - 1]!;
  }
  let quarter: string | null = null;
  if (model.anchor) {
    const [year, q] = model.anchor.split('-Q').map(Number);
    const offset = year! * 4 + q! - 1 + index - 1;
    quarter = `${Math.floor(offset / 4)}-Q${(offset % 4) + 1}`;
  }
  return {
    quarter,
    relativeQuarter: index,
    state: model.anchor ? 'snapshot_end' : 'outside_reference',
    metrics: Object.fromEntries(metrics.map((k) => [k, null])) as Record<Metric, null>,
  };
}
export const states: Record<string, { label: string; description: string }> = {
  reference_observed: {
    label: 'Reference row',
    description: 'Observed workbook value; actual calendar mapping and exposure unknown.',
  },
  eligible: {
    label: 'Eligible',
    description: 'At least 2,000 distinct drives observed during this calendar quarter.',
  },
  below_threshold: {
    label: 'Below 2k',
    description:
      'Out of displayed service under the comparison threshold. Some drives may remain in the source fleet; this is not a physical fleet exit.',
  },
  unpublished: {
    label: 'Unpublished',
    description:
      'Before the published source domain; no observations or zero population are implied.',
  },
  source_missing: {
    label: 'Source gap',
    description: 'Source observations missing; no threshold exit is inferred.',
  },
  source_incomplete: {
    label: 'Partial source',
    description: 'Incomplete source coverage; no threshold exit is inferred.',
  },
  snapshot_end: {
    label: 'Snapshot end',
    description:
      'Beyond the selected as-of snapshot. Future history is unobserved, not a confirmed threshold exit.',
  },
  trailing_blank_unknown: {
    label: 'Unknown blank',
    description:
      'Original workbook blank. Its cause is unknown; it does not establish threshold exit, source gap or future history.',
  },
  outside_reference: {
    label: 'No reference',
    description: 'Beyond the supplied reference rows. No calendar or exit inference is possible.',
  },
};
export function stateInfo(state: string) {
  return (
    states[state] ?? {
      label: state.replaceAll('_', ' '),
      description: 'Unavailable under the selected snapshot contract.',
    }
  );
}
export function visibleModels(snapshot: MatrixSnapshot, selected: Set<string>): MatrixModel[] {
  return groupModels(snapshot.models).flatMap((group) =>
    group.models.filter((model) => selected.has(model.id)),
  );
}
export function formatMetric(value: number | null, metric: Metric) {
  return value === null
    ? '—'
    : metric === 'afr' || metric === 'afrDelta'
      ? value.toFixed(3)
      : value.toLocaleString('en-US');
}
export function axisExtent(snapshot: MatrixSnapshot, guideYear: number) {
  return Math.max(24, snapshot.extent, guideYear * 4);
}
