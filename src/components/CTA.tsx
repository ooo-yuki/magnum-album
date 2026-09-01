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
  const shimmerRef = useRef<HTMLSpanElement>(null);
  const magnetRef = useRef<HTMLAnchorElement | null>(null);

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

      // cta-magnetic — subtle magnet follow on hover (6px, spring)
      if (btnRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const btn = btnRef.current;
        const onMove = (e: MouseEvent) => {
          const r = btn.getBoundingClientRect();
          const dx = ((e.clientX - (r.left + r.width / 2)) / r.width) * 8;
          const dy = ((e.clientY - (r.top + r.height / 2)) / r.height) * 6;
          gsap.to(btn, { x: dx, y: dy, duration: 0.45, ease: "power3.out", overwrite: "auto" });
        };
        const onLeave = () => gsap.to(btn, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1,0.4)", overwrite: "auto" });
        btn.addEventListener("mousemove", onMove);
        btn.addEventListener("mouseleave", onLeave);
        // store cleanup
        (btn as any)._ctaCleanup = () => { btn.removeEventListener("mousemove", onMove); btn.removeEventListener("mouseleave", onLeave); };
      }

      // periodic shimmer sweep across the CTA button
      if (shimmerRef.current) {
        // respect reduced motion
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          const shimmerTl = gsap.timeline({
            repeat: -1,
            delay: 2,
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 80%",
              toggleActions: "play pause resume pause",
            },
          });
          shimmerTl.fromTo(
            shimmerRef.current,
            { x: "-120%" },
            { x: "220%", duration: 1.4, ease: "power2.inOut" },
          );
          shimmerTl.to({}, { duration: 3.6 }); // pause between sweeps
        }
      }
    }, sectionRef);

    return () => { (btnRef.current as any)?._ctaCleanup?.(); ctx.revert(); }
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
        <span ref={shimmerRef} className={styles.shimmer} aria-hidden />
        Пресейв на Яндекс Музыке
      </a>
    </section>
  );
}
