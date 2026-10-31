// Illustrative development fixtures only. No figures here are Backblaze results.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const destination = fileURLToPath(new URL('../test/fixtures/data/', import.meta.url));
mkdirSync(destination, { recursive: true });
const definitions = [
  ['Seagate', 'ST16000NM001G', 16, 16420, 83, 1100],
  ['Toshiba', 'MG08ACA16TE', 16, 13820, 36, 1580],
  ['WDC/HGST', 'WUH722222ALE6L4', 22, 11580, 18, 2340],
  ['Toshiba', 'MG10ACA20TE', 20, 9840, 29, 2010],
  ['Seagate', 'ST14000NM001G', 14, 8270, 74, 410],
  ['WDC/HGST', 'WUH721816ALE6L4', 16, 7850, 17, 680],
  ['Seagate', 'ST12000NM0008', 12, 6810, 61, 190],
  ['Toshiba', 'MG11ACA24TE', 24, 5680, 12, 1820],
  ['Seagate', 'ST24000NM002H', 24, 4320, 34, 1500],
  ['WDC/HGST', 'HUH721212ALE604', 12, 3210, 41, 60],
  ['Seagate', 'ST18000NM000J', 18, 1640, 7, 620],
  ['WDC/HGST', 'WUH722626ALE6L4', 26, 780, 2, 510],
];
const afr = (failures, days) => failures / days * 36500;
const aggregate = models => {
  const sum = key => models.reduce((total, row) => total + row[key], 0);
  return { driveCount: sum('driveCount'), driveDays: sum('driveDays'), failures: sum('failures'), quarterlyAfr: afr(sum('failures'), sum('driveDays')), capacityTb: models.reduce((total, row) => total + row.capacityTb * row.driveCount, 0), newDrives: sum('newDrives') };
};
const history = [];
for (let index = 0; index < 3; index++) {
  const quarter = ['2025-Q4', '2026-Q1', '2026-Q2'][index];
  const period = [{ start: '2025-10-01', end: '2025-12-31' }, { start: '2026-01-01', end: '2026-03-31' }, { start: '2026-04-01', end: '2026-06-30' }][index];
  const models = definitions.map(([manufacturer, model, capacityTb, population, failureCount, newCount], i) => {
    const driveCount = Math.round(population * (0.79 + index * 0.105));
    const driveDays = driveCount * (index === 1 ? 83 : 85);
    const failures = Math.round(failureCount * (0.73 + index * 0.135));
    return { id: `${manufacturer}-${model}`, manufacturer, model, capacityTb, driveCount, driveDays, failures, quarterlyAfr: afr(failures, driveDays), cumulativeAfr: afr(failures + 18 + i * 4, driveDays + population * 120), newDrives: Math.min(driveCount, Math.round(newCount * (0.7 + index * 0.15))), lastObservedDrives: failures + 5 + i * 3 };
  });
  history.push({ quarter, ...aggregate(models) });
  const capacityByDatacenter = ['SAC1', 'PHX1', 'AMS1', 'Unknown'].map(datacenter => ({ datacenter, capacityTb: 0, driveCount: 0 }));
  for (const model of models) {
    let remaining = model.driveCount;
    for (let dc = 0; dc < 4; dc++) {
      const count = dc === 3 ? remaining : Math.floor(model.driveCount * [0.45, 0.34, 0.2][dc]);
      remaining -= count;
      capacityByDatacenter[dc].driveCount += count;
      capacityByDatacenter[dc].capacityTb += count * model.capacityTb;
    }
  }
  const bundle = { schemaVersion: 1, quarter, period, provenance: { kind: 'sample', sourceUrl: 'https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data', generatedAt: '2026-10-30T12:00:00Z', coverageStart: '2025-10-01', coverageEnd: period.end, notes: ['All values in this bundle are invented development fixtures, not observed Backblaze results.', 'Illustrative cumulative AFR values demonstrate the interface; they are not a reconstructed historical series.', 'Datacenter allocations reconcile to the sample fleet and do not represent actual Backblaze locations or distribution.'] }, models, capacityByDatacenter, history: [...history] };
  writeFileSync(`${destination}/${quarter}.json`, JSON.stringify(bundle, null, 2) + '\n');
}
writeFileSync(`${destination}/index.json`, JSON.stringify({ schemaVersion: 1, quarters: ['2026-Q2', '2026-Q1', '2025-Q4'].map(quarter => ({ quarter, label: `${quarter.slice(0, 4)} ${quarter.slice(5)}`, url: `${quarter}.json`, kind: 'sample' })) }, null, 2) + '\n');
