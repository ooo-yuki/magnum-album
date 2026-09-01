// flashmob42.ts — ФЛЕШМОБ 42 — 7 типов ротация seed=YYYY-MM-DD
export type FlashmobTypeId = "click-storm" | "eco-quiz" | "memory" | "dodge-wave" | "rhythm-42" | "snake-42" | "typing-42";

export type FlashmobType = {
  id: FlashmobTypeId;
  title: string;
  shortTitle: string;
  desc: string;
  target: number;
  durationSec: 42;
  icon: string;
};

export const FLASHMOB_TYPES: FlashmobType[] = [
  { id: "click-storm", title: "КЛИК-ШТОРМ 42с — набей 420", shortTitle: "КЛИК-ШТОРМ", desc: "Кликай как шахтёр — 42 секунды на 420 хитов", target: 420, durationSec: 42, icon: "⚡" },
  { id: "eco-quiz",     title: "ECO-КВИЗ 42с — ответь 42", shortTitle: "ECO-КВИЗ", desc: "42 вопроса про Кузбасс и экологию — 42с на всё", target: 42, durationSec: 42, icon: "🌿" },
  { id: "memory",       title: "ПАМЯТЬ 42с — запомни 42", shortTitle: "ПАМЯТЬ", desc: "Запомни последовательность 42 — повтори без ошибок", target: 42, durationSec: 42, icon: "🧠" },
  { id: "dodge-wave",   title: "DODGE-ВЕЙВ 42с — увернись 42", shortTitle: "DODGE", desc: "Уворачивайся 42 волны — одна жизнь", target: 42, durationSec: 42, icon: "🛡️" },
  { id: "rhythm-42",    title: "РИТМ 42с — набей 4200", shortTitle: "РИТМ-42", desc: "Попадай в такт 42с — цель 4200 очков", target: 4200, durationSec: 42, icon: "🎵" },
  { id: "snake-42",     title: "ЗМЕЙКА 42с — съешь 42", shortTitle: "ЗМЕЙКА", desc: "Собирай яблоки 42с — цель 42 фрукта", target: 42, durationSec: 42, icon: "🐍" },
  { id: "typing-42",    title: "ПЕЧАТЬ 42с — напечатай 420", shortTitle: "ПЕЧАТЬ", desc: "Напечатай 420 символов за 42с без ошибок", target: 420, durationSec: 42, icon: "⌨️" },
];

export function hashDayToSeed(day: string): number {
  // day = YYYY-MM-DD → 32-bit seed
  let h = 0;
  for (let i = 0; i < day.length; i++) h = (h * 31 + day.charCodeAt(i)) >>> 0;
  // mix with 42 constant
  return (h ^ 0x2a2a2a2a) >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getFlashmobForDay(day: string): FlashmobType & { seed: number; day: string } {
  const seed = hashDayToSeed(day);
  const rng = mulberry32(seed);
  const idx = Math.floor(rng() * FLASHMOB_TYPES.length);
  const base = FLASHMOB_TYPES[idx] ?? FLASHMOB_TYPES[0]!;
  return { ...base, seed, day };
}

export function todayDayString(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function getTodayFlashmob(): FlashmobType & { seed: number; day: string } {
  return getFlashmobForDay(todayDayString());
}

// Quiz generator seeded by day — deterministic for all
export type QuizQ = { q: string; a: string[]; correct: number };
const ECO_Q_BANK: QuizQ[] = [
  { q: "Река Кузбасса 827 км — как зовётся?", a: ["Томь", "Обь", "Лена", "Енисей"], correct: 0 },
  { q: "Сколько гектаров леса в Кузбассе?", a: ["4817 тыс", "1200 тыс", "9000 тыс", "320 тыс"], correct: 0 },
  { q: "Глубина шахты 42?", a: ["42 м", "142 м", "2042 м", "420 м"], correct: 0 },
  { q: "MAGNUM — сколько треков?", a: ["5", "7", "10", "12"], correct: 0 },
  { q: "Кринжа не существует — чей лозунг?", a: ["42 братухи", "The Fence", "VPN", "Медуза"], correct: 0 },
  { q: "ТУСА МЕДУЗА — сколько клипов в тусе?", a: ["8K", "42", "1K", "200K"], correct: 0 },
  { q: "Столица Кузбасса?", a: ["Кемерово", "Новокузнецк", "Белово", "Прокопьевск"], correct: 0 },
  { q: "VPN — в чартах?", a: ["Да, уже", "Нет", "Скоро", "Никогда"], correct: 0 },
  { q: "Пресейв MAGNUM — где?", a: ["music.thefence.me/psmagnum", "Spotify", "VK", "Apple"], correct: 0 },
  { q: "42 монеты за шаринг — лимит?", a: ["1/день", "5/день", "без лимита", "10/день"], correct: 0 },
  { q: "Топ-1 дня награда?", a: ["1420", "420", "142", "42"], correct: 0 },
  { q: "Топ-2 дня награда?", a: ["420", "1420", "142", "42"], correct: 0 },
  { q: "Топ-3 дня награда?", a: ["142", "420", "1420", "42"], correct: 0 },
  { q: "Стрик 3 дня — бонус?", a: ["+142", "+42", "+420", "+1420"], correct: 0 },
];

export function seededQuizForDay(day: string, count = 7): QuizQ[] {
  const seed = hashDayToSeed(day);
  const rng = mulberry32(seed + 0x9e37);
  const shuffled = [...ECO_Q_BANK].sort(() => rng() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// Memory sequence seeded
export function seededMemorySequence(day: string, len = 8): number[] {
  const seed = hashDayToSeed(day);
  const rng = mulberry32(seed + 0x42);
  return Array.from({ length: len }, () => Math.floor(rng() * 4));
}

export function formatDayTitle(t: FlashmobType): string {
  return t.title;
}
