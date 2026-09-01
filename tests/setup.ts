import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// ---- matchMedia ----
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ---- IntersectionObserver ----
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
  root = null;
  rootMargin = "";
  thresholds = [];
  constructor(_cb: unknown, _opts?: unknown) {}
}
Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});
Object.defineProperty(global, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});

// ---- ResizeObserver ----
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(_cb: unknown) {}
}
Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  configurable: true,
  value: MockResizeObserver,
});

// ---- scrollTo ----
window.scrollTo = vi.fn();
Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

// ---- gsap mock ----
// Full mock so components that use gsap.context / ScrollTrigger don't crash in jsdom
vi.mock("gsap", async () => {
  const actual = await vi.importActual<typeof import("gsap")>("gsap");
  const mockTimeline = {
    to: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    fromTo: vi.fn().mockReturnThis(),
  };
  const mockGsap = {
    ...actual,
    registerPlugin: vi.fn(),
    set: vi.fn(),
    to: vi.fn(() => ({ scrollTrigger: {} })),
    from: vi.fn(),
    fromTo: vi.fn(),
    timeline: vi.fn(() => mockTimeline),
    context: vi.fn((cb: () => void) => {
      try {
        cb();
      } catch {}
      return { revert: vi.fn() };
    }),
  };
  return { default: mockGsap, gsap: mockGsap };
});

vi.mock("gsap/ScrollTrigger", () => ({
  ScrollTrigger: { register: vi.fn() },
}));
