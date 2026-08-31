import { useRef, useEffect } from "react";
import gsap from "gsap";
import styles from "./Hero.module.css";

const PRESAVE_URL =
  "https://music.yandex.ru/artist/7544304?utm_medium=copy_link&ref_id=41b45b35-e5b0-4286-9a53-2c1163828366";

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.set(badgeRef.current, { y: 20, opacity: 0 });
      gsap.set(titleRef.current, { scale: 0.8, opacity: 0 });
      gsap.set(subtitleRef.current, { y: 20, opacity: 0 });
      gsap.set(ctaRef.current, { y: 30, opacity: 0 });
      gsap.set(scrollRef.current, { opacity: 0 });

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.to(badgeRef.current, { y: 0, opacity: 1, duration: 0.8 })
        .to(
          titleRef.current,
          { scale: 1, opacity: 1, duration: 1.2, ease: "back.out(1.7)" },
          "-=0.4"
        )
        .to(subtitleRef.current, { y: 0, opacity: 1, duration: 0.8 }, "-=0.6")
        .to(ctaRef.current, { y: 0, opacity: 1, duration: 0.8 }, "-=0.4")
        .to(scrollRef.current, { opacity: 1, duration: 1 }, "-=0.2");

      // Title glow animation
      gsap.to(titleRef.current, {
        backgroundPosition: "200% center",
        duration: 3,
        repeat: -1,
        yoyo: true,
        ease: "none",
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className={styles.hero} ref={sectionRef}>
      <div className={styles.badge} ref={badgeRef}>
        Новый альбом
      </div>
      <h1 className={styles.title} ref={titleRef}>
        MAGNUM
      </h1>
      <p className={styles.subtitle} ref={subtitleRef}>
        Пятерка × 42 братухи
      </p>
      <div className={styles.cta} ref={ctaRef}>
        <a href={PRESAVE_URL} target="_blank" className={styles.btnPrimary}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
          </svg>
          Пресейв
        </a>
        <a href="#singles" className={styles.btnSecondary}>
          Слушать синглы
        </a>
      </div>
      <div className={styles.scrollIndicator} ref={scrollRef}>
        <span />
        <small>Листай</small>
      </div>
    </section>
  );
}
