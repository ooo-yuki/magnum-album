import { useRef, useEffect, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./ScrollToTop.module.css";

gsap.registerPlugin(ScrollTrigger);

export function ScrollToTop() {
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!btnRef.current) return;

    const ctx = gsap.context(() => {
      // show button after scrolling past 400px
      ScrollTrigger.create({
        start: 400,
        end: 99999,
        onEnter: () => {
          gsap.to(btnRef.current, {
            opacity: 1,
            y: 0,
            pointerEvents: "auto",
            duration: 0.35,
            ease: "power2.out",
          });
        },
        onLeaveBack: () => {
          gsap.to(btnRef.current, {
            opacity: 0,
            y: 12,
            pointerEvents: "none",
            duration: 0.25,
            ease: "power2.in",
          });
        },
      });
    });

    return () => ctx.revert();
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <button
      ref={btnRef}
      className={styles.btn}
      onClick={scrollToTop}
      aria-label="Прокрутить наверх"
      title="Наверх"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  );
}
