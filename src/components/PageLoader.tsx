import { useEffect, useState } from "react";

export function PageLoader() {
  const [visible, setVisible] = useState(true);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    // show at least 650ms for polish, then fade
    const t1 = window.setTimeout(() => setFade(true), 700);
    const t2 = window.setTimeout(() => setVisible(false), 1180);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "grid",
        placeItems: "center",
        background: "#0a0a0a",
        opacity: fade ? 0 : 1,
        pointerEvents: fade ? "none" : "auto",
        transition: "opacity 420ms ease",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontWeight: 900,
            letterSpacing: "0.14em",
            fontSize: "1.55rem",
            background: "linear-gradient(135deg,#ff2d55,#ffcc00,#00ff88,#5865f2)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: "drop-shadow(0 8px 32px rgba(255,45,85,0.22))",
            animation: "magnumLoaderIn 420ms ease both",
          }}
        >
          MAGNUM
        </div>
        <div
          style={{
            marginTop: 18,
            width: 96,
            height: 2,
            borderRadius: 999,
            background: "rgba(255,255,255,0.08)",
            overflow: "hidden",
            marginInline: "auto",
          }}
        >
          <div
            style={{
              height: "100%",
              width: "42%",
              borderRadius: 999,
              background: "linear-gradient(90deg,#ff2d55,#ffcc00)",
              animation: "magnumLoaderBar 900ms ease-in-out infinite",
            }}
          />
        </div>
        <div style={{ marginTop: 10, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(240,240,240,0.42)" }}>
          Загрузка
        </div>
      </div>
      <style>{`@keyframes magnumLoaderBar{0%{transform:translateX(-110%)}100%{transform:translateX(260%)}}@keyframes magnumLoaderIn{from{opacity:0;transform:translateY(8px) scale(0.98)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
