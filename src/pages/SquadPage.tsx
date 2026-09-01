import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import styles from "./SquadPage.module.css";
import { SquadFeed } from "../components/SquadFeed";

type Squad = { id:number; code:string; pot:number; mult:number; label:string; leaderId:number; created_at?:string };
type Member = { userId:number; username:string; joined_at?:string };
type Battle = { id:number; winnerId:number|null; winner?:string; score:any; created_at:string };

function squadWsUrl():string{
  const proto=location.protocol==="https:"?"wss:":"ws:";
  return `${proto}//${location.host}/magnum/api/squad`;
}

export function SquadPage(){
  const [squad,setSquad]=useState<Squad|null>(null);
  const [members,setMembers]=useState<Member[]>([]);
  const [battles,setBattles]=useState<Battle[]>([]);
  const [codeInput,setCodeInput]=useState("");
  const [msg,setMsg]=useState<string|null>(null);
  const [potPulse,setPotPulse]=useState(false);
  // WS duel
  const [room,setRoom]=useState<any>(null);
  const [score,setScore]=useState(0);
  const [clicks,setClicks]=useState(0);
  const wsRef=useRef<WebSocket|null>(null);
  const pageRef=useRef<HTMLDivElement>(null);
  const potRef=useRef<HTMLDivElement>(null);
  const feedRef=useRef<HTMLDivElement>(null);

  const fetchMy=useCallback(async()=>{
    try{
      const r=await fetch("/magnum/api/squad/my",{credentials:"include"});
      if(!r.ok){ setSquad(null); setMembers([]); return; }
      const j=await r.json();
      if(j.squad){ setSquad(j.squad); setMembers(j.members||[]); setBattles(j.battles||[]); }
      else { setSquad(null); setMembers([]); }
    }catch{}
  },[]);
  const fetchBattles=useCallback(async()=>{
    try{ const r=await fetch("/magnum/api/squad/battles",{credentials:"include"}); if(r.ok){ const j=await r.json(); setBattles(j.battles||[]);} }catch{}
  },[]);

  useEffect(()=>{ fetchMy(); fetchBattles(); },[fetchMy,fetchBattles]);

  // GSAP stagger y18 0.08
  useEffect(()=>{
    if(!pageRef.current) return;
    const prefers=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx=gsap.context(()=>{
      const cards=pageRef.current!.querySelectorAll(`.${styles.card}`);
      if(prefers){ gsap.set(cards,{y:0,opacity:1}); return; }
      gsap.set(cards,{y:18,opacity:0});
      gsap.to(cards,{y:0,opacity:1,stagger:0.08,duration:0.45,ease:"power2.out",overwrite:true});
    },pageRef);
    return()=>ctx.revert();
  },[squad]);

  // pot pulse 1.08 1s when pot changes
  useEffect(()=>{
    if(!potRef.current) return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx=gsap.context(()=>{
      if(potPulse){
        gsap.fromTo(potRef.current,{scale:1},{scale:1.08,duration:0.5,yoyo:true,repeat:1,ease:"power2.out",onComplete:()=>setPotPulse(false)});
      }
    });
    return()=>ctx.revert();
  },[potPulse]);

  // WS connect if squad
  useEffect(()=>{
    if(!squad) return;
    let ws:WebSocket;
    try{ ws=new WebSocket(squadWsUrl()); }catch{ return; }
    wsRef.current=ws;
    ws.onopen=()=>{};
    ws.onmessage=(e)=>{
      try{
        const m=JSON.parse(String(e.data));
        if(m.type==="room"||m.type==="scores") setRoom(m.room);
        if(m.type==="start"){ setRoom(m.room); setScore(0); setClicks(0); setMsg("GO! 10с жми!"); }
        if(m.type==="tick"){ if(m.from) setRoom((r:any)=>r?{...r,players:r.players}:r); }
        if(m.type==="finish"){ setRoom(m.room); setMsg(`Победитель ${m.room?.players?.reduce((a:any,b:any)=>a.score>b.score?a:b)?.name||""} +42 ELO +10% котла`); spawnConfetti120(); fetchMy(); fetchBattles(); }
        if(m.type==="suspect") setMsg("подозрительный клик — замедляем");
      }catch{}
    };
    ws.onclose=()=>{};
    return()=>{ try{ws.close();}catch{}; wsRef.current=null; };
  },[squad,fetchMy,fetchBattles]);

  function spawnConfetti120(){
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors=["#ff2d55","#ffcc00","#00ffcc","#fff","#7a1ecb"];
    const c=document.createElement("canvas"); c.width=innerWidth; c.height=innerHeight; Object.assign(c.style,{position:"fixed",inset:"0",pointerEvents:"none",zIndex:"500"}); document.body.appendChild(c);
    const ctx=c.getContext("2d")!; type P={x:number;y:number;vx:number;vy:number;life:number;c:string}; const ps:P[]=Array.from({length:120},()=>({x:innerWidth/2,y:innerHeight*0.35,vx:(Math.random()-0.5)*12,vy:-4-Math.random()*8,life:1,c:colors[Math.floor(Math.random()*colors.length)]!}));
    const draw=()=>{ ctx.clearRect(0,0,c.width,c.height); let alive=0; for(const p of ps){ p.x+=p.vx; p.y+=p.vy; p.vy+=0.35; p.vx*=0.99; p.life-=0.012; if(p.life>0) alive++; ctx.globalAlpha=Math.max(0,p.life); ctx.fillStyle=p.c; ctx.fillRect(p.x,p.y,5,5);} if(alive>0) requestAnimationFrame(draw); else c.remove(); }; requestAnimationFrame(draw);
  }

  const createSquad=async()=>{
    const r=await fetch("/magnum/api/squad/create",{method:"POST",credentials:"include"});
    const j=await r.json().catch(()=>({}));
    if(!r.ok){ setMsg(j.error||"ошибка"); return; }
    setMsg(`Батальон ${j.squad.code} создан!`);
    fetchMy();
  };
  const joinSquad=async()=>{
    const code=codeInput.trim().toUpperCase();
    if(code.length<4){ setMsg("Код B42-XXXX"); return; }
    const r=await fetch("/magnum/api/squad/join",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({code})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok){ setMsg(j.error||"ошибка"); return; }
    setMsg(`Вступил в ${j.squad.code} +42 обоим!`);
    fetchMy();
  };
  const contribute=async(amount:number)=>{
    const r=await fetch("/magnum/api/squad/pot",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({amount})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok){ setMsg(j.error||"ошибка"); return; }
    setPotPulse(true);
    setSquad(s=> s?{...s,pot:j.pot,mult:j.mult,label:j.label}:s);
    setMsg(`+${amount} в котёл → ${j.label}`);
  };

  const onSquadClick=()=>{
    if(room?.state!=="playing") return;
    setScore(s=>s+1); setClicks(c=>c+1);
    try{ wsRef.current?.send(JSON.stringify({type:"click"})); }catch{}
    const btn=document.querySelector<HTMLElement>(`[data-squad-btn]`);
    if(btn && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
      gsap.fromTo(btn,{scale:1},{scale:1.08,duration:0.08,yoyo:true,repeat:1});
    }
  };
  const startSquadDuel=()=>{
    try{ wsRef.current?.send(JSON.stringify({type:"start"})); }catch{}
  };

  // OG 1080x1080 share
  const shareSquad=async()=>{
    const cvs=document.createElement("canvas"); cvs.width=1080; cvs.height=1080;
    const ctx=cvs.getContext("2d")!;
    // bg
    const g=ctx.createLinearGradient(0,0,1080,1080); g.addColorStop(0,"#0a0a0f"); g.addColorStop(1,"#1a0a2a"); ctx.fillStyle=g; ctx.fillRect(0,0,1080,1080);
    ctx.fillStyle="#ff2d55"; ctx.font="900 84px sans-serif"; ctx.textAlign="center"; ctx.fillText("БАТАЛЬОН 42",540,180);
    ctx.fillStyle="#fff"; ctx.font="700 56px sans-serif"; ctx.fillText(squad? squad.code : "B42-XXXX",540,280);
    ctx.fillStyle="rgba(255,255,255,.7)"; ctx.font="400 34px sans-serif"; ctx.fillText(`Котёл ${squad?.pot||0} · ${squad?.label||"x1.0"} · ${members.length}/5`,540,350);
    // members
    ctx.font="600 30px sans-serif"; members.forEach((m,i)=>{ ctx.fillStyle="#ffcc00"; ctx.fillText(`${i+1}. ${m.username}`,540,460+i*46); });
    ctx.fillStyle="rgba(255,255,255,.55)"; ctx.font="500 28px sans-serif"; ctx.fillText("magnum.thefence.me/magnum/squad",540,980);
    ctx.fillStyle="#ff2d55"; ctx.font="900 36px sans-serif"; ctx.fillText("42 — кринжа не существует",540,1020);
    const blob:Blob|null=await new Promise(res=>cvs.toBlob(r=>res(r),"image/png"));
    if(!blob) return;
    const file=new File([blob],"batalion-42.png",{type:"image/png"});
    const text=`Батальон ${squad?.code||"42"} — вступай по коду! Котёл ${squad?.pot||0} ${squad?.label||""}`;
    try{
      if(navigator.canShare && navigator.canShare({files:[file]})){
        await navigator.share({title:"БАТАЛЬОН 42",text,files:[file]});
      } else if(navigator.share){
        await navigator.share({title:"БАТАЛЬОН 42",text,url:location.href});
      } else {
        const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="batalion-42-1080.png"; a.click(); URL.revokeObjectURL(url);
      }
    }catch{}
    spawnConfetti120();
  };

  // replay clicks/sec: compute from last battle score JSON if available — show placeholder
  if(!squad){
    return <div className={styles.page} ref={pageRef}>
      <div className={styles.header}><div className={styles.badge}>⚡ БАТАЛЬОН 42</div><h1 className={styles.title}>Сквады 5 · котёл · лента битв</h1><p style={{color:"rgba(255,255,255,.6)"}}>2-5 братух · взносы 42/142/420 → x1.2/x1.5/x2.0 · дуэль 10с · инвайт +42 обоим</p></div>
      <div className={styles.card}><strong>Создать батальон</strong><button onClick={createSquad} className={styles.primaryBtn}>Создать B42-код</button></div>
      <div className={styles.card}><strong>Вступить по коду</strong><div style={{display:"flex",gap:8,marginTop:8}}><input value={codeInput} onChange={e=>setCodeInput(e.target.value.toUpperCase())} placeholder="B42-XXXX" maxLength={8} className={styles.input}/><button onClick={joinSquad} className={styles.secondaryBtn}>Join</button></div></div>
      {msg && <div className={styles.toast}>{msg}</div>}
    </div>;
  }

  return <div className={styles.page} ref={pageRef}>
    <div className={styles.header}><div className={styles.badge}>⚡ БАТАЛЬОН 42 — {squad.code}</div><h1 className={styles.title}>Батальон {squad.code} · {members.length}/5</h1></div>

    <div className={styles.grid}>
      <div className={styles.card}>
        <strong>Сквад 5 слотов</strong>
        <div className={styles.slots}>
          {Array.from({length:5}).map((_,i)=>{
            const m=members[i];
            return <div key={i} className={`${styles.slot} ${m?styles.slotFilled:styles.slotEmpty}`}>{m? m.username : `— слот ${i+1}`}</div>;
          })}
        </div>
        <div style={{marginTop:10,display:"flex",gap:8,flexWrap:"wrap"}}>
          <input value={codeInput} onChange={e=>setCodeInput(e.target.value.toUpperCase())} placeholder="B42-XXXX для инвайта" maxLength={8} className={styles.input} style={{flex:1}}/>
          <button onClick={joinSquad} className={styles.secondaryBtn}>Инвайт</button>
        </div>
      </div>

      <div className={styles.card} ref={potRef as any}>
        <strong>Общий котёл</strong>
        <div className={styles.pot}>{squad.pot} <span className={styles.mult}>{squad.label}</span></div>
        <div className={styles.potHint}>x1.2 от 42 · x1.5 от 142 · x2.0 от 420 — множит доход конвейера/майнинга</div>
        <div style={{display:"flex",gap:8,marginTop:10}}>
          {[42,142,420].map(v=><button key={v} onClick={()=>contribute(v)} className={styles.potBtn}>+{v}</button>)}
        </div>
      </div>
    </div>

    <div className={styles.card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
        <strong>Вызвать батальон — дуэль 10с внутри сквада</strong>
        <button onClick={shareSquad} className={styles.shareBtn}>Вызвать батальон · шаринг OG 1080</button>
      </div>
      <div style={{marginTop:10,color:"rgba(255,255,255,.6)",fontSize:13}}>Комната: <b style={{color:"#ffcc00"}}>{room?.id?.replace("squad:","B42-")||squad.code}</b> · {room?.state||"waiting"} · {room?.players?.length||members.length}/5 · ELO +42 + котёл 10%</div>
      {room?.state==="waiting" && <button onClick={startSquadDuel} className={styles.primaryBtn}>Старт 10с дуэль</button>}
      {room?.state==="playing" && <><button data-squad-btn onClick={onSquadClick} className={styles.clickBtn}>ЖАТЬ! {score} · {clicks} кликов</button><div style={{fontSize:12,color:"rgba(255,255,255,.55)",marginTop:6}}>Реплей: {(clicks/10).toFixed(1)} клик/сек · жми быстро</div></>}
      {msg && <div className={styles.toast}>{msg}</div>}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
        {(room?.players||[]).map((p:any)=><span key={p.name} className={styles.playerTag}>{p.name} {p.score?Math.round(p.score):score} {p.suspect?"🤖":""}</span>)}
      </div>
    </div>

    <div ref={feedRef}><SquadFeed battles={battles} onShare={shareSquad} /></div>

    <div style={{textAlign:"center",marginTop:12}}><a href="/magnum" style={{color:"rgba(255,255,255,.55)",fontSize:13}}>← На главную</a></div>
  </div>;
}
