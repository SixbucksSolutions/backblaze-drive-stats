import { activePublishedView, publishedViews, publishedViewUrl } from './app-route.ts';
import type { NavigationContext } from './app-route.ts';
import './published-navigation.css';

let navigationContext: NavigationContext | undefined;
let dismissNavigationTooltip: (() => void) | undefined;

/** A persistent shell keeps navigation focus and collapse state across report renders. */
export function mountPublishedNavigation() {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = `<div class="published-shell"><aside class="published-sidebar" aria-label="Data navigation"><div class="published-nav-heading"><a class="published-brand" href="?view=matrix">DriveStats</a><button type="button" id="navigation-toggle" aria-controls="published-navigation" aria-expanded="true" aria-label="Collapse navigation" title="Collapse navigation">‹</button></div><div id="published-navigation"><p class="published-nav-label">EXPLORE THE DATA</p><nav aria-label="Published data views">${publishedViews.map((view) => `<a id="view-${view.id}" class="published-nav-item" aria-label="${view.label}"><span aria-hidden="true">${view.icon}</span><span class="published-nav-text">${view.label}</span></a>`).join('')}</nav><details class="published-secondary"><summary>More context & references</summary><a id="context-link">Model context</a><a id="legacy-link">Original quarterly explorer</a><a id="reference-link">Workbook & synthetic references</a></details></div></aside><div id="route-content" class="published-content"></div><div id="published-nav-tooltip" role="tooltip" hidden></div></div>`;
  const toggle = document.querySelector<HTMLButtonElement>('#navigation-toggle')!;
  const shell = document.querySelector<HTMLDivElement>('.published-shell')!;
  const tooltip = document.querySelector<HTMLDivElement>('#published-nav-tooltip')!;
  let hoveredLink: HTMLAnchorElement | undefined;
  let focusedLink: HTMLAnchorElement | undefined;
  let dismissedLink: HTMLAnchorElement | undefined;
  dismissNavigationTooltip = () => {
    dismissedLink = hoveredLink ?? focusedLink;
    tooltip.hidden = true;
  };
  const updateTooltip = () => {
    const link = hoveredLink ?? focusedLink;
    tooltip.hidden =
      !shell.classList.contains('navigation-collapsed') || !link || link === dismissedLink;
    if (tooltip.hidden || !link) {
      return;
    }
    tooltip.textContent = link.getAttribute('aria-label');
    const bounds = link.getBoundingClientRect();
    // Outside the sidebar's scroll container, with room to hover the label itself.
    tooltip.style.left = `${Math.max(4, Math.min(bounds.right, innerWidth - tooltip.offsetWidth - 4))}px`;
    tooltip.style.top = `${Math.max(4, Math.min(bounds.top, innerHeight - tooltip.offsetHeight - 4))}px`;
  };
  for (const link of shell.querySelectorAll<HTMLAnchorElement>('.published-nav-item')) {
    link.onpointerenter = () => {
      hoveredLink = link;
      dismissedLink = undefined;
      updateTooltip();
    };
    link.onpointerleave = (event) => {
      if (event.relatedTarget === tooltip) {
        return;
      }
      hoveredLink = undefined;
      updateTooltip();
    };
    link.onfocus = () => {
      focusedLink = link;
      dismissedLink = undefined;
      updateTooltip();
    };
    link.onblur = () => {
      focusedLink = undefined;
      updateTooltip();
    };
  }
  tooltip.onpointerleave = () => {
    hoveredLink = undefined;
    updateTooltip();
  };
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      dismissedLink = hoveredLink ?? focusedLink;
      updateTooltip();
    }
  });
  shell.addEventListener('scroll', updateTooltip, true);
  shell.addEventListener('transitionend', updateTooltip);
  window.addEventListener('resize', updateTooltip);
  const applyCollapsed = (collapsed: boolean) => {
    dismissedLink = hoveredLink ?? focusedLink;
    shell.classList.toggle('navigation-collapsed', collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    const label = collapsed ? 'Expand navigation' : 'Collapse navigation';
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    toggle.textContent = collapsed ? '›' : '‹';
    updateTooltip();
  };
  applyCollapsed(new URLSearchParams(location.search).get('nav') === 'collapsed');
  const sidebar = shell.querySelector<HTMLElement>('.published-sidebar')!;
  let mobileAnimation: Animation | undefined;
  toggle.onclick = () => {
    const previousHeight = sidebar.getBoundingClientRect().height;
    mobileAnimation?.cancel();
    shell.classList.add('navigation-animated');
    const collapsed = !shell.classList.contains('navigation-collapsed');
    applyCollapsed(collapsed);
    if (
      matchMedia('(max-width: 560px)').matches &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      mobileAnimation = sidebar.animate(
        [
          { height: `${previousHeight}px` },
          { height: `${sidebar.getBoundingClientRect().height}px` },
        ],
        { duration: 200, easing: 'ease-in-out' },
      );
    }
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
  dismissNavigationTooltip?.();
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
