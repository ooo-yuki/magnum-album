// flow42.ts — БИТВА ФЛОУ 42 — рэп-баттл vs БРАТ-БОТ
// 4 такта x8с = 32с, 3 бита, scoring 0-42 x3 + WPM bonus

export const FLOW_BEATS = [86, 73, 142] as const;
export type FlowBeat = typeof FLOW_BEATS[number];
export const FLOW_BEAT_LABELS: Record<FlowBeat, string> = {
  86: "XXL 86 — бум-бэп",
  73: "РЗТ 73 — lo-fi",
  142: "BPM 142 — трэп",
};
export const FLOW_DURATION_SEC = 32;
export const FLOW_TAKT_SEC = 8;
export const FLOW_TAKTS = 4;
export const FLOW_LINES = 4;

export const WAGER_OPTIONS = [0, 42, 142, 420] as const;
export type Wager = typeof WAGER_OPTIONS[number];
export function isWager(v: unknown): v is Wager {
  return (WAGER_OPTIONS as readonly number[]).includes(Number(v));
}

export type FlowScores = {
  rhyme: number; // 0-42
  punch: number; // 0-42
  flow: number; // 0-42
  total: number; // 0-126
  wpm: number;
  wpmBonus: number; // 1 or 1.2
  final: number; // total * bonus
};

export const SCORING = {
  maxPer: 42,
  maxTotal: 126,
  botBaseMin: 60,
  botBaseMax: 90,
  wpmThreshold: 80,
  wpmMult: 1.2,
  eloWin: 42,
  eloLose: -12,
  streak3Bonus: 142,
  topWeekBonus: 1420,
  shareDaily: 42,
} as const;

export function calcWPM(chars: number, sec: number): number {
  if (sec <= 0) return 0;
  return Math.round((chars / 5) / (sec / 60));
}

export function botBaseScore(): number {
  return Math.floor(SCORING.botBaseMin + Math.random() * (SCORING.botBaseMax - SCORING.botBaseMin + 1));
}

export function calcFinal(scores: Omit<FlowScores, "final" | "wpmBonus" | "total"> & { rhyme: number; punch: number; flow: number; wpm: number }): FlowScores {
  const total = Math.max(0, Math.min(126, scores.rhyme + scores.punch + scores.flow));
  const bonus = scores.wpm > SCORING.wpmThreshold ? SCORING.wpmMult : 1;
  return {
    rhyme: scores.rhyme,
    punch: scores.punch,
    flow: scores.flow,
    total,
    wpm: scores.wpm,
    wpmBonus: bonus,
    final: Math.round(total * bonus),
  };
}

// heuristic fallback when mimo unavailable
export function heuristicScores(lines: string[]): { rhyme: number; punch: number; flow: number } {
  const joined = lines.join(" ").toLowerCase();
  const words = joined.split(/\s+/).filter(Boolean);
  const uniq = new Set(words);
  const lenAvg = words.length ? words.join(" ").length / words.length : 0;

  // rhyme: check ending similarity last 2 chars of each line
  let rhyme = 14;
  if (lines.length >= 2) {
    const ends = lines.map((l) => l.trim().slice(-3).toLowerCase());
    const pairs = ends.filter((e, i) => i > 0 && e.slice(-2) === ends[i - 1]!.slice(-2)).length;
    rhyme = Math.min(42, 10 + pairs * 14 + Math.min(12, uniq.size));
  }
  // punch: keywords + length + caps
  const punchWords = ["42", "магн", "братух", "панч", "флоу", "бит", "баттл", "огонь", "босс"];
  const hits = punchWords.filter((w) => joined.includes(w)).length;
  let punch = Math.min(42, 8 + hits * 7 + Math.min(12, Math.floor(words.length / 2)));
  if (joined.includes("!") || joined.includes("🔥")) punch = Math.min(42, punch + 4);

  // flow: avg line length + word count balance
  const balanced = lines.every((l) => l.length >= 8 && l.length <= 80) ? 10 : 0;
  let flow = Math.min(42, 10 + Math.min(18, Math.floor(lenAvg * 2)) + balanced + Math.min(8, words.length));
  // jitter
  rhyme = Math.max(0, Math.min(42, rhyme + Math.floor(Math.random() * 6) - 2));
  punch = Math.max(0, Math.min(42, punch + Math.floor(Math.random() * 6) - 2));
  flow = Math.max(0, Math.min(42, flow + Math.floor(Math.random() * 6) - 2));
  return { rhyme, punch, flow };
}

export const BRAT_BOT_LINES: string[][] = [
  ["брат на бите 86 — качаю как XXL", "42 братухи в зале — кричи братуха", "мой флоу — лава, твой — вода из крана", "проверь свой панч — где твой удар, братан?"],
  ["семьдесят три — медленный джаз на районе", "пишу как 5opka — каждый бар в законе", "ты пропустил такт — я считаю секунды", "финал MAGNUM — пять пуль, не секунды"],
  ["сто сорок два — трэп-скорострел", "печатай быстрее — или проиграл", "WPM за 80 — бонус летит", "БРАТ-БОТ не спит — он тебя глотает"],
];

export function pickBotLines(beat: FlowBeat): string[] {
  const idx = FLOW_BEATS.indexOf(beat);
  const pool = BRAT_BOT_LINES[idx] ?? BRAT_BOT_LINES[0]!;
  return pool.slice(0, 4);
}

export const FLOW_TIPS = [
  "Печатай панчи — рифма + панч + флоу по 42 каждый",
  "WPM >80 даёт x1.2 к сумме — печатай быстро!",
  "Пропуск такта = 0 за строку — не зевай 8с окно",
  "Бот база 60-90 — надо набрать больше с бонусом",
  "3 победы подряд → +142 streak, топ недели +1420",
  "Wager 0 — тренировка, 420 — ва-банк братухи",
];
