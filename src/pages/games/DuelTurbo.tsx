import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import styles from "./DuelTurbo.module.css";
import { getCoins, addCoins } from "../../lib/coins";
import { DuelSocket } from "../../lib/ws";
import { pushDuel } from "../../lib/duelTurbo";
import { subscribeMe, type MeUser } from "../../lib/authMe";
import { AuthStatus } from "../../components/AuthStatus";

const WAGERS=[0,42,142,420] as const;
type Room={id:string;state:string;players:Array<{name:string;score:number;ready:boolean;turbo?:number;magma?:number;volcano?:number;suspect?:boolean}>;wager:number};

export function DuelTurbo(){
  const [room,setRoom]=useState<Room|null>(null);
  const [wager,setWager]=useState<number>(0);
  const [code,setCode]=useState("");
  const [turbo,setTurbo]=useState(0);
  const [score,setScore]=useState(0);
  const [suspect,setSuspect]=useState(false);
  const [oppTurbo,setOppTurbo]=useState(0);
  const [ghostReplay,setGhostReplay]=useState<number[]>([]);
  const [elo,setElo]=useState<number|null>(null);
  const [lb,setLb]=useState<Array<{player:string;score:number}>>([]);
  const [msg,setMsg]=useState<string|null>(null);
  const [me,setMe]=useState<MeUser>(null);
  useEffect(()=>subscribeMe(setMe as any),[]);
  const wsRef=useRef<DuelSocket|null>(null);
  const pageRef=useRef<HTMLDivElement>(null);
  const stageRef=useRef<HTMLDivElement>(null);
  const turboRef=useRef<HTMLDivElement>(null);
  const ghostRef=useRef<HTMLDivElement>(null);
  const trailRef=useRef<HTMLDivElement>(null);
  const lastClickRef=useRef(0);
  const localGhostRef=useRef<number[]>([]);

  const fetchLb=useCallback(async()=>{
    try{ const r=await fetch("/magnum/api/duel42/leaderboard"); if(r.ok){ const j=await r.json(); setLb(j.leaderboard||[]);} }catch{}
    try{ const r=await fetch("/magnum/api/duel42/elo",{credentials:"include"}); if(r.ok){ const j=await r.json(); setElo(j.elo);} }catch{}
  },[]);
  useEffect(()=>{ fetchLb(); },[fetchLb]);

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
        const t = m.turbo ?? m.nitro ?? m.magma ?? m.volcano;
        if(m.from && t!=null) { setOppTurbo(Number(t)); setGhostReplay(prev=> [...prev.slice(-7), Number(t)]); }
        if(m.from && m.ghostTrail!==undefined){
          if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches && trailRef.current){
            gsap.fromTo(trailRef.current,{opacity:0.9},{opacity:0.45,duration:0.9,ease:"power2.out"});
          }
        }
      }
      if(m.type==="scores" && m.room) setRoom(m.room);
      if(m.type==="start"){ setRoom(m.room); setMsg("GO! TURBO!"); setScore(0); setTurbo(0); setOppTurbo(0); setGhostReplay([]); localGhostRef.current=[]; setSuspect(false);
        const el=stageRef.current; if(el && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.fromTo(el,{scale:1},{scale:1.02,duration:0.2,yoyo:true,repeat:1});
        const transit=document.createElement("div"); transit.textContent="3-2-1 TURBO"; Object.assign(transit.style,{position:"fixed",left:"50%",top:"45%",transform:"translate(-50%,-50%)",fontSize:"3.2rem",fontWeight:"900",color:"#00d4ff",zIndex:"999",pointerEvents:"none",textShadow:"0 0 18px rgba(0,212,255,.6)"}); document.body.appendChild(transit);
        if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches){ gsap.fromTo(transit,{scale:2,opacity:1},{scale:1,opacity:0,duration:0.5,ease:"power2.out",onComplete:()=>transit.remove()}); } else transit.remove();
      }
      if(m.type==="finish"){ setRoom(m.room); const scores=m.room?.players||[]; const max=Math.max(...scores.map((x:any)=>x.score),0); const winners=scores.filter((p:any)=>p.score===max); const isDraw=winners.length!==1; const meW=winners[0]; setMsg(isDraw?"Ничья — возврат ставок":`Победитель ${meW.name} +${wager?` ставка x2`:""} +42 ELO`); fetchLb();
        if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches) spawnConfetti160();
        try{ pushDuel({id:Date.now().toString(36), date:new Date().toISOString(), wager, winner:isDraw?null:meW.name, scores, durationSec:10}); }catch{}
        void fetch("/magnum/api/coins",{credentials:"include"}).then(r=>r.json()).then(j=>{ const v=j.balance??j.coins; if(typeof v==="number") addCoins(v-getCoins()); }).catch(()=>{});
      }
      if(m.type==="suspect"){ setSuspect(true); setMsg(m.toast || "братуха, ты турбо-призрак? 👻"); }
      if(m.type==="wager"){ if(m.wager!=null) setRoom(r=> r?{...r,wager:Number(m.wager)}:r); }
    });
    wsRef.current=ds; ds.connect(joinCode);
  },[fetchLb,wager,me]);

  useEffect(()=>{ if(!me) return; connect(); return()=>wsRef.current?.close(); },[connect,me]);

  function spawnConfetti160(){
    const colors=["#00d4ff","#7b00ff","#ff2d55","#fff"];
    const c=document.createElement("canvas"); c.width=window.innerWidth; c.height=window.innerHeight; Object.assign(c.style,{position:"fixed",inset:"0",pointerEvents:"none",zIndex:"500"}); document.body.appendChild(c);
    const ctx=c.getContext("2d")!; type P={x:number;y:number;vx:number;vy:number;life:number;c:string}; const ps:P[]=Array.from({length:160},()=>({x:window.innerWidth/2,y:window.innerHeight*0.35,vx:(Math.random()-0.5)*12,vy:-4-Math.random()*8,life:1,c:colors[Math.floor(Math.random()*colors.length)]!}));
    let raf=0; const draw=()=>{ ctx.clearRect(0,0,c.width,c.height); let alive=0; for(const p of ps){ p.x+=p.vx; p.y+=p.vy; p.vy+=0.35; p.vx*=0.99; p.life-=0.008; if(p.life>0) alive++; ctx.globalAlpha=Math.max(0,p.life); ctx.fillStyle=p.c; ctx.fillRect(p.x,p.y,6,6);} if(alive>0) raf=requestAnimationFrame(draw); else c.remove(); }; raf=requestAnimationFrame(draw);
  }

  const createLobby=async()=>{
    if(!me){ setMsg("Войди, братуха — дуэли только для залогиненных"); window.dispatchEvent(new CustomEvent("magnum:need-auth")); return; }
    const bal=getCoins(); if(wager>0 && bal<wager){ setMsg(`Нужно ${wager} монет, у тебя ${bal}`); return; }
    if(wager>0){
      try{ const r=await fetch("/magnum/api/duel42/wager",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({wager,roomId:room?.id})}); if(!r.ok){ const j=await r.json().catch(()=>({error:String(r.status)})); setMsg(j.error||"wager failed"); return;} const j=await r.json(); if(typeof j.balance==="number") addCoins(j.balance-getCoins()); }catch{ setMsg("wager error"); return; }
    }
    wsRef.current?.send({type:"lobby:create",wager} as any);
  };
  const joinLobby=()=>{
    if(!me){ setMsg("Войди, братуха — дуэли только для залогиненных"); window.dispatchEvent(new CustomEvent("magnum:need-auth")); return; }
    const cd=code.trim().toUpperCase(); if(cd.length!==4) { setMsg("Код 4 символа ABCD"); return; }
    wsRef.current?.send({type:"join",code:cd} as unknown as Record<string,unknown> as any);
  };
  const readyUp=()=>{ if(!me){ setMsg("Войди, братуха — дуэли только для залогиненных"); window.dispatchEvent(new CustomEvent("magnum:need-auth")); return; } wsRef.current?.send({type:"ready"} as any); };

  const onTurboClick=()=>{
    if(!me){ setMsg("Войди, братуха — дуэли только для залогиненных"); window.dispatchEvent(new CustomEvent("magnum:need-auth")); return; }
    if(room?.state!=="playing") return;
    const now=Date.now(); const dt=now-lastClickRef.current;
    let nt=turbo; if(dt<200 && lastClickRef.current) nt=Math.min(8,turbo+1); else nt=1;
    setTurbo(nt); lastClickRef.current=now;
    localGhostRef.current=[...localGhostRef.current.slice(-7), nt];
    let add=1*Math.min(1.7, 1+(nt-1)*0.10);
    setScore(s=> s+add);
    const prefers=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(!prefers){
      if(stageRef.current) gsap.to(stageRef.current,{x: (Math.random()-0.5)*6*2, duration:0.08, yoyo:true, repeat:1, ease:"power1.inOut", onComplete:()=>gsap.set(stageRef.current!,{x:0})});
      if(turboRef.current) { gsap.fromTo(turboRef.current,{scale:0,y:-16,opacity:0},{scale:1.2,opacity:1,duration:0.12,ease:"back.out(1.7)",onComplete:()=>gsap.to(turboRef.current!,{scale:1,duration:0.12})}); }
      if(trailRef.current && nt>=5) gsap.fromTo(trailRef.current,{opacity:0.3,scale:0.9},{opacity:0.9,scale:1,duration:0.18,ease:"power2.out"});
      const btn=document.querySelector<HTMLElement>(`[data-turbo-btn]`);
      if(btn) gsap.fromTo(btn,{scale:1},{scale:1.12,duration:0.1,yoyo:true,repeat:1,ease:"power2.out"});
      try{ navigator.vibrate?.(10+nt*4);}catch{}
    }
    wsRef.current?.send({type:"click",turbo:nt} as any);
    wsRef.current?.send({type:"tick",turbo:nt} as unknown as Record<string,unknown> as any);
  };

  useEffect(()=>{
    if(!turboRef.current) return;
    const w=`${Math.min(100,(turbo/8)*100)}%`;
    if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.to(turboRef.current,{width:w,duration:0.3,ease:"power2.out",overwrite:true});
    else turboRef.current.style.width=w;
  },[turbo]);
  useEffect(()=>{
    if(!ghostRef.current) return;
    const w=`${Math.min(100,(oppTurbo/8)*100)}%`;
    if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.to(ghostRef.current,{width:w,duration:0.2,overwrite:true});
    else ghostRef.current.style.width=w;
  },[oppTurbo]);
  useEffect(()=>{
    if(!trailRef.current || turbo<5) return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.to(trailRef.current,{opacity:0.9,duration:0.2,overwrite:true});
    gsap.to(trailRef.current,{scale:1.04,duration:0.45,yoyo:true,repeat:1,ease:"sine.inOut"});
  },[turbo]);

  return <div className={styles.page} ref={pageRef}>
    <div className={styles.header}>
      <div className={styles.badge}>⚡ DUEL TURBO 42 — WS 2-4 • x8 • ghost replay</div>
      <h1 className={styles.title}>Турбо-дуэль 2-4 • x8 • ghost</h1>
      <p style={{color:"rgba(255,255,255,.6)",marginTop:6}}>10с кликер • интервал &lt;0.2с +10% капа x8 (1.0→1.7) • ghost trail x5+ • pulse • wager 0/42/142/420 → win +wager*2 +42 ELO • сезон 7дн</p>
    </div>
    {!me && <div style={{margin:"12px 0",padding:"12px 14px",borderRadius:12,background:"rgba(0,212,255,.10)",border:"1px solid rgba(0,212,255,.28)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><span style={{color:"#00d4ff",fontWeight:900}}>Войди, братуха — дуэли только для залогиненных</span><span style={{display:"inline-flex"}}><AuthStatus /></span><button onClick={()=>window.dispatchEvent(new CustomEvent("magnum:need-auth"))} style={{padding:".5rem .9rem",borderRadius:999,background:"#00d4ff",color:"#111",fontWeight:900,border:"none",cursor:"pointer"}}>Войти</button></div>}
    <div className={styles.grid}>
      <div className={styles.card}>
        <strong>Ставка</strong>
        <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
          {WAGERS.map(v=><button key={v} className={`${styles.wagerBtn} ${wager===v?styles.wagerBtnActive:""}`} onClick={()=>setWager(v)}>{v===0?"0 френдли":v}</button>)}
        </div>
        <div style={{display:"flex",gap:8,marginTop:10}}>
          <button onClick={createLobby} disabled={!me} style={{flex:1,padding:".7rem",borderRadius:999,background: !me ? "rgba(255,255,255,.06)": "#00d4ff",color: !me?"rgba(255,255,255,.45)":"#111",fontWeight:900,border:"none",cursor: !me?"not-allowed":"pointer",opacity: !me?0.6:1}}>Создать арену {wager? `· ${wager}`:""}</button>
        </div>
        <div style={{display:"flex",gap:8,marginTop:8}}>
          <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="ABCD" maxLength={4} style={{flex:1,padding:".6rem .8rem",borderRadius:12,border:"1px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.06)",color:"#fff",textTransform:"uppercase",letterSpacing:".18em",fontWeight:900,textAlign:"center"}}/>
          <button onClick={joinLobby} disabled={!me} style={{padding:".6rem .9rem",borderRadius:12,background: !me ? "rgba(255,255,255,.04)": "rgba(255,255,255,.08)",color: !me?"rgba(255,255,255,.35)":"#fff",border:"1px solid rgba(255,255,255,.12)",fontWeight:800,cursor: !me?"not-allowed":"pointer",opacity: !me?0.6:1}}>Join</button>
        </div>
        <div style={{marginTop:10,color:"rgba(255,255,255,.6)",fontSize:12}}>Комната: <b style={{color:"#00d4ff"}}>{room?.id?.replace("room:","") || room?.id || "—"}</b> • {room?.state || "—"} • {room?.players.length||0}/4</div>
        {room && room.state==="waiting" && <button onClick={readyUp} disabled={!me} style={{marginTop:10,width:"100%",padding:".7rem",borderRadius:999,background: !me ? "rgba(255,255,255,.06)" : "#00d4ff",color: !me?"rgba(255,255,255,.35)":"#111",fontWeight:900,border:"none",cursor: !me?"not-allowed":"pointer",opacity:!me?0.6:1}}>Ready ✓</button>}
        {msg && <div style={{marginTop:10,padding:".6rem .8rem",borderRadius:12,background:"rgba(0,212,255,.12)",border:"1px solid rgba(0,212,255,.22)",fontSize:13}}>{msg}</div>}
        <div style={{marginTop:10,display:"flex",gap:8,flexWrap:"wrap"}}>
          {(room?.players||[]).map(p=> <span key={p.name} style={{padding:".3rem .6rem",borderRadius:999,background:p.suspect?"rgba(255,0,0,.22)":"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)",fontSize:12}}>{p.name} {p.ready?"✓":""} {p.suspect?"🤖":""} score:{Math.round(p.score)} t:{p.turbo??p.volcano??p.magma??0}</span>)}
        </div>
        {suspect && <div style={{marginTop:8,color:"#ff6b6b",fontWeight:800}}>братуха, ты турбо-призрак? 👻 throttle 30/сек</div>}
      </div>
      <div className={styles.card}>
        <strong>Сезон 7дн duel42</strong>
        <div style={{marginTop:8,display:"grid",gap:6}}>
          {lb.length===0? <span style={{color:"rgba(255,255,255,.45)",fontSize:13}}>Пока пусто — стань первым!</span> : lb.slice(0,8).map((r,i)=>
            <div key={r.player+i} className={styles.leaderRow} style={i<3?{borderColor:"#00d4ff",boxShadow:"0 0 0 1px rgba(0,212,255,.22), 0 0 18px rgba(0,212,255,.18)",background:"conic-gradient(from 0deg, #00d4ff,#7b00ff,#00d4ff)",opacity:0.9} as any:undefined}>
              <span>#{i+1} {r.player} {i<3?<span className={styles.crown}>⚡</span>:null}</span><b>{Math.round(r.score)}</b>
            </div>
          )}
        </div>
        <div style={{marginTop:10,fontSize:12,color:"rgba(255,255,255,.55)"}}>Топ-3 +1420 + conic-turbo + crown ⚡ • ELO: {elo ?? "—"}</div>
        <div style={{marginTop:8,display:"flex",gap:8}}><a href="/magnum/presave-rating" style={{fontSize:12,color:"#00d4ff"}}>Рейтинг →</a><a href="/magnum/games" style={{fontSize:12,color:"rgba(255,255,255,.6)"}}>Все игры</a></div>
      </div>
    </div>

    <div ref={stageRef} className={styles.stage}>
      <div style={{position:"absolute",top:10,left:"50%",transform:"translateX(-50%)",display:"flex",gap:4,opacity: turbo>=5?0.9:0.25}} ref={trailRef}>
        {Array.from({length:8}).map((_,i)=> <span key={i} style={{width:8,height:8,borderRadius:"50%",background: i < turbo ? "#00d4ff" : "rgba(255,255,255,.15)", boxShadow: i<turbo? "0 0 8px rgba(0,212,255,.8)":"none", opacity: i<turbo?1:0.4, animation: i<turbo && turbo>=5 ? "turboPulse 0.9s ease infinite" : undefined, animationDelay: `${i*0.08}s`}}/>)}
      </div>
      <div style={{textAlign:"center",zIndex:2,position:"relative",marginTop:18}}>
        <div style={{fontSize:12,letterSpacing:".12em",color:"rgba(255,255,255,.6)",fontWeight:800}}>TURBO x{turbo} {turbo>=5?"⚡ GHOST TRAIL":""}{turbo>=8?" • MAX 1.7x":""}</div>
        <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:8}}>
          <div style={{width:220}}>
            <div className={styles.magmaBar}><div ref={turboRef as never} className={styles.magmaFill} style={{width:`${(turbo/8)*100}%`}}/></div>
            <div className={styles.ghostBar}><div ref={ghostRef as never} className={styles.ghostFill} style={{width:`${(oppTurbo/8)*100}%`,opacity:0.55}}/></div>
            <div style={{fontSize:10,color:"rgba(255,255,255,.45)",textAlign:"left",marginTop:2}}>ghost соперника {oppTurbo}/8 • {ghostReplay.length? `replay [${ghostReplay.join("·")}]` : "replay —"} </div>
          </div>
        </div>
        <button data-turbo-btn onClick={onTurboClick} className={styles.clickBtn}>ЖАТЬ! {Math.round(score)}</button>
        <div style={{marginTop:8,color:"rgba(255,255,255,.6)",fontSize:12}}>10с • жми &lt;0.2с для цепочки +10% • капа x8</div>
        {ghostReplay.length>0 && <div style={{marginTop:6,display:"flex",gap:4,justifyContent:"center",flexWrap:"wrap"}}>{ghostReplay.map((v,i)=><span key={i} style={{minWidth:22,textAlign:"center",padding:"2px 6px",borderRadius:999,background: v>=5?"rgba(0,212,255,.22)":"rgba(255,255,255,.07)",border:"1px solid rgba(0,212,255,.18)",fontSize:11,fontWeight:800,opacity:0.9}}>x{v}</span>)}</div>}
      </div>
    </div>
    <div style={{textAlign:"center",marginTop:12}}><a href="/magnum" style={{color:"rgba(255,255,255,.55)",fontSize:13}}>← На главную</a></div>
  </div>;
}
export const DuelTurboGame = DuelTurbo;
