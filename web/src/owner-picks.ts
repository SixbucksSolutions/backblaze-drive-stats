import './owner-picks.css';
import { PresentationLoader, presentationCatalogue } from './presentation-loader.ts';
import { updatePublishedNavigation } from './published-navigation.ts';
import { renderPicks } from './owner-picks-render.ts';

const esc = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
export async function initOwnerPicks(signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  document.title = 'What I’d Buy · DriveStats';
  const app = document.querySelector<HTMLDivElement>('#route-content')!;
  const params = new URLSearchParams(location.search);
  let catalogue;
  try {
    catalogue = presentationCatalogue();
  } catch {
    app.innerHTML =
      '<main id="main"><section class="state-panel error" role="alert"><h1>What I’d Buy unavailable</h1><p>The snapshot catalogue could not be loaded. Reload the page to retry.</p></section></main>';
    return;
  }
  const loader = new PresentationLoader(
    catalogue,
    fetch,
    undefined,
    new URL(import.meta.env.BASE_URL, location.href).href,
  );
  const selection = loader.selection(params);
  const canonical = new URL(location.href);
  canonical.searchParams.delete('snapshot');
  canonical.searchParams.delete('quarter');
  history.replaceState(null, '', canonical);
  const latest = catalogue.snapshots.find((item) => item.snapshotId === catalogue.latestSnapshotId);
  const heading = `<main id="main"><header class="topbar"><span>BACKBLAZE DRIVE STATS / WHAT I’D BUY</span></header><div class="page picks-page"><section class="page-heading"><div><p class="eyebrow">AN EDITORIAL SHORTLIST</p><h1>What I’d Buy</h1><p class="subtitle">My shortlist for a replacement drive, based on observed reliability and a substantial deployment history.</p><p>Latest published data: <strong>${esc(latest?.asOfQuarter ?? 'unavailable')}</strong></p></div></section>`;
  const methodology = `<details class="methodology panel"><summary>How these picks were chosen</summary><div class="methodology-body"><p>The public factual screen is nominal capacity ≥16 TB, at least 20,000 observed drives in the selected latest quarter, and at least eight completed calendar-quarter positions from the reporting anchor (the first proven quarter meeting the 2,000-drive threshold); twelve are preferred. A complete latest quarter is required. Editorial inclusion also requires a recorded reliability review for this exact snapshot.</p><p>The shortlist is curated, not a trained score, exhaustive ranking or statistically certified recommendation. Passing the screen alone does not make a model a pick. AFR = recorded failures ÷ recorded drive-days × 365 × 100. Cumulative AFR includes available pre-anchor exposure; gaps are not imputed. A calendar position is not proof of complete data for that quarter.</p><p>Backblaze’s deployment conditions may differ from yours. Current manufacture, availability and system compatibility have not been verified. Check those before buying.</p><p><a href="https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data" target="_blank" rel="noreferrer">Backblaze source data ↗</a> · <a href="https://github.com/SixbucksSolutions/backblaze-drive-stats/blob/main/docs/owners-picks.md" target="_blank" rel="noreferrer">Open selection rules ↗</a></p></div></details></div></main>`;
  const render = (body: string, loading = false) => {
    app.innerHTML = `${heading}<div id="picks-results" aria-busy="${loading}">${body}</div>${methodology}`;
    updatePublishedNavigation(
      selection ? { snapshotId: selection.snapshotId, kind: 'backblaze' } : undefined,
    );
  };
  if (!selection) {
    render(
      `<section class="state-panel"><h2>Latest selection awaiting review.</h2><p>The latest published snapshot is unavailable. No older selection is substituted.</p></section>`,
    );
    return;
  }
  render('<div class="state-panel" role="status">Loading latest evidence…</div>', true);
  try {
    const capsule = await loader.load(selection, signal);
    signal?.throwIfAborted();
    if (capsule.kind !== 'matrix') {
      throw new Error('Expected matrix evidence.');
    }
    render(renderPicks(capsule));
  } catch {
    if (signal?.aborted) {
      return;
    }
    render(
      '<section class="state-panel error" role="alert"><h2>Evidence could not be loaded.</h2><p>No picks can be verified until this snapshot loads.</p><button class="button" id="picks-retry">Try again</button></section>',
    );
    app.querySelector<HTMLButtonElement>('#picks-retry')!.onclick = () => {
      location.reload();
    };
  }
}
