import { describe, it, expect } from "bun:test";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

describe("e2e: health — index.html ссылается на существующий main-*.js", () => {
  const distDir = resolve(__dirname, "../dist");
  const indexPath = join(distDir, "index.html");

  it("dist/index.html существует", () => {
    expect(existsSync(indexPath), "dist/index.html должен существовать — сперва bun run build").toBe(true);
  });

  it("index.html содержит ссылку на main-*.js которая резолвится в реальный файл", () => {
    const html = readFileSync(indexPath, "utf-8");

    // Собираем все src/href на js: <script src="/magnum/main-*.js"> и modulepreload
    const re = /(?:src|href)=["']\/magnum\/([^"']+\.js)["']/g;
    const matches: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) matches.push(m[1]);

    expect(matches.length, `index.html должен ссылаться хотя бы на один js, найдено: ${matches.join(", ")} | html head: ${html.slice(0, 800)}`).toBeGreaterThan(0);

    // Главная запись — main-*.js
    const mainRefs = matches.filter((n) => n.startsWith("main-"));
    expect(mainRefs.length, `должен быть хотя бы один main-*.js среди ${matches.join(", ")}`).toBeGreaterThan(0);

    // Каждый найденный js существует в dist
    for (const fname of matches) {
      const fpath = join(distDir, fname);
      expect(existsSync(fpath), `файл ${fname} указан в index.html, но отсутствует в dist/`).toBe(true);
      // Файл не пустой
      const stat = readdirSync(distDir);
      expect(stat.includes(fname)).toBe(true);
    }
  });

  it("main-*.js не пустой и содержит код приложения", () => {
    const files = readdirSync(distDir).filter((f) => f.startsWith("main-") && f.endsWith(".js"));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const content = readFileSync(join(distDir, f), "utf-8");
      expect(content.length, `${f} пустой`).toBeGreaterThan(1000);
      // В бандле должен быть MAGNUM или react
      expect(content.includes("MAGNUM") || content.includes("react") || content.includes("createElement")).toBe(true);
    }
  });

  it("index.html имеет div#root и не белый экран (имеет head/meta)", () => {
    const html = readFileSync(indexPath, "utf-8");
    expect(html).toContain('<div id="root">');
    expect(html).toContain("<title>");
    expect(html).not.toContain('src="/src/main.tsx"'); // должен быть заменён на /magnum/main-*.js
  });

  it("vendor-*.js / chunk-*.js если есть — тоже существуют", () => {
    const html = readFileSync(indexPath, "utf-8");
    const vendorRe = /href="\/magnum\/(vendor-[^"]+\.js|chunk-[^"]+\.js)"/g;
    let vm: RegExpExecArray | null;
    const vendorFiles: string[] = [];
    while ((vm = vendorRe.exec(html)) !== null) vendorFiles.push(vm[1]);
    for (const vf of vendorFiles) {
      expect(existsSync(join(distDir, vf)), `vendor/chunk ${vf} отсутствует`).toBe(true);
    }
    // Если vendorFiles пусто — это ок, но хотя бы один js уже проверен выше
    expect(true).toBe(true);
  });
});
