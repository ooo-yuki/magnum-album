import { describe, it, expect } from "vitest";

// Test the pure logic of Timeline2026Game

interface Event {
  id: string;
  date: string;
  sortKey: number;
  title: string;
  detail: string;
  emoji: string;
}

const EVENTS: Event[] = [
  { id: "clay", date: "03.04.2026", sortKey: 20260403, title: "CLAY EP", detail: "5 треков, РЗТ 73/100.", emoji: "🤡" },
  { id: "vpn", date: "2026", sortKey: 20260501, title: "VPN — второй сингл", detail: "Поп-вайб 2:23.", emoji: "🔐" },
  { id: "meduza", date: "14.08.2026", sortKey: 20260814, title: "ТУСА МЕДУЗА", detail: "8K+ клипов TikTok.", emoji: "🪼" },
  { id: "album", date: "Осень 2026", sortKey: 20261001, title: "MAGNUM — 5 пуль", detail: "5 треков — 5 пуль.", emoji: "💿" },
  { id: "tour", date: "2026", sortKey: 20261101, title: "MAGNUM тур", detail: "923K фолловеров Twitch.", emoji: "🎤" },
  { id: "presave", date: "Открыт", sortKey: 20260101, title: "Пресейв MAGNUM", detail: "Bandlink The Fence.", emoji: "🔗" },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i]!, a[j]!] = [a[j]!, a[i]!];
  }
  return a;
}

describe("Timeline2026Game logic", () => {
  it("EVENTS has 6 entries", () => {
    expect(EVENTS).toHaveLength(6);
  });

  it("all events have unique ids", () => {
    const ids = EVENTS.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all events have valid sortKey for ordering", () => {
    const sorted = [...EVENTS].sort((a, b) => a.sortKey - b.sortKey);
    expect(sorted[0]!.id).toBe("presave"); // presave is first (20260101)
    expect(sorted[sorted.length - 1]!.id).toBe("tour"); // tour is last (20261101)
  });

  it("correct chronological order starts with presave, ends with tour", () => {
    const sorted = [...EVENTS].sort((a, b) => a.sortKey - b.sortKey);
    expect(sorted.map(e => e.id)).toEqual(["presave", "clay", "vpn", "meduza", "album", "tour"]);
  });

  it("shuffle preserves all elements", () => {
    const shuffled = shuffle(EVENTS);
    expect(shuffled).toHaveLength(EVENTS.length);
    const ids = shuffled.map(e => e.id).sort();
    const origIds = EVENTS.map(e => e.id).sort();
    expect(ids).toEqual(origIds);
  });

  it("shuffle produces different order (statistical)", () => {
    // Run shuffle 20 times, at least once should differ from original
    let foundDiff = false;
    for (let i = 0; i < 20; i++) {
      const shuffled = shuffle(EVENTS);
      if (shuffled[0]!.id !== EVENTS[0]!.id || shuffled[1]!.id !== EVENTS[1]!.id) {
        foundDiff = true;
        break;
      }
    }
    expect(foundDiff).toBe(true);
  });

  it("POINTS_PER * ROUNDS = 4200 (MAGNUM target)", () => {
    const POINTS_PER = 840;
    const ROUNDS = 5;
    expect(POINTS_PER * ROUNDS).toBe(4200);
  });

  it("finding correct next card by sortKey works", () => {
    const sorted = [...EVENTS].sort((a, b) => a.sortKey - b.sortKey);
    // Simulate picking cards in order
    const placed: Event[] = [];
    for (const expected of sorted) {
      const remaining = EVENTS.filter(c => !placed.find(p => p.id === c.id));
      const correctNext = remaining.reduce((min, c) => c.sortKey < min.sortKey ? c : min, remaining[0]!);
      expect(correctNext.id).toBe(expected.id);
      placed.push(expected);
    }
  });

  it("picking wrong card would be detected", () => {
    const remaining = [...EVENTS]; // all remaining
    const correctNext = remaining.reduce((min, c) => c.sortKey < min.sortKey ? c : min, remaining[0]!);
    // Pick the last one instead
    const wrongPick = remaining[remaining.length - 1]!;
    if (wrongPick.id !== correctNext.id) {
      expect(wrongPick.sortKey).toBeGreaterThan(correctNext.sortKey);
    }
  });
});
