import { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./CTA.module.css";
import { getABVariant, type ABVariant } from "../lib/presaveTracker";

gsap.registerPlugin(ScrollTrigger);
const PRESAVE_URL = "https://music.thefence.me/psmagnum";
export { PRESAVE_URL };
const SPOTIFY_URL = "https://open.spotify.com/artist/5opka";
const YT_URL = "https://www.youtube.com/@5opka";

const DROP_DATE = new Date("2026-09-15T00:00:00+03:00");
const FOMO_TOTAL = 42;
function formatCountdown(ms: number): string {
  if (ms <= 0) return "Дроп уже здесь 🔥";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}д ${String(h).padStart(2, "0")}ч ${String(m).padStart(2, "0")}м`;
  if (h > 0) return `${h}ч ${String(m).padStart(2, "0")}м`;
  return `${m}м`;
}

export function CTA({ variant: variantProp }: { variant?: ABVariant }) {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const cardsRef = useRef<(HTMLAnchorElement | null)[]>([]);
  const shimmerRef = useRef<HTMLSpanElement>(null);
  const proofRef = useRef<HTMLDivElement>(null);
  const fomoRef = useRef<HTMLDivElement>(null);
  const countdownRef = useRef<HTMLDivElement>(null);

  const [variant, setVariant] = useState<ABVariant>(variantProp ?? "a");
  const [presaveCount, setPresaveCount] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<string>(() => formatCountdown(DROP_DATE.getTime() - Date.now()));
  useEffect(() => {
    if (variantProp) { setVariant(variantProp); return; }
    setVariant(getABVariant());
  }, [variantProp]);
  useEffect(() => {
    let cancelled = false;
    fetch("/magnum/api/presave/stats", { credentials: "include" })
      .then((r) => r.ok ? r.json() as Promise<{ total?: number; presaveCount?: number }> : null)
      .then((j) => { if (!cancelled && j && typeof j.total === "number") setPresaveCount(Math.min(j.total, FOMO_TOTAL)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(DROP_DATE.getTime() - Date.now()));
    const id = window.setInterval(tick, 60000);
    tick();
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const els = [fomoRef.current, countdownRef.current].filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const ctx = gsap.context(() => {
      els.forEach((el, i) => {
        gsap.to(el, { scale: 1.03, duration: 0.42, ease: "power2.inOut", repeat: -1, yoyo: true, repeatDelay: 2.16, delay: i * 0.2 });
      });
    });
    return () => ctx.revert();
  }, []);

  const isB = variant === "b";
  const shownCount = presaveCount ?? 0;
  const remaining = Math.max(0, FOMO_TOTAL - shownCount);

  const handlePresaveClick = () => {
    try { localStorage.setItem("presave_done", "1"); } catch {}
    fetch("/magnum/api/presave/click", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: PRESAVE_URL, ts: Date.now(), variant }) }).catch(() => {});
  };

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      const entranceEls = [
        headingRef.current,
        textRef.current,
        ...cardsRef.current.filter(Boolean) as Element[],
        proofRef.current,
      ].filter(Boolean) as Element[];

      // reduced-motion gate: instant show, skip timelines/magnet
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set(entranceEls, { y: 0, opacity: 1, scale: 1, clearProps: "transform" });
        gsap.set(cardsRef.current.filter(Boolean), { y: 0, opacity: 1, scale: 1 });
        return;
      }

      // GSAP entrance y24 stagger 0.12 — task spec
      gsap.set(headingRef.current, { y: 24, opacity: 0 });
      gsap.set(textRef.current, { y: 24, opacity: 0 });
      gsap.set(cardsRef.current.filter(Boolean), { y: 24, opacity: 0, scale: 0.97 });
      gsap.set(proofRef.current, { y: 24, opacity: 0 });

      const tl = gsap.timeline({
        scrollTrigger: { trigger: sectionRef.current, start: "top 80%", toggleActions: "play none none none" },
        defaults: { ease: "power3.out" },
      });
      tl.to(headingRef.current, { y: 0, opacity: 1, duration: 0.7 })
        .to(textRef.current, { y: 0, opacity: 1, duration: 0.55 }, "-=0.35")
        .to(cardsRef.current.filter(Boolean), { y: 0, opacity: 1, scale: 1, duration: 0.6, stagger: 0.12 }, "-=0.2")
        .to(proofRef.current, { y: 0, opacity: 1, duration: 0.5 }, "-=0.25");

      // shimmer loop
      if (shimmerRef.current) {
        const shimmerTl = gsap.timeline({
          repeat: -1,
          delay: 1.2,
          scrollTrigger: { trigger: sectionRef.current, start: "top 80%", toggleActions: "play pause resume pause" },
        });
        shimmerTl.fromTo(shimmerRef.current, { x: "-120%" }, { x: "220%", duration: 1.3, ease: "power2.inOut" });
        shimmerTl.to({}, { duration: 3.2 });
      }

      // magnet + RGB hover on CTA buttons — all cards, reduced-motion gated, cleanup via ctx.revert
      const cleanups: Array<() => void> = [];
      cardsRef.current.forEach((card, idx) => {
        if (!card) return;
        const strength = idx === 0 ? 14 : 10;
        const onEnter = () => {
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
          gsap.to(card, {
            y: -4,
            scale: 1.015,
            duration: 0.25,
            ease: "power2.out",
            boxShadow: "0 14px 40px rgba(0,0,0,0.34), 0 0 22px rgba(255,45,85,0.22), 0 0 30px rgba(88,101,242,0.18)",
            overwrite: "auto",
          });
          gsap.to(card, {
            duration: 0.22,
            ease: "power2.out",
            filter: "drop-shadow(1px 0 0 rgba(255,0,80,0.35)) drop-shadow(-1px 0 0 rgba(0,255,255,0.35))",
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
        const onMove = (e: MouseEvent) => {
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
          const r = card.getBoundingClientRect();
          const dx = ((e.clientX - (r.left + r.width / 2)) / r.width) * strength;
          const dy = ((e.clientY - (r.top + r.height / 2)) / r.height) * (strength * 0.55);
          gsap.to(card, { x: dx, y: dy, duration: 0.4, ease: "power3.out", overwrite: "auto" });
        };
        card.addEventListener("mouseenter", onEnter);
        card.addEventListener("mouseleave", onLeave);
        card.addEventListener("mousemove", onMove);
        cleanups.push(() => {
          card.removeEventListener("mouseenter", onEnter);
          card.removeEventListener("mouseleave", onLeave);
          card.removeEventListener("mousemove", onMove);
        });
      });
      (sectionRef.current as unknown as { _ctaCleanups?: () => void })._ctaCleanups = () =>
        cleanups.forEach((fn) => fn());
    }, sectionRef);

    return () => {
      (sectionRef.current as unknown as { _ctaCleanups?: () => void })?._ctaCleanups?.();
      (cardsRef.current[0] as unknown as { _cleanup?: () => void })?._cleanup?.();
      ctx.revert();
    };
  }, []);

  return (
    <section className={styles.cta} ref={sectionRef} aria-label="Пресейв MAGNUM" data-variant={variant}>
      <div className={styles.inner}>
        <p className={styles.kicker}>MAGNUM • 5 пуль • уже в сети два сингла</p>
        <div ref={fomoRef} className={styles.fomoBadge} data-testid="cta-fomo-badge" aria-live="polite">🔥 {shownCount}/42 пресейвов · осталось {remaining} мест до дропа</div>
        <div ref={countdownRef} className={styles.countdown} data-testid="cta-countdown">До дропа MAGNUM: {countdown}</div>
        <h2 ref={headingRef} className={styles.heading}>{isB ? "42 братухи уже в деле" : "Это только начало захвата"}</h2>
        <p ref={textRef} className={styles.lead}>
          {isB
            ? "7 пресейвов \u00b7 стань частью 42 — 5 треков как 5 пуль из напечатанного пистолета, остальное скоро. Ты следующий."
            : "5 треков как 5 пуль из напечатанного пистолета. Туса Медуза и VPN уже в чартах — остальное скоро. Пресейв = ты первый услышишь."}
        </p>
        <div className={styles.grid}>
          <a href={PRESAVE_URL} target="_blank" rel="noopener noreferrer" className={`${styles.card} ${styles.primary}`} ref={(el) => { cardsRef.current[0] = el; }} onClick={handlePresaveClick} data-testid="cta-presave" data-presave-bonus="42" data-variant={variant}>
            <span ref={shimmerRef} className={styles.shimmer} aria-hidden />
            <span style={{ position: "absolute", top: 10, right: 10, fontSize: "0.68rem", fontWeight: 900, letterSpacing: "0.06em", background: "#fff", color: "#ff2d55", padding: "0.2rem 0.5rem", borderRadius: 999, lineHeight: 1 }} data-testid="bonus-badge">+42 монеты</span>
            <span className={styles.cardIcon}>★</span>
            <span className={styles.cardTitle}>{isB ? "Забрать свой MAGNUM →" : "Пресейв на Яндекс Музыке"}</span>
            <span className={styles.cardSub}>{isB ? "7 пресейвов \u00b7 стань частью 42" : "400K+ слушателей • уведомление в день релиза"}</span>
            <span className={styles.cardCta}>Сохранить → <span style={{ opacity: 0.9, fontSize: "0.78rem", marginLeft: 6, background: "rgba(255,255,255,0.22)", padding: "0.1rem 0.4rem", borderRadius: 999 }}>бонус +42</span></span>
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
        <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/magnum/share-card" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,204,0,0.12)", border: "1px solid rgba(255,204,0,0.32)", color: "#ffcc00", fontWeight: 800, fontSize: 13, padding: "8px 14px", borderRadius: 999, textDecoration: "none" }}>Я в 42 — шаринг 1080×1080 →</a>
          <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, alignSelf: "center" }}>QR music.thefence.me/psmagnum · Web Share → PNG</span>
        </div>
        <p className={styles.fine}>Пресейв бесплатный. Никакого спама — только уведомление о релизе.</p>
      </div>
    </section>
  );
}
