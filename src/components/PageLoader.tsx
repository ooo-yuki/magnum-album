import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

export function PageLoader() {
  const [visible, setVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const barTrackRef = useRef<HTMLDivElement>(null);
  const barFillRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    // failsafe: hide even if GSAP stalls (Obscura / headless / reduced-motion)
    const fallback = window.setTimeout(() => setVisible(false), 2200);

    const ctx = gsap.context(() => {
      // initial states
      gsap.set(titleRef.current, { opacity: 0, y: 12, scale: 0.92 });
      gsap.set(barTrackRef.current, { opacity: 0, scaleX: 0.6 });
      gsap.set(labelRef.current, { opacity: 0, y: 6 });

      const tl = gsap.timeline({
        onComplete: () => {
          // exit animation
          gsap.to(containerRef.current, {
            opacity: 0,
            duration: 0.42,
            ease: "power2.in",
            onComplete: () => setVisible(false),
          });
        },
      });

      // title entrance
      tl.to(titleRef.current, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.5,
        ease: "back.out(1.6)",
      });

      // bar track fade in
      tl.to(
        barTrackRef.current,
        { opacity: 1, scaleX: 1, duration: 0.35, ease: "power2.out" },
        "-=0.25",
      );

      // bar fill sweep — 3 passes like a loading indicator
      tl.to(barFillRef.current, {
        x: "180%",
        duration: 0.6,
        ease: "power2.inOut",
      });
      tl.to(barFillRef.current, {
        x: "-120%",
        duration: 0.5,
        ease: "power2.inOut",
      });
      tl.to(barFillRef.current, {
        x: "180%",
        duration: 0.45,
        ease: "power2.inOut",
      });

      // label fade in
      tl.to(
        labelRef.current,
        { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" },
        "-=0.6",
      );
    }, containerRef);

    return () => { clearTimeout(fallback); ctx.revert(); }
  }, []);

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "grid",
        placeItems: "center",
        background: "#0a0a0a",
        pointerEvents: "auto",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          ref={titleRef}
          style={{
            fontWeight: 900,
            letterSpacing: "0.14em",
            fontSize: "1.55rem",
            background:
              "linear-gradient(135deg,#ff2d55,#ffcc00,#00ff88,#5865f2)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: "drop-shadow(0 8px 32px rgba(255,45,85,0.22))",
          }}
        >
          MAGNUM
        </div>
        <div
          ref={barTrackRef}
          style={{
            marginTop: 18,
            width: 96,
            height: 2,
            borderRadius: 999,
            background: "rgba(255,255,255,0.08)",
            overflow: "hidden",
            marginInline: "auto",
            transformOrigin: "center",
          }}
        >
          <div
            ref={barFillRef}
            style={{
              height: "100%",
              width: "42%",
              borderRadius: 999,
              background: "linear-gradient(90deg,#ff2d55,#ffcc00)",
              willChange: "transform",
            }}
          />
        </div>
        <div
          ref={labelRef}
          style={{
            marginTop: 10,
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(240,240,240,0.42)",
          }}
        >
          Загрузка
        </div>
      </div>
    </div>
  );
}
