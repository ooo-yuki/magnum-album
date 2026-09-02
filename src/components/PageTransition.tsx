import { useEffect, useRef } from "react";
import gsap from "gsap";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(el, { opacity: 1, y: 0, clearProps: "filter,transform" });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.set(el, { opacity: 0, y: 10, filter: "blur(6px)" });
      gsap.to(el, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.46, ease: "power2.out", overwrite: true });
    }, ref);
    const t = window.setTimeout(() => gsap.set(el, { opacity: 1, y: 0, filter: "blur(0px)", clearProps: "filter" }), 800);
    return () => { clearTimeout(t); ctx.revert(); };
  }, []);

  return (
    <div ref={ref} style={{ minHeight: "40vh" }}>
      {children}
    </div>
  );
}
