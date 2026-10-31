export type Quarter = `${number}-Q${1 | 2 | 3 | 4}`;
export type DataKind = 'sample' | 'backblaze';
export interface Model {
  id: string;
  manufacturer: string;
  model: string;
  capacityTb: number;
  driveCount: number;
  driveDays: number;
  failures: number;
  quarterlyAfr: number;
  cumulativeAfr: number;
  newDrives: number;
  lastObservedDrives: number;
}
export interface History {
  quarter: Quarter;
  driveCount: number;
  driveDays: number;
  failures: number;
  quarterlyAfr: number;
  capacityTb: number;
  newDrives: number;
}
export interface Bundle {
  schemaVersion: 1;
  quarter: Quarter;
  period: { start: string; end: string };
  provenance: {
    kind: DataKind;
    sourceUrl: string;
    generatedAt: string;
    coverageStart: string;
    coverageEnd: string;
    metadataUri?: string;
    notes: string[];
  };
  models: Model[];
  capacityByDatacenter: { datacenter: string; capacityTb: number; driveCount: number }[];
  history: History[];
}
export interface Manifest {
  schemaVersion: 1;
  quarters: { quarter: Quarter; label: string; url: string; kind: DataKind }[];
}
export const quarterPattern = /^\d{4}-Q[1-4]$/;
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const count = (value: unknown) => number(value) && Number.isSafeInteger(value);
const date = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value).toISOString().slice(0, 10) === value;
const kind = (value: unknown): value is DataKind => value === 'sample' || value === 'backblaze';
const quarter = (value: unknown): value is Quarter => typeof value === 'string' && quarterPattern.test(value);
function require(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid data: ${message}`);
}
export function parseManifest(input: unknown): Manifest {
  require(object(input) && input.schemaVersion === 1 && Array.isArray(input.quarters) && input.quarters.length > 0, 'quarter index is empty or unsupported.');
  const seen = new Set<string>();
  for (const entry of input.quarters) {
    require(object(entry) && quarter(entry.quarter) && text(entry.label) && entry.url === `${entry.quarter}.json` && kind(entry.kind), 'quarter index contains an invalid entry.');
    require(!seen.has(entry.quarter), 'duplicate quarter in index.');
    seen.add(entry.quarter);
  }
  return input as unknown as Manifest;
}
export function parseBundle(input: unknown, expectedQuarter: Quarter, expectedKind: DataKind): Bundle {
  require(object(input) && input.schemaVersion === 1 && input.quarter === expectedQuarter, 'quarter file does not match the selection.');
  const { period, provenance, models, capacityByDatacenter, history } = input;
  require(object(period) && date(period.start) && date(period.end) && period.start <= period.end, 'invalid reporting dates.');
  require(object(provenance) && provenance.kind === expectedKind && text(provenance.sourceUrl) && /^https?:\/\//.test(provenance.sourceUrl) && text(provenance.generatedAt) && Number.isFinite(Date.parse(provenance.generatedAt)) && date(provenance.coverageStart) && date(provenance.coverageEnd) && provenance.coverageStart <= period.start && provenance.coverageEnd >= period.end && Array.isArray(provenance.notes) && provenance.notes.every(text), 'invalid source information.');
  require(Array.isArray(models) && Array.isArray(capacityByDatacenter) && Array.isArray(history), 'missing report collections.');
  const seen = new Set<string>();
  for (const row of models) {
    require(object(row) && text(row.id) && text(row.manufacturer) && text(row.model) && number(row.capacityTb) && row.capacityTb > 0 && ['driveCount', 'driveDays', 'failures', 'newDrives', 'lastObservedDrives'].every(key => count(row[key])) && number(row.quarterlyAfr) && number(row.cumulativeAfr), 'invalid model metrics.');
    require(!seen.has(row.id) && Number(row.failures) <= Number(row.driveDays) && Number(row.newDrives) <= Number(row.driveCount) && Number(row.lastObservedDrives) <= Number(row.driveCount), 'inconsistent model metrics.');
    seen.add(row.id);
  }
  for (const row of capacityByDatacenter) require(object(row) && text(row.datacenter) && number(row.capacityTb) && count(row.driveCount), 'invalid datacenter metrics.');
  const historySeen = new Set<string>();
  for (const row of history) {
    require(object(row) && quarter(row.quarter) && row.quarter <= expectedQuarter && !historySeen.has(row.quarter) && ['driveCount', 'driveDays', 'failures', 'newDrives'].every(key => count(row[key])) && number(row.quarterlyAfr) && number(row.capacityTb), 'invalid history metrics.');
    historySeen.add(row.quarter);
  }
  return input as unknown as Bundle;
}
export function summarize(models: Model[]) {
  const sum = (key: keyof Model) => models.reduce((total, row) => total + Number(row[key]), 0);
  const driveDays = sum('driveDays');
  const failures = sum('failures');
  return {
    driveCount: sum('driveCount'), driveDays, failures,
    quarterlyAfr: driveDays ? failures / driveDays * 36500 : 0,
    capacityTb: models.reduce((total, row) => total + row.capacityTb * row.driveCount, 0),
    newDrives: sum('newDrives'),
  };
}
export function groupManufacturers(models: Model[]) {
  const groups = new Map<string, Model[]>();
  for (const row of models) groups.set(row.manufacturer, [...(groups.get(row.manufacturer) ?? []), row]);
  return [...groups].map(([manufacturer, rows]) => ({ manufacturer, ...summarize(rows), modelCount: rows.length })).sort((a, b) => b.capacityTb - a.capacityTb);
}
export function csv(rows: (string | number)[][]): string {
  return rows.map(row => row.map(value => {
    let cell = String(value);
    if (/^[=+@\-\t\r]/.test(cell)) cell = `'${cell}`;
    return `"${cell.replaceAll('"', '""')}"`;
  }).join(',')).join('\r\n');
}
