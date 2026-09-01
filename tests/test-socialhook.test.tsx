import { render, screen, fireEvent } from "@testing-library/react";
import { SocialHook } from "../src/components/SocialHook";
import { describe, it, expect, vi } from "bun:test";

vi.mock("../src/components/ShareCard", () => ({
  drawShareCard: vi.fn(async () => {}),
  canvasToBlob: vi.fn(async () => new Blob(["x"], { type: "image/png" })),
  shareOrDownload: vi.fn(async () => "downloaded" as const),
}));

describe("SocialHook empty guard", () => {
  it("пустой presavers не крашит — показывает FOMO +42 места", async () => {
    const { container } = render(<SocialHook presavers={[]} />);
    expect(screen.getByTestId("social-hook")).toBeInTheDocument();
    expect(screen.getByText(/пока пусто/)).toBeInTheDocument();
    expect(screen.getByText(/\+42 места/)).toBeInTheDocument();
    const avatars = container.querySelector('[data-testid="social-hook-avatars"]');
    expect(avatars).toBeNull();
    const share = screen.getByTestId("social-hook-share");
    await fireEvent.click(share);
    // click should not crash — component still mounted, toast via showToast guard
    expect(screen.getByTestId("social-hook")).toBeInTheDocument();
  });
  it("с 2 presavers рендерит 2 аватарки + счётчик +40", () => {
    const { container } = render(<SocialHook presavers={[{username:"a", avatar:"mops"}, {username:"b", avatar:"rhino"}]} />);
    expect(screen.getByText(/2\/42/)).toBeInTheDocument();
    const counter = screen.getByTestId("social-hook-counter");
    expect(counter.textContent).toMatch(/\+40 места/);
    const avatars = container.querySelector('[data-testid="social-hook-avatars"]')!;
    expect(avatars.children.length).toBe(3);
  });
  it("SKIN_EMOJI импортируется из cosmetics", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/components/SocialHook.tsx","utf8");
    expect(src).toContain('from "../lib/cosmetics"');
    expect(src).not.toContain('const SKIN_EMOJI');
  });
});
