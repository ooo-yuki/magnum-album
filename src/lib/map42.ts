// Single source of truth для true-ответов. Любой дрифт POINTS между клиентом и сервером = баг/фарм.

export type MapOpt = { id: string; label: string; correct: boolean; hint: string };
export type MapQ = { q: string; emoji: string; options: MapOpt[] };
export type MapPointDef = { id: string; name: string; sub: string; x: number; y: number; color: string; theme: string; qs: MapQ[] };

export const POINTS_CANON: MapPointDef[] = [
  {
    id: "kemerovo", name: "КЕМЕРОВО", sub: "Томь • 557k • адмцентр", x: 470, y: 210, color: "#00ff88", theme: "Томь/пластик",
    qs: [
      { emoji: "🌊", q: "Томь в Кемерово — 827 км. Куда пластиковую бутылку?", options: [
        { id: "kemerovo-q0-o0", label: "В общий мусор — авось переработают", correct: false, hint: "мимо" },
        { id: "kemerovo-q0-o1", label: "Сдать в фандомат «Лента» / раздельный бак", correct: true, hint: "+42" },
        { id: "kemerovo-q0-o2", label: "Сжечь на берегу", correct: false, hint: "дым −142" },
        { id: "kemerovo-q0-o3", label: "Оставить на Красном озере", correct: false, hint: "анти-эко" },
      ]},
      { emoji: "🏭", q: "Кемерово — химпром Кузбасса. Что помогает Томи чище?", options: [
        { id: "kemerovo-q1-o0", label: "Сортировка 7дн: ПЭТ/стекло/органика", correct: true, hint: "+42" },
        { id: "kemerovo-q1-o1", label: "Сливать всё в Томь", correct: false, hint: "−142" },
        { id: "kemerovo-q1-o2", label: "Жечь пластик в мангале", correct: false, hint: "хуже" },
        { id: "kemerovo-q1-o3", label: "Не сортировать — всё в один пакет", correct: false, hint: "−42" },
      ]},
    ]
  },
  {
    id: "novokuznetsk", name: "НОВОКУЗНЕЦК", sub: "Разрезы • 553k • юг", x: 620, y: 420, color: "#ff2d55", theme: "Уголь/разрезы",
    qs: [
      { emoji: "⛏️", q: "Кузбасс — 190 млн т угля в год. Что с рекультивацией разрезов?", options: [
        { id: "novokuznetsk-q0-o0", label: "Бросить разрез — природа сама", correct: false, hint: "долго" },
        { id: "novokuznetsk-q0-o1", label: "Рекультивация + посадка кедров/леса", correct: true, hint: "+42" },
        { id: "novokuznetsk-q0-o2", label: "Засыпать мусором", correct: false, hint: "−142" },
        { id: "novokuznetsk-q0-o3", label: "Не знать где разрез", correct: false, hint: "учи" },
      ]},
      { emoji: "🌲", q: "Лес Кузбасса — 4817,5 тыс га. Твой мув?", options: [
        { id: "novokuznetsk-q1-o0", label: "Сажаю весной кедры, агитирую за субботники", correct: true, hint: "+42" },
        { id: "novokuznetsk-q1-o1", label: "Жгу уголь без фильтра", correct: false, hint: "коптим" },
        { id: "novokuznetsk-q1-o2", label: "Рублю бор без посадки", correct: false, hint: "−142" },
        { id: "novokuznetsk-q1-o3", label: "Не в курсе про лес", correct: false, hint: "−42" },
      ]},
    ]
  },
  {
    id: "belovo", name: "БЕЛОВО", sub: "Беловское вдхр • 68k", x: 540, y: 340, color: "#ffcc00", theme: "Вода/пластик",
    qs: [
      { emoji: "♻️", q: "Беловское водохранилище — пластик у воды?", options: [
        { id: "belovo-q0-o0", label: "Собрал в пакет, донёс до бака", correct: true, hint: "+42" },
        { id: "belovo-q0-o1", label: "Оставил на берегу — природа вывезет", correct: false, hint: "−142" },
        { id: "belovo-q0-o2", label: "Кинул в воду", correct: false, hint: "−142" },
        { id: "belovo-q0-o3", label: "Сжёг на пляже", correct: false, hint: "дым" },
      ]},
      { emoji: "🧴", q: "Пластик — куда после пикника?", options: [
        { id: "belovo-q1-o0", label: "Разделил ПЭТ/стекло — сдал", correct: true, hint: "+42" },
        { id: "belovo-q1-o1", label: "В общий мусор", correct: false, hint: "−5" },
        { id: "belovo-q1-o2", label: "Закопал", correct: false, hint: "−42" },
        { id: "belovo-q1-o3", label: "Сжёг", correct: false, hint: "хуже" },
      ]},
    ]
  },
  {
    id: "prokopievsk", name: "ПРОКОПЬЕВСК", sub: "Шахты • 187k • уголь", x: 580, y: 380, color: "#9147ff", theme: "Шахты/уголь",
    qs: [
      { emoji: "🏗️", q: "Прокопьевск — шахты Кузбасса. Что с угольной пылью?", options: [
        { id: "prokopievsk-q0-o0", label: "Фильтры + брикеты + субботники на Томи", correct: true, hint: "+42" },
        { id: "prokopievsk-q0-o1", label: "Топлю чем попало без фильтра", correct: false, hint: "−142" },
        { id: "prokopievsk-q0-o2", label: "Не знаю что такое пыль", correct: false, hint: "учи" },
        { id: "prokopievsk-q0-o3", label: "Жгу мусор с углём", correct: false, hint: "−42" },
      ]},
      { emoji: "🪨", q: "Уголь Кузбасса — 95,7 тыс км², 3 хребта (Кузнецкий Алатау, Салаир). Твой вклад?", options: [
        { id: "prokopievsk-q1-o0", label: "Переработка + агитация MAGNUM 42", correct: true, hint: "+42" },
        { id: "prokopievsk-q1-o1", label: "Выкинул пластик в Томь", correct: false, hint: "−142" },
        { id: "prokopievsk-q1-o2", label: "Игнор", correct: false, hint: "мимо" },
        { id: "prokopievsk-q1-o3", label: "Только уголь жгу", correct: false, hint: "−42" },
      ]},
    ]
  },
  {
    id: "mezhdurechensk", name: "МЕЖДУРЕЧЕНСК", sub: "Горная Шория • 96k • исток Томи", x: 700, y: 520, color: "#00ffcc", theme: "Исток/тайга",
    qs: [
      { emoji: "🏔️", q: "Междуреченск — у истока Томи, тайга. Что с лесом?", options: [
        { id: "mezhdurechensk-q0-o0", label: "Посадка кедров + защита бора", correct: true, hint: "+42" },
        { id: "mezhdurechensk-q0-o1", label: "Рублю без восстановления", correct: false, hint: "−142" },
        { id: "mezhdurechensk-q0-o2", label: "Мусор в тайге", correct: false, hint: "−142" },
        { id: "mezhdurechensk-q0-o3", label: "Не знаю где исток", correct: false, hint: "−42" },
      ]},
      { emoji: "🌲", q: "Сосновый бор Кемерово — субботник?", options: [
        { id: "mezhdurechensk-q1-o0", label: "Иду на субботник, собираю 42 бутылки", correct: true, hint: "+42" },
        { id: "mezhdurechensk-q1-o1", label: "Не хожу — пусть другие", correct: false, hint: "−42" },
        { id: "mezhdurechensk-q1-o2", label: "Мусорю в бору", correct: false, hint: "−142" },
        { id: "mezhdurechensk-q1-o3", label: "Жгу костёр с пластиком", correct: false, hint: "хуже" },
      ]},
    ]
  },
];

export const BOSS_Q_CANON: MapQ[] = [
  { emoji: "🗺️", q: "Кузбасс — 42 регион. Что в сердце региона?", options: [
    { id: "boss-q0-o0", label: "Томь 827 км + 95,7k км² + 190M уголь", correct: true, hint: "+1420" },
    { id: "boss-q0-o1", label: "Не знаю", correct: false, hint: "учи" },
    { id: "boss-q0-o2", label: "Только уголь", correct: false, hint: "мало" },
    { id: "boss-q0-o3", label: "42 — просто число", correct: false, hint: "мимо" },
  ]},
  { emoji: "♻️", q: "Эко-миссия Кузбасса — что делаешь для Томи?", options: [
    { id: "boss-q1-o0", label: "Сортировка 7дн + фандомат + субботники", correct: true, hint: "+1420" },
    { id: "boss-q1-o1", label: "Кидаю пластик в реку", correct: false, hint: "−142" },
    { id: "boss-q1-o2", label: "Жгу пластик", correct: false, hint: "дым" },
    { id: "boss-q1-o3", label: "Игнор", correct: false, hint: "мимо" },
  ]},
];

// — helpers —
export const MAP_POINT_IDS = POINTS_CANON.map(p => p.id) as readonly string[];
export function isMapPointId(v: string): boolean { return (MAP_POINT_IDS as readonly string[]).includes(v); }
export function findMapPoint(pointId: string): MapPointDef | undefined { return POINTS_CANON.find(p => p.id === pointId); }
export function getCorrectAnswerIds(pointId: string): string[] {
  const p = findMapPoint(pointId);
  if (!p) return [];
  return p.qs.flatMap(q => q.options.filter(o => o.correct).map(o => o.id));
}
export function getCorrectAnswerLabels(pointId: string): string[] {
  const p = findMapPoint(pointId);
  if (!p) return [];
  return p.qs.flatMap(q => q.options.filter(o => o.correct).map(o => o.label));
}
/** true если answerId совпадает с id или label правильного варианта точки (или босса если pointId==='boss') */
export function isCorrectAnswer(pointId: string, answerId: string): boolean {
  const a = String(answerId || "").trim();
  if (!a) return false;
  if (pointId === "boss") {
    for (const q of BOSS_Q_CANON) for (const o of q.options) if (o.correct && (o.id === a || o.label === a)) return true;
    return false;
  }
  const p = findMapPoint(pointId);
  if (!p) return false;
  for (const q of p.qs) for (const o of q.options) if (o.correct && (o.id === a || o.label === a)) return true;
  return false;
}
/** Проверка что все 5 точек закрашены по канону */
export function isAllPointsDone(points: Record<string, boolean>): boolean {
  return MAP_POINT_IDS.every(id => points[id] === true);
}
