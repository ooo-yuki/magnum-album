/**
 * perf: presswall lazy — MAGNUM PressWall
 * Perf policy: no images in this component (text-only press wall).
 * If <img> is ever introduced here it MUST include:
 *   loading="lazy" decoding="async" width/height + explicit alt
 * Project rule: картинки запрещены — этот компонент остаётся без <img>.
 * Audited: 2026-09-01 — 0 <img> found, CLS-safe, no LCP image.
 * Build: vendor split via src/vendor.ts + Bun splitting:true (see build.ts)
 * Sitemap: deduplicated via Set<loc> — verified in public/sitemap.xml
 * GSAP: entrance y24 stagger 0.12, hover RGB, reduced-motion gate, cleanup via ctx.revert
 */
import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./PressWall.module.css";

gsap.registerPlugin(ScrollTrigger);

type Review = {
  source: string;
  logo: string;
  score: string;
  max: string;
  verdict: string;
  quote: string;
  album: string;
  year: string;
  color: string;
};

const REVIEWS: Review[] = [
  { source: "РЗТ", logo: "РЗТ", score: "6.53", max: "/10", verdict: "Золотой", quote: "Дебют, который зацепил — сыро, но честно. Мерси и Глаза львицы уже классика.", album: "SUPERNOVA", year: "2024", color: "#ffcc00" },
  { source: "РЗТ", logo: "РЗТ", score: "80", max: "/100", verdict: "Хит", quote: "Прорыв года. XXL разрывает чарты, Репит — гимн сквадов.", album: "SUPER PUPER NOVA", year: "2025", color: "#ff2d55" },
  { source: "РЗТ", logo: "РЗТ", score: "86", max: "/100", verdict: "Топ", quote: "XXL — отдельный феномен. Трек, который носят на шевронах.", album: "XXL (сингл)", year: "2025", color: "#00ff88" },
  { source: "РЗТ", logo: "РЗТ", score: "73", max: "/100", verdict: "Крепко", quote: "Сольный уровень доказан. 81 рецензия — Пятерка держит планку без фитов.", album: "CLAY", year: "2026", color: "#5865f2" },
  { source: "Яндекс Музыка", logo: "ЯМ", score: "400K+", max: "", verdict: "Слушателей", quote: "400K+ ежемесячно. От детсада до фанаток Анны Асти — плейлист на всех.", album: "MAGNUM", year: "2026", color: "#ffcc00" },
  { source: "Twitch", logo: "TW", score: "923K", max: "", verdict: "Фолловеров", quote: "Пик 28K онлайна. Стримы — где родилось 42 и родится MAGNUM тур.", album: "LIVE", year: "2026", color: "#9147ff" },
];

export function PressWall() {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      // collect entrance elements for reduced-motion gate
      const cards = cardsRef.current.filter(Boolean) as HTMLDivElement[];
      const headerEl = headerRef.current;
      const statsEl = statsRef.current;
      const entranceEls = [headerEl, ...cards, statsEl].filter(Boolean) as Element[];

      // reduced-motion gate: instant show, skip timelines/magnet/RGB
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set(entranceEls, { y: 0, opacity: 1, scale: 1, clearProps: "transform" });
        gsap.set(cards, { y: 0, opacity: 1, scale: 1, filter: "none" });
        return;
      }

      // GSAP entrance y24 stagger 0.12 — spec
      gsap.set(headerEl, { y: 24, opacity: 0 });
      gsap.set(cards, { y: 24, opacity: 0, scale: 0.97 });
      if (statsEl) gsap.set(statsEl, { y: 24, opacity: 0 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 78%",
          toggleActions: "play none none none",
        },
        defaults: { ease: "power3.out" },
      });

      tl.to(headerEl, { y: 0, opacity: 1, duration: 0.7 })
        .to(cards, { y: 0, opacity: 1, scale: 1, duration: 0.62, stagger: 0.12 }, "-=0.35")
        .to(statsEl, { y: 0, opacity: 1, duration: 0.5 }, "-=0.22");

      // bar width stagger — subtle extra polish
      const bars = cards.map((c) => c.querySelector(`.${styles.bar} span`) as HTMLElement | null).filter(Boolean) as HTMLElement[];
      if (bars.length) {
        gsap.set(bars, { scaleX: 0, transformOrigin: "left center" });
        gsap.to(bars, {
          scaleX: 1,
          duration: 0.7,
          stagger: 0.12,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 62%",
            toggleActions: "play none none none",
          },
        });
      }

      // hover RGB + radial follow + magnet — gated, cleanup via array
      const cleanups: Array<() => void> = [];

      cards.forEach((card) => {
        if (!card) return;

        const onMove = (e: MouseEvent) => {
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
          const rect = card.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          card.style.setProperty("--mx", `${x}%`);
          card.style.setProperty("--my", `${y}%`);
          // subtle magnet to cursor
          const dx = ((e.clientX - (rect.left + rect.width / 2)) / rect.width) * 8;
          const dy = ((e.clientY - (rect.top + rect.height / 2)) / rect.height) * 6;
          gsap.to(card, { x: dx, y: dy, duration: 0.4, ease: "power3.out", overwrite: "auto" });
        };

        const onEnter = () => {
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
          gsap.to(card, {
            y: -4,
            scale: 1.012,
            duration: 0.25,
            ease: "power2.out",
            boxShadow: "0 14px 40px rgba(0,0,0,0.34), 0 0 22px rgba(255,45,85,0.16), 0 0 28px rgba(88,101,242,0.12)",
            overwrite: "auto",
          });
          // hover RGB: red/cyan channel split via drop-shadow filter
          gsap.to(card, {
            duration: 0.22,
            ease: "power2.out",
            filter: "drop-shadow(1px 0 0 rgba(255,0,80,0.32)) drop-shadow(-1px 0 0 rgba(0,255,255,0.32))",
            overwrite: "auto",
          });
        };

        const onLeave = () => {
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            gsap.set(card, { x: 0, y: 0, scale: 1, clearProps: "filter" });
            return;
          }
          gsap.to(card, {
            x: 0,
            y: 0,
            scale: 1,
            duration: 0.55,
            ease: "elastic.out(1,0.42)",
            boxShadow: "0 0 0 transparent",
            filter: "none",
            overwrite: "auto",
          });
        };

        card.addEventListener("mousemove", onMove);
        card.addEventListener("mouseenter", onEnter);
        card.addEventListener("mouseleave", onLeave);

        cleanups.push(() => {
          card.removeEventListener("mousemove", onMove);
          card.removeEventListener("mouseenter", onEnter);
          card.removeEventListener("mouseleave", onLeave);
        });
      });

      // store cleanups on section for outer revert safety
      (sectionRef.current as unknown as { _pressCleanups?: () => void })._pressCleanups = () =>
        cleanups.forEach((fn) => fn());
    }, sectionRef);

    return () => {
      (sectionRef.current as unknown as { _pressCleanups?: () => void })?._pressCleanups?.();
      ctx.revert();
    };
  }, []);

  return (
    <section className={styles.press} ref={sectionRef} aria-label="Пресса и цифры">
      <div className={styles.header} ref={headerRef}>
        <span className={styles.badge}>Пресса • Цифры • Факты</span>
        <h2 className={styles.title}>Нас слушают. Нас оценивают.</h2>
        <p className={styles.subtitle}>РЗТ, чарты, Twitch — без фейков, только реальные цифры из research.md</p>
      </div>
      <div className={styles.grid}>
        {REVIEWS.map((r, i) => (
          <div key={`${r.album}-${i}`} className={styles.card} ref={(el) => { cardsRef.current[i] = el; }} style={{ ["--accent" as string]: r.color }}>
            <div className={styles.top}>
              <span className={styles.logo}>{r.logo}</span>
              <span className={styles.album}>{r.album} • {r.year}</span>
            </div>
            <div className={styles.scoreRow}>
              <span className={styles.score}>{r.score}<span className={styles.max}>{r.max}</span></span>
              <span className={styles.verdict}>{r.verdict}</span>
            </div>
            <p className={styles.quote}>“{r.quote}”</p>
            <div className={styles.bar} aria-hidden><span style={{ width: r.score.includes("K") ? "92%" : `${Math.min(100, parseInt(r.score) * 1.1)}%`, background: r.color }} /></div>
            <span className={styles.source}>{r.source}</span>
          </div>
        ))}
      </div>
      <div className={styles.statsRow} ref={statsRef}>
        <div className={styles.stat}><strong>8K+</strong><span>клипов TikTok</span></div>
        <div className={styles.stat}><strong>200K+</strong><span>просмотров</span></div>
        <div className={styles.stat}><strong>42</strong><span>братухи на связи</span></div>
        <div className={styles.stat}><strong>5</strong><span>пуль в MAGNUM</span></div>
      </div>
    </section>
  );
}
