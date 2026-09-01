import { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./Stats.module.css";

gsap.registerPlugin(ScrollTrigger);

interface StatItem {
  target: number;
  suffix: string;
  label: string;
}

const STATS: StatItem[] = [
  { target: 8, suffix: "K+", label: "клипов в TikTok" },
  { target: 200, suffix: "K+", label: "просмотров клипа" },
  { target: 42, suffix: "", label: "братухи на связи" },
];

function AnimatedNumber({ target, suffix }: { target: number; suffix: string }) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const ctx = gsap.context(() => {
      const obj = { val: 0 };
      gsap.to(obj, {
        val: target,
        duration: 2.6,
        ease: "expo.out", // stats easing v2 — smoother deceleration
        scrollTrigger: {
          trigger: ref.current,
          start: "top 80%",
          toggleActions: "play none none none",
        },
        onUpdate: () => setValue(Math.floor(obj.val)),
      });
    }, ref);

    return () => ctx.revert();
  }, [target]);

  return (
    <div className={styles.number} ref={ref}>
      {value.toLocaleString("ru-RU")}
      {suffix}
    </div>
  );
}

export function Stats() {
  const sectionRef = useRef<HTMLElement>(null);
  const itemsRef = useRef<(HTMLDivElement | null)[]>([]);
  const badgeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.set(itemsRef.current, { y: 40, opacity: 0 });

      gsap.to(itemsRef.current, {
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
          toggleActions: "play none none none",
        },
        y: 0,
        opacity: 1,
        stagger: 0.15,
        duration: 0.8,
        ease: "power2.out",
      });

      // shimmer sweep + glow pulse on "В чартах" badge
      if (badgeRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const shimmerEl = badgeRef.current.querySelector(`.${styles.badgeShimmer}`) as HTMLElement | null;
        if (shimmerEl) {
          const shimmerTl = gsap.timeline({
            repeat: -1,
            delay: 3,
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 80%",
              toggleActions: "play pause resume pause",
            },
          });
          shimmerTl.fromTo(shimmerEl, { x: "-120%" }, { x: "220%", duration: 1.2, ease: "power2.inOut" });
          shimmerTl.to({}, { duration: 4 });
        }

        gsap.to(badgeRef.current, {
          boxShadow: "0 0 20px rgba(255,45,85,0.4), 0 0 40px rgba(255,45,85,0.15)",
          duration: 1.5,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          delay: 1,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 80%",
            toggleActions: "play pause resume pause",
          },
        });
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className={styles.stats} ref={sectionRef}>
      {STATS.map((stat, i) => (
        <div
          key={stat.label}
          className={styles.stat}
          ref={(el) => {
            itemsRef.current[i] = el;
          }}
        >
          <AnimatedNumber target={stat.target} suffix={stat.suffix} />
          <div className={styles.label}>{stat.label}</div>
        </div>
      ))}
      <div
        className={styles.stat}
        ref={(el) => {
          itemsRef.current[3] = el;
        }}
      >
        <div className={styles.badge} ref={badgeRef}>
          <span className={styles.badgeShimmer} aria-hidden />
          В чартах
        </div>
        <div className={styles.label}>Туса Медуза</div>
      </div>
    </section>
  );
}
