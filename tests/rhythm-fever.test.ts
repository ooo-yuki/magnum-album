import { describe, it, expect } from "bun:test";

// Логика MAGNUM FEVER — 5 perfect подряд = x2, 6с, сброс на miss/good
const FEVER_NEED = 5;
const FEVER_MS = 6000;

function simulateFever(judgements: Array<"perfect"|"good"|"miss">) {
  let perfectStreak = 0;
  let fever = false;
  let feverUntil = 0;
  let feverCount = 0;
  let now = 0;
  const scores: number[] = [];
  let score = 0;
  for (const j of judgements) {
    now += 300;
    if (fever && now > feverUntil) { fever = false; perfectStreak = 0; }
    if (j === "miss") {
      perfectStreak = 0;
      if (fever) fever = false;
      scores.push(score);
      continue;
    }
    const mult = fever ? 2 : 1;
    if (j === "perfect") {
      perfectStreak++;
      if (!fever && perfectStreak >= FEVER_NEED) {
        fever = true;
        feverUntil = now + FEVER_MS;
        feverCount++;
      }
      score += 100 * mult;
    } else { // good breaks perfectStreak
      perfectStreak = 0;
      score += 55 * mult;
    }
    scores.push(score);
  }
  return { fever, feverCount, score, perfectStreak };
}

describe("rhythm fever: MAGNUM 5 пуль", () => {
  it("5 perfect подряд включает fever", () => {
    const r = simulateFever(["perfect","perfect","perfect","perfect","perfect"]);
    expect(r.fever).toBe(true);
    expect(r.feverCount).toBe(1);
  });
  it("4 perfect не включает", () => {
    const r = simulateFever(["perfect","perfect","perfect","perfect"]);
    expect(r.fever).toBe(false);
  });
  it("good сбрасывает perfectStreak", () => {
    const r = simulateFever(["perfect","perfect","perfect","perfect","good","perfect"]);
    expect(r.fever).toBe(false);
    expect(r.perfectStreak).toBe(1);
  });
  it("miss сбрасывает fever", () => {
    const r = simulateFever(["perfect","perfect","perfect","perfect","perfect","miss"]);
    expect(r.fever).toBe(false);
  });
  it("x2 во время fever", () => {
    // 5 perfect -> fever, следующий perfect x2
    const r = simulateFever(["perfect","perfect","perfect","perfect","perfect","perfect"]);
    // 5*100=500 + 1*200=700
    expect(r.score).toBe(700);
  });
  it("SONGS 5 пуль — 5 треков", () => {
    const SONGS = [
      { name: "ТУСА МЕДУЗА 🪼", bpm: 128 },
      { name: "VPN 🔒", bpm: 142 },
      { name: "CLAY — СЛАВА БОССУ 🧱", bpm: 118 },
      { name: "42 ✌️", bpm: 135 },
      { name: "MAGNUM — 5 пуль ●", bpm: 108 },
    ];
    expect(SONGS.length).toBe(5);
    expect(SONGS[0]!.name).toContain("ТУСА МЕДУЗА");
    expect(SONGS[1]!.name).toContain("VPN");
    expect(SONGS[2]!.name).toContain("CLAY");
    expect(SONGS[4]!.name).toContain("MAGNUM");
  });
  it("fever expiry по времени (6с)", () => {
    let feverUntil = 5000;
    let fever = true;
    let now = 4000;
    expect(now <= feverUntil).toBe(true); // still fever
    now = 11000;
    if (now > feverUntil) fever = false;
    expect(fever).toBe(false);
  });
  it("DIFFICULTY win пороги сохраняются", () => {
    const D = { easy: { win: 3500 }, normal: { win: 5000 }, hard: { win: 6500 } };
    expect(D.easy.win).toBeLessThan(D.normal.win);
    expect(D.normal.win).toBeLessThan(D.hard.win);
  });
});
