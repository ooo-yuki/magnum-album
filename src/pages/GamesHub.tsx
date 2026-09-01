import { Link } from "react-router-dom";
import { useRef, useEffect, useCallback } from "react";
import gsap from "gsap";
import styles from "./GamesHub.module.css";

const GAMES = [
  { to: "/magnum/games/runner", icon: "🏃", title: "Беги, братуха!", desc: "2D раннер — перепрыгивай мухоморы" },
  { to: "/magnum/games/match3", icon: "🧩", title: "Матч 42", desc: "Собери комбинации из 42-символов" },
  { to: "/magnum/games/knife", icon: "🔪", title: "Ножи 42", desc: "Кидай ножи в мишень" },
  { to: "/magnum/games/memory", icon: "🃏", title: "Память", desc: "Найди пары карточек" },
  { to: "/magnum/games/clicker", icon: "⚡", title: "Кликер", desc: "42 клика за 10 секунд" },
  { to: "/magnum/games/quiz", icon: "🧠", title: "Квиз", desc: "8 вопросов про 42 и MAGNUM" },
  { to: "/magnum/games/rhythm", icon: "🎵", title: "Ритм MAGNUM", desc: "Лови ноты в такт — D F J K" },
  { to: "/magnum/games/stack", icon: "🧱", title: "Стопка 42", desc: "Строй башню — 15 этажей до победы" },
  { to: "/magnum/games/blackjack", icon: "♠️", title: "БЛЭКДЖЕК 42", desc: "Собери 21 — нафарми 4200 монет" },
  { to: "/magnum/games/roulette", icon: "🎰", title: "РУЛЕТКА 42", desc: "Европейская 0-36 · собери 4200 монет" },
];

export function GamesHub() {
  const ref = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);

  // GSAP entrance stagger + badge glow-pulse
  useEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      gsap.set(`.${styles.card}`, { y: 40, opacity: 0, scale: 0.95 });
      gsap.to(`.${styles.card}`, {
        y: 0, opacity: 1, scale: 1,
        stagger: 0.1, duration: 0.6, ease: "back.out(1.7)",
      });

      // badge float + glow pulse
      if (badgeRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.to(badgeRef.current, {
          y: -3,
          boxShadow: "0 0 18px rgba(255,45,85,0.45), 0 0 36px rgba(255,45,85,0.15)",
          duration: 1.6,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      }
    }, ref);
    return () => ctx.revert();
  }, []);

  // Magnetic 3D tilt on hover
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -8; // tilt up/down
    const rotateY = ((x - centerX) / centerX) * 8;  // tilt left/right

    gsap.to(card, {
      rotateX,
      rotateY,
      duration: 0.35,
      ease: "power2.out",
    });
  }, []);

  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    gsap.to(e.currentTarget, {
      rotateX: 0,
      rotateY: 0,
      y: 0,
      duration: 0.5,
      ease: "elastic.out(1, 0.5)",
    });
  }, []);

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    gsap.to(e.currentTarget, {
      y: -6,
      duration: 0.3,
      ease: "power2.out",
    });
  }, []);

  return (
    <div className={styles.page} ref={ref}>
      <div className={styles.header}>
        <div className={styles.badge} ref={badgeRef}>Мини-игры</div>
        <h1>Играй и выигрывай</h1>
        <p className={styles.subtitle}>Победи в любой игре — получи пресейв MAGNUM</p>
      </div>
      <div className={styles.grid}>
        {GAMES.map((g) => (
          <div key={g.to} className={styles.cardWrap}>
            <Link
              to={g.to}
              className={styles.card}
              onMouseMove={handleMouseMove}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <span className={styles.icon}>{g.icon}</span>
              <strong>{g.title}</strong>
              <p>{g.desc}</p>
            </Link>
          </div>
        ))}
      </div>
      <Link to="/magnum" className={styles.back}>← На главную</Link>
    </div>
  );
}
