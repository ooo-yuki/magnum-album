import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export function TopProgress() {
  const location = useLocation();
  const [active, setActive] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    setActive(true);
    setWidth(18);
    const t1 = window.setTimeout(() => setWidth(72), 80);
    const t2 = window.setTimeout(() => setWidth(100), 360);
    const t3 = window.setTimeout(() => setActive(false), 640);
    const t4 = window.setTimeout(() => setWidth(0), 820);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); window.clearTimeout(t3); window.clearTimeout(t4); };
  }, [location.pathname]);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: 2,
        width: `${width}%`,
        background: "linear-gradient(90deg,#ff2d55,#ffcc00)",
        boxShadow: active ? "0 0 10px rgba(255,45,85,0.6)" : "none",
        opacity: active ? 1 : 0,
        transition: width ? "width 320ms ease, opacity 220ms ease" : "none",
        zIndex: 200,
        pointerEvents: "none",
      }}
    />
  );
}
