import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import styles from "./Game2042.module.css";

//Obscura-заглушка AudioParam: прямые вызовы ramp-методов могут кинуть — оборачиваем
function safeRamp(param: AudioParam, fn: () => void, fallbackValue: number) {
  try { fn(); } catch { param.value = fallbackValue; }
}


const PRESAVE = "https://music.thefence.me/psmagnum";
const SIZE = 4;
const WIN_TILE = 2048; // displayed as "42" in MAGNUM theme

type Grid = number[][];
type Dir = "up" | "down" | "left" | "right";

function emptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0) as number[]);
}

function cloneGrid(g: Grid): Grid {
  return g.map((r) => [...r]);
}

function getEmpty(g: Grid): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) if (g[r]![c] === 0) cells.push([r, c]);
  return cells;
}

function addRandom(g: Grid): Grid {
  const empty = getEmpty(g);
  if (empty.length === 0) return g;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)]!;
  const ng = cloneGrid(g);
  ng[r]![c] = Math.random() < 0.9 ? 2 : 4;
  return ng;
}

function slide(row: number[]): { row: number[]; score: number; moved: boolean } {
  const filtered = row.filter((v) => v !== 0);
  let score = 0;
  const merged: number[] = [];
  let moved = false;
  for (let i = 0; i < filtered.length; i++) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const val = filtered[i]! * 2;
      merged.push(val);
      score += val;
      i++; // skip next
    } else {
      merged.push(filtered[i]!);
    }
  }
  while (merged.length < SIZE) merged.push(0);
  for (let i = 0; i < SIZE; i++) {
    if (merged[i] !== row[i]) moved = true;
  }
  return { row: merged, score, moved };
}

function moveGrid(g: Grid, dir: Dir): { grid: Grid; score: number; moved: boolean } {
  let totalScore = 0;
  let anyMoved = false;
  const ng = cloneGrid(g);

  const getRow = (i: number): number[] => {
    if (dir === "left") return [...ng[i]!];
    if (dir === "right") return [...ng[i]!].reverse();
    if (dir === "up") return Array.from({ length: SIZE }, (_, k) => ng[k]![i]!);
    return Array.from({ length: SIZE }, (_, k) => ng[SIZE - 1 - k]![i]!); // down
  };

  const setRow = (i: number, row: number[]) => {
    if (dir === "left") { for (let k = 0; k < SIZE; k++) ng[i]![k] = row[k]!; }
    else if (dir === "right") { for (let k = 0; k < SIZE; k++) ng[i]![k] = row[SIZE - 1 - k]!; }
    else if (dir === "up") { for (let k = 0; k < SIZE; k++) ng[k]![i] = row[k]!; }
    else { for (let k = 0; k < SIZE; k++) ng[SIZE - 1 - k]![i] = row[k]!; }
  };

  for (let i = 0; i < SIZE; i++) {
    const { row: result, score, moved } = slide(getRow(i));
    setRow(i, result);
    totalScore += score;
    if (moved) anyMoved = true;
  }

  return { grid: ng, score: totalScore, moved: anyMoved };
}

function canMove(g: Grid): boolean {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (g[r]![c] === 0) return true;
      if (c + 1 < SIZE && g[r]![c] === g[r]![c + 1]) return true;
      if (r + 1 < SIZE && g[r]![c] === g[r + 1]![c]) return true;
    }
  return false;
}

function hasWon(g: Grid): boolean {
  for (const row of g) for (const v of row) if (v >= WIN_TILE) return true;
  return false;
}

function tileColor(v: number): string {
  const map: Record<number, string> = {
    2: "#1a1a3e",
    4: "#2a1a4e",
    8: "#ff6b35",
    16: "#ff2d55",
    32: "#ffcc00",
    64: "#00ff88",
    128: "#5865f2",
    256: "#a855f7",
    512: "#ff2d9a",
    1024: "#ffcc00",
    2048: "#ff2d55",
  };
  return map[v] ?? "#ff2d55";
}

function tileLabel(v: number): string {
  if (v >= WIN_TILE) return "42";
  return String(v);
}

function tileEmoji(v: number): string {
  if (v >= 2048) return "🔥";
  if (v >= 512) return "💎";
  if (v >= 128) return "⚡";
  if (v >= 32) return "🎵";
  return "";
}

// WebAudio
let ac: AudioContext | null = null;
function ensureAC() {
  if (!ac) try { ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { return null; }
  if (ac && ac.state === "suspended") void ac.resume();
  return ac;
}
function playMerge(v: number) {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sine";
  o.frequency.value = 220 + Math.min(v, 2048) * 0.4;
  g.gain.setValueAtTime(0.12, ctx.currentTime);
  safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.2);
}

export function Game2042() {
  const [grid, setGrid] = useState<Grid>(() => addRandom(addRandom(emptyGrid())));
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem("2042-best")) || 0; } catch { return 0; } });
  const [state, setState] = useState<"playing" | "win" | "over">("playing");
  const [keepPlaying, setKeepPlaying] = useState(false);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const gridRef = useRef(grid);
  const scoreRef = useRef(score);
  gridRef.current = grid;
  scoreRef.current = score;

  const doMove = useCallback((dir: Dir) => {
    if (state === "over") return;
    if (state === "win" && !keepPlaying) return;
    const { grid: ng, score: s, moved } = moveGrid(gridRef.current, dir);
    if (!moved) return;
    const withNew = addRandom(ng);
    setGrid(withNew);
    const newScore = scoreRef.current + s;
    setScore(newScore);
    if (newScore > best) {
      setBest(newScore);
      try { localStorage.setItem("2042-best", String(newScore)); } catch {}
    }
    if (s > 0) playMerge(s);
    if (hasWon(withNew) && !keepPlaying) setState("win");
    else if (!canMove(withNew)) setState("over");
  }, [state, keepPlaying, best]);

  // keyboard
  useEffect(() => {
    const map: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
    const onKey = (e: KeyboardEvent) => {
      const dir = map[e.code];
      if (dir) { e.preventDefault(); doMove(dir); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doMove]);

  // touch swipe
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0]!;
    touchRef.current = { x: t.clientX, y: t.clientY };
  }, []);
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const t = e.changedTouches[0]!;
    const dx = t.clientX - touchRef.current.x;
    const dy = t.clientY - touchRef.current.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (Math.max(absDx, absDy) < 30) return;
    if (absDx > absDy) doMove(dx > 0 ? "right" : "left");
    else doMove(dy > 0 ? "down" : "up");
    touchRef.current = null;
  }, [doMove]);

  const restart = useCallback(() => {
    setGrid(addRandom(addRandom(emptyGrid())));
    setScore(0);
    setState("playing");
    setKeepPlaying(false);
  }, []);

  const continuePlay = useCallback(() => {
    setKeepPlaying(true);
    setState("playing");
  }, []);

  return (
    <div className={styles.page}>
      <h1>ПАЗЛ 2042</h1>
      <p className={styles.sub}>Свайпай или стрелками — собери 42!</p>

      <div className={styles.hud}>
        <div className={styles.stat}><span>Очки</span><strong>{score}</strong></div>
        <div className={styles.stat}><span>Рекорд</span><strong>{best}</strong></div>
      </div>

      <div
        className={styles.board}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {grid.map((row, r) =>
          row.map((v, c) => (
            <div
              key={`${r}-${c}`}
              className={`${styles.tile} ${v > 0 ? styles.filled : ""}`}
              style={v > 0 ? { background: tileColor(v), boxShadow: `0 0 ${Math.min(v * 0.02, 18)}px ${tileColor(v)}88` } : undefined}
            >
              {v > 0 && (
                <>
                  <span className={styles.tileVal}>{tileLabel(v)}</span>
                  {tileEmoji(v) && <span className={styles.tileEmoji}>{tileEmoji(v)}</span>}
                </>
              )}
            </div>
          ))
        )}
      </div>

      <div className={styles.controls}>
        <div className={styles.arrowRow}>
          <button className={styles.arrow} onClick={() => doMove("up")} aria-label="Вверх">▲</button>
        </div>
        <div className={styles.arrowRow}>
          <button className={styles.arrow} onClick={() => doMove("left")} aria-label="Влево">◀</button>
          <button className={styles.arrow} onClick={() => doMove("down")} aria-label="Вниз">▼</button>
          <button className={styles.arrow} onClick={() => doMove("right")} aria-label="Вправо">▶</button>
        </div>
      </div>

      <div className={styles.navRow}>
        <button className={styles.restartBtn} onClick={restart}>Заново</button>
        <Link to="/magnum/games" className={styles.back}>← К играм</Link>
      </div>

      {state === "win" && !keepPlaying && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2>🎉 42 СОБРАНО!</h2>
            <p>{score} очков — ты собрал магическое число!</p>
            <a href={PRESAVE} target="_blank" rel="noreferrer" className={styles.presaveBtn}>Пресейв MAGNUM →</a>
            <div className={styles.modalActions}>
              <button className={styles.playBtn} onClick={continuePlay}>Продолжить</button>
              <button className={styles.restartBtn} onClick={restart}>Заново</button>
            </div>
          </div>
        </div>
      )}

      {state === "over" && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2>💥 Ходов больше нет!</h2>
            <p>{score} очков • Рекорд {best}</p>
            <button className={styles.playBtn} onClick={restart}>Ещё попытка</button>
            <Link to="/magnum/games" className={styles.back}>← К играм</Link>
          </div>
        </div>
      )}
    </div>
  );
}
