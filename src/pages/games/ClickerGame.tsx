import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import styles from "./ClickerGame.module.css";

const PRESAVE = "https://music.thefence.me/psmagnum";
const TARGET = 42;
const TIME = 10;

export function ClickerGame() {
  const [clicks, setClicks] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME);
  const [started, setStarted] = useState(false);
  const [won, setWon] = useState(false);
  const [lost, setLost] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const numRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    gsap.from(`.${styles.hero} > *`, {
      y: 20, opacity: 0, stagger: 0.1, duration: 0.6,
    });
  }, []);

  const startGame = useCallback(() => {
    setStarted(true);
    setClicks(0);
    setTimeLeft(TIME);
    setWon(false);
    setLost(false);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setLost(true);
          setStarted(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, []);

  const handleClick = () => {
    if (!started || won || lost) return;
    setClicks((c) => {
      const next = c + 1;
      if (numRef.current) {
        gsap.from(numRef.current, { scale: 1.3, duration: 0.1 });
      }
      if (next >= TARGET) {
        if (timerRef.current) clearInterval(timerRef.current);
        setWon(true);
        setStarted(false);
      }
      return next;
    });
  };

  const restart = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setClicks(0);
    setTimeLeft(TIME);
    setStarted(false);
    setWon(false);
    setLost(false);
  };

  return (
    <div className={styles.page} ref={ref}>
      <div className={styles.hero}>
        <h1>Кликер</h1>
        <p>Нажми {TARGET} раз за {TIME} секунд</p>
      </div>

      <div className={styles.gameArea}>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Клики</span>
            <span className={styles.statValue}>{clicks}/{TARGET}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Время</span>
            <span className={`${styles.statValue} ${timeLeft <= 3 ? styles.danger : ""}`}>{timeLeft}с</span>
          </div>
        </div>

        <div className={styles.progress}>
          <div className={styles.progressFill} style={{ width: `${(clicks / TARGET) * 100}%` }} />
        </div>

        {!started && !won && !lost && (
          <button className={styles.startBtn} onClick={startGame}>Начать!</button>
        )}

        {started && (
          <button className={styles.clickBtn} onClick={handleClick}>
            <div className={styles.clickNum} ref={numRef}>{clicks}</div>
            <div className={styles.clickLabel}>ЖМИ!</div>
          </button>
        )}

        {won && (
          <div className={styles.win}>
            <h2>🎉 Победа!</h2>
            <p>{TARGET} кликов за {TIME - timeLeft} секунд</p>
            <a href={PRESAVE} target="_blank" className={styles.presaveBtn}>Пресейв MAGNUM →</a>
            <button onClick={restart} className={styles.restartBtn}>Ещё раз</button>
          </div>
        )}

        {lost && (
          <div className={styles.lose}>
            <h2>Не успел! 😤</h2>
            <p>Кликов: {clicks}/{TARGET}</p>
            <button onClick={restart} className={styles.restartBtn}>Попробовать снова</button>
          </div>
        )}
      </div>

      <Link to="/magnum/games" className={styles.back}>← К играм</Link>
    </div>
  );
}
