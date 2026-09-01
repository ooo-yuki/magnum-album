import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import gsap from "gsap";

export function TopProgress() {
  const location = useLocation();
  const barRef = useRef<HTMLDivElement>(null);
  const shimmerRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    if (!barRef.current) return;

    // kill any running timeline
    tlRef.current?.kill();

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const tl = gsap.timeline();
    tlRef.current = tl;

    if (reduced) {
      // simple instant show/hide for reduced motion
      tl.set(barRef.current, { width: "100%", opacity: 1 });
      tl.to(barRef.current, { opacity: 0, duration: 0.2, delay: 0.3 });
      tl.set(barRef.current, { width: "0%" });
    } else {
      // smooth GSAP progress with eased steps
      tl.set(barRef.current, { width: "0%", opacity: 1 });
      tl.to(barRef.current, { width: "18%", duration: 0.15, ease: "power1.out" });
      tl.to(barRef.current, { width: "72%", duration: 0.28, ease: "power2.out" });
      tl.to(barRef.current, { width: "100%", duration: 0.22, ease: "power1.in" });
      tl.to(barRef.current, { opacity: 0, duration: 0.18, ease: "power1.in" });
      tl.set(barRef.current, { width: "0%" });

      // shimmer sweep across the bar
      if (shimmerRef.current) {
        gsap.set(shimmerRef.current, { x: "-100%" });
        gsap.to(shimmerRef.current, {
          x: "200%",
          duration: 0.6,
          ease: "power2.inOut",
          delay: 0.1,
        });
      }
    }

    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });

    return () => {
      tl.kill();
    };
  }, [location.pathname]);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        zIndex: 200,
        pointerEvents: "none",
      }}
    >
      <div
        ref={barRef}
        style={{
          height: "100%",
          width: "0%",
          opacity: 0,
          background: "linear-gradient(90deg,#ff2d55,#ffcc00)",
          boxShadow: "0 0 10px rgba(255,45,85,0.6), 0 0 24px rgba(255,45,85,0.2)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          ref={shimmerRef}
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
            width: "40%",
          }}
        />
      </div>
    </div>
  );
}
