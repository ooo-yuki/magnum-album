import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { CRASH_STAKES, formatMult, type CrashStake } from "../lib/crash42";

type CrashState = "waiting" | "running" | "crashed";
type CashLive = { username: string; stake: number; multiplier: number; payout: number; ts: number };
type Hist = { id: number; crash_at: number; seed: string; created_at?: string };

export function Crash42Page() {
  const [balance, setBalance] = useState<number | null>(null);
  const [stake, setStake] = useState<CrashStake>(42);
  const [state, setState] = useState<CrashState>("waiting");
  const [mult, setMult] = useState(1.0);
  const [myMult, setMyMult] = useState<number | null>(null);
  const [myPayout, setMyPayout] = useState<number | null>(null);
  const [canCash, setCanCash] = useState(false);
  const [live, setLive] = useState<CashLive[]>([]);
  const [hist, setHist] = useState<Hist[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [seed, setSeed] = useState<string>("");
  const [crashAt, setCrashAt] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<SVGSVGElement>(null);
  const multRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const lastPulseRef = useRef(0);

  const showToast = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(null), 1600); }, []);

  const fetchBalance = useCallback(async () => {
    try { const r = await fetch("/magnum/api/coins", { credentials: "include" }); if (r.ok) { const j = await r.json() as { balance?: number }; if (typeof j.balance === "number") setBalance(j.balance); } } catch {}
  }, []);
  const fetchHistory = useCallback(async () => {
    try { const r = await fetch("/magnum/api/crash/history", { credentials: "include" }); if (r.ok) { const j = await r.json() as { history?: Hist[] }; if (Array.isArray(j.history)) setHist(j.history.slice(0, 10)); } } catch {}
  }, []);
  const fetchState = useCallback(async () => {
    try { const r = await fetch("/magnum/api/crash/state", { credentials: "include" }); if (r.ok) { const j = await r.json() as { state?: string; multiplier?: number; seed?: string; crashAt?: number; history?: Hist[] }; if (j.state) setState(j.state as CrashState); if (typeof j.multiplier === "number") setMult(j.multiplier); if (j.seed) setSeed(j.seed); if (typeof j.crashAt === "number") setCrashAt(j.crashAt); if (Array.isArray(j.history)) setHist(j.history.slice(0, 10)); } } catch {}
  }, []);

  useEffect(() => { fetchBalance(); fetchHistory(); fetchState(); }, [fetchBalance, fetchHistory, fetchState]);

  // WS connect
  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) return;
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/magnum/api/crash`);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as any;
        if (msg.type === "state" || msg.type === "round") {
          if (msg.state) setState(msg.state);
          if (typeof msg.multiplier === "number") setMult(msg.multiplier);
          if (msg.seed) setSeed(String(msg.seed));
          if (typeof msg.crashAt === "number") setCrashAt(msg.crashAt);
          if (Array.isArray(msg.history)) setHist(msg.history.slice(0, 10));
          if (Array.isArray(msg.cashouts)) setLive(msg.cashouts.slice(0, 20));
          if (typeof msg.canCash === "boolean") setCanCash(msg.canCash);
          if (typeof msg.timeLeft === "number") setTimeLeft(msg.timeLeft);
        }
        if (msg.type === "tick") {
          if (typeof msg.multiplier === "number") setMult(msg.multiplier);
          if (typeof msg.timeLeft === "number") setTimeLeft(msg.timeLeft);
          if (msg.state) setState(msg.state);
        }
        if (msg.type === "start") {
          setState("running"); setMult(1.0); setMyMult(null); setMyPayout(null); setCanCash(true);
          if (msg.seed) setSeed(String(msg.seed));
          if (typeof msg.crashAt === "number") setCrashAt(msg.crashAt);
        }
        if (msg.type === "cashout") {
          const e: CashLive = { username: String(msg.username ?? "Братуха"), stake: Number(msg.stake ?? 0), multiplier: Number(msg.multiplier ?? 0), payout: Number(msg.payout ?? 0), ts: Date.now() };
          setLive(prev => [e, ...prev].slice(0, 20));
          if (msg.you) { setMyMult(e.multiplier); setMyPayout(e.payout); setCanCash(false); if (typeof msg.balance === "number") setBalance(msg.balance); }
          if (feedRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            const el = feedRef.current.firstElementChild as HTMLElement | null;
            if (el) gsap.fromTo(el, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.22, ease: "power2.out" });
          }
        }
        if (msg.type === "crash") {
          setState("crashed"); setCanCash(false);
          if (typeof msg.crashAt === "number") { setCrashAt(msg.crashAt); setMult(msg.crashAt); }
          if (Array.isArray(msg.history)) setHist(msg.history.slice(0, 10));
          // shake + flash
          if (multRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            gsap.fromTo(multRef.current, { x: -8 }, { x: 8, duration: 0.04, yoyo: true, repeat: 9, ease: "power2.inOut", onComplete: () => gsap.set(multRef.current, { x: 0 }) });
            gsap.fromTo(multRef.current, { backgroundColor: "rgba(255,45,85,0.22)" }, { backgroundColor: "rgba(0,0,0,0)", duration: 0.6, ease: "power2.out" });
          }
          // confetti if my payout >= x5
          if (myMult != null && myMult >= 5 && wrapRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            for (let i = 0; i < 120; i++) {
              const d = document.createElement("div");
              d.style.position = "absolute"; d.style.left = "50%"; d.style.top = "38%"; d.style.width = "6px"; d.style.height = "6px"; d.style.borderRadius = "1px";
              d.style.background = i % 3 === 0 ? "#ff2d55" : i % 3 === 1 ? "#00ff88" : "#ffd42a"; d.style.pointerEvents = "none";
              wrapRef.current.appendChild(d);
              const ang = Math.random() * Math.PI * 2, dist = 60 + Math.random() * 180;
              gsap.to(d, { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist + 80, rotation: Math.random() * 720, opacity: 0, duration: 0.9 + Math.random() * 0.6, ease: "power2.out", onComplete: () => d.remove() });
            }
          }
          if (typeof msg.balance === "number") setBalance(msg.balance);
          fetchHistory();
        }
        if (msg.type === "bet_ok") {
          if (typeof msg.balance === "number") setBalance(msg.balance);
          showToast(`Ставка ${msg.stake} принята`);
          setCanCash(true);
        }
        if (msg.type === "bet_error") showToast(String(msg.error ?? "Ставка отклонена"));
        if (msg.type === "cashout_error") showToast(String(msg.error ?? "Кешаут отклонён"));
        if (msg.type === "pong") return;
        if (msg.type === "ping") { try { ws.send(JSON.stringify({ type: "pong" })); } catch {} }
      } catch {}
    };
  }, [showToast, fetchHistory, myMult]);

  useEffect(() => { connect(); return () => { try { wsRef.current?.close(); } catch {} }; }, [connect]);

  useEffect(() => {
    if (!multRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const step = Math.floor(mult * 2); // 0.5 increments
    if (step !== lastPulseRef.current) {
      lastPulseRef.current = step;
      gsap.fromTo(multRef.current, { scale: 1 }, { scale: 1.15, duration: 0.2, yoyo: true, repeat: 1, ease: "power2.inOut" });
    }
  }, [mult]);

  // graph line draw 0.3s
  useEffect(() => {
    if (!graphRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const path = graphRef.current.querySelector("path");
    if (!path) return;
    const len = (path as SVGPathElement).getTotalLength?.() ?? 200;
    gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
    gsap.to(path, { strokeDashoffset: 0, duration: 0.3, ease: "power2.out" });
  }, [mult, state]);

  const placeBet = async () => {
    if (!connected) { showToast("WS не подключен — жми Войти"); return; }
    try {
      const r = await fetch("/magnum/api/crash/bet", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stake }) });
      const j = await r.json() as { error?: string; balance?: number; stake?: number };
      if (!r.ok) { showToast(j.error ?? "Ставка отклонена"); return; }
      if (typeof j.balance === "number") setBalance(j.balance);
      showToast(`Ставка ${stake} — ждём СТАРТ`);
      // also notify WS for live? server will broadcast
      try { wsRef.current?.send(JSON.stringify({ type: "bet", stake })); } catch {}
    } catch { showToast("Сеть"); }
  };

  const doCashout = () => {
    if (!canCash) return;
    try { wsRef.current?.send(JSON.stringify({ type: "cashout" })); } catch {}
    // fallback REST
    fetch("/magnum/api/crash/cashout", { method: "POST", credentials: "include" }).then(async (r) => {
      const j = await r.json().catch(() => ({})) as { error?: string; payout?: number; multiplier?: number; balance?: number };
      if (r.ok && typeof j.payout === "number") { setMyPayout(j.payout); if (typeof j.multiplier === "number") setMyMult(j.multiplier); if (typeof j.balance === "number") setBalance(j.balance); setCanCash(false); showToast(`Забрал ${formatMult(j.multiplier ?? mult)} +${j.payout}`); }
      else if (!r.ok && j.error) showToast(j.error);
    }).catch(() => {});
  };

  // build graph path for current mult
  const graphPath = (() => {
    const w = 320, h = 120, pad = 12;
    const points: string[] = [];
    const maxX = 10; // normalized duration 0..10
    // simple exp curve to current mult
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      // map mult 1..42 -> y, use curve similar to server: mult = exp(k*t*max)
      const m = 1 + (mult - 1) * Math.pow(t, 0.85);
      const x = pad + t * (w - pad * 2);
      const y = h - pad - ((m - 1) / 41) * (h - pad * 2);
      points.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return points.join(" ");
  })();

  return (
    <div ref={wrapRef} style={{ position: "relative", maxWidth: 980, margin: "0 auto", padding: "18px 14px 40px" }}>
      <h1 style={{ fontWeight: 900, fontSize: 22 }}>ШАХТА-КРАШ 42 <span style={{ opacity: 0.6, fontWeight: 600, fontSize: 13 }}>· краш-множитель x1.00→x42 · 6-12с раунд</span></h1>
      <p style={{ opacity: 0.7, fontSize: 13, marginTop: 6 }}>Ставь 42/142/420 до старта · жми ЗАБРАТЬ до KRASH · win stake×mult (кап x42) · 5% fee в котёл сезона · WS 10Hz · demo 0 без списания</p>
      {toast && <div role="status" style={{ position: "fixed", left: "50%", top: 14, transform: "translateX(-50%)", background: "rgba(0,0,0,0.9)", color: "#fff", padding: "8px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.14)", zIndex: 50, fontSize: 13 }}>{toast}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 12, marginTop: 14 }}>
        <div style={{ border: "1px solid rgba(255,255,255,0.10)", borderRadius: 14, padding: 14, background: "rgba(255,255,255,0.02)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, opacity: 0.8 }}>
            <span>Баланс: {balance ?? "…"} монет {connected ? "· WS ●" : "· WS ○"} · {state.toUpperCase()} {timeLeft != null && state === "running" ? `· ${timeLeft.toFixed(1)}с` : ""}</span>
            <span style={{ fontSize: 11, opacity: 0.6 }}>seed {seed.slice(0, 12) || "…"} · crash {crashAt ? formatMult(crashAt) : "?"}</span>
          </div>
          <div ref={multRef} style={{ marginTop: 10, textAlign: "center", padding: "12px 8px", borderRadius: 12, background: state === "crashed" ? "rgba(255,45,85,0.12)" : "rgba(0,0,0,0.22)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: -1, color: state === "crashed" ? "#ff2d55" : "#ffd42a" }}>{state === "crashed" ? `KRASH ${crashAt ? formatMult(crashAt) : formatMult(mult)}` : formatMult(mult)}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{myMult != null ? `твой ${formatMult(myMult)} +${myPayout ?? 0} монет` : canCash ? "жми ЗАБРАТЬ до краша" : state === "waiting" ? "ставь 42/142/420 и жди СТАРТ" : "—"}</div>
          </div>
          <svg ref={graphRef} viewBox="0 0 320 120" width="100%" height={140} style={{ marginTop: 10, background: "rgba(0,0,0,0.22)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
            <path d={graphPath} fill="none" stroke={state === "crashed" ? "#ff2d55" : "#ffd42a"} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            <text x={12} y={14} fontSize={9} fill="rgba(255,255,255,0.5)">x42</text>
            <text x={12} y={112} fontSize={9} fill="rgba(255,255,255,0.5)">x1.00</text>
          </svg>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {CRASH_STAKES.map(v => (
              <button key={v} onClick={() => setStake(v as CrashStake)} style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: stake === v ? "1px solid #ffd42a" : "1px solid rgba(255,255,255,0.12)", background: stake === v ? "rgba(255,212,42,0.16)" : "rgba(255,255,255,0.04)", color: "#fff", fontWeight: 800, cursor: "pointer" }}>{v}</button>
            ))}
            <button onClick={placeBet} disabled={state === "running"} style={{ flex: 1.2, padding: "10px 12px", borderRadius: 10, border: "1px solid #ffd42a", background: state === "running" ? "rgba(255,255,255,0.08)" : "rgba(255,212,42,0.18)", color: "#fff", fontWeight: 900, opacity: state === "running" ? 0.6 : 1, cursor: "pointer" }}>СТАВКА {stake}</button>
          </div>
          <button onClick={doCashout} disabled={!canCash || state !== "running"} style={{ width: "100%", marginTop: 8, padding: "14px 12px", borderRadius: 12, border: "1px solid #00ff88", background: canCash && state === "running" ? "#00ff88" : "rgba(255,255,255,0.06)", color: canCash && state === "running" ? "#000" : "#fff", fontWeight: 900, fontSize: 16, opacity: canCash && state === "running" ? 1 : 0.6, cursor: canCash && state === "running" ? "pointer" : "not-allowed" }}>ЗАБРАТЬ {formatMult(mult)}</button>
          <div style={{ marginTop: 8, fontSize: 11, opacity: 0.55 }}>WS /magnum/api/crash · tick 10Hz · 1 кешаут/раунд · late=0 · реконнект не спасает · seed hash проверяемый fair</div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div ref={feedRef} style={{ border: "1px solid rgba(255,255,255,0.10)", borderRadius: 14, padding: 12, background: "rgba(255,255,255,0.02)" }}>
            <div style={{ fontWeight: 800, fontSize: 12, letterSpacing: 0.6 }}>ЛЕНТА КЕШАУТОВ LIVE</div>
            <div style={{ display: "grid", gap: 6, marginTop: 8, maxHeight: 220, overflow: "auto" }}>
              {live.length === 0 && <div style={{ opacity: 0.5, fontSize: 12 }}>Пока никто не забрал — будь первым</div>}
              {live.map((e, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 12 }}>
                  <span>{e.username} · {e.stake}</span><span style={{ fontWeight: 800, color: "#00ff88" }}>{formatMult(e.multiplier)} +{e.payout}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ border: "1px solid rgba(255,255,255,0.10)", borderRadius: 14, padding: 12, background: "rgba(255,255,255,0.02)" }}>
            <div style={{ fontWeight: 800, fontSize: 12, letterSpacing: 0.6 }}>ИСТОРИЯ 10 РАУНДОВ</div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {hist.length === 0 && <span style={{ opacity: 0.5, fontSize: 12 }}>—</span>}
              {hist.map(h => (
                <span key={h.id} title={`${h.seed} ${h.crash_at}`} style={{ padding: "6px 8px", borderRadius: 999, background: h.crash_at >= 5 ? "rgba(255,204,0,0.16)" : h.crash_at >= 2 ? "rgba(0,255,136,0.12)" : "rgba(255,45,85,0.14)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12, fontWeight: 800 }}>{formatMult(h.crash_at)}</span>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, opacity: 0.55 }}>seed = hash раунда · проверяемый fair · краш 1.2–42 · ставь до старта, кешаут = stake×mult</div>
          </div>
        </div>
      </div>
    </div>
  );
}
