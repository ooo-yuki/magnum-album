import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { RADIO_TRACKS, RADIO_REACTION_EMOJIS, getRadioNow, formatTime, type RadioTrack, type RadioEmoji } from "../lib/radio42";
import { subscribeMe } from "../lib/authMe";

type NowResp = { track: RadioTrack; position: number; listeners: number; next: RadioTrack; serverTime: string };
type Reaction = { id: number; emoji: RadioEmoji; username: string; track_slug: string; created_at: string };

function prefersReduced(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function Radio42Page() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const listenersRef = useRef<HTMLSpanElement>(null);
  const floatLayerRef = useRef<HTMLDivElement>(null);
  const audioARef = useRef<HTMLAudioElement>(null);
  const audioBRef = useRef<HTMLAudioElement>(null);
  const [me, setMe] = useState<{id:number; username:string}|null>(null);
  const [now, setNow] = useState<NowResp|null>(null);
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [msg, setMsg] = useState("");
  const [shareMsg, setShareMsg] = useState("");
  const [heartbeatInfo, setHeartbeatInfo] = useState<{listened: number; streak: number; canClaim: boolean}|null>(null);
  const [balance, setBalance] = useState<number|null>(null);
  const [donateMsg, setDonateMsg] = useState("");
  const activeA = useRef(true);
  const lastTrackSlug = useRef<string>("");
  const progressRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket|null>(null);
  const listenedRef = useRef(0);
  const heartbeatTimer = useRef<number|null>(null);

  useEffect(()=> subscribeMe(setMe), []);

  // fetch now loop
  const fetchNow = useCallback(async()=>{
    try{
      const r = await fetch("/magnum/api/radio/now", { credentials: "include" });
      const j = await r.json() as NowResp & { duration?: number };
      if(j?.track){ setNow(j); setPos(j.position); }
    }catch{}
  },[]);
  useEffect(()=>{
    fetchNow();
    const id = window.setInterval(fetchNow, 5000);
    return ()=> window.clearInterval(id);
  },[fetchNow]);

  // fallback local tick if server lag — advance pos 1s when playing
  useEffect(()=>{
    if(!playing || !now) return;
    const id = window.setInterval(()=>{
      setPos(p=>{
        const dur = now.track.durationSec;
        const next = p+1;
        if(next >= dur - 2){
          // near end — will crossfade on next fetchNow flip
          return next % dur;
        }
        return next;
      });
    },1000);
    return ()=> window.clearInterval(id);
  },[playing, now]);

  // sync audio currentTime to position on track change / playing
  useEffect(()=>{
    if(!now) return;
    const slug = now.track.slug;
    if(lastTrackSlug.current !== slug){
      lastTrackSlug.current = slug;
      if(coverRef.current && !prefersReduced()){
        const ctx = gsap.context(()=>{
          gsap.set(coverRef.current,{ y: 16, opacity: 0.85 });
          gsap.to(coverRef.current,{ y: 0, opacity: 1, duration: 0.4, ease: "power2.out" });
        }, coverRef);
        setTimeout(()=>ctx.revert(),500);
      }
      // crossfade 2s between audio elements
      const aEl = audioARef.current;
      const bEl = audioBRef.current;
      if(aEl && bEl){
        const nextActiveIsA = !activeA.current;
        const incoming = nextActiveIsA ? aEl : bEl;
        const outgoing = nextActiveIsA ? bEl : aEl;
        // use silent tone for now; set time near 0
        try{
          incoming.currentTime = now.position;
          incoming.volume = 0;
          if(playing) void incoming.play().catch(()=>{});
          // crossfade
          gsap.to(incoming,{ volume: 0.85, duration: 2, ease: "power1.inOut" });
          gsap.to(outgoing,{ volume: 0, duration: 2, ease: "power1.inOut", onComplete: ()=>{ try{ outgoing.pause(); }catch{} } });
        }catch{}
        activeA.current = nextActiveIsA;
      }
    } else {
      // same track — keep progress sync
      const el = activeA.current ? audioARef.current : audioBRef.current;
      if(el && Math.abs(el.currentTime - pos) > 2.5){
        try{ el.currentTime = pos; }catch{}
      }
    }
  },[now, pos, playing]);

  // visualizer 32 bars scaleY 0.15s random 0.3-1.0
  useEffect(()=>{
    if(!barsRef.current) return;
    if(prefersReduced()) return;
    const bars = barsRef.current.querySelectorAll<HTMLElement>("[data-bar]");
    if(!bars.length) return;
    let raf: number | null = null;
    let running = true;
    const tick = ()=>{
      if(!running) return;
      bars.forEach(b=>{
        const s = 0.3 + Math.random()*0.7;
        gsap.to(b,{ scaleY: s, duration: 0.15, ease: "power1.out", overwrite: "auto" });
      });
      const delay = playing ? 140 : 900;
      raf = window.setTimeout(tick, delay) as unknown as number;
    };
    tick();
    return ()=>{ running=false; if(raf) window.clearTimeout(raf); gsap.killTweensOf(bars as unknown as never); };
  },[playing]);

  // listeners pulse 1.08 1s
  useEffect(()=>{
    if(!listenersRef.current) return;
    if(prefersReduced()) return;
    const ctx = gsap.context(()=>{
      gsap.to(listenersRef.current,{ scale: 1.08, duration: 1, ease: "sine.inOut", yoyo: true, repeat: -1 });
    }, listenersRef);
    return ()=>ctx.revert();
  },[now?.listeners]);

  // progress bar width
  useEffect(()=>{
    if(!progressRef.current || !now) return;
    const pct = Math.min(100, (pos/now.track.durationSec)*100);
    gsap.to(progressRef.current,{ width: `${pct}%`, duration: 0.6, ease: "power2.out", overwrite: "auto" });
  },[pos, now]);

  useEffect(()=>{
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${location.host}/magnum/api/radio/ws`;
    let ws: WebSocket;
    try{ ws = new WebSocket(url); wsRef.current = ws; }catch{ return; }
    ws.onmessage = (ev)=>{
      try{
        const data = JSON.parse(String(ev.data));
        if(data.type === "reaction" && data.reaction){
          const r = data.reaction as Reaction;
          setReactions(prev=> [...prev.slice(-49), r]);
          spawnFloat(r.emoji);
        }
        if(data.type === "init" && Array.isArray(data.reactions)){
          setReactions(data.reactions.slice(-50));
        }
        if(data.type === "listeners" && typeof data.listeners==="number" && now){
          setNow(prev=> prev ? { ...prev, listeners: data.listeners } : prev);
        }
      }catch{}
    };
    ws.onclose = ()=>{ setTimeout(()=>{ if(wsRef.current===ws) wsRef.current=null; },1500); };
    return ()=>{ try{ ws.close(); }catch{}; if(wsRef.current===ws) wsRef.current=null; };
  },[]);

  // spawn float emoji y -60 + scale 0→1.2→0 1.2s back.out
  const spawnFloat = useCallback((emoji: string)=>{
    if(!floatLayerRef.current) return;
    const el = document.createElement("div");
    el.textContent = emoji === "42" ? "42" : emoji;
    el.style.position = "absolute";
    el.style.left = `${18 + Math.random()*64}%`;
    el.style.bottom = "18%";
    el.style.fontSize = emoji==="42" ? "20px" : "26px";
    el.style.fontWeight = "800";
    el.style.color = emoji==="42" ? "#ff2d55" : "#fff";
    el.style.textShadow = "0 2px 12px rgba(0,0,0,0.6)";
    el.style.pointerEvents = "none";
    el.style.willChange = "transform, opacity";
    floatLayerRef.current.appendChild(el);
    if(prefersReduced()){
      gsap.set(el,{ y: -30, opacity: 1, scale: 1 });
      setTimeout(()=>{ try{ el.remove(); }catch{} },1200);
      return;
    }
    const ctx = gsap.context(()=>{
      gsap.set(el,{ y: 0, scale: 0, opacity: 0 });
      gsap.to(el,{
        y: -60,
        scale: 1.2,
        opacity: 1,
        duration: 0.35,
        ease: "back.out(1.4)",
        onComplete: ()=>{
          gsap.to(el,{
            y: -90,
            scale: 0,
            opacity: 0,
            duration: 0.85,
            ease: "power2.in",
            onComplete: ()=>{ try{ el.remove(); }catch{} }
          });
        }
      });
    }, el as unknown as HTMLElement);
    setTimeout(()=>{ try{ ctx.revert(); }catch{}; try{ el.remove(); }catch{} }, 1400);
  },[]);

  const handlePlay = async()=>{
    // require click to autoplay
    const el = activeA.current ? audioARef.current : audioBRef.current;
    const other = activeA.current ? audioBRef.current : audioARef.current;
    try{
      if(el){
        // silent mp3 data URI will play; we sync visual only
        el.currentTime = now ? now.position : 0;
        el.volume = 0.85;
        await el.play();
        setPlaying(true);
        setMsg("Эфир 42 — на связи");
        // pause other
        if(other) try{ other.pause(); }catch{}
      } else {
        setPlaying(true);
      }
    }catch(e){
      setMsg("Нажми ещё раз — браузер блочит автоплей");
    }
    // start heartbeat 30s
    if(heartbeatTimer.current) window.clearInterval(heartbeatTimer.current);
    heartbeatTimer.current = window.setInterval(()=>{ void sendHeartbeat(); }, 30000);
    void sendHeartbeat();
  };

  const handlePause = ()=>{
    const a = audioARef.current, b = audioBRef.current;
    try{ a?.pause(); }catch{}
    try{ b?.pause(); }catch{}
    setPlaying(false);
    if(heartbeatTimer.current) window.clearInterval(heartbeatTimer.current);
    heartbeatTimer.current=null;
    setMsg("Пауза — эфир ждёт");
  };

  const sendHeartbeat = async()=>{
    if(!me) return;
    try{
      const r = await fetch("/magnum/api/radio/heartbeat",{ method:"POST", credentials:"include", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ track_slug: now?.track.slug ?? "vpn" }) });
      const j = await r.json() as { ok?:boolean; listened_sec?:number; awarded?:number; balance?:number; streak?:number; nextRewardIn?:number; error?:string };
      if(typeof j.listened_sec==="number") listenedRef.current = j.listened_sec;
      if(typeof j.streak==="number") setHeartbeatInfo({ listened: j.listened_sec ?? 0, streak: j.streak, canClaim: !!j.awarded });
      if(typeof j.balance==="number") setBalance(j.balance);
      if(j.awarded) setMsg(`+${j.awarded} за 5 мин эфира!`);
    }catch{}
  };

  const sendReaction = async(emoji: RadioEmoji)=>{
    if(!me){ setMsg("Войди чтобы кидать реакции"); return; }
    spawnFloat(emoji);
    try{
      const r = await fetch("/magnum/api/radio/reaction",{ method:"POST", credentials:"include", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ emoji, track_slug: now?.track.slug }) });
      const j = await r.json() as { ok?:boolean; error?:string };
      if(!r.ok) setMsg(j.error ?? "Троттл 3/сек — помедленнее");
      else setMsg("");
    }catch{}
    // also via WS if available for instant
    try{ wsRef.current?.send(JSON.stringify({ type:"reaction", emoji })); }catch{}
  };

  const handleShare = async()=>{
    if(!me){ setShareMsg("Войди чтобы шарить"); return; }
    try{
      const r = await fetch("/magnum/api/radio/share",{ method:"POST", credentials:"include" });
      const j = await r.json() as { ok?:boolean; reward?:number; balance?:number; error?:string; waitH?:string };
      if(j.ok){
        setShareMsg(`+${j.reward} за шаринг!`);
        if(typeof j.balance==="number") setBalance(j.balance);
        // canvas OG 1080
        if(canvasRef.current && now){
          const c = canvasRef.current;
          c.width=1080; c.height=1080;
          const ctx=c.getContext("2d")!;
          ctx.fillStyle="#0a0a0f"; ctx.fillRect(0,0,1080,1080);
          ctx.fillStyle=now.track.color; ctx.fillRect(0,0,1080,18);
          ctx.fillStyle="#fff"; ctx.font="800 72px system-ui"; ctx.fillText("РАДИО 42",80,140);
          ctx.font="600 38px system-ui"; ctx.fillStyle="#ff2d55"; ctx.fillText(now.track.title+" — ЭФИР 24/7",80,210);
          ctx.fillStyle="#aaa"; ctx.font="28px system-ui"; ctx.fillText("magnum 5opka.ru/magnum/radio",80,1010);
          // fake cover block
          ctx.fillStyle="#1a1a2e"; ctx.fillRect(80,260,920,520);
          ctx.fillStyle="#fff"; ctx.font="800 64px system-ui"; ctx.fillText(now.track.title, 120, 560);
          ctx.font="30px system-ui"; ctx.fillStyle="#ccc"; ctx.fillText(now.track.subtitle, 120, 610);
        }
      } else setShareMsg(j.error ?? "Уже шарил сегодня");
    }catch{ setShareMsg("Ошибка шаринга"); }
  };

  const handleDonate = async()=>{
    try{
      const r = await fetch("/magnum/api/radio/request",{ method:"POST", credentials:"include", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ track_slug: now?.track.slug }) });
      const j = await r.json() as { ok?:boolean; balance?:number; queuePos?:number; error?:string };
      if(j.ok){ setDonateMsg(`Заказ принят #${j.queuePos} — 142 снято`); if(typeof j.balance==="number") setBalance(j.balance); }
      else setDonateMsg(j.error ?? "Нужно 142 монет");
    }catch{ setDonateMsg("Ошибка доната"); }
  };

  // OG canvas ref
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const track = now?.track ?? RADIO_TRACKS[0]!;

  return (
    <div ref={wrapRef} style={{ maxWidth: 980, margin:"0 auto", padding:"20px 14px 40px" }}>
      <h1 style={{ fontSize:32, fontWeight:900, margin:"8px 0 6px", color:"#ff2d55" }}>РАДИО 42 — эфир MAGNUM 24/7</h1>
      <p style={{ color:"#aaa", margin:"0 0 16px" }}>Нон-стоп 5 треков MAGNUM в loop. Жми реакции, копи +42 за 5 мин.</p>

      {/* player card */}
      <div style={{ background:"linear-gradient(135deg,#0f0f14,#1a1a2e)", border:"1px solid #2a2a3a", borderRadius:18, padding:16, display:"grid", gridTemplateColumns:"1fr", gap:14, position:"relative", overflow:"hidden" }}>
        <div style={{ display:"flex", gap:14, alignItems:"center", flexWrap:"wrap" }}>
          <div ref={coverRef} style={{ width:128, height:128, borderRadius:16, overflow:"hidden", flex:"0 0 128px", background:"#0a0a0f", border:`3px solid ${track.color}`, position:"relative" }}>
            <img src={track.cover} alt={track.title} style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e=>{ (e.target as HTMLImageElement).style.display="none"; }} />
            <div style={{ position:"absolute", inset:0, background:`linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.55))` }} />
            <div style={{ position:"absolute", bottom:6, left:8, color:"#fff", fontWeight:800, fontSize:13, textShadow:"0 1px 6px rgba(0,0,0,0.8)" }}>{track.title}</div>
            {/* float layer */}
            <div ref={floatLayerRef} style={{ position:"absolute", inset:0, pointerEvents:"none" }} />
          </div>

          <div style={{ flex:"1 1 220px", minWidth:200 }}>
            <div style={{ fontWeight:900, fontSize:22, color:"#fff", lineHeight:1 }}>{track.title} <span style={{ fontWeight:400, color:"#aaa", fontSize:14 }}>{track.subtitle}</span></div>
            <div style={{ marginTop:8, display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
              {!playing ? (
                <button onClick={handlePlay} style={{ background:"#ff2d55", color:"#fff", border:0, borderRadius:999, padding:"10px 18px", fontWeight:900, cursor:"pointer" }}>▶︎ PLAY эфир</button>
              ) : (
                <button onClick={handlePause} style={{ background:"#222", color:"#fff", border:"1px solid #333", borderRadius:999, padding:"10px 18px", fontWeight:800, cursor:"pointer" }}>⏸ Пауза</button>
              )}
              <span ref={listenersRef} style={{ background:"#111", color:"#ffcc00", border:"1px solid #333", borderRadius:999, padding:"6px 12px", fontWeight:800, fontSize:13, display:"inline-flex", gap:6, alignItems:"center" }}>
                ● <span>{now?.listeners ?? 42}</span> на связи
              </span>
            </div>
            {/* progress */}
            <div style={{ marginTop:12, height:8, background:"#0a0a0f", borderRadius:999, overflow:"hidden", border:"1px solid #222" }}>
              <div ref={progressRef} style={{ height:"100%", width:"0%", background:`linear-gradient(90deg,${track.color},#ff2d55)` }} />
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", color:"#888", fontSize:12, marginTop:4 }}>
              <span>{formatTime(pos)}</span>
              <span>{formatTime(track.durationSec)}</span>
            </div>
          </div>
        </div>

        {/* visualizer 32 bars */}
        <div ref={barsRef} style={{ display:"flex", gap:3, alignItems:"end", height:54, background:"#080810", borderRadius:12, padding:"8px 10px", border:"1px solid #1e1e2e" }}>
          {Array.from({ length: 32 }).map((_,i)=>(
            <div key={i} data-bar style={{ flex:1, height:40, background: i%3===0 ? track.color : i%2===0 ? "#ff2d55" : "#5865f2", borderRadius:3, transformOrigin:"bottom center", transform:"scaleY(0.35)" }} />
          ))}
        </div>

        {}
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          {(RADIO_REACTION_EMOJIS as unknown as string[]).map(em=>(
            <button key={em} onClick={()=> sendReaction(em as RadioEmoji)} style={{ fontSize:22, padding:"8px 14px", borderRadius:12, border:"1px solid #2a2a3a", background:"#111", cursor:"pointer" }}>{em==="42" ? "42" : em}</button>
          ))}
          <span style={{ color:"#777", fontSize:12 }}>{msg}</span>
        </div>

        {/* hidden audio elements for crossfade — silent mp3 data URI 0.2s loop */}
        <audio ref={audioARef} loop preload="auto" crossOrigin="anonymous" src="data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAASQAAEAgAAABgAAABJxR1xcGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhob//uQZGBkYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgQ==" />
        <audio ref={audioBRef} loop preload="auto" crossOrigin="anonymous" src="data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAASQAAEAgAAABgAAABJxR1xcGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhob//uQZGBkYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgQ==" />

        {/* playlist loop 5 */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))", gap:8 }}>
          {RADIO_TRACKS.map(t=>(
            <div key={t.slug} style={{ padding:"8px 10px", borderRadius:12, background: now?.track.slug===t.slug ? "rgba(255,45,85,0.14)" : "#0f0f14", border: now?.track.slug===t.slug ? "1px solid #ff2d55" : "1px solid #222", color: now?.track.slug===t.slug ? "#fff" : "#aaa", fontSize:12 }}>
              <div style={{ fontWeight:800, color: now?.track.slug===t.slug ? "#fff" : "#ccc" }}>{t.title}</div>
              <div style={{ fontSize:11 }}>{t.subtitle} · {formatTime(t.durationSec)}</div>
            </div>
          ))}
        </div>

        <div style={{ color:"#666", fontSize:11 }}>Кроссфейд 2с · синхронизация от позиции сервера · автоплей после клика</div>
      </div>

      {/* лента реакций */}
      <div style={{ marginTop:14, background:"#0f0f14", border:"1px solid #222", borderRadius:14, padding:12 }}>
        <div style={{ fontWeight:800, color:"#fff", marginBottom:8 }}>Лента реакций live · последние 50</div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", minHeight:24 }}>
          {reactions.length===0 ? <span style={{ color:"#666", fontSize:12 }}>Пока тихо — кинь 🔥 первым!</span> : reactions.slice(-20).map(r=>(
            <span key={r.id} style={{ background:"#1a1a2e", border:"1px solid #2a2a3a", borderRadius:999, padding:"4px 8px", fontSize:12, color:"#fff" }}>{r.emoji} <span style={{ color:"#aaa" }}>{r.username}</span></span>
          ))}
        </div>
      </div>

      {/* прослушивание */}
      <div style={{ marginTop:14, background:"#0f0f14", border:"1px solid #222", borderRadius:14, padding:14 }}>
        <div style={{ fontWeight:800, color:"#fff" }}>Прослушивание · +42 за 5 мин</div>
        <div style={{ color:"#aaa", fontSize:13, marginTop:4 }}>
          Heartbeat 30с · кулдаун 1ч · стрик 7д +420 · шаринг OG 1080×1080 +42/день · донат 142 — заказ трека (stub)
        </div>
        <div style={{ marginTop:10, display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          <span style={{ background:"#111", border:"1px solid #2a2a3a", borderRadius:999, padding:"6px 10px", color:"#ffcc00", fontSize:12 }}>⏱ {Math.floor((heartbeatInfo?.listened ?? 0)/60)} мин · стрик {heartbeatInfo?.streak ?? 0}/7</span>
          {balance!==null && <span style={{ background:"#111", border:"1px solid #2a2a3a", borderRadius:999, padding:"6px 10px", color:"#fff", fontSize:12 }}>Баланс {balance}</span>}
          <button onClick={handleShare} style={{ background:"#5865f2", color:"#fff", border:0, borderRadius:999, padding:"8px 14px", fontWeight:800, cursor:"pointer" }}>Шарить OG +42</button>
          <button onClick={handleDonate} style={{ background:"#ff2d55", color:"#fff", border:0, borderRadius:999, padding:"8px 14px", fontWeight:800, cursor:"pointer" }}>Заказать трек 142</button>
        </div>
        {(shareMsg || donateMsg) && <div style={{ marginTop:8, color:"#ffcc00", fontSize:12 }}>{shareMsg} {donateMsg}</div>}
        <canvas ref={canvasRef} width={1080} height={1080} style={{ display: shareMsg ? "block" : "none", width:180, height:180, marginTop:10, borderRadius:12, border:"1px solid #222" }} />
        {!me && <div style={{ marginTop:8, color:"#777", fontSize:12 }}>Войди чтобы получать +42 за прослушивание</div>}
      </div>
    </div>
  );
}
