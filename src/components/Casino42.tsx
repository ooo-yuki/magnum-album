import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import gsap from "gsap";

// ─────────────────────────────────────────────────────────────
// CASINO 42 — неоновые слоты + рулетка для клип-баттла.
// Спецэффекты: GSAP reels, glow-пульс, BIG WIN оверлей,
// конфетти, монетный дождь, шейк, флеш, синтезированный звук.
// Исходы решает сервер /magnum/api/casino/spin — клиент лишь анимирует.
// ─────────────────────────────────────────────────────────────

const CELL_H = 72;
const REEL_W = 88;
const FILL_CELLS = 18;

const SLOT_GAMES = {
  bonanza: {
    title: "БОНАНЗА",
    tag: "ШАХТА 42",
    symbols: ["💎", "⛏️", "💰", "🔥", "🧨", "7️⃣"],
    accent: "#ffb300",
    soft: "rgba(255,179,0,0.16)",
  },
  pirots2: {
    title: "PIROTS 2",
    tag: "КОСМО-ПИРАТЫ",
    symbols: ["🦜", "🏴‍☠️", "💣", "💎", "⚓", "🚀"],
    accent: "#00e5ff",
    soft: "rgba(0,229,255,0.14)",
  },
  candy: {
    title: "CANDY BANDICUT",
    tag: "СЛАДКИЙ РЕЗ",
    symbols: ["🍬", "🍭", "🍫", "🧁", "🍩", "⭐"],
    accent: "#ff4dd2",
    soft: "rgba(255,77,210,0.14)",
  },
} as const;
type SlotId = keyof typeof SLOT_GAMES;

const BETS = [10, 25, 50, 100, 250, 500];
const RED_NUMS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const ROULETTE_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

type SpinRes = {
  ok?: boolean;
  error?: string;
  balance?: number;
  tier?: "big" | "win" | "small" | "loss";
  payout?: number;
  grid?: string[][];
  lines?: number;
  pairs?: number;
  number?: number;
  color?: string;
};

type Fx = { kind: "big" | "win" | "small" | "loss"; amount: number } | null;

function randGrid(symbols: readonly string[]): string[][] {
  return [0, 1, 2].map(() => [0, 1, 2].map(() => symbols[Math.floor(Math.random() * symbols.length)]!));
}

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ── синтезатор: короткий джингл без ассетов ──
let audioCtx: AudioContext | null = null;
function tone(freq: number, at: number, dur: number, type: OscillatorType = "triangle", vol = 0.08) {
  try {
    audioCtx = audioCtx ?? new AudioContext();
    const t0 = audioCtx.currentTime + at;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  } catch { /* no audio */ }
}
const sfxWin = () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22));
const sfxBig = () => { [392, 523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, i * 0.08, 0.3, "square", 0.05)); tone(2093, 0.6, 0.5, "triangle", 0.07); };
const sfxLose = () => tone(150, 0, 0.25, "sawtooth", 0.05);
const sfxReel = () => tone(880, 0, 0.05, "square", 0.02);

export function Casino42() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const machineRef = useRef<HTMLDivElement>(null);
  const stripRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const fxLayerRef = useRef<HTMLDivElement>(null);
  const bigwinRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<SVGGElement>(null);
  const wheelMsgRef = useRef<HTMLDivElement>(null);

  const [game, setGame] = useState<SlotId | "roulette">("bonanza");
  const [bet, setBet] = useState(50);
  const [balance, setBalance] = useState<number | null>(null);
  const [me, setMe] = useState<{ id: number; username: string } | null>(null);
  const [grid, setGrid] = useState<string[][]>(() => randGrid(SLOT_GAMES.bonanza.symbols));
  const [spinning, setSpinning] = useState(false);
  const [fx, setFx] = useState<Fx>(null);
  const [msg, setMsg] = useState("");
  const [lastSpin, setLastSpin] = useState<SpinRes | null>(null);

  // рулетка
  const [betKind, setBetKind] = useState<"red" | "black" | "number">("red");
  const [betValue, setBetValue] = useState(7);
  const [wheelResult, setWheelResult] = useState<{ n: number; color: string } | null>(null);

  const def = game !== "roulette" ? SLOT_GAMES[game] : null;

  useEffect(() => {
    fetch("/magnum/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setMe(j?.user ?? null))
      .catch(() => {});
  }, []);

  const loadBalance = useCallback(() => {
    fetch("/magnum/api/casino/status", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (typeof j?.balance === "number") setBalance(j.balance); })
      .catch(() => {});
  }, []);

  useEffect(() => { loadBalance(); }, [loadBalance]);

  // смена слота — новая случайная сетка + сброс эффектов
  useEffect(() => {
    gsap.killTweensOf("*");
    if (game !== "roulette") {
      setGrid(randGrid(SLOT_GAMES[game].symbols));
      setLastSpin(null);
      setWheelResult(null);
      stripRefs.current.forEach((s) => { if (s) gsap.set(s, { y: 0 }); });
    }
  }, [game]);

  // ── конфетти + монетный дождь ──
  const burst = useCallback((count: number, coins: number) => {
    const layer = fxLayerRef.current;
    if (!layer || reduced()) return;
    const colors = ["#ffd700", "#ff2d55", "#00ff88", "#00e5ff", "#ff4dd2", "#ffffff"];
    for (let i = 0; i < count; i++) {
      const d = document.createElement("div");
      const sz = 5 + Math.random() * 7;
      d.style.cssText = `position:absolute;left:50%;top:38%;width:${sz}px;height:${sz * (Math.random() < 0.5 ? 1 : 0.5)}px;border-radius:${Math.random() < 0.4 ? "50%" : "2px"};background:${colors[i % colors.length]};pointer-events:none;z-index:60;`;
      layer.appendChild(d);
      const ang = Math.random() * Math.PI * 2;
      const dist = 90 + Math.random() * 260;
      gsap.to(d, {
        x: Math.cos(ang) * dist,
        y: Math.sin(ang) * dist + 160 + Math.random() * 120,
        rotation: Math.random() * 900 - 450,
        opacity: 0,
        duration: 1.1 + Math.random() * 0.9,
        ease: "power2.out",
        onComplete: () => d.remove(),
      });
    }
    for (let i = 0; i < coins; i++) {
      const c = document.createElement("div");
      c.textContent = "🪙";
      c.style.cssText = `position:absolute;left:${8 + Math.random() * 84}%;top:-40px;font-size:${20 + Math.random() * 18}px;pointer-events:none;z-index:61;filter:drop-shadow(0 0 6px #ffd700);`;
      layer.appendChild(c);
      gsap.to(c, {
        y: layer.clientHeight + 80,
        x: (Math.random() - 0.5) * 120,
        rotation: Math.random() * 720 - 360,
        duration: 1.4 + Math.random() * 1.2,
        delay: Math.random() * 0.5,
        ease: "power1.in",
        onComplete: () => c.remove(),
      });
    }
  }, []);

  // ── оверлей выигрыша: BIG WIN / WIN / МИМО ──
  useLayoutEffect(() => {
    if (!fx || !bigwinRef.current || !sectionRef.current) return;
    const el = bigwinRef.current;
    const flash = flashRef.current;
    const machine = machineRef.current;
    const tl = gsap.timeline({ onComplete: () => setFx(null) });
    if (reduced()) {
      tl.set(el, { opacity: 1 }).to(el, { opacity: 0, delay: 1.2 });
      return;
    }
    if (fx.kind === "loss") {
      tl.fromTo(el, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.25 })
        .to(el, { opacity: 0, y: -14, duration: 0.5, delay: 0.7 });
      return;
    }
    // флеш-бах
    if (flash) tl.fromTo(flash, { opacity: fx.kind === "big" ? 0.85 : 0.45 }, { opacity: 0, duration: 0.45, ease: "power2.out" });
    // текст вылетает
    tl.fromTo(el,
      { scale: 0, rotation: -14, opacity: 0 },
      { scale: fx.kind === "big" ? 1.18 : 1, rotation: 0, opacity: 1, duration: fx.kind === "big" ? 1 : 0.55, ease: "elastic.out(1,0.45)" });
    // пульс
    tl.to(el, { scale: fx.kind === "big" ? 1.06 : 1.12, duration: 0.28, yoyo: true, repeat: fx.kind === "big" ? 5 : 3, ease: "power1.inOut" });
    // шейк машины
    if (machine && fx.kind === "big") {
      tl.fromTo(machine, { x: -7 }, { x: 7, duration: 0.05, yoyo: true, repeat: 11, ease: "none" }, 0.1)
        .to(machine, { x: 0, duration: 0.1 }, ">-0.05");
    }
    // конфетти
    burst(fx.kind === "big" ? 150 : 60, fx.kind === "big" ? 30 : 10);
    // уход
    tl.to(el, { opacity: 0, scale: 0.7, y: -30, duration: 0.4, delay: fx.kind === "big" ? 0.6 : 0.3 });
  }, [fx, burst]);

  // ── анимация барабанов ──
  const animateReels = useCallback((finalGrid: string[][], symbols: readonly string[], onDone: () => void) => {
    if (reduced()) { onDone(); return; }
    const tl = gsap.timeline({ onComplete: onDone });
    stripRefs.current.forEach((strip, i) => {
      if (!strip) return;
      // вставляем FILL_CELLS случайных ячеек ПОД финальные 3
      for (let k = 0; k < FILL_CELLS; k++) {
        const cell = document.createElement("div");
        cell.textContent = symbols[Math.floor(Math.random() * symbols.length)]!;
        cell.style.cssText = `height:${CELL_H}px;display:flex;align-items:center;justify-content:center;font-size:38px;`;
        strip.prepend(cell);
      }
      gsap.set(strip, { y: 0, filter: "blur(0px)" });
      const dur = 1.35 + i * 0.5;
      tl.to(strip, { y: -FILL_CELLS * CELL_H, duration: dur, ease: "power4.out" }, i * 0.14);
      tl.to(strip, { filter: "blur(3px)", duration: dur * 0.35, ease: "power1.in" }, i * 0.14)
        .to(strip, { filter: "blur(0px)", duration: dur * 0.3, ease: "power1.out" }, i * 0.14 + dur * 0.6)
        .call(sfxReel, [], i * 0.14 + dur - 0.1);
      tl.call(() => {
        // чистим filler после остановки
        while (strip.children.length > 3) strip.removeChild(strip.firstChild!);
        gsap.set(strip, { y: 0 });
      }, [], i * 0.14 + dur + 0.05);
    });
  }, []);

  // ── флеш совпавших линий ──
  const flashLines = useCallback((lines: number) => {
    const layer = fxLayerRef.current;
    if (!layer || reduced()) return;
    for (let r = 0; r < 3; r++) {
      const on = lines >= 3 || r < lines;
      if (!on) continue;
      const line = document.createElement("div");
      line.style.cssText = `position:absolute;left:6px;right:6px;top:${12 + r * CELL_H + CELL_H / 2}px;height:4px;border-radius:4px;background:linear-gradient(90deg,transparent,#ffd700,#fff,#ffd700,transparent);box-shadow:0 0 14px #ffd700,0 0 30px #ffaa00;pointer-events:none;z-index:50;`;
      layer.appendChild(line);
      gsap.fromTo(line, { opacity: 0, scaleX: 0.2 }, { opacity: 1, scaleX: 1, duration: 0.25, yoyo: true, repeat: 5, ease: "power1.inOut", onComplete: () => line.remove() });
    }
  }, []);

  // ── СПИН слота ──
  async function doSpin() {
    if (spinning) return;
    if (!me) { setMsg("Войди, чтобы крутить"); return; }
    if (balance !== null && balance < bet) { setMsg("Не хватает монеток — мини-игры / стрик"); return; }
    setSpinning(true);
    setMsg("");
    try {
      const r = await fetch("/magnum/api/casino/spin", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game, bet }),
      });
      const j = (await r.json()) as SpinRes;
      if (!r.ok) {
        setMsg(j.error || "Ошибка спина");
        if (typeof j.balance === "number") setBalance(j.balance);
        setSpinning(false);
        return;
      }
      const finalGrid = j.grid ?? randGrid(def?.symbols ?? ["❓"]);
      animateReels(finalGrid, def?.symbols ?? ["❓"], () => {
        setGrid(finalGrid);
        setLastSpin(j);
        if (typeof j.balance === "number") setBalance(j.balance);
        const payout = j.payout ?? 0;
        const tier = j.tier ?? "loss";
        if (tier === "big") { sfxBig(); setFx({ kind: "big", amount: payout }); }
        else if (tier === "win") { sfxWin(); setFx({ kind: "win", amount: payout }); flashLines(j.lines ?? 1); }
        else if (tier === "small") { sfxWin(); setFx({ kind: "small", amount: payout }); flashLines(j.lines ?? 0); flashLinesSmall(); }
        else { sfxLose(); setFx({ kind: "loss", amount: 0 }); }
        setMsg(payout > 0 ? `+${payout} на баланс` : "Мимо — крути ещё, братуха");
        setSpinning(false);
      });
    } catch {
      setMsg("Сеть");
      setSpinning(false);
    }
  }

  // маленькая надпись для пары
  function flashLinesSmall() {
    const layer = fxLayerRef.current;
    if (!layer || reduced()) return;
    const t = document.createElement("div");
    t.textContent = "ПАРА!";
    t.style.cssText = "position:absolute;left:50%;top:8px;transform:translateX(-50%);font-weight:900;font-size:15px;color:#ffd700;text-shadow:0 0 12px #ffd700;pointer-events:none;z-index:55;";
    layer.appendChild(t);
    gsap.fromTo(t, { opacity: 0, scale: 0.5, y: 8 }, { opacity: 1, scale: 1, y: 0, duration: 0.3, yoyo: true, repeat: 3, ease: "back.out(2)", onComplete: () => t.remove() });
  }

  // ── РУЛЕТКА ──
  const sectorOf = (n: number) => ROULETTE_ORDER.indexOf(n);

  async function doRoulette() {
    if (spinning) return;
    if (!me) { setMsg("Войди, чтобы ставить"); return; }
    if (balance !== null && balance < bet) { setMsg("Не хватает монеток"); return; }
    if (betKind === "number" && (betValue < 0 || betValue > 36)) { setMsg("Число 0..36"); return; }
    setSpinning(true);
    setMsg("");
    try {
      const r = await fetch("/magnum/api/casino/spin", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: "roulette", bet, betKind, betValue }),
      });
      const j = (await r.json()) as SpinRes;
      if (!r.ok) {
        setMsg(j.error || "Ошибка ставки");
        if (typeof j.balance === "number") setBalance(j.balance);
        setSpinning(false);
        return;
      }
      const n = j.number ?? 0;
      const color = j.color ?? "green";
      setLastSpin(j);
      const land = () => {
        setWheelResult({ n, color });
        if (typeof j.balance === "number") setBalance(j.balance);
        const payout = j.payout ?? 0;
        const tier = j.tier ?? "loss";
        if (tier === "big") { sfxBig(); setFx({ kind: "big", amount: payout }); }
        else if (tier === "win") { sfxWin(); setFx({ kind: "win", amount: payout }); }
        else { sfxLose(); setFx({ kind: "loss", amount: 0 }); }
        setMsg(payout > 0 ? `Выпало ${n} ${color === "red" ? "🔴" : color === "black" ? "⚫" : "🟢"} • +${payout}` : `Выпало ${n} — мимо`);
        if (wheelMsgRef.current && !reduced()) gsap.fromTo(wheelMsgRef.current, { scale: 0.4 }, { scale: 1, duration: 0.6, ease: "elastic.out(1,0.4)" });
        setSpinning(false);
      };
      if (reduced() || !ballRef.current) { land(); return; }
      const step = 360 / 37;
      const center = sectorOf(n) * step + step / 2;
      const target = center + 360 * 6;
      gsap.to(ballRef.current, {
        rotation: target,
        svgOrigin: "150 150",
        duration: 4.2,
        ease: "power4.out",
        onComplete: land,
      });
    } catch {
      setMsg("Сеть");
      setSpinning(false);
    }
  }

  const wheelSectors = useMemo(() => {
    const R = 142, r0 = 58, cx = 150, cy = 150;
    return ROULETTE_ORDER.map((num, i) => {
      const a0 = (i * 360) / 37 - 90;
      const a1 = ((i + 1) * 360) / 37 - 90;
      const rad = (a: number) => [(cx + R * Math.cos((a * Math.PI) / 180)).toFixed(2), (cy + R * Math.sin((a * Math.PI) / 180)).toFixed(2)];
      const [x0, y0] = rad(a0);
      const [x1, y1] = rad(a1);
      const [xi0, yi0] = rad(a0 + 0.9);
      const [xi1, yi1] = rad(a1 - 0.9);
      const fill = num === 0 ? "#0aa06e" : RED_NUMS.has(num) ? "#c1122f" : "#141419";
      const mid = (a0 + a1) / 2;
      const [tx, ty] = [(cx + 96 * Math.cos((mid * Math.PI) / 180)).toFixed(2), (cy + 96 * Math.sin((mid * Math.PI) / 180)).toFixed(2)];
      return { num, i, d: `M${xi0} ${yi0} L${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1} L${xi1} ${yi1} A${r0} ${r0} 0 0 0 ${xi0} ${yi0} Z`, fill, tx, ty, rot: mid + 90 };
    });
  }, []);

  const css = `
.c42-frame{position:relative;border-radius:20px;border:2px solid var(--c42-acc,#ffb300);
  box-shadow:0 0 18px var(--c42-glow,rgba(255,179,0,.5)),0 0 46px var(--c42-glow2,rgba(255,179,0,.22)),inset 0 0 26px rgba(0,0,0,.65);
  animation:c42Pulse 2.2s ease-in-out infinite alternate;}
@keyframes c42Pulse{
  from{box-shadow:0 0 14px var(--c42-glow,rgba(255,179,0,.4)),0 0 30px var(--c42-glow2,rgba(255,179,0,.15)),inset 0 0 26px rgba(0,0,0,.65)}
  to{box-shadow:0 0 30px var(--c42-glow,rgba(255,179,0,.75)),0 0 80px var(--c42-glow2,rgba(255,179,0,.35)),inset 0 0 26px rgba(0,0,0,.65)}}
.c42-title{font-weight:900;letter-spacing:.06em;color:#fff;
  text-shadow:0 0 8px var(--c42-acc,#ffb300),0 0 22px var(--c42-acc,#ffb300),0 0 60px var(--c42-acc,#ffb300);
  animation:c42Flicker 3.5s linear infinite;}
@keyframes c42Flicker{0%,100%{opacity:1}92%{opacity:1}93%{opacity:.55}94%{opacity:1}96%{opacity:.7}97%{opacity:1}}
.c42-reelwin{position:relative;border-radius:12px;overflow:hidden;height:${CELL_H * 3}px;width:${REEL_W}px;
  background:linear-gradient(180deg,rgba(0,0,0,.85),rgba(20,20,26,.9) 18%,rgba(20,20,26,.9) 82%,rgba(0,0,0,.85));
  border:1px solid rgba(255,255,255,.12);box-shadow:inset 0 8px 14px rgba(0,0,0,.7),inset 0 -8px 14px rgba(0,0,0,.7);}
.c42-cell{display:flex;align-items:center;justify-content:center;height:${CELL_H}px;font-size:38px;
  text-shadow:0 0 12px rgba(255,255,255,.35);will-change:transform;}
.c42-bigwin{font-weight:900;font-size:clamp(56px,13vw,130px);line-height:1;letter-spacing:.02em;white-space:nowrap;
  background:linear-gradient(180deg,#fff8d6 0%,#ffd700 35%,#ff8a00 60%,#ffd700 85%,#fff8d6 100%);
  background-size:100% 220%;-webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 0 18px #ffb300) drop-shadow(0 0 60px rgba(255,140,0,.65));
  animation:c42Shine 1.4s linear infinite;}
@keyframes c42Shine{to{background-position:0 220%}}
.c42-btn{cursor:pointer;font-weight:900;border-radius:12px;transition:transform .12s ease, box-shadow .12s ease;}
.c42-btn:hover{transform:translateY(-2px);}
.c42-btn:disabled{cursor:not-allowed;transform:none;opacity:.45;}
.c42-chip{padding:7px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.05);color:#fff;font-weight:800;font-size:12px;cursor:pointer;}
.c42-chip.on{border-color:#ffd700;background:rgba(255,215,0,.16);color:#ffd700;box-shadow:0 0 12px rgba(255,215,0,.35);}
.c42-tab{padding:8px 13px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#fff;font-weight:800;font-size:12px;cursor:pointer;white-space:nowrap;}
.c42-tab.on{border-color:var(--tab-acc,#ffb300);color:var(--tab-acc,#ffb300);background:rgba(255,255,255,.07);box-shadow:0 0 14px var(--tab-glow,rgba(255,179,0,.35));}
@media (prefers-reduced-motion: reduce){
  .c42-frame,.c42-title,.c42-bigwin{animation:none;}
}
`;

  const accent = def?.accent ?? "#ffd700";

  return (
    <div ref={sectionRef} style={{ marginTop: 34, position: "relative" }}>
      <style>{css}</style>

      {/* заголовок раздела */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h2 className="c42-title" style={{ fontSize: 26, color: "#fff", ["--c42-acc" as string]: "#ff2d55" }}>
          🎰 КАЗИНО 42
        </h2>
        <span style={{ opacity: 0.6, fontSize: 12 }}>клип-баттл разборки на монетки • RTP ~92% • исход решает сервер</span>
        <span style={{ marginLeft: "auto", fontWeight: 900, fontSize: 14, color: "#ffd700", textShadow: "0 0 12px rgba(255,215,0,.5)" }}>
          🪙 {balance === null ? "…" : balance.toLocaleString("ru-RU")}
        </span>
      </div>

      {/* выбор игры */}
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        {(Object.keys(SLOT_GAMES) as SlotId[]).map((id) => (
          <button key={id} className={`c42-tab${game === id ? " on" : ""}`}
            style={{ ["--tab-acc" as string]: SLOT_GAMES[id].accent, ["--tab-glow" as string]: SLOT_GAMES[id].soft }}
            onClick={() => setGame(id)}>
            {SLOT_GAMES[id].title}
          </button>
        ))}
        <button className={`c42-tab${game === "roulette" ? " on" : ""}`}
          style={{ ["--tab-acc" as string]: "#00ff88", ["--tab-glow" as string]: "rgba(0,255,136,.3)" }}
          onClick={() => setGame("roulette")}>
          РУЛЕТКА
        </button>
      </div>

      {/* ══════════ СЛОТЫ ══════════ */}
      {def && (
        <div className="c42-frame" style={{ marginTop: 14, padding: 18, ["--c42-acc" as string]: accent, ["--c42-glow" as string]: `${accent}88`, ["--c42-glow2" as string]: `${accent}44` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
            <div style={{ fontWeight: 900, fontSize: 17, letterSpacing: "0.05em", color: accent, textShadow: `0 0 14px ${accent}` }}>
              {def.title}
            </div>
            <div style={{ fontSize: 11, opacity: 0.55, fontWeight: 700 }}>{def.tag} • 3 ЛИНИИ • ТРИО ×8 • FULL ×25</div>
          </div>

          <div ref={machineRef} style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
            <div style={{ position: "relative", display: "flex", gap: 8, padding: 10, borderRadius: 16, background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {/* fx-слой поверх барабанов */}
              <div ref={fxLayerRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 40, overflow: "hidden", borderRadius: 16 }} />
              {[0, 1, 2].map((i) => (
                <div key={i} className="c42-reelwin">
                  <div ref={(el) => { stripRefs.current[i] = el; }} style={{ willChange: "transform" }}>
                    {(grid[i] ?? ["❓", "❓", "❓"]).map((sym, r) => (
                      <div key={r} className="c42-cell">{sym}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ставка + спин */}
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
            {BETS.map((b) => (
              <button key={b} className={`c42-chip${bet === b ? " on" : ""}`} onClick={() => setBet(b)}>🪙{b}</button>
            ))}
            <button
              className="c42-btn"
              onClick={doSpin}
              disabled={spinning}
              style={{
                marginLeft: "auto", padding: "12px 30px", fontSize: 15, letterSpacing: "0.08em",
                color: "#0a0a0a", border: "none",
                background: `linear-gradient(135deg,#fff 0%,${accent} 45%,#ff8a00 100%)`,
                boxShadow: spinning ? "none" : `0 0 18px ${accent}aa,0 4px 0 #7a4a00`,
              }}>
              {spinning ? "КРУТИТСЯ…" : "СПИН 🔥"}
            </button>
          </div>
          {lastSpin?.tier && !spinning && (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
              прошлый спин: {(lastSpin.payout ?? 0) > 0 ? `+${lastSpin.payout}` : "0"} • линий {lastSpin.lines ?? 0} • пар {lastSpin.pairs ?? 0}
            </div>
          )}
        </div>
      )}

      {/* ══════════ РУЛЕТКА ══════════ */}
      {game === "roulette" && (
        <div className="c42-frame" style={{ marginTop: 14, padding: 18, ["--c42-acc" as string]: "#00ff88", ["--c42-glow" as string]: "rgba(0,255,136,.5)", ["--c42-glow2" as string]: "rgba(0,255,136,.2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
            <div style={{ fontWeight: 900, fontSize: 17, letterSpacing: "0.05em", color: "#00ff88", textShadow: "0 0 14px #00ff88" }}>
              РУЛЕТКА 42
            </div>
            <div style={{ fontSize: 11, opacity: 0.55, fontWeight: 700 }}>КРАСНОЕ/ЧЁРНОЕ ×2 • НА ЧИСЛО ×36 • ЗЕРО ЖРЁТ ОБЕ</div>
          </div>

          <div style={{ display: "flex", gap: 20, marginTop: 14, flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "relative", width: 300, height: 300, flexShrink: 0 }}>
              <svg width="300" height="300" viewBox="0 0 300 300" style={{ filter: "drop-shadow(0 0 22px rgba(0,255,136,.35))" }}>
                {wheelSectors.map((s) => (
                  <g key={s.i}>
                    <path d={s.d} fill={s.fill} stroke="rgba(255,255,255,0.25)" strokeWidth="0.6" />
                    <text x={s.tx} y={s.ty} fill="#fff" fontSize="10" fontWeight="800" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${s.rot} ${s.tx} ${s.ty})`}>
                      {s.num}
                    </text>
                  </g>
                ))}
                <circle cx="150" cy="150" r="56" fill="#0d0d12" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
                <text x="150" y="146" textAnchor="middle" fill="#ffd700" fontSize="17" fontWeight="900">42</text>
                <text x="150" y="164" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="9" fontWeight="700">MAGNUM</text>
                {/* маркер справа */}
                <polygon points="298,150 282,142 282,158" fill="#ffd700" style={{ filter: "drop-shadow(0 0 6px #ffd700)" }} />
                {/* шар */}
                <g ref={ballRef}>
                  <circle cx="150" cy="42" r="7" fill="#fff" style={{ filter: "drop-shadow(0 0 8px #fff)" }} />
                </g>
              </svg>
              {wheelResult && (
                <div ref={wheelMsgRef} style={{
                  position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)",
                  width: 74, height: 74, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 30, fontWeight: 900, color: "#fff",
                  background: wheelResult.color === "red" ? "#c1122f" : wheelResult.color === "black" ? "#141419" : "#0aa06e",
                  border: "2px solid rgba(255,255,255,0.5)",
                  boxShadow: `0 0 26px ${wheelResult.color === "red" ? "#ff2d55" : wheelResult.color === "black" ? "#888" : "#00ff88"}`,
                }}>
                  {wheelResult.n}
                </div>
              )}
            </div>

            <div style={{ flex: "1 1 240px", minWidth: 220 }}>
              <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7, marginBottom: 8 }}>ТИП СТАВКИ</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className={`c42-chip${betKind === "red" ? " on" : ""}`} style={betKind === "red" ? { borderColor: "#ff2d55", color: "#ff2d55", background: "rgba(255,45,85,.14)", boxShadow: "0 0 12px rgba(255,45,85,.3)" } : {}} onClick={() => setBetKind("red")}>🔴 КРАСНОЕ ×2</button>
                <button className={`c42-chip${betKind === "black" ? " on" : ""}`} style={betKind === "black" ? { borderColor: "#aaa", color: "#fff", background: "rgba(255,255,255,.12)", boxShadow: "0 0 12px rgba(255,255,255,.25)" } : {}} onClick={() => setBetKind("black")}>⚫ ЧЁРНОЕ ×2</button>
                <button className={`c42-chip${betKind === "number" ? " on" : ""}`} onClick={() => setBetKind("number")}>🎯 НА ЧИСЛО ×36</button>
              </div>

              {betKind === "number" && (
                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(13,1fr)", gap: 4 }}>
                  {Array.from({ length: 37 }, (_, n) => (
                    <button key={n} onClick={() => setBetValue(n)}
                      style={{
                        padding: "5px 0", borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: "pointer",
                        border: betValue === n ? "1px solid #ffd700" : "1px solid rgba(255,255,255,0.12)",
                        background: betValue === n ? "rgba(255,215,0,0.2)" : n === 0 ? "rgba(10,160,110,0.3)" : RED_NUMS.has(n) ? "rgba(193,18,47,0.35)" : "rgba(20,20,25,0.9)",
                        color: "#fff",
                        boxShadow: betValue === n ? "0 0 10px rgba(255,215,0,0.4)" : "none",
                      }}>
                      {n}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
                {BETS.map((b) => (
                  <button key={b} className={`c42-chip${bet === b ? " on" : ""}`} onClick={() => setBet(b)}>🪙{b}</button>
                ))}
              </div>
              <button
                className="c42-btn"
                onClick={doRoulette}
                disabled={spinning}
                style={{
                  marginTop: 12, width: "100%", padding: "13px 0", fontSize: 15, letterSpacing: "0.08em",
                  color: "#04120a", border: "none",
                  background: "linear-gradient(135deg,#fff 0%,#00ff88 45%,#00b864 100%)",
                  boxShadow: spinning ? "none" : "0 0 18px rgba(0,255,136,.6),0 4px 0 #045c31",
                }}>
                {spinning ? "ШАРИК КРУТИТСЯ…" : `СТАВКА ${betKind === "number" ? "НА " + betValue : betKind === "red" ? "КРАСНОЕ" : "ЧЁРНОЕ"} 🎲`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* флеш-бах */}
      <div ref={flashRef} style={{ position: "absolute", inset: 0, background: "#fff", opacity: 0, pointerEvents: "none", zIndex: 70, borderRadius: 20 }} />

      {/* BIG WIN / WIN / МИМО оверлей */}
      {fx && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 65 }}>
          {fx.kind === "loss" ? (
            <div ref={bigwinRef} style={{ fontWeight: 900, fontSize: 34, color: "rgba(255,255,255,0.55)", letterSpacing: "0.2em" }}>МИМО</div>
          ) : (
            <div style={{ textAlign: "center" }}>
              <div ref={bigwinRef} className="c42-bigwin">
                {fx.kind === "big" ? "BIG WIN" : "WIN"}
              </div>
              <div style={{ fontWeight: 900, fontSize: fx.kind === "big" ? 30 : 22, color: "#ffd700", textShadow: "0 0 18px rgba(255,215,0,.8)", marginTop: 4 }}>
                +{fx.amount.toLocaleString("ru-RU")} 🪙
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 12, color: "#ffcc00", minHeight: 16 }}>
        {msg}
        {!me && <span style={{ opacity: 0.7 }}> • войди, чтобы ставить монетки</span>}
      </div>
    </div>
  );
}
