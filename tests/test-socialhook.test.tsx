import { render, screen, fireEvent } from "@testing-library/react";
import { SocialHook } from "../src/components/SocialHook";
import { describe, it, expect, vi } from "bun:test";

vi.mock("../src/components/ShareCard", () => ({
  drawShareCard: vi.fn(async () => {}),
  canvasToBlob: vi.fn(async () => new Blob(["x"], { type: "image/png" })),
  shareOrDownload: vi.fn(async () => "downloaded" as const),
}));

describe("SocialHook empty guard", () => {
  it("пустой presavers не крашит — сетка из 42 свободных слотов и FOMO-счётчик", async () => {
    const { container } = render(<SocialHook presavers={[]} />);
    expect(screen.getByTestId("social-hook")).toBeInTheDocument();
    expect(screen.getByText(/пока пусто/)).toBeInTheDocument();
    // свободных слотов ровно 42
    expect(screen.getByText(/осталось 42 мест/)).toBeInTheDocument();
    const avatars = container.querySelector('[data-testid="social-hook-avatars"]')!;
    expect(avatars).not.toBeNull();
    expect(avatars.children.length).toBe(42);
    // ни одной занятой ячейки
    expect(screen.queryAllByTitle(/слот 42 — свободен/).length).toBe(42);
    const share = screen.getByTestId("social-hook-share");
    await fireEvent.click(share);
    // клик не роняет компонент
    expect(screen.getByTestId("social-hook")).toBeInTheDocument();
  });
  it("с 2 presavers занимает 2 слота и оставляет 40 свободных", () => {
    const { container } = render(<SocialHook presavers={[{username:"a", avatar:"mops"}, {username:"b", avatar:"rhino"}]} />);
    expect(screen.getByText(/2\/42/)).toBeInTheDocument();
    expect(screen.getByText(/осталось 40 мест/)).toBeInTheDocument();
    const avatars = container.querySelector('[data-testid="social-hook-avatars"]')!;
    expect(avatars.children.length).toBe(42);
    expect(screen.queryAllByTitle(/слот 42 — свободен/).length).toBe(40);
    // оба братухи подписаны в ленте
    expect(screen.getByText(/a · b — уже в 42/)).toBeInTheDocument();
  });
  it("SKIN_EMOJI импортируется из cosmetics", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/components/SocialHook.tsx","utf8");
    expect(src).toContain('from "../lib/cosmetics"');
    expect(src).not.toContain('const SKIN_EMOJI');
  });
});
