import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./Match3Game.module.css";
gsap.registerPlugin(ScrollTrigger);

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
const RGB_GLOW = "0 12px 36px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,45,85,0.22), 0 0 28px rgba(255,45,85,0.22), 0 0 28px rgba(0,255,136,0.14), 0 0 32px rgba(255,204,0,0.10)";
function hoverIn(el: HTMLElement) {
  if (prefersReducedMotion()) return;
  gsap.to(el, { y: -4, boxShadow: RGB_GLOW, borderColor: "rgba(255,45,85,0.45)", duration: 0.3, ease: "power2.out", overwrite: true });
  const glow = el.querySelector<HTMLElement>("[data-glow]");
  if (glow) gsap.to(glow, { opacity: 1, duration: 0.3, overwrite: true });
}
function hoverOut(el: HTMLElement) {
  if (prefersReducedMotion()) { gsap.set(el, { clearProps: "boxShadow,borderColor" }); return; }
  gsap.to(el, { y: 0, boxShadow: "0 0 0 1px transparent, 0 0 0 transparent", borderColor: "rgba(35,35,43,1)", duration: 0.4, ease: "power2.out", overwrite: true });
  const glow = el.querySelector<HTMLElement>("[data-glow]");
  if (glow) gsap.to(glow, { opacity: 0.95, duration: 0.4, overwrite: true });
}

//Obscura-заглушка AudioParam: прямые вызовы ramp-методов могут кинуть — оборачиваем
function safeRamp(param: AudioParam, fn: () => void, fallbackValue: number) {
  try { fn(); } catch { param.value = fallbackValue; }
}


const PRESAVE = "https://music.thefence.me/psmagnum";
const GRID = 8;
const ITEMS = ["🪼", "🧥", "🕶️", "🍄", "⛓️", "🎵", "4️⃣", "2️⃣"];
const TARGET = 3000;
const MAX_MOVES = 30;

type Cell = { id: number; emoji: string };
type Board = Cell[][];

let nextId = 0;
function newId(): number { return nextId++; }

// ── WebAudio ──
let audioCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch { return null; }
}
function tone(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.14, slideTo?: number) {
  const ctx = getCtx(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.value = freq; o.connect(g); g.connect(ctx.destination);
  g.gain.setValueAtTime(gain, ctx.currentTime);
  safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur), 0.001);
  if (slideTo !== undefined) safeRamp(o.frequency, () => o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur * 0.7), slideTo);
  o.start(); o.stop(ctx.currentTime + dur);
}
function playSwap() { tone(420, 0.12, "square", 0.08); }
function playInvalid() { tone(180, 0.28, "sawtooth", 0.09, 120); }
function playMatch(combo: number) {
  const base = 440 + combo * 110;
  tone(base, 0.22, "sine", 0.13, base * 1.5);
  setTimeout(() => tone(base * 1.25, 0.18, "triangle", 0.09), 70);
  if (combo >= 2) setTimeout(() => tone(base * 1.6, 0.3, "sine", 0.11, base * 2), 140);
}
function playWin() {
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.45, "sine", 0.16, f * 1.02), i * 110));
  setTimeout(() => tone(1318, 0.6, "triangle", 0.12), 520);
}
function playLose() {
  tone(300, 0.35, "sawtooth", 0.1, 140);
  setTimeout(() => tone(220, 0.4, "sine", 0.09, 110), 180);
}

function createBoard(): Board {
  const board: Board = [];
  for (let r = 0; r < GRID; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < GRID; c++) {
      let emoji: string;
      do { emoji = ITEMS[Math.floor(Math.random() * ITEMS.length)]!; } while (
        (c >= 2 && row[c - 1]!.emoji === emoji && row[c - 2]!.emoji === emoji) ||
        (r >= 2 && board[r - 1]![c]!.emoji === emoji && board[r - 2]![c]!.emoji === emoji)
      );
      row.push({ id: newId(), emoji });
    }
    board.push(row);
  }
  return board;
}
function findMatches(board: Board): Set<string> {
  const matched = new Set<string>();
  for (let r = 0; r < GRID; r++) {
    let c = 0;
    while (c < GRID) {
      const emoji = board[r]![c]!.emoji;
      let end = c + 1; while (end < GRID && board[r]![end]!.emoji === emoji) end++;
      if (end - c >= 3) for (let i = c; i < end; i++) matched.add(`${r},${i}`);
      c = end;
    }
  }
  for (let c = 0; c < GRID; c++) {
    let r = 0;
    while (r < GRID) {
      const emoji = board[r]![c]!.emoji;
      let end = r + 1; while (end < GRID && board[end]![c]!.emoji === emoji) end++;
      if (end - r >= 3) for (let i = r; i < end; i++) matched.add(`${i},${c}`);
      r = end;
    }
  }
  return matched;
}
function calcScore(matched: Set<string>, board: Board): number {
  const groups: { emoji: string; cells: Set<string> }[] = [];
  const visited = new Set<string>();
  for (const key of matched) {
    if (visited.has(key)) continue;
    const [r, c] = key.split(",").map(Number) as [number, number];
    const emoji = board[r]![c]!.emoji;
    const group = new Set<string>();
    const queue: [number, number][] = [[r, c]];
    while (queue.length) {
      const [cr, cc] = queue.shift()!;
      const k = `${cr},${cc}`;
      if (visited.has(k) || !matched.has(k)) continue;
      if (board[cr]![cc]!.emoji !== emoji) continue;
      visited.add(k); group.add(k);
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const nr = cr + dr, nc = cc + dc;
        if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID) queue.push([nr, nc]);
      }
    }
    if (group.size > 0) groups.push({ emoji, cells: group });
  }
  let score = 0;
  for (const g of groups) {
    const len = g.cells.size;
    // баланс v2: база 18, множители сильнее — игра проходимее на 30 ходов
    const mult = len >= 5 ? 3 : len === 4 ? 2 : 1;
    score += len * 18 * mult;
  }
  return score;
}
function applyGravity(board: Board): { board: Board; falls: Map<string, number> } {
  const newBoard: Board = Array.from({ length: GRID }, () => Array(GRID).fill(null));
  const falls = new Map<string, number>();
  for (let c = 0; c < GRID; c++) {
    let writeRow = GRID - 1;
    for (let r = GRID - 1; r >= 0; r--) {
      if (board[r]![c]) {
        newBoard[writeRow]![c] = board[r]![c]!;
        if (writeRow !== r) falls.set(`${writeRow},${c}`, writeRow - r);
        writeRow--;
      }
    }
    for (let r = writeRow; r >= 0; r--) {
      newBoard[r]![c] = { id: newId(), emoji: ITEMS[Math.floor(Math.random() * ITEMS.length)]! };
      falls.set(`${r},${c}`, writeRow + 1);
    }
  }
  return { board: newBoard, falls };
}
function isAdjacent(a: [number, number], b: [number, number]): boolean {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
}

export function Match3Game() {
  const [board, setBoard] = useState<Board>(() => createBoard());
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(MAX_MOVES);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [started, setStarted] = useState(false);
  const [won, setWon] = useState(false);
  const [lost, setLost] = useState(false);
  const [locked, setLocked] = useState(false);
  const [combo, setCombo] = useState(0);
  const [lastMatch, setLastMatch] = useState(0);
  const [floaters, setFloaters] = useState<{ id: number; text: string; x: number; y: number }[]>([]);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number; color: string }[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<gsap.Context | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const movesRef = useRef<HTMLSpanElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const comboRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (prefersReducedMotion()) { gsap.set(`.${styles.hero} > *`, { y: 0, opacity: 1, clearProps: "transform" }); return; }
    const ctx = gsap.context(() => {
      gsap.from(`.${styles.hero} > *`, { y: 20, opacity: 0, stagger: 0.12, duration: 0.6 });
    }, ref);
    return () => ctx.revert();
  }, []);

  // GSAP spec: y24 stagger 0.12 ScrollTrigger batch + reduced-motion gate + gsap.context cleanup + hover y:-4 RGB glow
  useEffect(() => {
    const root: HTMLElement | null = document.querySelector<HTMLElement>("[data-gsap-root]") || (document.body as unknown as HTMLElement);
    if (!root) return;
    if (prefersReducedMotion()) {
      const els = root.querySelectorAll<HTMLElement>(".card, [data-card]");
      if (els.length) gsap.set(els, { y: 0, opacity: 1, clearProps: "transform" });
      return;
    }
    const ctx = gsap.context(() => {
      const cards = root.querySelectorAll<HTMLElement>(".card, [data-card], .tile, .cell");
      if (cards.length) {
        gsap.set(cards, { y: 24, opacity: 0 });
        ScrollTrigger.batch(cards, {
          onEnter: (batch) => gsap.to(batch, { y: 0, opacity: 1, stagger: 0.12, duration: 0.55, ease: "power2.out", overwrite: true }),
          start: "top 92%",
          once: true,
        });
      }
      const heroEls = root.querySelectorAll<HTMLElement>(".hero > *, [data-hero] > *");
      if (heroEls.length) {
        gsap.set(heroEls, { y: 24, opacity: 0 });
        gsap.to(heroEls, { y: 0, opacity: 1, stagger: 0.12, duration: 0.55, ease: "power2.out", delay: 0.05, overwrite: true });
      }
    }, root);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!movesRef.current) return;
    if (prefersReducedMotion()) return;
    gsap.fromTo(movesRef.current, { scale: 1.35, color: moves <= 5 ? "#ff2d55" : "#ffcc00" }, { scale: 1, color: moves <= 5 ? "#ff2d55" : "#fff", duration: 0.35, ease: "back.out(2)" });
    if (moves <= 5 && moves > 0) {
      gsap.to(movesRef.current, { x: 3, duration: 0.06, yoyo: true, repeat: 5, ease: "power1.inOut" });
    }
  }, [moves]);

  useEffect(() => {
    if (!scoreRef.current) return;
    if (prefersReducedMotion()) return;
    gsap.fromTo(scoreRef.current, { scale: 1.18 }, { scale: 1, duration: 0.28, ease: "back.out(1.7)" });
  }, [score]);

  useEffect(() => {
    if (combo > 0 && comboRef.current) {
      if (prefersReducedMotion()) return;
      gsap.fromTo(comboRef.current, { scale: 0.6, rotation: -4, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.45, ease: "back.out(1.7)" });
      if (boardRef.current) {
        const intensity = Math.min(6 + combo * 3, 14);
        gsap.to(boardRef.current, { x: intensity, duration: 0.05, yoyo: true, repeat: 7, ease: "power1.inOut", onComplete: () => gsap.set(boardRef.current, { x: 0 }) });
      }
    }
  }, [combo, lastMatch]);

  // presave confetti on win + sound
  useEffect(() => {
    if (won) {
      playWin();
      // легкий shake всей страницы
      if (ref.current && !prefersReducedMotion()) gsap.to(ref.current, { x: 4, duration: 0.06, yoyo: true, repeat: 6, ease: "power1.inOut", onComplete: () => gsap.set(ref.current, { x: 0 }) });
    }
    if (lost) playLose();
  }, [won, lost]);

  const startGame = useCallback(() => {
    nextId = 0;
    setBoard(createBoard());
    setScore(0); setMoves(MAX_MOVES); setSelected(null);
    setWon(false); setLost(false); setLocked(false); setCombo(0); setLastMatch(0); setStarted(true); setFloaters([]); setBursts([]);
  }, []);

  const spawnBurst = useCallback((x: number, y: number, color: string) => {
    const id = Date.now() + Math.random();
    setBursts(b => [...b, { id, x, y, color }]);
    setTimeout(() => setBursts(b => b.filter(v => v.id !== id)), 650);
  }, []);

  const processCascade = useCallback((currentBoard: Board, currentScore: number, comboLevel: number) => {
    const matched = findMatches(currentBoard);
    if (matched.size === 0) { setLocked(false); setCombo(0); return; }
    setLocked(true);
    const matchScore = calcScore(matched, currentBoard);
    // баланс v2: каскад-бонус 20*combo, было 15 — чуть щедрее для комбо-цепочек
    const cascadeBonus = comboLevel > 0 ? comboLevel * 22 : 0;
    const totalMatchScore = matchScore + cascadeBonus;
    const newScore = currentScore + totalMatchScore;
    setCombo(comboLevel);
    setLastMatch(totalMatchScore);
    playMatch(comboLevel);

    const centerKey = Array.from(matched)[Math.floor(matched.size / 2)]!;
    const [cr, cc] = centerKey.split(",").map(Number) as [number, number];
    const fid = Date.now() + Math.random();
    setFloaters(f => [...f, { id: fid, text: `+${totalMatchScore}${comboLevel > 0 ? ` 🔥x${comboLevel + 1}` : ""}`, x: cc, y: cr }]);
    setTimeout(() => setFloaters(f => f.filter(x => x.id !== fid)), 900);

    // burst particles per match center
    const burstColor = comboLevel >= 2 ? "#ffcc00" : comboLevel === 1 ? "#ff2d55" : "#00ff88";
    spawnBurst(cc, cr, burstColor);

    if (prefersReducedMotion()) {
      const removed = currentBoard.map(row => [...row]);
      for (const key of matched) {
        const [r, c] = key.split(",").map(Number) as [number, number];
        removed[r]![c] = null as unknown as Cell;
      }
      const { board: filled, falls } = applyGravity(removed);
      setBoard(filled); setScore(newScore);
      if (newScore >= TARGET) { setTimeout(() => { setWon(true); setLocked(false); }, 450); return; }
      setTimeout(() => processCascade(filled, newScore, comboLevel + 1), 320);
      return;
    }
    const tl = gsap.timeline({
      onComplete: () => {
        const removed = currentBoard.map(row => [...row]);
        for (const key of matched) {
          const [r, c] = key.split(",").map(Number) as [number, number];
          removed[r]![c] = null as unknown as Cell;
        }
        const { board: filled, falls } = applyGravity(removed);
        setBoard(filled); setScore(newScore);
        if (newScore >= TARGET) {
          setTimeout(() => { setWon(true); setLocked(false); }, 450);
          return;
        }
        setTimeout(() => {
          if (boardRef.current) {
            const cells = boardRef.current.querySelectorAll(`.${styles.cell}`);
            for (const [key, dist] of falls) {
              const [r, c] = key.split(",").map(Number) as [number, number];
              const idx = r * GRID + c;
              const cell = cells[idx];
              if (cell) gsap.from(cell as Element, { y: -dist * 62, duration: 0.34 + dist * 0.05, ease: "bounce.out", delay: 0.04 });
            }
          }
          setTimeout(() => processCascade(filled, newScore, comboLevel + 1), 420);
        }, 50);
      }
    });
    for (const key of matched) {
      const [r, c] = key.split(",").map(Number) as [number, number];
      const idx = r * GRID + c;
      const cell = boardRef.current?.querySelectorAll(`.${styles.cell}`)[idx];
      if (cell) tl.to(cell as Element, { scale: 0, opacity: 0, rotation: 12, duration: 0.24, ease: "back.in(2)" }, 0);
    }
  }, [spawnBurst]);

  const handleSwap = useCallback((from: [number, number], to: [number, number]) => {
    setLocked(true); setSelected(null);
    const newBoard = board.map(row => row.map(cell => ({ ...cell })));
    const [fr, fc] = from; const [tr, tc] = to;
    const tmp = newBoard[fr]![fc]!; newBoard[fr]![fc] = newBoard[tr]![tc]!; newBoard[tr]![tc] = tmp;
    const matched = findMatches(newBoard);
    if (boardRef.current) {
      const cells = boardRef.current.querySelectorAll(`.${styles.cell}`);
      const fromIdx = fr * GRID + fc; const toIdx = tr * GRID + tc;
      const fromCell = cells[fromIdx] as Element; const toCell = cells[toIdx] as Element;
      if (fromCell && toCell) {
        const tl = gsap.timeline();
        const dx = (tc - fc) * 62; const dy = (tr - fr) * 62;
        // whoosh swap sound
        playSwap();
        tl.to(fromCell, { x: dx, y: dy, duration: 0.2, ease: "power2.inOut" }, 0);
        tl.to(toCell, { x: -dx, y: -dy, duration: 0.2, ease: "power2.inOut" }, 0);
        tl.call(() => {
          gsap.set([fromCell, toCell] as unknown as Element[], { x: 0, y: 0 });
          if (matched.size > 0) {
            setBoard(newBoard); setMoves(m => m - 1);
            setTimeout(() => processCascade(newBoard, score, 0), 50);
          } else {
            playInvalid();
            gsap.to(boardRef.current, { x: 4, duration: 0.07, yoyo: true, repeat: 3, ease: "power1.inOut", onComplete: () => gsap.set(boardRef.current, { x: 0 }) });
            gsap.to([fromCell, toCell] as unknown as Element[], { x: 0, y: 0, duration: 0.15 });
            setLocked(false);
          }
        });
      }
    } else {
      if (matched.size > 0) { setBoard(newBoard); setMoves(m => m - 1); processCascade(newBoard, score, 0); }
      else setLocked(false);
    }
  }, [board, score, processCascade]);

  useEffect(() => {
    if (started && moves <= 0 && !won && !locked) { setLost(true); setStarted(false); }
  }, [moves, started, won, locked]);

  const handleCellClick = (r: number, c: number) => {
    if (locked || won || lost || !started) return;
    if (!selected) { setSelected([r, c]); return; }
    if (selected[0] === r && selected[1] === c) { setSelected(null); return; }
    if (isAdjacent(selected, [r, c])) handleSwap(selected, [r, c]); else setSelected([r, c]);
  };

  const restart = () => startGame();

  return (
    <div className={styles.page} ref={ref}>
      {!started && !won && !lost && (
        <div className={styles.hero}>
          <h1>МАТЧ 42</h1>
          <p>Совмещай символы, набери {TARGET} очков за {MAX_MOVES} ходов</p>
          <div className={styles.rules}>
            <p>🔄 Нажми на два соседних символа чтобы поменять их местами</p>
            <p>💎 3 в ряд = 54 очка (18×3)</p>
            <p>💎💎 4 в ряд = x2 множитель + шейк + звук</p>
            <p>💎💎💎 5 в ряд = x3 множитель + экран трясётся!</p>
            <p>🔥 Цепные реакции +22 за каждый каскад!</p>
            <p>🎧 Со звуком и частицами — кайфуй, братуха</p>
          </div>
          <button className={styles.startBtn} onClick={startGame}>Играть!</button>
        </div>
      )}

      {started && (
        <div className={styles.gameArea}>
          <div className={styles.hud}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Очки</span>
              <span ref={scoreRef} className={styles.statValue}>{score}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Цель</span>
              <span className={styles.statValue}>{TARGET}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Ходы</span>
              <span ref={movesRef} className={`${styles.statValue} ${moves <= 5 ? styles.danger : ""}`}>{moves}</span>
            </div>
          </div>

          <div className={styles.progress}>
            <div className={styles.progressFill} style={{ width: `${Math.min((score / TARGET) * 100, 100)}%`, boxShadow: score > TARGET * 0.7 ? "0 0 14px rgba(255,45,85,0.8)" : undefined }} />
          </div>

          {combo > 0 && (
            <div ref={comboRef} className={styles.combo}>
              🔥 КОМБО x{combo + 1}! +{lastMatch}
            </div>
          )}

          <div className={styles.board} ref={boardRef} style={{ position: "relative" }}>
            {board.map((row, r) => row.map((cell, c) => (
              <button key={cell.id} className={`${styles.cell} ${selected && selected[0] === r && selected[1] === c ? styles.selected : ""}`} onClick={() => handleCellClick(r, c)}>
                {cell.emoji}
              </button>
            )))}
            {floaters.map(f => (
              <div key={f.id} style={{
                position: "absolute",
                left: `${(f.x + 0.5) * (100 / GRID)}%`,
                top: `${(f.y + 0.5) * (100 / GRID)}%`,
                transform: "translate(-50%,-50%)",
                pointerEvents: "none",
                fontWeight: 900, fontSize: combo > 1 ? "1.1rem" : "0.95rem",
                color: combo > 0 ? "#ffcc00" : "#00ff88",
                textShadow: "0 0 10px rgba(0,0,0,0.9), 0 0 18px currentColor",
                animation: "matchFloater 0.9s ease-out forwards",
                zIndex: 10,
              }}>{f.text}</div>
            ))}
            {bursts.map(b => (
              <div key={b.id} style={{
                position: "absolute",
                left: `${(b.x + 0.5) * (100 / GRID)}%`,
                top: `${(b.y + 0.5) * (100 / GRID)}%`,
                transform: "translate(-50%,-50%)",
                pointerEvents: "none",
                width: 6, height: 6, borderRadius: 999,
                background: b.color,
                boxShadow: `0 0 10px ${b.color}, 0 0 18px ${b.color}`,
                animation: "matchBurst 0.6s ease-out forwards",
                zIndex: 9,
              }} />
            ))}
          </div>

          <div className={styles.nav}>
            <Link to="/magnum/games" className={styles.back}>← К играм</Link>
            <button onClick={restart} className={styles.restartBtn}>Заново</button>
          </div>
        </div>
      )}

      {won && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <div style={{ fontSize: "2.2rem" }}>🎉</div>
            <h2>Победа, братуха!</h2>
            <p>{score} очков за {MAX_MOVES - moves} ходов — ты машина 42!</p>
            <div style={{ display: "flex", gap: ".5rem", justifyContent: "center", flexWrap: "wrap", margin: "0.6rem 0" }}>
              <span style={{ background: "rgba(255,204,0,0.15)", border: "1px solid rgba(255,204,0,0.3)", color: "#ffcc00", padding: ".3rem .7rem", borderRadius: 999, fontSize: ".8rem", fontWeight: 800 }}>+300 🪙 на баланс</span>
              <span style={{ background: "rgba(0,255,136,0.12)", border: "1px solid rgba(0,255,136,0.25)", color: "#00ff88", padding: ".3rem .7rem", borderRadius: 999, fontSize: ".8rem", fontWeight: 800 }}>🔥 КОМБО x{combo + 1}</span>
            </div>
            <a href={PRESAVE} target="_blank" rel="noreferrer" className={styles.presaveBtn}>Пресейв MAGNUM →</a>
            <button onClick={restart} className={styles.restartBtn}>Ещё раз</button>
          </div>
        </div>
      )}

      {lost && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2>Ходы закончились! 😤</h2>
            <p>{score} / {TARGET} очков — ещё чуть-чуть, братуха!</p>
            <button onClick={restart} className={styles.restartBtn}>Попробовать снова</button>
            <Link to="/magnum/games" className={styles.back}>← К играм</Link>
          </div>
        </div>
      )}

      <style>{`@keyframes matchFloater{0%{transform:translate(-50%,-50%) scale(0.6); opacity:0} 15%{opacity:1; transform:translate(-50%,-60%) scale(1.1)} 100%{opacity:0; transform:translate(-50%,-110%) scale(1)}} @keyframes matchBurst{0%{transform:translate(-50%,-50%) scale(1); opacity:1} 100%{transform:translate(-50%,-80%) scale(3); opacity:0}}`}</style>
    </div>
  );
}