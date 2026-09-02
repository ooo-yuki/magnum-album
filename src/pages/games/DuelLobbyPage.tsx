import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { CONFETTI_COUNT, WAGER_OPTIONS, normalizeCode, type DuelRoomPublic, KOMBO_WINDOW_MS, KOMBO_NEED } from "../../lib/duel42";
import { subscribeMe } from "../../lib/authMe";

type Wager = typeof WAGER_OPTIONS[number];

export function DuelLobbyPage() {
  const [me, setMe] = useState<{ id: number; username: string } | null>(null);
  const [wager, setWager] = useState<Wager>(0);
  const [codeIn, setCodeIn] = useState("");
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState<DuelRoomPublic | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [suspect, setSuspect] = useState(false);
  const [tickScore, setTickScore] = useState(0);
  const [kombo, setKombo] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const komboFillRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 1700);
  }, []);

  useEffect(() => {
    return subscribeMe(setMe);
  }, []);

  useEffect(() => {
    if (!cardsRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;
    const ctx = gsap.context(() => {
      const cards = cardsRef.current!.querySelectorAll<HTMLElement>("[data-lobby-card]");
      gsap.set(cards, { y: 24, opacity: 0 });
      gsap.to(cards, { y: 0, opacity: 1, stagger: 0.12, duration: 0.5, ease: "power2.out" });
    }, cardsRef);
    return () => ctx.revert();
  }, [room, connected]);

  const spawnConfetti = useCallback(() => {
    if (!stageRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = stageRef.current;
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      const d = document.createElement("div");
      d.style.position = "absolute"; d.style.left = "50%"; d.style.top = "38%";
      d.style.width = "6px"; d.style.height = "6px"; d.style.borderRadius = "1px";
      d.style.background = i % 3 === 0 ? "#ff2d55" : i % 3 === 1 ? "#00ff88" : "#ffd42a";
      d.style.pointerEvents = "none";
      root.appendChild(d);
      const ang = Math.random() * Math.PI * 2, dist = 60 + Math.random() * 180;
      gsap.to(d, { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist + 80, rotation: Math.random() * 720, opacity: 0, duration: 0.9 + Math.random() * 0.6, ease: "power2.out", onComplete: () => d.remove() });
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) return;
    if (!me) { showToast("Войди, братуха — лобби только для залогиненных"); window.dispatchEvent(new CustomEvent("magnum:need-auth")); return; }
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/magnum/api/ws`);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
        const t = String((msg as { type?: string }).type ?? "");
        if ((msg as { room?: DuelRoomPublic }).room) setRoom((msg as { room: DuelRoomPublic }).room);
        if (t === "lobby:created" && (msg as { code?: string }).code) {
          if ((msg as { room?: DuelRoomPublic }).room) setRoom((msg as { room: DuelRoomPublic }).room);
          showToast(`Лобби ABCD ${(msg as { code: string }).code} — ждём братух`);
        }
        if (t === "suspect") {
          setSuspect(true);
          showToast(String((msg as { toast?: string }).toast ?? "CPS>20 suspect 🚫"));
          if (stageRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            gsap.fromTo(stageRef.current, { x: -6 }, { x: 6, duration: 0.08, yoyo: true, repeat: 5, ease: "power2.inOut" });
          }
        }
        if ((msg as { type?: string }).type === "overheat") {
          showToast("OVERHEAT — кулдаун 1с ❄️");
          if (stageRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.fromTo(stageRef.current, { x: -6 }, { x: 6, duration: 0.09, yoyo: true, repeat: 4 });
        }
        if (t === "tick") {
          const m = msg as { kombo?: number; combo?: number; nitro?: number; volcano?: number; magma?: number; score?: number; komboBurst?: boolean; comboBurst?: boolean; ghostTrail?: boolean };
          if (typeof m.kombo === "number") setKombo(m.kombo);
          else if (typeof m.combo === "number") setKombo(m.combo);
          if (typeof m.score === "number") setTickScore(Math.round(m.score * 10));
          if (m.komboBurst || m.comboBurst) {
            showToast("KOMBO x4 +25% 🔥");
            if (stageRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
              gsap.fromTo(stageRef.current, { scale: 1 }, { scale: 1.06, duration: 0.18, yoyo: true, repeat: 1, ease: "back.out(1.7)" });
            }
            if (komboFillRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
              gsap.fromTo(komboFillRef.current, { scaleX: 1 }, { scaleX: 1.12, duration: 0.16, yoyo: true, repeat: 1, ease: "back.out(1.7)" });
            }
          }
          if ((msg as { room?: DuelRoomPublic }).room) setRoom((msg as { room: DuelRoomPublic }).room);
        }
        if (t === "finish") {
          if ((msg as { room?: DuelRoomPublic }).room) setRoom((msg as { room: DuelRoomPublic }).room);
          setKombo(0);
          spawnConfetti();
        }
        if (t === "start") { setKombo(0); setTickScore(0); setSuspect(false); }
        if (t === "ping") { try { ws.send(JSON.stringify({ type: "pong" })); } catch {} }
      } catch {}
    };
  }, [me, showToast, spawnConfetti]);

  // UTM bridge: prefill code from ?code=ABCD&utm_source=duel_share
  const [duelShareHint, setDuelShareHint] = useState<string | null>(null);
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const c = sp.get("code");
      if (c) setCodeIn(c.toUpperCase().slice(0, 4));
      const src = sp.get("utm_source");
      const score = sp.get("score");
      const game = sp.get("game");
      if (src === "duel_share") {
        const parts = [`вызов ${c ? `· код ${c.toUpperCase()}` : ""}`, game ? `игра ${game}` : "", score ? `${score} очков` : ""].filter(Boolean).join(" · ");
        setDuelShareHint(parts ? `⚡ Принят вызов duel_share${parts ? ` — ${parts}` : ""} — жми Join` : "⚡ Вызов на дуэль — вводи код друга");
      }
    } catch {}
  }, []);

  useEffect(() => () => { wsRef.current?.close(); }, []);

  const createLobby = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) { showToast("Сначала войди в WS"); return; }
    wsRef.current.send(JSON.stringify({ type: "lobby:create", wager }));
  };
  const joinLobby = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const code = normalizeCode(codeIn);
    if (!code) { showToast("Код 4 символа A-Z2-9"); return; }
    wsRef.current.send(JSON.stringify({ type: "join", code }));
  };
  const readyToggle = () => wsRef.current?.send(JSON.stringify({ type: "ready" }));
  const clickDuel = () => wsRef.current?.send(JSON.stringify({ type: "click" }));
  const startDuel = () => wsRef.current?.send(JSON.stringify({ type: "start" }));

  return (
    <div ref={stageRef} style={{ position: "relative", overflow: "hidden", maxWidth: 980, margin: "0 auto", padding: "18px 14px 40px" }}>
      <h1 style={{ fontWeight: 900, fontSize: 22, letterSpacing: 0.3 }}>DUEL KOMBO 42 <span style={{ opacity: 0.6, fontWeight: 600, fontSize: 13 }}>· WS-арена 2–4 + KOMBO x4 +25% · 10с</span></h1>
      <p style={{ opacity: 0.7, fontSize: 13, marginTop: 6 }}>lobby:create→ABCD→join→ready→10с duel · KOMBO x4 &lt;0.4с +25% damage · wager 0/42/142/420 win +wager*2 +42 ELO топ-3 +1420 · CPS&gt;20 suspect throttle 30/сек heartbeat 25с · confetti 160 · GSAP y24 stagger 0.12 shake x±6 combo burst back.out(1.7)</p>
      {duelShareHint && <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 10, background: "rgba(255,204,0,0.08)", border: "1px solid rgba(255,204,0,0.18)", color: "#ffcc00", fontSize: 13, fontWeight: 700 }}>{duelShareHint}</div>}
      {toast && <div role="status" style={{ position: "fixed", left: "50%", top: 14, transform: "translateX(-50%)", background: "rgba(0,0,0,0.9)", color: "#fff", padding: "8px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.14)", zIndex: 50, fontSize: 13 }}>{toast}</div>}

      <div ref={cardsRef} style={{ display: "grid", gap: 12, marginTop: 14 }}>
        <div data-lobby-card style={{ border: "1px solid rgba(255,255,255,0.10)", borderRadius: 14, padding: 14, background: "rgba(255,255,255,0.02)" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select value={wager} onChange={e => setWager(Number(e.target.value) as Wager)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.3)", color: "#fff" }}>
              <option value={0}>wager 0</option><option value={42}>wager 42</option><option value={142}>wager 142</option><option value={420}>wager 420</option>
            </select>
            <button onClick={createLobby} disabled={!connected} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(255,204,0,0.22)", opacity: !connected ? 0.5 : 1, cursor: "pointer" }}>Создать ABCD</button>
            <input value={codeIn} onChange={e => setCodeIn(e.target.value)} placeholder="ABCD" maxLength={4} style={{ width: 90, padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.3)", color: "#fff", textTransform: "uppercase", letterSpacing: 1 }} />
            <button onClick={joinLobby} disabled={!connected} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", opacity: !connected ? 0.5 : 1, cursor: "pointer" }}>Join</button>
            {!connected ? <button onClick={connect} style={{ marginLeft: "auto", padding: "8px 14px", borderRadius: 999, background: "#ff2d55", color: "#fff", fontWeight: 800, border: "none", cursor: "pointer" }}>ВОЙТИ В ЛОББИ →</button>
              : <button onClick={() => { wsRef.current?.close(); setConnected(false); }} style={{ marginLeft: "auto", padding: "8px 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.14)", background: "transparent", color: "#fff", cursor: "pointer" }}>Выйти</button>}
          </div>
          {/* KOMBO bar */}
          <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.9 }}><span>KOMBO {kombo}/4 {kombo===0 && room?.state==="playing" ? "· жми <0.4с для x4 +25% 🔥" : kombo>0 ? `· +25% при x4!` : ""} {suspect?"· 🚫 suspect":""}</span><span>score {tickScore}</span></div>
            <div style={{ display: "flex", gap: 6 }}>
              {[1,2,3,4].map(i => <div key={i} ref={i===4?komboFillRef:undefined} style={{ flex: 1, height: 10, borderRadius: 6, background: kombo>=i ? "linear-gradient(90deg,#ff2d55,#ffd42a)" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: kombo>=i && kombo>0 ? "0 0 8px rgba(255,45,85,0.35)" : "none", transition: "all 0.12s" }} />)}
            </div>
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {connected && <button onClick={readyToggle} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(0,255,136,0.22)", background: "rgba(0,255,136,0.08)", color: "#fff", cursor: "pointer" }}>READY ✓</button>}
            {connected && room?.state === "waiting" && <button onClick={startDuel} style={{ padding: "8px 14px", borderRadius: 999, background: "#ffcc00", color: "#000", fontWeight: 800, border: "none", cursor: "pointer" }}>СТАРТ 10С</button>}
            {connected && room?.state === "playing" && <button onClick={clickDuel} style={{ padding: "12px 28px", borderRadius: 12, background: "#ff2d55", color: "#fff", fontWeight: 900, border: "none", cursor: "pointer", boxShadow: "0 0 14px rgba(255,45,85,0.35)" }}>ЖМИ! 10С ⚡ {tickScore}</button>}
            <span style={{ fontSize: 11, opacity: 0.6, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999, padding: "4px 8px" }}>{connected ? "WS ● connected" : "WS ○"} · {room ? `${room.players.length}/4 · ${room.state} ${room.wager ? `· wager ${room.wager}` : ""}` : "нет комнаты"} {suspect ? "· 🚫 suspect" : ""}</span>
          </div>
        </div>

        <div data-lobby-card style={{ border: "1px solid #222", borderRadius: 12, padding: 12, background: "rgba(0,0,0,0.2)" }}>
          {!room ? <div style={{ opacity: 0.6, fontSize: 13 }}>Создай лобби (получишь ABCD) или введи код друга → Join. Затем READY — когда все 2–4 готовы → старт 10с автоматом. KOMBO x4 &lt;0.4с = +25% damage — жми быстро 4 раза!</div>
            : <>
              <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>Комната {room.id} {room.id.startsWith("room:") ? `· код ${room.id.slice(5)}` : ""} · {room.state} · {room.players.length}/4 {room.wager ? `· wager ${room.wager}` : ""} · {room.durationSec}с</div>
              {room.players.map(p => (
                <div key={p.name} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #222", opacity: p.suspect ? 0.6 : 1 }}>
                  <span>{p.name} {p.ready ? "✓" : ""} {p.suspect ? "👻 suspect" : ""} {p.kombo ? `· kombo ${p.kombo}/4` : p.combo ? `· kombo ${p.combo}/4` : ""}</span><span style={{ fontWeight: 700 }}>{p.score.toFixed(2)}</span>
                </div>
              ))}
              {room.state === "finished" && <div style={{ marginTop: 8, color: "#7cff7c" }}>Финиш! KOMBO x4 +25% · win +wager*2 +42 ELO · magnum_duels + magnum_leaderboard(game=duel42) сезон 7дн crown топ-3 +1420 · конфетти 160 🎉</div>}
            </>}
        </div>

        <div data-lobby-card style={{ fontSize: 11, opacity: 0.55, border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 10, background: "rgba(255,255,255,0.02)" }}>
          Протокол: <code>lobby:create {"{wager}"}</code> → <code>lobby:created {"{code,room}"}</code> → <code>join {"{code:ABCD}"}</code> → <code>ready</code> → <code>start</code> → <code>click</code> → <code>tick {"{kombo,komboBurst,score}"}</code> → <code>finish</code> · KOMBO x4 &lt;0.4с +25% · throttle 30/с · heartbeat 25с ping/pong · <a href="/magnum/mining#duel" style={{ color: "#ffcc00" }}>→ /magnum/mining#duel</a> · <a href="/magnum/duel" style={{ color: "#ffcc00" }}>/magnum/duel sitemap</a>
        </div>
      </div>
    </div>
  );
}
export const DuelLobbyGame = DuelLobbyPage;
