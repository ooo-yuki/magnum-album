import { useRef, useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import styles from "./RhythmGame.module.css";

//Obscura-заглушка AudioParam: прямые вызовы ramp-методов могут кинуть — оборачиваем
function safeRamp(param: AudioParam, fn: () => void, fallbackValue: number) {
  try { fn(); } catch { param.value = fallbackValue; }
}


const PRESAVE = "https://music.thefence.me/psmagnum";
const WIN_SCORE = 5000;
const LANE_COUNT = 4;
const LANE_KEYS = ["KeyD", "KeyF", "KeyJ", "KeyK"] as const;
const LANE_LABELS = ["D", "F", "J", "K"];
const LANE_COLORS = ["#ff2d55", "#ffcc00", "#00ff88", "#5865f2"];
const LANE_EMOJI = ["🪼", "🧥", "🕶️", "42"];
const HIT_Y_RATIO = 0.85;

// timing windows in ms (converted to pixels via speed)
const PERFECT_WINDOW = 70;
const GOOD_WINDOW = 140;
const NOTE_SPEED = 380; // px per second

type Judgement = "perfect" | "good" | "miss" | null;
interface Note {
  id: number;
  lane: number;
  y: number; // current y position
  hitTime: number; // expected hit time (ms since start)
  judged: boolean;
  judgement: Judgement;
}
interface HitEffect {
  lane: number;
  text: string;
  color: string;
  life: number;
  scale: number;
}
interface LaneFlash {
  lane: number;
  alpha: number;
}
interface Song {
  name: string;
  bpm: number;
  duration: number;
  patternSeed: number;
}
const SONGS: Song[] = [
  { name: "ТУСА МЕДУЗА", bpm: 128, duration: 45, patternSeed: 42 },
  { name: "VPN", bpm: 142, duration: 40, patternSeed: 7 },
  { name: "MAGNUM — Intro", bpm: 100, duration: 50, patternSeed: 99 },
];

let noteId = 0;
function genChart(song: Song, totalNotes = 64): { time: number; lane: number }[] {
  const beatMs = 60000 / song.bpm;
  const chart: { time: number; lane: number }[] = [];
  // deterministic seeded random
  let seed = song.patternSeed;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
  for (let i = 0; i < totalNotes; i++) {
    // every 1 or 0.5 beat, with variation
    const beatOffset = i * (rnd() > 0.35 ? 1 : 0.5);
    const time = 1200 + beatOffset * beatMs + rnd() * 80; // start after 1.2s intro
    const lane = Math.floor(rnd() * LANE_COUNT);
    // avoid 3 same lane in row
    if (chart.length >= 2 && chart[chart.length - 1]!.lane === lane && chart[chart.length - 2]!.lane === lane) {
      chart.push({ time, lane: (lane + 1) % LANE_COUNT });
    } else {
      chart.push({ time, lane });
    }
    // occasionally double note (chord)
    if (rnd() > 0.88 && i > 4) {
      const other = (lane + 1 + Math.floor(rnd() * 2)) % LANE_COUNT;
      chart.push({ time: time + 12, lane: other });
    }
  }
  chart.sort((a, b) => a.time - b.time);
  return chart;
}

// WebAudio hits
let ac: AudioContext | null = null;
function ensureAC() {
  if (!ac) {
    try { ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { return null; }
  }
  if (ac.state === "suspended") void ac.resume();
  return ac;
}
function playHit(j: Judgement) {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  if (j === "perfect") { o.type = "sine"; o.frequency.value = 880; safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(1320, ctx.currentTime + 0.08), 1320); g.gain.setValueAtTime(0.22, ctx.currentTime); safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22), 0.001); }
  else if (j === "good") { o.type = "triangle"; o.frequency.value = 550; safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(700, ctx.currentTime + 0.06), 700); g.gain.setValueAtTime(0.16, ctx.currentTime); safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16), 0.001); }
  else { o.type = "square"; o.frequency.value = 180; g.gain.setValueAtTime(0.12, ctx.currentTime); safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18), 0.001); }
  o.start(); o.stop(ctx.currentTime + 0.25);
}
function playKeyTap(lane: number) {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sine"; o.frequency.value = 220 + lane * 80;
  g.gain.setValueAtTime(0.08, ctx.currentTime); safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.10), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.10);
}

export function RhythmGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [songIdx, setSongIdx] = useState(0);
  const [state, setState] = useState<"menu" | "playing" | "win" | "fail">("menu");
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [judgement, setJudgement] = useState<Judgement>(null);
  const [accuracy, setAccuracy] = useState(100);

  const statsRef = useRef({ score: 0, combo: 0, maxCombo: 0, perfect: 0, good: 0, miss: 0, total: 0 });
  const notesRef = useRef<Note[]>([]);
  const chartRef = useRef<{ time: number; lane: number }[]>([]);
  const effectsRef = useRef<HitEffect[]>([]);
  const flashesRef = useRef<LaneFlash[]>([]);
  const keysDownRef = useRef<boolean[]>([false, false, false, false]);
  const startTimeRef = useRef(0);
  const pressedRef = useRef<boolean[]>([false, false, false, false]);
  const animRef = useRef(0);
  const canvasSizeRef = useRef({ w: 600, h: 560 });

  const hitNote = useCallback((lane: number, nowMs: number) => {
    const notes = notesRef.current;
    // find closest unjudged note in lane within window
    let best: Note | null = null;
    let bestDiff = Infinity;
    for (const n of notes) {
      if (n.judged || n.lane !== lane) continue;
      const diff = Math.abs(nowMs - n.hitTime);
      if (diff < bestDiff && diff <= GOOD_WINDOW) { bestDiff = diff; best = n; }
    }
    if (!best) {
      // empty tap - small miss flash but not counting as miss
      playKeyTap(lane);
      flashesRef.current.push({ lane, alpha: 0.35 });
      return;
    }
    let j: Judgement;
    if (bestDiff <= PERFECT_WINDOW) j = "perfect";
    else j = "good";
    best.judged = true;
    best.judgement = j;
    const s = statsRef.current;
    s.total++;
    if (j === "perfect") { s.perfect++; s.score += 100 + Math.min(s.combo * 4, 80); }
    else { s.good++; s.score += 55 + Math.min(s.combo * 2, 40); }
    s.combo++; s.maxCombo = Math.max(s.maxCombo, s.combo);
    setScore(s.score); setCombo(s.combo); setMaxCombo(s.maxCombo);
    setJudgement(j); setTimeout(() => setJudgement((prev) => prev === j ? null : prev), 280);
    setAccuracy(Math.round(((s.perfect * 1 + s.good * 0.6) / Math.max(1, s.total)) * 100));
    effectsRef.current.push({ lane, text: j === "perfect" ? "PERFECT!" : "GOOD!", color: j === "perfect" ? "#ffcc00" : "#00ff88", life: 1, scale: 1 });
    flashesRef.current.push({ lane, alpha: 1 });
    playHit(j);
    // hide note visually soon
    setTimeout(() => { best.y = -9999; }, 120);
  }, []);

  const startGame = useCallback((idx: number) => {
    const song = SONGS[idx]!;
    const chart = genChart(song, 72);
    chartRef.current = chart;
    noteId = 0;
    notesRef.current = chart.map((c) => ({ id: noteId++, lane: c.lane, y: -80 - (c.time / 1000) * NOTE_SPEED + 1200 * (NOTE_SPEED / 380), hitTime: c.time, judged: false, judgement: null }));
    // recompute y based on speed: y = hitY - (hitTime - now)*speed/1000
    // We'll update y each frame instead; just init offscreen
    for (const n of notesRef.current) n.y = -200;
    statsRef.current = { score: 0, combo: 0, maxCombo: 0, perfect: 0, good: 0, miss: 0, total: 0 };
    setScore(0); setCombo(0); setMaxCombo(0); setAccuracy(100); setJudgement(null);
    effectsRef.current = []; flashesRef.current = [];
    startTimeRef.current = performance.now();
    setSongIdx(idx);
    setState("playing");
  }, []);

  // input handling
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const lane = LANE_KEYS.indexOf(e.code as typeof LANE_KEYS[number]);
      if (lane === -1) return;
      if (keysDownRef.current[lane]) return;
      keysDownRef.current[lane] = true;
      pressedRef.current[lane] = true;
      setTimeout(() => { pressedRef.current[lane] = false; }, 120);
      if (state === "playing") {
        const now = performance.now() - startTimeRef.current;
        hitNote(lane, now);
      }
      e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const lane = LANE_KEYS.indexOf(e.code as typeof LANE_KEYS[number]);
      if (lane !== -1) keysDownRef.current[lane] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  }, [state, hitNote]);

  // canvas loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let lastW = 0;
    const resize = () => {
      const parentW = canvas.parentElement?.clientWidth || 600;
      const w = Math.min(parentW, 560);
      canvas.width = w * (window.devicePixelRatio || 1);
      canvas.height = 560 * (window.devicePixelRatio || 1);
      canvas.style.width = w + "px";
      canvas.style.height = "560px";
      ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
      canvasSizeRef.current = { w, h: 560 };
      lastW = w;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const { w, h } = canvasSizeRef.current;
      const laneW = w / LANE_COUNT;
      const hitY = h * HIT_Y_RATIO;
      ctx.clearRect(0, 0, w, h);

      // bg gradient
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#08081a"); bg.addColorStop(0.5, "#12082e"); bg.addColorStop(1, "#1a0a2e");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      // subtle grid
      ctx.strokeStyle = "rgba(255,255,255,0.04)"; ctx.lineWidth = 1;
      for (let i = 1; i < LANE_COUNT; i++) { ctx.beginPath(); ctx.moveTo(i * laneW, 0); ctx.lineTo(i * laneW, h); ctx.stroke(); }
      // horizontal scanlines
      ctx.strokeStyle = "rgba(255,255,255,0.02)";
      for (let y = 0; y < h; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

      // lane flashes
      flashesRef.current = flashesRef.current.filter((f) => f.alpha > 0.01);
      for (const f of flashesRef.current) {
        f.alpha *= 0.88;
        ctx.fillStyle = LANE_COLORS[f.lane] + Math.round(f.alpha * 120).toString(16).padStart(2, "0");
        ctx.fillRect(f.lane * laneW + 1, 0, laneW - 2, h);
      }

      // pressed lane glow
      for (let i = 0; i < LANE_COUNT; i++) if (pressedRef.current[i]) {
        ctx.fillStyle = LANE_COLORS[i] + "22";
        ctx.fillRect(i * laneW, hitY - 14, laneW, 28);
      }

      if (state === "playing") {
        const now = performance.now() - startTimeRef.current;
        // update notes y
        for (const n of notesRef.current) {
          if (n.judged && n.y < -100) continue;
          // y = hitY - (hitTime - now)*speed/1000  ; if hitTime > now, note above hit line
          n.y = hitY - (n.hitTime - now) * (NOTE_SPEED / 1000);
          // auto miss if past window
          if (!n.judged && now - n.hitTime > GOOD_WINDOW) {
            n.judged = true; n.judgement = "miss";
            const s = statsRef.current; s.miss++; s.total++; s.combo = 0;
            setCombo(0);
            setJudgement("miss"); setTimeout(() => setJudgement((p) => p === "miss" ? null : p), 280);
            setAccuracy(Math.round(((s.perfect * 1 + s.good * 0.6) / Math.max(1, s.total)) * 100));
            effectsRef.current.push({ lane: n.lane, text: "MISS", color: "#ff2d55", life: 1, scale: 1 });
            playHit("miss");
          }
        }

        // draw notes
        for (const n of notesRef.current) {
          if (n.y < -40 || n.y > h + 40) continue;
          if (n.judged && n.judgement !== null) continue; // already hit, hidden
          const cx = n.lane * laneW + laneW / 2;
          const isNear = Math.abs(n.y - hitY) < 18;
          // shadow
          ctx.shadowColor = LANE_COLORS[n.lane]!; ctx.shadowBlur = isNear ? 18 : 10;
          // note body rounded rect
          const nw = laneW * 0.78; const nh = 22;
          const x = cx - nw / 2; const y = n.y - nh / 2;
          ctx.fillStyle = LANE_COLORS[n.lane]!;
          ctx.beginPath();
          const r = 7;
          ctx.moveTo(x + r, y); ctx.lineTo(x + nw - r, y); ctx.quadraticCurveTo(x + nw, y, x + nw, y + r);
          ctx.lineTo(x + nw, y + nh - r); ctx.quadraticCurveTo(x + nw, y + nh, x + nw - r, y + nh);
          ctx.lineTo(x + r, y + nh); ctx.quadraticCurveTo(x, y + nh, x, y + nh - r);
          ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); ctx.fill();
          ctx.shadowBlur = 0;
          // inner highlight
          ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fillRect(x + 6, y + 5, nw - 12, 3);
          // emoji inside
          ctx.font = "11px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillStyle = "#000"; ctx.fillText(LANE_EMOJI[n.lane]!, cx, n.y + 1);
          // trail
          ctx.fillStyle = LANE_COLORS[n.lane] + "28";
          ctx.fillRect(cx - 2, n.y + 14, 4, 18);
        }

        // hit line
        ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 2.5; ctx.shadowColor = "#ff2d55"; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.moveTo(0, hitY); ctx.lineTo(w, hitY); ctx.stroke(); ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,45,85,0.10)"; ctx.fillRect(0, hitY - 16, w, 32);
        // hit line ticks per lane
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        for (let i = 0; i < LANE_COUNT; i++) {
          const cx = i * laneW + laneW / 2;
          ctx.beginPath(); ctx.arc(cx, hitY, 3, 0, Math.PI * 2); ctx.fill();
        }

        // check win/fail by time or notes exhausted
        const song = SONGS[songIdx]!;
        const allJudged = notesRef.current.every((n) => n.judged);
        if (now > song.duration * 1000 + 1200 || allJudged) {
          const s = statsRef.current;
          if (s.score >= WIN_SCORE) setState("win");
          else setState("fail");
        }
      } else {
        // idle falling preview decoration
        const t = performance.now() * 0.001;
        for (let i = 0; i < 18; i++) {
          const lane = i % LANE_COUNT;
          const cx = lane * laneW + laneW / 2;
          const y = ((t * 60 + i * 47) % (h * 1.2)) - 20;
          ctx.globalAlpha = 0.10;
          ctx.fillStyle = LANE_COLORS[lane]!;
          ctx.beginPath(); ctx.roundRect(cx - laneW * 0.32, y, laneW * 0.64, 10, 5); ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, h * HIT_Y_RATIO); ctx.lineTo(w, h * HIT_Y_RATIO); ctx.stroke();
      }

      // lane receptors at hit line (behind effects)
      for (let i = 0; i < LANE_COUNT; i++) {
        const cx = i * laneW + laneW / 2; const y = h * HIT_Y_RATIO;
        const active = pressedRef.current[i];
        ctx.strokeStyle = LANE_COLORS[i]!; ctx.lineWidth = active ? 3 : 1.8;
        ctx.globalAlpha = active ? 1 : 0.65;
        ctx.shadowColor = LANE_COLORS[i]!; ctx.shadowBlur = active ? 16 : 6;
        ctx.strokeRect(cx - laneW * 0.36, y - 18, laneW * 0.72, 36);
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        ctx.fillStyle = active ? LANE_COLORS[i]! : "rgba(255,255,255,0.06)";
        ctx.fillRect(cx - laneW * 0.36, y - 18, laneW * 0.72, 36);
        ctx.fillStyle = LANE_COLORS[i]!; ctx.font = `900 ${active ? 15 : 13}px Inter, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(LANE_LABELS[i]!, cx, y + 1);
      }

      // hit effects floating upwards
      effectsRef.current = effectsRef.current.filter((e) => e.life > 0);
      for (const e of effectsRef.current) {
        e.life -= 0.018; e.scale += 0.01;
        const cx = e.lane * laneW + laneW / 2;
        const y = h * HIT_Y_RATIO - 42 - (1 - e.life) * 44;
        ctx.globalAlpha = Math.max(0, e.life);
        ctx.fillStyle = e.color;
        ctx.font = `900 ${e.text === "PERFECT!" ? 18 : 15}px Inter, sans-serif`;
        ctx.textAlign = "center"; ctx.strokeStyle = "rgba(0,0,0,0.85)"; ctx.lineWidth = 4;
        ctx.strokeText(e.text, cx, y); ctx.fillText(e.text, cx, y);
        ctx.globalAlpha = 1;
      }

      animRef.current = requestAnimationFrame(draw);
      void lastW;
    };
    animRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener("resize", resize); };
  }, [state, songIdx]);

  const song = SONGS[songIdx]!;

  return (
    <div className={styles.page}>
      <h1>РИТМ MAGNUM</h1>
      <p className={styles.sub}>Лови ноты в такт — D F J K или тапай по дорожкам</p>

      {state === "menu" && (
        <div className={styles.menu}>
          <div className={styles.songs}>
            {SONGS.map((s, i) => (
              <button key={s.name} className={`${styles.songBtn} ${i === songIdx ? styles.active : ""}`} onClick={() => setSongIdx(i)}>
                <span className={styles.songName}>{s.name}</span>
                <span className={styles.songMeta}>{s.bpm} BPM • {s.duration}с • {i === songIdx ? "выбран" : "выбрать"}</span>
              </button>
            ))}
          </div>
          <button className={styles.playBtn} onClick={() => startGame(songIdx)}>Играть — {song.name}!</button>
          <p className={styles.hint}>Клавиши D F J K • Perfect +100 • Good +55 • Комбо x4 бонус • Нужно {WIN_SCORE} очков</p>
          <Link to="/magnum/games" className={styles.back}>← К играм</Link>
        </div>
      )}

      {(state === "playing" || state === "win" || state === "fail") && (
        <div className={styles.gameArea}>
          <div className={styles.hud}>
            <div className={styles.stat}><span>Очки</span><strong>{score}</strong></div>
            <div className={styles.stat}><span>Комбо</span><strong className={combo > 8 ? styles.comboHot : ""}>{combo} {combo > 4 ? "🔥" : ""}</strong></div>
            <div className={styles.stat}><span>Макс</span><strong>{maxCombo}</strong></div>
            <div className={styles.stat}><span>Точность</span><strong>{accuracy}%</strong></div>
          </div>
          <div className={styles.progress}><div className={styles.fill} style={{ width: `${Math.min((score / WIN_SCORE) * 100, 100)}%` }} /></div>
          {judgement && <div className={`${styles.judgement} ${styles[judgement]}`}>{judgement === "perfect" ? "PERFECT!" : judgement === "good" ? "GOOD!" : "MISS"}</div>}
          <div className={styles.canvasWrap}>
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              onPointerDown={(e) => {
                if (state !== "playing") return;
                const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
                const x = e.clientX - rect.left;
                const { w } = canvasSizeRef.current;
                const lane = Math.min(LANE_COUNT - 1, Math.max(0, Math.floor((x / rect.width) * LANE_COUNT)));
                void w;
                const now = performance.now() - startTimeRef.current;
                pressedRef.current[lane] = true; setTimeout(() => { pressedRef.current[lane] = false; }, 140);
                hitNote(lane, now);
              }}
            />
          </div>
          <div className={styles.controls}>
            {LANE_LABELS.map((lb, i) => (
              <button key={lb} className={styles.keyBtn} style={{ borderColor: LANE_COLORS[i], color: LANE_COLORS[i] }} onPointerDown={(e) => { e.preventDefault(); if (state !== "playing") return; const now = performance.now() - startTimeRef.current; pressedRef.current[i] = true; setTimeout(() => { pressedRef.current[i] = false; }, 140); hitNote(i, now); }}>
                {lb}
              </button>
            ))}
          </div>
          <div className={styles.navRow}>
            <button className={styles.restartBtn} onClick={() => startGame(songIdx)}>Заново</button>
            <Link to="/magnum/games" className={styles.backInline}>← К играм</Link>
          </div>
        </div>
      )}

      {state === "win" && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2>🎉 Ритм-мастер!</h2>
            <p>{score} очков • макс комбо {maxCombo} • {accuracy}% точность</p>
            <p className={styles.songDone}>{song.name} — пройден!</p>
            <a href={PRESAVE} target="_blank" rel="noreferrer" className={styles.presaveBtn}>Пресейв MAGNUM →</a>
            <button className={styles.restartBtn} onClick={() => startGame(songIdx)}>Ещё раз</button>
          </div>
        </div>
      )}
      {state === "fail" && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2>Попробуй ещё! 🥁</h2>
            <p>{score} / {WIN_SCORE} • комбо {maxCombo} • {accuracy}%</p>
            <p className={styles.failHint}>Нужно больше Perfect — бей точнее в такт!</p>
            <button className={styles.playBtn} onClick={() => startGame(songIdx)}>Ещё попытка</button>
            <Link to="/magnum/games" className={styles.backInline}>← К играм</Link>
          </div>
        </div>
      )}
    </div>
  );
}
