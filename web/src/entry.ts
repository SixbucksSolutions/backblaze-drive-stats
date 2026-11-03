import { appRoute } from './app-route.ts';
import { UI_FONTS, waitForFonts, withStartupDeadline } from './font-ready.ts';
import { mountPublishedNavigation, updatePublishedNavigation } from './published-navigation.ts';
import { parseStaticPicksContext } from './static-picks-context.ts';
import type { CatalogueHost, PresentationHost } from './presentation-bootstrap.ts';

async function start() {
  if (appRoute(new URLSearchParams(location.search)) !== 'picks') {
    const startup = new AbortController();
    try {
      await withStartupDeadline(async () => {
        const analytics = await import('./main.ts');
        startup.signal.throwIfAborted();
        await analytics.startAnalytics(startup);
      }, startup);
    } catch {
      startup.abort();
      const host = window as CatalogueHost & PresentationHost;
      host.__analyticsCatalogueInitial?.controller.abort();
      host.__presentationInitial?.controller.abort();
      delete host.__analyticsCatalogueInitial;
      delete host.__presentationInitial;
      document.querySelector('#app')!.innerHTML =
        '<main><section class="state-panel error" role="alert"><h1>Unable to open the explorer</h1><p>Loading did not complete. Reload the page to try again.</p></section></main>';
      document.documentElement.dataset.fontMode = 'fallback';
      document.documentElement.dataset.appReady = 'true';
      document.documentElement.classList.remove('app-pending');
    }
    return;
  }
  const mode = waitForFonts(document.fonts, 5000, UI_FONTS);
  document.title = 'What I’d Buy · DriveStats';
  try {
    const contexts = document.querySelectorAll('#static-picks-context');
    if (contexts.length !== 1 || !document.querySelector('#static-picks-root')) {
      throw new Error('Static picks unavailable');
    }
    const context = parseStaticPicksContext(JSON.parse(contexts[0]!.textContent ?? '') as unknown);
    const canonical = new URL(location.href);
    canonical.searchParams.delete('snapshot');
    canonical.searchParams.delete('quarter');
    history.replaceState(null, '', canonical);
    mountPublishedNavigation();
    updatePublishedNavigation(
      context.asOfQuarter ? { snapshotId: context.latestSnapshotId, kind: 'backblaze' } : undefined,
    );
  } catch {
    document.querySelector('#app')!.innerHTML =
      '<main><section class="state-panel error" role="alert"><h1>What I’d Buy unavailable</h1><p>The published page context could not be loaded. Reload the page to retry.</p></section></main>';
  }
  document.documentElement.dataset.fontMode = await mode;
  document.documentElement.dataset.appReady = 'true';
  document.documentElement.classList.remove('app-pending');
}
void start();
