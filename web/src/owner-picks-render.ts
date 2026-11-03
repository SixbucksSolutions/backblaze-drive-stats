import { formatAfr } from './afr-format.ts';
import { reviewedPicks, reviewedSnapshotId } from './owner-picks-data.ts';
import { pickBrandPaint } from './owner-picks-brand.ts';
import type { MatrixCapsule } from './presentation-data.ts';

const esc = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
const integer = new Intl.NumberFormat('en-US');
const rate = (value: number | null) => (value === null ? 'Unavailable' : `${formatAfr(value)}%`);

export function renderPicks(capsule: MatrixCapsule): string {
  if (capsule.snapshotId !== reviewedSnapshotId || capsule.body.kind !== 'production') {
    return `<section class="state-panel"><h2>Latest selection awaiting review.</h2><p>The latest published data is shown here only after its editorial review. No older selection is substituted.</p></section>`;
  }
  const picks = reviewedPicks(capsule);
  if (picks.every((pick) => !pick.model)) {
    return '<section class="state-panel"><h2>Reviewed models are unavailable.</h2><p>This snapshot contains no matching evidence. No substitute models are shown.</p></section>';
  }
  return `<div class="picks-grid">${picks
    .map(({ name, model, evidence }) => {
      if (!model || !evidence) {
        return `<article class="panel pick-card"><h2>${esc(name)}</h2><p>Evidence unavailable. This pick cannot be evaluated.</p></article>`;
      }
      if (!evidence.eligible) {
        return `<article class="panel pick-card"><h2>${esc(name)}</h2><p>Not currently included: size, population or history evidence does not meet the criteria.</p></article>`;
      }
      const brand = model.vendor === 'HGST/WD' ? 'WD' : model.vendor;
      const paint = pickBrandPaint(model.vendor);
      const matrixHref = `?view=matrix&snapshot=${encodeURIComponent(capsule.snapshotId)}`;
      return `<article class="panel pick-card"><h2>${esc(brand)} <span class="pick-model" style="--pick-model-background:${paint.background};--pick-model-foreground:${paint.foreground}">${esc(name)}</span> (${esc(evidence.capacityTB)} TB)</h2><dl class="pick-metrics"><div class="pick-metric-wide"><dt>Drive count</dt><dd>${evidence.count === null ? 'Unavailable' : integer.format(evidence.count)}</dd></div><div class="pick-metric-wide"><dt>Years deployed at Backblaze</dt><dd>${evidence.elapsedQuarters === null ? 'Unavailable' : (evidence.elapsedQuarters / 4).toFixed(2)}</dd></div><div><dt>Cumulative AFR</dt><dd>${rate(evidence.cumulativeAfr)}</dd></div><div><dt>Quarterly AFR</dt><dd>${rate(evidence.quarterlyAfr)}</dd></div></dl><details class="pick-evidence"><summary>History & coverage</summary><p class="small">First recorded ${esc(evidence.firstQuarter ?? 'unavailable')} → ${esc(capsule.asOfQuarter)} (${evidence.elapsedQuarters === null ? 'unknown' : integer.format(evidence.elapsedQuarters)} completed calendar-quarter positions). Reporting anchor: ${esc(model.anchor ?? 'unavailable')}. ${evidence.preferredHistory ? 'Meets the preferred 12-quarter history.' : 'Below the preferred 12-quarter history.'} This is model deployment history, not the age of individual drives.</p><p class="small">${evidence.completeHistory ? 'Source history through this quarter is complete within the declared window.' : 'Source history has gaps: cumulative AFR uses recorded exposure only, without filling missing days.'} Earlier lifetime exposure is not established.</p></details><div class="pick-links"><a href="https://pcpartpicker.com/search/?q=${encodeURIComponent(name)}" target="_blank" rel="noreferrer">Search PCPartPicker ↗</a><a href="${matrixHref}">Inspect this snapshot’s AFR comparison →</a></div></article>`;
    })
    .join('')}</div>`;
}
