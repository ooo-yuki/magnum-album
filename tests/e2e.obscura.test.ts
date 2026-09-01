import { describe, it, expect } from "bun:test";
import { spawnSync } from "node:child_process";

const BASE = process.env.E2E_BASE ?? "http://localhost:30646/magnum";
const CDP = "http://localhost:9222/json/version";
const ORIGIN = BASE.replace(/\/magnum\/?$/, "");

function curlOk(url: string): boolean {
  try {
    const r = spawnSync("curl", ["-s", "--max-time", "2", "-o", "/dev/null", "-w", "%{http_code}", url], { timeout: 3000 });
    return r.stdout?.toString().trim() === "200";
  } catch { return false; }
}

function hasObscuraSync(): boolean {
  try {
    const r = spawnSync("curl", ["-s", "--max-time", "2", CDP], { timeout: 3000 });
    return r.stdout?.toString().includes("Browser");
  } catch { return false; }
}

function obscuraFetch(url: string): string {
  const p = spawnSync("/usr/local/bin/obscura", ["fetch", "--dump", "html", "--allow-private-network", url], { timeout: 12000 });
  return (p.stdout?.toString() ?? "") + (p.stderr?.toString() ?? "");
}

function obscuraScrape(urls: string[], evalJs?: string): any {
  const args = ["scrape", "--allow-private-network", ...(evalJs ? ["-e", evalJs] : []), ...urls];
  const p = spawnSync("/usr/local/bin/obscura", args, { timeout: 15000 });
  const txt = p.stdout?.toString() ?? "";
  try { return JSON.parse(txt); } catch { return { raw: txt, stderr: p.stderr?.toString() }; }
}

const OBSCURA = hasObscuraSync();
const SERVER = curlOk(BASE + "/");

describe("e2e: Obscura browser (playwright → obscura)", () => {
  it("Obscura CDP доступна на :9222 (Rust 30MB vs playwright 200MB+)", () => {
    if (!OBSCURA) { console.warn("skip: Obscura :9222 недоступна"); return; }
    const r = spawnSync("curl", ["-s", CDP], { timeout: 3000 });
    const j = JSON.parse(r.stdout.toString());
    expect(j.Browser).toContain("Chrome");
    expect(j["Protocol-Version"]).toBeDefined();
  });

  it("fetch через Obscura рендерит shell (div#root, title, script) — 5s vs playwright 15s", () => {
    if (!OBSCURA || !SERVER) return;
    const out = obscuraFetch(BASE + "/");
    // Obscura выводит "Fetching..." в stderr, html в stdout — объединено выше
    expect(out).toContain("<title>");
    expect(out).toContain("MAGNUM — 5opka");
    expect(out).toContain('<div id="root">');
    expect(out).toContain("/magnum/main-");
    expect(out).not.toContain('src="/src/main.tsx"');
  }, 15000);

  it("scrape title через Obscura (CDP eval) → MAGNUM", () => {
    if (!OBSCURA || !SERVER) return;
    const j = obscuraScrape([BASE + "/"], "document.title");
    expect(j?.results?.[0]?.title).toContain("MAGNUM");
    expect(j?.results?.[0]?.eval).toContain("MAGNUM");
  }, 15000);

  it("health API отвечает JSON (obscura original dump)", () => {
    if (!SERVER) return;
    const curl = spawnSync("curl", ["-s", ORIGIN + "/magnum/api/health"], { timeout: 5000 });
    const body = curl.stdout.toString();
    expect(body.length).toBeGreaterThan(2);
    expect(() => JSON.parse(body)).not.toThrow();
    // дополнительно пробуем через obscura original (бинарный)
    if (OBSCURA) {
      const p = spawnSync("/usr/local/bin/obscura", ["fetch", "--dump", "original", "--allow-private-network", ORIGIN + "/magnum/api/health"], { timeout: 8000 });
      const raw = p.stdout.toString();
      if (raw.length > 2 && raw.trim().startsWith("{")) expect(() => JSON.parse(raw)).not.toThrow();
    }
  }, 15000);

  it("gallery и games доступны через Obscura batch (2 urls, concurrency 10)", () => {
    if (!OBSCURA || !SERVER) return;
    const j = obscuraScrape([BASE + "/gallery", BASE + "/games"], "document.title");
    expect(j.total_urls).toBe(2);
    for (const r of j.results) expect(r.title).toContain("MAGNUM");
  }, 15000);

  it("bun-only: нет playwright/vite, только bun + obscura", () => {
    const pkg = JSON.parse(require("node:fs").readFileSync("package.json", "utf-8"));
    const all = JSON.stringify(pkg.dependencies ?? {}) + JSON.stringify(pkg.devDependencies ?? {});
    expect(all).not.toContain("playwright");
    expect(all).not.toContain("vite");
    expect(all).not.toContain("vitest");
    expect(pkg.scripts.test).toBe("bun test");
    expect(pkg.scripts.build).toContain("bun run build.ts");
    expect(require("node:fs").existsSync("bun.lock")).toBe(true);
    expect(require("node:fs").existsSync("vitest.config.ts")).toBe(false);
    expect(require("node:fs").existsSync("vite.config.ts")).toBe(false);
  });
});
