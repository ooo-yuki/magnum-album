import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./CTA.module.css";

gsap.registerPlugin(ScrollTrigger);

const PRESAVE_URL =
  "https://music.yandex.ru/artist/7544304?utm_medium=copy_link&ref_id=41b45b35-e5b0-4286-9a53-2c1163828366";
const SPOTIFY_URL = "https://open.spotify.com/artist/5opka";
const YT_URL = "https://www.youtube.com/@5opka";

export function CTA() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const cardsRef = useRef<(HTMLAnchorElement | null)[]>([]);
  const shimmerRef = useRef<HTMLSpanElement>(null);
  const proofRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.set(headingRef.current, { y: 28, opacity: 0 });
      gsap.set(textRef.current, { y: 16, opacity: 0 });
      gsap.set(cardsRef.current, { y: 24, opacity: 0, scale: 0.97 });
      gsap.set(proofRef.current, { y: 12, opacity: 0 });
      gsap.to(headingRef.current, {
        scrollTrigger: { trigger: sectionRef.current, start: "top 80%", toggleActions: "play none none none" },
        y: 0, opacity: 1, duration: 0.7, ease: "power3.out",
      });
      gsap.to(textRef.current, {
        scrollTrigger: { trigger: sectionRef.current, start: "top 76%", toggleActions: "play none none none" },
        y: 0, opacity: 1, duration: 0.55, delay: 0.12,
      });
      gsap.to(cardsRef.current, {
        scrollTrigger: { trigger: sectionRef.current, start: "top 68%", toggleActions: "play none none none" },
        y: 0, opacity: 1, scale: 1, duration: 0.6, stagger: 0.1, ease: "power3.out", delay: 0.18,
      });
      gsap.to(proofRef.current, {
        scrollTrigger: { trigger: sectionRef.current, start: "top 62%", toggleActions: "play none none none" },
        y: 0, opacity: 1, duration: 0.5, delay: 0.35,
      });
      if (shimmerRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const tl = gsap.timeline({
          repeat: -1, delay: 1.2,
          scrollTrigger: { trigger: sectionRef.current, start: "top 80%", toggleActions: "play pause resume pause" },
        });
        tl.fromTo(shimmerRef.current, { x: "-120%" }, { x: "220%", duration: 1.3, ease: "power2.inOut" });
        tl.to({}, { duration: 3.2 });
      }
      const primary = cardsRef.current[0];
      if (primary && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const onMove = (e: MouseEvent) => {
          const r = primary.getBoundingClientRect();
          const dx = ((e.clientX - (r.left + r.width / 2)) / r.width) * 10;
          const dy = ((e.clientY - (r.top + r.height / 2)) / r.height) * 7;
          gsap.to(primary, { x: dx, y: dy, duration: 0.4, ease: "power3.out", overwrite: "auto" });
        };
        const onLeave = () => gsap.to(primary, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1,0.4)" });
        primary.addEventListener("mousemove", onMove);
        primary.addEventListener("mouseleave", onLeave);
        (primary as unknown as { _cleanup?: () => void })._cleanup = () => {
          primary.removeEventListener("mousemove", onMove);
          primary.removeEventListener("mouseleave", onLeave);
        };
      }
    }, sectionRef);
    return () => {
      (cardsRef.current[0] as unknown as { _cleanup?: () => void })?._cleanup?.();
      ctx.revert();
    };
  }, []);

  return (
    <section className={styles.cta} ref={sectionRef} aria-label="Пресейв MAGNUM">
      <div className={styles.inner}>
        <p className={styles.kicker}>MAGNUM • 5 пуль • уже в сети два сингла</p>
        <h2 ref={headingRef} className={styles.heading}>Это только начало захвата</h2>
        <p ref={textRef} className={styles.lead}>
          5 треков как 5 пуль из напечатанного пистолета. Туса Медуза и VPN уже в чартах — остальное скоро.
          Пресейв = ты первый услышишь.
        </p>
        <div className={styles.grid}>
          <a href={PRESAVE_URL} target="_blank" rel="noopener noreferrer" className={`${styles.card} ${styles.primary}`} ref={(el) => { cardsRef.current[0] = el; }}>
            <span ref={shimmerRef} className={styles.shimmer} aria-hidden />
            <span className={styles.cardIcon}>★</span>
            <span className={styles.cardTitle}>Пресейв на Яндекс Музыке</span>
            <span className={styles.cardSub}>400K+ слушателей • уведомление в день релиза</span>
            <span className={styles.cardCta}>Сохранить →</span>
          </a>
          <a href={SPOTIFY_URL} target="_blank" rel="noopener noreferrer" className={styles.card} ref={(el) => { cardsRef.current[1] = el; }}>
            <span className={styles.cardIcon}>♫</span>
            <span className={styles.cardTitle}>Spotify • 263K</span>
            <span className={styles.cardSub}>Подпишись, чтобы не пропустить дроп</span>
            <span className={styles.cardCta}>Слушать →</span>
          </a>
          <a href={YT_URL} target="_blank" rel="noopener noreferrer" className={styles.card} ref={(el) => { cardsRef.current[2] = el; }}>
            <span className={styles.cardIcon}>▶</span>
            <span className={styles.cardTitle}>YouTube • клипы</span>
            <span className={styles.cardSub}>200K+ просмотров • 8K клипов в TikTok</span>
            <span className={styles.cardCta}>Смотреть →</span>
          </a>
        </div>
        <div className={styles.proof} ref={proofRef}>
          <span className={styles.proofItem}><strong>РЗТ 80</strong> Super Puper Nova</span>
          <span className={styles.proofDot}>•</span>
          <span className={styles.proofItem}><strong>РЗТ 73</strong> CLAY</span>
          <span className={styles.proofDot}>•</span>
          <span className={styles.proofItem}><strong>РЗТ 86</strong> XXL</span>
          <span className={styles.proofDot}>•</span>
          <span className={styles.proofItem}>The Fence / Drumedy</span>
        </div>
        <p className={styles.fine}>Пресейв бесплатный. Никакого спама — только уведомление о релизе.</p>
      </div>
    </section>
  );
}
