import test from 'node:test';
import assert from 'node:assert/strict';
import { connectMatrixScroll } from './matrix-scroll.ts';

class ScrollElement extends EventTarget {
  left = 0;
  top = 0;
  leftWrites = 0;
  topWrites = 0;
  clientWidth = 300;
  clientHeight = 200;
  scrollWidth = 900;
  scrollHeight = 700;
  dataset: Record<string, string> = {};
  children = new Map<string, ScrollElement>();
  properties = new Map<string, string>();
  style = {
    getPropertyValue: (name: string) => this.properties.get(name) ?? '',
    setProperty: (name: string, value: string) => { this.properties.set(name, value); },
  };
  get scrollLeft() { return this.left; }
  set scrollLeft(value: number) { this.leftWrites++; this.left = value; }
  get scrollTop() { return this.top; }
  set scrollTop(value: number) { this.topWrites++; this.top = value; }
  querySelector(selector: string) { return this.children.get(selector) ?? null; }
  querySelectorAll() { return []; }
  emitScroll() { this.dispatchEvent(new Event('scroll')); }
}

test('native rail animation survives viewport echoes; viewport input and cleanup still work', () => {
  const pane = new ScrollElement(), viewport = new ScrollElement();
  const horizontal = new ScrollElement(), vertical = new ScrollElement();
  pane.children.set('.matrix-scroll', viewport);
  pane.children.set('.matrix-hscroll', horizontal);
  pane.children.set('.matrix-vscroll', vertical);
  horizontal.children.set('.matrix-scroll-size', new ScrollElement());
  vertical.children.set('.matrix-scroll-size', new ScrollElement());
  let disconnected = false;
  const globals = {
    ResizeObserver: class {
      observe() {}
      disconnect() { disconnected = true; }
    },
    window: new EventTarget(),
    document: { fonts: Object.assign(new EventTarget(), { ready: new Promise(() => {}) }) },
  };
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [name, value] of Object.entries(globals)) {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, value });
  }
  let dispose: (() => void) | undefined;
  try {
    dispose = connectMatrixScroll(pane as unknown as HTMLElement);
    // Native key scrolling advances offsets without a JavaScript assignment.
    // A JS assignment here, even to the same value, would cancel that animation.
    horizontal.left = 40;
    horizontal.emitScroll();
    assert.equal(viewport.scrollLeft, 40);
    assert.equal(horizontal.leftWrites, 0);
    horizontal.left = 65;
    viewport.emitScroll(); // Delayed echo from the previous animation frame.
    assert.equal(horizontal.scrollLeft, 65);
    assert.equal(horizontal.leftWrites, 0);
    horizontal.emitScroll();
    assert.equal(viewport.scrollLeft, 65);

    vertical.top = 200;
    vertical.emitScroll();
    assert.equal(viewport.scrollTop, 200);
    vertical.top = 500;
    viewport.emitScroll();
    assert.equal(vertical.scrollTop, 500);
    assert.equal(vertical.topWrites, 0);
    vertical.emitScroll();
    assert.equal(viewport.scrollTop, 500);

    // Wheel, touch, focus and keyboard input in the viewport sync outward.
    viewport.left = 90;
    viewport.top = 300;
    viewport.emitScroll();
    assert.equal(horizontal.scrollLeft, 90);
    assert.equal(vertical.scrollTop, 300);
    const viewportWrites = [viewport.leftWrites, viewport.topWrites];
    horizontal.emitScroll();
    vertical.emitScroll();
    assert.deepEqual([viewport.leftWrites, viewport.topWrites], viewportWrites);

    dispose();
    assert.equal(disconnected, true);
    horizontal.left = 150;
    vertical.top = 450;
    horizontal.emitScroll();
    vertical.emitScroll();
    assert.equal(viewport.scrollLeft, 90);
    assert.equal(viewport.scrollTop, 300);
    viewport.left = 10;
    viewport.emitScroll();
    assert.equal(horizontal.scrollLeft, 150);
  } finally {
    dispose?.();
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
