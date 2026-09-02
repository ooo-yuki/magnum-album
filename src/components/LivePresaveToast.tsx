import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";

const NAMES_42 = [
  "Кирилл","Артём","Ваня","Дима","Саня","Лёша","Никита","Даня","Егор","Илья",
  "Макс","Паша","Сеня","Федя","Гриша","Влад","Тёма","Рома","Костя","Серёга",
  "Женя","Олег","Тимур","Данил","Стас","Миша","Игорь","Денис","Андрюха","Коля",
  "Виталя","Руслан","Богдан","Марат","Ян","Шурик","Борян","Филя","Гоша","Тима",
  "Мелл","5opka",
] as const;

function pickThree(): string[] {
  const pool = [...NAMES_42];
  const out: string[] = [];
  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]!);
  }
  return out;
}

function trackToastImpression(name: string) {
  try {
    fetch("/magnum/api/presave/click", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "impression:live-toast", variant: `live-toast:${name}`, ts: Date.now() }),
    }).catch(() => {});
    // also log variant impression via beacon for analytics
    try {
      const v = (() => { try { return localStorage.getItem("ab_cta") ?? "a"; } catch { return "a"; } })();
      fetch("/magnum/api/presave/click", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://music.thefence.me/psmagnum", variant: `magnum_presave_variant:live-toast:${v}`, ts: Date.now() }),
      }).catch(() => {});
    } catch {}
  } catch {}
}

export function LivePresaveToast() {
  // singleton guard: if Hero+CTA both mount, second instance bails (fixed position dup)
  const isDup = typeof window !== "undefined" && Boolean((window as unknown as { __liveToastMounted?: boolean }).__liveToastMounted);
  const [names] = useState<string[]>(() => pickThree());
  const [idx, setIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);
  const idxRef = useRef(0);

  useEffect(() => {
    if (isDup) return;
    (window as unknown as { __liveToastMounted?: boolean }).__liveToastMounted = true;
    return () => { (window as unknown as { __liveToastMounted?: boolean }).__liveToastMounted = false; };
  }, [isDup]);

  const name = names[idx % names.length] ?? NAMES_42[0]!;

  // log impression on show / rotation
  useEffect(() => {
    if (dismissed || isDup) return;
    trackToastImpression(name);
  }, [name, dismissed, isDup]);

  // rotation 30s
  useEffect(() => {
    if (dismissed || isDup) return;
    const id = window.setInterval(() => {
      setIdx((v) => {
        const nv = (v + 1) % names.length;
        idxRef.current = nv;
        return nv;
      });
    }, 30000);
    return () => clearInterval(id);
  }, [dismissed, names.length, isDup]);

  useEffect(() => {
    if (dismissed || isDup || !cardRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      gsap.set(cardRef.current, { x: 0, opacity: 1, clearProps: "transform" });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(cardRef.current,
        { x: 72, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.52, ease: "power3.out", overwrite: true }
      );
    }, cardRef);
    return () => ctx.revert();
  }, [idx, dismissed, isDup]);

  const handleDismiss = useCallback(() => {
    if (!cardRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDismissed(true);
      setVisible(false);
      return;
    }
    gsap.to(cardRef.current, {
      x: 72, opacity: 0, duration: 0.28, ease: "power2.in",
      onComplete: () => { setDismissed(true); setVisible(false); }
    });
  }, []);

  if (isDup || dismissed || !visible) return null;

  return (
    <div
      ref={cardRef}
      data-testid="live-presave-toast"
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        right: 14,
        bottom: 14,
        zIndex: 85,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px 10px 10px",
        borderRadius: 16,
        background: "rgba(16,16,18,0.96)",
        border: "1px solid rgba(255,204,0,0.22)",
        boxShadow: "0 12px 36px rgba(0,0,0,0.42), 0 0 22px rgba(255,204,0,0.10)",
        backdropFilter: "blur(12px)",
        maxWidth: "min(360px, calc(100vw - 16px))",
        willChange: "transform, opacity",
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 12, display: "grid", placeItems: "center",
        background: "linear-gradient(135deg, #ff2d55, #ffcc00)", color: "#fff", fontWeight: 900, fontSize: 14, flexShrink: 0
      }}>{name.slice(0,1).toUpperCase()}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {name} только что в пресейве 42
        </div>
        <div style={{ fontSize: 11, color: "rgba(240,240,240,0.58)", fontWeight: 700 }}>2/42 до золотой рамки · +42 dust</div>
      </div>
      <a
        href="https://music.thefence.me/psmagnum"
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => { try { localStorage.setItem("presave_done","1"); } catch {} try { sessionStorage.setItem("magnum:post-presave-bridge-at", String(Date.now())); } catch {} try { window.dispatchEvent(new CustomEvent("magnum:presave")); } catch {} }}
        style={{ padding: "6px 10px", borderRadius: 999, background: "#ff2d55", color: "#fff", fontWeight: 900, fontSize: 11, textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0 }}
        data-testid="live-toast-cta"
      >Пресейв →</a>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Закрыть"
        data-testid="live-toast-dismiss"
        style={{ width: 28, height: 28, borderRadius: 10, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}
      >×</button>
    </div>
  );
}

export const LIVE_TOAST_NAMES = NAMES_42;
