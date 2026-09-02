// catalog.ts — ростер 42-завров: типы + чистые данные (без three)
// Округлые low-poly существа с чертами 42-братух (см. /root/42-characters-*.jpg, 42-design-identity.md)

export type ZavriRarity = "common" | "rare" | "epic" | "legendary";
export type ZavriGender = "m" | "f";
export type Vec3 = [number, number, number];

export type GeoDef =
  | { kind: "icosa"; r: number; detail: number }
  | { kind: "sphere"; r: number; w?: number; h?: number }
  | { kind: "cone"; r: number; h: number }
  | { kind: "cyl"; rTop: number; rBottom: number; h: number }
  | { kind: "box"; w: number; h: number; d: number }
  | { kind: "torus"; r: number; tube: number; arc?: number };

export type PartDef = {
  geo: GeoDef;
  pos: Vec3;
  rot?: Vec3;
  scale?: Vec3 | number;
  color: string;
  emissive?: string; // цвет свечения (гало, неон)
  metal?: boolean;   // металлический материал
  opacity?: number;  // <1 — полупрозрачный
};

export type EyeStyle = "normal" | "shades" | "none";

export type ZavriBuff = { kind: "mining" | "conveyor" | "coins"; pct: number };

export type ZavryDef = {
  id: string;
  name: string;
  title: string;      // подпись на баннере
  rarity: ZavriRarity;
  gender: ZavriGender;
  quote: string;
  buff: ZavriBuff;
  body: { color: string; belly?: string; scale: number; eyes: EyeStyle; brows?: boolean };
  traits: PartDef[];  // декоративные части в локальных координатах тела
};

export const RARITY_LABEL: Record<ZavriRarity, string> = {
  common: "2★ ОБЫЧНЫЙ", rare: "3★ РЕДКИЙ", epic: "4★ ЭПИЧЕСКИЙ", legendary: "5★ ЛЕГЕНДАРНЫЙ",
};
export const RARITY_COLOR: Record<ZavriRarity, string> = {
  common: "#9aa4b2", rare: "#5865f2", epic: "#a855f7", legendary: "#ffcc00",
};

export const ZAVRI_ROSTER: ZavryDef[] = [
  {
    id: "pyaterka", name: "Пятёрок", title: "ГЕНЕРАЛ ХАЙПА", rarity: "legendary", gender: "m",
    quote: "Без баб. Только завры.",
    buff: { kind: "mining", pct: 15 },
    body: { color: "#4e9e4e", belly: "#f4f1e8", scale: 1.06, eyes: "shades", brows: true },
    traits: [
      // лягушачья шапка (светлее тела — чтобы читалась)
      { geo: { kind: "sphere", r: 0.62 }, pos: [0, 0.78, 0], scale: [1.05, 0.62, 1.05], color: "#82e07a" },
      { geo: { kind: "sphere", r: 0.13 }, pos: [-0.28, 1.12, 0.28], color: "#f2f2ee" },
      { geo: { kind: "sphere", r: 0.13 }, pos: [0.28, 1.12, 0.28], color: "#f2f2ee" },
      { geo: { kind: "sphere", r: 0.06 }, pos: [-0.28, 1.13, 0.37], color: "#1c1c1c" },
      { geo: { kind: "sphere", r: 0.06 }, pos: [0.28, 1.13, 0.37], color: "#1c1c1c" },
      // дужка тёмных очков (линзы — из mesh.ts)
      { geo: { kind: "box", w: 0.16, h: 0.05, d: 0.06 }, pos: [0, 0.3, 0.9], color: "#141414" },
      // золотая перчатка (правая лапа)
      { geo: { kind: "sphere", r: 0.3 }, pos: [1.02, -0.18, 0.2], color: "#ffd34d", metal: true },
      // крюк (левая лапа)
      { geo: { kind: "torus", r: 0.16, tube: 0.045, arc: 4.2 }, pos: [-1.04, -0.26, 0.2], rot: [0, 0, 1.2], color: "#c7ced6", metal: true },
      { geo: { kind: "cyl", rTop: 0.05, rBottom: 0.05, h: 0.22 }, pos: [-0.98, -0.08, 0.2], rot: [0, 0, 0.5], color: "#8b95a1", metal: true },
      // красные лего-кирпичи-тапки
      { geo: { kind: "box", w: 0.42, h: 0.18, d: 0.62 }, pos: [-0.36, -0.98, 0.18], color: "#d8342c" },
      { geo: { kind: "box", w: 0.42, h: 0.18, d: 0.62 }, pos: [0.36, -0.98, 0.18], color: "#d8342c" },
      { geo: { kind: "cyl", rTop: 0.07, rBottom: 0.07, h: 0.08 }, pos: [-0.44, -0.86, 0.34], color: "#c22a23" },
      { geo: { kind: "cyl", rTop: 0.07, rBottom: 0.07, h: 0.08 }, pos: [-0.28, -0.86, 0.34], color: "#c22a23" },
      { geo: { kind: "cyl", rTop: 0.07, rBottom: 0.07, h: 0.08 }, pos: [0.28, -0.86, 0.34], color: "#c22a23" },
      { geo: { kind: "cyl", rTop: 0.07, rBottom: 0.07, h: 0.08 }, pos: [0.44, -0.86, 0.34], color: "#c22a23" },
    ],
  },
  {
    id: "damafan", name: "Дамафан", title: "АНГЕЛ ПРОПАГАНДЫ", rarity: "legendary", gender: "f",
    quote: "Хайп разнесён по миру. Доклад сделан.",
    buff: { kind: "conveyor", pct: 15 },
    body: { color: "#ece2cc", belly: "#f5c542", scale: 1.0, eyes: "normal", brows: true },
    traits: [
      // крылья из диско-шаров
      { geo: { kind: "sphere", r: 0.2 }, pos: [-1.0, 0.35, -0.35], color: "#d7dee8", metal: true },
      { geo: { kind: "sphere", r: 0.15 }, pos: [-1.18, 0.05, -0.4], color: "#c3ccda", metal: true },
      { geo: { kind: "sphere", r: 0.11 }, pos: [-1.28, -0.2, -0.42], color: "#aeb9ca", metal: true },
      { geo: { kind: "sphere", r: 0.2 }, pos: [1.0, 0.35, -0.35], color: "#d7dee8", metal: true },
      { geo: { kind: "sphere", r: 0.15 }, pos: [1.18, 0.05, -0.4], color: "#c3ccda", metal: true },
      { geo: { kind: "sphere", r: 0.11 }, pos: [1.28, -0.2, -0.42], color: "#aeb9ca", metal: true },
      // неоновое гало
      { geo: { kind: "torus", r: 0.42, tube: 0.035 }, pos: [0, 1.12, 0], rot: [1.35, 0, 0], color: "#8ff7ff", emissive: "#67e8ff" },
      // посох-лазер
      { geo: { kind: "cyl", rTop: 0.035, rBottom: 0.035, h: 1.7 }, pos: [1.05, -0.1, 0.25], rot: [0, 0, -0.12], color: "#9aa6b8" },
      { geo: { kind: "sphere", r: 0.12 }, pos: [1.16, 0.72, 0.25], color: "#ff7ad9", emissive: "#ff4ecb" },
    ],
  },
  {
    id: "general-kfc", name: "Генерал КФС", title: "ПОЛКОВОДЕЦ ГОЛЕНОЙ", rarity: "epic", gender: "m",
    quote: "Так хорошо, что аж вкусно.",
    buff: { kind: "coins", pct: 10 },
    body: { color: "#e8e2d6", belly: "#ffffff", scale: 1.02, eyes: "normal", brows: true },
    traits: [
      // красно-белый шарф
      { geo: { kind: "torus", r: 0.52, tube: 0.16 }, pos: [0, 0.55, 0.05], rot: [1.35, 0, 0], color: "#d8342c" },
      { geo: { kind: "box", w: 0.2, h: 0.5, d: 0.1 }, pos: [0.18, 0.1, 0.72], rot: [0.15, 0, -0.15], color: "#ffffff" },
      // красная кепка
      { geo: { kind: "sphere", r: 0.5 }, pos: [0, 0.82, 0], scale: [1, 0.55, 1], color: "#d8342c" },
      { geo: { kind: "cyl", rTop: 0.5, rBottom: 0.5, h: 0.05 }, pos: [0, 0.78, 0.42], rot: [0.28, 0, 0], color: "#c22a23" },
      // голень в лапе
      { geo: { kind: "sphere", r: 0.24 }, pos: [1.05, -0.15, 0.3], scale: [1, 1.15, 1], color: "#b5793e" },
      { geo: { kind: "cyl", rTop: 0.06, rBottom: 0.06, h: 0.3 }, pos: [1.05, 0.14, 0.3], rot: [0, 0, 0.2], color: "#f4f1e8" },
      { geo: { kind: "sphere", r: 0.09 }, pos: [1.02, 0.3, 0.3], color: "#f4f1e8" },
      { geo: { kind: "sphere", r: 0.09 }, pos: [1.12, 0.28, 0.3], color: "#f4f1e8" },
    ],
  },
  {
    id: "kriper", name: "Крипер-братуха", title: "ТИХИЙ ПРАВИЛЬНЫЙ", rarity: "epic", gender: "m",
    quote: "Ш-ш-ш. Хайп взорвётся сам.",
    buff: { kind: "mining", pct: 8 },
    body: { color: "#3fae4a", belly: "#8fd977", scale: 1.0, eyes: "none" },
    traits: [
      // пиксельная морда крипера (высоко — чтобы не перекрывалась брюхом)
      { geo: { kind: "box", w: 0.16, h: 0.16, d: 0.06 }, pos: [-0.3, 0.42, 0.88], color: "#1e4d24" },
      { geo: { kind: "box", w: 0.16, h: 0.16, d: 0.06 }, pos: [0.3, 0.42, 0.88], color: "#1e4d24" },
      { geo: { kind: "box", w: 0.16, h: 0.26, d: 0.06 }, pos: [0, 0.14, 0.9], color: "#1e4d24" },
      { geo: { kind: "box", w: 0.42, h: 0.16, d: 0.06 }, pos: [0, 0.02, 0.9], color: "#1e4d24" },
      // капюшон темнее
      { geo: { kind: "sphere", r: 0.64 }, pos: [0, 0.72, -0.08], scale: [1, 0.6, 1], color: "#2f8f3c" },
    ],
  },
  {
    id: "tiler", name: "Тайлер", title: "ЛАВАНДОВЫЙ МИМ", rarity: "epic", gender: "m",
    quote: "Тайлер??? Вот он я.",
    buff: { kind: "conveyor", pct: 8 },
    body: { color: "#b9a7e6", belly: "#b9a7e6", scale: 0.98, eyes: "normal" },
    traits: [
      // белая мим-маска (выпуклая — поверх тела)
      { geo: { kind: "sphere", r: 0.55 }, pos: [0, 0.18, 0.62], scale: [1, 1.05, 0.62], color: "#f6f3ee" },
      // красный нос
      { geo: { kind: "sphere", r: 0.09 }, pos: [0, 0.12, 1.0], color: "#e24b4b" },
      // капюшон-худи
      { geo: { kind: "torus", r: 0.55, tube: 0.14 }, pos: [0, 0.62, -0.05], rot: [1.35, 0, 0], color: "#a08cd4" },
      // карманы худи
      { geo: { kind: "box", w: 0.4, h: 0.22, d: 0.12 }, pos: [0, -0.42, 0.86], rot: [0.2, 0, 0], color: "#a08cd4" },
    ],
  },
  {
    id: "madam-1642p", name: "Мадам 1642П", title: "ДЕРЖАТЕЛЬНИЦА ЗНАКА", rarity: "epic", gender: "f",
    quote: "1642П — и точка.",
    buff: { kind: "coins", pct: 8 },
    body: { color: "#efe6d8", belly: "#fffdf6", scale: 0.98, eyes: "normal", brows: true },
    traits: [
      // белая меховая шапка
      { geo: { kind: "icosa", r: 0.52, detail: 1 }, pos: [0, 0.8, 0], scale: [1.1, 0.6, 1.1], color: "#fbfaf6" },
      { geo: { kind: "sphere", r: 0.14 }, pos: [0, 1.06, 0], color: "#ffffff" },
      // знак 1642П: сине-красная табличка на палочке
      { geo: { kind: "cyl", rTop: 0.03, rBottom: 0.03, h: 0.9 }, pos: [1.02, -0.2, 0.25], rot: [0, 0, -0.1], color: "#8a6f4d" },
      { geo: { kind: "box", w: 0.42, h: 0.34, d: 0.05 }, pos: [1.06, 0.34, 0.25], rot: [0, 0, -0.06], color: "#4a7fd6" },
      { geo: { kind: "box", w: 0.28, h: 0.34, d: 0.055 }, pos: [1.27, 0.33, 0.25], rot: [0, 0, -0.06], color: "#d8342c" },
    ],
  },
  {
    id: "domino", name: "Доминошник", title: "РОГАТЫЙ СЧЁТЧИК", rarity: "rare", gender: "m",
    quote: "Домино упало — хайп поднялся.",
    buff: { kind: "mining", pct: 4 },
    body: { color: "#3e8e57", belly: "#d7ecd9", scale: 0.95, eyes: "normal", brows: true },
    traits: [
      // зелёная кепка с рогами
      { geo: { kind: "sphere", r: 0.56 }, pos: [0, 0.8, 0], scale: [1, 0.55, 1], color: "#2f7045" },
      { geo: { kind: "cone", r: 0.08, h: 0.4 }, pos: [-0.4, 1.15, 0], rot: [0, 0, 0.5], color: "#f4f1e8" },
      { geo: { kind: "cone", r: 0.08, h: 0.4 }, pos: [0.4, 1.15, 0], rot: [0, 0, -0.5], color: "#f4f1e8" },
      // домино на кепке
      { geo: { kind: "box", w: 0.4, h: 0.22, d: 0.1 }, pos: [0, 0.98, 0.42], rot: [0.15, 0, 0], color: "#f6f3ee" },
      { geo: { kind: "sphere", r: 0.035 }, pos: [-0.09, 1.0, 0.48], color: "#1c1c1c" },
      { geo: { kind: "sphere", r: 0.035 }, pos: [0.09, 0.95, 0.48], color: "#1c1c1c" },
      // полосатый галстук (ниже морды — на брюхе)
      { geo: { kind: "box", w: 0.18, h: 0.5, d: 0.06 }, pos: [0, -0.28, 0.94], rot: [0.18, 0, 0], color: "#57c785" },
      { geo: { kind: "sphere", r: 0.035 }, pos: [0, -0.14, 0.98], color: "#f6f3ee" },
      { geo: { kind: "sphere", r: 0.035 }, pos: [0, -0.28, 0.99], color: "#f6f3ee" },
      { geo: { kind: "sphere", r: 0.035 }, pos: [0, -0.42, 0.98], color: "#f6f3ee" },
    ],
  },
  {
    id: "epalet", name: "Эполет", title: "ЗОЛОТАЯ ПАРА", rarity: "rare", gender: "f",
    quote: "Генеральская пара — на все 42.",
    buff: { kind: "conveyor", pct: 4 },
    body: { color: "#c98f4e", belly: "#f0d9b8", scale: 0.95, eyes: "normal" },
    traits: [
      // эполеты с бахромой
      { geo: { kind: "cyl", rTop: 0.22, rBottom: 0.26, h: 0.1 }, pos: [-0.85, 0.62, 0], rot: [0, 0, 0.25], color: "#ffd34d", metal: true },
      { geo: { kind: "cyl", rTop: 0.22, rBottom: 0.26, h: 0.1 }, pos: [0.85, 0.62, 0], rot: [0, 0, -0.25], color: "#ffd34d", metal: true },
      { geo: { kind: "box", w: 0.05, h: 0.2, d: 0.05 }, pos: [-0.92, 0.48, 0.1], color: "#ffd34d", metal: true },
      { geo: { kind: "box", w: 0.05, h: 0.2, d: 0.05 }, pos: [-0.8, 0.46, 0.12], color: "#ffd34d", metal: true },
      { geo: { kind: "box", w: 0.05, h: 0.2, d: 0.05 }, pos: [0.92, 0.48, 0.1], color: "#ffd34d", metal: true },
      { geo: { kind: "box", w: 0.05, h: 0.2, d: 0.05 }, pos: [0.8, 0.46, 0.12], color: "#ffd34d", metal: true },
      // круглые золотые очки
      { geo: { kind: "torus", r: 0.2, tube: 0.03 }, pos: [-0.3, 0.28, 0.9], color: "#ffd34d", metal: true },
      { geo: { kind: "torus", r: 0.2, tube: 0.03 }, pos: [0.3, 0.28, 0.9], color: "#ffd34d", metal: true },
      { geo: { kind: "box", w: 0.2, h: 0.04, d: 0.04 }, pos: [0, 0.3, 0.94], color: "#ffd34d", metal: true },
      // красная бабочка (между очками и эполетами)
      { geo: { kind: "cone", r: 0.12, h: 0.16 }, pos: [-0.14, 0.52, 0.8], rot: [0, 0, 1.35], color: "#d8342c" },
      { geo: { kind: "cone", r: 0.12, h: 0.16 }, pos: [0.14, 0.52, 0.8], rot: [0, 0, -1.35], color: "#d8342c" },
    ],
  },
  {
    id: "mops42", name: "Мопс 42", title: "ФАНАТ №1", rarity: "common", gender: "m",
    quote: "Мопсы одобряют.",
    buff: { kind: "mining", pct: 2 },
    body: { color: "#d9c49a", belly: "#efe2c4", scale: 0.9, eyes: "normal" },
    traits: [
      // тёмная морда мопса (выпуклая — поверх тела)
      { geo: { kind: "sphere", r: 0.3 }, pos: [0, 0.05, 0.85], scale: [1.15, 0.85, 0.7], color: "#6b5a48" },
      { geo: { kind: "sphere", r: 0.06 }, pos: [0, 0.16, 1.1], color: "#2b2118" },
      // вислые уши
      { geo: { kind: "sphere", r: 0.18 }, pos: [-0.62, 0.55, 0.05], scale: [0.55, 1, 0.7], color: "#6b5a48" },
      { geo: { kind: "sphere", r: 0.18 }, pos: [0.62, 0.55, 0.05], scale: [0.55, 1, 0.7], color: "#6b5a48" },
      // оранжевая худи с капюшоном
      { geo: { kind: "torus", r: 0.5, tube: 0.13 }, pos: [0, 0.5, 0.02], rot: [1.35, 0, 0], color: "#e8862e" },
    ],
  },
  {
    id: "boss-kaban", name: "Кабан Босс", title: "ГЛАВАРЬ БАНДЫ", rarity: "common", gender: "m",
    quote: "Босс на самокате. Точка.",
    buff: { kind: "coins", pct: 2 },
    body: { color: "#6e6259", belly: "#8d8177", scale: 1.04, eyes: "normal", brows: true },
    traits: [
      // синяя кепка
      { geo: { kind: "sphere", r: 0.55 }, pos: [0, 0.82, 0], scale: [1, 0.5, 1], color: "#2f5fd0" },
      { geo: { kind: "cyl", rTop: 0.45, rBottom: 0.45, h: 0.05 }, pos: [0, 0.76, 0.46], rot: [0.25, 0, 0], color: "#274fae" },
      // золотая корона
      { geo: { kind: "cyl", rTop: 0.24, rBottom: 0.26, h: 0.16 }, pos: [0, 1.14, -0.05], color: "#ffd34d", metal: true },
      { geo: { kind: "cone", r: 0.05, h: 0.14 }, pos: [-0.16, 1.28, -0.05], color: "#ffd34d", metal: true },
      { geo: { kind: "cone", r: 0.05, h: 0.18 }, pos: [0, 1.3, -0.05], color: "#ffd34d", metal: true },
      { geo: { kind: "cone", r: 0.05, h: 0.14 }, pos: [0.16, 1.28, -0.05], color: "#ffd34d", metal: true },
      // кабаньи клыки
      { geo: { kind: "cone", r: 0.06, h: 0.2 }, pos: [-0.28, -0.12, 0.8], rot: [2.6, 0, 0.2], color: "#f4f1e8" },
      { geo: { kind: "cone", r: 0.06, h: 0.2 }, pos: [0.28, -0.12, 0.8], rot: [2.6, 0, -0.2], color: "#f4f1e8" },
      // пятнышки
      { geo: { kind: "sphere", r: 0.08 }, pos: [-0.5, -0.3, 0.75], scale: [1, 0.6, 0.4], color: "#57504a" },
      { geo: { kind: "sphere", r: 0.06 }, pos: [0.45, -0.42, 0.78], scale: [1, 0.6, 0.4], color: "#57504a" },
    ],
  },
  {
    id: "monkey-hype", name: "Обезьян-хайп", title: "ГОЛОС ТОЛПЫ", rarity: "common", gender: "f",
    quote: "Всем кричать! По моей команде!",
    buff: { kind: "conveyor", pct: 2 },
    body: { color: "#8a5a33", belly: "#c89b6d", scale: 0.92, eyes: "normal", brows: true },
    traits: [
      // большие уши
      { geo: { kind: "sphere", r: 0.22 }, pos: [-0.72, 0.5, 0], scale: [0.45, 1, 0.8], color: "#c89b6d" },
      { geo: { kind: "sphere", r: 0.22 }, pos: [0.72, 0.5, 0], scale: [0.45, 1, 0.8], color: "#c89b6d" },
      // наушники
      { geo: { kind: "torus", r: 0.52, tube: 0.05, arc: 3.14 }, pos: [0, 0.72, 0], rot: [0, 0, 0], color: "#2b2b2b" },
      { geo: { kind: "cyl", rTop: 0.14, rBottom: 0.14, h: 0.12 }, pos: [-0.62, 0.32, 0], rot: [0, 0, 1.57], color: "#d8342c" },
      { geo: { kind: "cyl", rTop: 0.14, rBottom: 0.14, h: 0.12 }, pos: [0.62, 0.32, 0], rot: [0, 0, 1.57], color: "#d8342c" },
      // микрофон
      { geo: { kind: "sphere", r: 0.14 }, pos: [1.02, 0.05, 0.35], color: "#3a3a3a" },
      { geo: { kind: "cyl", rTop: 0.04, rBottom: 0.04, h: 0.3 }, pos: [1.05, -0.2, 0.32], rot: [0, 0, -0.3], color: "#2b2b2b" },
    ],
  },
  {
    id: "rhino42", name: "Носорог 42", title: "ТЯЖЁЛАЯ ПОДДЕРЖКА", rarity: "common", gender: "m",
    quote: "Несу хайп на себе.",
    buff: { kind: "mining", pct: 2 },
    body: { color: "#7d8a99", belly: "#9fabbb", scale: 1.08, eyes: "normal" },
    traits: [
      // рог (вперёд-вверх, как у носорога)
      { geo: { kind: "cone", r: 0.14, h: 0.5 }, pos: [0, 0.18, 0.98], rot: [0.55, 0, 0], color: "#f4f1e8" },
      { geo: { kind: "cone", r: 0.09, h: 0.3 }, pos: [0, 0.44, 0.86], rot: [0.45, 0, 0], color: "#e3ded2" },
      // броня-накладки
      { geo: { kind: "box", w: 0.7, h: 0.14, d: 0.6 }, pos: [0, 0.72, -0.45], rot: [-0.25, 0, 0], color: "#5b6774" },
      { geo: { kind: "box", w: 0.55, h: 0.12, d: 0.5 }, pos: [0, 0.48, -0.68], rot: [-0.4, 0, 0], color: "#4c5763" },
      // ушки
      { geo: { kind: "sphere", r: 0.12 }, pos: [-0.55, 0.62, 0.1], scale: [0.5, 1, 0.7], color: "#5b6774" },
      { geo: { kind: "sphere", r: 0.12 }, pos: [0.55, 0.62, 0.1], scale: [0.5, 1, 0.7], color: "#5b6774" },
    ],
  },
  {
    id: "nerenol", name: "Неренол", title: "МИЛАЯ КАКАШКА", rarity: "rare", gender: "f",
    quote: "Пахну мило. Не размножаюсь.",
    buff: { kind: "coins", pct: 2 },
    body: { color: "#7a4a2e", belly: "#d8c4a6", scale: 0.97, eyes: "normal", brows: true },
    traits: [
      // завиток какашки (3 яруса)
      { geo: { kind: "sphere", r: 0.42 }, pos: [0, 0.78, 0], scale: [1, 0.52, 1], color: "#6b3e26" },
      { geo: { kind: "sphere", r: 0.32 }, pos: [0, 1.02, 0.04], scale: [1, 0.62, 1], color: "#8b5a2b" },
      { geo: { kind: "sphere", r: 0.22 }, pos: [0, 1.22, 0.08], color: "#9c6b4a" },
      { geo: { kind: "cone", r: 0.14, h: 0.22 }, pos: [0, 1.42, 0.08], color: "#a67c52" },
      // румянец для милоты
      { geo: { kind: "sphere", r: 0.07 }, pos: [-0.28, 0.05, 0.88], scale: [1, 0.7, 0.5], color: "#ffb3c6" },
      { geo: { kind: "sphere", r: 0.07 }, pos: [0.28, 0.05, 0.88], scale: [1, 0.7, 0.5], color: "#ffb3c6" },
      // блик
      { geo: { kind: "sphere", r: 0.06 }, pos: [0.16, 1.26, 0.18], color: "#fff7e6" },
    ],
  },
];

export const ZAVRI_BY_ID: ReadonlyMap<string, ZavryDef> = new Map(ZAVRI_ROSTER.map((z) => [z.id, z]));

/** Порядок ротации баннеров: 13 слотов × 30 мин = круг 6.5 часов */
export const ZAVRI_ROTATION_MS = 30 * 60 * 1000;
export function zavriBannerIndex(now = Date.now()): number {
  return Math.floor(now / ZAVRI_ROTATION_MS) % ZAVRI_ROSTER.length;
}
export function zavriBannerSlotStart(now = Date.now()): number {
  return Math.floor(now / ZAVRI_ROTATION_MS) * ZAVRI_ROTATION_MS;
}
export function zavriBannerDef(now = Date.now()): ZavryDef {
  return ZAVRI_ROSTER[zavriBannerIndex(now)]!;
}
