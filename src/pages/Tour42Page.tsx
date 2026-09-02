import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import gsap from "gsap";
import { TOUR_STOPS, getCityOfWeek, cityOfWeekIndex, TOUR_XP_COST, TOUR_SHARE_REWARD, TOUR_COMPLETE_BONUS, TOUR_LEGEND_SKIN, TOUR_LEGEND_VALUE } from "../lib/tour42";

const LS_KEY = "magnum:tour-progress";
const LS_SHARE_KEY = "magnum:tour-share-day";

type ProgressDTO = {
  unlocked: string[];
  xp: number;
  visitedCnt: number;
  streak: number;
  cityOfWeek: string;
  shareToday: boolean;
  coins?: number;
  guest?: boolean;
};

function prefersReduced() { return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
function todayStr() { return new Date().toISOString().slice(0, 10); }

export function Tour42Page() {
  const rootRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState<"all" | "2024" | "2025" | "2026">("all");
  const [progress, setProgress] = useState<ProgressDTO>({ unlocked: [], xp: 0, visitedCnt: 0, streak: 0, cityOfWeek: TOUR_STOPS[cityOfWeekIndex()]!.id, shareToday: false });
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filterAnim, setFilterAnim] = useState(false);

  const activeStop = useMemo(() => TOUR_STOPS.find(s => s.id === activeId) ?? null, [activeId]);
  const cow = useMemo(() => TOUR_STOPS.find(s => s.id === progress.cityOfWeek) ?? getCityOfWeek(), [progress.cityOfWeek]);
  const pct = Math.round((progress.visitedCnt / 12) * 100);
  const completed = progress.visitedCnt >= 12;

  const filtered = useMemo(() => {
    let arr = TOUR_STOPS;
    if (yearFilter !== "all") arr = arr.filter(s => String(s.year) === yearFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter(s => s.city.toLowerCase().includes(q) || s.venue.toLowerCase().includes(q) || s.setlist.join(" ").toLowerCase().includes(q));
    }
    return arr;
  }, [search, yearFilter]);

  const fetchProgress = useCallback(async () => {
    try {
      const r = await fetch("/magnum/api/tour/progress", { credentials: "include" });
      if (r.ok) {
        const j = await r.json() as { visited?: string[]; xpSpent?: number; shares?: number; xpCost?: number; stops?: unknown[] };
        const unlocked = Array.isArray(j.visited) ? j.visited as string[] : [];
        // also fetch pass xp for display via /magnum/api/pass/progress if authed
        let xp = 0;
        try {
          const pr = await fetch("/magnum/api/pass/progress", { credentials: "include" });
          if (pr.ok) { const pj = await pr.json() as { xp?: number; level?: number }; xp = Number(pj.xp ?? 0); }
        } catch {}
        setProgress({
          unlocked,
          xp,
          visitedCnt: unlocked.length,
          streak: Number(j.shares ?? 0),
          cityOfWeek: TOUR_STOPS[cityOfWeekIndex()]!.id,
          shareToday: false,
          coins: undefined,
          guest: false,
        });
        try { localStorage.setItem(LS_KEY, JSON.stringify({ unlocked, xp })); } catch {}
        return j;
      }
    } catch {}
    // fallback LS
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const j = JSON.parse(raw) as { unlocked?: string[]; xp?: number };
        if (Array.isArray(j.unlocked)) setProgress(p => ({ ...p, unlocked: j.unlocked!, xp: Number(j.xp ?? p.xp), visitedCnt: j.unlocked!.length }));
      }
    } catch {}
    return null;
  }, []);

  useEffect(() => { void fetchProgress(); }, [fetchProgress]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (prefersReduced()) return;
    const ctx = gsap.context(() => {
      const path = mapRef.current!.querySelector("#tour-path") as SVGPathElement | null;
      if (path) {
        try {
          const len = path.getTotalLength();
          gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
          gsap.to(path, { strokeDashoffset: 0, duration: 1.4, ease: "power2.out" });
        } catch {}
      }
      const dots = mapRef.current!.querySelectorAll<HTMLElement>("[data-tour-dot]");
      gsap.set(dots, { scale: 0, opacity: 0 });
      gsap.to(dots, { scale: 1, opacity: 1, duration: 0.45, stagger: 0.08, ease: "back.out(1.4)", delay: 0.2 });
      dots.forEach((el) => {
        if (el.getAttribute("data-active") === "true") {
          gsap.to(el, { scale: 1.14, duration: 1.4, repeat: -1, yoyo: true, ease: "sine.inOut" });
        }
      });
    }, mapRef);
    return () => ctx.revert();
  }, [progress.visitedCnt, filtered.length]);

  // flip cards on filter change
  useEffect(() => {
    if (!rootRef.current || prefersReduced()) return;
    const cards = rootRef.current.querySelectorAll<HTMLElement>("[data-tour-card]");
    if (!cards.length) return;
    gsap.set(cards, { y: 16, opacity: 0 });
    gsap.to(cards, { y: 0, opacity: 1, duration: 0.35, stagger: 0.08, ease: "power2.out" });
  }, [filtered]);

  // slide on city change
  useEffect(() => {
    if (!activeId || prefersReduced()) return;
    const el = document.querySelector<HTMLElement>("[data-tour-modal]");
    if (!el) return;
    gsap.fromTo(el, { x: 24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, ease: "power2.out" });
  }, [activeId]);

  const showToast = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(null), 2800); };

  const unlock = async (id: string) => {
    const already = progress.unlocked.includes(id);
    if (already) { setActiveId(id); return; }
    // optimistic check: need XP
    setBusy(true);
    try {
      const r = await fetch("/magnum/api/tour/visit", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cityId: id }) });
      const j = await r.json() as { ok?: boolean; error?: string; visited?: string[]; xp?: number; cityId?: string };
      if (!r.ok) {
        if (r.status === 401) showToast("Войди, братуха — анлок только залогиненным (или качай XP в играх)");
        else if (j.error?.includes("need") || j.error?.includes("XP")) showToast(`Нужно 42 XP — играй/дуэли/эко (у тебя ${progress.xp})`);
        else showToast(j.error || "Не удалось открыть точку");
        return;
      }
      const unlocked = Array.isArray(j.visited) ? j.visited as string[] : [...progress.unlocked, id];
      setProgress(p => ({ ...p, unlocked, xp: Number(j.xp ?? p.xp), visitedCnt: unlocked.length }));
      try { localStorage.setItem(LS_KEY, JSON.stringify({ unlocked, xp: j.xp })); } catch {}
      setActiveId(id);
      showToast(`${TOUR_STOPS.find(s=>s.id===id)?.city} открыта • -${TOUR_XP_COST} XP`);
      if (unlocked.length === 12) {
        showToast(`12/12 ТУР ЗАКРЫТ +${TOUR_COMPLETE_BONUS} и скин ${TOUR_LEGEND_SKIN} epic ${TOUR_LEGEND_VALUE}`);
      }
    } catch { showToast("Сеть — попробуй снова"); }
    finally { setBusy(false); }
  };

  const handleShare = async () => {
    const day = todayStr();
    try {
      if (localStorage.getItem(LS_SHARE_KEY) === day) { showToast("Уже шарил сегодня +42 — завтра"); return; }
    } catch {}
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    canvas.width = 1080; canvas.height = 1080;
    const g = ctx.createLinearGradient(0, 0, 1080, 1080); g.addColorStop(0, "#0a1a2a"); g.addColorStop(0.5, "#1a0a2a"); g.addColorStop(1, "#ff2d55");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1080);
    ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 4; ctx.strokeRect(24, 24, 1032, 1032);
    // Russia path simplified stroke
    ctx.strokeStyle = "#78dcff"; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(20, 140); ctx.lineTo(940, 420); ctx.stroke();
    // dots 12
    TOUR_STOPS.forEach(s => {
      const done = progress.unlocked.includes(s.id);
      ctx.fillStyle = done ? "#00ff88" : s.id === cow.id ? "#ffcc00" : "rgba(255,255,255,0.22)";
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(s.coords.x * 1.0 + 40, s.coords.y * 0.9 + 90, done ? 14 : 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
    ctx.fillStyle = "#fff"; ctx.font = "900 64px Inter, sans-serif"; ctx.textAlign = "center"; ctx.fillText("ТУР 42 — 5opka", 540, 320);
    ctx.font = "700 32px Inter, sans-serif"; ctx.fillStyle = "#7affc2"; ctx.fillText(`${progress.visitedCnt}/12 городов • ${pct}% • стрик ${progress.streak}`, 540, 380);
    ctx.font = "600 22px Inter, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.82)"; ctx.fillText(`Город недели: ${cow.city} x2 XP • /magnum/tour`, 540, 430);
    // city labels small
    ctx.font = "700 14px Inter, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.9)"; TOUR_STOPS.forEach(s => { if (progress.unlocked.includes(s.id)) ctx.fillText(s.city, s.coords.x + 40, s.coords.y * 0.9 + 118); });
    try {
      const blob: Blob | null = await new Promise(res => canvas.toBlob(r => res(r), "image/png"));
      if (!blob) throw new Error("no blob");
      const file = new File([blob], "tour-42-1080.png", { type: "image/png" });
      if (navigator.share && (navigator as unknown as { canShare?: (o: { files: File[] }) => boolean }).canShare?.({ files: [file] })) {
        await navigator.share({ title: `ТУР 42 — ${progress.visitedCnt}/12`, text: `ТУР 42 5opka — ${progress.visitedCnt}/12 • ${pct}% • город недели ${cow.city} x2`, files: [file] });
      } else {
        const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "tour-42-1080.png"; a.click(); URL.revokeObjectURL(url);
      }
      // server share +42/day
      try {
        const active = activeId ?? progress.unlocked[progress.unlocked.length - 1] ?? cow.id;
        const sr = await fetch("/magnum/api/tour/share", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cityId: active }) });
        const sj = await sr.json() as { ok?: boolean; error?: string; reward?: number };
        if (sr.ok) { showToast(`+${sj.reward ?? TOUR_SHARE_REWARD} за шаринг 1080×1080`); setProgress(p => ({ ...p, shareToday: true })); try { localStorage.setItem(LS_SHARE_KEY, day); } catch {} void fetchProgress(); }
        else if (sj.error?.includes("already")) { showToast("Уже шарил сегодня +42 — завтра"); try { localStorage.setItem(LS_SHARE_KEY, day); } catch {} }
        else showToast("Шаринг 1080×1080 готов — сохрани картинку");
      } catch { showToast("Шаринг 1080×1080 готов — сохрани картинку"); }
    } catch {
      const url = canvas.toDataURL("image/png"); const a = document.createElement("a"); a.href = url; a.download = "tour-42-1080.png"; a.click();
    }
  };

  const handleInvite = async () => {
    const friend = window.prompt("Ник друга для инвайта на точку (получите оба +42):");
    if (!friend) return;
    const cityId = activeId ?? cow.id;
    try {
      const r = await fetch("/magnum/api/tour/share", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cityId }) });
      const j = await r.json() as { ok?: boolean; error?: string; reward?: number; balance?: number };
      if (!r.ok) showToast(j.error || "Не удалось инвайтнуть");
      else { showToast(`Шаринг ${TOUR_STOPS.find(s=>s.id===cityId)?.city} +${j.reward ?? 42} (инвайт ${friend} — скоро)`); void fetchProgress(); }
    } catch { showToast("Сеть"); }
  };

  const onYear = (y: typeof yearFilter) => { setYearFilter(y); setFilterAnim(true); window.setTimeout(()=>setFilterAnim(false), 400); };

  return (
    <div ref={rootRef} style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 14px 48px", color: "#f2f2f2" }}>
      <header style={{ marginBottom: 14 }}>
        <span style={{ display: "inline-block", fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: "#ffcc00", background: "rgba(255,204,0,0.09)", border: "1px solid rgba(255,204,0,0.18)", padding: "5px 10px", borderRadius: 999 }}>ТУР 42 • 12 городов • 2024-2026 • Россия 17.1 млн км²</span>
        <h1 style={{ margin: "10px 0 6px", fontSize: "clamp(28px, 6vw, 44px)", fontWeight: 900, letterSpacing: "-0.02em" }}>ТУР 42 — интерактивная карта</h1>
        <p style={{ margin: 0, color: "rgba(255,255,255,0.66)", fontSize: 13, lineHeight: 1.5 }}>Кемерово → Москва → Питер … 12 точек. Клик → фото / дата / площадка / 3 трека сетлиста / байка. Прогресс 0/12 → анлок 42 XP за точку (игры/дуэли/эко дают XP), шаринг +42/день, инвайт друга на точку +42 обоим. Город недели x2 XP.</p>
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#ffcc00", background: "rgba(255,204,0,0.10)", border: "1px solid rgba(255,204,0,0.18)", padding: "6px 10px", borderRadius: 999 }}>Город недели x2: {cow.city} — {cow.venue}</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{progress.visitedCnt}/12 • {pct}% • стрик {progress.streak} • XP {progress.xp} • пороги 0-42-142-420</span>
        </div>
      </header>

      <div style={{ height: 10, background: "rgba(255,255,255,0.09)", borderRadius: 999, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: completed ? "linear-gradient(90deg,#ffcc00,#ff2d55)" : "linear-gradient(90deg,#00ff88,#78dcff)", transition: "width 0.6s ease", boxShadow: completed ? "0 0 18px rgba(255,204,0,0.35)" : "none" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 14 }}>
        <span>{progress.visitedCnt}/12 точек открыто</span>
        <span>{pct}% {completed ? "• 12/12 — tour-legend epic 1420" : ""}</span>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск: город / площадка / трек" style={{ flex: "1 1 220px", minWidth: 180, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "#fff", padding: "10px 12px", borderRadius: 12, outline: "none" }} />
        {(["all", "2024", "2025", "2026"] as const).map(y => (
          <button key={y} onClick={() => onYear(y)} style={{ padding: "10px 14px", borderRadius: 999, fontWeight: 800, fontSize: 12, cursor: "pointer", border: y === yearFilter ? "1px solid #ffcc00" : "1px solid rgba(255,255,255,0.10)", background: y === yearFilter ? "rgba(255,204,0,0.14)" : "rgba(255,255,255,0.06)", color: y === yearFilter ? "#ffcc00" : "rgba(255,255,255,0.82)" }}>{y === "all" ? "Все годы" : y}</button>
        ))}
        <button onClick={() => void fetchProgress()} style={{ padding: "10px 14px", borderRadius: 999, fontWeight: 800, fontSize: 12, background: "rgba(120,220,255,0.10)", border: "1px solid rgba(120,220,255,0.22)", color: "#78dcff", cursor: "pointer" }}>↻ Обновить</button>
      </div>

      <div ref={mapRef} style={{ background: "#0a1620", borderRadius: 24, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden", padding: 12 }}>
        <div style={{ borderRadius: 16, overflow: "hidden", background: "#0a1620" }}>
          <svg viewBox="0 0 1000 600" role="img" aria-label="Карта России 12 точек ТУР 42" style={{ width: "100%", height: "auto", display: "block" }}>
            <rect width={1000} height={600} rx={24} fill="#0a1620" />
            {/* Russia silhouette simplified */}
            <path d="M 14 110 L 220 92 L 320 140 L 420 120 L 580 180 L 740 220 L 860 280 L 970 320 L 940 480 L 760 520 L 480 500 L 220 560 L 80 400 L 14 260 Z" fill="#0f2a32" stroke="#1e4a5a" strokeWidth={3} opacity={0.95} />
            <path id="tour-path" d="M 20 140 C 120 120 160 200 200 280 C 260 340 360 320 480 350 C 520 380 590 400 940 420" fill="none" stroke="#78dcff" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" opacity={0.95} />
            <text x={500} y={42} textAnchor="middle" fill="#78dcff" fontSize={13} fontWeight={800} letterSpacing="0.12em">РОССИЯ 17.1 млн км² • ТУР 12</text>
            <text x={24} y={588} fill="rgba(255,255,255,0.35)" fontSize={9}>Кемерово → Москва → Питер → Казань → Екатеринбург → Новосибирск → Самара → Красноярск → Ростов → Сочи → Владивосток → Калининград • 2024-2026</text>
            {filtered.map(s => {
              const done = progress.unlocked.includes(s.id);
              const isCow = s.id === cow.id;
              const active = s.id === activeId;
              return (
                <g key={s.id} data-tour-dot={s.id} data-active={active ? "true" : "false"} onClick={() => void unlock(s.id)} style={{ cursor: done || !busy ? "pointer" : "default" }}>
                  <circle cx={s.coords.x} cy={s.coords.y} r={done ? 15 : isCow ? 13 : 10} fill={done ? "#00ff88" : isCow ? "#ffcc00" : filtered.length === 12 ? "#ff2d55" : "rgba(255,255,255,0.88)"} stroke={active ? "#fff" : done ? "#fff" : isCow ? "#fff" : "rgba(255,255,255,0.9)"} strokeWidth={active ? 3 : 2} opacity={done ? 1 : 0.97} />
                  {done && <text x={s.coords.x} y={s.coords.y + 4.5} textAnchor="middle" fontSize={11} fontWeight={900} fill="#0a0a0a">✓</text>}
                  {!done && isCow && <circle cx={s.coords.x} cy={s.coords.y} r={17} fill="none" stroke="#ffcc00" strokeWidth={1.6} opacity={0.45} />}
                  <text x={s.coords.x} y={s.coords.y + 26} textAnchor="middle" fill={done ? "#00ff88" : isCow ? "#ffcc00" : "#fff"} fontSize={10} fontWeight={800} style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.55)", strokeWidth: 3 }}>{s.city}</text>
                  <text x={s.coords.x} y={s.coords.y + 37} textAnchor="middle" fill={done ? "rgba(122,255,194,0.9)" : "rgba(255,255,255,0.52)"} fontSize={8} fontWeight={600}>{done ? "открыта ✓" : isCow ? "город недели x2" : `${s.year} • 42 XP`}</text>
                </g>
              );
            })}
          </svg>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8, marginTop: 12 }}>
          {filtered.map(s => {
            const done = progress.unlocked.includes(s.id);
            const isCow = s.id === cow.id;
            return (
              <div key={s.id} data-tour-card={s.id} onClick={() => void unlock(s.id)} style={{ cursor: "pointer", background: done ? "rgba(0,255,136,0.08)" : isCow ? "rgba(255,204,0,0.08)" : "rgba(255,255,255,0.04)", border: `1px solid ${done ? "rgba(0,255,136,0.22)" : isCow ? "rgba(255,204,0,0.22)" : "rgba(255,255,255,0.08)"}`, borderRadius: 16, padding: "10px 10px 9px" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: done ? "#00ff88" : isCow ? "#ffcc00" : "#fff" }}>{s.city} <span style={{ fontWeight: 600, opacity: 0.6, fontSize: 10 }}>{s.year}</span></div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.62)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.venue}</div>
                <div style={{ fontSize: 10, color: done ? "#00ff88" : "rgba(255,255,255,0.45)", marginTop: 6, fontWeight: 800 }}>{done ? "✓ открыта" : isCow ? "x2 город недели" : "42 XP — клик открыть"}</div>
              </div>
            );
          })}
          {filtered.length === 0 && <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 18, color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Ничего не найдено — сбрось фильтр или поиск.</div>}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        <button onClick={handleShare} disabled={busy} style={{ padding: "12px 16px", borderRadius: 999, fontWeight: 900, fontSize: 13, background: "linear-gradient(90deg,#00ff88,#78dcff)", color: "#0a0a0a", border: "none", cursor: "pointer", opacity: busy ? 0.6 : 1 }}>📤 Шаринг OG 1080×1080 +42/день</button>
        <button onClick={handleInvite} disabled={busy} style={{ padding: "12px 16px", borderRadius: 999, fontWeight: 800, fontSize: 13, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", cursor: "pointer" }}>👥 Инвайт друга +42 обоим</button>
        <span style={{ alignSelf: "center", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>Фильтр: {yearFilter} • поиск «{search || "—"}» {filterAnim ? "• anim…" : ""}</span>
      </div>

      {completed && (
        <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 16, background: "linear-gradient(90deg, rgba(255,204,0,0.14), rgba(255,45,85,0.12))", border: "1px solid rgba(255,204,0,0.22)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 900, color: "#ffcc00" }}>12/12 ТУР ЗАКРЫТ</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.82)" }}>+{TOUR_COMPLETE_BONUS} монет + скин {TOUR_LEGEND_SKIN} epic {TOUR_LEGEND_VALUE} — tour-legend сияет на профиле</span>
        </div>
      )}

      {toast && <div role="status" style={{ position: "fixed", left: "50%", bottom: 18, transform: "translateX(-50%)", background: "rgba(20,20,20,0.96)", color: "#fff", border: "1px solid rgba(255,204,0,0.22)", padding: "10px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, zIndex: 9999, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>{toast}</div>}

      {activeStop && (
        <div data-tour-modal onClick={() => !busy && setActiveId(null)} role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.62)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "min(560px, 96vw)", background: "#121214", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 20, overflow: "hidden", boxShadow: "0 18px 48px rgba(0,0,0,0.5)" }}>
            <div style={{ height: 220, background: `linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.72)), url(${activeStop.image}) center/cover, #0a1620`, display: "flex", alignItems: "flex-end", padding: 14, position: "relative" }}>
              <img src={activeStop.image} alt={activeStop.city} onError={e => ((e.target as HTMLImageElement).style.display = "none")} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.0 }} />
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ display: "inline-block", fontSize: 11, fontWeight: 800, background: activeStop.id === cow.id ? "#ffcc00" : "#00ff88", color: "#0a0a0a", padding: "4px 8px", borderRadius: 999 }}>{activeStop.city} • {activeStop.date} • {activeStop.year} {activeStop.id === cow.id ? "• город недели x2" : ""}</div>
                <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900, color: "#fff", textShadow: "0 2px 10px rgba(0,0,0,0.6)" }}>{activeStop.venue}</div>
              </div>
              <button onClick={() => setActiveId(null)} style={{ position: "absolute", top: 10, right: 10, width: 32, height: 32, borderRadius: 999, background: "rgba(0,0,0,0.45)", color: "#fff", border: "1px solid rgba(255,255,255,0.18)", cursor: "pointer" }}>×</button>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.55)", letterSpacing: "0.08em" }}>СЕТЛИСТ 3 ТРЕКА</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {activeStop.setlist.map(t => <span key={t} style={{ background: "rgba(120,220,255,0.10)", border: "1px solid rgba(120,220,255,0.18)", color: "#78dcff", padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{t}</span>)}
              </div>
              <div style={{ marginTop: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "10px 12px", fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,0.82)" }}>Байка: {activeStop.fact}</div>
              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{activeStop.city} • {activeStop.venue} • {activeStop.date}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 800, color: progress.unlocked.includes(activeStop.id) ? "#00ff88" : "#ffcc00" }}>{progress.unlocked.includes(activeStop.id) ? "✓ открыта" : `42 XP • город недели x2: ${cow.city}`}</span>
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <button onClick={() => setActiveId(null)} style={{ flex: 1, padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "#fff", fontWeight: 800, cursor: "pointer" }}>Закрыть</button>
                <button onClick={handleInvite} style={{ flex: 1, padding: "10px 12px", borderRadius: 12, background: "linear-gradient(90deg,#00ff88,#78dcff)", color: "#0a0a0a", border: "none", fontWeight: 900, cursor: "pointer" }}>Инвайт +42</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} width={1080} height={1080} style={{ display: "none" }} aria-hidden />
      <footer style={{ marginTop: 16, fontSize: 11, color: "rgba(255,255,255,0.42)", lineHeight: 1.5, textAlign: "center" }}>ТУР 42 — 12 городов 2024-2026 • Кемерово→Калининград • сетлисты и байки из docs/gallery-spec • шаринг 1080×1080 • /magnum/tour в sitemap</footer>
    </div>
  );
}
export default Tour42Page;
