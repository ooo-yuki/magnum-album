import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { subscribeMe } from "../lib/authMe";
import { drawDuelShareCard, canvasToBlob, shareOrDownloadDuel } from "../lib/duelShareCard";
import { genABCD } from "../lib/ws";

type Props = {
  score: number;
  game?: string;
  durationSec?: number;
  compact?: boolean;
};

export function DuelRushCTA({ score, game = "clicker", durationSec = 42, compact = false }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prestigeRef = useRef<HTMLDivElement>(null);
  const [me, setMe] = useState<{ username: string } | null>(null);
  const [elo, setElo] = useState<number | null>(null);
  const [lb, setLb] = useState<Array<{ player: string; score: number }>>([]);
  const [code] = useState(() => genABCD());
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    const unsub = subscribeMe((u) => setMe(u ? { username: u.username } : null));
    return unsub;
  }, []);
  useEffect(() => {
    fetch("/magnum/api/duel42/leaderboard").then(r=>r.json()).then(j=> setLb(j.leaderboard?.slice(0,3) ?? [])).catch(()=>{});
    fetch("/magnum/api/duel42/elo",{credentials:"include"}).then(r=>r.json()).then(j=> setElo(typeof j.elo==="number"?j.elo:null)).catch(()=>{});
  }, []);

  useEffect(() => {
    if (!wrapRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.set("[data-duelrush-card]", { y: 24, opacity: 0, scale: 0.98 });
      gsap.to("[data-duelrush-card]", { y: 0, opacity: 1, scale: 1, stagger: 0.12, duration: 0.5, ease: "power2.out" });
      if (prestigeRef.current) gsap.to(prestigeRef.current, { scale: 1.03, duration: 1.4, repeat: -1, yoyo: true, ease: "sine.inOut" });
    }, wrapRef);
    return () => ctx.revert();
  }, []);

  const doShare = useCallback(async () => {
    if (!canvasRef.current) return;
    setGenerating(true);
    try {
      await drawDuelShareCard(canvasRef.current, { score, game, username: me?.username ?? null, code, elo, durationSec });
      const blob = await canvasToBlob(canvasRef.current);
      const safe = (me?.username ?? "duel").replace(/[^a-z0-9_-]/gi, "_").slice(0, 16) || "duel";
      const res = await shareOrDownloadDuel(blob, `magnum-duel-${safe}-${score}-${code}-1080.png`, `Брось вызов: мой скор ${score} → дуэль 42с 🌋 Код ${code} — 5opka.ru/magnum/duel/lobby`);
      setToast(res === "shared" ? "Поделились 🔥 — код в шаре" : "Скачано PNG 1080×1080 ✓");
    } catch (e) { setToast(String(e).slice(0, 80)); }
    finally { setGenerating(false); setTimeout(()=>setToast(null), 2300); }
  }, [score, game, me, code, elo, durationSec]);

  const canvasDraw = useCallback(async () => {
    if (!canvasRef.current || !showShare) return;
    try { await drawDuelShareCard(canvasRef.current, { score, game, username: me?.username ?? null, code, elo, durationSec }); } catch {}
  }, [score, game, me, code, elo, durationSec, showShare]);
  useEffect(()=>{ void canvasDraw(); }, [canvasDraw]);

  const displayScore = Math.round(score);

  return (
    <div ref={wrapRef} style={{ marginTop: 18, display: "grid", gap: 12, textAlign: "left" }}>
      {/* Main CTA */}
      <div data-duelrush-card style={{ border: "1.5px solid rgba(255,87,34,0.35)", borderRadius: 16, padding: compact ? "14px 14px" : "18px 16px", background: "linear-gradient(135deg,rgba(255,87,34,0.10),rgba(255,204,0,0.06))", boxShadow: "0 10px 36px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,87,34,0.14), 0 0 28px rgba(255,87,34,0.14)", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, background:"radial-gradient(420px 220px at 78% 10%, rgba(255,204,0,0.08), transparent 70%)", pointerEvents:"none" }} />
        <div style={{ display:"flex", gap:10, alignItems:"flex-start", flexWrap:"wrap", position:"relative" }}>
          <span style={{ fontSize: compact?22:26, lineHeight:1 }}>🌋</span>
          <div style={{ flex:1, minWidth:200 }}>
            <div style={{ fontWeight:900, fontSize: compact?16:18, letterSpacing:-0.02, color:"#fff", lineHeight:1.2 }}>Брось вызов: твой скор {displayScore} → дуэль 42с</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.62)", marginTop:4, lineHeight:1.45 }}>10с кликер · eruption 2.5x · топ-3 volcano crown 🌋 · wager 0/42/142/420 → +42 ELO</div>
          </div>
          <span style={{ fontSize:11, fontWeight:800, letterSpacing:"0.1em", color:"#ffcc00", background:"rgba(255,204,0,0.10)", border:"1px solid rgba(255,204,0,0.22)", padding:"5px 10px", borderRadius:999, whiteSpace:"nowrap" }}>DUEL RUSH</span>
        </div>

        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:12, position:"relative" }}>
          <a
            href={`/magnum/duel/lobby?create=1&wager=42&code=${code}&score=${displayScore}&game=${encodeURIComponent(game)}&utm_source=duel_rush`}
            data-testid="duel-rush-create"
            style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"10px 16px", borderRadius:999, background:"linear-gradient(135deg,#ff5722,#ff2d55)", color:"#fff", fontWeight:900, fontSize:14, textDecoration:"none", boxShadow:"0 8px 22px rgba(255,45,85,0.28)", border:"none" }}
          >
            Создать дуэль ABCD → {code}
          </a>
          <button
            onClick={()=> setShowShare(v=>!v)}
            data-testid="duel-rush-share-toggle"
            style={{ padding:"10px 14px", borderRadius:999, border:"1px solid rgba(255,255,255,0.14)", background: showShare?"rgba(255,204,0,0.12)":"rgba(255,255,255,0.06)", color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer" }}
          >
            {showShare ? "Скрыть шаринг" : "Поделиться 1080 📸"}
          </button>
          <a href="/magnum/games/duel-volcano" style={{ padding:"10px 12px", borderRadius:999, border:"1px solid rgba(255,87,34,0.18)", background:"rgba(255,87,34,0.08)", color:"#ffcc99", fontWeight:700, fontSize:12, textDecoration:"none" }}>Вулкан →</a>
        </div>

        {/* ELO teaser топ-3 */}
        <div style={{ marginTop:14, padding:"10px 12px", borderRadius:12, background:"rgba(0,0,0,0.22)", border:"1px solid rgba(255,255,255,0.06)", display:"grid", gap:6 }}>
          <div style={{ fontSize:11, letterSpacing:"0.12em", fontWeight:800, color:"rgba(255,204,0,0.9)" }}>ТОП-3 VOLCANO CROWN 🌋 · ELO {elo ?? "—"} · +1420 / +42 ELO</div>
          {lb.length===0 ? <div style={{ fontSize:12, color:"rgba(255,255,255,0.55)" }}>Пока пусто — стань первым и забери 👑</div> :
            <div style={{ display:"grid", gap:4 }}>
              {lb.map((r,i)=>(
                <div key={r.player+i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 8px", borderRadius:10, background: i===0?"linear-gradient(90deg,rgba(255,87,34,0.18),rgba(255,204,0,0.10))":"rgba(255,255,255,0.04)", border: i===0?"1px solid rgba(255,87,34,0.22)":"1px solid rgba(255,255,255,0.06)", fontSize:12 }}>
                  <span style={{ fontWeight:800, color: i===0?"#ffcc00":"#fff" }}>#{i+1} {r.player} {i===0?"👑": i===1?"🥈": i===2?"🥉":""} {i<3? "🌋":""}</span>
                  <b style={{ color:"#ffcc00" }}>{Math.round(r.score)}</b>
                </div>
              ))}
            </div>
          }
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.45)" }}>Сезон 7дн · дуэль 10с · eruption 2.5x · wager 42/142/420</div>
        </div>

        {/* Prestige teaser */}
        <div ref={prestigeRef as never} style={{ marginTop:10, display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", padding:"8px 10px", borderRadius:999, background:"rgba(255,204,0,0.08)", border:"1px solid rgba(255,204,0,0.18)", fontSize:12 }}>
          <span style={{ fontWeight:900, color:"#ffcc00" }}>♻️ Престиж</span>
          <span style={{ color:"rgba(255,255,255,0.72)" }}>рестарт за множитель +15% навсегда</span>
          <a href="/magnum/conveyor" style={{ marginLeft:"auto", color:"#111", background:"#ffcc00", padding:"5px 10px", borderRadius:999, fontWeight:800, textDecoration:"none", fontSize:12 }}>Завод →</a>
          <span style={{ color:"rgba(255,255,255,0.38)", fontSize:11 }}>/magnum/conveyor · dust→prestige</span>
        </div>

        <div style={{ marginTop:8, fontSize:11, color:"rgba(255,255,255,0.38)" }}>Автокомната ABCD · шаринг 1080 · invite link с QR · idle prestige как в Solana guide + Duolingo streak</div>
      </div>

      {/* Share canvas */}
      {showShare && (
        <div data-duelrush-card style={{ border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:12, background:"rgba(255,255,255,0.02)", display:"grid", gap:10 }}>
          <div style={{ fontSize:12, fontWeight:800, letterSpacing:"0.08em", color:"rgba(255,255,255,0.72)" }}>ШАРИНГ 1080×1080 · DUEL {displayScore} · код {code} · QR → /magnum/duel/lobby</div>
          <div style={{ display:"grid", placeItems:"center", background:"rgba(0,0,0,0.3)", borderRadius:12, padding:10, border:"1px solid rgba(255,255,255,0.06)" }}>
            <canvas ref={canvasRef} width={1080} height={1080} style={{ width:"100%", maxWidth:420, height:"auto", aspectRatio:"1/1", borderRadius:10, background:"#0a0a0a", display:"block", boxShadow:"0 10px 30px rgba(0,0,0,0.45)" }} aria-label="Duel share 1080" />
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center" }}>
            <button onClick={doShare} disabled={generating} data-testid="duel-share-action" style={{ padding:"10px 16px", borderRadius:999, background: generating?"#555":"linear-gradient(135deg,#ff5722,#ff2d55)", color:"#fff", fontWeight:900, border:"none", cursor: generating?"wait":"pointer", opacity: generating?0.7:1 }}>{generating?"Готовлю…":"Поделиться / Скачать 1080"}</button>
            <a href={`/magnum/share-card?score=${displayScore}&code=${code}&game=${encodeURIComponent(game)}`} style={{ padding:"10px 14px", borderRadius:999, border:"1px solid rgba(255,255,255,0.12)", color:"rgba(255,255,255,0.72)", textDecoration:"none", fontSize:13 }}>Открыть шаринг-страницу →</a>
          </div>
          <div style={{ textAlign:"center", fontSize:11, color:"rgba(255,255,255,0.35)" }}>Web Share API → fallback PNG · ссылка с utm_source=duel_share</div>
        </div>
      )}

      {toast && <div role="status" style={{ position:"fixed", left:"50%", bottom:18, transform:"translateX(-50%)", background:"rgba(20,20,20,0.96)", color:"#fff", border:"1px solid rgba(255,87,34,0.22)", padding:"10px 14px", borderRadius:999, fontSize:13, fontWeight:700, zIndex:50 }}>{toast}</div>}
    </div>
  );
}
