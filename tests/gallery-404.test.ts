import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
const ROOT = resolve(__dirname, "..");
describe("P0 gallery 404 — CI check", () => {
  it("Y2K и мемфис имеют разные файлы (не коллизия)", () => {
    const txt = readFileSync(resolve(ROOT, "src/lib/galleryTokens.ts"), "utf-8");
    const y2kMatch = txt.match(/"Y2K":\s*"([^"]+)"/);
    const memphisMatch = txt.match(/"мемфис":\s*"([^"]+)"/);
    expect(y2kMatch).not.toBeNull();
    expect(memphisMatch).not.toBeNull();
    expect(y2kMatch![1]).not.toBe(memphisMatch![1]);
    expect(y2kMatch![1]).toContain("42-y2k-01");
  });
  it("не мутирует const ARCHIVE_42 (нет for... a.src =)", () => {
    const txt = readFileSync(resolve(ROOT, "src/pages/GalleryPage.tsx"), "utf-8");
    expect(txt).not.toMatch(/for\s*\(\s*const\s+a\s+of\s+ARCHIVE_42\s*\)\s*a\.src\s*=/);
    expect(txt).not.toMatch(/for\s*\(\s*const\s+a\s+of\s+ARCHIVE_WAVE_2\s*\)\s*a\.src\s*=/);
    expect(txt).toContain("getRealSrc");
  });
  it("все 4 реальных файла существуют на диске", () => {
    const files = [
      "public/images/gallery-42/42-agit-01-800.webp",
      "public/images/gallery-42/42-y2k-01-800.webp",
      "public/images/gallery-42/42-cyber-01-800.webp",
      "public/images/gallery-42/42-memphis-01-800.webp",
    ];
    for (const f of files) {
      expect(existsSync(resolve(ROOT, f)), `missing ${f}`).toBe(true);
    }
  });
});
