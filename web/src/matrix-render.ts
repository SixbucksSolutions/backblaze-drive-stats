/** Reconcile the matrix in place so controls, disclosures and scroll containers survive. */
export function patchContent(host: Element, markup: string) {
  const template = host.ownerDocument.createElement('template');
  template.innerHTML = markup;
  patchChildren(host, template.content);
}

const key = (node: Node) =>
  node instanceof Element ? (node.getAttribute('data-render-key') ?? (node.id || null)) : null;
const compatible = (a: Node, b: Node) =>
  a.nodeType === b.nodeType && a.nodeName === b.nodeName && key(a) === key(b);

function patchChildren(host: Node, desired: Node) {
  const keyed = new Map(
    [...host.childNodes].filter((node) => key(node)).map((node) => [key(node), node]),
  );
  let cursor = host.firstChild;
  for (const next of [...desired.childNodes]) {
    const nextKey = key(next);
    const current = nextKey
      ? keyed.get(nextKey)
      : cursor && compatible(cursor, next)
        ? cursor
        : undefined;
    if (current && compatible(current, next)) {
      if (current !== cursor) {
        host.insertBefore(current, cursor);
      }
      patchNode(current, next);
      cursor = current.nextSibling;
    } else {
      host.insertBefore(next.cloneNode(true), cursor);
    }
  }
  while (cursor) {
    const next = cursor.nextSibling;
    host.removeChild(cursor);
    cursor = next;
  }
}

function patchNode(current: Node, next: Node) {
  if (!(current instanceof Element) || !(next instanceof Element)) {
    if (current.nodeValue !== next.nodeValue) {
      current.nodeValue = next.nodeValue;
    }
    return;
  }
  for (const attr of [...current.attributes]) {
    if (attr.name === 'open' && current instanceof HTMLDetailsElement) {
      continue;
    }
    if (!next.hasAttribute(attr.name)) {
      current.removeAttribute(attr.name);
    }
  }
  for (const attr of [...next.attributes]) {
    if (current.getAttribute(attr.name) !== attr.value) {
      current.setAttribute(attr.name, attr.value);
    }
  }
  patchChildren(current, next);
  if (current instanceof HTMLInputElement && next instanceof HTMLInputElement) {
    if (current.value !== next.value) {
      current.value = next.value;
    }
    if (current.checked !== next.checked) {
      current.checked = next.checked;
    }
  }
  if (
    current instanceof HTMLOptionElement &&
    next instanceof HTMLOptionElement &&
    current.selected !== next.selected
  ) {
    current.selected = next.selected;
  }
}
