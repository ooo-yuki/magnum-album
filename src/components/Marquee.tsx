import { useRef, useEffect } from "react";
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
function buildRow() {
  return WORDS.map((w, i) => (
    <span key={i} className={styles.word}>
      {w}
      <span className={styles.dot} aria-hidden>
        ✦
      </span>
    </span>
  ));
}

export function Marquee() {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!trackRef.current) return;
    // respect reduced motion — show static list instead of infinite scroll
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // measure one set's width, then tween from 0 to -half
    const track = trackRef.current;
    const half = track.scrollWidth / 2;

    const tween = gsap.to(track, {
      x: -half,
      duration: 32,
      ease: "none",
      repeat: -1,
    });

    // pause on hover for readability
    const pause = () => tween.pause();
    const resume = () => tween.resume();
    track.addEventListener("mouseenter", pause);
    track.addEventListener("mouseleave", resume);

    return () => {
      tween.kill();
      track.removeEventListener("mouseenter", pause);
      track.removeEventListener("mouseleave", resume);
    };
  }, []);

  return (
    <div className={styles.marquee} aria-label="MAGNUM — ключевые слова">
      <div className={styles.track} ref={trackRef}>
        {buildRow()}
        {buildRow()}
      </div>
    </div>
  );
}
