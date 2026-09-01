import { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./Hero.module.css";

gsap.registerPlugin(ScrollTrigger);

const PRESAVE_URL = "https://music.thefence.me/psmagnum";
export { PRESAVE_URL };

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*!?";
const TITLE_TARGET = "MAGNUM";

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const taglineRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const orb1Ref = useRef<HTMLDivElement>(null);
  const orb2Ref = useRef<HTMLDivElement>(null);
  const orb3Ref = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const [titleText, setTitleText] = useState(SCRAMBLE_CHARS.slice(0, TITLE_TARGET.length));

  const handlePresave = () => {
    try { localStorage.setItem("presave_done", "1"); } catch {}
    fetch("/magnum/api/presave/click", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: PRESAVE_URL, ts: Date.now() }) }).catch(() => {});
  };

  // text-scramble effect on mount
  useEffect(() => {
    let frame = 0;
    const totalFrames = 18;
    const interval = setInterval(() => {
      frame++;
      if (frame >= totalFrames) {
        setTitleText(TITLE_TARGET);
        clearInterval(interval);
        return;
      }
      const revealed = Math.floor((frame / totalFrames) * TITLE_TARGET.length);
      let text = TITLE_TARGET.slice(0, revealed);
      for (let i = revealed; i < TITLE_TARGET.length; i++) {
        text += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
      }
      setTitleText(text);
    }, 45);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      const entranceEls = [
        badgeRef.current,
        titleRef.current,
        subtitleRef.current,
        taglineRef.current,
        ctaRef.current,
        scrollRef.current,
      ].filter(Boolean) as Element[];

      // reduced-motion: instant visible, no animation
      if (prefersReduced) {
        gsap.set(entranceEls, { y: 0, opacity: 1, clearProps: "transform" });
        if (ctaRef.current) gsap.set(ctaRef.current.querySelectorAll("a"), { clearProps: "all" });
        return;
      }

      // GSAP entrance y24 stagger 0.12 — task spec
      gsap.set(entranceEls, { y: 24, opacity: 0 });
      gsap.to(entranceEls, {
        y: 0,
        opacity: 1,
        duration: 0.7,
        stagger: 0.12,
        ease: "power3.out",
        overwrite: "auto",
      });

      // title gradient shift loop
      gsap.to(titleRef.current, {
        backgroundPosition: "200% center",
        duration: 4,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      // subtle floating for badge
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
        }
      }

      // hover RGB — GSAP textShadow / filter split on buttons
      const hoverEls: HTMLElement[] = [];
      if (ctaRef.current) {
        ctaRef.current.querySelectorAll<HTMLElement>(`a`).forEach((el) => hoverEls.push(el));
      }
      const cleanups: Array<() => void> = [];
      hoverEls.forEach((el) => {
        const onEnter = () => {
          gsap.to(el, {
            duration: 0.22,
            ease: "power2.out",
            // RGB split via textShadow + boxShadow
            textShadow: "2px 0 0 rgba(255,0,80,0.9), -2px 0 0 rgba(0,255,255,0.9)",
            boxShadow: "0 0 18px rgba(255,45,85,0.5), 0 0 30px rgba(88,101,242,0.35)",
            y: -2,
            overwrite: "auto",
          });
        };
        const onLeave = () => {
          gsap.to(el, {
            duration: 0.3,
            ease: "power3.out",
            textShadow: "0 0 0 transparent",
            boxShadow:
              el.classList.contains(styles.btnPrimary)
                ? "0 0 30px rgba(255, 45, 85, 0.45), 0 8px 32px rgba(255, 45, 85, 0.28)"
                : "none",
            y: 0,
            overwrite: "auto",
          });
        };
        el.addEventListener("mouseenter", onEnter);
        el.addEventListener("mouseleave", onLeave);
        cleanups.push(() => {
          el.removeEventListener("mouseenter", onEnter);
          el.removeEventListener("mouseleave", onLeave);
        });
      });
      // store cleanup on section for ctx revert phase
      (sectionRef.current as unknown as { _heroHoverCleanup?: () => void })._heroHoverCleanup = () =>
        cleanups.forEach((fn) => fn());

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
          xPercent: i % 2 === 0 ? 8 : -8,
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

    return () => {
      // cleanup hover listeners + gsap context
      (sectionRef.current as unknown as { _heroHoverCleanup?: () => void })?._heroHoverCleanup?.();
      ctx.revert();
    };
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

      <h1 className={`${styles.title} ${titleText !== TITLE_TARGET ? styles.titleScramble : ""}`} ref={titleRef}>
        {titleText}
      </h1>

      <p className={styles.subtitle} ref={subtitleRef}>
        Пятерка × 42&nbsp;братухи
      </p>

      <p className={styles.tagline} ref={taglineRef}>Мультижанровый захват — от сада до чартов</p>

      <div className={styles.cta} ref={ctaRef}>
        <a
          href={PRESAVE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.btnPrimary}
          aria-label="Пресейв MAGNUM на Яндекс Музыке"
          onClick={handlePresave}
          data-testid="hero-presave"
          data-presave-bonus="42"
        >
          <span className={styles.btnPulse} aria-hidden />
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
          </svg>
          Пресейв <span style={{ background: "rgba(255,255,255,0.22)", padding: "0.12rem 0.45rem", borderRadius: 999, fontSize: "0.72rem", fontWeight: 900 }}>+42 монеты</span>
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
