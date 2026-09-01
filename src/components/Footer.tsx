import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import styles from "./Footer.module.css";

const KONAMI: string[] = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

function spawnKonamiConfetti() {
  const colors = ["#ff2d55", "#ffcc00", "#00ff88", "#5865f2", "#ff6b35", "#ffffff"];
  const container = document.createElement("div");
  Object.assign(container.style, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: "10000",
    overflow: "hidden",
  } as CSSStyleDeclaration);
  document.body.appendChild(container);
  const pieces: HTMLDivElement[] = [];
  for (let i = 0; i < 90; i++) {
    const el = document.createElement("div");
    const color = colors[i % colors.length];
    const size = 6 + Math.random() * 10;
    const isCircle = Math.random() > 0.5;
    Object.assign(el.style, {
      position: "absolute",
      left: `${Math.random() * 100}vw`,
      top: "-20px",
      width: `${isCircle ? size : size * 1.6}px`,
      height: `${size}px`,
      background: color,
      borderRadius: isCircle ? "50%" : "2px",
      opacity: "0.95",
      transform: `rotate(${Math.random() * 360}deg)`,
    } as CSSStyleDeclaration);
    container.appendChild(el);
    pieces.push(el);
  }
  pieces.forEach((el) => {
    const duration = 1.6 + Math.random() * 1.8;
    const xDrift = (Math.random() - 0.5) * 300;
    gsap.to(el, {
      y: window.innerHeight + 80,
      x: xDrift,
      rotation: 720 + Math.random() * 720,
      duration,
      ease: "power1.in",
      delay: Math.random() * 0.35,
    });
    gsap.to(el, {
      opacity: 0,
      duration: 0.5,
      delay: duration - 0.4 + Math.random() * 0.2,
      ease: "power1.out",
    });
  });
  setTimeout(() => container.remove(), 3200);
}

export function Footer() {
  const [show, setShow] = useState(false);
  const bufferRef = useRef<string[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const e42Ref = useRef<HTMLSpanElement>(null);
  const navigate = useNavigate();

  // GSAP glow pulse on the "42" text
  useEffect(() => {
    if (!e42Ref.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.to(e42Ref.current, {
        textShadow: "0 0 12px rgba(255,45,85,0.7), 0 0 28px rgba(255,45,85,0.35), 0 0 48px rgba(255,45,85,0.15)",
        duration: 1.6,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    });
    return () => ctx.revert();
  }, []);

  const trigger = useCallback(() => {
    setShow(true);
    spawnKonamiConfetti();
    // haptic if available
    try { navigator.vibrate?.(120); } catch {}
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      bufferRef.current.push(key);
      if (bufferRef.current.length > KONAMI.length) bufferRef.current.shift();
      if (bufferRef.current.length === KONAMI.length) {
        const ok = KONAMI.every((k, i) => bufferRef.current[i] === k);
        if (ok) {
          bufferRef.current = [];
          trigger();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [trigger]);

  useEffect(() => {
    if (!show || !overlayRef.current || !cardRef.current) return;
    const ctx = gsap.context(() => {
      gsap.set(overlayRef.current, { opacity: 0 });
      gsap.set(cardRef.current, { scale: 0.88, y: 24, opacity: 0 });
      gsap.to(overlayRef.current, { opacity: 1, duration: 0.24, ease: "power2.out" });
      gsap.to(cardRef.current, { scale: 1, y: 0, opacity: 1, duration: 0.5, ease: "back.out(1.6)", delay: 0.08 });
      // subtle card breathing
      gsap.to(cardRef.current, {
        y: -4,
        duration: 1.8,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: 0.6,
      });
    }, overlayRef);
    return () => ctx.revert();
  }, [show]);

  const close = useCallback(() => {
    if (!overlayRef.current || !cardRef.current) { setShow(false); return; }
    gsap.to(cardRef.current, { scale: 0.94, y: 10, opacity: 0, duration: 0.22, ease: "power2.in" });
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.22, delay: 0.08, onComplete: () => setShow(false) });
  }, []);

  return (
    <>
      <footer className={styles.footer}>
        <p>© 2026 Пятерка × <span className={styles.e42} ref={e42Ref}>42</span> братухи • MAGNUM</p>
      </footer>
      {show && (
        <div
          ref={overlayRef}
          className={styles.konamiOverlay}
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Пасхалка 42"
        >
          <div ref={cardRef} className={styles.konamiCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.konamiBadge}>KONAMI CODE • 42</div>
            <div className={styles.konamiTitle}>BRATUKHI UNLOCKED</div>
            <p className={styles.konamiSub}>
              Ты ввёл секретный код. <b>42 братухи</b> одобряют твою настойчивость. Загляни в раздел «42 братухи» — там целый мир MAGNUM.
            </p>
            <button
              className={styles.konamiBtn}
              onClick={() => { close(); setTimeout(() => navigate("/magnum/42"), 240); }}
            >
              Перейти к 42 →
            </button>
            <div className={styles.konamiHint}>Нажми в любом месте чтобы закрыть • ↑↑↓↓←→←→BA</div>
          </div>
        </div>
      )}
    </>
  );
}
