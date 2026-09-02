import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { STUDIO_TRACKS, STUDIO_PRESETS, STUDIO_SCENE_DEFAULTS, STUDIO_BG_OPTIONS, STUDIO_FILTER_OPTIONS, isStudioTrackSlug, isStudioPresetId, getBpmForTrack, validateScenes, type StudioTrackSlug, type StudioPresetId, type StudioScene } from "../lib/studio42";
import { GuestGate } from "../components/GuestGate";
import { CosmeticIdentity, type LeaderCosmetics } from "../components/CosmeticBadge";

const TRACKS = STUDIO_TRACKS;
const PRESETS = STUDIO_PRESETS;

export function Studio42Page() {
  const [track, setTrack] = useState<StudioTrackSlug>("clay");
  const [preset, setPreset] = useState<StudioPresetId>("meduza-wave");
  const [visualizing, setVisualizing] = useState(false);
  const [scenes, setScenes] = useState<StudioScene[]>(() => [...STUDIO_SCENE_DEFAULTS]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [saves, setSaves] = useState<Array<{id:number; username:string; trackSlug:string; preset:string; scenes:StudioScene[]; likes:number}>>([]);
  const [leaderboard, setLeaderboard] = useState<Array<{id:number; username:string; likes:number; trackSlug:string; avatar?:string|null} & LeaderCosmetics>>([]);
  const [shareMsg, setShareMsg] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [likesAnim, setLikesAnim] = useState<Record<number, boolean>>({});

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animRef = useRef<number>(0);
  const barsRef = useRef<HTMLDivElement>(null);

  const bpm = getBpmForTrack(track);
  const presetObj = PRESETS.find(p=>p.id===preset) ?? PRESETS[0]!;

  // fetch saves + leaderboard
  useEffect(()=>{
    fetch("/magnum/api/studio/list",{credentials:"include"}).then(r=>r.ok?r.json():null).then(j=>{
      if(j?.saves) setSaves(j.saves.slice(0,20));
    }).catch(()=>{});
    fetch("/magnum/api/studio/leaderboard",{credentials:"include"}).then(r=>r.ok?r.json():null).then(j=>{
      if(j?.leaderboard) setLeaderboard(j.leaderboard);
      else if(j?.top) setLeaderboard(j.top);
    }).catch(()=>{});
  },[]);

  useEffect(()=>{
    if(!previewRef.current) return;
    const cards = previewRef.current.querySelectorAll("[data-scene]");
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) { gsap.set(cards,{y:0, opacity:1}); return; }
    gsap.set(cards,{y:16, opacity:0});
    gsap.to(cards,{y:0, opacity:1, duration:0.3, stagger:0.08, ease:"power1.out", overwrite:true});
  },[scenes]);

  // preview morph 0.4s power2 on preset/track change
  useEffect(()=>{
    if(!previewRef.current) return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.to(previewRef.current,{ scale:0.98, duration:0.2, ease:"power2.out", yoyo:true, repeat:1 });
  },[preset, track]);

  const startVisualizer = useCallback(async ()=>{
    setVisualizing(true);
    try{
      const ctx = new (window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext)();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyserRef.current = analyser;
      // oscillator source per BPM (no file needed — synthetic)
      const osc = ctx.createOscillator();
      osc.type="sawtooth";
      osc.frequency.value = 110 + (bpm/142)*80;
      const gain = ctx.createGain(); gain.gain.value=0.0;
      osc.connect(gain); gain.connect(analyser);
      // analyser to destination via zero gain (no audible output but needed)
      const silent = ctx.createGain(); silent.gain.value=0; analyser.connect(silent); silent.connect(ctx.destination);
      osc.start();
      // also try to keep alive 30s then stop
      setTimeout(()=>{ try{osc.stop();}catch{} }, 30000);
    }catch{
      // fallback: no WebAudio — will use synthetic data
    }
    // canvas loop
    const canvas = canvasRef.current;
    if(!canvas) return;
    const c = canvas.getContext("2d");
    if(!c) return;
    const bars = 64;
    const data = new Uint8Array(bars);
    const particles: Array<{x:number;y:number;vx:number;vy:number;life:number}> = Array.from({length:22},()=>({x:Math.random()*canvas.width,y:Math.random()*canvas.height,vx:(Math.random()-0.5)*1.2,vy:(Math.random()-0.5)*1.2,life:Math.random()}));
    let lastBeat = performance.now();
    const beatMs = 60000/bpm;
    const draw = ()=>{
      animRef.current = requestAnimationFrame(draw);
      // analyser data or synthetic
      if(analyserRef.current){
        try{ (analyserRef.current as unknown as { getByteFrequencyData: (a: Uint8Array) => void }).getByteFrequencyData(data as unknown as Uint8Array); }catch{}
        if(data[0]===0) {
          for(let i=0;i<bars;i++) data[i]= 40 + Math.abs(Math.sin(Date.now()/ (beatMs/Math.PI) + i*0.4))* 140 + Math.random()*30;
        }
      } else {
        for(let i=0;i<bars;i++) data[i]= 40 + Math.abs(Math.sin(Date.now()/ (beatMs/Math.PI) + i*0.4))* 140 + Math.random()*30;
      }
      const w=canvas.width, h=canvas.height;
      c.clearRect(0,0,w,h);
      // bg per preset
      c.fillStyle = presetObj.id==="meduza-wave" ? "#0a1a2a" : presetObj.id==="neon-kuzbass" ? "#1a0a00" : "#0f0a14";
      c.fillRect(0,0,w,h);
      // beat pulse
      const now=performance.now();
      const beatPhase = ((now-lastBeat)%beatMs)/beatMs;
      if(now-lastBeat>beatMs) lastBeat=now;
      const pulse = 1 + Math.sin(beatPhase*Math.PI*2)*0.06;
      // bars
      const barW = w/bars;
      for(let i=0;i<bars;i++){
        const v = data[i] ?? 60;
        const bh = (v/255)*h*0.62*pulse;
        const x = i*barW;
        c.fillStyle = presetObj.barColor + (presetObj.id==="glitch-42" && i%3===0 ? "" : "");
        if(presetObj.id==="glitch-42" && Math.random()<0.04) c.fillStyle = "#fff";
        c.fillRect(x, h-bh, barW-1, bh);
      }
      // particles
      for(const p of particles){
        p.x+=p.vx; p.y+=p.vy;
        if(p.x<0||p.x>w) p.vx*=-1;
        if(p.y<0||p.y>h) p.vy*=-1;
        c.globalAlpha=0.55;
        c.fillStyle=presetObj.particleColor;
        c.beginPath(); c.arc(p.x,p.y, 1.8 + Math.sin(now*0.003 + p.life*10)*1.2,0,Math.PI*2); c.fill();
        c.globalAlpha=1;
      }
      // overlay text
      c.fillStyle="rgba(255,255,255,0.92)";
      c.font="900 18px Inter,system-ui";
      c.textAlign="center";
      c.fillText(`${track.toUpperCase()} • ${bpm} BPM • ${presetObj.name}`, w/2, 24);
      if(barsRef.current && now%120 < 22){
        const domBars = barsRef.current.querySelectorAll<HTMLElement>("[data-bar]");
        domBars.forEach((el,idx)=>{
          const v=(data[idx % bars] ?? 90)/255;
          if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) { el.style.transform=`scaleY(${0.2+v*0.8})`; return; }
          gsap.to(el,{ scaleY: 0.2+v*0.8, duration:0.15, ease:"power1.out", overwrite:true });
        });
      }
    };
    draw();
  },[bpm, presetObj, track]);

  const stopVisualizer = useCallback(()=>{
    setVisualizing(false);
    if(animRef.current) cancelAnimationFrame(animRef.current);
    try{ audioCtxRef.current?.close(); }catch{}
    audioCtxRef.current=null; analyserRef.current=null;
  },[]);

  useEffect(()=>()=>{ if(animRef.current) cancelAnimationFrame(animRef.current); try{audioCtxRef.current?.close();}catch{} },[]);

  // drag reorder 4 scenes
  const onDragStart = (i:number)=> setDragIdx(i);
  const onDragOver = (e:React.DragEvent, over:number)=>{
    e.preventDefault();
    if(dragIdx===null || dragIdx===over) return;
  };
  const onDrop = (e:React.DragEvent, dropIdx:number)=>{
    e.preventDefault();
    if(dragIdx===null) return;
    const next=[...scenes];
    const [moved]=next.splice(dragIdx,1);
    if(!moved) return;
    next.splice(dropIdx,0,moved);
    setScenes(next); setDragIdx(null);
  };

  const updateScene = (idx:number, patch:Partial<StudioScene>)=>{
    setScenes(s=> s.map((sc,i)=> i===idx ? {...sc, ...patch}: sc));
  };

  const handleSave = async()=>{
    setSaveMsg("");
    const r=await fetch("/magnum/api/studio/save",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({trackSlug:track, preset, scenes})});
    const j=await r.json().catch(()=>({}));
    if(r.status===201){ setSaveMsg("Сохранено ✓"); setSaves(prev=>[{id:j.save.id, username:"ты", trackSlug:track, preset, scenes, likes:0}, ...prev].slice(0,20)); }
    else setSaveMsg(j.error || `Ошибка ${r.status}`);
  };

  const handleLike = async(id:number)=>{
    const r=await fetch("/magnum/api/studio/like",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({saveId:id})});
    const j=await r.json().catch(()=>({}));
    if(r.ok){
      setSaves(prev=> prev.map(s=> s.id===id ? {...s, likes:j.likes}:s));
      setLikesAnim(a=>({...a,[id]:true})); setTimeout(()=> setLikesAnim(a=>({...a,[id]:false})),380);
      // burst scale 1.4 back.out 0.35s + heart particles 20
      const el=document.querySelector(`[data-like="${id}"]`);
      if(el && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
        gsap.to(el,{scale:1.4, duration:0.35, ease:"back.out(1.7)", yoyo:true, repeat:1 });
        // heart particles 20
        const wrap=el.parentElement as HTMLElement | null;
        if(wrap){
          for(let i=0;i<20;i++){
            const h=document.createElement("span");
            h.textContent="❤️";
            Object.assign(h.style,{position:"absolute",left:"50%",top:"50%",fontSize:"10px",pointerEvents:"none",zIndex:"5"});
            wrap.style.position="relative";
            wrap.appendChild(h);
            const ang=Math.random()*Math.PI*2, dist= 18+Math.random()*34;
            gsap.to(h,{x:Math.cos(ang)*dist, y:Math.sin(ang)*dist -10, opacity:0, scale:0.2, duration:0.6+Math.random()*0.3, ease:"power1.out", onComplete:()=> h.remove()});
          }
        }
      }
    } else setSaveMsg(j.error||"лайк: ошибка");
  };

  const handleExport = async()=>{
    setShareMsg("");
    const c=exportRef.current;
    if(!c){ setShareMsg("canvas не готов"); return; }
    const ctx=c.getContext("2d"); if(!ctx){ setShareMsg("ctx error"); return; }
    c.width=1080; c.height=1080;
    // composite 1080: pick first scene bg + overlay all 4 texts?
    const bg = scenes[0]?.bg || "linear-gradient(135deg,#ff2d55,#ffcc00)";
    // draw bg gradient approx: sample linear
    // simple fill per scene stacked quarter
    ctx.fillStyle="#0a0a0a"; ctx.fillRect(0,0,1080,1080);
    // 4 scenes vertical stack
    scenes.forEach((s,i)=>{
      const y=i*270;
      // bg color approximation: extract first hex
      const m=s.bg.match(/#[0-9a-fA-F]{3,6}/);
      ctx.fillStyle= m?.[0] ?? "#ff2d55";
      if(s.filter!=="none") ctx.filter=s.filter;
      else ctx.filter="none";
      ctx.fillRect(0,y,1080,270);
      ctx.filter="none";
      ctx.fillStyle="rgba(255,255,255,0.96)";
      ctx.font="900 42px Inter,system-ui";
      ctx.textAlign="center";
      ctx.fillText(s.text.slice(0,28),540,y+150);
    });
    // footer
    ctx.fillStyle="rgba(255,255,255,0.9)";
    ctx.font="700 28px Inter,system-ui";
    ctx.fillText(`${track.toUpperCase()} • ${bpm} BPM • ${presetObj.name} • MAGNUM 42`,540,1060-18);
    // Web Share API
    try{
      const dataUrl=c.toDataURL("image/png");
      // fetch -> blob for share
      const res=await fetch(dataUrl); const blob=await res.blob();
      const file=new File([blob],"magnum-1080.png",{type:"image/png"});
      if(navigator.canShare && navigator.canShare({files:[file]})){
        await navigator.share({title:"MAGNUM Studio 42", text:`Мой клип ${track} — ${preset} • 42 братухи`, files:[file]});
      } else if(navigator.share){
        await navigator.share({title:"MAGNUM Studio 42", text:`Мой клип ${track} — ${preset} • 42 братухи`, url: location.href});
      } else {
        const a=document.createElement("a"); a.href=dataUrl; a.download="magnum-studio-1080.png"; a.click();
      }
    }catch{
      // fallback download
      const dataUrl=c.toDataURL("image/png");
      const a=document.createElement("a"); a.href=dataUrl; a.download="magnum-studio-1080.png"; a.click();
    }
    // +42 coins guard
    try{
      const r=await fetch("/magnum/api/studio/share",{method:"POST",credentials:"include"});
      const j=await r.json().catch(()=>({}));
      if(r.ok) setShareMsg(`+42 монеты! День ${j.dayId}`);
      else if(r.status===409) setShareMsg("Уже получал +42 сегодня");
      else setShareMsg(j.error||"");
    }catch{ /* ignore */ }
  };

  return (
    <div style={{maxWidth:1120, margin:"0 auto", padding:"1.2rem 1rem 2rem"}}>
      <GuestGate action="публиковать работы и собирать лайки" />
      <div style={{display:"flex", flexWrap:"wrap", gap:"0.75rem", alignItems:"center", marginBottom:"0.9rem"}}>
        <span style={{fontSize:"0.72rem", fontWeight:800, letterSpacing:"0.08em", color:"#ff2d55", border:"1px solid rgba(255,45,85,0.3)", padding:"0.2rem 0.5rem", borderRadius:999}}>СТУДИЯ 42</span>
        <h1 style={{margin:0, fontSize:"1.6rem", fontWeight:900, letterSpacing:"-0.02em"}}>Нейро-визуализатор + клип-конструктор</h1>
      </div>
      <p style={{color:"rgba(255,255,255,0.6)", fontSize:"0.88rem", margin:"0 0 1rem"}}>Выбери трек MAGNUM, жми Визуализировать — canvas-шоу с волнами/частицами под BPM. Собери клип из 4 сцен, экспорт 1080×1080 + Web Share.</p>

      {/* track + preset */}
      <div style={{display:"flex", flexWrap:"wrap", gap:"0.6rem", marginBottom:"0.8rem"}}>
        {TRACKS.map(t=>(
          <button key={t.slug} onClick={()=> setTrack(t.slug)} style={{padding:"0.55rem 0.85rem", borderRadius:999, border: track===t.slug?`2px solid ${t.color}`:"1px solid rgba(255,255,255,0.14)", background: track===t.slug? `${t.color}18`:"rgba(255,255,255,0.06)", color:"#fff", fontWeight:800, cursor:"pointer"}}>
            {t.title} <span style={{fontWeight:600, opacity:0.7, fontSize:"0.78rem"}}>{t.bpm} BPM</span>
          </button>
        ))}
      </div>
      <div style={{display:"flex", flexWrap:"wrap", gap:"0.5rem", marginBottom:"1rem"}}>
        {PRESETS.map(p=>(
          <button key={p.id} onClick={()=> setPreset(p.id)} style={{padding:"0.45rem 0.75rem", borderRadius:999, border: preset===p.id?"1px solid #fff":"1px solid rgba(255,255,255,0.12)", background: preset===p.id?"#fff":"rgba(255,255,255,0.06)", color: preset===p.id?"#0a0a0a":"#fff", fontWeight:700, fontSize:"0.82rem", cursor:"pointer"}}>{p.name}</button>
        ))}
        <button onClick={visualizing? stopVisualizer : startVisualizer} style={{marginLeft:"0.4rem", padding:"0.55rem 1rem", borderRadius:999, background: visualizing?"#ff2d55":"#00ff88", color: visualizing?"#fff":"#0a0a0a", fontWeight:900, border:"none", cursor:"pointer"}}>
          {visualizing ? "Стоп" : "Визуализировать"}
        </button>
      </div>

      {/* canvas */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 360px", gap:"1rem", alignItems:"start"}}>
        <div>
          <canvas ref={canvasRef} width={720} height={360} style={{width:"100%", aspectRatio:"2/1", background: presetObj.bg, borderRadius:16, border:"1px solid rgba(255,255,255,0.08)", display:"block"}} />
          {}
          <div ref={barsRef} style={{display:"flex", gap:1, height:28, marginTop:6, alignItems:"end", opacity:0.9}}>
            {Array.from({length:64}).map((_,i)=>(
              <div key={i} data-bar="" style={{flex:1, height:20, background: presetObj.barColor, borderRadius:2, transformOrigin:"bottom", transform:"scaleY(0.3)"}} />
            ))}
          </div>
          <div style={{marginTop:"0.8rem", display:"flex", gap:"0.5rem", flexWrap:"wrap"}}>
            <button onClick={handleSave} style={{padding:"0.6rem 1rem", borderRadius:999, background:"#fff", color:"#0a0a0a", fontWeight:800, border:"none", cursor:"pointer"}}>Сохранить пресет (0 монет)</button>
            <button onClick={handleExport} style={{padding:"0.6rem 1rem", borderRadius:999, background:"linear-gradient(90deg,#ff2d55,#ffcc00)", color:"#fff", fontWeight:800, border:"none", cursor:"pointer"}}>Экспорт 1080×1080 + Share +42</button>
            {saveMsg && <span style={{alignSelf:"center", color:"#00ff88", fontSize:"0.82rem"}}>{saveMsg}</span>}
            {shareMsg && <span style={{alignSelf:"center", color:"#ffcc00", fontSize:"0.82rem"}}>{shareMsg}</span>}
          </div>
          <canvas ref={exportRef} width={1080} height={1080} style={{display:"none"}} />
        </div>

        {/* clips constructor */}
        <div>
          <h3 style={{margin:"0 0 0.5rem", fontSize:"0.95rem", fontWeight:900}}>Конструктор клипа — 4 сцены (drag перестановка)</h3>
          <div ref={previewRef} style={{display:"flex", flexDirection:"column", gap:"0.5rem"}}>
            {scenes.map((s,idx)=>(
              <div key={idx} data-scene="" draggable onDragStart={()=> onDragStart(idx)} onDragOver={(e)=> onDragOver(e,idx)} onDrop={(e)=> onDrop(e,idx)} style={{padding:"0.6rem", borderRadius:12, background:s.bg, border:"1px solid rgba(255,255,255,0.14)", cursor:"grab", filter:s.filter==="none"?undefined:s.filter, opacity: dragIdx===idx?0.5:1}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:"0.5rem"}}>
                  <strong style={{color:"#fff", textShadow:"0 1px 8px rgba(0,0,0,0.6)", fontSize:"0.85rem"}}>{idx+1}. {s.text}</strong>
                  <span style={{fontSize:"0.68rem", opacity:0.7, background:"rgba(0,0,0,0.35)", color:"#fff", padding:"0.15rem 0.4rem", borderRadius:999}}>drag</span>
                </div>
                <input value={s.text} onChange={e=> updateScene(idx,{text:e.target.value})} placeholder="текст оверлея" style={{marginTop:"0.4rem", width:"100%", padding:"0.35rem 0.5rem", borderRadius:8, border:"1px solid rgba(255,255,255,0.14)", background:"rgba(0,0,0,0.35)", color:"#fff", fontSize:"0.82rem"}} />
                <div style={{display:"flex", gap:"0.3rem", marginTop:"0.4rem", flexWrap:"wrap"}}>
                  {STUDIO_BG_OPTIONS.slice(0,6).map(bg=>(
                    <button key={bg} onClick={()=> updateScene(idx,{bg})} style={{width:22, height:22, borderRadius:6, background:bg, border: s.bg===bg?"2px solid #fff":"1px solid rgba(255,255,255,0.2)", cursor:"pointer"}} title={bg} />
                  ))}
                </div>
                <select value={s.filter} onChange={e=> updateScene(idx,{filter:e.target.value})} style={{marginTop:"0.35rem", width:"100%", padding:"0.3rem", borderRadius:8, background:"rgba(0,0,0,0.5)", color:"#fff", border:"1px solid rgba(255,255,255,0.14)", fontSize:"0.78rem"}}>
                  {STUDIO_FILTER_OPTIONS.map(f=> <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div style={{marginTop:"0.7rem", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem"}}>
            <div style={{aspectRatio:"9/16", borderRadius:12, overflow:"hidden", border:"1px solid rgba(255,255,255,0.1)", background:"#0a0a0a", display:"grid", placeItems:"center", padding:"0.5rem"}}>
              <div style={{width:"100%", height:"100%", display:"flex", flexDirection:"column", gap:4}}>
                {scenes.map((s,i)=> <div key={i} style={{flex:1, background:s.bg, display:"grid", placeItems:"center", color:"#fff", fontWeight:800, fontSize:"0.7rem", filter:s.filter==="none"?undefined:s.filter}}>{s.text.slice(0,14)}</div>)}
              </div>
              <span style={{fontSize:"0.65rem", color:"rgba(255,255,255,0.5)", marginTop:4}}>9:16 превью</span>
            </div>
            <div style={{aspectRatio:"1/1", borderRadius:12, overflow:"hidden", border:"1px solid rgba(255,255,255,0.1)", background:"#0a0a0a", display:"grid", placeItems:"center", padding:"0.5rem"}}>
              <div style={{width:"100%", height:"100%", display:"grid", gridTemplateColumns:"1fr 1fr", gap:4}}>
                {scenes.map((s,i)=> <div key={i} style={{background:s.bg, display:"grid", placeItems:"center", color:"#fff", fontWeight:800, fontSize:"0.62rem", filter:s.filter==="none"?undefined:s.filter, textAlign:"center", padding:4}}>{s.text.slice(0,12)}</div>)}
              </div>
              <span style={{fontSize:"0.65rem", color:"rgba(255,255,255,0.5)", marginTop:4}}>1:1 превью 1080</span>
            </div>
          </div>
        </div>
      </div>

      {/* saves + leaderboard */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem", marginTop:"1.2rem"}}>
        <div>
          <h3 style={{fontSize:"0.95rem", fontWeight:900}}>Последние сейвы</h3>
          <div style={{display:"flex", flexDirection:"column", gap:"0.4rem", marginTop:"0.4rem"}}>
            {saves.length===0 ? <span style={{color:"rgba(255,255,255,0.45)", fontSize:"0.82rem"}}>Пока пусто — стань первым</span> : saves.map(s=>(
              <div key={s.id} style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0.5rem 0.6rem", borderRadius:10, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.06)"}}>
                <span style={{fontSize:"0.82rem"}}><strong>{s.username}</strong> • {s.trackSlug} • {s.preset} • ❤️ {s.likes}</span>
                <button data-like={s.id} onClick={()=> handleLike(s.id)} style={{padding:"0.3rem 0.6rem", borderRadius:999, background: likesAnim[s.id]?"#ff2d55":"rgba(255,255,255,0.1)", color:"#fff", border:"none", cursor:"pointer", transform: likesAnim[s.id]?"scale(1.05)":"scale(1)", transition:"transform 0.15s"}}>Лайк</button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 style={{fontSize:"0.95rem", fontWeight:900}}>Топ недели (лайки) +142/420/1420</h3>
          <div style={{display:"flex", flexDirection:"column", gap:"0.4rem", marginTop:"0.4rem"}}>
            {leaderboard.length===0 ? <span style={{color:"rgba(255,255,255,0.45)", fontSize:"0.82rem"}}>Неделя пустая</span> : leaderboard.slice(0,10).map((r,i)=>(
              <div key={r.id} style={{display:"flex", justifyContent:"space-between", padding:"0.45rem 0.6rem", borderRadius:10, background: i===0?"rgba(255,204,0,0.12)":i===1?"rgba(255,255,255,0.08)":i===2?"rgba(255,120,0,0.10)":"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.06)"}}>
                <span style={{fontSize:"0.82rem", display:"inline-flex", alignItems:"center", gap:6, minWidth:0}}>#{i+1} <CosmeticIdentity username={r.username} avatar={r.avatar} frame={r.frame} title={r.title} size={22} /> • {r.likes} ❤️</span>
                <span style={{fontSize:"0.72rem", color:"#ffcc00", fontWeight:800}}>{i===0?"+1420":i===1?"+420":i===2?"+142":""}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
export default Studio42Page;
