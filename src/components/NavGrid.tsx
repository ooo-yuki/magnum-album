import { Link } from "react-router-dom";
import { useRef, useEffect, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./NavGrid.module.css";

gsap.registerPlugin(ScrollTrigger);

const NAV_ITEMS = [
  {
    to: "/magnum/artists",
    icon: "🎤",
    title: "Артисты",
    desc: "5opka & MellSher — кто они",
  },
  {
    to: "/magnum/discography",
    icon: "💿",
    title: "Дискография",
    desc: "Альбомы и РЗТ рейтинги",
  },
  {
    to: "/magnum/42",
    icon: "✌️",
    title: "42 братухи",
    desc: "Движение, сквады, стиль",
  },
  {
    to: "/magnum/track/tusa-meduza",
    icon: "🪼",
    title: "Туса Медуза",
    desc: "Тренд в TikTok, ~200K просмотров",
  },
  {
    to: "/magnum/track/vpn",
    icon: "🔒",
    title: "VPN",
    desc: "Сингл из альбома MAGNUM",
  },
  {
    to: "/magnum/last-fit",
    icon: "💔",
    title: "Последний фит",
    desc: "Почему Super Duper Nova распалась",
  },
  {
    to: "/magnum/games",
    icon: "🎮",
    title: "Игры",
    desc: "Мини-игры, выиграй пресейв",
  },
];

export function NavGrid() {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const shimmerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (prefersReduced) {
        gsap.set(`.${styles.card}`, { y: 0, opacity: 1, scale: 1, clearProps: "transform" });
        if (titleRef.current) gsap.set(titleRef.current, { textShadow: "none", clearProps: "textShadow" });
        return;
      }
      gsap.set(`.${styles.card}`, { y: 24, opacity: 0, scale: 0.96 });
      gsap.to(`.${styles.card}`, {
        y: 0,
        opacity: 1,
        scale: 1,
        stagger: 0.12,
        duration: 0.55,
        ease: "power2.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 85%",
          toggleActions: "play none none none",
        },
      });

      // shimmer sweep + glow pulse on the "Исследуй" heading
      if (titleRef.current && shimmerRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.to(titleRef.current, {
          textShadow: "0 0 14px rgba(255,45,85,0.5), 0 0 32px rgba(255,45,85,0.2)",
          duration: 1.8,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 80%",
            toggleActions: "play pause resume pause",
          },
        });
        const shimmerTl = gsap.timeline({
          repeat: -1,
          delay: 1.2,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 80%",
            toggleActions: "play pause resume pause",
          },
        });
        shimmerTl.fromTo(
          shimmerRef.current,
          { x: "-120%" },
          { x: "220%", duration: 1.6, ease: "power2.inOut" },
        );
        shimmerTl.to({}, { duration: 4 }); // pause between sweeps
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  // cursor-tracking glow + RGB-neon lift
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const card = e.currentTarget;
    // glow spotlight
    const glow = card.querySelector(`.${styles.glow}`) as HTMLElement | null;
    if (glow) {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left - 80;
      const y = e.clientY - rect.top - 80;
      gsap.to(glow, { x, y, opacity: 1, duration: 0.35, ease: "power2.out", overwrite: true });
    }
    // subtle RGB lift
    gsap.to(card, { y: -2, duration: 0.28, ease: "power2.out", overwrite: true });
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
  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const glow = e.currentTarget.querySelector(`.${styles.glow}`) as HTMLElement | null;
    if (glow) gsap.to(glow, { opacity: 0, duration: 0.3, ease: "power2.in", overwrite: true });
    gsap.to(e.currentTarget, {
      y: 0,
      boxShadow: "0 0 0 transparent",
      borderColor: "rgba(255,255,255,0.06)",
      duration: 0.35, ease: "power2.out", overwrite: true,
    });
  }, []);

  return (
    <section className={styles.section} ref={sectionRef}>
      <h2 className={styles.title} ref={titleRef}>
        Исследуй
        <span className={styles.shimmer} ref={shimmerRef} aria-hidden />
      </h2>
      <div className={styles.grid}>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={styles.card}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className={styles.glow} aria-hidden />
            <span className={styles.icon}>{item.icon}</span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
