import type { StaticPicksContext } from './static-picks-context.ts';
import type { MatrixCapsule, PresentationCatalogue } from './presentation-data.ts';
import { renderPicks } from './owner-picks-render.ts';
import { renderPublishedNavigation } from './published-navigation-render.ts';
import { editorialUpdateDate, reviewedSnapshotId } from './owner-picks-data.ts';
const esc = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
export { parseStaticPicksContext } from './static-picks-context.ts';
export function staticPicksContext(catalogue: PresentationCatalogue): StaticPicksContext {
  return {
    contractVersion: 1,
    sourceIndexSha256: catalogue.sourceIndexSha256,
    latestSnapshotId: catalogue.latestSnapshotId,
    asOfQuarter:
      catalogue.snapshots.find((s) => s.snapshotId === catalogue.latestSnapshotId)?.asOfQuarter ??
      null,
  };
}
export function renderStaticPicks(
  catalogue: PresentationCatalogue,
  capsule: MatrixCapsule | undefined,
): string {
  const latest = catalogue.snapshots.find((s) => s.snapshotId === catalogue.latestSnapshotId);
  if (
    capsule &&
    (!latest ||
      capsule.snapshotId !== latest.snapshotId ||
      capsule.asOfQuarter !== latest.asOfQuarter ||
      capsule.contextSha256 !== latest.contextSha256 ||
      capsule.sourceManifestSha256 !== latest.sourceManifestSha256 ||
      JSON.stringify(capsule.descriptor) !== JSON.stringify(latest.descriptor))
  ) {
    throw new Error('Static picks latest binding mismatch');
  }
  const update =
    latest?.snapshotId === reviewedSnapshotId
      ? `Updated: <strong>${esc(editorialUpdateDate)}</strong> using Backblaze data from <strong>${esc(latest.asOfQuarter.replace('-', ' '))}</strong>.`
      : `Latest published data: <strong>${esc(latest?.asOfQuarter.replace('-', ' ') ?? 'unavailable')}</strong>`;
  const heading = `<main id="main"><header class="topbar"><span>BACKBLAZE DRIVE STATS / WHAT I’D BUY</span></header><div class="page picks-page"><section class="page-heading"><div><p class="eyebrow">AN EDITORIAL SHORTLIST</p><h1>What I’d Buy</h1><p class="subtitle">My shortlist for a replacement drive, based on observed reliability and a substantial deployment history.</p><p>${update}</p></div></section>`;
  const methodology = `<details class="methodology panel"><summary>How these picks were chosen</summary><div class="methodology-body"><p>The public factual screen is nominal capacity ≥16 TB, at least 20,000 observed drives in the selected latest quarter, and at least eight completed calendar-quarter positions from the reporting anchor (the first proven quarter meeting the 2,000-drive threshold); twelve are preferred. A complete latest quarter is required. Editorial inclusion also requires a recorded reliability review for this exact snapshot.</p><p>The shortlist is curated, not a trained score, exhaustive ranking or statistically certified recommendation. Passing the screen alone does not make a model a pick. AFR = recorded failures ÷ recorded drive-days × 365 × 100. Cumulative AFR includes available pre-anchor exposure; gaps are not imputed. A calendar position is not proof of complete data for that quarter.</p><p>Backblaze’s deployment conditions may differ from yours. Current manufacture, availability and system compatibility have not been verified. Check those before buying.</p><p><a href="https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data" target="_blank" rel="noreferrer">Backblaze source data ↗</a> · <a href="https://github.com/SixbucksSolutions/backblaze-drive-stats/blob/main/docs/owners-picks.md" target="_blank" rel="noreferrer">Open selection rules ↗</a></p></div></details></div></main>`;
  const body = capsule
    ? renderPicks(capsule)
    : '<section class="state-panel"><h2>Latest selection awaiting review.</h2><p>The latest published snapshot is unavailable. No older selection is substituted.</p></section>';
  const content = `${heading}<div id="picks-results" aria-busy="false">${body}</div>${methodology}`;
  let shell = renderPublishedNavigation(content);
  for (const [id, view] of [
    ['picks', 'picks'],
    ['afr', 'afr'],
    ['matrix', 'matrix'],
    ['deployments', 'deployments'],
    ['distribution', 'distribution'],
    ['capacity', 'capacity'],
    ['manufacturers', 'manufacturers'],
    ['datacenters', 'datacenters'],
    ['context-link', 'explore'],
    ['legacy-link', 'reliability'],
    ['reference-link', 'matrix'],
  ] as const) {
    const linkId = id.endsWith('-link') ? id : `view-${id}`;
    const href = `?view=${view}${id !== 'picks' && id !== 'legacy-link' && id !== 'reference-link' && latest ? `&amp;snapshot=${encodeURIComponent(latest.snapshotId)}` : ''}${id === 'reference-link' ? '&amp;reference=1' : ''}`;
    shell = shell.replace(
      `id="${linkId}"`,
      `id="${linkId}" href="${href}"${id === 'picks' ? ' aria-current="page"' : ''}`,
    );
  }
  return `<div id="static-picks-root">${shell}</div>`;
}
