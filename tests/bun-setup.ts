import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});

const g = globalThis as any;
g.window = dom.window as any;
g.document = dom.window.document;
g.DOMParser = dom.window.DOMParser;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.HTMLCanvasElement = (dom.window as any).HTMLCanvasElement;
g.HTMLImageElement = (dom.window as any).HTMLImageElement;
g.Image = (dom.window as any).Image;
g.navigator = dom.window.navigator;
g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
g.requestAnimationFrame = (cb: any) => setTimeout(cb, 0);
g.cancelAnimationFrame = (id: any) => clearTimeout(id);
g.matchMedia = (dom.window as any).matchMedia || ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
}));
if (!g.window.matchMedia) g.window.matchMedia = g.matchMedia;

// Minimal Intersection/Resize observers
class MockIO {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
  root = null; rootMargin = ""; thresholds: any[] = [];
  constructor() {}
}
class MockRO {
  observe() {}
  unobserve() {}
  disconnect() {}
  constructor() {}
}
g.IntersectionObserver = g.window.IntersectionObserver = MockIO as any;
g.ResizeObserver = g.window.ResizeObserver = MockRO as any;
g.window.scrollTo = () => {};
if (g.Element) g.Element.prototype.scrollTo = () => {};

// Ensure window globals also on globalThis
Object.defineProperty(g, "window", { value: dom.window, writable: true });

// Stub document.createElement etc already via jsdom

// Add jest-dom matchers for vitest/bun expect
try {
  // vitest's jest-dom extension
  await import("@testing-library/jest-dom/vitest");
} catch {}
try {
  // fallback for bun:test expect
  const jestDom = await import("@testing-library/jest-dom");
  // bun:test's expect may not auto-extend, but we try
} catch {}

// Cleanup between tests - handle both vitest and bun:test
try {
  const { afterEach: afterEachVitest } = await import("vitest");
  afterEachVitest(() => {
    if (g.document && g.document.body) g.document.body.innerHTML = "";
  });
} catch {}
try {
  const { afterEach: afterEachBun } = await import("bun:test");
  afterEachBun(() => {
    if (g.document && g.document.body) g.document.body.innerHTML = "";
  });
} catch {}

// Mock GSAP to avoid GSAP target not found warnings (optional)
try {
  const { mock } = await import("bun:test");
  // mock.module for gsap if available
  if (mock && (mock as any).module) {
    (mock as any).module("gsap", () => {
      const actual = { registerPlugin: () => {}, set: () => {}, to: () => ({}), from: () => {}, fromTo: () => {}, timeline: () => ({ to: () => ({}), from: () => ({}), fromTo: () => ({}) }), context: (cb: any) => { try{cb()}catch{}; return { revert: () => {} } } };
      return { default: actual, gsap: actual };
    });
    (mock as any).module("gsap/ScrollTrigger", () => ({
      default: { register: () => {}, getAll: () => [], refresh: () => {}, batch: () => {} },
      ScrollTrigger: { register: () => {}, getAll: () => [], refresh: () => {}, batch: () => {}, create: () => {}, refresh: () => {}, batch: () => {} },
      getAll: () => [], refresh: () => {}, batch: () => {},
    }));
  }
} catch {}
