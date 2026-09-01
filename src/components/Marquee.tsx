import { useRef, useEffect, useCallback } from "react";
import gsap from "gsap";
import styles from "./Marquee.module.css";

const WORDS = [
  "MAGNUM",
  "5opka",
  "42 братухи",
  "ТУСА МЕДУЗА",
  "VPN",
  "SLAY",
  "The Fence",
  "MellSher",
  "CLAY",
  "SUPERNOVA",
  "Drumedy",
  "РЗТ",
  "XXL",
  "Мерси",
  "Пресейв",
];

// Build one seamless row — duplicated for infinite loop
function buildRow(onEnter: (e: React.MouseEvent<HTMLSpanElement>) => void, onLeave: (e: React.MouseEvent<HTMLSpanElement>) => void) {
  return WORDS.map((w, i) => (
    <span key={i} className={styles.word} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {w}
      <span className={styles.dot} aria-hidden>
        ✦
      </span>
    </span>
  ));
}

export function Marquee() {
  const trackRef = useRef<HTMLDivElement>(null);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // GSAP magnetic hover on individual words
  const handleWordEnter = useCallback((e: React.MouseEvent<HTMLSpanElement>) => {
    if (reducedRef.current) return;
    gsap.to(e.currentTarget, {
      scale: 1.18,
      y: -2,
      textShadow: "0 0 14px rgba(255,45,85,0.6), 0 0 28px rgba(255,45,85,0.25)",
      duration: 0.28,
      ease: "back.out(1.7)",
    });
  }, []);

  const handleWordLeave = useCallback((e: React.MouseEvent<HTMLSpanElement>) => {
    if (reducedRef.current) return;
    gsap.to(e.currentTarget, {
      scale: 1,
      y: 0,
      textShadow: "none",
      duration: 0.35,
      ease: "power2.out",
    });
  }, []);

  useEffect(() => {
    if (!trackRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const track = trackRef.current;
    let pause: () => void = () => {};
    let resume: () => void = () => {};
    const ctx = gsap.context(() => {
      const half = track.scrollWidth / 2;
      const tween = gsap.to(track, { x: -half, duration: 32, ease: "none", repeat: -1 });
      pause = () => tween.pause();
      resume = () => tween.resume();
      track.addEventListener("mouseenter", pause);
      track.addEventListener("mouseleave", resume);
    }, trackRef);
    return () => {
      track.removeEventListener("mouseenter", pause);
      track.removeEventListener("mouseleave", resume);
      ctx.revert();
    };
  }, []);

  return (
    <div className={styles.marquee} aria-label="MAGNUM — ключевые слова">
      <div className={styles.track} ref={trackRef}>
        {buildRow(handleWordEnter, handleWordLeave)}
        {buildRow(handleWordEnter, handleWordLeave)}
      </div>
    </div>
  );
}
