import { activePublishedView, publishedViews, publishedViewUrl } from './app-route.ts';
import type { NavigationContext } from './app-route.ts';
import './published-navigation.css';

let navigationContext: NavigationContext | undefined;

/** A persistent shell keeps navigation focus and collapse state across report renders. */
export function mountPublishedNavigation() {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = `<div class="published-shell"><aside class="published-sidebar" aria-label="Data navigation"><div class="published-nav-heading"><a class="published-brand" href="?view=matrix">DriveStats</a><button type="button" id="navigation-toggle" aria-controls="published-navigation" aria-expanded="true" aria-label="Collapse navigation" title="Collapse navigation">‹</button></div><div id="published-navigation"><p class="published-nav-label">EXPLORE THE DATA</p><nav aria-label="Published data views">${publishedViews.map((view) => `<a id="view-${view.id}" class="published-nav-item" aria-label="${view.label}"><span aria-hidden="true">${view.icon}</span><span class="published-nav-text">${view.label}</span></a>`).join('')}</nav><details class="published-secondary"><summary>More context & references</summary><a id="context-link">Model context</a><a id="legacy-link">Original quarterly explorer</a><a id="reference-link">Workbook & synthetic references</a></details></div></aside><div id="route-content" class="published-content"></div></div>`;
  const toggle = document.querySelector<HTMLButtonElement>('#navigation-toggle')!;
  const shell = document.querySelector<HTMLDivElement>('.published-shell')!;
  const applyCollapsed = (collapsed: boolean) => {
    shell.classList.toggle('navigation-collapsed', collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    const label = collapsed ? 'Expand navigation' : 'Collapse navigation';
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    toggle.textContent = collapsed ? '›' : '‹';
  };
  applyCollapsed(new URLSearchParams(location.search).get('nav') === 'collapsed');
  toggle.onclick = () => {
    const collapsed = !shell.classList.contains('navigation-collapsed');
    applyCollapsed(collapsed);
    const url = new URL(location.href);
    if (collapsed) {
      url.searchParams.set('nav', 'collapsed');
    } else {
      url.searchParams.delete('nav');
    }
    history.replaceState(null, '', url);
    updatePublishedNavigation(navigationContext);
  };
  updatePublishedNavigation();
  return document.querySelector<HTMLDivElement>('#route-content')!;
}

export function updatePublishedNavigation(context?: NavigationContext) {
  navigationContext = context;
  const params = new URLSearchParams(location.search);
  const active = activePublishedView(params);
  for (const view of publishedViews) {
    const link = document.querySelector<HTMLAnchorElement>(`#view-${view.id}`);
    if (!link) {
      continue;
    }
    link.href = publishedViewUrl(location.href, view.id, context).href;
    if (active === view.id) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  }
  const contextUrl = publishedViewUrl(location.href, 'distribution', context);
  contextUrl.searchParams.set('view', 'explore');
  const legacy = new URL(contextUrl);
  legacy.searchParams.set('view', 'reliability');
  legacy.searchParams.delete('snapshot');
  const reference = publishedViewUrl(location.href, 'matrix', context);
  reference.searchParams.set('reference', '1');
  reference.searchParams.delete('snapshot');
  for (const [id, url] of [
    ['context-link', contextUrl],
    ['legacy-link', legacy],
    ['reference-link', reference],
  ] as const) {
    const link = document.querySelector<HTMLAnchorElement>(`#${id}`);
    if (link) {
      link.href = url.href;
    }
  }
}
