import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./About.module.css";

gsap.registerPlugin(ScrollTrigger);

export function About() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.set(headingRef.current, { y: 20, opacity: 0 });
      gsap.set(textRef.current, { y: 30, opacity: 0 });

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
          <div className={styles.highlight}>
            <span className={styles.highlightIcon}>🎵</span>
            <div>
              <strong>Мультижанровый</strong>
              <p>Разные стили для каждой аудитории</p>
            </div>
          </div>
          <div className={styles.highlight}>
            <span className={styles.highlightIcon}>🪼</span>
            <div>
              <strong>Туса Медуза</strong>
              <p>Первый сингл уже в чартах, тренд в TikTok</p>
            </div>
          </div>
          <div className={styles.highlight}>
            <span className={styles.highlightIcon}>🔒</span>
            <div>
              <strong>VPN</strong>
              <p>Второй сингл с клипом</p>
            </div>
          </div>
          <div className={styles.highlight}>
            <span className={styles.highlightIcon}>🏆</span>
            <div>
              <strong>SLAY Awards</strong>
              <p>Цель — захват трендов, плейлистов и SLAY</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
