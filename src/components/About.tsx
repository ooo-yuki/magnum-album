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

  // Magnetic 3D tilt on highlight cards
  const handleHighlightMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rotateX = ((y - cy) / cy) * -6;
    const rotateY = ((x - cx) / cx) * 6;
    gsap.to(card, { rotateX, rotateY, duration: 0.3, ease: "power2.out" });
  }, []);

  const handleHighlightLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    gsap.to(e.currentTarget, {
      rotateX: 0, rotateY: 0, y: 0,
      duration: 0.45, ease: "elastic.out(1, 0.5)",
    });
  }, []);

  const handleHighlightEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    gsap.to(e.currentTarget, { y: -3, duration: 0.25, ease: "power2.out" });
  }, []);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.set(headingRef.current, { y: 20, opacity: 0 });
      gsap.set(textRef.current, { y: 30, opacity: 0 });
      gsap.set(highlightsRef.current, { y: 28, opacity: 0, scale: 0.96 });

      gsap.to(headingRef.current, {
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
          toggleActions: "play none none none",
        },
        y: 0,
        opacity: 1,
        duration: 0.6,
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
      });

      // staggered reveal for each highlight card
      gsap.to(highlightsRef.current, {
        scrollTrigger: {
          trigger: `.${styles.highlights}`,
          start: "top 85%",
          toggleActions: "play none none none",
        },
        y: 0,
        opacity: 1,
        scale: 1,
        stagger: 0.1,
        duration: 0.55,
        ease: "back.out(1.4)",
      });
    }, sectionRef);

    return () => ctx.revert();
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
