import { Link } from "react-router-dom";
import { useRef, useEffect } from "react";
import gsap from "gsap";
import styles from "./GamesHub.module.css";

const GAMES = [
  { to: "/magnum/games/memory", icon: "🃏", title: "Память", desc: "Найди пары карточек 42" },
  { to: "/magnum/games/clicker", icon: "⚡", title: "Кликер", desc: "42 клика за 10 секунд" },
  { to: "/magnum/games/quiz", icon: "🧠", title: "Квиз", desc: "8 вопросов про 42 и MAGNUM" },
];

export function GamesHub() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      gsap.set(`.${styles.card}`, { y: 40, opacity: 0, scale: 0.95 });
      gsap.to(`.${styles.card}`, {
        y: 0, opacity: 1, scale: 1,
        stagger: 0.12, duration: 0.6, ease: "back.out(1.7)",
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <div className={styles.page} ref={ref}>
      <div className={styles.header}>
        <div className={styles.badge}>Мини-игры</div>
        <h1>Играй и выигрывай</h1>
        <p className={styles.subtitle}>Победи в любой игре — получи пресейв MAGNUM</p>
      </div>
      <div className={styles.grid}>
        {GAMES.map((g) => (
          <Link key={g.to} to={g.to} className={styles.card}>
            <span className={styles.icon}>{g.icon}</span>
            <strong>{g.title}</strong>
            <p>{g.desc}</p>
          </Link>
        ))}
      </div>
      <Link to="/magnum" className={styles.back}>← На главную</Link>
    </div>
  );
}
