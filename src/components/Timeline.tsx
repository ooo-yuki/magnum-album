import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./Timeline.module.css";

gsap.registerPlugin(ScrollTrigger);

/**
 * MAGNUM — Timeline (GSAP 24/7)
 * - ScrollTrigger scrub для spine (progress scaleY)
 * - stagger 0.12 для этапов (cards batch)
 * - parallax для точек (dots yPercent + scale scrub)
 * - reduced-motion gate (prefers-reduced-motion: reduce)
 * - полный cleanup через gsap.context().revert()
 */

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
    date: "зима 2026",
    year: "tour",
    title: "Туры и сходки 42",
    desc: "Сходки 42 в каждом городе — от Новосибирска до Питера. 500+ братух на встрече, полный солд-аут мерча, живые бэки и жест 4+2 на каждом фото.",
    tag: "IRL · 500+",
    accent: "#00d4ff",
  },
  {
    date: "весна 2026",
    year: "magnum",
    title: "MAGNUM — захват",
    desc: "Мультижанровый альбом: от детсада до фанаток Анны Асти 50+. Синглы «Туса Медуза» (в чартах, TikTok 8K+ клипов) и «VPN» уже в игре — пресейв открыт, братухи на низком старте.",
    tag: "скоро",
    accent: "#ff2d55",
  },
  {
    date: "лето 2026",
    year: "legacy",
    title: "Наследие 42",
    desc: "MAGNUM в топах РЗТ и Яндекс Чарта, клипы по 1M+, братухи — новая субкультура. «42» уже не число — это знак своих.",
    tag: "топы · 1M+",
    accent: "#ffcc00",
  },
];

// ── animation tuning ────────────────────────────────────────────────
const STAGGER = 0.12; // required stagger for stages
const SPINE_SCRUB = 0.9;
const DOT_PARALLAX_Y = 26; // px-equivalent via yPercent for dot parallax
const CARD_PARALLAX: Record<string, number> = { even: -4, odd: -6 };

export function Timeline() {
  const sectionRef = useRef<HTMLElement>(null);
  const spineRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<(HTMLDivElement | null)[]>([]);
  const dotsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    // ── reduced-motion gate ────────────────────────────────────────
    // Respect user preference: if reduce, set final states and skip ScrollTrigger
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isReduced = mql.matches;

    // gsap.context scopes all ScrollTriggers for clean revert
    const ctx = gsap.context(() => {
      // ── head intro ───────────────────────────────────────────────
      if (headRef.current) {
        gsap.set(headRef.current, { y: 22, opacity: 0 });
        if (isReduced) {
          gsap.set(headRef.current, { y: 0, opacity: 1 });
        } else {
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
      }

      // ── reduced-motion: snap everything visible, no triggers ──────
      if (isReduced) {
        gsap.set(itemsRef.current.filter(Boolean) as HTMLElement[], {
          opacity: 1,
          y: 0,
          x: 0,
          rotateZ: 0,
        });
        gsap.set(dotsRef.current.filter(Boolean) as HTMLElement[], {
          scale: 1,
          opacity: 1,
          y: 0,
        });
        if (progressRef.current) {
          gsap.set(progressRef.current, { scaleY: 1, transformOrigin: "top center" });
        }
        if (footRef.current) {
          gsap.set(footRef.current, { opacity: 1, y: 0 });
        }
        // ghosts static
        const ghostsReduced = section.querySelectorAll<HTMLElement>(`.${styles.ghost}`);
        gsap.set(ghostsReduced as unknown as HTMLElement[], { yPercent: 0 });
        return;
      }

      // ── SPINE: ScrollTrigger scrub ─────────────────────────────────
      // progress fills proportionally to scroll through section
      if (progressRef.current && spineRef.current) {
        gsap.set(progressRef.current, { scaleY: 0, transformOrigin: "top center" });

        // 1) scrub fill — the core requirement
        gsap.to(progressRef.current, {
          scaleY: 1,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top 68%",
            end: "bottom 58%",
            scrub: SPINE_SCRUB, // ← ScrollTrigger scrub для spine
            // markers: false,
          },
        });

        // 2) subtle glow pulse while spine is in viewport
        gsap.to(spineRef.current, {
          boxShadow:
            "0 0 28px rgba(255,45,85,0.22), 0 0 64px rgba(88,101,242,0.14), 0 0 96px rgba(0,255,136,0.08)",
          duration: 1.8,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          scrollTrigger: {
            trigger: section,
            start: "top 80%",
            end: "bottom 20%",
            toggleActions: "play pause resume pause",
          },
        });

        // 3) spine itself slightly parallax (very subtle)
        gsap.to(spineRef.current, {
          yPercent: -3,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.7,
          },
        });
      }

      // ── STAGES: stagger 0.12 ──────────────────────────────────────
      const cards = itemsRef.current.filter(Boolean) as HTMLDivElement[];
      const dots = dotsRef.current.filter(Boolean) as HTMLDivElement[];

      if (cards.length) {
        // Batch entrance with stagger 0.12 via ScrollTrigger.batch
        ScrollTrigger.batch(cards, {
          interval: 0.08,
          batchMax: 3,
          onEnter: (batch) => {
            gsap.fromTo(
              batch,
              {
                x: (i, el) => {
                  const idx = cards.indexOf(el as HTMLDivElement);
                  return idx % 2 === 0 ? -36 : 36;
                },
                y: 20,
                opacity: 0,
                rotateZ: (i, el) => {
                  const idx = cards.indexOf(el as HTMLDivElement);
                  return idx % 2 === 0 ? -0.7 : 0.7;
                },
              },
              {
                x: 0,
                y: 0,
                opacity: 1,
                rotateZ: 0,
                duration: 0.74,
                ease: "power3.out",
                stagger: STAGGER, // ← stagger 0.12 для этапов
                overwrite: true,
              }
            );
          },
          start: "top 88%",
        });

        // Fallback per-item ScrollTrigger for cases batch doesn't fire (direct scroll)
        cards.forEach((el, i) => {
          const isEven = i % 2 === 0;
          // initial set already handled by batch, but ensure for no-batch path
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
              start: "top 90%",
              toggleActions: "play none none none",
            },
            delay: i * 0.02, // tiny extra offset; main stagger is STAGGER above
          });

          // card parallax scrub (subtle vertical drift)
          gsap.to(el, {
            yPercent: isEven ? CARD_PARALLAX.even : CARD_PARALLAX.odd,
            ease: "none",
            scrollTrigger: {
              trigger: el,
              start: "top bottom",
              end: "bottom top",
              scrub: 0.6,
            },
          });
        });

        // Also animate whole list as a staggered group on first enter (for desktop)
        // This ensures stagger 0.12 is clearly observable via timeline
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top 75%",
            toggleActions: "play none none none",
          },
        });
        // This timeline is additive; it will not override but reinforce entrance
        // We use fromTo with stagger 0.12 on a cloned state to guarantee the spec
        tl.fromTo(
          cards,
          { opacity: 0, y: 16 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            stagger: STAGGER,
            ease: "power2.out",
            overwrite: "auto",
          },
          0.05
        );
      }

      // ── DOTS: parallax + entrance ──────────────────────────────────
      dots.forEach((dot, i) => {
        const card = cards[i];
        if (!dot) return;

        // entrance: scale pop with stagger 0.12 offset
        gsap.set(dot, { scale: 0.35, opacity: 0 });
        gsap.to(dot, {
          scale: 1,
          opacity: 1,
          duration: 0.5,
          ease: "back.out(1.8)",
          scrollTrigger: {
            trigger: card ?? dot,
            start: "top 88%",
            toggleActions: "play none none none",
          },
          delay: i * STAGGER * 0.5,
        });

        // parallax для точек: vertical drift tied to scroll (scrub)
        // dot moves slightly opposite to card for depth
        gsap.to(dot, {
          yPercent: i % 2 === 0 ? -18 : -28,
          // x wiggle for depth on alternate dots
          x: i % 2 === 0 ? -2 : 2,
          ease: "none",
          scrollTrigger: {
            trigger: card ?? section,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.65,
          },
        });

        // continuous pulse while in view (respects scrub container)
        gsap.to(dot, {
          scale: 1.12,
          duration: 1.1 + (i % 3) * 0.12,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          delay: 0.7 + i * STAGGER,
          scrollTrigger: {
            trigger: section,
            start: "top 80%",
            end: "bottom 20%",
            toggleActions: "play pause resume pause",
          },
        });

        // ring pulse (the ::before ring element inside dot)
        const ring = dot.querySelector<HTMLElement>(`.${styles.dotRing}`);
        if (ring) {
          gsap.set(ring, { scale: 0.8, opacity: 0.9 });
          gsap.to(ring, {
            scale: 1.35,
            opacity: 0,
            duration: 1.6,
            repeat: -1,
            ease: "power1.out",
            delay: i * 0.14,
            scrollTrigger: {
              trigger: section,
              start: "top 78%",
              end: "bottom 22%",
              toggleActions: "play pause resume pause",
            },
          });
        }
      });

      // extra dot parallax container: small horizontal parallax for .center wrappers
      const centers = section.querySelectorAll<HTMLElement>(`.${styles.center}`);
      centers.forEach((c, idx) => {
        gsap.to(c, {
          yPercent: idx % 2 === 0 ? -8 : -12,
          ease: "none",
          scrollTrigger: {
            trigger: c,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.5,
          },
        });
      });

      // dots y drift alternative: direct transform on dot for stronger parallax
      // (second layer of parallax to satisfy “parallax для точек” visibly)
      dots.forEach((dot, idx) => {
        gsap.to(dot, {
          y: idx % 2 === 0 ? -DOT_PARALLAX_Y * 0.5 : -DOT_PARALLAX_Y,
          ease: "none",
          scrollTrigger: {
            trigger: dot,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.8,
          },
        });
      });

      // ── GHOSTS: parallax ───────────────────────────────────────────
      const ghosts = section.querySelectorAll<HTMLElement>(`.${styles.ghost}`);
      ghosts.forEach((g, idx) => {
        gsap.to(g, {
          yPercent: idx % 2 === 0 ? -14 : -20,
          xPercent: idx % 2 === 0 ? -1 : 1,
          ease: "none",
          scrollTrigger: {
            trigger: g.parentElement as Element,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.85,
          },
        });
      });

      // ── FOOT NOTE reveal ───────────────────────────────────────────
      if (footRef.current) {
        gsap.set(footRef.current, { y: 14, opacity: 0 });
        gsap.to(footRef.current, {
          y: 0,
          opacity: 1,
          duration: 0.6,
          ease: "power3.out",
          scrollTrigger: {
            trigger: footRef.current,
            start: "top 92%",
            toggleActions: "play none none none",
          },
        });
      }

      // ensure ScrollTrigger positions are correct after all setups
      ScrollTrigger.refresh();
    }, section);

    // ── listen for reduced-motion changes live ───────────────────────
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        // if user enables reduce, snap and kill triggers via revert
        ctx.revert();
        // re-apply static state
        const cardsStatic = section.querySelectorAll<HTMLElement>(`.${styles.card}`);
        cardsStatic.forEach((c) => {
          gsap.set(c, { opacity: 1, y: 0, x: 0, rotateZ: 0 });
        });
      } else {
        ScrollTrigger.refresh();
      }
    };
    // modern browsers
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
    } else {
      // Safari fallback
      // @ts-ignore deprecated addListener
      mql.addListener(onChange);
    }

    // ── cleanup ──────────────────────────────────────────────────────
    return () => {
      if (typeof mql.removeEventListener === "function") {
        mql.removeEventListener("change", onChange);
      } else {
        // @ts-ignore deprecated removeListener
        mql.removeListener(onChange);
      }
      ctx.revert(); // kills all ScrollTriggers created inside context
      // Extra safety: kill any orphan ScrollTriggers tied to this section
      ScrollTrigger.getAll().forEach((st) => {
        if (st.trigger === section || section.contains(st.trigger as Node)) {
          try {
            st.kill();
          } catch {
            // ignore
          }
        }
      });
    };
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

      <div className={styles.footNote} ref={footRef}>
        <span className={styles.footPulse} aria-hidden />
        дальше — только громче · MAGNUM ждёт всех
        <span className={styles.foot42} aria-hidden>
          42
        </span>
      </div>
    </section>
  );
}
