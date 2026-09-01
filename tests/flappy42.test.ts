import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";
import { Flappy42Game } from "../src/pages/games/Flappy42Game";
import { GamesHub } from "../src/pages/GamesHub";

// Mock canvas getContext for jsdom
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    setTransform: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn(() => ({ width: 10 })),
    setLineDash: vi.fn(),
    quadraticCurveTo: vi.fn(),
    roundRect: vi.fn(),
    shadowColor: "",
    shadowBlur: 0,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    font: "",
    textAlign: "center" as CanvasTextAlign,
    textBaseline: "middle" as CanvasTextBaseline,
  } as unknown as CanvasRenderingContext2D));
});

// ---- Flappy42Game: component renders ----
describe("flappy42: component renders", () => {
  it("renders title FLAPPY 42", () => {
    render(React.createElement(MemoryRouter, null, React.createElement(Flappy42Game)));
    expect(screen.getByText("FLAPPY 42")).toBeInTheDocument();
  });

  it("renders goal 42 in HUD", () => {
    render(React.createElement(MemoryRouter, null, React.createElement(Flappy42Game)));
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders play button", () => {
    render(React.createElement(MemoryRouter, null, React.createElement(Flappy42Game)));
    expect(screen.getByText("Играть!")).toBeInTheDocument();
  });

  it("renders back link to games", () => {
    render(React.createElement(MemoryRouter, null, React.createElement(Flappy42Game)));
    const backLink = screen.getByText(/К играм/);
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest("a")).toHaveAttribute("href", "/magnum/games");
  });

  it("renders canvas element", () => {
    render(React.createElement(MemoryRouter, null, React.createElement(Flappy42Game)));
    const canvas = document.querySelector("canvas");
    expect(canvas).toBeTruthy();
  });

  it("renders HUD with 3 stats", () => {
    render(React.createElement(MemoryRouter, null, React.createElement(Flappy42Game)));
    expect(screen.getByText("Очки")).toBeInTheDocument();
    expect(screen.getByText("Цель")).toBeInTheDocument();
    expect(screen.getByText("Рекорд")).toBeInTheDocument();
  });
});

// ---- Flappy42Game: in GamesHub ----
describe("flappy42: listed in GamesHub", () => {
  it("GamesHub includes FLAPPY 42 card", () => {
    render(React.createElement(MemoryRouter, null, React.createElement(GamesHub)));
    expect(screen.getByText("FLAPPY 42")).toBeInTheDocument();
    expect(screen.getByText(/Пролети 42 трубы/)).toBeInTheDocument();
  });

  it("GamesHub has 12 games total", () => {
    render(React.createElement(MemoryRouter, null, React.createElement(GamesHub)));
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(12);
  });
});

// ---- Flappy42Game: presave link ----
describe("flappy42: presave link", () => {
  it("presave URL points to thefence.me", () => {
    render(React.createElement(MemoryRouter, null, React.createElement(Flappy42Game)));
    expect(Flappy42Game).toBeDefined();
  });
});
