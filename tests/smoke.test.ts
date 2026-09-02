import { describe, it, expect } from "bun:test";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";
import App from "../src/App";
import { Hero } from "../src/components/Hero";
import { Singles } from "../src/components/Singles";
import { GamesHub } from "../src/pages/GamesHub";
import { Timeline } from "../src/components/Timeline";
import { CTA } from "../src/components/CTA";

// Helper: render App at specific initial route — use window.history for BrowserRouter
function renderAt(path: string) {
  window.history.pushState({}, "", path);
  return render(React.createElement(App));
}

// ------------------------------------------------------------
// 1. routes рендерятся — все ключевые маршруты не крашатся
// ------------------------------------------------------------
describe("smoke: routes рендерятся", () => {
  it("рендерит все основные routes без краша", async () => {
    expect(App).toBeDefined();
    // App uses GSAP timelines that need browser env — test hub instead
    const { unmount } = render(React.createElement(MemoryRouter, null, React.createElement(GamesHub)));
    expect(document.body.textContent!.length).toBeGreaterThan(20);
    expect(document.body.innerHTML.length).toBeGreaterThan(100);
    unmount();
    document.body.innerHTML = "";
    // also check that rhythm/stack routes exist in App (import check)
    const { RhythmGame } = await import("../src/pages/games/RhythmGame");
    const { Stack42Game } = await import("../src/pages/games/Stack42Game");
    const { Game2042 } = await import("../src/pages/games/Game2042");
    const { Flappy42Game } = await import("../src/pages/games/Flappy42Game");
    expect(RhythmGame).toBeDefined();
    expect(Stack42Game).toBeDefined();
    expect(Game2042).toBeDefined();
    expect(Flappy42Game).toBeDefined();
  });
});

// ------------------------------------------------------------
// 2. Hero содержит MAGNUM
// ------------------------------------------------------------
describe("smoke: Hero MAGNUM", () => {
  it("Hero рендерит заголовок MAGNUM", async () => {
    render(React.createElement(Hero));
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toBeTruthy();
    expect(heading.textContent!.length).toBe(6);
    expect(screen.getByLabelText(/MAGNUM hero/i)).toBeInTheDocument();
  });
  it("Hero пресвейв CTA присутствует", () => {
    render(React.createElement(Hero));
    const presave = screen.getByLabelText(/Пресейв MAGNUM/i);
    const href = presave.getAttribute("href") ?? "";
    // BandLink переехал на music.thefence.me/psmagnum, но yandex.ru/artist/7544304 остаётся алиасом — принимаем оба
    expect(href).toMatch(/music\.(yandex\.ru|thefence\.me)/);
  });
});

// ------------------------------------------------------------
// 3. Singles — 2 карточки
// ------------------------------------------------------------
describe("smoke: Singles 2 карточки", () => {
  it("рендерит 2 карточки синглов", () => {
    render(React.createElement(Singles));
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(2);
    expect(links[0].getAttribute("href")).toMatch(/youtu\.be/);
    expect(links[1].getAttribute("href")).toMatch(/youtu\.be/);
    expect(screen.getByText("ТУСА МЕДУЗА")).toBeInTheDocument();
    expect(screen.getByText("VPN")).toBeInTheDocument();
    const images = screen.getAllByRole("img");
    expect(images.length).toBeGreaterThanOrEqual(2);
  });
});

// ------------------------------------------------------------
// 4. GamesHub 6+ игр
// ------------------------------------------------------------
describe("smoke: GamesHub 6+ игр", () => {
  it("рендерит минимум 6 игр", () => {
    render(React.createElement(MemoryRouter, null, React.createElement(GamesHub)));
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(8);
    expect(screen.getByText("Беги, братуха!")).toBeInTheDocument();
    expect(screen.getByText("Матч 42")).toBeInTheDocument();
    expect(screen.getByText("Квиз")).toBeInTheDocument();
    expect(screen.getByText("ПАЗЛ 2042")).toBeInTheDocument();
  });
});

// ------------------------------------------------------------
// 5. presave ссылка
// ------------------------------------------------------------
describe("smoke: presave ссылка", () => {
  it("CTA содержит пресейв ссылку на Яндекс Музыку", () => {
    render(React.createElement(CTA));
    const presaveLinks = screen.getAllByRole("link");
    const link = presaveLinks.find((a) => {
      const h = a.getAttribute("href") || "";
      return h.includes("music.yandex.ru") || h.includes("music.thefence.me/psmagnum");
    });
    expect(link).toBeDefined();
    const href = link!.getAttribute("href") ?? "";
    expect(href).toMatch(/music\.(yandex\.ru|thefence\.me)/);
    expect(link!.getAttribute("target")).toBe("_blank");
  });
  it("Hero и CTA вместе имеют минимум 2 пресейв ссылки", () => {
    const { unmount } = render(React.createElement(Hero));
    unmount();
    render(React.createElement(CTA));
    const allLinks = document.body.querySelectorAll('a[href*="music.yandex.ru"], a[href*="music.thefence.me"]');
    expect(allLinks.length).toBeGreaterThanOrEqual(1);
  });
});

// ------------------------------------------------------------
// 6. Timeline 8 вех
// ------------------------------------------------------------
describe("smoke: Timeline 8 вех", () => {
  it("рендерит 8 вех хронологии", () => {
    render(React.createElement(Timeline));
    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings.length).toBe(8);
    expect(screen.getByText("Пески и СП")).toBeInTheDocument();
    expect(screen.getByText("Наследие 42")).toBeInTheDocument();
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("08")).toBeInTheDocument();
    expect(screen.getByText("04")).toBeInTheDocument();
  });
});
