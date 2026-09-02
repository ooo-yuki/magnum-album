// chronicle42.ts — ХРОНИКИ 42 — 12 глав 2019→2026

export type ChronicleTier = "free" | "xp142" | "xp420_eco" | "xp1420_duel";
export type ChronicleTrack = "clay" | "vpn" | "nova" | "magnum" | null;
export type CrossLink = { label: string; to: string; highlight?: string };

export type ChronicleChapter = {
  id: number; // 1..12
  year: number;
  date: string; // YYYY-MM-DD
  title: string;
  subtitle: string;
  tier: ChronicleTier;
  // стоимость анлока (монеты как XP)
  cost: number;
  // доп требование
  need: string | null;
  quote: string;
  fact: string;
  track: ChronicleTrack;
  trackLabel: string | null;
  image: string; // /chronicle/*.jpg
  cross: CrossLink[];
  color: string;
};

export const CHAPTERS: ChronicleChapter[] = [
  {
    id: 1, year: 2019, date: "2019-03-15", title: "Зарождение 42",
    subtitle: "Кемерово • цифра как философия • Томь 827 км",
    tier: "free", cost: 0, need: null,
    quote: "42 — не число. Это ответ, который каждый ищет сам.",
    fact: "В марте 2019 Кирилл «5opka» в Кемерово впервые пишет 42 на стикере монитора — как напоминание, что любой вопрос имеет ответ, если копать 42 раза.",
    track: null, trackLabel: null,
    image: "/chronicle/ch01.jpg",
    cross: [{ label: "Карта Кузбасса", to: "/magnum/map", highlight: "Кемерово • Томь" }],
    color: "#00ff88",
  },
  {
    id: 2, year: 2020, date: "2020-06-20", title: "Первые треки",
    subtitle: "Домашняя студия • 73 BPM • CLAY",
    tier: "free", cost: 0, need: null,
    quote: "Писал в наушниках за 800₽ — но сводил как будто на Abbey Road.",
    fact: "Июнь 2020 — первый дроп на кухне: микро Shure SM58 + FL Studio trial. Трек CLAY 73 BPM родился из сэмпла глины с карьера под Кемерово.",
    track: "clay", trackLabel: "CLAY — 73 BPM",
    image: "/chronicle/ch02.jpg",
    cross: [{ label: "Студия 42", to: "/magnum/studio?track=clay", highlight: "BPM 73" }],
    color: "#ff2d55",
  },
  {
    id: 3, year: 2021, date: "2021-09-10", title: "The Fence",
    subtitle: "Первый забор • 10k • комьюнити",
    tier: "free", cost: 0, need: null,
    quote: "Забор — не граница. Это место, где братухи собираются.",
    fact: "Осень 2021 — запускает The Fence как дискорд-сервер для 42 братух. 10k за месяц без рекламы — только сарафан и репосты в ВК.",
    track: null, trackLabel: null,
    image: "/chronicle/ch03.jpg",
    cross: [{ label: "Галерея", to: "/magnum/gallery", highlight: "The Fence 2021" }],
    color: "#ffcc00",
  },
  {
    id: 4, year: 2022, date: "2022-02-14", title: "Коллаб Drummatix",
    subtitle: "Первый фит • 86 BPM • VPN",
    tier: "xp142", cost: 142, need: "142 XP",
    quote: "Когда два стиля сталкиваются — рождается новый звук.",
    fact: "Февраль 2022 — фит с Drummatix пишет VPN 86 BPM за одну ночь. Трек слили в тг в 04:42 — проснулся с 20k прослушиваний.",
    track: "vpn", trackLabel: "VPN — feat. MellSher • 86 BPM",
    image: "/chronicle/ch04.jpg",
    cross: [{ label: "Трек VPN", to: "/magnum/track/vpn", highlight: "86 BPM" }],
    color: "#00ffcc",
  },
  {
    id: 5, year: 2022, date: "2022-11-02", title: "Кузбасс-эко: старт",
    subtitle: "Беловское вдхр • первый субботник 42 мешка",
    tier: "xp142", cost: 142, need: "142 XP",
    quote: "Кузбасс дал мне уголь — я верну ему чистую Томь.",
    fact: "Ноябрь 2022 — первый эко-субботник: 42 волонтёра, Беловское водохранилище, 42 мешка пластика. Родилась идея эко-квиза MAGNUM.",
    track: null, trackLabel: null,
    image: "/chronicle/ch05.jpg",
    cross: [{ label: "Эко-квиз", to: "/magnum/eco?point=belovo", highlight: "Белово • пластик" }],
    color: "#9147ff",
  },
  {
    id: 6, year: 2023, date: "2023-05-17", title: "Drumedy и клип",
    subtitle: "Кемерово • Томь • первая сцена",
    tier: "xp142", cost: 142, need: "142 XP",
    quote: "Сцена — это та же студия, только с глазами братух.",
    fact: "Май 2023 — первый лайв под открытым небом на берегу Томи: 800 человек, дождь, но никто не ушёл. Клип сняли на VHS за 4 200₽.",
    track: "nova", trackLabel: "NOVA — 80 BPM • live",
    image: "/chronicle/ch06.jpg",
    cross: [{ label: "Карта", to: "/magnum/map?point=kemerovo", highlight: "Кемерово 470,210" }, { label: "Галерея", to: "/magnum/gallery", highlight: "Live 2023" }],
    color: "#ff8a00",
  },
  {
    id: 7, year: 2023, date: "2023-12-01", title: "5opka × MellSher",
    subtitle: "Химия студии • 142 BPM • зачат MAGNUM",
    tier: "xp420_eco", cost: 420, need: "420 XP + 1 эко-квиз",
    quote: "С Меллшером не пишешь трек — ты идёшь в экспедицию.",
    fact: "Декабрь 2023 — ночная сессия с MellSher: за 8 часов придумали концепт MAGNUM — 5 треков как 5 пуль, каждая со своим BPM и регионом Кузбасса.",
    track: "magnum", trackLabel: "MAGNUM — 142 BPM • 5 пуль",
    image: "/chronicle/ch07.jpg",
    cross: [{ label: "Студия MAGNUM", to: "/magnum/studio?track=magnum", highlight: "preset neon-kuzbass" }],
    color: "#5865f2",
  },
  {
    id: 8, year: 2024, date: "2024-06-15", title: "MAGNUM зачат",
    subtitle: "Концепт альбома • 5 пуль • Кузбасс 95,7 тыс км²",
    tier: "xp420_eco", cost: 420, need: "420 XP + 1 эко-квиз",
    quote: "5 пуль — 5 точек Кузбасса. Каждая пуля летит в свою цель.",
    fact: "Июнь 2024 — утверждён треклист MAGNUM: 5 точек карты Кузбасса → 5 треков. Кемерово→Нова, Новокузнецк→VPN, Белово→CLAY, Шория→MAGNUM, Томь→дропа.",
    track: "magnum", trackLabel: "Треклист MAGNUM",
    image: "/chronicle/ch08.jpg",
    cross: [{ label: "Карта 5 точек", to: "/magnum/map", highlight: "5 точек • босс" }],
    color: "#00ff88",
  },
  {
    id: 9, year: 2024, date: "2024-12-20", title: "Галерея 42",
    subtitle: "Артефакты • обложки • 142 фото",
    tier: "xp420_eco", cost: 420, need: "420 XP + 1 эко-квиз",
    quote: "Каждый артефакт — сохранённый момент, который не должен исчезнуть.",
    fact: "Декабрь 2024 — открыли physical галерею в Кемерово: 142 фото 2019-2024, кассеты, первый микрофон 42. Онлайн-галерея за неделю набрала 42k просмотров.",
    track: null, trackLabel: null,
    image: "/chronicle/ch09.jpg",
    cross: [{ label: "Галерея 42", to: "/magnum/gallery", highlight: "142 артефакта" }],
    color: "#ff2d55",
  },
  {
    id: 10, year: 2025, date: "2025-08-10", title: "MAGNUM BUILD",
    subtitle: "Сайт • майнинг • дуэли • экономика 42",
    tier: "xp1420_duel", cost: 1420, need: "1420 XP + 1 дуэль-win",
    quote: "Сайт — это не страница. Это мир, где братухи живут.",
    fact: "Август 2025 — собрали MAGNUM-сайт за 42 дня: майнинг, дуэли 2-4 игрока, GACHA, борда, конвейер. Первый коммит — 10.08 в 04:20.",
    track: null, trackLabel: null,
    image: "/chronicle/ch10.jpg",
    cross: [{ label: "Майнинг", to: "/magnum/mining", highlight: "майнинг 42" }, { label: "Дуэли", to: "/magnum/duel/lobby", highlight: "2-4 игрока" }],
    color: "#ffcc00",
  },
  {
    id: 11, year: 2026, date: "2026-03-01", title: "Пресейв 42 братух",
    subtitle: "Золотая рамка • первые 42 • FOMO",
    tier: "xp1420_duel", cost: 1420, need: "1420 XP + 1 дуэль-win",
    quote: "Первые 42 — не просто слушатели. Это соавторы истории.",
    fact: "Март 2026 — пресейв MAGNUM: первые 42 получают золотую рамку epic и +1420 монет. За 72 часа — 1 420 заявок, закрыли за 5 часов.",
    track: null, trackLabel: null,
    image: "/chronicle/ch11.jpg",
    cross: [{ label: "Пресейв-рейтинг", to: "/magnum/presave-rating", highlight: "топ 42" }],
    color: "#a855f7",
  },
  {
    id: 12, year: 2026, date: "2026-09-15", title: "MAGNUM DROP",
    subtitle: "Релиз • Хронист 42 • 12/12 • 1420 XP + рамка",
    tier: "xp1420_duel", cost: 1420, need: "1420 XP + 1 дуэль-win",
    quote: "Хронист — тот, кто помнит весь путь от стикера 42 до MAGNUM.",
    fact: "15 сентября 2026 — дроп MAGNUM. Хронисты 12/12 получают рамку Хронист epic + 1420 монет и попадают в вечный архив сайта.",
    track: "magnum", trackLabel: "MAGNUM — дроп 15.09.2026",
    image: "/chronicle/ch12.jpg",
    cross: [{ label: "Дискография", to: "/magnum/discography", highlight: "MAGNUM 5 треков" }, { label: "Борда", to: "/magnum/board?game=magnum", highlight: "лента MAGNUM" }],
    color: "#ffd700",
  },
];

export const FREE_IDS = [1, 2, 3];
export const XP142_IDS = [4, 5, 6];
export const XP420_ECO_IDS = [7, 8, 9];
export const XP1420_DUEL_IDS = [10, 11, 12];

export function tierFor(id: number): ChronicleTier {
  if (FREE_IDS.includes(id)) return "free";
  if (XP142_IDS.includes(id)) return "xp142";
  if (XP420_ECO_IDS.includes(id)) return "xp420_eco";
  return "xp1420_duel";
}
export function costFor(id: number): number {
  const c = CHAPTERS.find(x => x.id === id);
  return c?.cost ?? 42;
}
export function needFor(id: number): string | null {
  const c = CHAPTERS.find(x => x.id === id);
  return c?.need ?? null;
}

// seed-ротация факта дня — детерминирован по дню года + userId seed
export function hashDayToSeed(day: string): number {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) { h ^= day.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h) % 2147483647;
}
export function factOfDay(chapters: ChronicleChapter[], day: string, userSeed = 0): ChronicleChapter {
  const seed = hashDayToSeed(day) ^ userSeed;
  const idx = Math.abs(seed) % chapters.length;
  return chapters[idx]!;
}
export function isValidChapterId(v: number): boolean { return Number.isInteger(v) && v >= 1 && v <= 12; }

// прогресс helper
export type ChronicleProgress = {
  unlocked: number[];
  xpSpent: number;
  completed: boolean;
  updatedAt?: string;
};
export function hasAll12(unlocked: number[]): boolean {
  return CHAPTERS.every(c => unlocked.includes(c.id));
}
