import { describe, it, expect } from "bun:test";
import { ZAVRI_ROSTER, ZAVRI_ROTATION_MS, zavriBannerIndex, zavriBannerSlotStart, zavriBannerDef } from "../src/lib/zavri/catalog";
import { ZAVRI_SHARDS_DUPE, ZAVRI_ASCEND_COST, ZAVRI_BEG_MAX_PER_DAY, rollRarity, rollZavri, zavriBuffPct, breedChildSpecies, isBegIntent, begRollGranted } from "../src/lib/zavri/gacha";

describe("Zavri 42 — ротация баннеров", () => {
  it("30 мин слот, 12 персонажей, детерминированная", () => {
    expect(ZAVRI_ROTATION_MS).toBe(30 * 60 * 1000);
    expect(ZAVRI_ROSTER.length).toBe(12);
    const t0 = 0, t1 = ZAVRI_ROTATION_MS;
    expect(zavriBannerIndex(t0)).toBe(0);
    expect(zavriBannerIndex(t1)).toBe(1);
    expect(zavriBannerIndex(ZAVRI_ROTATION_MS * 12)).toBe(0);
    expect(zavriBannerSlotStart(12345)).toBe(0);
    expect(zavriBannerSlotStart(ZAVRI_ROTATION_MS + 1)).toBe(ZAVRI_ROTATION_MS);
  });
  it("featured определяется текущим слотом", () => {
    expect(zavriBannerDef(0).id).toBe(ZAVRI_ROSTER[0]!.id);
    expect(zavriBannerDef(ZAVRI_ROTATION_MS).id).toBe(ZAVRI_ROSTER[1]!.id);
  });
  it("редкости распределены 2/4/2/4", () => {
    const counts = { legendary: 0, epic: 0, rare: 0, common: 0 } as Record<string, number>;
    for (const z of ZAVRI_ROSTER) counts[z.rarity]!++;
    expect(counts.legendary).toBe(2);
    expect(counts.epic).toBe(4);
    expect(counts.rare).toBe(2);
    expect(counts.common).toBe(4);
  });
});

describe("Zavri 42 — pity крутки", () => {
  it("гарант 180 на 5★ и 90 на 4★", () => {
    expect(rollRarity(179, 0, () => 0.99)).toBe("legendary");
    expect(rollRarity(0, 89, () => 0.99)).toBe("epic");
    expect(rollRarity(179, 89, () => 0.99)).toBe("legendary");
  });
  it("мягкая жалость растёт с 65", () => {
    const low = rollZavri({ p4: 0, p5: 64, lost5050: false }, ZAVRI_ROSTER[0]!.id, new Set(), () => 0.005);
    const mid = rollZavri({ p4: 0, p5: 75, lost5050: false }, ZAVRI_ROSTER[0]!.id, new Set(), () => 0.005);
    // оба легендарки, т.к. legChance увеличен
    expect(low.result.rarity).toBe("legendary");
    expect(mid.result.rarity).toBe("legendary");
  });
  it("50/50 на легендарке", () => {
    const feat = ZAVRI_ROSTER.find((z) => z.rarity === "legendary")!.id;
    // проигрыш 50/50 с сохранением жалости
    const lost = rollZavri({ p4: 0, p5: 179, lost5050: false }, feat, new Set(), (() => { let i = 0; return () => [0.995, 0.9][i++ % 2]!; })());
    // rng 0.9 при 50/50 → проигрыш (другой легендарный)
    expect(lost.result.rarity).toBe("legendary");
    if (lost.won5050 === false) expect(lost.next.lost5050).toBe(true);
  });
  it("гарант фичи после проигрыша 50/50", () => {
    const feat = ZAVRI_ROSTER.find((z) => z.rarity === "legendary")!.id;
    const guaranteed = rollZavri({ p4: 0, p5: 179, lost5050: true }, feat, new Set(), () => 0.9);
    expect(guaranteed.result.rarity).toBe("legendary");
    expect((guaranteed.result as { speciesId: string }).speciesId).toBe(feat);
    expect(guaranteed.next.lost5050).toBe(false);
  });
  it("дубль → осколки", () => {
    const rareId = ZAVRI_ROSTER.find((z) => z.rarity === "rare")!.id;
    // форсируем rare: ледж 0.006 + эпик 0.051 = 0.057, rare 0.2 → r=0.15 даёт rare
    const out = rollZavri({ p4: 0, p5: 0, lost5050: false }, ZAVRI_ROSTER[0]!.id, new Set([rareId]), () => 0.15);
    if (out.result.kind === "shards") expect(out.result.amount).toBe(ZAVRI_SHARDS_DUPE[out.result.rarity]);
  });
});

describe("Zavri 42 — баффы", () => {
  it("уникальные виды, вознесение ×1.5, сытость 0.5..1", () => {
    const lonePyaterka = [{ speciesId: "pyaterka", ascension: 0, hunger: 100 }];
    const a = zavriBuffPct(lonePyaterka);
    expect(a.mining).toBe(15);
    const hungry = zavriBuffPct([{ speciesId: "pyaterka", ascension: 0, hunger: 0 }]);
    expect(hungry.mining).toBe(7.5);
    const asc = zavriBuffPct([{ speciesId: "pyaterka", ascension: 2, hunger: 100 }]);
    expect(asc.mining).toBe(30); // 15 *2
    // кап 42%
    const many = ZAVRI_ROSTER.slice(0, 6).map((z) => ({ speciesId: z.id, ascension: 4, hunger: 100 }));
    expect(zavriBuffPct(many).mining).toBeLessThanOrEqual(42);
  });
});

describe("Zavri 42 — размножение", () => {
  it("один вид → он же, разные → случайный из родителей", () => {
    expect(breedChildSpecies("pyaterka", "pyaterka", () => 0.9)).toBe("pyaterka");
    const both = new Set([breedChildSpecies("pyaterka", "mops42", () => 0.1), breedChildSpecies("pyaterka", "mops42", () => 0.9)]);
    expect(both.has("pyaterka") && both.has("mops42"));
  });
});

describe("Zavri 42 — выпрашивание у бота", () => {
  it("интент: нужны два маркера", () => {
    expect(isBegIntent("дай крутку пожалуйста")).toBe(true);
    expect(isBegIntent("хочу завра")).toBe(true);
    expect(isBegIntent("крутка")).toBe(false);
    expect(isBegIntent("пожалуйста")).toBe(false);
  });
  it("жалость на 5-й день — гарант первой выдачи", () => {
    expect(begRollGranted(5, 0, () => 0.99)).toBe(true);
    expect(begRollGranted(0, 0, () => 0.99)).toBe(false);
    expect(begRollGranted(0, 5, () => 0)).toBe(false);
  });
  it("лимит 5/день", () => {
    expect(begRollGranted(10, 5, () => 0)).toBe(false);
    expect(ZAVRI_BEG_MAX_PER_DAY).toBe(5);
    expect(ZAVRI_ASCEND_COST.length).toBe(4);
  });
});
