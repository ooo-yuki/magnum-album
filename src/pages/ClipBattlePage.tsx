import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { Casino42 } from "../components/Casino42";
import { CLIP_TRACKS, CLIP_TRACK_LABELS, CLIP_MAX_SECONDS, type ClipTrack } from "../lib/clip42";

type Clip = { id:number; userId:number; username:string; trackSlug:string; mediaUrl:string; likes:number; created_at:string };
type Battle = { id:number; clipAId:number; clipBId:number; votesA:number; votesB:number; endsAt:string; winnerId:number|null; clipA?:Clip; clipB?:Clip };

export function ClipBattlePage(){
  const wrapRef=useRef<HTMLDivElement>(null);
  const feedRef=useRef<HTMLDivElement>(null);
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const [clips,setClips]=useState<Clip[]>([]);
  const [battles,setBattles]=useState<Battle[]>([]);
  const [track,setTrack]=useState<string>("all");
  const [page,setPage]=useState(1);
  const [total,setTotal]=useState(0);
  const [msg,setMsg]=useState("");
  const [uploadTrack,setUploadTrack]=useState<ClipTrack>("clay");
  const [previewUrl,setPreviewUrl]=useState<string|null>(null);
  const [fileB64,setFileB64]=useState<string|null>(null);
  const [uploading,setUploading]=useState(false);
  const [me,setMe]=useState<{id:number;username:string}|null>(null);
  const [wsLive,setWsLive]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{
    fetch("/magnum/api/auth/me",{credentials:"include"}).then(r=>r.ok?r.json():null).then(j=> setMe(j?.user??null)).catch(()=>{});
  },[]);

  const load=useCallback(async()=>{
    try{
      const p=new URLSearchParams({ page:String(page), ...(track!=="all"?{track}:{})});
      const r=await fetch(`/magnum/api/clip/feed?${p}`,{credentials:"include"});
      const j=await r.json() as {clips?:Clip[]; battles?:Battle[]; total?:number};
      if(Array.isArray(j.clips)) setClips(j.clips);
      if(Array.isArray(j.battles)) setBattles(j.battles);
      if(typeof j.total==="number") setTotal(j.total);
    }catch{}
  },[track,page]);

  const loadBattles=useCallback(async()=>{
    try{
      const r=await fetch("/magnum/api/clip/battles",{credentials:"include"});
      const j=await r.json() as {battles?:Battle[]};
      if(Array.isArray(j.battles)) setBattles(j.battles);
    }catch{}
  },[]);

  useEffect(()=>{ load(); },[load]);
  useEffect(()=>{ loadBattles(); },[loadBattles]);

  // WS live лента
  useEffect(()=>{
    const proto=location.protocol==="https:"?"wss:":"ws:";
    const url=`${proto}//${location.host}/magnum/api/clip-battle/ws`;
    let ws:WebSocket|null=null;
    try{
      ws=new WebSocket(url);
      ws.onopen=()=> setWsLive(true);
      ws.onclose=()=> setWsLive(false);
      ws.onerror=()=> setWsLive(false);
      ws.onmessage=(e)=>{
        try{
          const m=JSON.parse(String(e.data)) as {type?:string; clip?:Clip; battle?:Battle; votesA?:number; votesB?:number; id?:number};
          if(m.type==="clip:new" && m.clip){
            setClips(prev=> [m.clip!, ...prev].slice(0,40));
          } else if(m.type==="battle:update" && typeof m.id==="number"){
            setBattles(prev=> prev.map(b=> b.id===m.id? {...b, votesA: m.votesA??b.votesA, votesB: m.votesB??b.votesB}: b));
          } else if(m.type==="battle:new" && m.battle){
            setBattles(prev=> [m.battle!, ...prev].slice(0,20));
          }
        }catch{}
      };
    }catch{ setWsLive(false); }
    return()=>{ try{ws?.close();}catch{} };
  },[]);

  useEffect(()=>{
    if(!feedRef.current) return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rows=feedRef.current.querySelectorAll<HTMLElement>("[data-clip-card]");
    if(!rows.length) return;
    const ctx=gsap.context(()=>{
      gsap.set(rows,{y:18,opacity:0});
      gsap.to(rows,{y:0,opacity:1,stagger:0.07,duration:0.44,ease:"power2.out"});
    },feedRef);
    return()=>ctx.revert();
  },[clips]);

  useEffect(()=>{
    if(!battles.length) return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const els=document.querySelectorAll<HTMLElement>("[data-battle-row]");
    const ctx=gsap.context(()=>{
      gsap.set(els,{x:24,opacity:0});
      gsap.to(els,{x:0,opacity:1,stagger:0.06,duration:0.3,ease:"power2.out"});
    });
    return()=>ctx.revert();
  },[battles]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>){
    const f=e.target.files?.[0];
    if(!f){ setPreviewUrl(null); setFileB64(null); return; }
    if(f.size>2*1024*1024){ setMsg("Файл >2MB — сожми до 2MB"); return; }
    const url=URL.createObjectURL(f);
    setPreviewUrl(url);
    setMsg("");
    // читаем base64 для stub-загрузки
    const reader=new FileReader();
    reader.onload=()=>{
      const res=String(reader.result||"");
      // оставляем data:... base64 как есть, обрежем если >2MB
      setFileB64(res.slice(0, 2*1024*1024));
    };
    reader.readAsDataURL(f);
    // проверка 15с — если video/audio, слушаем duration
    const v=document.createElement(f.type.startsWith("video")?"video":"audio");
    v.preload="metadata";
    v.onloadedmetadata=()=>{
      if(v.duration> CLIP_MAX_SECONDS + 0.5){
        setMsg(`Клип ${v.duration.toFixed(1)}с > ${CLIP_MAX_SECONDS}с — обрежь`);
      } else setMsg(`Превью: ${v.duration.toFixed(1)}с • ${ (f.size/1024).toFixed(0)}KB`);
    };
    v.src=url;
  }

  async function doUpload(){
    if(!fileB64){ setMsg("Выбери файл 15с"); return; }
    if(!me){ setMsg("Войди, братуха"); return; }
    setUploading(true); setMsg("");
    try{
      const r=await fetch("/magnum/api/clip/upload",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({trackSlug: uploadTrack, mediaB64: fileB64})});
      const j=await r.json() as {ok?:boolean; clip?:Clip; error?:string; balance?:number};
      if(!r.ok){ setMsg(j.error||"Ошибка загрузки"); setUploading(false); return; }
      setMsg(`Залито — ${j.clip?.id} • трек ${uploadTrack}`);
      setFileB64(null); setPreviewUrl(null);
      if(fileRef.current) fileRef.current.value="";
      if(wrapRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
        gsap.fromTo(wrapRef.current.querySelectorAll("[data-upload-btn]"),{scale:1},{scale:1.08,duration:0.2,yoyo:true,repeat:1,ease:"power2.out"});
      }
      load();
    }catch{ setMsg("Сеть"); }
    setUploading(false);
  }

  async function doVote(battleId:number, side:"a"|"b"){
    if(!me){ setMsg("Войди чтобы голосовать"); return; }
    const el=document.querySelector<HTMLElement>(`[data-vote-btn="${battleId}-${side}"]`);
    try{
      const r=await fetch("/magnum/api/clip/vote",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({battleId, side})});
      const j=await r.json() as {ok?:boolean; battle?:Battle; error?:string; balance?:number; votesA?:number; votesB?:number};
      if(!r.ok){ setMsg(j.error||"Ошибка голоса"); if(el && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){ gsap.fromTo(el,{x:-6},{x:6,duration:0.06,yoyo:true,repeat:5,ease:"power2.inOut"}); } return; }
      setMsg(`Голос за ${side==="a"?"A":"B"} • -42 • баланс ${j.balance??""}`);
      if(j.battle) setBattles(prev=> prev.map(b=> b.id===battleId? j.battle!: b));
      else if(typeof j.votesA==="number") setBattles(prev=> prev.map(b=> b.id===battleId? {...b, votesA:j.votesA!, votesB:j.votesB!}:b));
      if(el && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
        gsap.fromTo(el,{x:-6},{x:6,duration:0.06,yoyo:true,repeat:5,ease:"power2.inOut"});
        gsap.fromTo(el,{scale:1},{scale:1.3,duration:0.18,yoyo:true,repeat:1,ease:"back.out(1.4)"});
      }
      // winner conic-gold spin 3s + confetti 140 если победитель определился
      if(j.battle?.winnerId && wrapRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
        const winEl=wrapRef.current.querySelector<HTMLElement>(`[data-battle-winner="${battleId}"]`);
        if(winEl){
          gsap.fromTo(winEl,{rotation:0},{rotation:360,duration:3,ease:"linear"});
          winEl.style.background="conic-gradient(from 0deg, #ffd700, #ffcc00, #ff8a00, #ffd700)";
          winEl.style.boxShadow="0 0 16px #ffd700";
        }
        spawnConfetti(wrapRef.current, 80);
      }
    }catch{ setMsg("Сеть"); if(el && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){ gsap.fromTo(el,{x:-6},{x:6,duration:0.06,yoyo:true,repeat:5,ease:"power2.inOut"});} }
  }

  function spawnConfetti(root:HTMLElement, count:number){
    for(let i=0;i<count;i++){
      const d=document.createElement("div");
      d.style.position="absolute"; d.style.left="50%"; d.style.top="45%"; d.style.width="6px"; d.style.height="6px"; d.style.borderRadius="2px";
      d.style.background= i%3===0?"#ff2d55": i%3===1?"#00ff88":"#ffcc00"; d.style.pointerEvents="none"; d.style.zIndex="99";
      root.appendChild(d);
      const ang=Math.random()*Math.PI*2, dist=70+Math.random()*220;
      gsap.to(d,{x:Math.cos(ang)*dist, y:Math.sin(ang)*dist+80, rotation:Math.random()*720, opacity:0, duration:0.8+Math.random()*0.5, ease:"power2.out", onComplete:()=> d.remove()});
    }
  }

  async function doShare(battleId:number){
    const canvas=canvasRef.current;
    if(!canvas){ setMsg("Canvas нет"); return; }
    const b=battles.find(x=>x.id===battleId);
    canvas.width=1080; canvas.height=1080;
    const ctx=canvas.getContext("2d")!;
    const grad=ctx.createLinearGradient(0,0,1080,1080);
    grad.addColorStop(0,"#0a0a0a"); grad.addColorStop(0.5,"#1a0a2e"); grad.addColorStop(1,"#ff2d55");
    ctx.fillStyle=grad; ctx.fillRect(0,0,1080,1080);
    ctx.fillStyle="#fff"; ctx.font="900 68px Inter, sans-serif"; ctx.fillText("КЛИП-БАТТЛ 42",48,96);
    const aLabel=b?.clipA ? `${b.clipA.username} • ${b.clipA.trackSlug}` : `Клип A #${b?.clipAId}`;
    const bLabel=b?.clipB ? `${b.clipB.username} • ${b.clipB.trackSlug}` : `Клип B #${b?.clipBId}`;
    ctx.font="600 30px Inter, sans-serif"; ctx.fillStyle="rgba(255,255,255,0.9)";
    ctx.fillText(`⚔️ ${aLabel} vs ${bLabel}`,48,165);
    ctx.font="400 26px Inter, sans-serif"; ctx.fillStyle="rgba(255,255,255,0.7)";
    ctx.fillText(`Голоса ${b?.votesA??0} : ${b?.votesB??0} • 15с кавер на MAGNUM`,48,210);
    ctx.fillStyle="rgba(255,204,0,0.95)"; ctx.fillRect(48,260,984,170);
    ctx.fillStyle="#0a0a0a"; ctx.font="800 40px Inter, sans-serif"; ctx.fillText("Голосуй — 42 монеты • победитель +1420",72,330);
    ctx.font="400 26px Inter, sans-serif"; ctx.fillText("Лента • дуэли 24ч • топ недели +420",72,380);
    const qrUrl=`${location.origin}/magnum/clip-battle#b${battleId}`;
    ctx.fillStyle="#fff"; ctx.fillRect(390,500,300,300);
    ctx.fillStyle="#0a0a0a"; ctx.font="700 22px monospace"; ctx.fillText("QR",525,650);
    ctx.font="400 16px monospace"; ctx.fillText(qrUrl.replace("https://","").slice(0,42),400,690);
    ctx.fillStyle="rgba(255,255,255,0.8)"; ctx.font="400 22px Inter, sans-serif"; ctx.fillText("MAGNUM • 5opka — 5 треков — 5 пуль • /magnum/clip-battle",48,1020);
    try{
      const blob:Blob=await new Promise(res=> canvas.toBlob(b=> res(b!), "image/png")!);
      const file=new File([blob],`clip-battle-${battleId}.png`,{type:"image/png"});
      if(navigator.canShare && navigator.canShare({files:[file]})){
        await navigator.share({title:`КЛИП-БАТТЛ 42 — дуэль #${battleId}`, text:`Голоса ${b?.votesA??0}:${b?.votesB??0} — голосуй 42!`, files:[file]});
      } else if((navigator as unknown as {share?:unknown}).share){
        await (navigator as unknown as {share:(d:unknown)=>Promise<void>}).share({title:`КЛИП-БАТТЛ 42`, text:`Дуэль #${battleId} ${b?.votesA??0}:${b?.votesB??0} — ${qrUrl}`, url:qrUrl});
      } else {
        const a=document.createElement("a"); a.href=canvas.toDataURL("image/png"); a.download=`clip-battle-${battleId}.png`; a.click();
      }
    }catch{ /* cancel */ }
    try{
      const r=await fetch("/magnum/api/clip/share",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({battleId})});
      const j=await r.json() as {ok?:boolean; coins?:number; balance?:number; error?:string};
      if(r.ok && j.ok) setMsg(`+${j.coins} за шаринг • баланс ${j.balance}`);
      else if(r.status===409) setMsg("Уже делился сегодня +42 1×/день");
      else if(j.error) setMsg(j.error);
    }catch{ setMsg("Шаринг OK"); }
  }

  return (
    <div ref={wrapRef} style={{maxWidth:980,margin:"0 auto",padding:"24px 16px",position:"relative"}}>
      <h1 style={{fontSize:28,fontWeight:900,letterSpacing:"-0.02em"}}>КЛИП-БАТТЛ 42 <span style={{color:"#ff2d55"}}>— 15с дуэли</span> <span style={{fontSize:12,opacity:0.5,marginLeft:8}}>{wsLive?"● LIVE":"○ offline"}</span></h1>
      <p style={{opacity:0.7,marginTop:6,fontSize:13}}>Кавер/фристайл 15с на MAGNUM • голос 42 • победитель +1420 + 👑24ч • топ недели +420 • шаринг OG 1080×1080</p>

      {/* upload */}
      <div style={{marginTop:16,padding:14,borderRadius:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)"}}>
        <div style={{fontWeight:800,fontSize:13}}>Загрузить 15с клип — 1/день бесплатно</div>
        <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap",alignItems:"center"}}>
          <select value={uploadTrack} onChange={e=> setUploadTrack(e.target.value as ClipTrack)} style={{padding:"8px 10px",borderRadius:8,background:"#0a0a0a",color:"#fff",border:"1px solid rgba(255,255,255,0.15)"}}>
            {CLIP_TRACKS.map(t=> <option key={t} value={t}>{CLIP_TRACK_LABELS[t as ClipTrack]}</option>)}
          </select>
          <input ref={fileRef} type="file" accept="audio/*,video/*" onChange={onFile} style={{fontSize:12}} />
          <button data-upload-btn onClick={doUpload} disabled={uploading || !fileB64} style={{padding:"8px 14px",borderRadius:10,border:"1px solid #ff2d55",background:uploading?"rgba(255,45,85,0.08)":"rgba(255,45,85,0.14)",color:"#ff2d55",fontWeight:800,cursor: uploading||!fileB64?"not-allowed":"pointer",opacity: uploading||!fileB64?0.5:1}}>{uploading?"Заливка…":"Залить 15с ▶"}</button>
        </div>
        {previewUrl && (
          <div style={{marginTop:10}}>
            <video src={previewUrl} controls style={{width:"100%",maxWidth:360,maxHeight:260,borderRadius:10,background:"#000"}} />
            <audio src={previewUrl} controls style={{width:"100%",maxWidth:360,marginTop:6}} />
          </div>
        )}
      </div>

      {/* filters */}
      <div style={{display:"flex",gap:8,marginTop:14,flexWrap:"wrap"}}>
        <button onClick={()=>{setTrack("all"); setPage(1);}} style={{padding:"6px 10px",borderRadius:8,border: track==="all"?"1px solid #ffcc00":"1px solid rgba(255,255,255,0.1)",background: track==="all"?"rgba(255,204,0,0.15)":"transparent",color: track==="all"?"#ffcc00":"#fff",fontSize:12,cursor:"pointer"}}>Все треки</button>
        {CLIP_TRACKS.map(t=> (
          <button key={t} onClick={()=>{setTrack(t); setPage(1);}} style={{padding:"6px 10px",borderRadius:8,border: track===t?"1px solid #00ffcc":"1px solid rgba(255,255,255,0.1)",background: track===t?"rgba(0,255,204,0.12)":"transparent",color: track===t?"#00ffcc":"#fff",fontSize:12,cursor:"pointer"}}>{CLIP_TRACK_LABELS[t as ClipTrack].split("•")[0]?.trim()}</button>
        ))}
        <span style={{marginLeft:"auto",opacity:0.5,fontSize:11,alignSelf:"center"}}>всего {total} • стр {page} • 20/стр</span>
      </div>

      {/* battles */}
      {battles.length>0 && (
        <div style={{marginTop:16}}>
          <div style={{fontWeight:800,fontSize:13,opacity:0.8}}>Баттлы 24ч — голос 42 (1/баттл)</div>
          <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:8}}>
            {battles.map(b=> (
              <div key={b.id} data-battle-row style={{display:"flex",gap:8,alignItems:"center",padding:12,borderRadius:12,background:"rgba(255,45,85,0.06)",border:"1px solid rgba(255,45,85,0.18)",flexWrap:"wrap"}}>
                <div style={{flex:"1 1 160px",minWidth:0}}>
                  <div style={{fontWeight:800,fontSize:12}}>#{b.id} • {b.votesA} : {b.votesB} • до {new Date(b.endsAt).toLocaleString("ru-RU")}</div>
                  <div style={{opacity:0.7,fontSize:11,marginTop:4,display:"flex",gap:6,flexWrap:"wrap"}}>
                    <span style={{border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,padding:"1px 6px"}}>A: {b.clipA? `${b.clipA.username} • ${b.clipA.trackSlug}`: `#${b.clipAId}`}</span>
                    <span style={{border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,padding:"1px 6px"}}>B: {b.clipB? `${b.clipB.username} • ${b.clipB.trackSlug}`: `#${b.clipBId}`}</span>
                  </div>
                  {b.winnerId && <div data-battle-winner={b.id} style={{marginTop:6,padding:"4px 8px",borderRadius:8,background:"rgba(255,215,0,0.14)",border:"1px solid rgba(255,215,0,0.35)",fontSize:11,fontWeight:800,display:"inline-block"}}>👑 победитель #{b.winnerId} +1420</div>}
                </div>
                <button data-vote-btn={`${b.id}-a`} onClick={()=> doVote(b.id,"a")} style={{padding:"8px 12px",borderRadius:10,border:"1px solid #00ff88",background:"rgba(0,255,136,0.12)",color:"#00ff88",fontWeight:800,cursor:"pointer",fontSize:12}}>Голос A 42</button>
                <button data-vote-btn={`${b.id}-b`} onClick={()=> doVote(b.id,"b")} style={{padding:"8px 12px",borderRadius:10,border:"1px solid #9147ff",background:"rgba(145,71,255,0.12)",color:"#c9a6ff",fontWeight:800,cursor:"pointer",fontSize:12}}>Голос B 42</button>
                <button onClick={()=> doShare(b.id)} style={{padding:"8px 10px",borderRadius:10,border:"1px solid rgba(255,204,0,0.4)",background:"rgba(255,204,0,0.10)",color:"#ffcc00",fontWeight:800,cursor:"pointer",fontSize:11}}>Шарить OG</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* лента 15с клипов + плеер */}
      <div ref={feedRef} style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
        {clips.length===0 && <div style={{opacity:0.6,padding:24,textAlign:"center",border:"1px dashed rgba(255,255,255,0.12)",borderRadius:12}}>Пока пусто — залей первый 15с кавер на MAGNUM ▶</div>}
        {clips.map(c=> (
          <div key={c.id} data-clip-card style={{display:"flex",gap:12,alignItems:"center",padding:12,borderRadius:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:800,fontSize:13,display:"flex",gap:6,flexWrap:"wrap"}}><span>{c.username}</span><span style={{opacity:0.5,border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,padding:"0 6px",fontSize:11}}>{c.trackSlug}</span><span style={{marginLeft:"auto",opacity:0.6,fontSize:11}}>♥ {c.likes} • {new Date(c.created_at).toLocaleString("ru-RU")}</span></div>
              <div style={{marginTop:8}}>
                {c.mediaUrl.startsWith("data:video")? <video src={c.mediaUrl} controls style={{width:"100%",maxWidth:360,maxHeight:220,borderRadius:8,background:"#000"}}/> : c.mediaUrl.startsWith("data:audio") || c.mediaUrl.startsWith("data:")? <audio src={c.mediaUrl} controls style={{width:"100%",maxWidth:360}}/> : <div style={{opacity:0.6,fontSize:11,wordBreak:"break-all"}}>{c.mediaUrl.slice(0,120)}</div>}
              </div>
            </div>
            <button onClick={()=>{
              const v=document.querySelector<HTMLMediaElement>(`[src="${CSS.escape(c.mediaUrl)}"]`);
              if(v){ v.paused? v.play().catch(()=>{}) : v.pause(); if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.fromTo(v,{scale:1},{scale:1.08,duration:0.2,yoyo:true,repeat:1,ease:"power2.out"}); }
            }} style={{padding:"10px 14px",borderRadius:999,border:"1px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.08)",color:"#fff",fontWeight:900,cursor:"pointer"}}>▶️</button>
          </div>
        ))}
      </div>

      <div style={{display:"flex",gap:8,marginTop:14,alignItems:"center"}}>
        <button onClick={()=> setPage(p=> Math.max(1,p-1))} disabled={page===1} style={{padding:"7px 12px",borderRadius:8,opacity: page===1?0.4:1}}>‹ Назад</button>
        <span style={{opacity:0.6,fontSize:12}}>стр {page}</span>
        <button onClick={()=> setPage(p=>p+1)} disabled={clips.length<20} style={{padding:"7px 12px",borderRadius:8,opacity: clips.length<20?0.4:1}}>Вперёд ›</button>
        {msg && <span style={{marginLeft:8,color:"#ffcc00",fontSize:12}}>{msg}</span>}
      </div>

      {/* казино 42 — слоты + рулетка */}
      <Casino42 />

      <canvas ref={canvasRef} width={1080} height={1080} style={{display:"none"}} />
      <style>{`@keyframes conicSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
