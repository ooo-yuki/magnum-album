import { Link } from "react-router-dom";
import { useRef, useEffect, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./GamesHub.module.css";

gsap.registerPlugin(ScrollTrigger);
const RGB_GLOW="0 12px 36px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,45,85,0.22), 0 0 28px rgba(255,45,85,0.22), 0 0 28px rgba(0,255,136,0.14), 0 0 32px rgba(255,204,0,0.10)";

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
  { to: "/magnum/games/2042", icon: "🧩", title: "ПАЗЛ 2042", desc: "2048-головоломка — собери 42!" },
  { to: "/magnum/games/flappy", icon: "🐦", title: "FLAPPY 42", desc: "Пролети 42 трубы — тапай и лети!" },
  { to: "/magnum/games/typing", icon: "⌨️", title: "Скоропечатание", desc: "Печатай фразы MAGNUM — набери 42 WPM" },
  { to: "/magnum/games/snake", icon: "🐍", title: "Змейка 42", desc: "Стрелками или свайпом — вырасти до 42!" },
  { to: "/magnum/games/dodge", icon: "💥", title: "5 ПУЛЬ", desc: "Уклоняйся 42с — 5 цветных пуль атакуют!" },
  { to: "/magnum/games/timeline", icon: "📅", title: "ХРОНОЛОГИЯ 2026", desc: "Расставь события MAGNUM по порядку" },
];

export function GamesHub() {
  const ref = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);

  // GSAP 24/7: y24 stagger 0.12 • ScrollTrigger • reduced-motion • context cleanup
  useEffect(() => {
    if (!ref.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (prefersReduced) {
        ScrollTrigger.batch(document.querySelectorAll('.card'), { onEnter: (batch:any) => gsap.to(batch, { y: 0, opacity: 1, stagger: 0.12, duration: 0.55, ease: "power2.out" }), start: "top 92%", once: true });
      gsap.set(`.${styles.card}`, { y: 0, opacity: 1, scale: 1, clearProps: "transform" });
        if (badgeRef.current) gsap.set(badgeRef.current, { y: 0, boxShadow: "none", clearProps: "transform" });
        return;
      }
      gsap.set(`.${styles.card}`, { y: 24, opacity: 0, scale: 0.96 });
      gsap.to(`.${styles.card}`, {
        y: 0, opacity: 1, scale: 1,
        stagger: 0.12, duration: 0.55, ease: "back.out(1.4)",
        scrollTrigger: { trigger: ref.current, start: "top 85%", toggleActions: "play none none none" },
        overwrite: true,
      });
      // header entrance
      gsap.set(`.${styles.header} > *`, { y: 24, opacity: 0 });
      gsap.to(`.${styles.header} > *`, { y: 0, opacity: 1, stagger: 0.12, duration: 0.5, ease: "power2.out", delay: 0.04 });
      // badge float + glow pulse (respects reduced-motion above)
      if (badgeRef.current) {
        gsap.to(badgeRef.current, {
          y: -3,
          boxShadow: "0 0 18px rgba(255,45,85,0.45), 0 0 36px rgba(255,45,85,0.15)",
          duration: 1.6,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          scrollTrigger: { trigger: ref.current, start: "top 90%", toggleActions: "play pause resume pause" },
        });
      }
      ScrollTrigger.refresh();
    }, ref);
    return () => ctx.revert();
  }, []);

  // Magnetic 3D tilt + RGB-neon hover (tri-shadow)
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -7;
    const rotateY = ((x - centerX) / centerX) * 7;
    gsap.to(card, { rotateX, rotateY, duration: 0.32, ease: "power2.out", overwrite: true });
  }, []);
  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.to(e.currentTarget, {
      rotateX: 0, rotateY: 0, y: 0,
      boxShadow: "0 0 0 transparent", borderColor: "rgba(255,255,255,0.08)",
      duration: 0.45, ease: "elastic.out(1, 0.5)", overwrite: true,
    });
  }, []);
  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.to(e.currentTarget, {
      y: -4,
      boxShadow: "0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,45,85,0.20), 0 0 22px rgba(255,45,85,0.20), 0 0 22px rgba(0,255,136,0.12), 0 0 28px rgba(255,204,0,0.10)",
      borderColor: "rgba(255,45,85,0.35)",
      duration: 0.28, ease: "power2.out", overwrite: true,
    });
  }, []);

  return (
    <div className={styles.page} ref={ref}>
      <div className={styles.header}>
        <div className={styles.badge} ref={badgeRef}>Мини-игры</div>
        <h1>Играй и выигрывай</h1>
        <p className={styles.subtitle}>16 игр — победи в любой и получи пресейв MAGNUM</p>
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
