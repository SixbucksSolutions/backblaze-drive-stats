/** Connect native scrollbar rails to the single, semantic matrix viewport. */
export function connectMatrixScroll(pane: HTMLElement): () => void {
  const scroll = pane.querySelector<HTMLElement>('.matrix-scroll');
  const vertical = pane.querySelector<HTMLElement>('.matrix-vscroll');
  const horizontal = pane.querySelector<HTMLElement>('.matrix-hscroll');
  const verticalSize = vertical?.querySelector<HTMLElement>('.matrix-scroll-size');
  const horizontalSize = horizontal?.querySelector<HTMLElement>('.matrix-scroll-size');
  if (!scroll || !vertical || !horizontal || !verticalSize || !horizontalSize) return () => {};

  let disposed = false;
  let frame = 0;
  let expectedLeft = horizontal.scrollLeft;
  let expectedTop = vertical.scrollTop;
  let expectedViewportLeft = scroll.scrollLeft;
  let expectedViewportTop = scroll.scrollTop;
  let frozenWidth = 0;
  let labelScrollLeft = NaN;
  const vendorLabels = [...scroll.querySelectorAll<HTMLElement>('.vendor-header')]
    .map(header => ({ header, label: header.querySelector<HTMLElement>('.vendor-label') }));

  const alignVendorLabels = (force = false) => {
    if (!vendorLabels.length || (!force && scroll.scrollLeft === labelScrollLeft)) return;
    labelScrollLeft = scroll.scrollLeft;
    const viewportLeft = scroll.getBoundingClientRect().left + scroll.clientLeft;
    const dataLeft = viewportLeft + frozenWidth;
    const dataRight = viewportLeft + scroll.clientWidth;
    for (const { header, label } of vendorLabels) {
      if (!label) continue;
      const bounds = header.getBoundingClientRect();
      const left = Math.max(bounds.left, dataLeft), right = Math.min(bounds.right, dataRight);
      // Center each visible band fragment. Offscreen labels remain inside their
      // own band, retaining the header's accessible name without covering context.
      const visible = right > left;
      setPixels(label, '--vendor-label-center', visible ? (left + right) / 2 - bounds.left : bounds.width / 2);
      setPixels(label, '--vendor-label-width', visible ? right - left : bounds.width);
    }
  };
  const updateVendorLabels = () => alignVendorLabels();

  const synchronize = () => {
    // Assigning even an unchanged offset can cancel native keyboard animation.
    if (horizontal.scrollLeft !== scroll.scrollLeft) horizontal.scrollLeft = scroll.scrollLeft;
    if (vertical.scrollTop !== scroll.scrollTop) vertical.scrollTop = scroll.scrollTop;
    expectedLeft = horizontal.scrollLeft;
    expectedTop = vertical.scrollTop;
    expectedViewportLeft = scroll.scrollLeft;
    expectedViewportTop = scroll.scrollTop;
  };
  const scrollViewport = () => {
    // A rail may already have advanced to its next animation frame when the
    // viewport's programmatic scroll event arrives. Ignore that echo per axis.
    if (scroll.scrollLeft !== expectedViewportLeft) {
      expectedViewportLeft = scroll.scrollLeft;
      if (horizontal.scrollLeft !== scroll.scrollLeft) horizontal.scrollLeft = scroll.scrollLeft;
      expectedLeft = horizontal.scrollLeft;
    }
    if (scroll.scrollTop !== expectedViewportTop) {
      expectedViewportTop = scroll.scrollTop;
      if (vertical.scrollTop !== scroll.scrollTop) vertical.scrollTop = scroll.scrollTop;
      expectedTop = vertical.scrollTop;
    }
  };
  const scrollHorizontally = () => {
    if (horizontal.scrollLeft === expectedLeft) return;
    expectedLeft = horizontal.scrollLeft;
    if (scroll.scrollLeft !== expectedLeft) scroll.scrollLeft = expectedLeft;
    expectedViewportLeft = scroll.scrollLeft;
    alignVendorLabels();
  };
  const scrollVertically = () => {
    if (vertical.scrollTop === expectedTop) return;
    expectedTop = vertical.scrollTop;
    if (scroll.scrollTop !== expectedTop) scroll.scrollTop = expectedTop;
    expectedViewportTop = scroll.scrollTop;
  };
  const setPixels = (element: HTMLElement, property: string, value: number) => {
    const pixels = `${value}px`;
    if (element.style.getPropertyValue(property) !== pixels) element.style.setProperty(property, pixels);
  };
  const measure = () => {
    if (disposed) return;
    const header = scroll.querySelector('thead');
    const frozenCells = header?.querySelectorAll<HTMLElement>('th.age');
    const headerHeight = header?.getBoundingClientRect().height ?? 0;
    frozenWidth = [...(frozenCells ?? [])].slice(0, 2)
      .reduce((width, cell) => width + cell.getBoundingClientRect().width, 0);
    setPixels(pane, '--matrix-header-size', headerHeight);
    setPixels(pane, '--matrix-frozen-size', frozenWidth);

    const maxLeft = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
    const maxTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
    pane.dataset.horizontalOverflow = String(maxLeft > 0);
    pane.dataset.verticalOverflow = String(maxTop > 0);
    // Rails begin after the sticky cells. Their smaller viewports need equally
    // smaller content extents so their native scroll ranges match the matrix.
    setPixels(horizontalSize, 'width', maxLeft + horizontal.clientWidth);
    setPixels(verticalSize, 'height', maxTop + vertical.clientHeight);
    synchronize();
    alignVendorLabels(true);
  };
  const scheduleMeasure = () => {
    if (disposed || frame) return;
    frame = requestAnimationFrame(() => { frame = 0; measure(); });
  };

  scroll.addEventListener('scroll', scrollViewport, { passive: true });
  scroll.addEventListener('scroll', updateVendorLabels, { passive: true });
  horizontal.addEventListener('scroll', scrollHorizontally, { passive: true });
  vertical.addEventListener('scroll', scrollVertically, { passive: true });
  const observer = new ResizeObserver(scheduleMeasure);
  observer.observe(pane);
  observer.observe(scroll);
  observer.observe(horizontal);
  observer.observe(vertical);
  scroll.querySelectorAll('table, thead, thead th.age').forEach(element => observer.observe(element));
  window.addEventListener('resize', scheduleMeasure, { passive: true });
  document.fonts.addEventListener('loadingdone', scheduleMeasure);
  void document.fonts.ready.then(scheduleMeasure);
  measure();

  return () => {
    disposed = true;
    if (frame) cancelAnimationFrame(frame);
    observer.disconnect();
    scroll.removeEventListener('scroll', scrollViewport);
    scroll.removeEventListener('scroll', updateVendorLabels);
    horizontal.removeEventListener('scroll', scrollHorizontally);
    vertical.removeEventListener('scroll', scrollVertically);
    window.removeEventListener('resize', scheduleMeasure);
    document.fonts.removeEventListener('loadingdone', scheduleMeasure);
  };
}
