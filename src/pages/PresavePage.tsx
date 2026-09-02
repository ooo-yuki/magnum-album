import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Link } from "react-router-dom";

type FrameStatus = { verified: number; tier: string; frames: Array<{ verified: boolean; frame_date: string }> };

export function PresavePage() {
  const [status, setStatus] = useState<FrameStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const frameRef = useRef<HTMLDivElement>(null);
  const verified = (status?.verified ?? 0) > 0;
  const showGold = verified;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/magnum/api/frame/status", { credentials: "include" });
        if (r.ok) {
          const j = (await r.json()) as FrameStatus;
          if (!cancelled) setStatus(j);
        }
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!showGold || !frameRef.current) return;
    const el = frameRef.current;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(el, { scale: 0.85, boxShadow: "0 0 0 rgba(255,204,0,0)" }, { scale: 1, boxShadow: "0 0 16px #ffcc00, 0 0 16px #ffd700", duration: 0.45, ease: "back.out(1.6)" });
    gsap.to(el, { scale: 1.04, boxShadow: "0 0 16px #ffcc00, 0 0 28px rgba(255,204,0,0.45)", duration: 0.35, yoyo: true, repeat: 1, ease: "power2.out", delay: 0.45 });
    gsap.to(el, { scale: 1.02, duration: 1, yoyo: true, repeat: 1, ease: "sine.inOut", delay: 1.2 });
    // glow pulse loop 2s
    gsap.to(el, { boxShadow: "0 0 16px #ffcc00, 0 0 28px rgba(255,204,0,0.45)", duration: 1, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 2 });
  }, [showGold]);

  const crossDiscount = showGold ? "−42 в forge/shop" : "поставь пресейв → −42";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem 3rem" }}>
      <h1 style={{ fontSize: "1.8rem", fontWeight: 900, marginBottom: 8 }}>FRAME VERIFIED GOLD — пресейв MAGNUM</h1>
      <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: 16 }}>
        Кидай скрин пресейва в <strong>БРАТ-БОТ</strong> → получи золотую рамку <span style={{ color: "#ffcc00" }}>VERIFIED GOLD</span> + скидку −42 в forge/shop.
      </p>

      {/* gold frame — conic-gold spin 3s + box-shadow 0 0 16 gold */}
      <div
        ref={frameRef}
        data-testid="presave-gold-frame"
        data-verified={showGold ? "gold" : "none"}
        style={{
          width: 180,
          height: 180,
          borderRadius: 18,
          margin: "1.2rem auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 900,
          fontSize: showGold ? "1.1rem" : "0.95rem",
          color: showGold ? "#1a1a1a" : "rgba(255,255,255,0.7)",
          background: showGold ? "conic-gradient(from 0deg,#ffcc00,#ffd700,#ffcc00)" : "rgba(255,255,255,0.06)",
          boxShadow: showGold ? "0 0 16px #ffcc00, 0 0 16px #ffd700" : "none",
          border: showGold ? "3px solid #ffcc00" : "1px solid rgba(255,255,255,0.12)",
          animation: showGold ? "goldSpin 3s linear infinite" : "none",
          letterSpacing: "0.06em",
          textAlign: "center",
          padding: 12,
        }}
        className={showGold ? "conic-gold gold-glow-pulse" : undefined}
      >
        {loading ? "загрузка…" : showGold ? "✓ VERIFIED GOLD" : "пока без рамки"}
      </div>

      <div style={{ textAlign: "center", marginTop: 12, fontSize: "0.9rem", color: showGold ? "#ffcc00" : "rgba(255,255,255,0.5)" }}>
        {showGold ? "Рамка активна — cross −42 в forge/shop" : "cross " + crossDiscount}
        <div style={{ marginTop: 6, fontSize: "0.78rem", color: "rgba(255,255,255,0.4)" }}>
          {showGold ? "verified-gold" : "none"} · {status ? `${status.verified} verified` : "—"}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 18, flexWrap: "wrap" }}>
        <a href="https://music.thefence.me/psmagnum" target="_blank" rel="noreferrer" style={{ background: "#ffcc00", color: "#1a1a1a", fontWeight: 900, padding: "0.7rem 1.1rem", borderRadius: 999, textDecoration: "none" }}>
          Пресейв MAGNUM →
        </a>
        <Link to="/magnum/shop" style={{ background: "rgba(255,255,255,0.08)", color: "#fff", fontWeight: 700, padding: "0.7rem 1.1rem", borderRadius: 999, textDecoration: "none", border: "1px solid rgba(255,255,255,0.12)" }}>
          В магазин −42 {showGold ? "активна" : ""}
        </Link>
        <Link to="/magnum/presave-rating" style={{ color: "rgba(255,255,255,0.6)", padding: "0.7rem 0.8rem", textDecoration: "underline" }}>
          Рейтинг →
        </Link>
      </div>

      <div style={{ marginTop: 18, padding: "0.8rem", background: "rgba(255,204,0,0.08)", border: "1px solid rgba(255,204,0,0.22)", borderRadius: 12, fontSize: "0.82rem", color: "rgba(255,255,255,0.7)" }}>
        <strong style={{ color: "#ffcc00" }}>БРАТ-БОТ vision:</strong> мимо-v2.5 → эвристика «засчитан»/«легенда» без «не вижу». Скрины → <code>/magnum/api/ai</code> → <code>POST /magnum/api/frame/verify</code> с <code>frame_date ISO</code>.
      </div>
    </div>
  );
}
