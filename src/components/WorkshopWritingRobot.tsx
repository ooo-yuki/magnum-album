import { useEffect, useRef } from "react";
import gsap from "gsap";

/** Анимация "робот пишет код" — показывается, пока агент генерирует приложение. */
export function WorkshopWritingRobot() {
  const armRef = useRef<SVGGElement>(null);
  const eyeRef = useRef<SVGCircleElement>(null);
  const linesRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      if (armRef.current) {
        gsap.to(armRef.current, { rotate: -14, transformOrigin: "14px 70px", duration: 0.16, repeat: -1, yoyo: true, ease: "power1.inOut" });
      }
      if (eyeRef.current) {
        gsap.to(eyeRef.current, { opacity: 0.15, duration: 0.08, repeat: -1, yoyo: true, repeatDelay: 2.4, ease: "power1.inOut" });
      }
      if (linesRef.current) {
        const lines = linesRef.current.querySelectorAll("rect");
        gsap.to(lines, {
          scaleX: () => 0.4 + Math.random() * 0.6,
          duration: 0.5,
          repeat: -1,
          yoyo: true,
          stagger: { each: 0.12, repeat: -1 },
          transformOrigin: "left center",
          ease: "power1.inOut",
        });
      }
    });
    return () => ctx.revert();
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 14, background: "rgba(255,204,0,0.06)", border: "1px solid rgba(255,204,0,0.20)" }}>
      <svg width="64" height="80" viewBox="0 0 64 80" aria-hidden>
        {/* корпус */}
        <rect x="14" y="24" width="36" height="30" rx="8" fill="#1a1f2e" stroke="#5865f2" strokeWidth="1.6" />
        <circle ref={eyeRef} cx="26" cy="38" r="3.4" fill="#00ff88" />
        <circle cx="42" cy="38" r="3.4" fill="#00ff88" />
        <rect x="24" y="46" width="16" height="3" rx="1.5" fill="#5865f2" opacity="0.7" />
        {/* антенна */}
        <line x1="32" y1="24" x2="32" y2="14" stroke="#5865f2" strokeWidth="2" />
        <circle cx="32" cy="11" r="3" fill="#ff2d55" />
        {/* стол/клавиатура */}
        <rect x="6" y="70" width="52" height="4" rx="2" fill="rgba(255,255,255,0.14)" />
        {/* рука, печатающая */}
        <g ref={armRef}>
          <line x1="14" y1="54" x2="14" y2="70" stroke="#8a94a6" strokeWidth="3" strokeLinecap="round" />
        </g>
        <line x1="50" y1="54" x2="50" y2="70" stroke="#8a94a6" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#ffcc00" }}>Агент пишет код…</div>
        <svg width="100%" height="30" viewBox="0 0 200 30" style={{ marginTop: 6, maxWidth: 220 }} aria-hidden>
          <g ref={linesRef}>
            <rect x="0" y="2" width="160" height="5" rx="2.5" fill="rgba(255,204,0,0.35)" />
            <rect x="0" y="13" width="120" height="5" rx="2.5" fill="rgba(88,101,242,0.35)" />
            <rect x="0" y="24" width="140" height="5" rx="2.5" fill="rgba(0,255,136,0.30)" />
          </g>
        </svg>
      </div>
    </div>
  );
}

export default WorkshopWritingRobot;
