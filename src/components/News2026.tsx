import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./News2026.module.css";

gsap.registerPlugin(ScrollTrigger);

type NewsItem = {
  date: string;
  badge: string;
  badgeVariant: "album" | "single" | "ep" | "live" | "presave" | "chart";
  title: string;
  fact: string;
  link: string;
  linkLabel: string;
  accent: string;
  featured?: boolean;
};

const NEWS: NewsItem[] = [
  {
    date: "Осень 2026",
    badge: "Альбом",
    badgeVariant: "album",
    title: "MAGNUM — 5 пуль",
    fact: "5 треков — 5 пуль. Финальный совместный альбом 5opka × MellSher. Мультижанровый, продакшн Drumedy, лейбл The Fence. Последний аккорд дуэта перед соло-главой.",
    link: "https://music.thefence.me/psmagnum",
    linkLabel: "Пресейв альбома",
    accent: "#ff2d55",
    featured: true,
  },
  {
    date: "14.08.2026",
    badge: "Сингл • Чарты",
    badgeVariant: "chart",
    title: "ТУСА МЕДУЗА в чартах",
    fact: "8K+ клипов в TikTok, 200K+ просмотров. 5opka, MellSher, Вова Солодков — 2:07 чистого лета. Первый выстрел MAGNUM уже в плейлистах.",
    link: "https://youtu.be/Mz69bLRpBEs",
    linkLabel: "Смотреть клип",
    accent: "#00ff88",
  },
  {
    date: "2026",
    badge: "Сингл",
    badgeVariant: "single",
    title: "VPN — второй сингл",
    fact: "Поп-вайб на 2:23. Второй сингл эры MAGNUM — уже в ротации РЗТ и на всех площадках. Дежавю-поп от дуэта, который не умеет мимо.",
    link: "https://risazatvorchestvo.com/track/vpn",
    linkLabel: "РЗТ • VPN",
    accent: "#5865f2",
  },
  {
    date: "03.04.2026",
    badge: "EP • РЗТ 73/100",
    badgeVariant: "ep",
    title: "CLAY — сольный уровень",
    fact: "5 треков, 81 рецензия на РЗТ. CLAY = Clowns Laugh At You — пасхалка 10 лет, спрятанная в конце видео. «СЛАВА БОССУ» — марш 42 братух.",
    link: "https://risazatvorchestvo.com/album/clay",
    linkLabel: "Рецензии РЗТ",
    accent: "#ffcc00",
  },
  {
    date: "2026",
    badge: "LIVE • Тур",
    badgeVariant: "live",
    title: "MAGNUM тур — скоро",
    fact: "923K фолловеров Twitch, пик 28K онлайна. Стримы где родилось «42» теперь выходят оффлайн — города и даты скоро на канале.",
    link: "https://t.me/NE_5OPKA",
    linkLabel: "Telegram 5opka",
    accent: "#9147ff",
  },
  {
    date: "Открыт сейчас",
    badge: "PRE-SAVE",
    badgeVariant: "presave",
    title: "Пресейв MAGNUM",
    fact: "Один клик — и 5 пуль прилетят первыми. Добавь альбом в Яндекс Музыку, Spotify, Apple Music через Bandlink The Fence.",
    link: "https://music.thefence.me/psmagnum",
    linkLabel: "music.thefence.me/psmagnum",
    accent: "#ff2d55",
    featured: true,
  },
];

export function News2026() {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLAnchorElement | null)[]>([]);
  const decorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const section = sectionRef.current;
    const ctx = gsap.context(() => {
      // header reveal
      gsap.set(headerRef.current, { y: 28, opacity: 0 });
      gsap.to(headerRef.current, {
        y: 0,
        opacity: 1,
        duration: 0.75,
        ease: "power3.out",
        scrollTrigger: {
          trigger: section,
          start: "top 82%",
          toggleActions: "play none none none",
        },
      });

      // decor line grow
      if (decorRef.current) {
        gsap.set(decorRef.current, { scaleX: 0, transformOrigin: "left center" });
        gsap.to(decorRef.current, {
          scaleX: 1,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: {
            trigger: section,
            start: "top 75%",
            toggleActions: "play none none none",
          },
        });
      }

      // cards stagger
      gsap.set(cardsRef.current, { y: 40, opacity: 0, scale: 0.97, rotateX: 6 });
      gsap.to(cardsRef.current, {
        y: 0,
        opacity: 1,
        scale: 1,
        rotateX: 0,
        duration: 0.7,
        stagger: 0.1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: section,
          start: "top 62%",
          toggleActions: "play none none none",
        },
      });

      // parallax on featured cards
      cardsRef.current.forEach((el, i) => {
        if (!el || !NEWS[i]?.featured) return;
        gsap.to(el, {
          yPercent: -4,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.8,
          },
        });
      });

      // hover RGB tracking
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        cardsRef.current.forEach((el) => {
          if (!el) return;
          const onMove = (e: MouseEvent) => {
            const r = el.getBoundingClientRect();
            const x = ((e.clientX - r.left) / r.width) * 100;
            const y = ((e.clientY - r.top) / r.height) * 100;
            el.style.setProperty("--mx", `${x}%`);
            el.style.setProperty("--my", `${y}%`);
          };
          el.addEventListener("mousemove", onMove);
          // cleanup via context revert will remove but also manually on unmount
        });
      }
    }, section);
    return () => ctx.revert();
  }, []);

  return (
    <section className={styles.news} ref={sectionRef} aria-label="2026: сейчас — инфоповоды">
      <div className={styles.inner}>
        <div className={styles.header} ref={headerRef}>
          <div className={styles.kickerRow}>
            <span className={styles.kicker}>2026: сейчас</span>
            <span className={styles.liveDot} aria-hidden>
              <i />
              LIVE
            </span>
          </div>
          <h2 className={styles.title}>
            Всё что <span>происходит</span> прямо сейчас
          </h2>
          <p className={styles.subtitle}>
            MAGNUM на подходе — 5 пуль, два сингла в чартах, сольный CLAY на РЗТ 73 и тур на горизонте. Шесть фактов без воды.
          </p>
          <div className={styles.decor} ref={decorRef} aria-hidden />
        </div>

        <div className={styles.grid}>
          {NEWS.map((n, i) => (
            <a
              key={`${n.title}-${i}`}
              href={n.link}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.card} ${n.featured ? styles.featured : ""}`}
              ref={(el) => {
                cardsRef.current[i] = el;
              }}
              style={{ ["--accent" as string]: n.accent }}
              aria-label={`${n.title} — ${n.linkLabel}`}
            >
              <div className={styles.cardTop}>
                <time className={styles.date} dateTime={n.date}>
                  {n.date}
                </time>
                <span className={`${styles.badge} ${styles[n.badgeVariant]}`}>{n.badge}</span>
              </div>

              <h3 className={styles.cardTitle}>{n.title}</h3>
              <p className={styles.fact}>{n.fact}</p>

              <span className={styles.linkRow}>
                <span className={styles.linkText}>{n.linkLabel}</span>
                <span className={styles.arrow} aria-hidden>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </span>

              <span className={styles.accentLine} aria-hidden />
            </a>
          ))}
        </div>

        <div className={styles.footerNote}>
          <span>Источник: research.md • РЗТ • Яндекс Музыка • Twitch</span>
          <a href="https://music.thefence.me/psmagnum" target="_blank" rel="noopener noreferrer" className={styles.footerCta}>
            Пресейв MAGNUM →
          </a>
        </div>
      </div>
    </section>
  );
}
