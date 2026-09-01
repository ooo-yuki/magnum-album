// Kill switch: leaderboard/топы — только реальные данные из Neon, фейк-сиды запрещены (2026-09-01, приказ хозяина).
// Цели: tests/fake-players-guard.test.ts — не дать кодерам вернуть сиды.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

describe("no fake players guard", () => {
  it("MiningPage не содержит сидовый BOARD_MOCK с фейк-игроками", () => {
    const src = readFileSync(join(ROOT, "src/pages/MiningPage.tsx"), "utf-8");
    expect(src).not.toContain("BOARD_MOCK");
    expect(src).not.toContain("Шахтёр_42");
    expect(src).not.toContain("Томь_братуха");
    expect(src).not.toContain("Кузбасс_топ");
    expect(src).not.toContain("БЕЛАЗ_драйвер");
    expect(src).not.toContain("Уголь_магнат");
  });

  it("server.ts не содержит сидовых юзеров в топах", () => {
    const src = readFileSync(join(ROOT, "server.ts"), "utf-8");
    for (const name of ["freak_42", "bratukha_mops", "panda42", "akula_magnum", "flamingo42", "volk_42", "tiger42", "sova42", "lisa42", "lyagukha42", "nosorog42", "obezyana42", "creator42", "freak_factory", "hypebot42"]) {
      expect(src).not.toContain(name);
    }
  });

  it("никакой src-файл не содержит массивов фейк-игроков (панель известных сидов)", () => {
    const seedNames = ["freak_42","bratukha_mops","panda42","akula_magnum","flamingo42","volk_42","tiger42","sova42","lisa42","lyagukha42","nosorog42","obezyana42","creator42","freak_factory","hypebot42","Шахтёр_42","Томь_братуха","Кузбасс_топ","БЕЛАЗ_драйвер","Уголь_магнат"];
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const f of readdirSync(dir, { withFileTypes: true })) {
        if (f.name.startsWith("node_modules") || f.name === "dist") continue;
        const p = join(dir, f.name);
        if (f.isDirectory()) out.push(...walk(p));
        else if (/\.(tsx?|jsx?)$/.test(f.name)) out.push(p);
      }
      return out;
    };
    const files = [...walk(join(ROOT, "src")), join(ROOT, "server.ts")];
    const offenders: string[] = [];
    for (const file of files) {
      const txt = readFileSync(file, "utf-8");
      for (const name of seedNames) {
        // «Мок»-литерал юзера в коде: имя внутри кавычек
        if (txt.includes(`"${name}"`) || txt.includes(`'${name}'`) || txt.includes(`\`${name}\``)) offenders.push(`${file}:${name}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
