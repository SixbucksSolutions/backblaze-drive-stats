import type { Aggregate, Coverage, SupportingQuarter } from './production-data.ts';
import type { SnapshotReport } from './app-route.ts';

const count = (n: number | null | undefined) =>
  n == null ? 'Unavailable' : n.toLocaleString('en-US');
const cap = (n: number | null | undefined) =>
  n == null
    ? 'Unavailable'
    : `${(n / (Math.abs(n) >= 1_000_000 ? 1_000_000 : 1000)).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${Math.abs(n) >= 1_000_000 ? 'EB' : 'PB'}`;

export function scopeMetrics(
  report: SnapshotReport,
  filtered: Aggregate,
  payload: SupportingQuarter | null,
  coverage: Coverage | undefined,
  models: number,
) {
  const all = payload?.scopes.all_supplied;
  const whole = payload?.scopes.selected_hdd.totals;
  if (report === 'capacity' || report === 'datacenters') {
    const locationShare = payload?.datacenters.knownLocationPopulationShare;
    return [
      {
        label: 'ALL SUPPLIED RAW CAPACITY',
        value: cap(all?.totals.capacityTB),
        note: 'Nominal raw capacity; decimal PB / EB',
      },
      {
        label: 'ALL SUPPLIED OBSERVED DRIVES',
        value: count(all?.totals.count),
        note: 'Includes unresolved media and all supplied models',
      },
      report === 'capacity'
        ? {
            label: 'COMPARABLE QUARTER CHANGE',
            value: cap(all?.capacityDeltaTB),
            note:
              all?.capacityDeltaReason === 'previous_complete'
                ? 'Immediately preceding complete calendar quarter'
                : 'No comparable preceding capacity value',
          }
        : {
            label: 'KNOWN LOCATION POPULATION',
            value:
              locationShare == null
                ? 'Unavailable'
                : `${(locationShare * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`,
            note: 'Population coverage, including Unknown in denominator',
          },
      report === 'capacity'
        ? {
            label: 'SELECTED-HDD CONTEXT CAPACITY',
            value: cap(whole?.capacityTB),
            note: 'A separate, narrower context; not the series scope',
          }
        : {
            label: 'LOCATION FIELD',
            value: coverage?.datacenterFieldAvailable ? 'Reported' : 'Unreported',
            note: 'Location reporting begins 2023 Q3',
          },
    ];
  }
  if (report === 'manufacturers') {
    return [
      {
        label: 'FILTERED HDD CAPACITY',
        value: cap(filtered.capacityTB),
        note: `${models} model rows in filtered numerators`,
      },
      {
        label: 'WHOLE HDD CONTEXT CAPACITY',
        value: cap(whole?.capacityTB),
        note: 'Capacity-share denominator remains whole context',
      },
      {
        label: 'FILTERED OBSERVED HDDs',
        value: count(filtered.count),
        note: `Population-share denominator: ${count(whole?.count)}`,
      },
      {
        label: 'FILTERED FIRST RECORDED HDDs',
        value: count(filtered.new),
        note: `Addition-share denominator: ${count(whole?.new)}`,
      },
    ];
  }
  const deployments = report === 'deployments';
  return [
    {
      label: deployments ? 'FILTERED FIRST RECORDED HDDs' : 'FILTERED HDD OBSERVED DRIVES',
      value: count(deployments ? filtered.new : filtered.count),
      note: `${models} models in the visible selection`,
    },
    {
      label: deployments ? 'WHOLE HDD CONTEXT FIRST RECORDED' : 'WHOLE SELECTED-HDD CONTEXT',
      value: count(deployments ? whole?.new : whole?.count),
      note: 'Includes seeded and smaller-population context',
    },
    {
      label: 'ALL SUPPLIED OBSERVED DRIVES',
      value: count(all?.totals.count),
      note: 'Includes SSDs and unresolved media',
    },
    {
      label: 'ALL SUPPLIED RAW CAPACITY',
      value: cap(all?.totals.capacityTB),
      note: 'Aggregate capacity; decimal PB / EB',
    },
  ];
}

export function renderScopeMetrics(
  report: SnapshotReport,
  filtered: Aggregate,
  payload: SupportingQuarter | null,
  coverage: Coverage | undefined,
  models: number,
) {
  return `<section class="metrics" aria-label="Population scopes">${scopeMetrics(
    report,
    filtered,
    payload,
    coverage,
    models,
  )
    .map(
      (m) =>
        `<article class="metric"><div class="metric-label">${m.label}</div><strong>${m.value}</strong><small>${m.note}</small></article>`,
    )
    .join('')}</section>`;
}
