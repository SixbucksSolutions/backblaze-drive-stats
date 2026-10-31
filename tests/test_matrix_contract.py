"""Production contract examples are fictional and separate from workbook goldens."""
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import unittest
from tempfile import TemporaryDirectory

from tools.validate_matrix_contract import color_domains, color_for, load_matrix, rate, validate_matrix

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / 'fixtures/matrix'


def load(name='earlier'):
    return json.loads((FIXTURES / f'synthetic-{name}.json').read_text())


class MatrixContractTests(unittest.TestCase):
    def test_both_synthetic_snapshots_validate_and_rebuild(self):
        spec = importlib.util.spec_from_file_location('build_synthetic', FIXTURES / 'build_synthetic.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for later, name in ((False, 'earlier'), (True, 'later')):
            data = load(name)
            self.assertEqual(validate_matrix(data), module.build(later))
            self.assertIn('SYNTHETIC TEST DATA', data['provenance']['dataSourceNotice'])
        self.assertEqual(validate_matrix(load('correction')), module.build(corrected=True))

    def test_threshold_reentry_retains_calendar_age_and_previous_eligible(self):
        cells = load()['models'][0]['cells']
        self.assertEqual(cells[0]['metrics']['count'], 2000)
        self.assertEqual(cells[1]['state'], 'below_threshold')
        self.assertEqual(cells[1]['observations']['count'], 1999)
        self.assertTrue(all(v is None for v in cells[1]['metrics'].values()))
        self.assertEqual(cells[2]['relativeQuarter'], 3)
        self.assertEqual(cells[2]['quarter'], '2024-Q3')
        self.assertEqual(cells[2]['deltaBaseline']['priorQuarter'], '2024-Q1')
        self.assertEqual(cells[2]['deltaBaseline']['elapsedQuarters'], 2)
        self.assertEqual(cells[2]['metrics']['populationDelta'], 200)

    def test_prethreshold_history_and_zero_current_failures(self):
        model = load()['models'][0]
        cell = model['cells'][0]
        self.assertEqual(cell['metrics']['failed'], 0)
        self.assertEqual(cell['quarterAfr'], 0)
        self.assertGreater(cell['metrics']['afr'], 0)
        self.assertEqual(cell['cumulativeComponents']['driveDays'], 280000)
        self.assertAlmostEqual(cell['metrics']['afr'], 36500 / 280000)
        self.assertEqual(cell['deltaBaseline']['kind'], 'initial_zero')

    def test_gap_unknown_rate_visible_counts_and_snapshot_end(self):
        cells = load('later')['models'][0]['cells']
        self.assertEqual([c['state'] for c in cells[4:8]], ['source_missing', 'source_incomplete', 'eligible', 'snapshot_end'])
        self.assertIsNone(cells[4]['observations']['count'])
        self.assertIsNotNone(cells[5]['observations']['count'])
        self.assertIsNone(cells[6]['metrics']['afr'])
        self.assertEqual(cells[6]['rateUnavailableReason'], 'incomplete_cumulative_coverage')
        self.assertEqual(cells[6]['metrics']['count'], 2600)
        self.assertIsNotNone(cells[6]['quarterAfr'])
        self.assertEqual(cells[6]['deltaBaseline']['priorQuarter'], '2024-Q4')
        self.assertEqual(cells[6]['deltaBaseline']['elapsedQuarters'], 3)
        self.assertEqual(cells[6]['retirementInference'], 'newest_quarter_failed_proxy')
        self.assertEqual(cells[6]['metrics']['retired'], cells[6]['metrics']['failed'])

    def test_revision_is_separate_immutable_snapshot(self):
        earlier, later = load(), load('later')
        self.assertEqual(later['snapshot']['revisionOf'], earlier['snapshot']['id'])
        self.assertNotEqual(later['snapshot']['immutablePath'], earlier['snapshot']['immutablePath'])
        self.assertNotEqual(earlier['models'][0]['cells'][0]['observations']['retired'], later['models'][0]['cells'][0]['observations']['retired'])
        self.assertEqual(load(), earlier)
        correction = load('correction')
        self.assertEqual(correction['snapshot']['asOfQuarter'], earlier['snapshot']['asOfQuarter'])
        self.assertEqual(correction['snapshot']['revisionOf'], earlier['snapshot']['id'])
        self.assertEqual(correction['models'][0]['cells'][0]['metrics']['retired'], 4)
        self.assertEqual(earlier['models'][0]['cells'][0]['metrics']['retired'], 6)
        self.assertNotEqual(correction['provenance']['sourceManifestSha256'], earlier['provenance']['sourceManifestSha256'])

    def test_exact_variants_and_guides_remain_distinct(self):
        data = load()
        self.assertEqual([m['modelNumber'] for m in data['models']], ['ST12000NM0007', 'ST12000NM0008'])
        self.assertNotEqual(data['models'][0]['cells'][0]['metrics'], data['models'][1]['cells'][0]['metrics'])
        self.assertEqual(data['display']['referenceGuidesAfterQuarters'], [20, 24])
        self.assertTrue(all(len(m['cells']) >= 24 and m['cells'][19]['state'] == 'snapshot_end' and m['cells'][23]['state'] == 'snapshot_end' for m in data['models']))

    def test_corruptions_are_rejected(self):
        def change(path, value):
            def mutate(data):
                node = data
                for key in path[:-1]:
                    node = node[key]
                node[path[-1]] = value
            return mutate

        cases = [
            ('arithmetic', ('models', 0, 'cells', 0, 'metrics', 'afr'), 4),
            ('exposure', ('models', 0, 'cells', 0, 'cumulativeComponents', 'driveDays'), 1),
            ('offset', ('models', 0, 'cells', 2, 'relativeQuarter'), 2),
            ('calendar', ('models', 0, 'cells', 2, 'quarter'), '2024-Q2'),
            ('baseline', ('models', 0, 'cells', 2, 'deltaBaseline', 'priorQuarter'), '2024-Q2'),
            ('baseline span', ('models', 0, 'cells', 2, 'deltaBaseline', 'elapsedQuarters'), 1),
            ('population delta', ('models', 0, 'cells', 2, 'metrics', 'populationDelta'), 201),
            ('eligibility', ('models', 0, 'cells', 0, 'observations', 'count'), 1999),
            ('coverage', ('coverage', 'quarters', 0, 'observedDays'), 2),
            ('duplicate coverage', ('coverage', 'quarters', 1, 'quarter'), '2023-Q4'),
            ('source linkage', ('coverage', 'quarters', 0, 'sourceIds'), ['unlisted']),
            ('cutoff', ('snapshot', 'cutoffDate'), '2024-12-30'),
            ('domain scope', ('colorScales', 'domains', 'count', 'sampleCount'), 1),
            ('domain knot', ('colorScales', 'domains', 'new', 'knots', 0, 'color'), '#000000'),
            ('privacy raw field', ('models', 0, 'serial_number'), 'forbidden-raw-identity'),
            ('privacy smart', ('models', 0, 'cells', 0, 'smart_9_raw'), 123),
            ('nonfinite', ('models', 0, 'cells', 0, 'metrics', 'afr'), float('nan')),
            ('snapshot as exit', ('models', 0, 'cells', 4, 'state'), 'below_threshold'),
            ('newest proxy', ('models', 0, 'cells', 3, 'retirementInference'), 'last_seen_before_boundary'),
        ]
        for label, path, value in cases:
            with self.subTest(label=label):
                data = load()
                change(path, value)(data)
                with self.assertRaises(ValueError):
                    validate_matrix(data)

    def test_gap_cannot_become_zero_or_complete(self):
        for path, value in [
            (('models', 0, 'cells', 6, 'metrics', 'afr'), 0),
            (('models', 0, 'cells', 6, 'cumulativeComponents', 'complete'), True),
            (('models', 0, 'cells', 4, 'state'), 'snapshot_end'),
        ]:
            data = load('later')
            node = data
            for key in path[:-1]:
                node = node[key]
            node[path[-1]] = value
            with self.assertRaises(ValueError):
                validate_matrix(data)

    def test_filtered_subset_cannot_rebase_shared_domains(self):
        data = load()
        data['colorScales']['domains'] = color_domains(data['models'][:1])
        with self.assertRaisesRegex(ValueError, 'shared color domain'):
            validate_matrix(data)

    def test_known_retirement_cannot_be_null_even_with_correct_domains(self):
        data = load()
        cell = data['models'][0]['cells'][0]
        cell['metrics']['retired'] = cell['observations']['retired'] = None
        data['colorScales']['domains'] = color_domains(data['models'])
        with self.assertRaisesRegex(ValueError, 'known retirement inference requires count'):
            validate_matrix(data)

    def test_selected_population_latest_date_can_precede_complete_source_end(self):
        data = load()
        data['coverage']['newestObservationDate'] = '2024-12-30'
        # Every daily source partition is valid through Dec 31; the selected
        # model population need not appear in the valid final day's partition.
        self.assertEqual(data['coverage']['quarters'][-1]['observedEnd'], '2024-12-31')
        validate_matrix(data)
        for invalid in ('2023-09-30', '2024-09-30', '2024-10-01', '2025-01-01'):
            data['coverage']['newestObservationDate'] = invalid
            with self.assertRaises(ValueError):
                validate_matrix(data)

    def test_partial_source_window_intersects_selected_observation_boundary(self):
        data = load('later')
        data['coverage']['newestObservationDate'] = '2025-06-10'
        partial = data['coverage']['quarters'][-2]
        partial['observedStart'], partial['observedEnd'] = '2025-06-10', '2025-06-19'
        missing = data['coverage']['quarters'][-1]
        missing.update(status='missing', observedDays=0, observedStart=None,
                       observedEnd=None, rowCount=0, sourceIds=[])
        for model in data['models']:
            model['asOfStatus'] = 'source_missing'
            model['finalEligibleQuarter'] = '2024-Q4'
            cell = model['cells'][6]
            cell.update(state='source_missing', eligibility='unknown', coverage='missing',
                        metrics={k: None for k in cell['metrics']},
                        observations={k: None for k in cell['observations']},
                        quarterComponents=dict(failures=0, driveDays=0, complete=False),
                        cumulativeComponents=deepcopy(model['cells'][5]['cumulativeComponents']),
                        quarterAfr=None, deltaBaseline=None, retirementInference='not_applicable',
                        rateUnavailableReason='not_displayed')
        data['colorScales']['domains'] = color_domains(data['models'])
        # The selected population's June 10 maximum leaves only one usable
        # observed day, although the validated source window spans ten days.
        with self.assertRaisesRegex(ValueError, 'population exposure bounds'):
            validate_matrix(data)
        data['coverage']['newestObservationDate'] = '2025-06-19'
        validate_matrix(data)

    def test_newest_failed_proxy_can_exceed_distinct_population(self):
        data = load()
        cells = data['models'][0]['cells']
        newest = cells[3]
        flags = newest['metrics']['count'] + 100
        self.assertLess(flags, newest['quarterComponents']['driveDays'])
        newest['metrics']['failed'] = newest['metrics']['retired'] = flags
        newest['observations']['failed'] = newest['observations']['retired'] = flags
        newest['cumulativeComponents']['failures'] += flags - newest['quarterComponents']['failures']
        newest['quarterComponents']['failures'] = flags
        newest['quarterAfr'] = rate(newest['quarterComponents'])
        newest['metrics']['afr'] = rate(newest['cumulativeComponents'])
        newest['metrics']['afrDelta'] = newest['metrics']['afr'] - newest['deltaBaseline']['afr']
        data['colorScales']['domains'] = color_domains(data['models'])
        validate_matrix(data)

    def test_integer_parity_is_exact_even_at_large_magnitudes(self):
        data = load()
        cell = data['models'][0]['cells'][0]
        population = 100000000000
        cell['metrics']['count'] = float(population)
        cell['observations']['count'] = float(population + 1)
        cell['quarterComponents']['driveDays'] = population + 1
        cell['cumulativeComponents']['driveDays'] = population + 100001
        # JSON Schema treats integer-valued floats as mathematical integers.
        # A tolerance intended for AFR must never hide a one-drive mismatch.
        with self.assertRaisesRegex(ValueError, 'observed metric'):
            validate_matrix(data)

    def test_integer_valued_json_numbers_preserve_exact_metric_value(self):
        data = load()
        cell = data['models'][0]['cells'][0]
        cell['metrics']['count'] = 2000.0
        cell['observations']['count'] = 2000.0
        validate_matrix(data)

    def test_selected_exposure_cannot_exceed_unfiltered_source_rows(self):
        data = load()
        for q in data['coverage']['quarters']:
            q['rowCount'] = 0
        with self.assertRaisesRegex(ValueError, 'exposure exceeds source rows'):
            validate_matrix(data)
        data = load()
        q1 = data['coverage']['quarters'][1]
        exposure = sum(m['cells'][0]['quarterComponents']['driveDays'] for m in data['models'])
        q1['rowCount'] = exposure - 1
        with self.assertRaisesRegex(ValueError, 'selected exposure exceeds source rows 2024-Q1'):
            validate_matrix(data)
        q1['rowCount'] = exposure
        validate_matrix(data)
        data = load()
        # Individually plausible pre-anchor summaries cannot collectively exceed
        # the unfiltered source rows available for their disjoint model records.
        for model in data['models']:
            model['preEligibilityComponents']['driveDays'] = 200000
            for cell in model['cells']:
                if cell['cumulativeComponents'] is not None:
                    cell['cumulativeComponents']['driveDays'] += 100000
                if cell['metrics']['afr'] is not None:
                    cell['metrics']['afr'] = rate(cell['cumulativeComponents'])
                    baseline = cell['deltaBaseline']
                    if baseline['kind'] == 'prior_eligible':
                        baseline['afr'] = next(c['metrics']['afr'] for c in model['cells'] if c['quarter'] == baseline['priorQuarter'])
                    cell['metrics']['afrDelta'] = cell['metrics']['afr'] - baseline['afr']
        # Restrict each quarter to exactly the known selected rows; unused
        # pre-anchor source rows are the only remaining budget for pre-exposure.
        for q in data['coverage']['quarters'][1:]:
            q['rowCount'] = sum(c['quarterComponents']['driveDays'] for m in data['models'] for c in m['cells'] if c['quarter'] == q['quarter'])
        data['colorScales']['domains'] = color_domains(data['models'])
        with self.assertRaisesRegex(ValueError, 'exposure exceeds source rows'):
            validate_matrix(data)

    def test_preanchor_prefix_cannot_borrow_later_source_row_budget(self):
        def revised_preanchor(second):
            data = load()
            for model, days in zip(data['models'], (184000, second)):
                delta = days - model['preEligibilityComponents']['driveDays']
                model['preEligibilityComponents']['driveDays'] = days
                for cell in model['cells']:
                    if cell['cumulativeComponents'] is not None:
                        cell['cumulativeComponents']['driveDays'] += delta
                    if cell['metrics']['afr'] is not None:
                        cell['metrics']['afr'] = rate(cell['cumulativeComponents'])
                        baseline = cell['deltaBaseline']
                        if baseline['kind'] == 'prior_eligible':
                            baseline['afr'] = next(c['metrics']['afr'] for c in model['cells'] if c['quarter'] == baseline['priorQuarter'])
                        cell['metrics']['afrDelta'] = cell['metrics']['afr'] - baseline['afr']
            data['colorScales']['domains'] = color_domains(data['models'])
            return data

        # Combined pre-anchor exposure exactly fits the 368,000 raw source rows.
        validate_matrix(revised_preanchor(184000))
        # A one-row deficit cannot be masked by unused source rows after anchor.
        with self.assertRaisesRegex(ValueError, 'selected preanchor prefix exposure exceeds source rows 2024-Q1'):
            validate_matrix(revised_preanchor(184001))

    def test_strict_file_reader_rejects_duplicate_keys_and_constants(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / 'matrix.json'
            for content in ('{"snapshot": 1, "snapshot": 2}', '{"x": NaN}', '{"x": Infinity}', '{"x": -Infinity}', '{"a":{"x":1,"x":2}}'):
                path.write_text(content)
                with self.assertRaises(ValueError):
                    load_matrix(path)
            path.write_text('{"x": 1}')
            self.assertEqual(load_matrix(path), {'x': 1})

    def test_privacy_sensitive_locations_and_credentials_rejected(self):
        for value in ('file:///private/data.zip', 'https://user:secret@example.org/input.zip', 'https://example.org/input.zip?token=secret', 's3://private-bucket/input.zip'):
            data = load()
            data['provenance']['sources'][0]['publicUrl'] = value
            with self.assertRaisesRegex(ValueError, 'source URL'):
                validate_matrix(data)
        data = load()
        data['snapshot']['immutablePath'] = 'C:/private/synthetic-earlier-v1/matrix.json'
        with self.assertRaisesRegex(ValueError, 'publication path'):
            validate_matrix(data)

    def test_rate_zero_exposure_and_incomplete_are_unavailable(self):
        self.assertIsNone(rate(dict(failures=0, driveDays=0, complete=True)))
        self.assertIsNone(rate(dict(failures=2, driveDays=100, complete=False)))
        self.assertEqual(rate(dict(failures=0, driveDays=100, complete=True)), 0)

    def test_effective_color_edge_domains(self):
        def domain(metric, values):
            models = [dict(cells=[dict(state='eligible', metrics={m: v if m == metric else None for m in ('afr', 'afrDelta', 'count', 'populationDelta', 'new', 'retired', 'failed')}) for v in values])]
            return color_domains(models)[metric]

        def knots(metric, values):
            return [(k['value'], k['color']) for k in domain(metric, values)['knots']]

        for metric in ('afr', 'afrDelta', 'count', 'populationDelta', 'new', 'retired', 'failed'):
            empty = domain(metric, [])
            self.assertEqual(empty['sampleCount'], 0)
            self.assertIsNone(empty['observedMinimum'])
            self.assertIsNone(empty['observedMedian'])
            self.assertIsNone(empty['observedMaximum'])
            self.assertEqual(empty['knots'], [])
            self.assertEqual(color_for(empty, 1), '#F2F2F2')
        self.assertEqual(knots('afr', [0]), [(0, '#00FF00'), (1, '#FFFF00'), (2, '#FF0000')])
        self.assertEqual(knots('afr', [1.2, 3]), [(1, '#FFFF00'), (2, '#FF0000')])
        self.assertEqual(color_for(domain('afr', [1.2, 3]), 3), '#FF0000')
        self.assertEqual(knots('afrDelta', [-2, -1]), [(-2, '#00FF00'), (0, '#FFFFFF')])
        self.assertEqual(knots('afrDelta', [1, 3]), [(0, '#FFFFFF'), (3, '#FF0000')])
        self.assertEqual(knots('populationDelta', [-2, 3]), [(-2, '#FF0000'), (0, '#FFFFFF'), (3, '#00FF00')])
        self.assertEqual(knots('populationDelta', [0, 0]), [(0, '#FFFFFF')])
        self.assertEqual(knots('count', [2, 2]), [(2, '#FFFF00')])
        self.assertEqual(knots('count', [1, 1, 3]), [(1, '#FFFF00'), (3, '#00FF00')])
        self.assertEqual(knots('count', [1, 3, 3]), [(1, '#FF0000'), (3, '#FFFF00')])
        self.assertEqual(knots('failed', [0, 0]), [(0, '#00FF00')])
        self.assertEqual(knots('failed', [1, 3, 3]), [(1, '#00FF00'), (3, '#FFFF00')])
        self.assertEqual(knots('new', [0, 0]), [(0, '#FFFFFF')])
        self.assertEqual(knots('retired', [0, 0]), [(0, '#00FF00')])
        self.assertEqual(knots('retired', [0, 0, 3]), [(0, '#00FF00'), (3, '#FF0000')])
        self.assertEqual(knots('retired', [0, 3, 3]), [(0, '#00FF00'), (3, '#FFFF00')])
        even = domain('count', [1, 2, 8, 100])
        self.assertEqual(even['observedMedian'], 5)
        self.assertEqual(domain('count', [9])['knots'], [dict(value=9, color='#FFFF00')])

    def test_piecewise_rgb_half_up_exact_knots_and_clamps(self):
        domain = dict(knots=[dict(value=0, color='#00FF00'), dict(value=1, color='#FFFF00'), dict(value=2, color='#FF0000')], emptyColor='#F2F2F2')
        expectations = [(-10, '#00FF00'), (0, '#00FF00'), (0.5, '#80FF00'), (1, '#FFFF00'), (1.5, '#FF8000'), (2, '#FF0000'), (20, '#FF0000'), (None, '#F2F2F2')]
        for value, expected in expectations:
            self.assertEqual(color_for(domain, value), expected)
        domain['knots'] = [dict(value=2, color='#FFFF00')]
        self.assertEqual(color_for(domain, -100), '#FFFF00')
        self.assertEqual(color_for(domain, 100), '#FFFF00')


if __name__ == '__main__':
    unittest.main()
