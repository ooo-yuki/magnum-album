import { useRef, useEffect, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./About.module.css";

gsap.registerPlugin(ScrollTrigger);

export function About() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const highlightsRef = useRef<(HTMLDivElement | null)[]>([]);
  const prefersReduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Magnetic 3D tilt on highlight cards - disabled for reduced-motion
  const handleHighlightMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReduced()) return;
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rotateX = ((y - cy) / cy) * -6;
    const rotateY = ((x - cx) / cx) * 6;
    gsap.to(card, { rotateX, rotateY, duration: 0.3, ease: "power2.out", overwrite: "auto" });
  }, []);

  const handleHighlightLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReduced()) { gsap.set(e.currentTarget, { clearProps: "transform" }); return; }
    gsap.to(e.currentTarget, {
      rotateX: 0, rotateY: 0, y: 0,
      duration: 0.45, ease: "elastic.out(1, 0.5)", overwrite: "auto",
    });
  }, []);

  const handleHighlightEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReduced()) return;
    gsap.to(e.currentTarget, { y: -3, boxShadow: "0 10px 28px rgba(0,0,0,0.35), 0 0 18px rgba(255,45,85,0.18)", duration: 0.25, ease: "power2.out", overwrite: "auto" });
  }, []);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      const highlights = highlightsRef.current.filter(Boolean) as HTMLElement[];
      if (prefersReduced()) {
        gsap.set([headingRef.current, textRef.current].filter(Boolean), { y: 0, opacity: 1, clearProps: "transform" });
        gsap.set(highlights, { y: 0, opacity: 1, scale: 1, clearProps: "transform" });
        return;
      }
      gsap.set(headingRef.current, { y: 24, opacity: 0 });
      gsap.set(textRef.current, { y: 24, opacity: 0 });
      gsap.set(highlights, { y: 24, opacity: 0, scale: 0.96 });

      gsap.to(headingRef.current, {
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
          toggleActions: "play none none none",
        },
        y: 0,
        opacity: 1,
        duration: 0.6,
        ease: "power3.out",
      });

      gsap.to(textRef.current, {
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 75%",
          toggleActions: "play none none none",
        },
        y: 0,
        opacity: 1,
        duration: 0.8,
        delay: 0.2,
        ease: "power3.out",
      });

      // stagger 0.12 spec + ScrollTrigger once
      gsap.to(highlights, {
        scrollTrigger: {
          trigger: `.${styles.highlights}`,
          start: "top 85%",
          toggleActions: "play none none none",
        },
        y: 0,
        opacity: 1,
        scale: 1,
        stagger: 0.12,
        duration: 0.55,
        ease: "back.out(1.4)",
        overwrite: "auto",
      });

      // RGB-neon hover glow via ScrollTrigger context — extra shimmer on highlights
      highlights.forEach((el) => {
        const enter = () => { if (prefersReduced()) return; gsap.to(el, { y: -4, boxShadow: "0 12px 32px rgba(0,0,0,0.4), 0 0 20px rgba(255,45,85,0.18), 0 0 24px rgba(0,255,136,0.12)", duration: 0.28, ease: "power2.out", overwrite: "auto" }); };
        const leave = () => gsap.to(el, { y: 0, boxShadow: "0 0 0 transparent", duration: 0.4, ease: "power2.out", overwrite: "auto" });
        el.addEventListener("mouseenter", enter);
        el.addEventListener("mouseleave", leave);
        // cleanup via revert is automatic for listeners? store for manual removal
        (el as unknown as { _hoverCleanup?: () => void })._hoverCleanup = () => { el.removeEventListener("mouseenter", enter); el.removeEventListener("mouseleave", leave); };
      });
    }, sectionRef);

    return () => {
      // manual hover cleanup before context revert
      highlightsRef.current.forEach((el) => { try { (el as unknown as { _hoverCleanup?: () => void })?._hoverCleanup?.(); } catch {} });
      ctx.revert();
    };
  }, []);

  return (
    <section className={styles.about} ref={sectionRef}>
      <h2 className={styles.title} ref={headingRef}>
        Об альбоме
      </h2>
      <div className={styles.content} ref={textRef}>
        <div className={styles.card}>
          <h3>MAGNUM</h3>
          <p className={styles.artist}>Пятерка (5opka)</p>
          <p className={styles.detail}>
            Мультижанровый альбом — от детского сада до фанаток Анны Асти 50+.
            Каждый трек создан чтобы попасть в плейлист каждого.
          </p>
        </div>

        <div className={styles.highlights}>
          {[
            { icon: "🎵", title: "Мультижанровый", desc: "Разные стили для каждой аудитории" },
            { icon: "🪼", title: "Туса Медуза", desc: "Первый сингл уже в чартах, тренд в TikTok" },
            { icon: "🔒", title: "VPN", desc: "Второй сингл с клипом" },
            { icon: "🏆", title: "SLAY Awards", desc: "Цель — захват трендов, плейлистов и SLAY" },
          ].map((h, i) => (
            <div
              key={h.title}
              className={styles.highlight}
              ref={(el) => { highlightsRef.current[i] = el; }}
              onMouseMove={handleHighlightMove}
              onMouseEnter={handleHighlightEnter}
              onMouseLeave={handleHighlightLeave}
            >
              <span className={styles.highlightIcon}>{h.icon}</span>
              <div>
                <strong>{h.title}</strong>
                <p>{h.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
