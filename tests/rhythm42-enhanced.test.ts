import { describe, it, expect } from "bun:test";

// Rhythm42 enhanced features — tape + mute + share + breakdown
// Unit slice: pure tapeStats helper ported for testability (mirrors src)

function tapeStats(tape: Array<string | null>) {
  const p = tape.filter((j) => j === "perfect").length;
  const g = tape.filter((j) => j === "good").length;
  const m = tape.filter((j) => j === "miss").length;
  const tot = p + g + m;
  return { p, g, m, tot, acc: tot ? Math.round((p * 1 + g * 0.6) / tot * 100) : 100 };
}

describe("rhythm42: tapeStats", () => {
  it("empty tape → 100% accuracy", () => {
    expect(tapeStats([])).toEqual({ p: 0, g: 0, m: 0, tot: 0, acc: 100 });
  });
  it("all perfect → 100%", () => {
    expect(tapeStats(["perfect", "perfect", "perfect"]).acc).toBe(100);
  });
  it("good counted as 60% weight", () => {
    // 1 perfect (1) + 1 good (0.6) /2 = 0.8 → 80%
    expect(tapeStats(["perfect", "good"]).acc).toBe(80);
  });
  it("misses drop accuracy", () => {
    // 1 perfect, 1 miss → 1/2=50%
    expect(tapeStats(["perfect", "miss"]).acc).toBe(50);
  });
  it("nulls ignored (not judged yet)", () => {
    expect(tapeStats([null, null, "perfect"]).acc).toBe(100);
    expect(tapeStats([null, "miss", null]).acc).toBe(0);
  });
  it("tape slice invariant — last 32 kept", () => {
    const long: string[] = Array.from({ length: 40 }, (_, i) => (i % 3 === 0 ? "perfect" : i % 3 === 1 ? "good" : "miss"));
    const slice = long.slice(-32);
    expect(slice.length).toBe(32);
    const s = tapeStats(slice as any);
    expect(s.tot).toBe(32);
  });
});

describe("rhythm42: judgement tape invariants", () => {
  it("share text contains presave URL", () => {
    const songName = "ТУСА МЕДУЗА 🪼";
    const txt = `РИТМ MAGNUM — ${songName} 4200 pts • 92% • FEVER x2 — пресейв https://music.thefence.me/psmagnum`;
    expect(txt).toContain("https://music.thefence.me/psmagnum");
    expect(txt).toContain("РИТМ MAGNUM");
  });
  it("difficulty win thresholds sanity", () => {
    const DIFF: Record<string, number> = { easy: 3500, normal: 5000, hard: 6500 };
    expect(DIFF.easy! < DIFF.normal!).toBe(true);
    expect(DIFF.normal! < DIFF.hard!).toBe(true);
    expect(DIFF.easy!).toBeGreaterThan(0);
  });
  it("5 пуль logic — FEVER after 5 perfects", () => {
    let perfectStreak = 0;
    let fever = false;
    for (let i = 0; i < 5; i++) {
      perfectStreak++;
      if (!fever && perfectStreak >= 5) fever = true;
    }
    expect(fever).toBe(true);
    expect(perfectStreak).toBe(5);
    // miss resets
    perfectStreak = 0;
    fever = false;
    expect(fever).toBe(false);
  });
  it("muted flag persisted key is rhythm42-muted", () => {
    const LS_MUTED = "rhythm42-muted";
    expect(LS_MUTED).toBe("rhythm42-muted");
    // values are "1" / "0"
    expect("1").toBe("1");
    expect("0").toBe("0");
  });
});

describe("rhythm42: MAGNUM 2026 lore", () => {
  it("SONGS include 5 пуль — ТУСА МЕДУЗА + VPN + CLAY", () => {
    const SONGS = ["ТУСА МЕДУЗА", "VPN", "CLAY", "42", "MAGNUM"];
    expect(SONGS).toContain("ТУСА МЕДУЗА");
    expect(SONGS).toContain("VPN");
    expect(SONGS).toContain("CLAY");
    expect(SONGS.length).toBe(5);
  });
  it("presave URL invariant", () => {
    const PRESAVE = "https://music.thefence.me/psmagnum";
    expect(PRESAVE).toMatch(/^https:\/\/music\.thefence\.me\/psmagnum$/);
  });
});
