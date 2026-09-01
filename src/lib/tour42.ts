// tour42.ts — ТУР 42 канон 12 точек 2024-2026 — единый источник для сервера и клиента
export type TourStop = {
  id: string;
  city: string;
  date: string; // YYYY-MM-DD
  year: 2024 | 2025 | 2026;
  venue: string;
  setlist: [string, string, string];
  fact: string;
  coords: { x: number; y: number };
  image: string;
};

export const TOUR_STOPS: TourStop[] = [
  { id: "tour-kemerovo", city: "Кемерово", date: "2024-02-14", year: 2024, venue: "Филармония Кузбасса", setlist: ["42", "Кемерово — код 42", "Томь"], fact: "Старт тура — 42 братухи в зале, sold-out за 42 часа.", coords: { x: 520, y: 380 }, image: "/magnum/images/tour/kemerovo.jpg" },
  { id: "tour-novosibirsk", city: "Новосибирск", date: "2024-05-18", year: 2024, venue: "Экспоцентр", setlist: ["42", "Сибирь флекс", "Ночь в Новосибе"], fact: "Самая северная точка 2024 — фан-зона 1420 чел.", coords: { x: 480, y: 350 }, image: "/magnum/images/tour/novosibirsk.jpg" },
  { id: "tour-ekaterinburg", city: "Екатеринбург", date: "2024-08-10", year: 2024, venue: "Tele-Club", setlist: ["VPN", "Горы Урала", "42"], fact: "Урал зажёг — первый open-air тура, +142 новых братух.", coords: { x: 360, y: 320 }, image: "/magnum/images/tour/ekaterinburg.jpg" },
  { id: "tour-kazan", city: "Казань", date: "2024-11-02", year: 2024, venue: "Баскет-холл", setlist: ["Туса медуза", "Чай с чак-чаком", "VPN"], fact: "Татарстан — бис 3 раза, сет + кавер на локальный хит.", coords: { x: 280, y: 320 }, image: "/magnum/images/tour/kazan.jpg" },
  { id: "tour-moscow", city: "Москва", date: "2025-02-22", year: 2025, venue: "VK Stadium", setlist: ["MAGNUM", "42", "Москва не спит"], fact: "Москва — 4200 зал, лайв на The Fence — 1.2M просмотров.", coords: { x: 200, y: 280 }, image: "/magnum/images/tour/moscow.jpg" },
  { id: "tour-spb", city: "Санкт-Петербург", date: "2025-04-12", year: 2025, venue: "A2 Green Concert", setlist: ["Нева 42", "Белые ночи", "Туса медуза"], fact: "Питер — acoustic сет на крыше после шоу.", coords: { x: 180, y: 150 }, image: "/magnum/images/tour/spb.jpg" },
  { id: "tour-samara", city: "Самара", date: "2025-06-20", year: 2025, venue: "МТЛ Арена", setlist: ["Волга 42", "VPN", "MAGNUM"], fact: "Волга — фанаты приплыли на катерах, флаг 42 метра.", coords: { x: 300, y: 380 }, image: "/magnum/images/tour/samara.jpg" },
  { id: "tour-krasnoyarsk", city: "Красноярск", date: "2025-08-16", year: 2025, venue: "Гранд Холл Сибирь", setlist: ["Енисей", "42", "Тайга"], fact: "Столбы — видос с дрона набрал 210K за ночь.", coords: { x: 590, y: 400 }, image: "/magnum/images/tour/krasnoyarsk.jpg" },
  { id: "tour-rostov", city: "Ростов-на-Дону", date: "2025-10-05", year: 2025, venue: "КСК Экспресс", setlist: ["Юг 42", "Дон", "Туса медуза"], fact: "Юг встретил жарой — лимит воды 42 бутылки ушёл за 5 мин.", coords: { x: 150, y: 500 }, image: "/magnum/images/tour/rostov.jpg" },
  { id: "tour-sochi", city: "Сочи", date: "2026-01-17", year: 2026, venue: "RED Arena", setlist: ["Море 42", "VPN", "Пальмы 42"], fact: "Зимний Сочи — единственный сет в горах, снег+лайв.", coords: { x: 180, y: 560 }, image: "/magnum/images/tour/sochi.jpg" },
  { id: "tour-vladivostok", city: "Владивосток", date: "2026-04-09", year: 2026, venue: "FESCO Hall", setlist: ["Тихий 42", "Мост", "MAGNUM"], fact: "Дальний Восток — 9 часов разницы, стрим в 04:00 МСК — 42K онлайн.", coords: { x: 940, y: 420 }, image: "/magnum/images/tour/vladivostok.jpg" },
  { id: "tour-kaliningrad", city: "Калининград", date: "2026-06-06", year: 2026, venue: "Янтарь Холл", setlist: ["Балтика 42", "42", "Финал 42"], fact: "Финал тура — 12/12, +1420 и tour-legend скин на сцене.", coords: { x: 20, y: 140 }, image: "/magnum/images/tour/kaliningrad.jpg" },
];

export const TOUR_IDS = TOUR_STOPS.map(s => s.id) as readonly string[];
export const TOUR_XP_COST = 42;
export const TOUR_SHARE_REWARD = 42;
export const TOUR_CITY_OF_WEEK_MULT = 2;
export const TOUR_COMPLETE_BONUS = 1420;
export const TOUR_LEGEND_SKIN = "tour-legend";
export const TOUR_LEGEND_VALUE = 1420;
export const TOUR_UNLOCK_THRESHOLDS = [0, 42, 142, 420] as const;

export function findTourStop(id: string): TourStop | undefined { return TOUR_STOPS.find(s => s.id === id); }
export function isTourStopId(v: string): boolean { return (TOUR_IDS as readonly string[]).includes(v); }
export const getTourCityId = (id: string) => id;
export const isTourCityId = isTourStopId;
export function cityOfWeekIndex(date = new Date()): number {
  // ротация по неделям года 0..11
  const jan1 = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - jan1.getTime()) / 86400000);
  const week = Math.floor((days + jan1.getDay()) / 7);
  return ((week % 12) + 12) % 12;
}
export function getCityOfWeek(date = new Date()): TourStop { return TOUR_STOPS[cityOfWeekIndex(date)]!; }
export function xpForUnlockCount(unlocked: number): number { return unlocked * TOUR_XP_COST; }
export function tierForXp(xp: number): number {
  if (xp >= 420) return 3;
  if (xp >= 142) return 2;
  if (xp >= 42) return 1;
  return 0;
}
