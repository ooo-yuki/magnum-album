import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import styles from "./DuelMagma.module.css";
import { getCoins, addCoins } from "../../lib/coins";
import { DuelSocket } from "../../lib/ws";
import { CosmeticIdentity, type LeaderCosmetics } from "../../components/CosmeticBadge";

const WAGERS=[0,42,142,420] as const;
type Room={id:string;state:string;players:Array<{name:string;score:number;ready:boolean;magma?:number;suspect?:boolean}>;wager:number};

export function DuelMagma(){

  const [room,setRoom]=useState<Room|null>(null);
  const [wager,setWager]=useState<number>(0);
  const [code,setCode]=useState("");
  const [magma,setMagma]=useState(0);
  const [score,setScore]=useState(0);
  const [overheat,setOverheat]=useState(false);
  const [suspect,setSuspect]=useState(false);
  const [oppMagma,setOppMagma]=useState(0);
  const [elo,setElo]=useState<number|null>(null);
  const [lb,setLb]=useState<Array<{player:string;score:number;avatar?:string|null} & LeaderCosmetics>>([]);
  const [msg,setMsg]=useState<string|null>(null);
  const [me,setMe]=useState<{id:number;username:string}|null>(null);
  // Соединения нет — матча нет. Локального счёта не существует, играть не даём.
  const [offline,setOffline]=useState(false);
  const wsRef=useRef<DuelSocket|null>(null);
  const pageRef=useRef<HTMLDivElement>(null);
  const stageRef=useRef<HTMLDivElement>(null);
  const magmaRef=useRef<HTMLDivElement>(null);
  const ghostRef=useRef<HTMLDivElement>(null);
  const lavaRef=useRef<HTMLDivElement>(null);
  const lastClickRef=useRef(0);
  const heldMaxRef=useRef<number|null>(null);
  const overheatUntilRef=useRef(0);

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

  // WS connect
  const connect=useCallback((joinCode?:string)=>{
    if(!me){ setMsg("Войди, братуха — дуэли только для залогиненных"); window.dispatchEvent(new CustomEvent("magnum:need-auth")); return; }
    const ds=new DuelSocket((m:any)=>{
      if(!m) return;
      if(m.type==="room" && m.room){ setRoom(m.room); }
      if(m.type==="lobby:created"){ setCode(m.code); setRoom(m.room); setMsg(`Лобби ${m.code} создано`); }
      if(m.type==="tick"){ if(m.from && m.magma!=null) setOppMagma(Number(m.magma)); }
      if(m.type==="scores" && m.room) setRoom(m.room);
      if(m.type==="start"){ setRoom(m.room); setMsg("GO!"); setScore(0); setMagma(0); setOppMagma(0); setSuspect(false);
        const el=stageRef.current; if(el && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.fromTo(el,{scale:1},{scale:1.02,duration:0.2,yoyo:true,repeat:1});
        // 3-2-1 transit
        const transit=document.createElement("div"); transit.textContent="3-2-1"; Object.assign(transit.style,{position:"fixed",left:"50%",top:"45%",transform:"translate(-50%,-50%)",fontSize:"4rem",fontWeight:"900",color:"#ff4500",zIndex:"999",pointerEvents:"none"}); document.body.appendChild(transit);
        if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches){ gsap.fromTo(transit,{scale:2,opacity:1},{scale:1,opacity:0,duration:0.5,ease:"power2.out",onComplete:()=>transit.remove()}); } else transit.remove();
      }
      if(m.type==="finish"){ setRoom(m.room); const scores=m.room?.players||[]; const me=scores.find((p:any)=>p.score===Math.max(...scores.map((x:any)=>x.score))); setMsg(me?`Победитель ${me.name} +${wager?` ставка x2`:""} +42 ELO`:"Ничья — возврат ставок"); fetchLb();
        // confetti 180
        if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches) spawnConfetti180();
        // coins via ledger already server, refresh
        void fetch("/magnum/api/coins",{credentials:"include"}).then(r=>r.json()).then(j=>{ const v=j.balance??j.coins; if(typeof v==="number") addCoins(v-getCoins()); }).catch(()=>{});
      }
      if(m.type==="suspect"){ setSuspect(true); setMsg("братуха, ты робот? 🌋"); }
      if(m.type==="overheat"){ setOverheat(true); setTimeout(()=>setOverheat(false),1200); }
      if(m.type==="wager"){ if(m.wager!=null) setRoom(r=> r?{...r,wager:Number(m.wager)}:r); }
    });
    ds.onOffline=(on)=>{ setOffline(on); if(on) setMsg("Нет связи с сервером — матч недоступен"); };
    wsRef.current=ds; ds.connect(joinCode);
  },[fetchLb,wager,me]);

  useEffect(()=>{ connect(); return()=>wsRef.current?.close(); },[connect]);

  function spawnConfetti180(){
    const colors=["#ff4500","#ff0000","#ffcc00","#fff"];
    const c=document.createElement("canvas"); c.width=window.innerWidth; c.height=window.innerHeight; Object.assign(c.style,{position:"fixed",inset:"0",pointerEvents:"none",zIndex:"500"}); document.body.appendChild(c);
    const ctx=c.getContext("2d")!; type P={x:number;y:number;vx:number;vy:number;life:number;c:string}; const ps:P[]=Array.from({length:180},()=>({x:window.innerWidth/2,y:window.innerHeight*0.35,vx:(Math.random()-0.5)*12,vy:-4-Math.random()*8,life:1,c:colors[Math.floor(Math.random()*colors.length)]!}));
    let raf=0; const draw=()=>{ ctx.clearRect(0,0,c.width,c.height); let alive=0; for(const p of ps){ p.x+=p.vx; p.y+=p.vy; p.vy+=0.35; p.vx*=0.99; p.life-=0.008; if(p.life>0) alive++; ctx.globalAlpha=Math.max(0,p.life); ctx.fillStyle=p.c; ctx.fillRect(p.x,p.y,6,6);} if(alive>0) raf=requestAnimationFrame(draw); else c.remove(); }; raf=requestAnimationFrame(draw);
  }

  const createLobby=async()=>{
    const bal=getCoins(); if(wager>0 && bal<wager){ setMsg(`Нужно ${wager} монет, у тебя ${bal}`); return; }
    if(wager>0){
      try{ const r=await fetch("/magnum/api/duel42/wager",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({wager,roomId:room?.id})}); if(!r.ok){ const j=await r.json().catch(()=>({error:r.status})); setMsg(j.error||"wager failed"); return;} const j=await r.json(); if(typeof j.balance==="number") addCoins(j.balance-getCoins()); }catch{ setMsg("wager error"); return; }
    }
    wsRef.current?.send({type:"lobby:create",wager} as any);
  };
  const joinLobby=()=>{
    const cd=code.trim().toUpperCase(); if(cd.length!==4) { setMsg("Код 4 символа ABCD"); return; }
    wsRef.current?.send({type:"join",code:cd} as unknown as Record<string,unknown> as any);
  };
  const readyUp=()=>{ wsRef.current?.send({type:"ready"} as any); };

  const onMagmaClick=()=>{
    if(room?.state!=="playing") return;
    if(Date.now()<overheatUntilRef.current) return;
    if(room.players.some(p=>p.suspect) && suspect) return;
    // client-side magma calc for visuals
    const now=Date.now(); const dt=now-lastClickRef.current;
    let nm= magma; if(dt<150 && lastClickRef.current) nm=Math.min(10,magma+1); else nm=1;
    setMagma(nm); lastClickRef.current=now;
    if(nm>=10){ if(heldMaxRef.current===null) heldMaxRef.current=now; } else heldMaxRef.current=null;
    const heldMs=heldMaxRef.current? now-heldMaxRef.current:0;
    const willOverheat=heldMs>=3500;
    let add=1*Math.min(1.8, 1+(nm-1)*0.08); if(nm>=10) add*=2;
    if(willOverheat){ setOverheat(true); overheatUntilRef.current=now+1200; heldMaxRef.current=null; setScore(s=> Math.max(0, s*0.4)); setTimeout(()=>setOverheat(false),1200); }
    else setScore(s=> s+add);
    const prefers=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(!prefers){
      if(stageRef.current) gsap.to(stageRef.current,{x: (Math.random()-0.5)*14, duration:0.08, yoyo:true, repeat:1, ease:"power1.inOut", onComplete:()=>gsap.set(stageRef.current!,{x:0})});
      if(magmaRef.current) { gsap.fromTo(magmaRef.current,{scale:0,y:-14,opacity:0},{scale:1.5,opacity:1,duration:0.12,ease:"back.out(1.7)",onComplete:()=>gsap.to(magmaRef.current!,{scale:1,duration:0.12})}); }
      if(lavaRef.current && nm>=10) gsap.to(lavaRef.current,{height:"100%",duration:0.15,ease:"power2.out",onComplete:()=>setTimeout(()=>{ if(lavaRef.current) lavaRef.current.style.height="0"; },400)});
      const btn=document.querySelector<HTMLElement>(`[data-magma-btn]`);
      if(btn) gsap.fromTo(btn,{scale:1},{scale:1.18,duration:0.1,yoyo:true,repeat:1,ease:"power2.out"});
      if(magmaRef.current) gsap.to(magmaRef.current,{y:-6, duration:0.12, yoyo:true, repeat:1});
      if(overheat && stageRef.current) gsap.to(stageRef.current,{x:12,duration:0.25,yoyo:true,repeat:1,ease:"power2.inOut"});
    }
    try{ navigator.vibrate?.(10+nm*7); }catch{}
    wsRef.current?.send({type:"click",magma:nm} as any);
    wsRef.current?.send({type:"tick",magma:nm} as unknown as Record<string,unknown> as any);
  };

  useEffect(()=>{
    if(!magmaRef.current) return;
    const w=`${Math.min(100,(magma/10)*100)}%`;
    if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.to(magmaRef.current,{width:w,duration:0.3,ease:"power2.out",overwrite:true});
    else magmaRef.current.style.width=w;
  },[magma]);
  useEffect(()=>{
    if(!ghostRef.current) return;
    const w=`${Math.min(100,(oppMagma/10)*100)}%`;
    if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.to(ghostRef.current,{width:w,duration:0.2,overwrite:true});
    else ghostRef.current.style.width=w;
  },[oppMagma]);

  return <div className={styles.page} ref={pageRef}>
    <div className={styles.header}>
      <div className={styles.badge}>🌋 DUEL MAGMA 42</div>
      <h1 className={styles.title}>Магма-дуэль 2-4 • x10 • lava-spike 2x</h1>
      <p style={{color:"rgba(255,255,255,.6)",marginTop:6}}>10с кликер • интервал &lt;0.15с +8% капа x10 • удержание x10 3.5с → overheat 1.2с -60% • wager 0/42/142/420 → win +wager*2 +42 ELO • сезон 7дн</p>
    </div>
    {offline && (
      <div role="status" style={{margin:"10px 0",padding:"10px 12px",borderRadius:12,background:"rgba(255,87,34,.12)",border:"1px solid rgba(255,87,34,.42)",color:"#ffb599",fontSize:13,fontWeight:700}}>
        НЕТ СВЯЗИ С СЕРВЕРОМ — матч не идёт. Дуэль возможна только с реальным соперником: восстанови соединение и зайди заново.
      </div>
    )}
    <div className={styles.grid}>
      <div className={styles.card}>
        <strong>Ставка</strong>
        <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
          {WAGERS.map(v=><button key={v} className={`${styles.wagerBtn} ${wager===v?styles.wagerBtnActive:""}`} onClick={()=>setWager(v)}>{v===0?"0 френдли":v}</button>)}
        </div>
        <div style={{display:"flex",gap:8,marginTop:10}}>
          <button onClick={createLobby} style={{flex:1,padding:".7rem",borderRadius:999,background:"#ff4500",color:"#fff",fontWeight:900,border:"none",cursor:"pointer"}}>Создать арену {wager? `· ${wager}`:""}</button>
        </div>
        <div style={{display:"flex",gap:8,marginTop:8}}>
          <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="ABCD" maxLength={4} style={{flex:1,padding:".6rem .8rem",borderRadius:12,border:"1px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.06)",color:"#fff",textTransform:"uppercase",letterSpacing:".18em",fontWeight:900,textAlign:"center"}}/>
          <button onClick={joinLobby} style={{padding:".6rem .9rem",borderRadius:12,background:"rgba(255,255,255,.08)",color:"#fff",border:"1px solid rgba(255,255,255,.12)",fontWeight:800,cursor:"pointer"}}>Join</button>
        </div>
        <div style={{marginTop:10,color:"rgba(255,255,255,.6)",fontSize:12}}>Комната: <b style={{color:"#ffcc00"}}>{room?.id?.replace("room:","") || room?.id || "—"}</b> • {room?.state || "—"} • {room?.players.length||0}/4</div>
        {room && room.state==="waiting" && <button onClick={readyUp} style={{marginTop:10,width:"100%",padding:".7rem",borderRadius:999,background:"#00ff88",color:"#111",fontWeight:900,border:"none",cursor:"pointer"}}>Ready ✓</button>}
        {msg && <div style={{marginTop:10,padding:".6rem .8rem",borderRadius:12,background:"rgba(255,69,0,.12)",border:"1px solid rgba(255,69,0,.22)",fontSize:13}}>{msg}</div>}
        <div style={{marginTop:10,display:"flex",gap:8,flexWrap:"wrap"}}>
          {(room?.players||[]).map(p=> <span key={p.name} style={{padding:".3rem .6rem",borderRadius:999,background:p.suspect?"rgba(255,0,0,.22)":"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)",fontSize:12,opacity:p.suspect?.6:1 as never}}>{p.name} {p.ready?"✓":""} {p.suspect?"🤖":""} score:{Math.round(p.score)}</span>)}
        </div>
        {suspect && <div style={{marginTop:8,color:"#ff6b6b",fontWeight:800}}>братуха, ты робот? 🌋 throttle 30/сек</div>}
      </div>
      <div className={styles.card}>
        <strong>Сезон 7дн duel42</strong>
        <div style={{marginTop:8,display:"grid",gap:6}}>
          {lb.length===0? <span style={{color:"rgba(255,255,255,.45)",fontSize:13}}>Пока пусто — стань первым!</span> : lb.slice(0,8).map((r,i)=>
            <div key={r.player+i} className={styles.leaderRow} style={i<3?{borderColor:"#ff4500",boxShadow:"0 0 0 1px rgba(255,69,0,.22), 0 0 18px rgba(255,69,0,.18)",background:"linear-gradient(90deg, rgba(255,69,0,.12), transparent)"}:undefined}>
              <span style={{display:"inline-flex",alignItems:"center",gap:6,minWidth:0}}>#{i+1} <CosmeticIdentity username={r.player} avatar={r.avatar} frame={r.frame} title={r.title} size={20} /> {i<3?<span className={styles.crown}>👑</span>:null}</span><b>{Math.round(r.score)}</b>
            </div>
          )}
        </div>
        <div style={{marginTop:10,fontSize:12,color:"rgba(255,255,255,.55)"}}>Топ-3 +1420 + magma-crown-42 • ELO: {elo ?? "—"} {elo!=null && elo>=1420? "🔥":""}</div>
        <div style={{marginTop:8,display:"flex",gap:8}}><a href="/magnum/presave-rating" style={{fontSize:12,color:"#ffcc00"}}>Рейтинг →</a><a href="/magnum/games" style={{fontSize:12,color:"rgba(255,255,255,.6)"}}>Все игры</a></div>
      </div>
    </div>

    <div ref={stageRef} className={styles.stage} style={overheat?{boxShadow:"0 0 0 2px #ff0000, 0 0 28px rgba(255,0,0,.6)"}:undefined}>
      <div ref={lavaRef} className={styles.lavaFill} />
      <div style={{textAlign:"center",zIndex:2}}>
        <div style={{fontSize:12,letterSpacing:".12em",color:"rgba(255,255,255,.6)",fontWeight:800}}>MAGMA x{magma} {magma>=10?"🔥 LAVA-SPIKE 2x":""}{overheat?" • OVERHEAT -60%":""}</div>
        <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:8}}>
          <div style={{width:220}}>
            <div className={styles.magmaBar}><div ref={magmaRef as never} className={styles.magmaFill} style={{width:`${(magma/10)*100}%`}}/></div>
            <div className={styles.ghostBar}><div ref={ghostRef as never} className={styles.ghostFill} style={{width:`${(oppMagma/10)*100}%`}}/></div>
            <div style={{fontSize:10,color:"rgba(255,255,255,.45)",textAlign:"left",marginTop:2}}>ghost соперника {oppMagma}/10</div>
          </div>
        </div>
        <button data-magma-btn onClick={onMagmaClick} className={styles.clickBtn} style={overheat?{filter:"grayscale(1) brightness(.6)",cursor:"not-allowed"}:undefined}>ЖАТЬ! {Math.round(score)}</button>
        <div style={{marginTop:8,color:"rgba(255,255,255,.6)",fontSize:12}}>10с • жми &lt;0.15с для цепочки</div>
      </div>
    </div>
    <div style={{textAlign:"center",marginTop:12}}><a href="/magnum" style={{color:"rgba(255,255,255,.55)",fontSize:13}}>← На главную</a></div>
  </div>;
}
export const DuelMagmaGame = DuelMagma;
