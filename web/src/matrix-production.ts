import type { ProductionMatrix, SnapshotDescriptor } from './production-data.ts';
import type { Domain, Knot, MatrixCell, MatrixSnapshot, Metric } from './matrix-data.ts';
import { metrics } from './matrix-data.ts';
import { SnapshotLoader } from './snapshot-loader.ts';
import { customerHddScopeDescription } from './snapshot-selection.ts';
import { displayModelLabel } from './model-labels.ts';
import { formatAfr } from './afr-format.ts';

const green = '#00FF00',
  yellow = '#FFFF00',
  red = '#FF0000',
  white = '#FFFFFF';
/** Full-snapshot domains use the accepted reference palette and deterministic edge rules. */
export function productionDomain(values: number[], metric: Metric): Domain {
  const sorted = values.toSorted((a, b) => a - b);
  const min = sorted[0] ?? null,
    max = sorted.at(-1) ?? null;
  const middle = (sorted.length - 1) / 2;
  const median = sorted.length
    ? (sorted[Math.floor(middle)]! + sorted[Math.ceil(middle)]!) / 2
    : null;
  const domain: Domain = {
    sampleCount: sorted.length,
    observedMinimum: min,
    observedMedian: median,
    observedMaximum: max,
    knots: [],
    emptyColor: '#F2F2F2',
  };
  if (min === null || max === null || median === null) {
    return domain;
  }
  const knots: Knot[] = [];
  const add = (value: number, color: string) => {
    const prior = knots.find((k) => k.value === value);
    if (prior) {
      prior.color = color;
    } else {
      knots.push({ value, color });
    }
  };
  if (metric === 'afr') {
    if (min < 1) {
      add(min, green);
    }
    add(1, yellow);
    add(2, red);
  } else if (metric === 'afrDelta' || metric === 'populationDelta') {
    if (min < 0) {
      add(min, metric === 'afrDelta' ? green : red);
    }
    add(0, white);
    if (max > 0) {
      add(max, metric === 'afrDelta' ? red : green);
    }
  } else if (metric === 'new') {
    add(0, white);
    if (max > 0) {
      add(max, green);
    }
  } else if (metric === 'retired') {
    add(0, green);
    if (max > 0) {
      add(max, red);
    }
    if (median > 0) {
      add(median, yellow);
    }
  } else {
    add(min, metric === 'count' ? red : green);
    add(max, metric === 'count' ? green : red);
    add(median, max === 0 && metric === 'failed' ? green : yellow);
  }
  domain.knots = knots.toSorted((a, b) => a.value - b.value);
  return domain;
}

/** An explicit v2-to-presentation adapter; presentation AFR keys are never a v1 payload. */
export function adaptProductionV2(
  descriptor: SnapshotDescriptor,
  matrix: ProductionMatrix,
): MatrixSnapshot {
  const { context } = descriptor;
  const hddScopeDescription = customerHddScopeDescription(
    context.versions.selection,
    context.selection,
    context.inventory,
  );
  if (
    matrix.contractVersion !== '2.0.0' ||
    !['2.0.0', '2.1.0'].includes(context.versions.rate) ||
    matrix.rateBasis !==
      (context.versions.rate === '2.1.0'
        ? 'observed-quarter-distinct-failed-identities-recorded-exposure-v2.1'
        : 'observed-recorded-exposure-v2') ||
    matrix.rateLabel !==
      (context.versions.rate === '2.1.0'
        ? 'Observed-history AFR (quarterly unique failures)'
        : 'Observed-history AFR') ||
    matrix.snapshotId !== context.snapshotId ||
    matrix.contextSha256 !== descriptor.contextSha256 ||
    matrix.asOfQuarter !== context.asOfQuarter
  ) {
    throw new Error('Matrix presentation requires the matching validated v2 snapshot.');
  }
  const inventory = new Map(context.inventory.map((model) => [model.modelId, model]));
  const coverage = new Map(context.coverage.map((row) => [row.quarter, row]));
  const models = matrix.models.map((model) => {
    const entry = inventory.get(model.modelId);
    if (!entry) {
      throw new Error('Matrix model missing from inventory.');
    }
    const history = new Map(entry.history.map((row) => [row.quarter, row]));
    const prior = entry.history.filter((row) => row.quarter < model.reportingAnchorQuarter);
    return {
      id: model.modelId,
      name: entry.modelNumber,
      vendor: displayModelLabel(entry).vendor,
      capacityTB: entry.capacityTB,
      anchor: model.reportingAnchorQuarter,
      ...(model.cells.some((cell) => cell.status === 'eligible')
        ? { finalEligible: model.cells.findLast((cell) => cell.status === 'eligible')!.quarter }
        : {}),
      preEligibility: {
        failures: prior.reduce((n, row) => n + row.knownFailures, 0),
        driveDays: prior.reduce((n, row) => n + row.knownDriveDays, 0),
        complete: prior.every((row) => coverage.get(row.quarter)?.status === 'complete'),
      },
      cells: model.cells.map((cell) => {
        const ledger = history.get(cell.quarter),
          source = coverage.get(cell.quarter);
        const baseline = model.cells.find((row) => row.quarter === cell.baselineQuarter);
        const detail = (label: string, value: string | number | boolean | null | undefined) => ({
          label,
          value: value === null || value === undefined ? 'Unavailable' : String(value),
        });
        return {
          quarter: cell.quarter,
          relativeQuarter: cell.relativeQuarter,
          state: cell.status === 'missing' ? 'source_missing' : cell.status,
          metrics: {
            afr: cell.metrics.observedRecordedAfr,
            afrDelta: cell.metrics.observedRecordedAfrDelta,
            count: cell.metrics.count,
            populationDelta: cell.metrics.populationDelta,
            new: cell.metrics.new,
            retired: cell.metrics.retired,
            failed: cell.metrics.failed,
          },
          quarterAfr: cell.quarterAfr,
          coverage: source
            ? `${source.status} · ${source.observedDays}/${source.expectedDays} days · ${source.reason}`
            : 'Beyond snapshot cutoff',
          ...(ledger
            ? {
                quarterComponents: {
                  failures: ledger.knownFailures,
                  driveDays: ledger.knownDriveDays,
                  complete: source?.status === 'complete',
                },
              }
            : {}),
          ...(cell.cumulativeKnownFailures !== null && cell.cumulativeKnownDriveDays !== null
            ? {
                cumulativeComponents: {
                  failures: cell.cumulativeKnownFailures,
                  driveDays: cell.cumulativeKnownDriveDays,
                  complete: cell.sourceHistoryComplete,
                },
              }
            : {}),
          deltaBaseline:
            cell.deltaReason === 'unavailable'
              ? null
              : {
                  kind:
                    cell.deltaReason === 'initialized'
                      ? context.versions.rate === '2.1.0'
                        ? 'initial_subtract_zero'
                        : 'initial_zero_delta'
                      : 'Change since prior eligible quarter',
                  priorQuarter: cell.baselineQuarter,
                  elapsedQuarters: cell.baselineQuarterDistance,
                  afr:
                    cell.deltaReason === 'initialized'
                      ? context.versions.rate === '2.1.0'
                        ? 0
                        : null
                      : (baseline?.metrics.observedRecordedAfr ?? null),
                  count:
                    cell.deltaReason === 'initialized'
                      ? context.versions.rate === '2.1.0'
                        ? 0
                        : null
                      : (baseline?.metrics.count ?? null),
                },
          retirementInference:
            cell.retiredReason === 'right_censored'
              ? 'Unavailable: selected snapshot quarter is right-censored; later observations are unavailable'
              : cell.retiredReason === 'cutoff_failed_proxy'
                ? 'PROVISIONAL: selected-cutoff Retired = Failed proxy'
                : cell.retiredReason === 'gap_obstructed'
                  ? 'Unavailable: source gaps obstruct last-observed inference'
                  : cell.retiredReason === 'inferred'
                    ? 'Unique identities last observed in this nonterminal quarter; includes failed departures; not proof of physical exit'
                    : 'Unavailable',
          rateUnavailableReason:
            cell.metrics.observedRecordedAfr === null
              ? `Unavailable: ${cell.status}; zero recorded denominator or unavailable display row`
              : 'Observed-history AFR: recorded failure flags / recorded drive-days × 36500; missing days are not imputed',
          productionEvidence: [
            detail('Rate basis', matrix.rateBasis),
            detail(
              'Complete-history AFR (detail only)',
              cell.completeHistoryAfr === null ? null : `${formatAfr(cell.completeHistoryAfr)}%`,
            ),
            detail('Required source history complete through cell', cell.sourceHistoryComplete),
            detail('Lifetime exposure complete', false),
            detail('Quarter Count (complete coverage only)', ledger?.quarterCount),
            detail(
              'Known identity lower bound (not full-quarter Count)',
              ledger?.knownIdentityLowerBound,
            ),
            detail('Threshold proof', ledger?.thresholdProof),
            detail(
              'First recorded / first proven threshold',
              `${entry.firstObservedInDeclaredHistory ?? 'Unavailable'} / ${entry.firstProvenThresholdInDeclaredHistory ?? 'Unavailable'}`,
            ),
            detail('Earlier qualification not excluded', entry.earlierQualificationNotExcluded),
            detail('Anchor search complete', entry.anchorSearchComplete),
            detail(
              'Evidence IDs / SHA-256',
              [...(ledger?.evidence ?? []), ...(source?.evidence ?? [])]
                .map((e) => `${e.id} / ${e.sha256}`)
                .join(' · ') || null,
            ),
          ],
        };
      }),
    };
  });
  const domains = Object.fromEntries(
    metrics.map((metric) => [
      metric,
      productionDomain(
        models.flatMap((model) =>
          model.cells.flatMap((cell) =>
            cell.state === 'eligible' && cell.metrics[metric] !== null
              ? [cell.metrics[metric]]
              : [],
          ),
        ),
        metric,
      ),
    ]),
  ) as Record<Metric, Domain>;
  return {
    id: context.snapshotId,
    label: `${context.asOfQuarter.replace('-Q', ' Q')} · ${context.kind === 'backblaze' ? 'Backblaze observed history' : 'fictional v2 sample'}`,
    kind: context.kind === 'backblaze' ? 'production' : 'sample',
    rateLabel: matrix.rateLabel,
    matrixCalculationVersion: context.versions.rate,
    ...(hddScopeDescription === undefined ? {} : { hddScopeDescription }),
    sourceUrl: context.provenance.url,
    sourceHash: context.sourceManifestSha256,
    cutoff: context.cutoffDate,
    models,
    domains,
    extent: Math.max(24, matrix.relativeQuarterCount),
    versions: `v2.0.0 · ${Object.entries(context.versions)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ')} · generator ${context.generatorRevision} · context ${descriptor.contextSha256}`,
    notice: `Observed-history AFR uses recorded exposure, including pre-anchor and below-threshold observations. Source gaps remain explicit; this is not lifetime AFR or individual drive age. Purchase and historical-reference defaults: ${context.selection.purchaseDefaultModelIds.length} and ${context.selection.historicalReferenceModelIds.length} assigned. No purchase recommendation is inferred.`,
  };
}

/** V2 initializes the delta itself; it does not invent a prior measured value. */
export function initializedBaselineLabel(baseline: MatrixCell['deltaBaseline']): string | null {
  return baseline?.kind === 'initial_subtract_zero'
    ? `First eligible deltas subtract synthetic zero: AFR ${formatAfr(0)}%, Count 0. This is not a prior observed quarter; elapsed span is not applicable.`
    : baseline?.kind === 'initial_zero_delta'
      ? 'Deltas initialized to zero. Prior AFR/Count baseline and elapsed span: not applicable.'
      : null;
}

/** Only the latest requested validated selection may be committed to the view. */
export class MatrixProductionReader {
  readonly loader: SnapshotLoader;
  #request = 0;
  #controller: AbortController | undefined;
  constructor(loader: SnapshotLoader) {
    this.loader = loader;
  }
  async select(id: string, signal?: AbortSignal): Promise<MatrixSnapshot | null> {
    const request = ++this.#request;
    this.#controller?.abort();
    const controller = new AbortController();
    this.#controller = controller;
    const joined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    try {
      const descriptor = await this.loader.loadSnapshot(id, joined);
      const matrix = await this.loader.loadMatrix(descriptor, joined);
      joined.throwIfAborted();
      return request === this.#request ? adaptProductionV2(descriptor, matrix) : null;
    } catch (error) {
      if (request !== this.#request) {
        return null;
      }
      throw error;
    }
  }
}
