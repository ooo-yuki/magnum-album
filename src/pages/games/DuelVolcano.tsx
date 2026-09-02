import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import styles from "./DuelVolcano.module.css";
import { getCoins, addCoins } from "../../lib/coins";
import { DuelSocket } from "../../lib/ws";
import { pushDuel } from "../../lib/duelVolcano";

const WAGERS=[0,42,142,420] as const;
type Room={id:string;state:string;players:Array<{name:string;score:number;ready:boolean;volcano?:number;magma?:number;suspect?:boolean}>;wager:number};

export function DuelVolcano(){
  const [room,setRoom]=useState<Room|null>(null);
  const [wager,setWager]=useState<number>(0);
  const [code,setCode]=useState("");
  const [volcano,setVolcano]=useState(0);
  const [score,setScore]=useState(0);
  const [overheat,setOverheat]=useState(false);
  const [suspect,setSuspect]=useState(false);
  const [oppVolcano,setOppVolcano]=useState(0);
  const [elo,setElo]=useState<number|null>(null);
  const [lb,setLb]=useState<Array<{player:string;score:number}>>([]);
  const [msg,setMsg]=useState<string|null>(null);
  const [eruption,setEruption]=useState(false);
  const [me,setMe]=useState<{id:number;username:string}|null>(null);
  // hot-seat: WS не поднялся — играем сами с собой, это не PvP и UI обязан это показать
  const [demoMode,setDemoMode]=useState(false);
  const wsRef=useRef<DuelSocket|null>(null);
  const pageRef=useRef<HTMLDivElement>(null);
  const stageRef=useRef<HTMLDivElement>(null);
  const volcanoRef=useRef<HTMLDivElement>(null);
  const ghostRef=useRef<HTMLDivElement>(null);
  const fillRef=useRef<HTMLDivElement>(null);
  const ashRef=useRef<HTMLDivElement>(null);
  const lastClickRef=useRef(0);
  const heldMaxRef=useRef<number|null>(null);
  const overheatUntilRef=useRef(0);
  const eruptionPendingRef=useRef(false);

  const fetchLb=useCallback(async()=>{
    try{ const r=await fetch("/magnum/api/duel42/leaderboard"); if(r.ok){ const j=await r.json(); setLb(j.leaderboard||[]);} }catch{}
    try{ const r=await fetch("/magnum/api/duel42/elo",{credentials:"include"}); if(r.ok){ const j=await r.json(); setElo(j.elo);} }catch{}
  },[]);
  useEffect(()=>{ fetchLb(); },[fetchLb]);

  // Auth gate
  useEffect(()=>{ fetch("/magnum/api/auth/me",{credentials:"include"}).then(r=>r.ok?r.json():null).then(j=>{ if(j?.user) setMe(j.user); }).catch(()=>{}); },[]);

  useEffect(()=>{
    if(!pageRef.current) return;
    const prefers=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx=gsap.context(()=>{
      if(prefers){ gsap.set(`.${styles.card}`,{y:0,opacity:1,clearProps:"transform"}); return; }
      gsap.set(`.${styles.card}`,{y:24,opacity:0});
      gsap.to(`.${styles.card}`,{y:0,opacity:1,stagger:0.12,duration:0.55,ease:"power2.out",overwrite:true});
      if(stageRef.current) gsap.set(stageRef.current,{y:24,opacity:0}), gsap.to(stageRef.current,{y:0,opacity:1,duration:0.55,ease:"power2.out",delay:0.12});
    },pageRef);
    return()=>ctx.revert();
  },[]);

  const connect=useCallback((joinCode?:string)=>{
    if(!me){ setMsg("Войди, братуха — дуэли только для залогиненных"); window.dispatchEvent(new CustomEvent("magnum:need-auth")); return; }
    const ds=new DuelSocket((m:any)=>{
      if(!m) return;
      if(m.type==="room" && m.room){ setRoom(m.room); }
      if(m.type==="lobby:created"){ setCode(m.code); setRoom(m.room); setMsg(`Лобби ${m.code} создано`); }
      if(m.type==="tick"){
        if(m.volcano!=null || m.magma!=null) setOppVolcano(Number(m.volcano ?? m.magma ?? 0));
        if(m.eruption) {
          // opponent eruption maybe flash
        }
      }
      if(m.type==="scores" && m.room) setRoom(m.room);
      if(m.type==="start"){ setRoom(m.room); setMsg("GO!"); setScore(0); setVolcano(0); setOppVolcano(0); setSuspect(false); eruptionPendingRef.current=false; heldMaxRef.current=null;
        const el=stageRef.current; if(el && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.fromTo(el,{scale:1},{scale:1.02,duration:0.2,yoyo:true,repeat:1});
        const transit=document.createElement("div"); transit.textContent="3-2-1"; Object.assign(transit.style,{position:"fixed",left:"50%",top:"45%",transform:"translate(-50%,-50%)",fontSize:"4rem",fontWeight:"900",color:"#ff5722",zIndex:"999",pointerEvents:"none"}); document.body.appendChild(transit);
        if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches){ gsap.fromTo(transit,{scale:2,opacity:1},{scale:1,opacity:0,duration:0.5,ease:"power2.out",onComplete:()=>transit.remove()}); } else transit.remove();
      }
      if(m.type==="finish"){ setRoom(m.room); const scores=m.room?.players||[]; const max=Math.max(...scores.map((x:any)=>x.score),0); const winners=scores.filter((p:any)=>p.score===max); const isDraw=winners.length!==1; const meW=winners[0]; setMsg(isDraw?"Ничья — возврат ставок":`Победитель ${meW.name} +${wager?` ставка x2`: ""} +42 ELO`); fetchLb();
        if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches) spawnConfetti190();
        // LS history 20
        try{ pushDuel({id:Date.now().toString(36), date:new Date().toISOString(), wager, winner:isDraw?null:meW.name, scores, durationSec:10}); }catch{}
        void fetch("/magnum/api/coins",{credentials:"include"}).then(r=>r.json()).then(j=>{ const v=j.balance??j.coins; if(typeof v==="number") addCoins(v-getCoins()); }).catch(()=>{});
        setEruption(false);
      }
      if(m.type==="suspect"){ setSuspect(true); setMsg(m.toast || "братуха, ты вулкан? 🌋"); }
      if(m.type==="overheat"){ setOverheat(true); setTimeout(()=>setOverheat(false),1500); }
      if(m.type==="wager"){ if(m.wager!=null) setRoom(r=> r?{...r,wager:Number(m.wager)}:r); }
    });
    ds.onHotSeat=(on)=>{ setDemoMode(on); if(on) setMsg("ДЕМО: соперник не подключился — счёт локальный, в рейтинг не идёт"); };
    wsRef.current=ds; ds.connect(joinCode);
  },[fetchLb,wager,me]);

  useEffect(()=>{ connect(); return()=>wsRef.current?.close(); },[connect]);

  function spawnConfetti190(){
    const colors=["#ff5722","#d32f2f","#ffcc00","#fff"];
    const c=document.createElement("canvas"); c.width=window.innerWidth; c.height=window.innerHeight; Object.assign(c.style,{position:"fixed",inset:"0",pointerEvents:"none",zIndex:"500"}); document.body.appendChild(c);
    const ctx=c.getContext("2d")!; type P={x:number;y:number;vx:number;vy:number;life:number;c:string}; const ps:P[]=Array.from({length:190},()=>({x:window.innerWidth/2,y:window.innerHeight*0.35,vx:(Math.random()-0.5)*12,vy:-4-Math.random()*8,life:1,c:colors[Math.floor(Math.random()*colors.length)]!}));
    let raf=0; const draw=()=>{ ctx.clearRect(0,0,c.width,c.height); let alive=0; for(const p of ps){ p.x+=p.vx; p.y+=p.vy; p.vy+=0.35; p.vx*=0.99; p.life-=0.008; if(p.life>0) alive++; ctx.globalAlpha=Math.max(0,p.life); ctx.fillStyle=p.c; ctx.fillRect(p.x,p.y,6,6);} if(alive>0) raf=requestAnimationFrame(draw); else c.remove(); }; raf=requestAnimationFrame(draw);
  }

  const createLobby=async()=>{
    const bal=getCoins(); if(wager>0 && bal<wager){ setMsg(`Нужно ${wager} монет, у тебя ${bal}`); return; }
    if(wager>0){
      try{ const r=await fetch("/magnum/api/duel42/wager",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({wager,roomId:room?.id})}); if(!r.ok){ const j=await r.json().catch(()=>({error:String(r.status)})); setMsg(j.error||"wager failed"); return;} const j=await r.json(); if(typeof j.balance==="number") addCoins(j.balance-getCoins()); }catch{ setMsg("wager error"); return; }
    }
    wsRef.current?.send({type:"lobby:create",wager} as any);
  };
  const joinLobby=()=>{
    const cd=code.trim().toUpperCase(); if(cd.length!==4) { setMsg("Код 4 символа ABCD"); return; }
    wsRef.current?.send({type:"join",code:cd} as unknown as Record<string,unknown> as any);
  };
  const readyUp=()=>{ wsRef.current?.send({type:"ready"} as any); };

  const onVolcanoClick=()=>{
    if(room?.state!=="playing") return;
    if(Date.now()<overheatUntilRef.current) return;
    // client volcano calc for visuals
    const now=Date.now(); const dt=now-lastClickRef.current;
    let nv=volcano; if(dt<120 && lastClickRef.current) nv=Math.min(11,volcano+1); else nv=1;
    setVolcano(nv); lastClickRef.current=now;
    if(nv>=11){ if(heldMaxRef.current===null) heldMaxRef.current=now; } else heldMaxRef.current=null;
    const heldMs=heldMaxRef.current? now-heldMaxRef.current:0;
    const willOverheat=heldMs>=4000;
    let add=1*Math.min(1.77, 1+(nv-1)*0.07);
    if(eruptionPendingRef.current){ add*=2.5; eruptionPendingRef.current=false; setEruption(false); }
    const willEruption=nv>=11 && !eruptionPendingRef.current;
    // check before applying eruptionPending: if we just reached 11, next click gets 2.5x — so set pending now
    if(willEruption && !eruptionPendingRef.current) { eruptionPendingRef.current=true; setEruption(true); }
    if(willOverheat){ setOverheat(true); overheatUntilRef.current=now+1500; heldMaxRef.current=null; eruptionPendingRef.current=false; setEruption(false); setScore(s=> Math.max(0, s*0.35)); try{ navigator.vibrate?.(70);}catch{} }
    else setScore(s=> s+add);
    const prefers=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(!prefers){
      if(stageRef.current) gsap.to(stageRef.current,{x: (Math.random()-0.5)*9*2, duration:0.08, yoyo:true, repeat:1, ease:"power1.inOut", onComplete:()=>gsap.set(stageRef.current!,{x:0})});
      if(stageRef.current) gsap.fromTo(stageRef.current,{scale:1},{scale:1.2,duration:0.1,yoyo:true,repeat:1,ease:"power2.out"});
      if(volcanoRef.current) { gsap.fromTo(volcanoRef.current,{scale:0,y:-16,opacity:0},{scale:1.6,opacity:1,duration:0.12,ease:"back.out(1.7)",onComplete:()=>gsap.to(volcanoRef.current!,{scale:1,duration:0.12})}); }
      if(fillRef.current && nv>=11) gsap.fromTo(fillRef.current,{height:"0%"},{height:"100%",duration:0.12,ease:"power2.out",onComplete:()=>setTimeout(()=>{ if(fillRef.current) gsap.to(fillRef.current,{height:"0%",duration:0.2}); },350)});
      if(ashRef.current) gsap.to(ashRef.current,{backgroundColor: nv>=11?"#d32f2f":"#ff5722", duration:0.2});
      const btn=document.querySelector<HTMLElement>(`[data-volcano-btn]`);
      if(btn) gsap.fromTo(btn,{scale:1},{scale:1.2,duration:0.1,yoyo:true,repeat:1,ease:"power2.out"});
      if(overheat && willOverheat && stageRef.current) { gsap.to(stageRef.current,{x:14,duration:0.25,yoyo:true,repeat:1,ease:"power2.inOut"}); gsap.to(stageRef.current,{scale:1.1,duration:0.6,yoyo:true,repeat:1}); }
      try{ navigator.vibrate?.(10+nv*6);}catch{}
    } else {
      try{ navigator.vibrate?.(10+nv*6);}catch{}
    }
    wsRef.current?.send({type:"click",volcano:nv} as any);
    wsRef.current?.send({type:"tick",volcano:nv} as unknown as Record<string,unknown> as any);
  };

  useEffect(()=>{
    if(!volcanoRef.current) return;
    const w=`${Math.min(100,(volcano/11)*100)}%`;
    if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.to(volcanoRef.current,{width:w,duration:0.3,ease:"power2.out",overwrite:true});
    else volcanoRef.current.style.width=w;
  },[volcano]);
  useEffect(()=>{
    if(!ghostRef.current) return;
    const w=`${Math.min(100,(oppVolcano/11)*100)}%`;
    if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.to(ghostRef.current,{width:w,duration:0.2,overwrite:true});
    else ghostRef.current.style.width=w;
  },[oppVolcano]);

  return <div className={styles.page} ref={pageRef}>
    <div className={styles.header}>
      <div className={styles.badge}>🌋 DUEL VOLCANO 42 — WS 2-4 • x11 • eruption 2.5x</div>
      <h1 className={styles.title}>Вулкан-дуэль 2-4 • x11 • eruption</h1>
      <p style={{color:"rgba(255,255,255,.6)",marginTop:6}}>10с кликер • интервал &lt;0.12с +7% капа x11 (1.07→1.77) • x11→ eruption 2.5x + fill 0→100% 0.12s + shake x±9 0.08s • удержание x11 &gt;4с → overheat 1.5с score*0.35 • wager 0/42/142/420 → win +wager*2 +42 ELO • сезон 7дн</p>
    </div>
    {demoMode && (
      <div role="status" style={{margin:"10px 0",padding:"10px 12px",borderRadius:12,background:"rgba(255,87,34,.12)",border:"1px solid rgba(255,87,34,.42)",color:"#ffb599",fontSize:13,fontWeight:700}}>
        ДЕМО-РЕЖИМ — соединение с соперником не установлено. Ты играешь сам с собой: счёт локальный, ELO и ставки не начисляются.
      </div>
    )}
    <div className={styles.grid}>
      <div className={styles.card}>
        <strong>Ставка</strong>
        <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
          {WAGERS.map(v=><button key={v} className={`${styles.wagerBtn} ${wager===v?styles.wagerBtnActive:""}`} onClick={()=>setWager(v)}>{v===0?"0 френдли":v}</button>)}
        </div>
        <div style={{display:"flex",gap:8,marginTop:10}}>
          <button onClick={createLobby} style={{flex:1,padding:".7rem",borderRadius:999,background:"#ff5722",color:"#fff",fontWeight:900,border:"none",cursor:"pointer"}}>Создать арену {wager? `· ${wager}`:""}</button>
        </div>
        <div style={{display:"flex",gap:8,marginTop:8}}>
          <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="ABCD" maxLength={4} style={{flex:1,padding:".6rem .8rem",borderRadius:12,border:"1px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.06)",color:"#fff",textTransform:"uppercase",letterSpacing:".18em",fontWeight:900,textAlign:"center"}}/>
          <button onClick={joinLobby} style={{padding:".6rem .9rem",borderRadius:12,background:"rgba(255,255,255,.08)",color:"#fff",border:"1px solid rgba(255,255,255,.12)",fontWeight:800,cursor:"pointer"}}>Join</button>
        </div>
        <div style={{marginTop:10,color:"rgba(255,255,255,.6)",fontSize:12}}>Комната: <b style={{color:"#ffcc00"}}>{room?.id?.replace("room:","") || room?.id || "—"}</b> • {room?.state || "—"} • {room?.players.length||0}/4</div>
        {room && room.state==="waiting" && <button onClick={readyUp} style={{marginTop:10,width:"100%",padding:".7rem",borderRadius:999,background:"#00ff88",color:"#111",fontWeight:900,border:"none",cursor:"pointer"}}>Ready ✓</button>}
        {msg && <div style={{marginTop:10,padding:".6rem .8rem",borderRadius:12,background:"rgba(255,87,34,.12)",border:"1px solid rgba(255,87,34,.22)",fontSize:13}}>{msg}</div>}
        <div style={{marginTop:10,display:"flex",gap:8,flexWrap:"wrap"}}>
          {(room?.players||[]).map(p=> <span key={p.name} style={{padding:".3rem .6rem",borderRadius:999,background:p.suspect?"rgba(255,0,0,.22)":"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)",fontSize:12}}>{p.name} {p.ready?"✓":""} {p.suspect?"🤖":""} score:{Math.round(p.score)} v:{p.volcano??p.magma??0}</span>)}
        </div>
        {suspect && <div style={{marginTop:8,color:"#ff6b6b",fontWeight:800}}>братуха, ты вулкан? 🌋 throttle 30/сек</div>}
      </div>
      <div className={styles.card}>
        <strong>Сезон 7дн duel42</strong>
        <div style={{marginTop:8,display:"grid",gap:6}}>
          {lb.length===0? <span style={{color:"rgba(255,255,255,.45)",fontSize:13}}>Пока пусто — стань первым!</span> : lb.slice(0,8).map((r,i)=>
            <div key={r.player+i} className={styles.leaderRow} style={i<3?{borderColor:"#ff5722",boxShadow:"0 0 0 1px rgba(255,87,34,.22), 0 0 18px rgba(255,87,34,.18)",background:"conic-gradient(from 0deg, #ff5722,#d32f2f,#ff5722)",opacity:0.9} as any:undefined}>
              <span>#{i+1} {r.player} {i<3?<span className={styles.crown}>🌋</span>:null}</span><b>{Math.round(r.score)}</b>
            </div>
          )}
        </div>
        <div style={{marginTop:10,fontSize:12,color:"rgba(255,255,255,.55)"}}>Топ-3 +1420 + conic-volcano + crown 🌋 • ELO: {elo ?? "—"}</div>
        <div style={{marginTop:8,display:"flex",gap:8}}><a href="/magnum/presave-rating" style={{fontSize:12,color:"#ffcc00"}}>Рейтинг →</a><a href="/magnum/games" style={{fontSize:12,color:"rgba(255,255,255,.6)"}}>Все игры</a></div>
      </div>
    </div>

    <div ref={stageRef} className={styles.stage} style={overheat?{boxShadow:"0 0 0 2px #d32f2f, 0 0 28px rgba(211,47,47,.6)",animation:"volcanoPulse 0.6s ease"} as any:undefined}>
      <div ref={fillRef} className={styles.lavaFill} style={{background:"linear-gradient(180deg,#ff5722,#d32f2f)",height:"0%"}} />
      <div ref={ashRef} style={{position:"absolute",top:0,left:0,right:0,height:4,background:"#ff5722",opacity:0.9}} />
      <div style={{textAlign:"center",zIndex:2,position:"relative"}}>
        <div style={{fontSize:12,letterSpacing:".12em",color:"rgba(255,255,255,.6)",fontWeight:800}}>VOLCANO x{volcano} {volcano>=11?"🌋 ERUPTION 2.5x":eruption?"⚡ NEXT 2.5x":""}{overheat?" • OVERHEAT 1.5s":""}</div>
        <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:8}}>
          <div style={{width:220}}>
            <div className={styles.magmaBar} style={{background:"rgba(255,87,34,.15)"}}><div ref={volcanoRef as never} className={styles.magmaFill} style={{width:`${(volcano/11)*100}%`,background:"linear-gradient(90deg,#ff5722,#d32f2f)"}}/></div>
            <div className={styles.ghostBar}><div ref={ghostRef as never} className={styles.ghostFill} style={{width:`${(oppVolcano/11)*100}%`,opacity:0.45,background:"#ff5722"}}/></div>
            <div style={{fontSize:10,color:"rgba(255,255,255,.45)",textAlign:"left",marginTop:2}}>ghost соперника {oppVolcano}/11 • width {(oppVolcano/11*100).toFixed(0)}%</div>
          </div>
        </div>
        <button data-volcano-btn onClick={onVolcanoClick} className={styles.clickBtn} style={overheat?{filter:"grayscale(1) brightness(.6)",cursor:"not-allowed"}:undefined}>ЖАТЬ! {Math.round(score)}</button>
        <div style={{marginTop:8,color:"rgba(255,255,255,.6)",fontSize:12}}>10с • жми &lt;0.12с для цепочки +7% • капа x11</div>
      </div>
    </div>
    <div style={{textAlign:"center",marginTop:12}}><a href="/magnum" style={{color:"rgba(255,255,255,.55)",fontSize:13}}>← На главную</a></div>
  </div>;
}
export const DuelVolcanoGame = DuelVolcano;
