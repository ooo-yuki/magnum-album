import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./Timeline.module.css";

gsap.registerPlugin(ScrollTrigger);

interface Milestone {
  date: string;
  title: string;
  desc: string;
  accent?: string;
}

const MILESTONES: Milestone[] = [
  { date: "2011", title: "Сервер СП", desc: "Кирилл запускает легендарный сервер СП — кузница комьюнити, первые братухи собираются вокруг.", accent: "Начало" },
  { date: "дек 2023", title: "Рождение 42", desc: "На стриме рождается движение 42 братухи — культ безудержного веселья и хайпа.", accent: "42" },
  { date: "2024", title: "Шуба-сквады", desc: "Формируются сквады по городам: Шуба, НАХ, Хай — армия братух растёт.", accent: "Сквады" },
  { date: "фев 2025", title: "Трек «42» — 2.2M", desc: "Релиз гимна движения, поддержка Маликова 24.02.2025 — признание на федеральном уровне.", accent: "Хит" },
  { date: "2026", title: "MAGNUM — 5 пуль", desc: "Новый альбом MAGNUM: 5 треков как 5 пуль из напечатанного пистолета. Пресейв открыт.", accent: "Сейчас" },
];

export function Timeline() {
  const sectionRef = useRef<HTMLElement>(null);
  const itemsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.set(itemsRef.current, { y: 40, opacity: 0 });
      gsap.to(itemsRef.current, {
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 75%",
          toggleActions: "play none none none",
        },
        y: 0,
        opacity: 1,
        stagger: 0.12,
        duration: 0.7,
        ease: "power3.out",
      });
      // line grow
      gsap.fromTo(
        `.${styles.line}`,
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 70%",
            end: "bottom 70%",
            scrub: 0.6,
          },
        }
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section className={styles.timeline} ref={sectionRef} aria-label="История 42">
      <div className={styles.header}>
        <span className={styles.badge}>История</span>
        <h2 className={styles.title}>От СП до MAGNUM</h2>
        <p className={styles.subtitle}>Пять пуль — пять вех. Мы уже победили.</p>
      </div>
      <div className={styles.track}>
        <div className={styles.line} aria-hidden />
        {MILESTONES.map((m, i) => (
          <div key={m.date} className={styles.item} ref={(el) => { itemsRef.current[i] = el; }}>
            <div className={styles.dot} aria-hidden>
              <span />
            </div>
            <div className={styles.card}>
              <div className={styles.meta}>
                <span className={styles.date}>{m.date}</span>
                {m.accent && <span className={styles.accent}>{m.accent}</span>}
              </div>
              <h3 className={styles.cardTitle}>{m.title}</h3>
              <p className={styles.cardDesc}>{m.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
