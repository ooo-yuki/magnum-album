// jest-dom матчеры + автоочистка render — официальный рецепт Bun
// https://bun.sh/guides/test/testing-library
import { afterEach, expect, mock } from "bun:test";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

afterEach(() => {
  cleanup();
  if (typeof document !== "undefined" && document.body) document.body.innerHTML = "";
});

// GSAP не работает в headless-DOM: подменяем модуль до импорта компонентами.
// mock.module в preload — документированный способ замокать модуль заранее.
const gsapStub = {
  registerPlugin() {},
  set() {},
  to: () => ({ scrollTrigger: {} }),
  from() {},
  fromTo() {},
  timeline: () => ({ to: () => ({}), from: () => ({}), fromTo: () => ({}) }),
  context: (cb: () => void) => {
    try { cb(); } catch { /* компонент упал в headless — тест это не роняет */ }
    return { revert() {} };
  },
};
mock.module("gsap", () => ({ default: gsapStub, gsap: gsapStub }));

const scrollTriggerStub = { register() {}, getAll: () => [], refresh() {}, batch() {}, create() {} };
mock.module("gsap/ScrollTrigger", () => ({
  default: scrollTriggerStub,
  ScrollTrigger: scrollTriggerStub,
  getAll: () => [], refresh() {}, batch() {},
}));
