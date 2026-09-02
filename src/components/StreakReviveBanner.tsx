import { useEffect, useState, useRef } from "react";
type Status = {
  ok?: boolean; eligible?: boolean; alreadyRevived?: boolean; lostStreak?: number; gamesToday?: number; needGames?: number; freeLeft?: number; freezeBal?: number; banner?: string | null;
};
export function StreakReviveBanner({ surface = "generic" }: { surface?: string }) {
  const [s, setS] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [shared, setShared] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/magnum/api/streak/revive/status", { credentials: "include" });
        if (!r.ok) return;
        const j = (await r.json()) as Status;
        if (!cancelled) setS(j);
      } catch {}
    })();
    const onScore = () => {
      fetch("/magnum/api/streak/revive/status", { credentials: "include" }).then(r=>r.json()).then(j=>setS(j as Status)).catch(()=>{});
    };
    window.addEventListener("magnum:game-score" as unknown as string, onScore as EventListener);
    return () => { cancelled = true; window.removeEventListener("magnum:game-score" as unknown as string, onScore as EventListener); };
  }, []);
  if (!s || !s.eligible) return null;
  const lost = s.lostStreak ?? 0;
  const need = s.needGames ?? Math.max(0, 3 - (s.gamesToday ?? 0));
  const canRevive = need === 0 && (s.freeLeft ?? 0) > 0;
  async function doRevive() {
    if (busy) return; setBusy(true); setMsg(null);
    try {
      const r = await fetch("/magnum/api/streak/revive", { method: "POST", credentials: "include" });
      const j = await r.json() as { ok?: boolean; error?: string; streak?: number; reward?: number; badge?: string };
      if (j.ok) { setMsg(`🔥 Стрик ${j.streak}дн восстановлен! +${j.reward} · ${j.badge}`); setS(prev=>prev?{...prev, eligible:false}:prev); }
      else setMsg(j.error || "Не получилось");
    } catch { setMsg("Ошибка сети"); }
    setBusy(false);
  }
  function drawShare() {
    const c = canvasRef.current; if (!c) return null;
    const ctx = c.getContext("2d"); if (!ctx) return null;
    ctx.clearRect(0, 0, 1080, 1080);
    const g = ctx.createLinearGradient(0, 0, 1080, 1080);
    g.addColorStop(0, "#ff2d55"); g.addColorStop(1, "#ffcc00");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1080);
    ctx.fillStyle = "rgba(0,0,0,0.82)"; ctx.fillRect(40, 40, 1000, 1000);
    ctx.fillStyle = "#fff"; ctx.font = "900 72px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("ВЕРНУЛСЯ 42", 540, 360);
    ctx.font = "700 42px sans-serif"; ctx.fillStyle = "#ffcc00";
    ctx.fillText(`Верни стрик ${lost}дн`, 540, 470);
    ctx.fillStyle = "#fff"; ctx.font = "400 28px sans-serif";
    ctx.fillText("Сыграл 3 игры — вернул стрик 🔥", 540, 530);
    ctx.font = "700 22px monospace"; ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.fillText("5opka.ru/magnum", 540, 980);
    return c;
  }
  async function doShare() {
    const c = drawShare(); if (!c) return;
    c.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `magnum-revive-${lost}-${Date.now()}-1080.png`, { type: "image/png" });
      const nav: unknown = navigator as unknown;
      const shareData = { files: [file], title: `ВЕРНУЛСЯ 42 — ${lost}дн`, text: `Вернул стрик ${lost}дн за 3 игры — 5opka.ru/magnum` };
      try {
        const n = nav as { canShare?: (d: unknown)=>boolean; share?: (d: unknown)=>Promise<void> };
        if (n.canShare && n.share && n.canShare(shareData)) { await n.share(shareData); setShared(true); return; }
      } catch {}
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = file.name; a.click(); setTimeout(()=>URL.revokeObjectURL(url), 2000); setShared(true);
      try { await fetch("/magnum/api/presave/click", { method:"POST", credentials:"include", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ url:"/magnum/share-card?revive="+lost, variant:"streak_revive_share" }) }); } catch {}
    }, "image/png");
  }
  return (
    <div data-testid="streak-revive-banner" data-surface={surface} style={{ background: "linear-gradient(135deg,#ff2d55 0%,#7a0e2a 55%,#1a1a1a 100%)", border: "1px solid rgba(255,204,0,0.32)", borderRadius: 16, padding: 16, color: "#fff", position: "relative", overflow: "hidden" }}>
      <div style={{ fontWeight: 900, fontSize: 16, lineHeight: 1.2 }}>Верни стрик {lost}дн — сыграй 3 игры сегодня</div>
      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>Duolingo revival: порвал ≥7дн → 3 игры засчитают возврат. Бесплатно 1/мес · milestone 7/30дн → +2 freeze · бейдж ВЕРНУЛСЯ 42</div>
      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, background: "rgba(0,0,0,0.32)", padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.14)" }}>Сегодня игр: {s.gamesToday}/3 {need>0?`· нужно ещё ${need}`:"· готово ✓"}</span>
        <span style={{ fontSize: 12, background: "rgba(255,204,0,0.16)", padding: "6px 10px", borderRadius: 999 }}>Free: {s.freeLeft}/1/мес · freeze: {s.freezeBal ?? 0}</span>
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={doRevive} disabled={busy || !canRevive} data-testid="streak-revive-btn" style={{ appearance:"none", background: canRevive?"linear-gradient(135deg,#ffcc00,#ff2d55)":"#3a3a3a", color: canRevive?"#000":"#aaa", border:"none", borderRadius:999, padding:"10px 18px", fontWeight:900, cursor: canRevive?"pointer":"not-allowed", opacity: busy?0.7:1 }}>{busy?"Возвращаю…":canRevive?"Вернуть стрик 🔥":`Сыграй ещё ${need} игры`}</button>
        <button onClick={doShare} data-testid="streak-revive-share" style={{ appearance:"none", background:"rgba(255,255,255,0.08)", color:"#fff", border:"1px solid rgba(255,255,255,0.18)", borderRadius:999, padding:"10px 14px", fontWeight:800, cursor:"pointer" }}>{shared?"Скачано ✓":"Поделиться 1080"}</button>
      </div>
      {msg && <div style={{ marginTop: 10, fontSize: 12, background:"rgba(0,0,0,0.28)", padding:"8px 10px", borderRadius:10 }}>{msg}</div>}
      <canvas ref={canvasRef} width={1080} height={1080} style={{ display:"none" }} aria-hidden />
    </div>
  );
}
