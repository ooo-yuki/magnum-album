import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./Timeline.module.css";

gsap.registerPlugin(ScrollTrigger);

type Milestone = {
  date: string;
  year: string;
  title: string;
  desc: string;
  tag: string;
  accent: string;
};

const STEPS: Milestone[] = [
  {
    date: "2011 — 2019",
    year: " genesis",
    title: "Пески и СП",
    desc: "Начинал с Minecraft-летсплеев, рос как голос поколения. Сервер Подписчиков — первый дом комьюнити, где зародился стиль Пятёрки: ирония, свобода, «кринжа не существует».",
    tag: "YouTube · Minecraft",
    accent: "#ff2d55",
  },
  {
    date: "2021 — 2022",
    year: "twitch",
    title: "Хрост и вайб",
    desc: "Твич на 800K+, ежедневные стримы, Хрост и легенды чата. Формирование ядра — будущие братухи собираются вокруг стрима, рождается общий язык.",
    tag: "923K фолловеров",
    accent: "#ffcc00",
  },
  {
    date: "декабрь 2023",
    year: "42",
    title: "«42, братуха!»",
    desc: "На пересмотре «Автостопом по Галактике» звучит ответ на главный вопрос — 42. Пародия на «52» от Guacamolemolly становится культом: Кемеровская область, жест 4+2, «везде 42».",
    tag: "Мем года SLAY",
    accent: "#00ff88",
  },
  {
    date: "2024",
    year: "supernova",
    title: "Сквады по всей стране",
    desc: "SUPERNOVA, сходки, лимузины по ТЦ, Шуба-сквад из Питера, НАХ из Москвы — 42 расползается по России. Дважды «Человек-мем года» на SLAY, клип «42» набирает 2.2M.",
    tag: "SLAY Awards ×2",
    accent: "#5865f2",
  },
  {
    date: "2025",
    year: "clay",
    title: "CLAY × SUPER PUPER NOVA",
    desc: "5 EP подряд: «SUPER PUPER NOVA» — 80 баллов РЗТ, трек «XXL» — 86 баллов и хит июля, сольный «CLAY» с «Слава Боссу». Drumedy на проде, The Fence на лейбле.",
    tag: "XXL — 86 РЗТ",
    accent: "#ff6b35",
  },
  {
    date: "2026",
    year: "magnum",
    title: "MAGNUM — захват",
    desc: "Мультижанровый альбом: от детсада до фанаток Анны Асти 50+. Синглы «Туса Медуза» (в чартах, TikTok 8K+ клипов) и «VPN» уже в игре — пресейв открыт, братухи на низком старте.",
    tag: "скоро",
    accent: "#ff2d55",
  },
];

export function Timeline() {
  const sectionRef = useRef<HTMLElement>(null);
  const spineRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<(HTMLDivElement | null)[]>([]);
  const dotsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!sectionRef.current) return;
    const section = sectionRef.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      if (headRef.current) {
        gsap.set(headRef.current, { y: 22, opacity: 0 });
        gsap.to(headRef.current, {
          y: 0,
          opacity: 1,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: {
            trigger: headRef.current,
            start: "top 86%",
            toggleActions: "play none none none",
          },
        });
      }

      if (reduce) {
        gsap.set(itemsRef.current, { opacity: 1, y: 0, x: 0 });
        gsap.set(dotsRef.current, { scale: 1, opacity: 1 });
        if (progressRef.current) gsap.set(progressRef.current, { scaleY: 1 });
        return;
      }

      if (progressRef.current && spineRef.current) {
        gsap.set(progressRef.current, { scaleY: 0, transformOrigin: "top center" });
        gsap.to(progressRef.current, {
          scaleY: 1,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top 68%",
            end: "bottom 58%",
            scrub: 0.9,
          },
        });
        gsap.to(spineRef.current, {
          boxShadow: "0 0 28px rgba(255,45,85,0.22), 0 0 64px rgba(88,101,242,0.14)",
          duration: 1.6,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          scrollTrigger: {
            trigger: section,
            start: "top 80%",
            toggleActions: "play pause resume pause",
          },
        });
      }

      itemsRef.current.forEach((el, i) => {
        if (!el) return;
        const isEven = i % 2 === 0;
        gsap.set(el, {
          x: isEven ? -34 : 34,
          y: 18,
          opacity: 0,
          rotateZ: isEven ? -0.6 : 0.6,
        });
        gsap.to(el, {
          x: 0,
          y: 0,
          opacity: 1,
          rotateZ: 0,
          duration: 0.72,
          ease: "power3.out",
          scrollTrigger: {
            trigger: el,
            start: "top 88%",
            toggleActions: "play none none none",
          },
          delay: i * 0.04,
        });
        gsap.to(el, {
          yPercent: isEven ? -4 : -6,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.6,
          },
        });
      });

      dotsRef.current.forEach((dot, i) => {
        if (!dot) return;
        gsap.set(dot, { scale: 0.4, opacity: 0 });
        gsap.to(dot, {
          scale: 1,
          opacity: 1,
          duration: 0.5,
          ease: "back.out(1.8)",
          scrollTrigger: {
            trigger: itemsRef.current[i],
            start: "top 88%",
            toggleActions: "play none none none",
          },
        });
        gsap.to(dot, {
          scale: 1.12,
          duration: 1.1,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          delay: 0.7 + i * 0.12,
          scrollTrigger: {
            trigger: section,
            start: "top 80%",
            toggleActions: "play pause resume pause",
          },
        });
      });

      const ghosts = section.querySelectorAll<HTMLElement>(`.${styles.ghost}`);
      ghosts.forEach((g, idx) => {
        gsap.to(g, {
          yPercent: idx % 2 === 0 ? -12 : -18,
          ease: "none",
          scrollTrigger: {
            trigger: g.parentElement,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.8,
          },
        });
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section className={styles.timeline} ref={sectionRef} aria-labelledby="timeline-title">
      <div className={styles.head} ref={headRef}>
        <div className={styles.kicker}>
          <span className={styles.kickerDot} aria-hidden />
          ПЯТЁРКА × 42 — ХРОНОЛОГИЯ
          <span className={styles.kickerCount} aria-hidden>
            42
          </span>
        </div>
        <h2 id="timeline-title" className={styles.title}>
          От СП до <span className={styles.titleAccent}>MAGNUM</span>
        </h2>
        <p className={styles.subtitle}>
          Шесть этапов, которые сделали 42 братух явлением — от сервера подписчиков до
          мультижанрового захвата чартов.
        </p>
      </div>

      <div className={styles.trackWrap}>
        <div className={styles.spine} ref={spineRef} aria-hidden>
          <div className={styles.progress} ref={progressRef} />
        </div>

        <ol className={styles.list}>
          {STEPS.map((s, i) => (
            <li key={s.title} className={styles.row}>
              <div
                className={styles.card}
                ref={(el) => {
                  itemsRef.current[i] = el;
                }}
                style={{ ["--accent" as unknown as string]: s.accent } as React.CSSProperties}
              >
                <span className={styles.ghost} aria-hidden>
                  {s.year}
                </span>
                <div className={styles.cardTop}>
                  <span className={styles.date}>{s.date}</span>
                  <span className={styles.tag}>{s.tag}</span>
                </div>
                <h3 className={styles.cardTitle}>{s.title}</h3>
                <p className={styles.cardDesc}>{s.desc}</p>
                <div className={styles.cardFoot}>
                  <span className={styles.stepNum}>0{i + 1}</span>
                  <span className={styles.stepLine} aria-hidden />
                </div>
              </div>

              <div className={styles.center}>
                <div
                  className={styles.dot}
                  ref={(el) => {
                    dotsRef.current[i] = el;
                  }}
                  style={{ background: s.accent } as React.CSSProperties}
                  aria-hidden
                >
                  <span className={styles.dotRing} />
                  <span className={styles.dotCore} />
                </div>
              </div>

              <div className={styles.spacer} aria-hidden />
            </li>
          ))}
        </ol>
      </div>

      <div className={styles.footNote}>
        <span className={styles.footPulse} aria-hidden />
        дальше — только громче · MAGNUM ждёт всех
        <span className={styles.foot42} aria-hidden>
          42
        </span>
      </div>
    </section>
  );
}
