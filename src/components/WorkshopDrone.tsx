import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * Декоративный дрон, летающий поверх страницы Мастерской. pointer-events:none —
 * никогда не мешает кликам. При prefers-reduced-motion просто висит в углу без полёта.
 */
export function WorkshopDrone() {
  const droneRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const el = droneRef.current;
    const props = propsRef.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      gsap.set(el, { x: 24, y: 24, opacity: 0.85 });
      return;
    }

    const ctx = gsap.context(() => {
      if (props) gsap.to(props, { rotate: 360, duration: 0.35, repeat: -1, ease: "none" });

      const tl = gsap.timeline({ repeat: -1, defaults: { ease: "sine.inOut" } });
      const fly = () => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const x = 40 + Math.random() * Math.max(80, vw - 160);
        const y = 60 + Math.random() * Math.max(80, Math.min(vh, 900) - 200);
        const rot = -8 + Math.random() * 16;
        tl.to(el, { x, y, rotate: rot, duration: 3.5 + Math.random() * 2.5 });
      };
      gsap.set(el, { x: 60, y: 90 });
      for (let i = 0; i < 8; i++) fly();
      // лёгкое дрожание/парение поверх маршрута
      gsap.to(el, { y: "+=10", duration: 1.1, yoyo: true, repeat: -1, ease: "sine.inOut" });
    }, droneRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={droneRef}
      aria-hidden="true"
      style={{
        position: "fixed", top: 0, left: 0, zIndex: 40, pointerEvents: "none",
        filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.45))", willChange: "transform",
      }}
    >
      <svg width="46" height="34" viewBox="0 0 46 34" fill="none">
        <ellipse cx="23" cy="27" rx="5" ry="2" fill="rgba(0,0,0,0.35)" />
        <line x1="10" y1="8" x2="18" y2="14" stroke="#8a94a6" strokeWidth="2" />
        <line x1="36" y1="8" x2="28" y2="14" stroke="#8a94a6" strokeWidth="2" />
        <line x1="10" y1="24" x2="18" y2="18" stroke="#8a94a6" strokeWidth="2" />
        <line x1="36" y1="24" x2="28" y2="18" stroke="#8a94a6" strokeWidth="2" />
        <rect x="16" y="12" width="14" height="9" rx="3" fill="#1a1f2e" stroke="#00ff88" strokeWidth="1.2" />
        <circle cx="23" cy="16.5" r="1.6" fill="#00ff88" />
        <g ref={propsRef} style={{ transformOrigin: "10px 8px" }}>
          <circle cx="10" cy="8" r="6" fill="none" stroke="#5865f2" strokeWidth="1.4" opacity="0.8" />
        </g>
        <g style={{ transformOrigin: "36px 8px" }}>
          <circle cx="36" cy="8" r="6" fill="none" stroke="#5865f2" strokeWidth="1.4" opacity="0.8" />
        </g>
        <g style={{ transformOrigin: "10px 24px" }}>
          <circle cx="10" cy="24" r="6" fill="none" stroke="#5865f2" strokeWidth="1.4" opacity="0.8" />
        </g>
        <g style={{ transformOrigin: "36px 24px" }}>
          <circle cx="36" cy="24" r="6" fill="none" stroke="#5865f2" strokeWidth="1.4" opacity="0.8" />
        </g>
      </svg>
    </div>
  );
}

export default WorkshopDrone;
