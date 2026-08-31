import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./CTA.module.css";

gsap.registerPlugin(ScrollTrigger);

const PRESAVE_URL =
  "https://music.yandex.ru/artist/7544304?utm_medium=copy_link&ref_id=41b45b35-e5b0-4286-9a53-2c1163828366";

export function CTA() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const btnRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.set(headingRef.current, { y: 30, opacity: 0 });
      gsap.set(textRef.current, { y: 20, opacity: 0 });
      gsap.set(btnRef.current, { scale: 0.8, opacity: 0 });

      gsap.to(headingRef.current, {
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
          toggleActions: "play none none none",
        },
        y: 0,
        opacity: 1,
        duration: 0.8,
      });

      gsap.to(textRef.current, {
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 75%",
          toggleActions: "play none none none",
        },
        y: 0,
        opacity: 1,
        duration: 0.6,
        delay: 0.2,
      });

      gsap.to(btnRef.current, {
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 70%",
          toggleActions: "play none none none",
        },
        scale: 1,
        opacity: 1,
        duration: 0.6,
        ease: "back.out(1.7)",
        delay: 0.4,
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className={styles.cta} ref={sectionRef}>
      <h2 ref={headingRef}>Это только начало захвата</h2>
      <p ref={textRef}>Пресейвы открыты на всех площадках</p>
      <a
        href={PRESAVE_URL}
        target="_blank"
        className={styles.btn}
        ref={btnRef}
      >
        Пресейв на Яндекс Музыке
      </a>
    </section>
  );
}
