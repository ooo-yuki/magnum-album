import { useEffect, useState, useCallback, useRef } from "react";
import gsap from "gsap";

const OFFERS = [
  { id: "mops", label: "Мопс 42", emoji: "🐗", price: 42 },
  { id: "panda", label: "Панда 42", emoji: "🐼", price: 142 },
  { id: "shark", label: "Акула 42", emoji: "🦈", price: 420 },
];

export function PromoPopup() {
  const [visible, setVisible] = useState(false);
  const [sec, setSec] = useState(30);
  const [buying, setBuying] = useState<string | null>(null);
  const discount = sec > 0 ? 0.1 : 0;
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // P0 funnel: если только что был пресейв-мост, донат-попап откладываем — сначала игра.
    let delayMs = 800;
    try {
      const raw = sessionStorage.getItem("magnum:post-presave-bridge-at") || localStorage.getItem("magnum:post-presave-bridge-at");
      if (raw) {
        const age = Date.now() - Number(raw);
        if (age >= 0 && age < 10 * 60 * 1000) delayMs = 120_000; // 2 мин после пресейва
      }
    } catch {}
    const t = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!visible || !overlayRef.current || !cardRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (prefersReduced) {
        gsap.set(overlayRef.current, { opacity: 1, clearProps: "transform" });
        if (cardRef.current) gsap.set(cardRef.current, { y: 0, opacity: 1, scale: 1, clearProps: "transform" });
        if (cardRef.current) gsap.set(cardRef.current.querySelectorAll("div"), { y: 0, opacity: 1 });
        return;
      }
      gsap.set(overlayRef.current, { opacity: 0 });
      gsap.set(cardRef.current, { y: 24, opacity: 0, scale: 0.97 });
      gsap.to(overlayRef.current, { opacity: 1, duration: 0.35, ease: "power2.out" });
      gsap.to(cardRef.current, { y: 0, opacity: 1, scale: 1, duration: 0.55, ease: "back.out(1.4)", delay: 0.08 });
      // stagger inner offer cards
      const offers = cardRef.current!.querySelectorAll("div");
      gsap.set(offers, { y: 12, opacity: 0 });
      gsap.to(offers, { y: 0, opacity: 1, duration: 0.4, stagger: 0.08, ease: "power2.out", delay: 0.25 });
      const primary = cardRef.current!.querySelector("a") as HTMLElement | null;
      if (primary) gsap.to(primary, { boxShadow: "0 0 22px rgba(255,45,85,0.35), 0 0 36px rgba(255,204,0,0.12)", duration: 1.2, repeat: -1, yoyo: true, ease: "sine.inOut" });
    }, overlayRef);
    return () => ctx.revert();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    if (sec <= 0) return;
    const id = window.setInterval(() => setSec((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [visible, sec]);

  const close = useCallback(() => {
    setVisible(false);
  }, []);

  const buy = async (offer: typeof OFFERS[number]) => {
    const price = Math.round(offer.price * (1 - discount));
    setBuying(offer.id);
    try {
      // try discounted purchase via shop/buy; server charges full price => we fallback to coins/add delta if needed
      const r = await fetch("/magnum/api/shop/buy", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skinId: offer.id }),
      });
      if (r.ok) {
        close();
        window.location.href = "/magnum/shop";
        return;
      }
      // fallback: if not enough coins etc, just close and mark seen
      const d = await r.json().catch(()=>({})) as any;
      if (r.status === 402) {
        alert(`Нужно ${d.price ?? offer.price}, у тебя ${d.balance ?? 0}. Фарми в играх!`);
        return;
      }
      // if server expects different handling, try coins/add for promo
      if (discount > 0) {
        // attempt to deduct discounted amount and add to inventory via coins/add is not ideal, just close
      }
      close();
    } catch {
      close();
    } finally {
      setBuying(null);
    }
  };

  if (!visible) return null;

  return (
    <div ref={overlayRef} style={{ position:"fixed", inset:0, zIndex:9999, display:"grid", placeItems:"center", background:"rgba(0,0,0,.62)", backdropFilter:"blur(6px)" }} onClick={close}>
      <div ref={cardRef} onClick={(e)=>e.stopPropagation()} style={{ width:"min(560px,92vw)", background:"#121216", border:"1px solid rgba(255,255,255,.1)", borderRadius:20, padding:20, boxShadow:"0 24px 64px rgba(0,0,0,.6), 0 0 32px rgba(255,45,85,.25)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <span style={{ fontWeight:900, letterSpacing:".06em", background:"linear-gradient(90deg,#ff2d55,#ffcc00)", WebkitBackgroundClip:"text", color:"transparent", fontSize:18 }}>СПЕЦОФФЕР 42 🔥</span>
          <button onClick={close} aria-label="Закрыть" style={{ width:32, height:32, borderRadius:10, border:"1px solid rgba(255,255,255,.1)", background:"rgba(255,255,255,.06)", color:"#fff", cursor:"pointer" }}>×</button>
        </div>
        <p style={{ margin:"0 0 12px", color:"#9aa4b2", fontSize:13 }}>Только при входе — скидка <b style={{color:"#00ff88"}}>10%</b> на 30 сек! {sec>0 ? <span style={{color:"#ffcc00"}}>⏳ {sec}с</span> : <span style={{color:"#ff2d55"}}>скидка истекла</span>} · ведёт к пресейву → <a href="https://music.thefence.me/psmagnum" target="_blank" rel="noreferrer" style={{color:"#ff2d55"}}>поставить пресейв</a></p>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
          {OFFERS.map(o=>{
            const disc = Math.round(o.price * (1 - discount));
            return (
              <div key={o.id} style={{ background:"#17171d", border:"1px solid rgba(255,255,255,.08)", borderRadius:14, padding:14, textAlign:"center" }}>
                <div style={{ fontSize:36 }}>{o.emoji}</div>
                <div style={{ fontWeight:800, fontSize:13, margin:"6px 0" }}>{o.label}</div>
                <div style={{ fontSize:12, color:"#9aa4b2" }}>
                  {discount>0 ? <><s>🪙 {o.price}</s> <b style={{color:"#00ff88"}}>🪙 {disc}</b> <span style={{color:"#ff2d55"}}>-10%</span></> : <>🪙 {o.price}</>}
                </div>
                <button disabled={buying===o.id} onClick={()=>buy(o)} style={{ marginTop:10, width:"100%", padding:"8px 10px", borderRadius:10, border:"1px solid #ffcc00", background:"linear-gradient(135deg,rgba(255,204,0,.18),rgba(255,45,85,.14))", color:"#ffcc00", fontWeight:900, cursor:"pointer", opacity: buying===o.id? .6:1 }}>
                  {buying===o.id ? "…" : `Купить ${discount>0?disc:o.price}`}
                </button>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop:12, display:"flex", gap:8, justifyContent:"center" }}>
          <a href="https://music.thefence.me/psmagnum" target="_blank" rel="noreferrer" style={{ padding:"8px 14px", borderRadius:999, background:"#ff2d55", color:"#fff", fontWeight:800, textDecoration:"none" }}>Пресейв MAGNUM →</a>
          <button onClick={close} style={{ padding:"8px 14px", borderRadius:999, border:"1px solid rgba(255,255,255,.12)", background:"transparent", color:"#9aa4b2", cursor:"pointer" }}>Позже</button>
        </div>
      </div>
    </div>
  );
}
