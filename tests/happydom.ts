// DOM для bun test — официальный рецепт Bun (happy-dom + GlobalRegistrator).
// https://bun.com/docs/test/dom
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

const g = globalThis as unknown as Record<string, unknown>;

// happy-dom не реализует observer-API, которые дёргают компоненты со ScrollTrigger
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
  root = null;
  rootMargin = "";
  thresholds: number[] = [];
}
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
g.IntersectionObserver = MockIntersectionObserver;
g.ResizeObserver = MockResizeObserver;
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).IntersectionObserver = MockIntersectionObserver;
  (window as unknown as Record<string, unknown>).ResizeObserver = MockResizeObserver;
  if (!window.matchMedia) {
    (window as unknown as Record<string, unknown>).matchMedia = (query: string) => ({
      matches: false, media: query, onchange: null,
      addListener() {}, removeListener() {},
      addEventListener() {}, removeEventListener() {},
      dispatchEvent: () => false,
    });
  }
  window.scrollTo = () => {};
  if (typeof Element !== "undefined") Element.prototype.scrollTo = () => {};
}
