import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { TEMPLATES, MEME_FONTS, validateMemeText } from "../lib/meme42";
import { fetchMe } from "../lib/authMe";

type Template = typeof TEMPLATES[number];
type MemeItem = { id: number; user_id: number; template: string; top_text: string; bottom_text: string; image_url: string | null; likes: number; username: string; created_at: string; liked?: boolean };
type Duel = { id: number; meme_a: number; meme_b: number; votes_a: number; votes_b: number; ends_at: string; a?: MemeItem; b?: MemeItem };

export function Meme42Page() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const duelRef = useRef<HTMLDivElement>(null);

  const [sel, setSel] = useState<Template>(TEMPLATES[0]!);
  const [top, setTop] = useState("");
  const [bottom, setBottom] = useState("");
  const [fontId, setFontId] = useState<"impact"|"42-bold">("impact");
  const [dragTop, setDragTop] = useState({ x: 0, y: -380 });
  const [dragBottom, setDragBottom] = useState({ x: 0, y: 380 });
  const [dragging, setDragging] = useState<null|"top"|"bottom">(null);
  const [msg, setMsg] = useState("");
  const [isLogged, setIsLogged] = useState(false);

  // feed
  const [filter, setFilter] = useState<"top"|"new"|"friends">("top");
  const [memes, setMemes] = useState<MemeItem[]>([]);
  const [memesLoading, setMemesLoading] = useState(true);
  // duel
  const [duel, setDuel] = useState<Duel|null>(null);
  const [duelVoted, setDuelVoted] = useState(false);
  const [duelNow, setDuelNow] = useState(Date.now());

  useEffect(() => {
    fetchMe().then(u=> setIsLogged(!!u)).catch(()=>{});
    const onAuth = () => fetchMe(true).then(u=> setIsLogged(!!u)).catch(()=>{});
    window.addEventListener("magnum:auth" as unknown as string, onAuth as EventListener);
    return ()=> window.removeEventListener("magnum:auth" as unknown as string, onAuth as EventListener);
  }, []);

  // GSAP: template hover scale 1.04 handled via onEnter/Leave, preview flip y12 0.3, feed stagger y16 0.07, duel slide x24 0.3
  useEffect(() => {
    if (!wrapRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.set(wrapRef.current!, { y: -12, opacity: 0 });
      gsap.to(wrapRef.current!, { y: 0, opacity: 1, duration: 0.42, ease: "power2.out" });
    }, wrapRef);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    const id = window.setInterval(()=> setDuelNow(Date.now()), 1000);
    return ()=> window.clearInterval(id);
  }, []);

  const fetchMemes = useCallback(async () => {
    setMemesLoading(true);
    try {
      const r = await fetch(`/magnum/api/memes?filter=${filter}`, { credentials: "include" });
      const j = await r.json() as { memes?: MemeItem[] };
      if (Array.isArray(j.memes)) setMemes(j.memes);
    } catch {}
    setMemesLoading(false);
  }, [filter]);

  const fetchDuel = useCallback(async () => {
    try {
      const r = await fetch("/magnum/api/memes/duel", { credentials: "include" });
      if (!r.ok) { setDuel(null); return; }
      const j = await r.json() as { duel?: Duel };
      if (j.duel) { setDuel(j.duel); setDuelVoted(false); }
    } catch { setDuel(null); }
  }, []);

  useEffect(()=> { void fetchMemes(); }, [fetchMemes]);
  useEffect(()=> { void fetchDuel(); }, [fetchDuel]);

  // stagger feed
  useEffect(()=> {
    if (!gridRef.current || memesLoading || memes.length===0) return;
    const cards = gridRef.current.querySelectorAll<HTMLElement>("[data-meme]");
    if (!cards.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { gsap.set(cards, { y:0, opacity:1 }); return; }
    const ctx = gsap.context(()=> {
      gsap.set(cards, { y: 16, opacity: 0 });
      gsap.to(cards, { y:0, opacity:1, stagger:0.07, duration:0.45, ease:"power2.out", overwrite:true });
    }, gridRef);
    return ()=> ctx.revert();
  }, [memes, memesLoading, filter]);

  // draw canvas 1080x1080
  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const W=1080, H=1080;
    c.width=W; c.height=H;
    // bg gradient by template
    const t = sel;
    // parse gradient: use solid from accent + overlay
    // simple: fill with top color, then overlay gradient via canvas gradient
    const grad = ctx.createLinearGradient(0,0,1080,1080);
    // approximate from template.bg — extract colors
    if (t.id==="42-magnum") { grad.addColorStop(0,"#ff2d55"); grad.addColorStop(0.45,"#8a162c"); grad.addColorStop(1,"#1a1a1a"); }
    else if (t.id==="42-bro") { grad.addColorStop(0,"#5865f2"); grad.addColorStop(0.55,"#0a0a0a"); grad.addColorStop(1,"#ff2d55"); }
    else if (t.id==="42-kuzbass") { grad.addColorStop(0,"#ff8a00"); grad.addColorStop(0.5,"#1a0a0a"); grad.addColorStop(1,"#00ff88"); }
    else if (t.id==="42-mining") { grad.addColorStop(0,"#00ff88"); grad.addColorStop(0.45,"#00331a"); grad.addColorStop(1,"#ffcc00"); }
    else if (t.id==="42-meduza") { grad.addColorStop(0,"#ff44cc"); grad.addColorStop(0.55,"#00ffcc"); grad.addColorStop(1,"#0a0a0a"); }
    else if (t.id==="42-vpn") { grad.addColorStop(0,"#0a1a2a"); grad.addColorStop(0.5,"#00ffcc"); grad.addColorStop(1,"#9147ff"); }
    else if (t.id==="42-clay") { grad.addColorStop(0,"#8a3c00"); grad.addColorStop(0.55,"#ffd76a"); grad.addColorStop(1,"#ff2d55"); }
    else { grad.addColorStop(0,"#9147ff"); grad.addColorStop(0.45,"#ff2d55"); grad.addColorStop(0.9,"#ffcc00"); }
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,W,H);
    // vignette frame
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 4;
    ctx.strokeRect(20,20,1040,1040);
    // emoji watermark big faint
    ctx.font = "360px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = 0.10;
    ctx.fillText(t.emoji, 540, 540);
    ctx.globalAlpha = 1;
    // text rendering
    const font = MEME_FONTS.find(f=>f.id===fontId) ?? MEME_FONTS[0]!;
    const renderText = (txt: string, pos: {x:number,y:number}) => {
      if (!txt.trim()) return;
      const lines = wrapText(ctx, txt.toUpperCase(), 900);
      const lineH = fontId==="impact" ? 92 : 78;
      const totalH = lines.length * lineH;
      let y = 540 + pos.y - totalH/2 + lineH/2;
      const x = 540 + pos.x;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = fontId==="impact" ? 10 : 8;
      ctx.lineJoin = "round";
      ctx.font = `${fontId==="impact" ? "900 84px" : "900 72px"} ${font.family}`;
      // shadow
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 6;
      for (const line of lines) {
        ctx.strokeText(line, x, y);
        ctx.fillText(line, x, y);
        y += lineH;
      }
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    };
    renderText(top, dragTop);
    renderText(bottom, dragBottom);
    // label 42
    ctx.font = "bold 28px Inter, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.textAlign = "right";
    ctx.fillText("42  •  MAGNUM", 1040, 1040);
  }, [sel, top, bottom, fontId, dragTop, dragBottom]);

  useEffect(()=> { draw(); }, [draw]);

  // preview flip y12 0.3 on sel change
  useEffect(()=> {
    const c = canvasRef.current;
    if (!c) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(c, { y: 12, opacity: 0.96 }, { y:0, opacity:1, duration:0.30, ease:"power2.out", overwrite:true });
  }, [sel.id]);

  function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      const m = ctx.measureText(test);
      if (m.width > maxWidth && cur) { lines.push(cur); cur = w; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    return lines.slice(0,3);
  }

  // drag handlers for preview
  useEffect(()=> {
    const c = canvasRef.current;
    if (!c) return;
    let start: {x:number,y:number}|null=null;
    let which: "top"|"bottom"|null=null;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const rect = c.getBoundingClientRect();
      const pt = "touches" in e ? e.touches[0]! : e as MouseEvent;
      const cx = pt.clientX - rect.left - rect.width/2;
      const cy = pt.clientY - rect.top - rect.height/2;
      // decide nearest
      const dt = Math.hypot(cx - dragTop.x*rect.width/1080, cy - dragTop.y*rect.height/1080);
      const db = Math.hypot(cx - dragBottom.x*rect.width/1080, cy - dragBottom.y*rect.height/1080);
      which = dt < db ? "top" : "bottom";
      setDragging(which);
      start = { x: cx, y: cy };
      if (which==="top") { (window as unknown as { _dragStart: unknown })._dragStart = {...dragTop}; }
      else { (window as unknown as { _dragStart: unknown })._dragStart = {...dragBottom}; }
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!which || !start) return;
      const rect = c.getBoundingClientRect();
      const pt = "touches" in e ? e.touches[0]! : e as MouseEvent;
      const cx = pt.clientX - rect.left - rect.width/2;
      const cy = pt.clientY - rect.top - rect.height/2;
      const dx = (cx - start.x) * 1080/rect.width;
      const dy = (cy - start.y) * 1080/rect.height;
      const origin = (window as unknown as { _dragStart: {x:number,y:number} })._dragStart;
      if (!origin) return;
      const nx = Math.max(-480, Math.min(480, origin.x + dx));
      const ny = Math.max(-500, Math.min(500, origin.y + dy));
      if (which==="top") setDragTop({x:nx,y:ny});
      else setDragBottom({x:nx,y:ny});
    };
    const onUp = ()=> { which=null; start=null; setDragging(null); };
    c.addEventListener("mousedown", onDown);
    c.addEventListener("touchstart", onDown, {passive:false});
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, {passive:false});
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    return ()=> {
      c.removeEventListener("mousedown", onDown);
      c.removeEventListener("touchstart", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, [dragTop, dragBottom]);

  const doCreate = async () => {
    const et = validateMemeText(top);
    const eb = validateMemeText(bottom);
    if (et) { setMsg(et); return; }
    if (eb) { setMsg(eb); return; }
    if (!isLogged) { window.dispatchEvent(new CustomEvent("magnum:need-auth")); setMsg("Войди, братуха — нужен логин 🔐"); return; }
    setMsg("Создаю…");
    try {
      const r = await fetch("/magnum/api/memes", { method:"POST", credentials:"include", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ template: sel.id, top_text: top.trim(), bottom_text: bottom.trim() }) });
      const j = await r.json() as { error?: string; meme?: MemeItem };
      if (!r.ok) { setMsg(j.error || "Ошибка"); return; }
      setMsg("Мем создан — 0 монет, лайки +1, топ +142/420/1420 ✅");
      void fetchMemes();
      setTimeout(()=> setMsg(""), 2500);
    } catch { setMsg("Сеть"); }
  };

  const doDownload = () => {
    const c = canvasRef.current;
    if (!c) return;
    const url = c.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `meme42-${sel.id}-${Date.now()}.png`;
    a.click();
    setMsg("PNG 1080×1080 скачан");
    setTimeout(()=> setMsg(""), 1800);
  };

  const doShare = async () => {
    const c = canvasRef.current;
    if (!c) return;
    try {
      // try Web Share with file
      const blob: Blob | null = await new Promise(res=> c.toBlob(b=> res(b), "image/png"));
      if (blob && navigator.canShare && navigator.canShare({ files: [new File([blob], "meme42.png", { type:"image/png"})]})) {
        await navigator.share({ files: [new File([blob], "meme42.png", { type:"image/png"})], title:"МЕМ 42 — MAGNUM", text:`${top} ${bottom} — 5opka.ru/magnum/memes` });
      } else if (navigator.share) {
        await navigator.share({ title:"МЕМ 42", text:`${top} ${bottom}`, url: location.href });
      } else {
        await navigator.clipboard.writeText(location.href);
        setMsg("Ссылка скопирована");
      }
      // server share +42/day
      try {
        const r = await fetch("/magnum/api/memes/share", { method:"POST", credentials:"include", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ template: sel.id }) });
        const j = await r.json() as { ok?:boolean; reward?:number; error?:string };
        if (r.ok && j.reward) setMsg(`Шаринг +${j.reward} ✅`);
        else if (j.error) setMsg(j.error);
      } catch {}
    } catch { setMsg("Шаринг отменён"); }
  };

  const doLike = async (id: number) => {
    if (!isLogged) { window.dispatchEvent(new CustomEvent("magnum:need-auth")); return; }
    try {
      const r = await fetch(`/magnum/api/memes/${id}/like`, { method:"POST", credentials:"include" });
      const j = await r.json() as { error?: string; likes?: number };
      if (!r.ok) { setMsg(j.error || "ошибка лайка"); setTimeout(()=> setMsg(""),1800); return; }
      setMemes(prev=> prev.map(m=> m.id===id ? { ...m, likes: j.likes ?? m.likes+1, liked:true } : m));
      // GSAP pulse
      const el = gridRef.current?.querySelector(`[data-meme="${id}"]`) as HTMLElement|null;
      if (el && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.fromTo(el, { scale:1 }, { scale:1.03, duration:0.16, yoyo:true, repeat:1, ease:"power2.inOut" });
      }
    } catch {}
  };

  const doReport = async (id:number) => {
    if (!isLogged) { window.dispatchEvent(new CustomEvent("magnum:need-auth")); return; }
    const reason = prompt("Причина репорта?", "спам/оскорбление");
    if (!reason) return;
    try{
      const r = await fetch(`/magnum/api/memes/${id}/report`, { method:"POST", credentials:"include", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ reason: reason.slice(0,64) }) });
      const j = await r.json() as { error?:string };
      if (!r.ok) setMsg(j.error || "ошибка"); else setMsg("Репорт отправлен — модерация 42");
      setTimeout(()=> setMsg(""), 1800);
    }catch{}
  };

  const doDuelVote = async (choice:"a"|"b") => {
    if (!duel) return;
    if (!isLogged) { window.dispatchEvent(new CustomEvent("magnum:need-auth")); return; }
    if (duelVoted) return;
    setDuelVoted(true);
    // shake x±6
    if (duelRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.fromTo(duelRef.current, { x: -6 }, { x: 6, duration:0.08, yoyo:true, repeat:5, ease:"power2.inOut", onComplete:()=> gsap.set(duelRef.current!, { x:0 }) });
    }
    try {
      const r = await fetch("/magnum/api/memes/duel/vote", { method:"POST", credentials:"include", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ duelId: duel.id, choice }) });
      const j = await r.json() as { error?:string; votes_a?:number; votes_b?:number; winner?:string };
      if (!r.ok) { setMsg(j.error||"голос не засчитан"); setDuelVoted(false); return; }
      setDuel(d=> d ? { ...d, votes_a: j.votes_a ?? d.votes_a, votes_b: j.votes_b ?? d.votes_b } : d);
      // optimistic confetti if winner announced
      if (j.winner) {
        setMsg(`Победа +42 автору!`);
        // confetti 100
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) spawnConfetti();
      } else {
        setMsg(choice==="a"?"Голос за левый":"Голос за правый");
      }
      setTimeout(()=> setMsg(""), 2000);
    } catch { setDuelVoted(false); }
  };

  function spawnConfetti() {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const colors = ["#ff2d55","#ffcc00","#00ff88","#9147ff","#00ffcc"];
    for(let i=0;i<100;i++){
      const el = document.createElement("div");
      el.style.position="fixed";
      el.style.left = Math.random()*100+"vw";
      el.style.top = "-10px";
      el.style.width = "8px";
      el.style.height = "12px";
      el.style.background = colors[Math.floor(Math.random()*colors.length)]!;
      el.style.borderRadius = "2px";
      el.style.zIndex = "9999";
      el.style.pointerEvents = "none";
      document.body.appendChild(el);
      gsap.to(el, { y: window.innerHeight+40, x: (Math.random()-0.5)*200, rotation: Math.random()*720, duration: 0.9 + Math.random()*0.7, ease:"power1.in", onComplete:()=> el.remove() });
    }
  }

  const onTplEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.to(e.currentTarget, { scale: 1.04, duration:0.22, ease:"power2.out", overwrite:true });
  };
  const onTplLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.to(e.currentTarget, { scale: 1, duration:0.28, ease:"power2.out", overwrite:true });
  };

  const duelRemain = duel ? Math.max(0, Math.ceil((new Date(duel.ends_at).getTime() - duelNow)/1000)) : 0;

  return (
    <div ref={wrapRef} style={{ maxWidth: 1100, margin:"0 auto", padding:"24px 16px" }}>
      <h1 style={{ fontSize:28, fontWeight:900, letterSpacing:"-0.02em" }}>МЕМ-КУЗНИЦА 42 <span style={{ opacity:0.6, fontSize:14, fontWeight:600 }}>— генератор 1080×1080</span></h1>
      <p style={{ opacity:0.7, marginTop:6, fontSize:13 }}>8 шаблонов MAGNUM · текст top/bottom + drag · canvas 1080×1080 · Скачать PNG / Шаринг +42/день · лента + дуэль 42с</p>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:12, marginTop:16 }}>
        {TEMPLATES.map(t=> (
          <div key={t.id} onMouseEnter={onTplEnter} onMouseLeave={onTplLeave} onClick={()=> setSel(t)} data-testid={`tpl-${t.id}`} style={{ cursor:"pointer", borderRadius:14, padding:10, background:t.bg, border: sel.id===t.id ? "2px solid #ffcc00" : "1px solid rgba(255,255,255,0.12)", transformOrigin:"center", position:"relative", overflow:"hidden" }}>
            <div style={{ fontSize:22 }}>{t.emoji}</div>
            <div style={{ marginTop:6, fontWeight:900, fontSize:13, color:"#fff", textShadow:"0 1px 8px rgba(0,0,0,0.6)" }}>{t.name}</div>
            <div style={{ fontSize:11, opacity:0.85, color:"#fff" }}>{t.hint}</div>
            {sel.id===t.id && <div style={{ position:"absolute", top:8, right:8, fontSize:11, background:"#ffcc00", color:"#000", padding:"2px 6px", borderRadius:999, fontWeight:800 }}>выбран</div>}
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginTop:18 }}>
        <div style={{ padding:14, borderRadius:14, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)" }}>
          <h3 style={{ fontSize:13, fontWeight:900, letterSpacing:"0.06em" }}>ТЕКСТ 42</h3>
          <input value={top} onChange={e=> setTop(e.target.value.slice(0,40))} placeholder="ВЕРХ ТЕКСТ (до 40)" maxLength={40} style={{ width:"100%", marginTop:10, padding:"10px 12px", borderRadius:10, border:"1px solid rgba(255,255,255,0.12)", background:"rgba(0,0,0,0.35)", color:"#fff", fontSize:13, fontWeight:800, letterSpacing:"0.02em" }} />
          <input value={bottom} onChange={e=> setBottom(e.target.value.slice(0,40))} placeholder="НИЗ ТЕКСТ (до 40)" maxLength={40} style={{ width:"100%", marginTop:8, padding:"10px 12px", borderRadius:10, border:"1px solid rgba(255,255,255,0.12)", background:"rgba(0,0,0,0.35)", color:"#fff", fontSize:13, fontWeight:800, letterSpacing:"0.02em" }} />
          <div style={{ display:"flex", gap:8, marginTop:10 }}>
            {MEME_FONTS.map(f=> (
              <button key={f.id} onClick={()=> setFontId(f.id as never)} style={{ flex:1, padding:"8px 10px", borderRadius:10, border: fontId===f.id ? "1px solid #ff2d55":"1px solid rgba(255,255,255,0.12)", background: fontId===f.id ? "rgba(255,45,85,0.18)" : "rgba(255,255,255,0.06)", color:"#fff", fontSize:12, fontWeight:800 }}>{f.label}</button>
            ))}
          </div>
          <div style={{ fontSize:11, opacity:0.5, marginTop:8 }}>Перетаскивай текст на превью — drag top/bottom · {dragging ? `drag ${dragging}` : "кликни и тяни"}</div>
          <div style={{ display:"flex", gap:8, marginTop:12 }}>
            <button onClick={doCreate} style={{ flex:1, padding:"10px 12px", borderRadius:10, border:"1px solid #00ff88", background:"rgba(0,255,136,0.14)", color:"#fff", fontWeight:900, cursor:"pointer" }}>Создать мем (0 монет)</button>
            <button onClick={doDownload} style={{ padding:"10px 12px", borderRadius:10, border:"1px solid #ffcc00", background:"rgba(255,204,0,0.14)", color:"#fff", fontWeight:800, cursor:"pointer" }}>Скачать PNG</button>
            <button onClick={doShare} style={{ padding:"10px 12px", borderRadius:10, border:"1px solid #9147ff", background:"rgba(145,71,255,0.16)", color:"#fff", fontWeight:800, cursor:"pointer" }}>Шаринг +42</button>
          </div>
          <div style={{ fontSize:12, opacity:0.7, marginTop:8, minHeight:18 }}>{msg}</div>
          <div style={{ fontSize:11, opacity:0.5, marginTop:6 }}>Анти-спам: 3 мема/час · лайк +1 автору · топ дня +142/420/1420</div>
        </div>

        <div style={{ padding:14, borderRadius:14, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", display:"grid", placeItems:"center" }}>
          <div style={{ width:"100%", maxWidth:420, aspectRatio:"1 / 1", position:"relative" }}>
            <canvas ref={canvasRef} width={1080} height={1080} style={{ width:"100%", height:"100%", borderRadius:14, display:"block", border:"1px solid rgba(255,255,255,0.10)", cursor: dragging ? "grabbing" : "grab" }} data-testid="meme-canvas" />
          </div>
          <div style={{ fontSize:11, opacity:0.5, marginTop:8 }}>Превью 1080×1080 · OG 1080 для шаринга</div>
        </div>
      </div>

      {/* ДУЭЛЬ */}
      <div ref={duelRef} style={{ marginTop:18, padding:14, borderRadius:14, background:"linear-gradient(135deg,rgba(255,45,85,0.10),rgba(145,71,255,0.10))", border:"1px solid rgba(255,45,85,0.18)" }}>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <h3 style={{ fontSize:13, fontWeight:900, letterSpacing:"0.06em" }}>ДУЭЛЬ МЕМОВ 42с</h3>
          <span style={{ fontSize:12, padding:"4px 8px", borderRadius:999, background:"rgba(0,0,0,0.35)", border:"1px solid rgba(255,255,255,0.12)" }}>⏳ {duel ? `${duelRemain}с` : "—"}</span>
          <span style={{ fontSize:11, opacity:0.7 }}>2 рандом мема · голос 42с · победитель +42 автору</span>
          <button onClick={fetchDuel} style={{ marginLeft:"auto", padding:"6px 10px", borderRadius:8, border:"1px solid rgba(255,255,255,0.12)", background:"rgba(255,255,255,0.06)", color:"#fff", fontSize:12, fontWeight:800, cursor:"pointer" }}>Новая дуэль</button>
        </div>
        {duel?.a && duel?.b ? (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:12 }}>
            {[duel.a, duel.b].map((m, idx)=> (
              <div key={m.id} style={{ padding:10, borderRadius:12, background:"rgba(0,0,0,0.35)", border:"1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ height:140, borderRadius:10, background: TEMPLATES.find(t=>t.id===m.template)?.bg || "rgba(255,255,255,0.06)", display:"grid", placeItems:"center", fontSize:12, color:"#fff", textAlign:"center", padding:8 }}>
                  <div><div style={{ fontWeight:900 }}>{m.top_text || "—"}</div><div style={{ opacity:0.7, marginTop:4 }}>{m.bottom_text || "—"}</div><div style={{ marginTop:6, fontSize:11, opacity:0.6 }}>{m.template} · @{m.username} · ❤️ {idx===0? duel.votes_a : duel.votes_b}</div></div>
                </div>
                <button onClick={()=> doDuelVote(idx===0?"a":"b")} disabled={duelVoted || duelRemain===0} style={{ marginTop:8, width:"100%", padding:"8px 10px", borderRadius:8, border:"1px solid #ff2d55", background: duelVoted ? "rgba(255,255,255,0.06)" : "rgba(255,45,85,0.18)", color: duelVoted ? "#999" : "#fff", fontWeight:800, cursor: duelVoted||duelRemain===0 ? "not-allowed":"pointer" }}>{duelVoted ? "Голос учтён" : duelRemain===0 ? "Время вышло" : `Голос ${idx===0? "← левый":"правый →"}`}</button>
              </div>
            ))}
          </div>
        ) : <div style={{ marginTop:10, fontSize:12, opacity:0.6 }}>Загрузка дуэли… создай хотя бы 2 мема</div>}
      </div>

      {/* ЛЕНТА */}
      <div style={{ marginTop:18 }}>
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          <h3 style={{ fontSize:14, fontWeight:900 }}>Лента мемов</h3>
          <div style={{ display:"flex", gap:6 }}>
            {(["top","new","friends"] as const).map(k=> (
              <button key={k} onClick={()=> setFilter(k)} style={{ padding:"6px 10px", borderRadius:999, border: filter===k ? "1px solid #ff2d55":"1px solid rgba(255,255,255,0.12)", background: filter===k ? "rgba(255,45,85,0.18)":"rgba(255,255,255,0.04)", color:"#fff", fontSize:12, fontWeight:800 }}>{k==="top"?"Топ":k==="new"?"Новые":"Друзья"}</button>
            ))}
          </div>
          <span style={{ fontSize:11, opacity:0.6 }}>{memes.length} мемов</span>
        </div>
        <div ref={gridRef} style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:12, marginTop:12 }}>
          {memesLoading && <div style={{ opacity:0.6, fontSize:12 }}>Загрузка…</div>}
          {!memesLoading && memes.length===0 && <div style={{ opacity:0.6, fontSize:12, padding:16, border:"1px dashed rgba(255,255,255,0.12)", borderRadius:12 }}>Пока пусто — создай первый мем 1080×1080</div>}
          {memes.map(m=> {
            const tpl = TEMPLATES.find(t=>t.id===m.template);
            return (
              <div key={m.id} data-meme={m.id} style={{ padding:10, borderRadius:12, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.06)", display:"flex", flexDirection:"column" }}>
                <div style={{ height:140, borderRadius:10, background: tpl?.bg || "rgba(255,255,255,0.06)", display:"grid", placeItems:"center", fontSize:12, color:"#fff", textAlign:"center", padding:8 }}>
                  <div><div style={{ fontWeight:900 }}>{m.top_text || "—"}</div><div style={{ opacity:0.8, marginTop:4 }}>{m.bottom_text || "—"}</div><div style={{ marginTop:8, fontSize:10, opacity:0.6 }}>{tpl?.name || m.template}</div></div>
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center", marginTop:8 }}>
                  <span style={{ fontSize:11, opacity:0.7 }}>@{m.username}</span>
                  <span style={{ marginLeft:"auto", fontSize:12, fontWeight:800 }}>❤️ {m.likes}</span>
                </div>
                <div style={{ display:"flex", gap:6, marginTop:8 }}>
                  <button onClick={()=> doLike(m.id)} style={{ flex:1, padding:"6px 8px", borderRadius:8, border:"1px solid #ff2d55", background:"rgba(255,45,85,0.14)", color:"#fff", fontSize:12, fontWeight:800, cursor:"pointer" }}>Лайк +1</button>
                  <button onClick={()=> doReport(m.id)} style={{ padding:"6px 8px", borderRadius:8, border:"1px solid rgba(255,255,255,0.12)", background:"rgba(255,255,255,0.04)", color:"#fff", fontSize:11, cursor:"pointer" }}>Репорт</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ fontSize:11, opacity:0.45, marginTop:12 }}>OG 1080×1080 для шаринга · /magnum/api/memes/:id/og · health 200 · tsc 0</div>
    </div>
  );
}
