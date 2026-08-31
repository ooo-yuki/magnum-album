import { Link } from "react-router-dom";
import { useRef, useEffect } from "react";
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
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className={styles.section} ref={sectionRef}>
      <h2 className={styles.title}>Исследуй</h2>
      <div className={styles.grid}>
        {NAV_ITEMS.map((item) => (
          <Link key={item.to} to={item.to} className={styles.card}>
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
