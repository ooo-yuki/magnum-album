import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./Hero.module.css";

gsap.registerPlugin(ScrollTrigger);

const PRESAVE_URL =
  "https://music.yandex.ru/artist/7544304?utm_medium=copy_link&ref_id=41b45b35-e5b0-4286-9a53-2c1163828366";

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const orb1Ref = useRef<HTMLDivElement>(null);
  const orb2Ref = useRef<HTMLDivElement>(null);
  const orb3Ref = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // initial states
      gsap.set(badgeRef.current, { y: 20, opacity: 0 });
      gsap.set(titleRef.current, { scale: 0.85, opacity: 0 });
      gsap.set(subtitleRef.current, { y: 20, opacity: 0 });
      gsap.set(ctaRef.current, { y: 30, opacity: 0 });
      gsap.set(scrollRef.current, { opacity: 0 });

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.to(badgeRef.current, { y: 0, opacity: 1, duration: 0.8 })
        .to(
          titleRef.current,
          { scale: 1, opacity: 1, duration: 1.2, ease: "back.out(1.7)" },
          "-=0.4",
        )
        .to(subtitleRef.current, { y: 0, opacity: 1, duration: 0.8 }, "-=0.6")
        .to(ctaRef.current, { y: 0, opacity: 1, duration: 0.8 }, "-=0.4")
        .to(scrollRef.current, { opacity: 1, duration: 1 }, "-=0.2");

      // title gradient shift loop
      gsap.to(titleRef.current, {
        backgroundPosition: "200% center",
        duration: 4,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      // subtle floating for badge + subtitle
      gsap.to(badgeRef.current, {
        y: -4,
        duration: 2.2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: 1,
      });

      // presave CTA pulse — scale + glow breathing
      if (ctaRef.current) {
        const primary = ctaRef.current.querySelector(`.${styles.btnPrimary}`) as HTMLElement | null;
        if (primary) {
          gsap.to(primary, {
            scale: 1.04,
            boxShadow: "0 0 42px rgba(255,45,85,0.65), 0 0 80px rgba(255,45,85,0.22)",
            duration: 1.1,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });
          // shine sweep via pseudo handled in CSS, but add micro shake on hover via gsap later
        }
      }

      // parallax on scroll — deeper layers move slower
      gsap.to(titleRef.current, {
        yPercent: -18,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 0.6,
        },
      });
      gsap.to(subtitleRef.current, {
        yPercent: -30,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 0.6,
        },
      });
      gsap.to(badgeRef.current, {
        yPercent: -45,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 0.6,
        },
      });
      gsap.to(ctaRef.current, {
        yPercent: -20,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 0.6,
        },
      });
      gsap.to(scrollRef.current, {
        opacity: 0,
        y: -20,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "35% top",
          scrub: true,
        },
      });

      // orb parallax — opposite directions
      [orb1Ref, orb2Ref, orb3Ref, glowRef].forEach((ref, i) => {
        if (!ref.current) return;
        gsap.to(ref.current, {
          yPercent: (i % 2 === 0 ? -25 : 18) * (0.6 + i * 0.15),
          xPercent: (i % 2 === 0 ? 8 : -8),
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top top",
            end: "bottom top",
            scrub: 0.8,
          },
        });
      });

      // fade hero content on scroll
      gsap.to(sectionRef.current, {
        opacity: 0.15,
        scale: 0.98,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "55% top",
          end: "100% top",
          scrub: true,
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className={styles.hero} ref={sectionRef} aria-label="MAGNUM hero">
      {/* gradient / orb layers for parallax depth */}
      <div className={styles.glow} ref={glowRef} aria-hidden />
      <div className={styles.orb1} ref={orb1Ref} aria-hidden />
      <div className={styles.orb2} ref={orb2Ref} aria-hidden />
      <div className={styles.orb3} ref={orb3Ref} aria-hidden />
      <div className={styles.gridOverlay} aria-hidden />
      <div className={styles.vignette} aria-hidden />

      <div className={styles.badge} ref={badgeRef}>
        <span className={styles.badgeDot} aria-hidden />
        Новый альбом · скоро
      </div>

      <h1 className={styles.title} ref={titleRef}>
        MAGNUM
      </h1>

      <p className={styles.subtitle} ref={subtitleRef}>
        Пятерка × 42&nbsp;братухи
      </p>

      <p className={styles.tagline}>Мультижанровый захват — от сада до чартов</p>

      <div className={styles.cta} ref={ctaRef}>
        <a
          href={PRESAVE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.btnPrimary}
          aria-label="Пресейв MAGNUM на Яндекс Музыке"
        >
          <span className={styles.btnPulse} aria-hidden />
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
          </svg>
          Пресейв
        </a>
        <a href="#singles" className={styles.btnSecondary}>
          Слушать синглы
        </a>
      </div>

      <div className={styles.scrollIndicator} ref={scrollRef} aria-hidden>
        <span />
        <small>Листай</small>
      </div>
    </section>
  );
}
