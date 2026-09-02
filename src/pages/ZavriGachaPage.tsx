import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ZAVRI_ROSTER, ZAVRI_BY_ID, RARITY_COLOR } from "../lib/zavri/catalog";
import { ZAVRI_PRICE } from "../lib/zavri/gacha";
import { ZavriCanvas } from "../components/ZavriCanvas";
import { ZavriTerrarium } from "../components/ZavriTerrarium";
import { ZavriReveal, type ZavriRevealItem } from "../components/ZavriReveal";
import styles from "./ZavriGachaPage.module.css";

type BannerResp = {
  slot: number; idx: number; cycle: number;
  featured: { id: string; name: string; title: string; rarity: string; gender: string; quote: string; buff: { kind: string; pct: number }; img: string; slotStart: string; slotEnd: string; remainingMs: number };
  next: { id: string; name: string };
  remainingMs: number; endsAt: string; slotStart: string;
  roster: Array<{ id: string; name: string; title: string; rarity: string; gender: string; img: string; color: string }>;
  pity: { p4: number; p5: number; lost5050: boolean; pulls: number } | null;
  beg: { asks: number; granted: number; spent: number; available: number; dayId: string } | null;
  balance: number | null;
};
type CollResp = {
  collection: Array<{ id: number; speciesId: string; gender: string; nickname: string | null; xp: number; hunger: number; happiness: number; ascension: number; generation: number; parentA: number | null; parentB: number | null; hoursDecay?: number }>;
  shards: Record<string, number>; pity: { p4: number; p5: number; lost5050: boolean; pulls: number }; buff: { mining: number; conveyor: number; coins: number };
  breeds: Array<{ id: number; parent_a: number; parent_b: number; ready_at: string; claimed: boolean; child_species: string; child_gender: string }>;
  beg: { asks: number; granted: number; spent: number; available: number; dayId: string };
};
type HistResp = { history: Array<{ slot: number; rarity: string; kind: string; species_id: string; amount: number | null; is_new: boolean; created_at: string }> };

function fmtTimer(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60), sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
function rarityBg(r: string): string {
  if (r === "legendary") return "rgba(255,204,0,0.14)";
  if (r === "epic") return "rgba(168,85,247,0.14)";
  if (r === "rare") return "rgba(88,101,242,0.12)";
  return "rgba(255,255,255,0.06)";
}

export function ZavriGachaPage() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [banner, setBanner] = useState<BannerResp | null>(null);
  const [coll, setColl] = useState<CollResp | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<HistResp["history"]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [reveal, setReveal] = useState<ZavriRevealItem[] | null>(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [needAuth, setNeedAuth] = useState(false);
  const [selectedA, setSelectedA] = useState<number | null>(null);
  const [selectedB, setSelectedB] = useState<number | null>(null);
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [eatTicks, setEatTicks] = useState<Record<number, number>>({});
  const [breedTicks, setBreedTicks] = useState<Record<number, number>>({});
  const [breedWalkPair, setBreedWalkPair] = useState<[number, number] | null>(null);
  const [walkEatId, setWalkEatId] = useState<number | null>(null);
  const [matingUntil, setMatingUntil] = useState<number | null>(null);

  const fetchBanner = useCallback(async () => {
    try { const r = await fetch("/magnum/api/zavri/banner", { credentials: "include" }); if (r.ok) setBanner(await r.json() as BannerResp); } catch {}
  }, []);
  const fetchColl = useCallback(async () => {
    try {
      const r = await fetch("/magnum/api/zavri/collection", { credentials: "include" });
      if (r.status === 401) { setNeedAuth(true); return; }
      if (r.ok) { const j = await r.json() as CollResp; setColl(j); if (j.beg) setBanner((b) => b ? { ...b, beg: j.beg } : b); }
    } catch {}
  }, []);
  const fetchBalance = useCallback(async () => {
    try { const r = await fetch("/magnum/api/coins", { credentials: "include" }); if (r.ok) { const j = await r.json() as { balance?: number }; if (typeof j.balance === "number") setBalance(j.balance); } } catch {}
  }, []);
  const fetchHistory = useCallback(async () => {
    try { const r = await fetch("/magnum/api/zavri/history", { credentials: "include" }); if (r.ok) { const j = await r.json() as HistResp; setHistory(j.history || []); } } catch {}
  }, []);

  useEffect(() => { void fetchBanner(); void fetchColl(); void fetchBalance(); void fetchHistory(); }, [fetchBanner, fetchColl, fetchBalance, fetchHistory]);
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, []);
  // refetch banner when slot flips
  const lastSlotRef = useRef<number | null>(null);
  useEffect(() => {
    if (!banner) return;
    const curSlot = Math.floor(now / (30 * 60 * 1000));
    if (lastSlotRef.current !== null && lastSlotRef.current !== curSlot) void fetchBanner();
    lastSlotRef.current = curSlot;
  }, [now, banner, fetchBanner]);

  useEffect(() => {
    if (!wrapRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      const els = wrapRef.current!.querySelectorAll<HTMLElement>("[data-stagger]");
      gsap.set(els, { y: 14, opacity: 0 });
      gsap.to(els, { y: 0, opacity: 1, stagger: 0.06, duration: 0.45, ease: "power2.out", delay: 0.08 });
    }, wrapRef);
    return () => ctx.revert();
  }, [coll, banner]);

  const remaining = banner ? Math.max(0, new Date(banner.endsAt).getTime() - now) : 0;

  const doRoll = async (count: 1 | 10, useGrant = false) => {
    if (loading) return;
    setLoading(useGrant ? "grant" : `roll${count}`);
    setMsg("");
    try {
      const r = await fetch("/magnum/api/zavri/roll", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count, useGrant }) });
      const j = await r.json() as { ok?: boolean; error?: string; results?: Array<{ kind: string; rarity: string; speciesId: string; amount?: number; isNew?: boolean; isFeatured?: boolean }>; balance?: number; pity?: { p4: number; p5: number }; freeUsed?: boolean };
      if (!r.ok) { setMsg(j.error || "ошибка"); if (r.status === 401) setNeedAuth(true); return; }
      if (Array.isArray(j.results) && j.results.length) {
        const mapped: ZavriRevealItem[] = j.results.map((x) => x.kind === "shards" ? { kind: "shards" as const, rarity: x.rarity, speciesId: x.speciesId, amount: Number(x.amount ?? 0) } : { kind: "species" as const, rarity: x.rarity, speciesId: x.speciesId, isNew: Boolean(x.isNew), isFeatured: Boolean(x.isFeatured) });
        setReveal(mapped);
      }
      if (typeof j.balance === "number") setBalance(j.balance);
      await Promise.all([fetchColl(), fetchHistory(), fetchBanner()]);
    } catch (e) { setMsg(e instanceof Error ? e.message : "сеть"); }
    finally { setLoading(null); }
  };

  const doFeed = async (id: number) => {
    setLoading(`feed${id}`);
    try { const r = await fetch("/magnum/api/zavri/feed", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); const j = await r.json() as { error?: string; balance?: number }; if (!r.ok) { setMsg(j.error || "ошибка"); return; } setBalance(j.balance ?? null); setEatTicks((m) => ({ ...m, [id]: (m[id] ?? 0) + 1 })); setWalkEatId(id); window.setTimeout(() => setWalkEatId(null), 900); await fetchColl(); } finally { setLoading(null); }
  };
  const doPet = async (id: number) => {
    try { const r = await fetch("/magnum/api/zavri/pet", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); const j = await r.json() as { error?: string }; if (!r.ok && j.error !== "cooldown") setMsg(j.error || "ошибка"); else await fetchColl(); } catch {}
  };
  const doRename = async (id: number) => {
    if (!renameVal.trim()) return;
    try { const r = await fetch("/magnum/api/zavri/rename", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name: renameVal.trim() }) }); if (!r.ok) { const j = await r.json() as { error?: string }; setMsg(j.error || "ошибка"); return; } setRenameId(null); setRenameVal(""); await fetchColl(); } catch {}
  };
  const doAscend = async (id: number) => {
    setLoading(`asc${id}`);
    try { const r = await fetch("/magnum/api/zavri/ascend", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); const j = await r.json() as { error?: string }; if (!r.ok) { setMsg(j.error || "ошибка"); return; } await fetchColl(); } finally { setLoading(null); }
  };
  const startBreed = async () => {
    if (!selectedA || !selectedB) { setMsg("выбери двух завров разного пола"); return; }
    const a = selectedA, b = selectedB;
    setLoading("breed");
    try { const r = await fetch("/magnum/api/zavri/breed/start", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ a, b }) }); const j = await r.json() as { error?: string }; if (!r.ok) { setMsg(j.error || "ошибка"); return; } const until = Date.now() + 60_000; setMatingUntil(until); setBreedWalkPair([a, b]); setBreedTicks((m) => ({ ...m, [a]: (m[a] ?? 0) + 1, [b]: (m[b] ?? 0) + 1 })); window.setTimeout(() => setBreedWalkPair(null), 61_000); window.setTimeout(() => setMatingUntil(null), 61_000); setSelectedA(null); setSelectedB(null); // яйцо появится только после минуты траха — не фетчим сразу
      window.setTimeout(() => void fetchColl(), 61_200); setMsg("Завры спариваются… яйцо через минуту"); } finally { setLoading(null); }
  };
  const claimBreed = async (breedId: number, rush = false) => {
    setLoading(`claim${breedId}`);
    try { const r = await fetch("/magnum/api/zavri/breed/claim", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ breedId, rush }) }); const j = await r.json() as { error?: string; balance?: number }; if (!r.ok) { setMsg(j.error || "ошибка"); return; } if (typeof j.balance === "number") setBalance(j.balance); await Promise.all([fetchColl(), fetchBalance()]); } finally { setLoading(null); }
  };
  const openBeg = () => {
    window.dispatchEvent(new CustomEvent("open-aibot"));
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("prefill-aibot", { detail: { text: "дай крутку пожалуйста, хочу завра" } })), 250);
  };

  const featured = banner?.featured;
  const pity = coll?.pity ?? banner?.pity ?? null;
  const beg = coll?.beg ?? banner?.beg ?? null;
  const collection = coll?.collection ?? [];
  const shards = coll?.shards ?? {};
  const buff = coll?.buff ?? { mining: 0, conveyor: 0, coins: 0 };
  const breeds = coll?.breeds ?? [];
  const activeBreed = breeds.find((b) => !b.claimed) ?? null;

  const pickSpecies = (id: string) => ZAVRI_BY_ID.get(id) ?? ZAVRI_ROSTER.find((z) => z.id === id) ?? null;
  const selectedNerenolBlocked = [selectedA, selectedB].some((id) => id != null && collection.find((c) => c.id === id)?.speciesId === "nerenol");
  const terrariumItems = useMemo(() => collection.map((c) => ({ id: c.id, speciesId: c.speciesId, hunger: c.hunger, happiness: c.happiness, ascension: c.ascension })), [collection]);

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <div className={styles.hero} data-stagger>
        <div className={styles.heroTitle}>ЗАВРЫ 42</div>
        <div className={styles.heroSub}>Округлые low-poly братухи-завры · 12 видов · баннер 30 минут · прошлого не выбить</div>
        {buff && (buff.mining || buff.conveyor || buff.coins) ? (
          <div className={styles.buffBar} style={{ justifyContent: "center", marginTop: 10 }}>
            <span className={styles.pill} style={{ borderColor: "rgba(0,230,160,0.28)", background: "rgba(0,230,160,0.10)" }}>бафф майнинг +{buff.mining}%</span>
            {buff.conveyor ? <span className={styles.pill} style={{ borderColor: "rgba(96,165,250,0.28)", background: "rgba(96,165,250,0.10)" }}>конвейер +{buff.conveyor}%</span> : null}
            {buff.coins ? <span className={styles.pill} style={{ borderColor: "rgba(250,204,21,0.28)", background: "rgba(250,204,21,0.10)" }}>монеты +{buff.coins}%</span> : null}
          </div>
        ) : null}
      </div>

      {/* BANNER */}
      <section className={styles.banner} data-stagger>
        {featured ? (
          <>
            <div className={styles.bannerArt} style={{ background: `linear-gradient(180deg, ${rarityBg(featured.rarity)} 0%, transparent 62%), radial-gradient(700px 420px at 50% 28%, rgba(255,255,255,0.05), transparent 62%)` }}>
              <img className={styles.bannerImg} src={featured.img} alt={featured.name} loading="eager" decoding="async" />
              <span className={styles.rarityBadge} style={{ color: RARITY_COLOR[featured.rarity as never] ?? "#fff", borderColor: RARITY_COLOR[featured.rarity as never] ?? "rgba(255,255,255,0.12)" }}>{featured.rarity.toUpperCase()} · {featured.name}</span>
              <span className={styles.timer} title={banner?.endsAt}>⏳ {fmtTimer(remaining)}</span>
            </div>
            <div className={styles.bannerInfo}>
              <div className={styles.titleRow}>
                <div className={styles.titleSmall}>БАННЕР {banner!.idx + 1}/12 · ЦИКЛ {banner!.cycle + 1} · СЛОТ {fmtTimer(30 * 60 * 1000)}</div>
                <div className={styles.title}>{featured.name} <span style={{ color: RARITY_COLOR[featured.rarity as never] ?? "#fff", fontSize: 12, verticalAlign: "middle" }}>· {featured.title}</span></div>
                <div className={styles.quote}>“{featured.quote}”</div>
                <div className={styles.meta}>
                  <span className={styles.pill} style={{ color: RARITY_COLOR[featured.rarity as never] ?? "#fff" }}>{featured.rarity === "legendary" ? "5★ ЛЕГЕНДАРНЫЙ" : featured.rarity === "epic" ? "4★ ЭПИЧЕСКИЙ" : featured.rarity === "rare" ? "3★ РЕДКИЙ" : "2★ ОБЫЧНЫЙ"}</span>
                  <span className={styles.pill}>{featured.gender === "m" ? "♂ мальчик" : "♀ девочка"}</span>
                  <span className={styles.pill}>бафф {featured.buff.kind} +{featured.buff.pct}%</span>
                </div>
              </div>

              <div className={styles.pity}>
                {pity ? (
                  <>
                    <span>{pity.pulls} круток · гарант 4★ через {Math.max(0, 90 - pity.p4 - 1)} · 5★ через {Math.max(0, 180 - pity.p5 - 1)} {pity.lost5050 ? "· следующий 5★ — фича (50/50 проигрыш отыгран)" : ""}</span>
                    <span style={{ opacity: 0.7 }}>Дубликат → осколки {featured.rarity === "legendary" ? "(60)" : featured.rarity === "epic" ? "(20)" : "(5–10)"} · прошлого баннера не выбить</span>
                  </>
                ) : <span>Войди, чтобы увидеть жалость</span>}
                {beg ? <span>Выпрошено у бота: {beg.granted - beg.spent} бесплатных · сегодня запросов {beg.asks}/∞ · выдано {beg.granted}/{ZAVRI_PRICE.single === 42 ? 5 : 5}</span> : null}
                {balance !== null ? <span>Баланс: {balance} монет</span> : null}
              </div>

              <div className={styles.actions}>
                <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={!!loading} onClick={() => doRoll(1, false)}>{loading === "roll1" ? "Кручу…" : `Крутить ×1 — ${ZAVRI_PRICE.single} 🪙`}</button>
                <button className={`${styles.btn} ${styles.btnPrimary}`} style={{ opacity: 0.96 }} disabled={!!loading} onClick={() => doRoll(10, false)}>{loading === "roll10" ? "Кручу…" : `×10 — ${ZAVRI_PRICE.ten} 🪙`}</button>
              </div>
              <div className={styles.begRow}>
                <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`} disabled={!!loading} onClick={() => doRoll(1, true)} style={{ opacity: (beg?.available ?? 0) > 0 ? 1 : 0.6 }}>🎁 Бесплатная крутка {beg?.available ? `(${beg.available})` : ""}</button>
                <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`} onClick={openBeg}>🤖 Выпросить у БРАТ-БОТА</button>
                <Link to="/magnum/mining" className={styles.pill} style={{ textDecoration: "none", color: "inherit" }}>Фарм монет → Майнинг</Link>
              </div>
              {msg ? <div className={styles.pill} style={{ borderColor: "rgba(255,80,80,0.28)", background: "rgba(255,80,80,0.10)" }}>{msg}</div> : null}
              {!featured ? <div className={styles.pill}>Загрузка баннера…</div> : <div style={{ fontSize: 11, color: "rgba(255,255,255,0.56)" }}>Следующий баннер: <strong>{banner?.next.name}</strong> · фича меняется каждые 30 минут</div>}
              {needAuth ? <div className={styles.pill}>Войди через шапку — крутки и террариум требуют авторизацию</div> : null}
            </div>
          </>
        ) : (
          <div style={{ padding: 18, gridColumn: "1/-1" }}>Загрузка баннера…</div>
        )}
      </section>

      {/* WALK-TERRARIUM — общий выгул, завры ходят */}
      <section data-stagger>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 className={styles.h2}>Выгул · завры гуляют</h2>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.52)" }}>клик по завру — погладить · ходят сами</span>
        </div>
        <ZavriTerrarium
          items={terrariumItems}
          eatId={walkEatId}
          breedPair={breedWalkPair}
          onPet={(id) => void doPet(id)}
          onPick={(id) => {
            if (!selectedA) setSelectedA(id);
            else if (!selectedB && id !== selectedA) setSelectedB(id);
            else { setSelectedA(id); setSelectedB(null); }
          }}
        />
      </section>

      {/* TERRARIUM */}
      <section data-stagger>
        <div className={styles.terrariumHead}>
          <h2 className={styles.h2}>Террариум · твои завры ({collection.length}/{ZAVRI_ROSTER.length} видов)</h2>
          <div className={styles.buffBar}>
            <span className={styles.pill}>+{buff.mining}% майнинг</span>
            <span className={styles.pill}>+{buff.conveyor}% конвейер</span>
            <span className={styles.pill}>сытость влияет на бафф</span>
          </div>
        </div>

        {needAuth ? (
          <div className={styles.history} style={{ marginTop: 10 }}>Войди, чтобы увидеть завров. Гости видят только баннер.</div>
        ) : collection.length === 0 ? (
          <div className={styles.history} style={{ marginTop: 10, textAlign: "center", color: "rgba(255,255,255,0.68)" }}>
            Пусто. Крутани баннер — выбей первого завра.<br />
            {banner && <span style={{ fontSize: 12 }}>Сейчас в баннере: {banner.featured.name} · {banner.featured.rarity}</span>}
          </div>
        ) : (
          <div className={styles.grid} style={{ marginTop: 10 }}>
            {collection.map((c) => {
              const def = pickSpecies(c.speciesId);
              const isA = selectedA === c.id, isB = selectedB === c.id;
              const selected = isA || isB;
              const hungerPct = Math.max(0, Math.min(100, c.hunger));
              const happyPct = Math.max(0, Math.min(100, c.happiness));
              const canAscend = (shards[c.speciesId] ?? 0) >= (ZAVRI_ROSTER.find((z) => z.id === c.speciesId)?.rarity ? 0 : 0);
              const ascCost = (() => { const cur = c.ascension; const costs = [20, 40, 80, 140] as const; return cur < 4 ? costs[cur]! : null; })();
              const haveShards = shards[c.speciesId] ?? 0;
              return (
                <div key={c.id} className={styles.card} style={{ background: selected ? "rgba(255,204,0,0.06)" : undefined }}>
                  <div className={`${styles.selectRing} ${selected ? styles.selectRingActive : ""}`} aria-hidden />
                  <div className={styles.cardTop} onClick={() => {
                    // селект для размножения: первый клик → A, второй → B (разный пол)
                    if (!isA && !isB) {
                      if (!selectedA) setSelectedA(c.id);
                      else if (!selectedB && c.id !== selectedA) setSelectedB(c.id);
                      else { setSelectedA(c.id); setSelectedB(null); }
                    } else if (isA) setSelectedA(null);
                    else setSelectedB(null);
                  }} style={{ cursor: "pointer" }}>
                    <ZavriCanvas speciesId={c.speciesId} seed={c.id} hunger={c.hunger} happiness={c.happiness} size={168} interactive onPet={() => void doPet(c.id)} eatTick={eatTicks[c.id]} breedTick={breedTicks[c.id]} />
                  </div>
                  <div className={styles.cardMeta}>
                    <div className={styles.cardTitle}>
                      <span>{def?.name ?? c.speciesId}</span>
                      <span className={styles.badge} style={{ color: RARITY_COLOR[def?.rarity as never] ?? "#9aa4b2", borderColor: RARITY_COLOR[def?.rarity as never] ?? "#9aa4b2" }}>{def?.rarity ?? "—"}</span>
                      <span className={styles.pill} style={{ padding: "3px 7px", fontSize: 10 }}>{c.gender === "m" ? "♂" : "♀"} · gen{c.generation} · ☆{c.ascension}</span>
                      {c.speciesId === "nerenol" ? <span className={styles.pill} style={{ fontSize: 9, padding: "3px 6px", borderColor: "rgba(255,120,120,0.5)", color: "#ffb3b3", background: "rgba(255,60,60,0.08)" }}>🚫 бесплоден</span> : null}
                    </div>
                    {def ? <div style={{ fontSize: 11, color: "rgba(255,255,255,0.66)" }}>{def.title} · {c.nickname ? `«${c.nickname}»` : "без клички"}</div> : null}
                    <div className={styles.bars} aria-label="голод и счастье">
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, opacity: 0.7 }}><span>сытость {hungerPct}</span><span>счастье {happyPct}</span></div>
                      <div className={styles.bar}><div className={styles.barFill} style={{ width: `${hungerPct}%`, background: hungerPct < 30 ? "#ff5a5a" : hungerPct < 60 ? "#ffcc00" : "#22c55e" }} /></div>
                      <div className={styles.bar}><div className={styles.barFill} style={{ width: `${happyPct}%`, background: happyPct < 40 ? "#a855f7" : "#60a5fa" }} /></div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.52)" }}>XP {c.xp} · осколки вида {haveShards}{ascCost ? ` · вознесение ${ascCost}` : " · макс"}</div>
                    </div>
                    <div className={styles.cardActions}>
                      <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`} disabled={!!loading} onClick={() => void doFeed(c.id)} title="42 монеты">🍖 {loading === `feed${c.id}` ? "…" : "42"}</button>
                      <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`} onClick={() => void doPet(c.id)} title="Гладить (клик по модели тоже)">✋ гладить</button>
                    </div>
                    <div className={styles.cardActions}>
                      <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`} disabled={!!loading || (ascCost !== null && haveShards < ascCost)} onClick={() => void doAscend(c.id)} title={ascCost ? `Нужно ${ascCost} осколков вида` : "Макс. вознесение"}>
                        {ascCost === null ? "★ макс" : `★ +1 (${ascCost})`}
                      </button>
                      <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`} onClick={() => { setRenameId(c.id); setRenameVal(c.nickname ?? ""); }}>✎ имя</button>
                    </div>
                    {renameId === c.id ? (
                      <div className={styles.nickRow}>
                        <input className={styles.nickInput} value={renameVal} onChange={(e) => setRenameVal(e.target.value)} maxLength={24} placeholder="кличка" />
                        <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`} onClick={() => void doRename(c.id)}>OK</button>
                        <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`} onClick={() => setRenameId(null)}>×</button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* INCUBATOR */}
      <section className={styles.Incubator ?? (styles as unknown as Record<string, string>).Incubator} data-stagger style={{ display: "grid", gap: 10 }}>
        <div className={(styles as unknown as Record<string, string>).Incubator ? undefined : styles.history as unknown as string} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, background: "rgba(18,18,22,0.86)", padding: 14, display: "grid", gap: 10 }}>
          <h2 className={styles.h2}>Инкубатор</h2>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.62)" }}>Выбери двух завров разного пола в террариуме (клик по карточке) · яйцо зреет 30 мин · ускорение 420 монет{selectedNerenolBlocked ? <span style={{ color: "#ff8a8a", marginLeft: 8 }}>· Неренол 🚫 бесплоден</span> : null}</div>
          <div className={styles.begRow}>
            <span className={styles.pill}>A: {selectedA ?? "—"}</span>
            <span className={styles.pill}>B: {selectedB ?? "—"}</span>
            <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`} disabled={!!loading || !selectedA || !selectedB || selectedNerenolBlocked} onClick={() => void startBreed()}>{loading === "breed" ? "…" : selectedNerenolBlocked ? "Неренол не размножается" : "Размножить"}</button>
            <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`} onClick={() => { setSelectedA(null); setSelectedB(null); }}>Сброс</button>
          </div>
          {matingUntil && Date.now() < matingUntil ? (
            <div className={styles.history} style={{ display: "grid", gap: 8, borderColor: "rgba(255,90,138,0.22)", background: "rgba(255,90,138,0.06)" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <strong>💞 Спаривание… {fmtTimer(matingUntil - now)}</strong>
                <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}><div style={{ width: `${Math.round(((60000 - (matingUntil - now)) / 60000) * 100)}%`, height: "100%", background: "linear-gradient(90deg,#ff5a8a,#ff8a00)", transition: "width 0.25s linear" }} /></div>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.62)" }}>Яйцо появится через минуту</span>
              </div>
            </div>
          ) : activeBreed ? (
            (() => {
              const readyMs = new Date(activeBreed.ready_at).getTime();
              const remain = Math.max(0, readyMs - now);
              const ready = remain <= 0;
              return (
                <div className={styles.history} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <strong>Яйцо #{activeBreed.id} → {(() => { const d = pickSpecies(activeBreed.child_species); return d ? `${d.name} (${activeBreed.child_gender === "m" ? "♂" : "♀"})` : activeBreed.child_species; })()}</strong>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.62)" }}>{ready ? "Готово к вылуплению!" : `Зреет · осталось ${fmtTimer(remain)}`}</span>
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`} disabled={!!loading} onClick={() => void claimBreed(activeBreed.id, false)}>{ready ? "Забрать" : "Ждать"}</button>
                    {!ready ? <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`} disabled={!!loading} onClick={() => void claimBreed(activeBreed.id, true)}>⚡ 420</button> : null}
                  </div>
                </div>
              );
            })()
          ) : <div className={styles.pill}>Инкубатор свободен</div>}
        </div>
      </section>

      {/* SHARDS */}
      <section className={styles.shards} data-stagger>
        <h2 className={styles.h2}>Осколки</h2>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.62)" }}>Дубликаты при крутке дают осколки вида · 5/10/20/60 · трать на вознесение (бафф +50% за уровень, до 4)</div>
        <div className={styles.shardsGrid}>
          {ZAVRI_ROSTER.map((z) => {
            const c = shards[z.id] ?? 0;
            return (
              <div key={z.id} className={styles.shardCard} style={{ opacity: c ? 1 : 0.55, borderColor: c ? String(RARITY_COLOR[z.rarity]) : undefined }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <img src={`/magnum/images/zavri/${z.id}.png`} alt={z.name} width={40} height={40} style={{ borderRadius: 8, objectFit: "contain", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }} loading="lazy" />
                  <div style={{ display: "grid" }}><strong style={{ fontSize: 12 }}>{z.name}</strong><span style={{ fontSize: 10, color: String(RARITY_COLOR[z.rarity]), fontWeight: 800 }}>{z.rarity}</span></div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 800 }}>×{c}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* HISTORY */}
      <section className={styles.history} data-stagger>
        <h2 className={styles.h2}>История круток</h2>
        {history.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {history.slice(0, 16).map((h, i) => {
              const def = pickSpecies(h.species_id);
              return (
                <div key={i} className={styles.histRow} style={{ borderColor: h.rarity === "legendary" ? "rgba(255,204,0,0.28)" : h.rarity === "epic" ? "rgba(168,85,247,0.24)" : undefined }}>
                  <span><strong style={{ color: RARITY_COLOR[h.rarity as never] ?? "#fff" }}>{h.rarity}</strong> · {h.kind === "shards" ? `осколки ${def?.name ?? h.species_id} ×${h.amount}` : `${def?.name ?? h.species_id}${h.is_new ? " · новый" : ""}`} <span style={{ opacity: 0.6, fontSize: 11 }}>· слот {String(h.slot)}</span></span>
                  <span style={{ opacity: 0.6, fontSize: 11 }}>{new Date(h.created_at).toLocaleString("ru-RU")}</span>
                </div>
              );
            })}
          </div>
        ) : <div style={{ color: "rgba(255,255,255,0.56)", fontSize: 13 }}>Пока пусто — крутани баннер.</div>}
      </section>

      {reveal ? <ZavriReveal items={reveal} onClose={() => setReveal(null)} /> : null}
    </div>
  );
}
