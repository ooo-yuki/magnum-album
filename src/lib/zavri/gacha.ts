// gacha.ts — математика крутки 42-завров (pure, тестируемо; без DB/three)
// Китайский стандарт как в lib/gacha.ts: pity 90 (4★) / 180 (5★), soft-pity с 65,
// 50/50 на фичу текущего баннера. Пул — только персонажи (без «оружия»):
//   5★ — фича слота либо второй легендарный (проигрыш 50/50)
//   4★/3★/2★ — случайный завр своей редкости; дубликат → осколки
// Прошедший баннер выбить нельзя по построению: фича определяется текущим 30-мин слотом.

import { softPityCurve } from "../gacha";
import { ZAVRI_ROSTER, type ZavriRarity, type ZavryDef } from "./catalog";

export const ZAVRI_PRICE = { single: 42, ten: 420 } as const;
export function zavriPrice(count: 1 | 10): number {
  return count === 10 ? ZAVRI_PRICE.ten : ZAVRI_PRICE.single;
}

export const ZAVRI_RARITY_TABLE: Record<ZavriRarity, number> = {
  legendary: 0.006, epic: 0.051, rare: 0.2, common: 0.743,
} as const;

/** Дубликат → осколки вида */
export const ZAVRI_SHARDS_DUPE: Record<ZavriRarity, number> = {
  common: 5, rare: 10, epic: 20, legendary: 60,
} as const;

/** Вознесение: осколки вида за уровень 1..4, бафф растёт на 50% за уровень */
export const ZAVRI_ASCEND_COST = [20, 40, 80, 140] as const;
export const ZAVRI_ASCEND_BONUS_MUL = 0.5;
export const ZAVRI_MAX_ASCENSION = ZAVRI_ASCEND_COST.length;

export const SPECIES_BY_RARITY: Record<ZavriRarity, ZavryDef[]> = {
  legendary: ZAVRI_ROSTER.filter((z) => z.rarity === "legendary"),
  epic: ZAVRI_ROSTER.filter((z) => z.rarity === "epic"),
  rare: ZAVRI_ROSTER.filter((z) => z.rarity === "rare"),
  common: ZAVRI_ROSTER.filter((z) => z.rarity === "common"),
};

export type ZavriPity = { p4: number; p5: number; lost5050: boolean };

export type ZavriRollResult =
  | { kind: "species"; rarity: ZavriRarity; speciesId: string; isFeatured: boolean; isNew: boolean }
  | { kind: "shards"; rarity: ZavriRarity; speciesId: string; amount: number };

export type ZavriRollOutcome = {
  result: ZavriRollResult;
  next: ZavriPity;
  won5050: boolean | null; // null — не легендарка
};

export function rollRarity(p5: number, p4: number, rng: () => number): ZavriRarity {
  if (p5 >= 179) return "legendary";
  const leg = softPityCurve(p5);
  const r = rng();
  if (p4 >= 89) return r < leg ? "legendary" : "epic";
  if (r < leg) return "legendary";
  if (r < leg + ZAVRI_RARITY_TABLE.epic) return "epic";
  if (r < leg + ZAVRI_RARITY_TABLE.epic + ZAVRI_RARITY_TABLE.rare) return "rare";
  return "common";
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

export function rollZavri(
  pity: ZavriPity,
  featuredId: string,
  ownedSpecies: ReadonlySet<string>,
  rng: () => number,
): ZavriRollOutcome {
  const rarity = rollRarity(pity.p5, pity.p4, rng);
  let speciesId: string;
  let isFeatured = false;
  let won5050: boolean | null = null;
  let lost5050 = pity.lost5050;

  if (rarity === "legendary") {
    const others = SPECIES_BY_RARITY.legendary.filter((z) => z.id !== featuredId);
    if (pity.lost5050) {
      speciesId = featuredId;
      isFeatured = true;
      won5050 = true;
      lost5050 = false;
    } else if (rng() < 0.5) {
      speciesId = featuredId;
      isFeatured = true;
      won5050 = true;
      lost5050 = false;
    } else {
      speciesId = pick(others, rng).id;
      won5050 = false;
      lost5050 = true;
    }
  } else {
    speciesId = pick(SPECIES_BY_RARITY[rarity], rng).id;
  }

  const p5 = rarity === "legendary" ? 0 : pity.p5 + 1;
  const p4 = rarity === "legendary" || rarity === "epic" ? 0 : pity.p4 + 1;
  const next: ZavriPity = { p4, p5, lost5050 };

  if (ownedSpecies.has(speciesId)) {
    return {
      result: { kind: "shards", rarity, speciesId, amount: ZAVRI_SHARDS_DUPE[rarity] },
      next, won5050,
    };
  }
  return {
    result: { kind: "species", rarity, speciesId, isFeatured, isNew: true },
    next, won5050,
  };
}

/** Сводный бафф коллекции: уникальные виды, вознесение и сытость масштабируют вклад */
export function zavriBuffPct(
  owned: ReadonlyArray<{ speciesId: string; ascension: number; hunger: number }>,
): { mining: number; conveyor: number; coins: number } {
  const bySpecies = new Map<string, { ascension: number; hunger: number }>();
  for (const o of owned) {
    const cur = bySpecies.get(o.speciesId);
    // берём наиболее «звёздный» и наиболее сытый экземпляр вида
    if (!cur || o.ascension > cur.ascension) bySpecies.set(o.speciesId, { ascension: o.ascension, hunger: o.hunger });
    else if (o.ascension === cur.ascension && o.hunger > cur.hunger) bySpecies.set(o.speciesId, { ascension: o.ascension, hunger: o.hunger });
  }
  const totals = { mining: 0, conveyor: 0, coins: 0 };
  for (const [speciesId, st] of bySpecies) {
    const def = ZAVRI_ROSTER.find((z) => z.id === speciesId);
    if (!def) continue;
    const satiety = 0.5 + Math.max(0, Math.min(100, st.hunger)) / 200; // голодный — половина баффа
    const ascMul = 1 + ZAVRI_ASCEND_BONUS_MUL * st.ascension;
    totals[def.buff.kind] += def.buff.pct * ascMul * satiety;
  }
  const cap = (v: number) => Math.min(42, Math.round(v * 10) / 10);
  return { mining: cap(totals.mining), conveyor: cap(totals.conveyor), coins: cap(totals.coins) };
}

/** Размножение: вид ребёнка — от одного из родителей (мутации цвета — через seed на клиенте) */
export function breedChildSpecies(parentA: string, parentB: string, rng: () => number): string {
  if (parentA === parentB) return parentA;
  return rng() < 0.5 ? parentA : parentB;
}
export function breedChildGender(rng: () => number): "m" | "f" {
  return rng() < 0.5 ? "m" : "f";
}

/** Выпрашивание круток у ИИ-бота: шанс 30%, жалость-пити на 5-й просьбе дня, максимум 5 выдач/день */
export const ZAVRI_BEG_MAX_PER_DAY = 5;
export const ZAVRI_BEG_CHANCE = 0.3;
export const ZAVRI_BEG_PITY_ASK = 5;
export function begRollGranted(asksToday: number, grantedToday: number, rng: () => number): boolean {
  if (grantedToday >= ZAVRI_BEG_MAX_PER_DAY) return false;
  if (asksToday >= ZAVRI_BEG_PITY_ASK && grantedToday === 0) return true;
  return rng() < ZAVRI_BEG_CHANCE;
}
export const ZAVRI_BEG_INTENT = /(крут|накрут|прокрут|завр|гач|баннер)/i;
export const ZAVRI_BEG_PLEASE = /(дай|пожалуйста|прошу|можно|хочу|скинь|одолжи|замолв|выпрос|пропусти)/i;
export function isBegIntent(text: string): boolean {
  return ZAVRI_BEG_INTENT.test(text) && ZAVRI_BEG_PLEASE.test(text);
}
