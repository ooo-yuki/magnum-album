import { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./Stats.module.css";

gsap.registerPlugin(ScrollTrigger);

interface StatItem {
  target: number;
  label: string;
}

const STATS: StatItem[] = [
  { target: 8000, label: "клипов в TikTok" },
  { target: 200000, label: "просмотров клипа" },
  { target: 1, label: "в чартах" },
];

function AnimatedNumber({ target }: { target: number }) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const ctx = gsap.context(() => {
      const obj = { val: 0 };
      gsap.to(obj, {
        val: target,
        duration: 2,
        ease: "power2.out",
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

  const formatted =
    target >= 1000 ? value.toLocaleString("ru-RU") : value.toString();

  return (
    <div className={styles.number} ref={ref}>
      {formatted}
    </div>
  );
}

export function Stats() {
  const sectionRef = useRef<HTMLElement>(null);
  const itemsRef = useRef<(HTMLDivElement | null)[]>([]);

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
          <AnimatedNumber target={stat.target} />
          <div className={styles.label}>{stat.label}</div>
        </div>
      ))}
    </section>
  );
}
