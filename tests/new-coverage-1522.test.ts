import { describe, it, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
function read(p: string): string { return readFileSync(resolve(ROOT, p), "utf8"); }

// ---- Flappy42: difficulty presets ----
describe("1522: Flappy42 difficulty + skins", () => {
  const src = read("src/pages/games/Flappy42Game.tsx");

  it("DIFFICULTIES массив 3 уровня norm/hard/turbo с gravity/gap/speed/coinMul", () => {
    expect(src).toContain("DIFFICULTIES");
    for (const id of ["norm", "hard", "turbo"]) expect(src).toContain(`"${id}"`);
    expect(src).toContain("gravity:");
    expect(src).toContain("coinMul:");
    expect(src).toContain("gap: 146");
    expect(src).toContain("gap: 132");
    expect(src).toContain("gap: 118");
    expect(src).toMatch(/coinMul:\s*1/);
    expect(src).toMatch(/coinMul:\s*1\.5/);
    expect(src).toMatch(/coinMul:\s*2/);
  });

  it("BIRD_SKINS 5 скинов classic/magnum/vpn/meduza/void с лором 42", () => {
    expect(src).toContain("BIRD_SKINS");
    for (const id of ["classic", "magnum", "vpn", "meduza", "void"]) expect(src).toContain(`"${id}"`);
    expect(src).toContain("VPN");
    expect(src).toContain("МЕДУЗА");
    expect(src).toContain("MAGNUM");
  });

  it("WIN_SCORE 42 и PIPE_GAP/PIPE_SPEED/PIPE_W/GRAVITY константы", () => {
    expect(src).toContain("WIN_SCORE = 42");
    expect(src).toContain("PIPE_GAP = 146");
    expect(src).toContain("PIPE_SPEED = 2.45");
    expect(src).toContain("GRAVITY = 0.38");
    expect(src).toContain("FLAP_FORCE = -7.6");
    expect(src).toContain("BIRD_R = 16");
  });

  it("пауза P/Esc + flap Space/W/ArrowUp + R restart", () => {
    expect(src).toContain('"paused"');
    expect(src).toContain("togglePause");
    expect(src).toContain('KeyP');
    expect(src).toContain('Escape');
    expect(src).toContain('KeyR');
    expect(src).toContain('Space');
    expect(src).toContain('ArrowUp');
    expect(src).toContain('KeyW');
  });

  it("persist diff/skin в localStorage (UI-only), рекорд в Neon", () => {
    expect(src).toContain("flappy42-diff");
    expect(src).toContain("flappy42-skin");
    expect(src).not.toContain("flappy42-best"); // best больше не в LS
    expect(src).toContain("games/submit"); // рекорд в Neon magnum_game_scores
  });

  it("WebAudio 6 звуков flap/score/hit/win/coin/pause с rampTo/expFade", () => {
    expect(src).toContain("playFlap");
    expect(src).toContain("playScore");
    expect(src).toContain("playHit");
    expect(src).toContain("playWin");
    expect(src).toContain("playCoin");
    expect(src).toContain("playPause");
    expect(src).toContain("rampTo");
    expect(src).toContain("expFade");
    expect(src).toContain("linearRampToValueAtTime");
    expect(src).toContain("exponentialRampToValueAtTime");
  });

  it("GSAP ScrollTrigger batch stagger 0.12 + hover y:-4 RGB glow + reducedMotion", () => {
    expect(src).toContain("ScrollTrigger");
    expect(src).toContain("stagger: 0.12");
    expect(src).toContain("gsap.set");
    expect(src).toContain("gsap.to");
    expect(src).toContain("prefersReducedMotion");
    expect(src).toContain("hoverIn");
    expect(src).toContain("RGB_GLOW");
  });

  it("canvas + HUD 3 stats + presave link + win modal", () => {
    expect(src).toContain("<canvas");
    expect(src).toContain("Очки");
    expect(src).toContain("Цель");
    expect(src).toContain("Рекорд");
    expect(src).toContain("music.thefence.me/psmagnum");
    expect(src).toContain("42 ТРУБЫ");
    expect(src).toContain("SCORE_TITLES");
  });

  it("coin submit POST /magnum/api/games/submit с diff.coinMul", () => {
    expect(src).toContain("/magnum/api/games/submit");
    expect(src).toContain("coinMul");
    expect(src).toContain("submitScore");
    expect(src).toMatch(/Math\.round\(sc \* 4/);
  });
});

// ---- presaveTracker + server presave endpoint ----
describe("1522: presave tracking + server", () => {
  it("presaveTracker слушает клики на music.thefence.me/psmagnum и POST /magnum/api/presave/click", () => {
    const t = read("src/lib/presaveTracker.ts");
    expect(t).toContain("music.thefence.me/psmagnum");
    expect(t).toContain("/magnum/api/presave/click");
    expect(t).toContain("closest");
    expect(t).toContain("fetch");
  });

  it("server.ts: presave rateLimit + game submit + coins endpoints", () => {
    const s = read("server.ts");
    expect(s).toContain("/magnum/api/presave/click");
    expect(s).toContain("/magnum/api/games/submit");
    expect(s).toContain("/magnum/api/coins/add");
    expect(s).toContain("checkRateLimit");
  });
});

// ---- build + dist gallery sync ----
describe("1522: build + gallery-42 assets", () => {
  it("public/images/gallery-42 содержит 8 реальных файлов 800.webp", () => {
    const fs = require("node:fs");
    const dir = resolve(ROOT, "public/images/gallery-42");
    const files = existsSync(dir) ? require("node:fs").readdirSync(dir) : [];
    expect(files.length).toBeGreaterThanOrEqual(8);
    // at least one per style exists
    const names = files.join(" ");
    expect(names).toContain("42-agit");
    expect(names).toContain("42-cyber");
  });

  it("build.ts hash + vendor + SPA fallback присутствуют", () => {
    const b = read("build.ts");
    expect(b).toMatch(/hash|contenthash/i);
    // vendor or splitting
    expect(b).toMatch(/vendor|splitting/);
  });

  it("dist/index.html существует и не пустой", () => {
    const p = resolve(ROOT, "dist/index.html");
    expect(existsSync(p)).toBe(true);
    const html = read("dist/index.html");
    expect(html.length).toBeGreaterThan(500);
    expect(html).toContain("<script");
  });
});
