import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { PASS_REWARDS, XP_PER_LEVEL, MAX_LEVEL } from "../lib/pass42";
import styles from "./Pass42Page.module.css";

type Progress = {
  seasonId: string;
  level: number;
  xp: number;
  xpInLevel: number;
  xpNeed: number;
  pct: number;
  premium: boolean;
  claimed: number[];
  progress: number; // 0-42
};

export function Pass42Page() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const xpRef = useRef<HTMLDivElement>(null);
  const [prog, setProg] = useState<Progress | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    try {
      const r = await fetch("/magnum/api/pass/progress", { credentials: "include" });
      if (r.status === 401) { setMsg("Войди, братуха — нужен magnum:need-auth"); return; }
      const j = await r.json() as { progress?: Progress; balance?: number; error?: string };
      if (j.progress) setProg(j.progress);
      if (typeof j.balance === "number") setBalance(j.balance);
      if (j.error) setMsg(j.error);
    } catch { setMsg("Сеть — попробуй ещё"); }
  }, []);

  const fetchBalance = useCallback(async () => {
    try { const r = await fetch("/magnum/api/coins", { credentials: "include" }); const j = await r.json() as { balance?: number }; if (typeof j.balance === "number") setBalance(j.balance); } catch {}
  }, []);

  useEffect(() => { fetchProgress(); fetchBalance(); }, [fetchProgress, fetchBalance]);

  // GSAP stagger y16 0.06 grid 42 клетки, prefers-reduced-motion gate
  useEffect(() => {
    if (!gridRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      const cells = gridRef.current!.querySelectorAll(`.${styles.cell}`);
      if (!cells.length) return;
      gsap.set(cells, { y: 16, opacity: 0 });
      gsap.to(cells, { y: 0, opacity: 1, duration: 0.42, stagger: 0.06, ease: "power2.out" });
    }, gridRef);
    return () => ctx.revert();
  }, [prog]);

  // progress width 0.6s power2.out
  useEffect(() => {
    if (!barRef.current || !prog) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      barRef.current.style.width = `${(prog.level / MAX_LEVEL) * 100}%`;
      return;
    }
    gsap.to(barRef.current, { width: `${(prog.level / MAX_LEVEL) * 100}%`, duration: 0.6, ease: "power2.out", overwrite: true });
  }, [prog]);

  useEffect(() => {
    if (!xpRef.current || !prog) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      xpRef.current.style.width = `${prog.pct}%`;
      return;
    }
    gsap.to(xpRef.current, { width: `${prog.pct}%`, duration: 0.6, ease: "power2.out", overwrite: true });
  }, [prog]);

  async function claim(level: number) {
    setLoading("claim:" + level); setMsg("");
    const el = gridRef.current?.querySelector(`[data-lv="${level}"]`) as HTMLElement | null;
    try {
      const r = await fetch("/magnum/api/pass/claim", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ level }) });
      const j = await r.json() as { error?: string; balance?: number; claimed?: number[]; progress?: Progress; coins?: number };
      if (r.status === 401) { setMsg("Войди — magnum:need-auth"); return; }
      if (r.status === 423 || r.status === 409 || !r.ok) {
        setMsg(j.error || "Ошибка claim");
        if (el && (j.error || "").includes("locked") && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          gsap.fromTo(el, { x: 0 }, { x: 4, duration: 0.06, yoyo: true, repeat: 3, ease: "power2.inOut" });
        }
        return;
      }
      if (typeof j.balance === "number") setBalance(j.balance);
      if (j.progress) setProg(j.progress);
      else fetchProgress();
      setMsg(j.coins ? `Забрал +${j.coins} монет!` : "Награда забрана!");
      // claim burst scale 0.8->1.4 back.out(1.7) + confetti 100
      if (el && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.fromTo(el, { scale: 0.8 }, { scale: 1.4, duration: 0.42, ease: "back.out(1.7)", yoyo: true, repeat: 1 });
        // confetti 100
        const root = el;
        for (let i = 0; i < 100; i++) {
          const d = document.createElement("div");
          d.style.position = "absolute"; d.style.left = "50%"; d.style.top = "38%"; d.style.width = "6px"; d.style.height = "6px"; d.style.borderRadius = "1px";
          d.style.background = i % 3 === 0 ? "#ff2d55" : i % 3 === 1 ? "#00ff88" : "#ffcc00"; d.style.pointerEvents = "none"; d.style.zIndex = "5";
          root.appendChild(d);
          const ang = Math.random() * Math.PI * 2, dist = 40 + Math.random() * 120;
          gsap.to(d, { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist + 40, rotation: Math.random() * 720, opacity: 0, duration: 0.7 + Math.random() * 0.5, ease: "power2.out", onComplete: () => d.remove() });
        }
      }
    } catch { setMsg("Сеть"); } finally { setLoading(null); }
  }

  async function buyPremium() {
    setLoading("premium"); setMsg("");
    try {
      const r = await fetch("/magnum/api/pass/premium", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const j = await r.json() as { error?: string; balance?: number; progress?: Progress };
      if (!r.ok) { setMsg(j.error || "Ошибка premium"); return; }
      if (typeof j.balance === "number") setBalance(j.balance);
      if (j.progress) setProg(j.progress);
      setMsg("PREMIUM открыт!");
      fetchProgress();
    } catch { setMsg("Сеть"); } finally { setLoading(null); }
  }

  async function buyLevels() {
    setLoading("levels"); setMsg("");
    try {
      const r = await fetch("/magnum/api/pass/buy-levels", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: 10 }) });
      const j = await r.json() as { error?: string; balance?: number; progress?: Progress };
      if (!r.ok) { setMsg(j.error || "Ошибка покупки уровней"); return; }
      if (typeof j.balance === "number") setBalance(j.balance);
      if (j.progress) setProg(j.progress);
      setMsg(" +10 уровней!");
      fetchProgress();
    } catch { setMsg("Сеть"); } finally { setLoading(null); }
  }

  const lvl = prog?.level ?? 0;
  const xp = prog?.xp ?? 0;
  const pct = prog?.pct ?? 0;
  const premium = prog?.premium ?? false;
  const claimed = new Set(prog?.claimed ?? []);

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <h1 className={styles.h1}>ПРОПУСК 42 <span style={{ opacity: 0.6, fontSize: 14, fontWeight: 600 }}>— Battle Pass 42</span></h1>
      <p className={styles.sub}>Сезон s42-2026 • 42 XP = 1 уровень • FREE + PREMIUM (VIP) • XP из всех игр</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <span className={styles.freeTag}>Баланс: {balance ?? "…"} монет</span>
        <span className={styles.freeTag}>Уровень {lvl}/42</span>
        <span className={styles.freeTag}>XP {xp} • {prog ? `${prog.xpInLevel}/${XP_PER_LEVEL}` : `0/${XP_PER_LEVEL}`}</span>
        {premium ? <span className={styles.premTag}>PREMIUM ✓</span> : <span className={styles.premTag}>FREE</span>}
      </div>

      <div className={styles.barWrap} aria-label={`прогресс ${lvl}/42`}>
        <div ref={barRef} className={styles.bar} style={{ width: `${(lvl / 42) * 100}%` }} />
        <div className={styles.barText}>{lvl}/42</div>
      </div>

      <div className={styles.xpBar}>
        <span>XP</span>
        <div className={styles.xpFill}><div ref={xpRef} className={styles.xpFillInner} style={{ width: `${pct}%` }} /></div>
        <span>{prog ? `${prog.xpInLevel}/${XP_PER_LEVEL}` : `0/${XP_PER_LEVEL}`} • {Math.round(pct)}%</span>
      </div>

      <div className={styles.cta}>
        {!premium && <button className={styles.ctaBtn} onClick={buyPremium} disabled={loading === "premium"}>{loading === "premium" ? "…" : "Открыть PREMIUM 420"}</button>}
        <button className={styles.ctaGhost} onClick={buyLevels} disabled={loading === "levels"}>{loading === "levels" ? "…" : "Купить +10 уровней 1420"}</button>
        {!premium && <span className={styles.premiumLocked}>premium-трек откроется при tier=vip/vip+/pro (magnum_subscriptions) или 420 монет</span>}
        <span className={styles.msg}>{msg}</span>
      </div>

      <div className={styles.tape} aria-label="лента наград">
        {PASS_REWARDS.slice(0, 8).map((rw) => (
          <div key={`tape-${rw.level}`} className={styles.tapeItem}>{rw.level}: {rw.free?.coins ? `${rw.free.coins} монет` : rw.free?.skinId ? "скин" : rw.free?.keyId ? "кейс" : "—"} {rw.premium?.coins ? `• PREM ${rw.premium.coins}` : ""}</div>
        ))}
        <div className={styles.tapeItem}>… 42 уровня</div>
      </div>

      <div ref={gridRef} className={styles.grid}>
        {PASS_REWARDS.map((rw) => {
          const unlocked = rw.level <= lvl;
          const isClaimed = claimed.has(rw.level);
          const canClaim = unlocked && !isClaimed;
          const locked = !unlocked;
          const freeTxt = rw.free ? `${rw.free.coins ? `+${rw.free.coins} монет` : ""}${rw.free.skinId ? ` • скин` : ""}${rw.free.keyId ? ` • кейс` : ""}${rw.free.freeze ? ` • freeze` : ""}`.replace(/^ • /, "") || "—" : "—";
          const premTxt = rw.premium ? `${rw.premium.coins ? `+${rw.premium.coins}` : ""}${rw.premium.skinId ? ` • скин PREM` : ""}${rw.premium.keyId ? ` • кейс PREM` : ""}`.replace(/^ • /, "") || "—" : "—";
          return (
            <div key={rw.level} data-lv={rw.level} className={`${styles.cell} ${locked ? styles.cellLocked : ""} ${isClaimed ? styles.cellClaimed : ""} ${rw.premium ? styles.cellPremium : ""}`}>
              <div className={styles.badge}>LV {rw.level}</div>
              <div className={styles.lvl}>{rw.level}</div>
              <div className={styles.reward}>
                <div><span className={styles.freeTag}>FREE</span> {freeTxt}</div>
                <div style={{ marginTop: 4 }}><span className={styles.premTag}>PREM</span> {premTxt} {!premium && rw.premium ? " 🔒" : ""}</div>
              </div>
              <div className={styles.actions}>
                <button className={styles.btn} disabled={!canClaim || loading === `claim:${rw.level}`} onClick={() => claim(rw.level)}>{isClaimed ? "Забрано ✓" : canClaim ? "Забрать награду" : `LV ${rw.level}`}</button>
              </div>
              {locked && <div className={styles.lock}>🔒 LV {rw.level}</div>}
            </div>
          );
        })}
      </div>

      <p style={{ marginTop: 12, opacity: 0.6, fontSize: 12 }}>XP: +10 за игру (любой из 17 games/*), +42 за дуэль-win, +20 за eco-точку, +5 за майнинг-клик-пачку • Каждые 42 XP = 1 уровень • Чётные: 42/142 монет • 7/14/21/28/35/42: скины/кейсы/freeze</p>
    </div>
  );
}
