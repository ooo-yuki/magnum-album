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

    const ctx = gsap.context(() => {
      gsap.set(`.${styles.card}`, { y: 40, opacity: 0, scale: 0.95 });
      gsap.to(`.${styles.card}`, {
        y: 0,
        opacity: 1,
        scale: 1,
        stagger: 0.08,
        duration: 0.6,
        ease: "power2.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
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

  // cursor-tracking glow spotlight
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    const card = e.currentTarget;
    const glow = card.querySelector(`.${styles.glow}`) as HTMLElement | null;
    if (!glow) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - 80;
    const y = e.clientY - rect.top - 80;
    gsap.to(glow, { x, y, opacity: 1, duration: 0.35, ease: "power2.out" });
  }, []);

  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    const glow = e.currentTarget.querySelector(`.${styles.glow}`) as HTMLElement | null;
    if (!glow) return;
    gsap.to(glow, { opacity: 0, duration: 0.3, ease: "power2.in" });
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
