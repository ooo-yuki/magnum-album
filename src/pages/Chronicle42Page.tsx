import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { CHAPTERS, factOfDay, hashDayToSeed, isValidChapterId, hasAll12 } from "../lib/chronicle42";
import { subscribeMe } from "../lib/authMe";

type ProgressResp = { unlocked: number[]; xpSpent: number; completed: boolean; xp?: number; balance?: number };

export function Chronicle42Page() {
  const nav = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [me, setMe] = useState<{ id: number; username: string } | null>(null);
  const [unlocked, setUnlocked] = useState<number[]>([1, 2, 3]);
  const [xpSpent, setXpSpent] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [factIdx, setFactIdx] = useState(0);
  // need eco/duel flags from server status (derived)
  const [hasEco, setHasEco] = useState(false);
  const [hasDuelWin, setHasDuelWin] = useState(false);

  useEffect(() => subscribeMe(setMe), []);

  const dayId = new Date().toISOString().slice(0, 10);

  const fetchProgress = useCallback(async () => {
    try {
      const r = await fetch("/magnum/api/chronicle/progress", { credentials: "include" });
      const j = (await r.json()) as ProgressResp & { hasEco?: boolean; hasDuelWin?: boolean };
      if (Array.isArray(j.unlocked) && j.unlocked.length) setUnlocked(j.unlocked);
      if (typeof j.xpSpent === "number") setXpSpent(j.xpSpent);
      if (typeof j.completed === "boolean") setCompleted(j.completed);
      if (typeof j.balance === "number") setBalance(j.balance);
      else if (typeof j.xp === "number") setBalance(j.xp);
      if (typeof j.hasEco === "boolean") setHasEco(j.hasEco);
      if (typeof j.hasDuelWin === "boolean") setHasDuelWin(j.hasDuelWin);
    } catch {}
  }, []);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);
  useEffect(() => {
    // fact rotation seed
    setFactIdx(Math.abs(hashDayToSeed(dayId)) % CHAPTERS.length);
  }, [dayId]);

  // fetch eco/duel status separately via progress already includes

  // GSAP: timeline draw line 1.4s
  useEffect(() => {
    if (!lineRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.set(lineRef.current, { scaleY: 0, transformOrigin: "top center" });
      gsap.to(lineRef.current, { scaleY: 1, duration: 1.4, ease: "power3.out" });
    });
    return () => ctx.revert();
  }, []);

  // GSAP: карточка flip y16 0.35 stagger 0.08
  useEffect(() => {
    if (!cardsRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rows = cardsRef.current.querySelectorAll<HTMLElement>("[data-chapter]");
    if (!rows.length) return;
    const ctx = gsap.context(() => {
      gsap.set(rows, { y: 16, opacity: 0 });
      gsap.to(rows, { y: 0, opacity: 1, duration: 0.35, stagger: 0.08, ease: "power2.out" });
    }, cardsRef);
    return () => ctx.revert();
  }, [unlocked]);

  // GSAP: progress bar width 0.8s power3
  useEffect(() => {
    if (!progressBarRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      progressBarRef.current.style.width = `${(unlocked.length / 12) * 100}%`;
      return;
    }
    gsap.to(progressBarRef.current, { width: `${(unlocked.length / 12) * 100}%`, duration: 0.8, ease: "power3.out", overwrite: true });
  }, [unlocked]);

  function isUnlocked(id: number) { return unlocked.includes(id); }
  function canUnlock(id: number): { ok: boolean; reason?: string } {
    if (isUnlocked(id)) return { ok: false, reason: "уже открыто" };
    const ch = CHAPTERS.find(c => c.id === id)!;
    if (ch.tier === "free") return { ok: true };
    if (ch.tier === "xp142") {
      if ((balance ?? 0) < 142) return { ok: false, reason: "нужно 142 XP" };
      return { ok: true };
    }
    if (ch.tier === "xp420_eco") {
      if ((balance ?? 0) < 420) return { ok: false, reason: "нужно 420 XP" };
      if (!hasEco) return { ok: false, reason: "нужен 1 эко-квиз (пройди /magnum/eco)" };
      return { ok: true };
    }
    if (ch.tier === "xp1420_duel") {
      if ((balance ?? 0) < 1420) return { ok: false, reason: "нужно 1420 XP" };
      if (!hasDuelWin) return { ok: false, reason: "нужен 1 дуэль-win (/magnum/duel/lobby)" };
      return { ok: true };
    }
    return { ok: false };
  }

  async function doUnlock(id: number) {
    if (!me) { setMsg("Войди — magnum:need-auth"); return; }
    const chk = canUnlock(id);
    if (!chk.ok) {
      // shake x±6
      const el = document.querySelector(`[data-chapter=\"${id}\"]`);
      if (el && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.to(el, { x: 6, duration: 0.06, yoyo: true, repeat: 5, ease: "power2.inOut" });
      }
      setMsg(chk.reason || "недоступно");
      return;
    }
    setLoading(true); setMsg("");
    try {
      const r = await fetch("/magnum/api/chronicle/unlock", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapter: id }),
      });
      const j = await r.json() as { ok?: boolean; error?: string; unlocked?: number[]; balance?: number; xpSpent?: number; completed?: boolean; reward?: number };
      if (!r.ok || !j.ok) { setMsg(j.error || "Ошибка анлока"); return; }
      if (Array.isArray(j.unlocked)) setUnlocked(j.unlocked);
      if (typeof j.balance === "number") setBalance(j.balance);
      if (typeof j.xpSpent === "number") setXpSpent(j.xpSpent);
      if (typeof j.completed === "boolean") setCompleted(j.completed);
      // GSAP burst 1.4 back.out + confetti 100
      const el = document.querySelector<HTMLElement>(`[data-chapter=\"${id}\"]`);
      if (el && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.fromTo(el, { scale: 0.92 }, { scale: 1, duration: 1.4, ease: "back.out(1.4)" });
        if (wrapRef.current) spawnConfetti(wrapRef.current, 100);
      }
      if (j.completed) setMsg(`Хронист 42 — 12/12 +${j.reward ?? 1420} • рамка epic!`);
      else setMsg(`Глава ${id} открыта — −${CHAPTERS.find(c=>c.id===id)?.cost ?? 0} XP`);
    } catch { setMsg("Сеть"); } finally { setLoading(false); }
  }

  function spawnConfetti(root: HTMLElement, count: number) {
    for (let i = 0; i < count; i++) {
      const d = document.createElement("div");
      d.style.position = "absolute"; d.style.left = "50%"; d.style.top = "30%"; d.style.width = "7px"; d.style.height = "7px"; d.style.borderRadius = "2px";
      d.style.background = i % 3 === 0 ? "#ff2d55" : i % 3 === 1 ? "#ffcc00" : "#00ff88";
      d.style.pointerEvents = "none"; d.style.zIndex = "99";
      root.appendChild(d);
      const ang = Math.random() * Math.PI * 2, dist = 70 + Math.random() * 240;
      gsap.to(d, { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist + 80, rotation: Math.random() * 720, opacity: 0, duration: 0.9 + Math.random() * 0.6, ease: "power2.out", onComplete: () => d.remove() });
    }
  }

  async function doShare(chapterId: number) {
    const canvas = canvasRef.current;
    if (!canvas) { setMsg("Canvas нет"); return; }
    const ch = CHAPTERS.find(c => c.id === chapterId)!;
    // draw OG 1080x1080
    canvas.width = 1080; canvas.height = 1080;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
    grad.addColorStop(0, "#0a0a0a"); grad.addColorStop(0.45, ch.color + "22"); grad.addColorStop(1, ch.color);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 1080, 1080);
    // outer frame
    ctx.strokeStyle = ch.color; ctx.lineWidth = 14; ctx.strokeRect(14, 14, 1052, 1052);
    ctx.fillStyle = "#fff"; ctx.font = "900 64px Inter, sans-serif"; ctx.textAlign = "left";
    ctx.fillText(`ХРОНИКИ 42 — ГЛАВА ${ch.id}`, 48, 96);
    ctx.font = "800 44px Inter, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.fillText(ch.title, 48, 160);
    ctx.font = "600 26px Inter, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fillText(ch.subtitle, 48, 200);
    ctx.fillText(`${ch.year} • ${ch.date}`, 48, 238);
    // quote block
    ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(48, 270, 984, 140);
    ctx.fillStyle = "#fff"; ctx.font = "400 28px Inter, sans-serif";
    wrapText(ctx, `"${ch.quote}"`, 72, 310, 936, 36);
    // fact
    ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.font = "400 24px Inter, sans-serif";
    wrapText(ctx, ch.fact, 72, 460, 936, 32);
    // QR placeholder
    ctx.fillStyle = "#fff"; ctx.fillRect(390, 650, 300, 300);
    ctx.fillStyle = "#0a0a0a"; ctx.font = "700 22px monospace"; ctx.textAlign = "center";
    ctx.fillText("QR", 540, 800); ctx.font = "400 16px monospace"; ctx.fillText(`/magnum/chronicle#${ch.id}`, 540, 830);
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.font = "600 18px Inter, sans-serif";
    ctx.fillText("MAGNUM • 5opka — ХРОНИКИ 42 • /magnum/chronicle", 48, 1026);
    // try share
    try {
      const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), "image/png")!);
      const file = new File([blob], `chronicle-42-ch${chapterId}.png`, { type: "image/png" });
      const nav2 = navigator as unknown as { canShare?: (d: unknown) => boolean; share?: (d: unknown) => Promise<void> };
      if (nav2.canShare?.({ files: [file] }) && nav2.share) {
        await nav2.share({ files: [file], title: `ХРОНИКИ 42 — ${ch.title}`, text: `${ch.title} — ${ch.fact.slice(0, 80)}` });
      } else if (nav2.share) {
        const url = `${window.location.origin}/magnum/chronicle#${chapterId}`;
        try { await nav2.share({ title: `ХРОНИКИ 42`, text: `${ch.title} — ${url}`, url } as unknown as { files: File[] }); } catch { /* fallback download */ throw new Error("share-fallback"); }
      } else {
        throw new Error("share-fallback");
      }
    } catch {
      // download fallback
      try {
        const a = document.createElement("a"); a.href = canvas.toDataURL("image/png"); a.download = `chronicle-42-ch${chapterId}.png`; a.click();
      } catch {}
    }
    // +42 guard 1x/day via API
    try {
      const r = await fetch("/magnum/api/chronicle/share", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chapter: chapterId, day: dayId }) });
      const j = await r.json() as { ok?: boolean; error?: string; coins?: number; balance?: number };
      if (r.ok && j.ok) {
        setMsg(`+${j.coins ?? 42} за шаринг главы ${chapterId} • 1×/день`);
        if (typeof j.balance === "number") setBalance(j.balance);
      } else if (r.status === 409) setMsg("Уже делился сегодня — +42 1×/день");
      else if (j.error) setMsg(j.error);
    } catch { setMsg("Шаринг OK, +42 не начислен — сеть"); }
  }

  function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
    const words = text.split(" ");
    let line = ""; let yy = y;
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, yy); line = w; yy += lineHeight;
      } else line = test;
    }
    if (line) ctx.fillText(line, x, yy);
  }

  const selChapter = selected ? CHAPTERS.find(c => c.id === selected) ?? null : null;
  const progressPct = Math.round((unlocked.length / 12) * 100);
  const fact = factOfDay(CHAPTERS, dayId, me?.id ?? 0);

  return (
    <div ref={wrapRef} style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px 40px", position: "relative", color: "#fff" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em" }}>ХРОНИКИ 42 <span style={{ color: "#ff2d55" }}>— 2019→2026</span></h1>
      <p style={{ opacity: 0.7, marginTop: 6, fontSize: 13 }}>12 глав • первые 3 free • 4-6 — 142 XP • 7-9 — 420 XP + эко-квиз • 10-12 — 1420 XP + дуэль-win • Хронист 42 за 12/12 +1420 epic</p>

      {/* progress-bar 0/12 */}
      <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: completed ? "1px solid #ffd700" : "1px solid rgba(255,255,255,0.08)", position: "relative" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 900, fontSize: 14 }}>{unlocked.length}/12</span>
          <span style={{ fontSize: 12, opacity: 0.7 }}>{completed ? "✓ Хронист 42 — 12/12" : `Хронист ${progressPct}%`}</span>
          {completed && <span style={{ padding: "4px 8px", borderRadius: 999, background: "linear-gradient(135deg,#ffd700,#ff8a00)", color: "#000", fontWeight: 900, fontSize: 11 }}>ХРОНИСТ EPIC</span>}
          <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.6 }}>баланс: {balance ?? "…"} • XP потрачено: {xpSpent}</span>
        </div>
        <div style={{ marginTop: 10, height: 10, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div ref={progressBarRef} style={{ height: "100%", width: `${(unlocked.length / 12) * 100}%`, background: completed ? "linear-gradient(90deg,#ffd700,#ff2d55)" : "linear-gradient(90deg,#ff2d55,#ffcc00)", borderRadius: 999 }} />
        </div>
        {completed && <div style={{ marginTop: 8, fontSize: 11, color: "#ffd700" }}>+1420 и рамка Хронист epic уже выданы</div>}
      </div>

      {/* факт дня seed-ротация */}
      <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "linear-gradient(135deg,rgba(255,204,0,0.1),rgba(255,45,85,0.08))", border: "1px solid rgba(255,204,0,0.18)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontWeight: 900, fontSize: 12, letterSpacing: "0.06em" }}>ФАКТ ДНЯ</span>
        <span style={{ fontSize: 12, opacity: 0.9 }}>Глава {fact.id} • {fact.title}: {fact.fact.slice(0, 120)}…</span>
        <button onClick={() => setSelected(fact.id)} style={{ marginLeft: "auto", padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(255,204,0,0.4)", background: "rgba(255,204,0,0.14)", color: "#ffcc00", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Открыть</button>
      </div>

      {/* timeline вертикальный */}
      <div style={{ position: "relative", marginTop: 18, display: "flex", gap: 0 }}>
        {/* line */}
        <div style={{ position: "relative", width: 36, flexShrink: 0, display: "flex", justifyContent: "center", overflow: "hidden" }}>
          <div ref={lineRef} style={{ position: "absolute", top: 12, bottom: 12, width: 3, background: "linear-gradient(180deg,#ff2d55,#ffcc00 50%,#00ff88)", borderRadius: 999 }} />
        </div>
        {/* cards */}
        <div ref={cardsRef} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: "8px 0" }}>
          {CHAPTERS.map(ch => {
            const unlockedFlag = isUnlocked(ch.id);
            const idx = CHAPTERS.indexOf(ch);
            const left = idx % 2 === 0;
            return (
              <div
                key={ch.id}
                data-chapter={ch.id}
                onClick={() => unlockedFlag ? setSelected(ch.id) : undefined}
                style={{
                  position: "relative",
                  padding: 14,
                  borderRadius: 16,
                  background: unlockedFlag ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
                  border: unlockedFlag ? `1px solid ${ch.color}44` : "1px solid rgba(255,255,255,0.08)",
                  opacity: unlockedFlag ? 1 : 0.92,
                  cursor: unlockedFlag ? "pointer" : "default",
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  textAlign: left ? undefined : undefined,
                  // alternating offset visual hint
                  marginLeft: left ? 0 : 12,
                  marginRight: left ? 12 : 0,
                }}
              >
                {/* dot */}
                <div style={{
                  position: "absolute", left: -28, top: 18, width: 16, height: 16, borderRadius: 999,
                  background: unlockedFlag ? ch.color : "#2a2a2a", border: `2px solid ${unlockedFlag ? "#fff" : "rgba(255,255,255,0.2)"}`,
                  boxShadow: unlockedFlag ? `0 0 12px ${ch.color}` : "none",
                }} />
                <div style={{ width: 72, height: 72, borderRadius: 12, background: `linear-gradient(135deg,${ch.color}22,${ch.color}05)`, border: `1px solid ${ch.color}30`, overflow: "hidden", flexShrink: 0, display: "grid", placeItems: "center", fontSize: 11, color: ch.color, fontWeight: 800 }}>
                  {/* image with fallback */}
                  <img src={ch.image} alt={ch.title} loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, padding: "3px 7px", borderRadius: 999, background: `${ch.color}18`, border: `1px solid ${ch.color}30`, color: ch.color, fontWeight: 800 }}>{ch.date}</span>
                    <span style={{ fontSize: 11, opacity: 0.6 }}>{ch.tier === "free" ? "FREE" : ch.need}</span>
                    {unlockedFlag ? <span style={{ fontSize: 11, color: "#00ff88", fontWeight: 800 }}>✓ ОТКРЫТО</span> : <span style={{ fontSize: 11, color: "#ffcc00" }}>🔒 ЗАМОК</span>}
                  </div>
                  <div style={{ fontWeight: 900, marginTop: 6, fontSize: 15 }}>{ch.id}. {ch.title}</div>
                  <div style={{ opacity: 0.7, fontSize: 12, marginTop: 2 }}>{ch.subtitle}</div>
                  <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {ch.cross.map(c => (
                      <span key={c.to} style={{ fontSize: 10, padding: "3px 6px", borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>{c.label}</span>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                  {unlockedFlag ? (
                    <span style={{ fontSize: 12, color: ch.color, fontWeight: 800 }}>→ открыть</span>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); doUnlock(ch.id); }}
                      disabled={loading}
                      style={{
                        padding: "8px 12px", borderRadius: 10, border: `1px solid ${ch.color}`, background: `${ch.color}1a`, color: "#fff",
                        fontWeight: 800, fontSize: 12, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.6 : 1
                      }}
                    >
                      Открыть за {ch.cost} XP
                    </button>
                  )}
                  {ch.track && <span style={{ fontSize: 10, opacity: 0.6 }}>{ch.trackLabel}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* chapter modal */}
      {selChapter && (
        <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)", zIndex: 40, display: "grid", placeItems: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 720, width: "100%", borderRadius: 18, background: "#111", border: `1px solid ${selChapter.color}50`, overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ height: 220, background: `linear-gradient(135deg,${selChapter.color}30,#0a0a0a)`, position: "relative", overflow: "hidden" }}>
              <img src={selChapter.image} alt={selChapter.title} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent 30%,rgba(0,0,0,0.85))" }} />
              <div style={{ position: "absolute", left: 18, bottom: 18, right: 18 }}>
                <div style={{ fontSize: 12, color: selChapter.color, fontWeight: 800, letterSpacing: "0.08em" }}>{selChapter.date} • {selChapter.year}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", marginTop: 4 }}>{selChapter.title}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>{selChapter.subtitle}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: 999, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.5)", color: "#fff", cursor: "pointer" }}>×</button>
            </div>
            <div style={{ padding: 18 }}>
              <div style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: 11, letterSpacing: "0.08em", opacity: 0.6, fontWeight: 800 }}>ЦИТАТА</div>
                <div style={{ marginTop: 6, fontSize: 15, fontStyle: "italic", lineHeight: 1.5 }}>"{selChapter.quote}"</div>
              </div>
              <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, opacity: 0.9 }}>{selChapter.fact}</div>
              <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {selChapter.cross.map(c => (
                  <button key={c.to} onClick={() => nav(c.to)} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(255,204,0,0.3)", background: "rgba(255,204,0,0.12)", color: "#ffcc00", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
                    {c.label} →
                  </button>
                ))}
                {selChapter.track && (
                  <button onClick={() => nav(`/magnum/track/${selChapter.track}`)} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(255,45,85,0.3)", background: "rgba(255,45,85,0.12)", color: "#ff2d55", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
                    Трек {selChapter.trackLabel} →
                  </button>
                )}
              </div>
              <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={() => doShare(selChapter.id)} style={{ flex: 1, padding: "12px 16px", borderRadius: 12, border: `1px solid ${selChapter.color}`, background: `${selChapter.color}20`, color: "#fff", fontWeight: 900, cursor: "pointer" }}>
                  Шаринг OG 1080×1080 +42 1×/день
                </button>
                <button onClick={() => setSelected(null)} style={{ padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#fff", cursor: "pointer" }}>Закрыть</button>
              </div>
              {msg && <div style={{ marginTop: 10, fontSize: 12, color: "#ffcc00" }}>{msg}</div>}
            </div>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} width={1080} height={1080} style={{ display: "none" }} />
      {msg && !selChapter && <div style={{ marginTop: 12, fontSize: 12, color: "#ffcc00" }}>{msg}</div>}
      <div style={{ marginTop: 10, fontSize: 11, opacity: 0.45 }}>Факт дня seed {factIdx} • день {dayId} • {Math.abs(hashDayToSeed(dayId)) % 9999}</div>
    </div>
  );
}

export default Chronicle42Page;
