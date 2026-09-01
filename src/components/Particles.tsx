import { useRef, useEffect } from "react";
import gsap from "gsap";

const COLORS = ["#ff2d55", "#ffcc00", "#00ff88", "#5865f2"];

export function Particles() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // respect reduced motion — skip all particle animation
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      for (let i = 0; i < 30; i++) {
        const p = document.createElement("div");
        p.style.position = "absolute";
        p.style.borderRadius = "50%";
        p.style.pointerEvents = "none";
        p.style.left = `${Math.random() * 100}%`;
        p.style.top = `${Math.random() * 100}%`;
        const size = `${2 + Math.random() * 4}px`;
        p.style.width = size;
        p.style.height = size;
        p.style.background = COLORS[Math.floor(Math.random() * COLORS.length)]!;
        p.style.opacity = "0";
        container.appendChild(p);

        gsap.to(p, {
          opacity: 0.3 + Math.random() * 0.4,
          y: -100 - Math.random() * 200,
          x: (Math.random() - 0.5) * 100,
          duration: 3 + Math.random() * 4,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          delay: Math.random() * 3,
        });
      }
    }, container);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
      }}
    />
  );
}
