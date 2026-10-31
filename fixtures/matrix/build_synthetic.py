"""Rebuild fictional aggregate examples; no observed Backblaze measurements."""
from copy import deepcopy
from datetime import timedelta
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from tools.validate_matrix_contract import METRICS, bounds, color_domains, ordinal, quarter, rate, validate_matrix


def digest(text):
    return hashlib.sha256(text.encode()).hexdigest()


def build(later=False, corrected=False):
    asof = '2025-Q3' if later else '2024-Q4'
    sid = 'synthetic-later-v1' if later else 'synthetic-earlier-v1'
    if corrected:
        sid = 'synthetic-correction-v1'
    quarters = []
    for n in range(ordinal('2023-Q4'), ordinal(asof) + 1):
        q = quarter(n)
        start, end = bounds(q)
        status = {'2025-Q1': 'missing', '2025-Q2': 'incomplete'}.get(q, 'complete')
        observed = (end - start).days + 1 if status == 'complete' else (0 if status == 'missing' else 10)
        quarters.append(dict(quarter=q, status=status, expectedDays=(end - start).days + 1,
                             observedDays=observed, observedStart=str(start) if observed else None,
                             observedEnd=str(end if status == 'complete' else start + timedelta(days=observed - 1)) if observed else None,
                             rowCount=observed * 4000, sourceIds=['synthetic-input'] if observed else []))
    models = []
    for variant in (0, 1):
        number = f'ST12000NM000{7 + variant}'
        model = dict(modelId=number, modelNumber=number, vendor='Seagate', rawModelAliases=[number],
                     anchorQuarter='2024-Q1', finalEligibleQuarter=asof, asOfStatus='eligible', historyStart='2023-10-01',
                     preEligibilityComponents=dict(failures=1 + variant, driveDays=100000, complete=True), cells=[])
        cumulative = deepcopy(model['preEligibilityComponents'])
        prior = None
        for relative in range(1, 25):
            q = quarter(ordinal('2024-Q1') + relative - 1)
            blank = {m: None for m in METRICS}
            obs = dict(count=None, new=None, retired=None, failed=None)
            if ordinal(q) > ordinal(asof):
                model['cells'].append(dict(quarter=q, relativeQuarter=relative, state='snapshot_end', eligibility='not_yet_observed', coverage='outside_snapshot', metrics=blank, observations=obs, quarterComponents=None, cumulativeComponents=None, quarterAfr=None, deltaBaseline=None, retirementInference='not_applicable', rateUnavailableReason='not_displayed'))
                continue
            coverage = next(c for c in quarters if c['quarter'] == q)['status']
            count = (1999 if relative == 2 else 2000 + 100 * (relative - 1)) + variant * 10
            if relative == 2:
                count = 1999 - variant
            failed = (0 if relative == 1 else relative % 3) + variant
            # Later evidence revises an earlier last-seen inference. The source
            # gap also makes that inference unavailable in the later snapshot.
            retired = (6 - variant if relative == 1 else 10 + variant)
            if corrected and relative == 1:
                retired -= 2
            if q == asof:
                retired = failed
            elif later and ordinal(q) < ordinal('2025-Q3'):
                retired = None
            if coverage == 'missing':
                state, eligibility = 'source_missing', 'unknown'
                qc = dict(failures=0, driveDays=0, complete=False)
            else:
                obs = dict(count=count, new=20 + relative + variant, retired=retired, failed=failed)
                state = 'source_incomplete' if coverage == 'incomplete' else ('eligible' if count >= 2000 else 'below_threshold')
                eligibility = 'unknown' if coverage == 'incomplete' else state
                qc = dict(failures=failed, driveDays=(10000 if coverage == 'incomplete' else 180000) + variant * 1000, complete=coverage == 'complete')
            cumulative = dict(failures=cumulative['failures'] + qc['failures'], driveDays=cumulative['driveDays'] + qc['driveDays'], complete=cumulative['complete'] and qc['complete'])
            baseline, qafr, inference, reason = None, None, 'not_applicable', 'not_displayed'
            if state == 'eligible':
                baseline = dict(kind='initial_zero', priorQuarter=None, elapsedQuarters=None, afr=0, count=0) if prior is None else dict(kind='prior_eligible', priorQuarter=prior['quarter'], elapsedQuarters=ordinal(q) - ordinal(prior['quarter']), afr=prior['metrics']['afr'], count=prior['metrics']['count'])
                afr = rate(cumulative)
                blank = dict(afr=afr, afrDelta=None if afr is None or baseline['afr'] is None else afr - baseline['afr'], count=count, populationDelta=count - baseline['count'], new=obs['new'], retired=retired, failed=failed)
                qafr = rate(qc)
                reason = None if afr is not None else 'incomplete_cumulative_coverage'
                inference = 'newest_quarter_failed_proxy' if q == asof else ('unavailable' if later else 'last_seen_before_boundary')
            cell = dict(quarter=q, relativeQuarter=relative, state=state, eligibility=eligibility, coverage=coverage,
                        metrics=blank, observations=obs, quarterComponents=qc, cumulativeComponents=deepcopy(cumulative),
                        quarterAfr=qafr, deltaBaseline=baseline, retirementInference=inference, rateUnavailableReason=reason)
            model['cells'].append(cell)
            if state == 'eligible':
                prior = cell
        models.append(model)
    result = dict(artifactType='flagship_matrix', contractVersion='1.0.0',
        snapshot=dict(id=sid, asOfQuarter=asof, cutoffDate=str(bounds(asof)[1]), generatedAt='2026-10-30T12:00:00Z', revisionOf='synthetic-earlier-v1' if later or corrected else None, immutablePath=f'synthetic/{sid}/matrix.json'),
        versions=dict(metrics='flagship-metrics-v1', time='calendar-offset-v1', delta='prior-eligible-v1', colors='shared-scales-v1', selection='synthetic-selection-v1', normalization='synthetic-normalization-v1', generator='synthetic-fixture-v1'),
        selection=dict(id='synthetic-selection', patternsSha256=digest('^ST12000NM000[78]$'), normalizationSha256=digest('synthetic exact identity'), rawMatchRule='regex_search_raw_model_before_normalization', patterns=['^ST12000NM000[78]$'], resolvedModels=[m['modelNumber'] for m in models], identityRule='normalized_model_and_serial', population='personal_hdd_selection', minimumPopulation=2000),
        coverage=dict(historyStart='2023-Q4', throughQuarter=asof, anchorSearchComplete=True, quarters=quarters, newestObservationDate=str(bounds(asof)[1])),
        provenance=dict(sources=[dict(id='synthetic-input', kind='derived_manifest', publicUrl=None, sha256=digest('fictional corrected aggregate input v1' if corrected else 'fictional aggregate input v1'), revision='synthetic-correction-v1' if corrected else 'synthetic-v1')], sourceManifestSha256=digest('fictional corrected aggregate manifest v1' if corrected else 'fictional aggregate manifest v1'), dataSourceNotice='SYNTHETIC TEST DATA. All values are invented; no observed Backblaze figures.', projectAttribution='Independent Backblaze Drive Stats analysis project; synthetic contract example.', datasetAttribution='No Backblaze dataset records are included in this synthetic example.'),
        display=dict(quarterLabel='YYYY Qn', maxRelativeQuarter=24, defaultGuideAfterQuarter=20, referenceGuidesAfterQuarters=[20, 24], metricOrder=list(METRICS), units=dict(afr='percent', afrDelta='percentage_points', count='drives', populationDelta='drives', new='drives', retired='drives', failed='daily_failure_flags', exposure='recorded_drive_days')),
        colorScales=dict(scope='all_numeric_eligible_cells_in_snapshot', percentile='inclusive_linear_n_minus_1', interpolation='srgb_piecewise_linear_round_half_up', domains=color_domains(models)), models=models)
    validate_matrix(result)
    return result


if __name__ == '__main__':
    for later in (False, True):
        data = build(later)
        (Path(__file__).parent / ('synthetic-later.json' if later else 'synthetic-earlier.json')).write_text(json.dumps(data, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    (Path(__file__).parent / 'synthetic-correction.json').write_text(json.dumps(build(corrected=True), indent=2, allow_nan=False) + '\n', encoding='utf-8')
