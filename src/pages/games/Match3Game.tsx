import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import styles from "./Match3Game.module.css";

const PRESAVE = "https://music.thefence.me/psmagnum";
const GRID = 8;
const ITEMS = ["🪼", "🧥", "🕶️", "🍄", "⛓️", "🎵", "4️⃣", "2️⃣"];
const TARGET = 4200;
const MAX_MOVES = 30;

type Cell = { id: number; emoji: string };
type Board = Cell[][];

let nextId = 0;
function newId(): number {
  return nextId++;
}

function createBoard(): Board {
  const board: Board = [];
  for (let r = 0; r < GRID; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < GRID; c++) {
      let emoji: string;
      do {
        emoji = ITEMS[Math.floor(Math.random() * ITEMS.length)]!;
      } while (
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
      let end = c + 1;
      while (end < GRID && board[r]![end]!.emoji === emoji) end++;
      if (end - c >= 3) {
        for (let i = c; i < end; i++) matched.add(`${r},${i}`);
      }
      c = end;
    }
  }

  for (let c = 0; c < GRID; c++) {
    let r = 0;
    while (r < GRID) {
      const emoji = board[r]![c]!.emoji;
      let end = r + 1;
      while (end < GRID && board[end]![c]!.emoji === emoji) end++;
      if (end - r >= 3) {
        for (let i = r; i < end; i++) matched.add(`${i},${c}`);
      }
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
      visited.add(k);
      group.add(k);
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]] as const) {
        const nr = cr + dr, nc = cc + dc;
        if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID) queue.push([nr, nc]);
      }
    }
    if (group.size > 0) groups.push({ emoji, cells: group });
  }

  let score = 0;
  for (const g of groups) {
    const len = g.cells.size;
    const mult = len >= 5 ? 3 : len === 4 ? 2 : 1;
    score += len * 10 * mult;
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
  const ref = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<gsap.Context | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ctxRef.current = gsap.context(() => {}, ref.current!);
    gsap.from(`.${styles.hero} > *`, { y: 20, opacity: 0, stagger: 0.1, duration: 0.6 });
    return () => { ctxRef.current?.revert(); };
  }, []);

  const startGame = useCallback(() => {
    nextId = 0;
    setBoard(createBoard());
    setScore(0);
    setMoves(MAX_MOVES);
    setSelected(null);
    setWon(false);
    setLost(false);
    setLocked(false);
    setCombo(0);
    setLastMatch(0);
    setStarted(true);
  }, []);

  const processCascade = useCallback((currentBoard: Board, currentScore: number, comboLevel: number) => {
    const matched = findMatches(currentBoard);
    if (matched.size === 0) {
      setLocked(false);
      setCombo(0);
      return;
    }

    setLocked(true);
    const matchScore = calcScore(matched, currentBoard);
    const cascadeBonus = comboLevel > 0 ? comboLevel * 5 : 0;
    const totalMatchScore = matchScore + cascadeBonus;
    const newScore = currentScore + totalMatchScore;

    setCombo(comboLevel);
    setLastMatch(totalMatchScore);

    const tl = gsap.timeline({
      onComplete: () => {
        const removed = currentBoard.map(row => [...row]);
        for (const key of matched) {
          const [r, c] = key.split(",").map(Number) as [number, number];
          removed[r]![c] = null as unknown as Cell;
        }

        const { board: filled, falls } = applyGravity(removed);
        setBoard(filled);
        setScore(newScore);

        if (newScore >= TARGET) {
          setTimeout(() => { setWon(true); setLocked(false); }, 400);
          return;
        }

        setTimeout(() => {
          if (boardRef.current) {
            const cells = boardRef.current.querySelectorAll(`.${styles.cell}`);
            for (const [key, dist] of falls) {
              const [r, c] = key.split(",").map(Number) as [number, number];
              const idx = r * GRID + c;
              const cell = cells[idx];
              if (cell) {
                gsap.from(cell, { y: -dist * 60, duration: 0.3 + dist * 0.05, ease: "bounce.out", delay: 0.05 });
              }
            }
          }
          setTimeout(() => processCascade(filled, newScore, comboLevel + 1), 400);
        }, 50);
      }
    });

    for (const key of matched) {
      const [r, c] = key.split(",").map(Number) as [number, number];
      const idx = r * GRID + c;
      const cell = boardRef.current?.querySelectorAll(`.${styles.cell}`)[idx];
      if (cell) {
        tl.to(cell, { scale: 0, opacity: 0, duration: 0.25, ease: "back.in(2)" }, 0);
      }
    }
  }, []);

  const handleSwap = useCallback((from: [number, number], to: [number, number]) => {
    setLocked(true);
    setSelected(null);

    const newBoard = board.map(row => row.map(cell => ({ ...cell })));
    const [fr, fc] = from;
    const [tr, tc] = to;
    const temp = newBoard[fr]![fc]!;
    newBoard[fr]![fc] = newBoard[tr]![tc]!;
    newBoard[tr]![tc] = temp;

    const matched = findMatches(newBoard);

    if (boardRef.current) {
      const cells = boardRef.current.querySelectorAll(`.${styles.cell}`);
      const fromIdx = fr * GRID + fc;
      const toIdx = tr * GRID + tc;
      const fromCell = cells[fromIdx];
      const toCell = cells[toIdx];

      if (fromCell && toCell) {
        const tl = gsap.timeline();
        const dx = (tc - fc) * 60;
        const dy = (tr - fr) * 60;

        tl.to(fromCell, { x: dx, y: dy, duration: 0.2, ease: "power2.inOut" }, 0);
        tl.to(toCell, { x: -dx, y: -dy, duration: 0.2, ease: "power2.inOut" }, 0);

        tl.call(() => {
          gsap.set([fromCell, toCell], { x: 0, y: 0 });

          if (matched.size > 0) {
            setBoard(newBoard);
            setMoves(m => m - 1);
            setTimeout(() => processCascade(newBoard, score, 0), 50);
          } else {
            const tl2 = gsap.timeline({
              onComplete: () => { setLocked(false); }
            });
            tl2.to(fromCell, { x: -dx, y: -dy, duration: 0.15, ease: "power2.inOut" }, 0);
            tl2.to(toCell, { x: dx, y: dy, duration: 0.15, ease: "power2.inOut" }, 0);
            tl2.set([fromCell, toCell], { x: 0, y: 0 });
          }
        });
      }
    } else {
      if (matched.size > 0) {
        setBoard(newBoard);
        setMoves(m => m - 1);
        processCascade(newBoard, score, 0);
      } else {
        setLocked(false);
      }
    }
  }, [board, score, processCascade]);

  useEffect(() => {
    if (started && moves <= 0 && !won && !locked) {
      setLost(true);
      setStarted(false);
    }
  }, [moves, started, won, locked]);

  const handleCellClick = (r: number, c: number) => {
    if (locked || won || lost || !started) return;

    if (!selected) {
      setSelected([r, c]);
      return;
    }

    if (selected[0] === r && selected[1] === c) {
      setSelected(null);
      return;
    }

    if (isAdjacent(selected, [r, c])) {
      handleSwap(selected, [r, c]);
    } else {
      setSelected([r, c]);
    }
  };

  const restart = () => {
    startGame();
  };

  return (
    <div className={styles.page} ref={ref}>
      {!started && !won && !lost && (
        <div className={styles.hero}>
          <h1>МАТЧ 42</h1>
          <p>Совмещай символы, набери {TARGET} очков за {MAX_MOVES} ходов</p>
          <div className={styles.rules}>
            <p>🔄 Нажми на два соседних символа чтобы поменять их местами</p>
            <p>💎 3 в ряд = 10 очков за каждый</p>
            <p>💎💎 4 в ряд = x2 множитель</p>
            <p>💎💎💎 5 в ряд = x3 множитель</p>
            <p>🔥 Цепные реакции дают бонусные очки!</p>
          </div>
          <button className={styles.startBtn} onClick={startGame}>Играть!</button>
        </div>
      )}

      {started && (
        <div className={styles.gameArea}>
          <div className={styles.hud}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Очки</span>
              <span className={styles.statValue}>{score}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Цель</span>
              <span className={styles.statValue}>{TARGET}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Ходы</span>
              <span className={`${styles.statValue} ${moves <= 5 ? styles.danger : ""}`}>{moves}</span>
            </div>
          </div>

          <div className={styles.progress}>
            <div className={styles.progressFill} style={{ width: `${Math.min((score / TARGET) * 100, 100)}%` }} />
          </div>

          {combo > 0 && (
            <div className={styles.combo}>
              Комбо x{combo + 1}! +{lastMatch}
            </div>
          )}

          <div className={styles.board} ref={boardRef}>
            {board.map((row, r) =>
              row.map((cell, c) => (
                <button
                  key={cell.id}
                  className={`${styles.cell} ${selected && selected[0] === r && selected[1] === c ? styles.selected : ""}`}
                  onClick={() => handleCellClick(r, c)}
                >
                  {cell.emoji}
                </button>
              ))
            )}
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
            <h2>🎉 Победа!</h2>
            <p>{score} очков за {MAX_MOVES - moves} ходов</p>
            <a href={PRESAVE} target="_blank" className={styles.presaveBtn}>Пресейв MAGNUM →</a>
            <button onClick={restart} className={styles.restartBtn}>Ещё раз</button>
          </div>
        </div>
      )}

      {lost && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2>Ходы закончились! 😤</h2>
            <p>{score} / {TARGET} очков</p>
            <button onClick={restart} className={styles.restartBtn}>Попробовать снова</button>
            <Link to="/magnum/games" className={styles.back}>← К играм</Link>
          </div>
        </div>
      )}
    </div>
  );
}
