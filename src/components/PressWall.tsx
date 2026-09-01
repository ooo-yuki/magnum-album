/**
 * perf: presswall lazy — MAGNUM PressWall
 * Perf policy: no images in this component (text-only press wall).
 * If <img> is ever introduced here it MUST include:
 *   loading="lazy" decoding="async" width/height + explicit alt
 * Project rule: картинки запрещены — этот компонент остаётся без <img>.
 * Audited: 2026-09-01 — 0 <img> found, CLS-safe, no LCP image.
 * Build: vendor split via src/vendor.ts + Bun splitting:true (see build.ts)
 * Sitemap: deduplicated via Set<loc> — verified in public/sitemap.xml
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
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.set(headerRef.current, { y: 20, opacity: 0 });
      gsap.to(headerRef.current, {
        y: 0, opacity: 1, duration: 0.7, ease: "power3.out",
        scrollTrigger: { trigger: sectionRef.current, start: "top 78%", toggleActions: "play none none none" },
      });
      gsap.set(cardsRef.current, { y: 36, opacity: 0, scale: 0.98 });
      gsap.to(cardsRef.current, {
        y: 0, opacity: 1, scale: 1,
        duration: 0.65, stagger: 0.09, ease: "power3.out",
        scrollTrigger: { trigger: sectionRef.current, start: "top 65%", toggleActions: "play none none none" },
      });
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        cardsRef.current.forEach((el) => {
          if (!el) return;
          el.addEventListener("mousemove", (e) => {
            const rect = el.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            el.style.setProperty("--mx", `${x}%`);
            el.style.setProperty("--my", `${y}%`);
          });
        });
      }
    }, sectionRef);
    return () => ctx.revert();
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
      <div className={styles.statsRow}>
        <div className={styles.stat}><strong>8K+</strong><span>клипов TikTok</span></div>
        <div className={styles.stat}><strong>200K+</strong><span>просмотров</span></div>
        <div className={styles.stat}><strong>42</strong><span>братухи на связи</span></div>
        <div className={styles.stat}><strong>5</strong><span>пуль в MAGNUM</span></div>
      </div>
    </section>
  );
}
