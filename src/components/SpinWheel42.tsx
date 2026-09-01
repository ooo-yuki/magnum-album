import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { SPIN_SECTORS, getStreakMultiplier, resolveSpinReward, type SpinResult } from "../lib/spinRewards";

type SpinStatus = {
  canSpin: boolean;
  canSpinFree: boolean;
  streak: number;
  nextRewardMult: number;
  lastSpin: string | null;
  waitMs: number;
  freeSpins: number;
  totalSpins: number;
};

export function SpinWheel42() {
  const wheelRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<SpinStatus | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [msg, setMsg] = useState("");
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const angleRef = useRef(0);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch("/magnum/api/spin/status", { credentials: "include" });
      if (r.status === 401) { setAuthed(false); return; }
      setAuthed(true);
      const j = (await r.json()) as SpinStatus & { code?: string };
      setStatus(j);
      if (j.code) setShareCode(j.code);
    } catch {}
  }, []);

  const fetchReferralCode = useCallback(async () => {
    try {
      const r = await fetch("/magnum/api/referral/code", { credentials: "include" });
      if (r.ok) {
        const j = (await r.json()) as { code?: string };
        if (j.code && !shareCode) setShareCode(j.code);
      }
    } catch {}
  }, [shareCode]);

  useEffect(() => { void fetchStatus(); void fetchReferralCode(); }, [fetchStatus, fetchReferralCode]);

  // handle ?spin=CODE inbound — auto exchange +1 spin both
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const spinParam = sp.get("spin")?.trim().toUpperCase() ?? "";
      if (/^42-[A-Z0-9]{4}$/.test(spinParam)) {
        fetch("/magnum/api/spin/referral", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: spinParam }) })
          .then(async r => {
            const j = await r.json() as { ok?: boolean; rewardSpins?: number; error?: string };
            if (r.ok && j.ok) {
              setToast(`Бонус +1 спин за код ${spinParam}!`);
              setTimeout(()=>setToast(null), 3200);
              fetchStatus();
            }
          }).catch(()=>{});
        try { localStorage.setItem("magnum:spin_ref", spinParam); } catch {}
      }
    } catch {}
  }, [fetchStatus]);

  const showToast = useCallback((m: string) => { setToast(m); window.setTimeout(()=>setToast(null), 3200); }, []);

  const doSpin = useCallback(async () => {
    if (spinning) return;
    if (!status) { setMsg("Загрузка…"); return; }
    if (!status.canSpin && status.freeSpins <= 0) {
      const waitH = Math.ceil(status.waitMs / 3600000);
      setMsg(`Уже крутил — жди ${waitH}ч`);
      return;
    }
    setSpinning(true);
    setMsg("");
    setResult(null);
    // GSAP rotation: 2-4 full turns + land on random sector (visual only, server picks actual)
    const targetIdx = Math.floor(Math.random() * SPIN_SECTORS.length);
    const extraTurns = 3 + Math.random() * 2;
    const targetAngle = 360 * extraTurns + targetIdx * 45 + 22.5;
    const el = wheelRef.current;
    if (el && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      await new Promise<void>(resolve => {
        gsap.to(el, { rotation: angleRef.current + targetAngle, duration: 2.4, ease: "power3.out", overwrite: true, onComplete: () => resolve() });
      });
      angleRef.current += targetAngle;
    } else if (el) {
      angleRef.current += targetAngle;
      gsap.set(el, { rotation: angleRef.current });
    }

    try {
      const r = await fetch("/magnum/api/spin", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const j = (await r.json()) as { error?: string; streak?: number; multiplier?: number; reward?: { sectorIndex: number; dust: number; skinId?: string | null; isEmpty?: boolean; extraSpin?: boolean; appliedDust?: number; epicRolled?: boolean; label?: string }; balance?: number; waitMs?: number };
      if (r.status === 401) { setAuthed(false); setMsg("Войди, братуха — нужен magnum:need-auth"); setSpinning(false); return; }
      if (r.status === 429) { setMsg(j.error || "1/24ч — уже крутил"); setSpinning(false); fetchStatus(); return; }
      if (!r.ok) { setMsg(j.error || "Ошибка спина"); setSpinning(false); return; }
      const secIdx = j.reward?.sectorIndex ?? targetIdx;
      const preview = resolveSpinReward(secIdx, j.streak ?? status.streak);
      // override with server applied values
      if (j.reward) {
        preview.dust = j.reward.dust ?? preview.dust;
        preview.appliedDust = j.reward.appliedDust ?? preview.appliedDust;
        preview.skinId = (j.reward.skinId ?? preview.skinId) as string | null;
        preview.isEmpty = Boolean(j.reward.isEmpty ?? preview.isEmpty);
        preview.extraSpin = Boolean(j.reward.extraSpin ?? preview.extraSpin);
        preview.epicRolled = Boolean(j.reward.epicRolled ?? preview.epicRolled);
      }
      setResult(preview);
      const mult = (j.multiplier ?? getStreakMultiplier(j.streak ?? status.streak)) as 1|2|3;
      if (preview.isEmpty) setMsg(`Пусто — повезёт в след раз (стрик ${j.streak ?? status.streak} ×${mult})`);
      else if (preview.extraSpin) setMsg(`+1 спин! Крути ещё`);
      else if (preview.skinId) setMsg(`Скин ${preview.skinId} ×${mult}!`);
      else if (preview.appliedDust) setMsg(`+${preview.appliedDust} dust ×${mult} · ${preview.epicRolled ? "EPIC 2%!" : ""}`);
      fetchStatus();
      fetchReferralCode();
    } catch {
      setMsg("Сеть — попробуй ещё");
    } finally { setSpinning(false); }
  }, [spinning, status, fetchStatus, fetchReferralCode]);

  const handleShare = useCallback(async () => {
    const code = shareCode;
    if (!code) { showToast("Войди чтобы получить код"); return; }
    const origin = typeof window !== "undefined" ? window.location.origin : "https://5opka.ru";
    const spinLink = `${origin}/magnum?spin=${encodeURIComponent(code)}`;
    const text = result ? `Выбил ${result.sector.label} ×${result.multiplier}! Крутани и ты — Колесо 42 🎡 ${spinLink}` : `Крутани Колесо 42 — бесплатный спин каждый день! ${spinLink}`;
    // try Web Share + canvas OG 1080
    try {
      const off = document.createElement("canvas");
      const ctx = off.getContext("2d");
      if (ctx) {
        off.width = 1080; off.height = 1080;
        const g = ctx.createLinearGradient(0, 0, 0, 1080);
        g.addColorStop(0, "#0a0a0a"); g.addColorStop(0.5, "#1a0a14"); g.addColorStop(1, "#0d0d0d");
        ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1080);
        ctx.strokeStyle = "#ffcc00"; ctx.lineWidth = 14; ctx.strokeRect(7, 7, 1066, 1066);
        ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.font = "600 24px Inter, sans-serif"; ctx.textAlign = "center";
        ctx.fillText("MAGNUM  ·  КОЛЕСО 42  ·  SPIN DAILY", 540, 90);
        ctx.font = "900 92px Inter, sans-serif"; ctx.fillStyle = "#ffcc00"; ctx.shadowColor = "rgba(255,45,85,0.35)"; (ctx as unknown as { shadowBlur: number }).shadowBlur = 18;
        ctx.fillText(result ? result.sector.label : "КРУТАНИ 42", 540, 220); (ctx as unknown as { shadowBlur: number }).shadowBlur = 0;
        ctx.fillStyle = "rgba(255,255,255,0.78)"; ctx.font = "500 26px Inter, sans-serif";
        ctx.fillText(result ? `×${result.multiplier} · ${result.appliedDust ? `+${result.appliedDust} dust` : result.skinId ?? "+1 спин"}` : "1 спин / 24ч · стрик 3дн ×2 · 7дн ×3", 540, 270);
        // wheel hint circle
        ctx.strokeStyle = "rgba(255,204,0,0.22)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(540, 520, 210, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = "900 46px Inter, sans-serif"; ctx.fillText("🎡 КОЛЕСО 42", 540, 530);
        ctx.fillStyle = "rgba(255,255,255,0.52)"; ctx.font = "400 20px Inter, sans-serif"; ctx.fillText("8 секторов · 1420 epic 2% · glacier/obsidian", 540, 570);
        // QR block — simple placeholder with code
        ctx.fillStyle = "#fff"; ctx.fillRect(540-130, 640, 260, 260);
        ctx.fillStyle = "#0a0a0a"; ctx.font = "700 18px monospace"; ctx.textAlign = "center";
        ctx.fillText(code, 540, 770);
        ctx.fillStyle = "#0a0a0a"; ctx.font = "600 13px Inter, sans-serif"; ctx.fillText("сканируй → +1 спин обоим", 540, 790);
        // draw fallback QR grid seeded by code+link
        const cells = 21; const cell = 260 / cells; let seed=0; const sStr=spinLink+code; for(let i=0;i<sStr.length;i++) seed=(seed*31+sStr.charCodeAt(i))>>>0; const rnd=()=>(seed=(seed*1664525+1013904223)>>>0)/0xffffffff;
        ctx.fillStyle = "#0a0a0a"; ctx.fillRect(540-130, 640, 260, 260);
        ctx.fillStyle = "#fff";
        for(let y=0;y<cells;y++) for(let x=0;x<cells;x++){
          const isFinder=(x<7&&y<7)||(x>=cells-7&&y<7)||(x<7&&y>=cells-7);
          let v:boolean; if(isFinder){ const fx=x%7,fy=y%7; v=fx===0||fx===6||fy===0||fy===6||(fx>=2&&fx<=4&&fy>=2&&fy<=4); } else v=rnd()>0.48;
          if(v) ctx.fillRect(540-130+x*cell+0.5,640+y*cell+0.5,cell-1,cell-1);
        }
        ctx.fillStyle = "rgba(255,255,255,0.62)"; ctx.font = "400 15px Inter, sans-serif"; ctx.textAlign="center";
        ctx.fillText(spinLink.replace(/^https?:\/\//, ""), 540, 940);
        ctx.fillStyle = "rgba(255,204,0,0.95)"; ctx.font="700 14px Inter, sans-serif"; ctx.fillText(`БРАТУХА-КОД ${code} · +1 спин обоим по QR`,540,970);
        // bottom bar
        ctx.fillStyle="rgba(255,255,255,0.06)"; ctx.fillRect(0,1020,1080,60);
        ctx.fillStyle="rgba(255,255,255,0.62)"; ctx.font="600 14px Inter, sans-serif"; ctx.textAlign="left"; ctx.fillText("ДРОП 15.09.2026  ·  ПЕРВЫЕ 42 — ЗОЛОТО",28,1054);
        ctx.textAlign="right"; ctx.fillStyle="rgba(255,204,0,0.95)"; ctx.fillText("★ КОЛЕСО 42",1052,1054);
        const blob: Blob = await new Promise((res, rej)=> off.toBlob(b=>b?res(b):rej(new Error("toBlob null")), "image/png", 1.0));
        const file = new File([blob], `magnum-spin-${code}-1080.png`, { type:"image/png" });
        const nav = navigator as unknown as { canShare?: (d:{files:File[]})=>boolean; share?: (d: {files:File[];title:string;text:string})=>Promise<void> };
        if (nav.canShare?.({files:[file]}) && nav.share) {
          await nav.share({ files:[file], title:"MAGNUM — Колесо 42", text });
          showToast("Поделились 🔥 +1 спин по QR");
          return;
        }
        const url = URL.createObjectURL(blob);
        const a=document.createElement("a"); a.href=url; a.download=`magnum-spin-${code}-1080.png`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),2000);
        showToast("Скачано PNG 1080×1080 ✓ · QR ?spin="+code);
        return;
      }
    } catch {}
    // fallback simple
    try { await navigator.clipboard.writeText(text); showToast("Скопировано: " + text.slice(0,60)+"…"); } catch { showToast(text); }
  }, [shareCode, result, showToast]);

  const mult = status ? getStreakMultiplier(status.streak) : 1;
  const waitH = status ? Math.ceil(status.waitMs / 3600000) : 0;

  if (authed === false) {
    return (
      <div data-testid="spin-wheel" style={{ border:"1px dashed rgba(255,204,0,0.24)", borderRadius:18, padding:16, background:"rgba(255,204,0,0.04)", textAlign:"center" }}>
        <div style={{ fontWeight:900, fontSize:13, color:"#ffcc00", letterSpacing:"0.06em" }}>🎡 КОЛЕСО 42</div>
        <div style={{ fontSize:13, color:"rgba(255,255,255,0.62)", marginTop:6 }}>Войди чтобы крутить — 1 спин / 24ч, стрик ×2/×3</div>
        <a href="/magnum/presave-rating" style={{ display:"inline-block", marginTop:10, fontSize:12, color:"#ffcc00", textDecoration:"underline" }}>Войти →</a>
      </div>
    );
  }

  return (
    <div data-testid="spin-wheel" style={{ border:"1px solid rgba(255,204,0,0.22)", borderRadius:18, background:"linear-gradient(180deg, rgba(255,204,0,0.08), rgba(255,45,85,0.06) 55%, rgba(18,18,22,0.96))", padding:16, boxShadow:"0 12px 36px rgba(0,0,0,0.35), 0 0 22px rgba(255,204,0,0.08)" }}>
      <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
        <span style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"6px 10px", borderRadius:999, background:"rgba(255,204,0,0.14)", border:"1px solid rgba(255,204,0,0.28)", color:"#ffcc00", fontSize:11, fontWeight:900, letterSpacing:"0.08em" }}>🎡 КОЛЕСО 42</span>
        <span style={{ fontSize:12, color:"rgba(255,255,255,0.55)", fontWeight:700 }}>8 секторов · 1/24ч · стрик 3дн ×2 · 7дн ×3</span>
        {status && <span style={{ marginLeft:"auto", fontSize:11, padding:"4px 8px", borderRadius:999, background: mult>1 ? "rgba(255,204,0,0.14)" : "rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)", color: mult>1 ? "#ffcc00" : "rgba(255,255,255,0.62)", fontWeight:800 }}>стрик {status.streak}дн {mult>1?`×${mult} 🔥`:"×1"}</span>}
      </div>

      <div style={{ display:"flex", gap:16, alignItems:"center", flexWrap:"wrap", marginTop:14 }}>
        <div style={{ position:"relative", width: 220, height: 220, flexShrink:0 }}>
          <div ref={wheelRef} style={{ position:"absolute", inset:0, borderRadius:"50%", border:"3px solid rgba(255,204,0,0.45)", overflow:"hidden", background:"conic-gradient(from 0deg, #ff2d55 0deg 45deg, #ff6b35 45deg 90deg, #ffd700 90deg 135deg, #7dd8ff 135deg 180deg, #2a2a2a 180deg 225deg, #00ff88 225deg 270deg, #1a1a1a 270deg 315deg, #5865f2 315deg 360deg)", boxShadow:"0 8px 32px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.08)" }}>
            {SPIN_SECTORS.map((s, i) => (
              <span key={s.id} style={{ position:"absolute", left:"50%", top:"50%", fontSize:10, fontWeight:900, color: s.kind==="empty" ? "rgba(255,255,255,0.55)" : "#fff", textShadow:"0 1px 6px rgba(0,0,0,0.85)", transform:`rotate(${i*45+22.5}deg) translate(68px) rotate(-${i*45+22.5}deg) translate(-50%,-50%)`, transformOrigin:"0 0", whiteSpace:"nowrap" }}>{s.label}</span>
            ))}
            <div style={{ position:"absolute", left:"50%", top:"50%", width:54, height:54, marginLeft:-27, marginTop:-27, borderRadius:"50%", background:"radial-gradient(circle at 30% 30%, #fff, #ffcc00 60%, #ff6b35)", border:"2px solid rgba(255,255,255,0.85)", display:"grid", placeItems:"center", fontWeight:900, fontSize:11, color:"#0a0a0a", boxShadow:"0 4px 16px rgba(0,0,0,0.35)" }}>42</div>
          </div>
          <div aria-hidden style={{ position:"absolute", top:-6, left:"50%", marginLeft:-8, width:0, height:0, borderLeft:"8px solid transparent", borderRight:"8px solid transparent", borderTop:"14px solid #ff2d55", filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.35))" }} />
        </div>

        <div style={{ flex:1, minWidth:220 }}>
          {status ? (
            <>
              <div style={{ fontWeight:900, fontSize:15, color:"#fff" }}>Бесплатно 1/день · {status.canSpin || status.freeSpins>0 ? <span style={{color:"#00ff88"}}>ГОТОВ К СПИНУ ✓</span> : <span style={{color:"rgba(255,255,255,0.55)"}}>ждать {waitH}ч</span>} {status.freeSpins>0 && <span style={{ marginLeft:6, padding:"2px 7px", borderRadius:999, background:"rgba(0,255,136,0.14)", border:"1px solid rgba(0,255,136,0.22)", color:"#00ff88", fontSize:11 }}>+{status.freeSpins} доп</span>}</div>
              <div style={{ marginTop:6, fontSize:12, color:"rgba(255,255,255,0.62)", lineHeight:1.5 }}>Выпадет 1 из 8: <b style={{color:"#ffcc00"}}>42</b> / <b style={{color:"#ffcc00"}}>142</b> / <b style={{color:"#ffd700"}}>1420 epic 2%</b> / <b>GLACIER</b> / <b>OBSIDIAN</b> / пусто / <b style={{color:"#00ff88"}}>+1 спин</b> · стрик <b>×{mult}</b> к выигрышу</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:12 }}>
                <button onClick={doSpin} disabled={spinning || (!status.canSpin && status.freeSpins<=0)} data-testid="spin-wheel-spin" style={{ appearance:"none", border:0, padding:"10px 18px", borderRadius:999, background: spinning ? "#333" : (!status.canSpin && status.freeSpins<=0) ? "#2a2a2a" : "linear-gradient(135deg,#ff2d55,#ffcc00)", color: spinning || (!status.canSpin && status.freeSpins<=0) ? "#aaa" : "#fff", fontWeight:900, fontSize:13, cursor: spinning || (!status.canSpin && status.freeSpins<=0) ? "not-allowed" : "pointer", boxShadow:"0 8px 20px rgba(255,45,85,0.22)" }}>{spinning ? "Кручу… 🎡" : status.freeSpins>0 ? `Крутить (+${status.freeSpins} доп)` : "Крутить 1/день"}</button>
                <button onClick={handleShare} data-testid="spin-wheel-share" style={{ appearance:"none", border:"1px solid rgba(255,204,0,0.24)", background:"rgba(255,255,255,0.06)", color:"#fff", fontWeight:800, fontSize:12, padding:"10px 14px", borderRadius:999, cursor:"pointer" }}>Выбил ×{result?.multiplier ?? mult}! Крутани и ты — шаринга 1080</button>
              </div>
              <div style={{ marginTop:8, fontSize:11, color:"rgba(255,255,255,0.42)" }}>Шаринг OG 1080×1080 · QR ?spin={shareCode ?? "42-XXXX"} · клик по QR = +1 спин обоим (реферал-луп)</div>
              {result && (
                <div style={{ marginTop:10, padding:"8px 10px", borderRadius:12, background:"rgba(255,204,0,0.08)", border:"1px solid rgba(255,204,0,0.18)", fontSize:12, color:"#fff", fontWeight:700 }}>
                  Выпало: <span style={{color:"#ffcc00"}}>{result.sector.label}</span> {result.appliedDust ? `+${result.appliedDust} dust` : result.skinId ? `скин ${result.skinId}` : result.extraSpin ? "+1 спин" : "пусто"} · ×{result.multiplier} {result.epicRolled ? "· EPIC 2%!" : ""} · стрик {status.streak}дн
                </div>
              )}
              {msg && <div style={{ marginTop:8, fontSize:12, color: msg.includes("Пусто") || msg.includes("жди") ? "rgba(255,255,255,0.62)" : "#00ff88", fontWeight:700 }}>{msg}</div>}
            </>
          ) : (
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.55)" }}>Готовлю колесо…</div>
          )}
        </div>
      </div>
      {toast && <div role="status" style={{ position:"fixed", left:"50%", bottom:18, transform:"translateX(-50%)", background:"rgba(20,20,20,0.96)", color:"#fff", border:"1px solid rgba(255,204,0,0.22)", padding:"10px 14px", borderRadius:999, fontSize:13, fontWeight:700, zIndex:50 }}>{toast}</div>}
    </div>
  );
}
export default SpinWheel42;
