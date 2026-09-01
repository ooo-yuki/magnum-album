import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { buildDuelShareUrl, canvasToBlob, drawDuelShareCard, duelShareText, shareDuelCard } from "../lib/duelShare";
import { subscribeMe } from "../lib/authMe";

type Props = {
  score?: number;
  elo?: number | null;
  gameLabel: string;
  compact?: boolean;
};

export function DuelVictoryCTA({ score, elo, gameLabel, compact }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [code] = useState(() => {
    const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i=0;i<4;i++) s+= alpha[Math.floor(Math.random()*alpha.length)]!;
    return s;
  });
  const [username, setUsername] = useState<string|null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string|null>(null);
  const [copied, setCopied] = useState(false);

  const shareUrl = buildDuelShareUrl({ code, score, game: gameLabel });
  const shareText = duelShareText(score, typeof elo==="number" ? elo : undefined);

  useEffect(() => {
    return subscribeMe((u)=>{ if(u?.username) setUsername(u.username); });
  }, []);

  const renderCard = useCallback(async ()=>{
    if(!canvasRef.current) return;
    await drawDuelShareCard(canvasRef.current, {
      username, score, elo: typeof elo==="number"?elo:undefined, gameLabel, code, wager: 42,
    });
    setReady(true);
  }, [username, score, elo, gameLabel, code]);

  useEffect(()=>{ void renderCard(); }, [renderCard]);

  const onShare = async ()=>{
    if(!canvasRef.current) return;
    setBusy(true);
    try {
      await renderCard();
      const blob = await canvasToBlob(canvasRef.current);
      const safe = (username ?? "magnum").replace(/[^a-z0-9_-]/gi,"_").slice(0,20) || "magnum";
      const res = await shareDuelCard(blob, `magnum-duel-${safe}-${code}-1080.png`, shareUrl, shareText);
      setToast(res==="shared" ? "Поделились 🔥 — ждём в дуэли" : "Скачано PNG 1080×1080 ✓");
      try { await navigator.clipboard.writeText(shareUrl); } catch {}
      // track duel_share event
      try { fetch("/magnum/api/presave/click", {method:"POST", credentials:"include", headers:{"Content-Type":"application/json"}, body: JSON.stringify({url: shareUrl, variant: "duel_share:"+gameLabel, ts: Date.now()})}).catch(()=>{}); } catch {}
    } catch(e){ setToast(String(e).slice(0,80)); }
    finally { setBusy(false); setTimeout(()=>setToast(null), 2400); }
  };

  const onCopyLink = async ()=>{
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true); setToast("Ссылка скопирована — QR ведёт сюда ✓");
      setTimeout(()=>{ setCopied(false); setToast(null); }, 1800);
    } catch {
      setToast(shareUrl);
      setTimeout(()=>setToast(null), 2400);
    }
  };

  const onCopyQrHint = async ()=>{
    try { await navigator.clipboard.writeText(shareUrl); setToast("QR скопирован — ссылка в буфере"); setTimeout(()=>setToast(null), 1800);} catch {}
  };

  if (compact) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:8, alignItems:"center", width:"100%" }}>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center" }}>
          <button onClick={onShare} disabled={busy} data-testid="duel-share" style={{ appearance:"none", border:0, background: busy?"#555":"linear-gradient(135deg,#ff4500,#ff2d55)", color:"#fff", fontWeight:900, fontSize:14, padding:"10px 18px", borderRadius:999, cursor: busy?"wait":"pointer", boxShadow:"0 8px 20px rgba(255,69,0,0.28)" }}>{busy?"Готовлю…":"⚡ Вызвать на дуэль — Поделиться"}</button>
          <button onClick={onCopyLink} style={{ appearance:"none", border:"1px solid rgba(255,255,255,0.14)", background:"rgba(255,255,255,0.06)", color:"#fff", fontWeight:700, fontSize:14, padding:"10px 16px", borderRadius:999, cursor:"pointer" }}>{copied?"Скопировано ✓":"Копировать ссылку"}</button>
          <Link to={`/magnum/duel/lobby?code=${code}&utm_source=duel_share&utm_medium=share&utm_campaign=magnum42`} style={{ display:"inline-flex", alignItems:"center", padding:"10px 14px", borderRadius:999, background:"rgba(255,204,0,0.12)", border:"1px solid rgba(255,204,0,0.22)", color:"#ffcc00", fontWeight:800, fontSize:13, textDecoration:"none" }}>В дуэль → {code}</Link>
        </div>
        {toast && <div role="status" style={{ fontSize:12, color:"#ffcc00", background:"rgba(0,0,0,0.6)", padding:"6px 10px", borderRadius:999 }}>{toast}</div>}
      </div>
    );
  }

  return (
    <div style={{ width:"100%", maxWidth:520, margin:"0 auto", display:"flex", flexDirection:"column", gap:10, alignItems:"center", padding:"12px 0 4px" }}>
      <div style={{ fontSize:11, letterSpacing:"0.12em", fontWeight:800, color:"#ff4500", background:"rgba(255,69,0,0.10)", border:"1px solid rgba(255,69,0,0.22)", padding:"6px 10px", borderRadius:999 }}>ДУЭЛЬ 42 — ВЫЗОВ БРАТУХИ</div>
      <div style={{ fontWeight:900, fontSize:"1.05rem", color:"#fff", textAlign:"center", lineHeight:1.25 }}>Победил в {gameLabel} — вызови на дуэль 🌋</div>
      <div style={{ fontSize:"0.82rem", color:"rgba(240,240,240,0.62)", textAlign:"center", maxWidth:420 }}>ставка 42 dust · +42 ELO за победу · 10с NITRO · QR ведёт в лобби <code style={{color:"#ffcc00"}}>ABCD {code}</code> · UTM duel_share</div>

      <div style={{ width:"100%", display:"grid", placeItems:"center", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding:12 }}>
        <canvas ref={canvasRef} width={1080} height={1080} style={{ width:"100%", maxWidth:420, aspectRatio:"1/1", borderRadius:12, background:"#0a0a0a", display:"block", boxShadow:"0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,69,0,0.12)" }} aria-label="Дуэль шаринг-карточка 1080x1080" />
        {!ready && <div style={{ fontSize:12, color:"rgba(255,255,255,0.45)", marginTop:8 }}>{busy?"Генерирую 1080…":"Готовлю карточку…"}</div>}
      </div>

      <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center" }}>
        <button onClick={onShare} disabled={busy} data-testid="duel-share" style={{ appearance:"none", border:0, background: busy?"#555":"linear-gradient(135deg,#ff4500,#ff2d55)", color:"#fff", fontWeight:900, fontSize:15, padding:"11px 18px", borderRadius:999, cursor: busy?"wait":"pointer", boxShadow:"0 8px 20px rgba(255,69,0,0.30)" }}>{busy?"Готовлю…":"Поделиться вызовом"}</button>
        <button onClick={onCopyLink} data-testid="duel-copy-link" style={{ appearance:"none", border:"1px solid rgba(255,255,255,0.14)", background:"rgba(255,255,255,0.06)", color:"#fff", fontWeight:700, fontSize:15, padding:"11px 16px", borderRadius:999, cursor:"pointer" }}>{copied?"Скопировано ✓":"Копировать ссылку"}</button>
        <button onClick={onCopyQrHint} data-testid="duel-copy-qr" title="QR ведёт на duel_share URL" style={{ appearance:"none", border:"1px solid rgba(255,204,0,0.18)", background:"rgba(255,204,0,0.08)", color:"#ffcc00", fontWeight:700, fontSize:15, padding:"11px 16px", borderRadius:999, cursor:"pointer" }}>Копировать QR</button>
      </div>
      <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", justifyContent:"center" }}>
        <span style={{ fontSize:11, color:"rgba(255,255,255,0.38)", wordBreak:"break-all", maxWidth:320 }}>{shareUrl}</span>
        <Link to={`/magnum/duel/lobby?code=${code}&utm_source=duel_share&utm_medium=share&utm_campaign=magnum42`} style={{ fontSize:12, color:"#ffcc00", textDecoration:"underline" }}>Открыть лобби →</Link>
      </div>
      <div style={{ fontSize:11, color:"rgba(255,255,255,0.32)" }}>1080×1080 · Web Share API → скачивание · OG duel_share · QR → {code}</div>
      {toast && <div role="status" style={{ position:"fixed", left:"50%", bottom:18, transform:"translateX(-50%)", background:"rgba(20,20,20,0.96)", color:"#fff", border:"1px solid rgba(255,69,0,0.22)", padding:"10px 14px", borderRadius:999, fontSize:13, fontWeight:700, zIndex:80 }}>{toast}</div>}
    </div>
  );
}
