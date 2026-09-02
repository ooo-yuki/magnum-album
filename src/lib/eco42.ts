// ECO PLAST 42 — 8Q Пластик/Томь/Кузбасс + сортировка 7дн — канон hype-queue #45
// P1 42/142/420 +1420 босс 8/8 freeze 420 1/нед OG 1080×1080 +42
// Сверено с SPEC-42 §8: MAGNUM 8K/200K VPN 28.04 CLAY 73 NOVA 80/XXL86
export type EcoOption = { label: string; points: number; hint: string };
export type EcoQuestion = { id: number; q: string; emoji: string; options: EcoOption[] };

export const ECO_PLAST_QUESTIONS: EcoQuestion[] = [
  {
    id: 1,
    emoji: "♻️",
    q: "Пластик — 40% мусора в Томи — пластик. Твой мув с PET/PP?",
    options: [
      { label: "Кидаю всё в один бак — сортировка для слабаков", points: -42, hint: "−42" },
      { label: "Сливаю ПЭТ-бутылки в Томь — река вывезет", points: -142, hint: "−142 и бан" },
      { label: "Мою PET/PP, жму, сдаю в эко-пункт Кемерово", points: 42, hint: "PLAST +42" },
      { label: "7дн: пластик отдельно, веду PLAST-стрик 42 мин/день", points: 42, hint: "Сортировка 7дн +42" },
    ],
  },
  {
    id: 2,
    emoji: "🌊",
    q: "Томь — 827 км через Кузбасс. Что с пластиком у реки?",
    options: [
      { label: "Оставил гору ПЭТ на берегу — природа вывезет", points: -42, hint: "Не вывезет" },
      { label: "Сливаю масло + пластик в Томь — унесёт", points: -142, hint: "−142" },
      { label: "Убрал 5 кг пластика с берега, донёс до бака", points: 42, hint: "Томь +42" },
      { label: "Высадил ивы у Томи, ставлю сетку от пластика", points: 42, hint: "Эко-берег +42" },
    ],
  },
  {
    id: 3,
    emoji: "⛰️",
    q: "Кузбасс — 95,7k км², 86,6% горожан, 190 млн т угля. А пластик региона?",
    options: [
      { label: "Жгу пластик на заводе — дым скроет, Кузбасс стерпит", points: -142, hint: "−142 смог" },
      { label: "Не сортирую — Кузбасс сам разберётся", points: -42, hint: "Не разберётся" },
      { label: "Сдаю ~42 кг пластика/год, агитирую цех сортировать", points: 42, hint: "Кузбасс 42 +42" },
      { label: "Организую сортировку на смене 7дн с плакатом 42", points: 42, hint: "Смена 42 +42" },
    ],
  },
  {
    id: 4,
    emoji: "🧊",
    q: "Сортировка 7дн — твой челлендж PLAST 42?",
    options: [
      { label: "Не сортирую — всё в один пакет", points: -42, hint: "−42" },
      { label: "Сортирую иногда, когда не лень", points: 5, hint: "Полдела" },
      { label: "7 дней подряд: PET/HDPE/PP мою и сдаю по фракциям", points: 42, hint: "Вахта 7дн +42" },
      { label: "Веду PLAST-дневник, чищу район 42 мин/день, фото-отчёт", points: 42, hint: "PLAST легенда" },
    ],
  },
  {
    id: 5,
    emoji: "4️⃣2️⃣",
    q: "Число 42 — шифр Кузбасса + эко-код. Твоя трактовка?",
    options: [
      { label: "Просто число", points: -5, hint: "Мимо" },
      { label: "Шифр Кузбасса — 42 регион, наш код", points: 42, hint: "+42" },
      { label: "MAGNUM 42 — альбом 5opka, 42 — наш эко-вайб", points: 42, hint: "+42" },
      { label: "42 монеты за каждый стрик — фармлю PLAST", points: 15, hint: "Норм" },
    ],
  },
  {
    id: 6,
    emoji: "📊",
    q: "MAGNUM 8K/200K — StreamsCharts 28,545 пик, 8K онлайна — твой вклад?",
    options: [
      { label: "Слушаю на пиратке без пресейва", points: -42, hint: "−42" },
      { label: "Пресейв на Яндекс.Музыке + шарю друзьям", points: 42, hint: "+42 пресейв" },
      { label: "Стримлю 200K часов с комьюнити", points: 42, hint: "8K/200K легенда" },
      { label: "Не слушаю MAGNUM", points: -142, hint: "−142" },
    ],
  },
  {
    id: 7,
    emoji: "🔒",
    q: "VPN — релиз 28.04, CLAY 73 — твой сетап?",
    options: [
      { label: "VPN 28.04 — качаю, шарю, стримлю", points: 42, hint: "+42" },
      { label: "CLAY 73 — знаю трек, подпеваю", points: 42, hint: "CLAY73 +42" },
      { label: "Не слышал про VPN/CLAY", points: -42, hint: "Послушай" },
      { label: "Скачал VPN через торрент", points: -10, hint: "Поддержи релиз" },
    ],
  },
  {
    id: 8,
    emoji: "🎤",
    q: "NOVA 80/XXL86 — твой мув под эко-стрик?",
    options: [
      { label: "NOVA 80/86 — в плейлисте, на повторе", points: 42, hint: "NOVA +42" },
      { label: "Кидаю ПЭТ в тайге под NOVA", points: -142, hint: "Дисонанс" },
      { label: "Сортирую пластик под NOVA 80 на репите", points: 42, hint: "Вайб +42" },
      { label: "Не знаю NOVA", points: -5, hint: "Чекни" },
    ],
  },
];


export function ecoWeekId(d = new Date()): string {
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - jan1.getTime()) / 86400000);
  const w = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(w).padStart(2, "0")}`;
}

export function calcEcoPlastScore(answers: (number | null)[], questions = ECO_PLAST_QUESTIONS): number {
  return answers.reduce<number>((acc, ansIdx, qIdx) => ansIdx === null ? acc : acc + questions[qIdx]!.options[ansIdx as number]!.points, 0);
}

// legacy alias
export const QUESTIONS = ECO_PLAST_QUESTIONS;
