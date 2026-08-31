import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import styles from "./MemoryGame.module.css";

const PRESAVE = "https://music.thefence.me/psmagnum";
const SYMBOLS = ["🪼", "🧥", "🕶️", "🍄", "⛓️", "🎵", "4️⃣", "2️⃣"];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

interface Card {
  id: number;
  symbol: string;
  flipped: boolean;
  matched: boolean;
}

export function MemoryGame() {
  const [cards, setCards] = useState<Card[]>(() =>
    shuffle([...SYMBOLS, ...SYMBOLS]).map((s, i) => ({
      id: i, symbol: s, flipped: false, matched: false,
    }))
  );
  const [first, setFirst] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [won, setWon] = useState(false);
  const [moves, setMoves] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    gsap.from(`.${styles.card}`, {
      scale: 0, opacity: 0, stagger: 0.03, duration: 0.4, ease: "back.out(1.7)",
    });
  }, []);

  const handleClick = (id: number) => {
    if (locked || cards[id]!.flipped || cards[id]!.matched) return;
    const next = cards.map((c) => (c.id === id ? { ...c, flipped: true } : c));
    setCards(next);

    if (first === null) {
      setFirst(id);
    } else {
      setLocked(true);
      setMoves((m) => m + 1);
      const a = next[first]!;
      const b = next[id]!;
      if (a.symbol === b.symbol) {
        const matched = next.map((c) =>
          c.symbol === a.symbol ? { ...c, matched: true } : c
        );
        setCards(matched);
        setFirst(null);
        setLocked(false);
        if (matched.every((c) => c.matched)) setWon(true);
      } else {
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c) =>
              c.id === first || c.id === id ? { ...c, flipped: false } : c
            )
          );
          setFirst(null);
          setLocked(false);
        }, 800);
      }
    }
  };

  const restart = () => {
    setCards(
      shuffle([...SYMBOLS, ...SYMBOLS]).map((s, i) => ({
        id: i, symbol: s, flipped: false, matched: false,
      }))
    );
    setFirst(null);
    setLocked(false);
    setWon(false);
    setMoves(0);
  };

  return (
    <div className={styles.page} ref={ref}>
      <h1>Память</h1>
      <p className={styles.info}>Ходы: {moves}</p>
      <div className={styles.grid}>
        {cards.map((c) => (
          <button
            key={c.id}
            className={`${styles.card} ${c.flipped || c.matched ? styles.flipped : ""} ${c.matched ? styles.matched : ""}`}
            onClick={() => handleClick(c.id)}
          >
            {c.flipped || c.matched ? c.symbol : "?"}
          </button>
        ))}
      </div>
      {won && (
        <div className={styles.win}>
          <div className={styles.winCard}>
            <h2>🎉 Победа!</h2>
            <p>Ходы: {moves}</p>
            <a href={PRESAVE} target="_blank" className={styles.presaveBtn}>Пресейв MAGNUM →</a>
            <button onClick={restart} className={styles.restartBtn}>Ещё раз</button>
          </div>
        </div>
      )}
      <div className={styles.nav}>
        <Link to="/magnum/games" className={styles.back}>← К играм</Link>
        <button onClick={restart} className={styles.restartBtn}>Заново</button>
      </div>
    </div>
  );
}
