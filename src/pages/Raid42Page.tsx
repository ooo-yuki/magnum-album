import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { subscribeMe, type MeUser } from "../lib/authMe";
import { getCoins, addCoins } from "../lib/coins";
import { RAID_HP, REWARDS } from "../lib/raid42";
import { AuthStatus } from "../components/AuthStatus";

type Boss = { id:number|null; hp_max:number; hp_cur:number; status:string; remain:number; nextStart:string; starts_at:string; ends_at:string };
type Top = { rank:number; userId:number; username:string; dmg:number };

export function Raid42Page(){
  const [me,setMe]=useState<MeUser>(null);
  useEffect(()=>subscribeMe(setMe as any),[]);
  const [boss,setBoss]=useState<Boss|null>(null);
  const [top,setTop]=useState<Top[]>([]);
  const [myDmg,setMyDmg]=useState(0);
  const [myRank,setMyRank]=useState<number|null>(null);
  const [msg,setMsg]=useState<string|null>(null);
  const [boosted,setBoosted]=useState(false);
  const [suspect,setSuspect]=useState(false);
  const [lastDmg,setLastDmg]=useState<number|null>(null);
  const [crit,setCrit]=useState(false);
  const [finished,setFinished]=useState<{top:Top[]}|null>(null);
  const wsRef=useRef<WebSocket|null>(null);
  const pageRef=useRef<HTMLDivElement>(null);
  const bossRef=useRef<HTMLDivElement>(null);
  const hpRef=useRef<HTMLDivElement>(null);
  const critRef=useRef<HTMLDivElement>(null);

  const fetchStatus=useCallback(async()=>{
    try{
      const r=await fetch("/magnum/api/raid/status",{credentials:"include"});
      if(r.ok){
        const j=await r.json();
        if(j.boss) setBoss(j.boss);
        if(j.top) setTop(j.top);
        if(typeof j.myDmg==="number") setMyDmg(j.myDmg);
        if(j.myRank) setMyRank(j.myRank);
      }
    }catch{}
  },[]);
  useEffect(()=>{ fetchStatus(); const id=setInterval(fetchStatus,5000); return()=>clearInterval(id); },[fetchStatus]);

  // GSAP entry y24 stagger
  useEffect(()=>{
    if(!pageRef.current) return;
    const prefers=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx=gsap.context(()=>{
      const cards=pageRef.current!.querySelectorAll("[data-raid-card]");
      if(prefers){ gsap.set(cards,{y:0,opacity:1,clearProps:"transform"}); return; }
      gsap.set(cards,{y:24,opacity:0});
      gsap.to(cards,{y:0,opacity:1,stagger:0.12,duration:0.55,ease:"power2.out"});
    },pageRef);
    return()=>ctx.revert();
  },[boss?.id]);

  // HP bar 0.4s power3
  useEffect(()=>{
    if(!hpRef.current || !boss) return;
    const pct=Math.max(0, Math.min(100, (boss.hp_cur / (boss.hp_max||RAID_HP))*100));
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){
      hpRef.current.style.width=pct+"%";
      return;
    }
    gsap.to(hpRef.current,{width:pct+"%", duration:0.4, ease:"power3.out", overwrite:true});
  },[boss?.hp_cur, boss?.hp_max]);

  // WS /magnum/api/raid heartbeat 25s
  useEffect(()=>{
    if(!me) return;
    const proto=location.protocol==="https:"?"wss:":"ws:";
    const ws=new WebSocket(`${proto}//${location.host}/magnum/api/raid`);
    wsRef.current=ws;
    let hb:number|null=null;
    ws.onopen=()=>{
      hb=window.setInterval(()=>{ try{ ws.send(JSON.stringify({type:"ping"})); }catch{} },25000);
    };
    ws.onclose=()=>{ if(hb) clearInterval(hb); };
    ws.onerror=()=>{};
    ws.onmessage=(ev)=>{
      try{
        const m=JSON.parse(String(ev.data));
        if(m.type==="pong"||m.type==="ping"){ if(m.type==="ping") try{ws.send(JSON.stringify({type:"pong"}));}catch{} return; }
        if(m.boss) setBoss(m.boss);
        if(m.type==="raid:status" && m.boss){ setBoss(m.boss); if(m.top) setTop(m.top); }
        if(m.type==="raid:hp" && m.boss){ setBoss(m.boss); if(m.top) setTop(m.top); }
        if(m.type==="raid:hit"){
          if(m.hp_cur!=null) setBoss(b=> b? {...b, hp_cur:Number(m.hp_cur), hp_max: Number(m.hp_max||b.hp_max)}:b);
          if(m.top) setTop(m.top);
          if(m.from && m.dmg!=null){
            // shake boss x±8
            if(bossRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
              gsap.fromTo(bossRef.current,{x:-8},{x:8,duration:0.08,yoyo:true,repeat:1,ease:"power1.inOut",clearProps:"x"});
            }
            if(Number(m.userId)===me?.id){
              setMyDmg(prev=> prev + Number(m.dmg));
              setLastDmg(Number(m.dmg));
              setCrit(Boolean(m.crit));
              if(m.crit && critRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
                gsap.fromTo(critRef.current,{scale:0,y:-16,opacity:0},{scale:1.6,opacity:1,duration:0.22,ease:"back.out(1.6)",onComplete:()=> gsap.to(critRef.current!,{scale:1,duration:0.12})});
              }
            }
          }
        }
        if(m.type==="raid:ack"){
          setMyDmg(typeof m.myDmg==="number"? m.myDmg : myDmg + (typeof m.dmg==="number"? m.dmg:0));
        }
        if(m.type==="raid:suspect"){
          setSuspect(true); setMsg(m.toast||"CPS>20 suspect — снижай темп 👻");
          setTimeout(()=>setSuspect(false),2000);
        }
        if(m.type==="raid:finish"){
          if(m.boss) setBoss(m.boss);
          if(m.top) { setTop(m.top); setFinished({top:m.top}); setMsg(`Рейд окончен! HP ${m.boss?.hp_cur ?? 0} • награды: MVP +1420 топ-3 +420 топ-10 +142 участие +42`); spawnConfetti140(); }
          // refresh coins
          void fetch("/magnum/api/coins",{credentials:"include"}).then(r=>r.json()).then(j=>{ const v=j.balance??j.coins; if(typeof v==="number") addCoins(v-getCoins()); }).catch(()=>{});
        }
        if(m.type==="raid:start" && m.boss){ setBoss(m.boss); setFinished(null); setMsg("Рейд старт! 42с бей босса ⚔️"); }
      }catch{}
    };
    return()=>{ try{ ws.close(); }catch{}; if(hb) clearInterval(hb); wsRef.current=null; };
  },[me]);

  function spawnConfetti140(){
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors=["#ff2d55","#ffcc00","#00ff88","#5865f2","#ff44cc"];
    const root=document.body;
    for(let i=0;i<140;i++){
      const d=document.createElement("div");
      d.style.position="fixed"; d.style.left="50%"; d.style.top="42%"; d.style.width="6px"; d.style.height="10px"; d.style.borderRadius="1px";
      d.style.background=colors[i%colors.length]!; d.style.pointerEvents="none"; d.style.zIndex="999";
      root.appendChild(d);
      const ang=Math.random()*Math.PI*2; const dist=40+Math.random()*260;
      gsap.fromTo(d,{x:0,y:0,rotation:0,opacity:1},{x:Math.cos(ang)*dist, y:Math.sin(ang)*dist + 60 + (i%7)*14*0.06, rotation: Math.random()*720, opacity:0, duration:0.9+Math.random()*0.6, ease:"power2.out", delay: (i%14)*0.06*0.2, onComplete:()=>d.remove()});
    }
  }

  const onHit=useCallback(async()=>{
    if(!me){ setMsg("Войди, братуха — рейд только для залогиненных"); window.dispatchEvent(new CustomEvent("magnum:need-auth")); return; }
    if(boss?.status!=="active"){ setMsg(boss?.status==="waiting" ? "Рейд ещё не стартовал — жди слота 15м" : "Рейд окончен — жди следующий 15м"); return; }
    // optimistic WS first
    try{ wsRef.current?.send(JSON.stringify({type:"hit"})); }catch{}
    // fallback HTTP if WS not connected
    if(!wsRef.current || wsRef.current.readyState!==WebSocket.OPEN){
      try{
        const r=await fetch("/magnum/api/raid/hit",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({})});
        if(r.status===429){ setSuspect(true); setMsg("throttle 30/с — снижай темп"); setTimeout(()=>setSuspect(false),1500); return; }
        if(!r.ok){ const j=await r.json().catch(()=>({error:String(r.status)})); setMsg(j.error||"hit failed"); return; }
        const j=await r.json();
        if(typeof j.hp_cur==="number") setBoss(b=> b? {...b, hp_cur:j.hp_cur}:b);
        if(j.top) setTop(j.top);
        setLastDmg(j.dmg??null); setCrit(Boolean(j.crit)); setMyDmg(j.myDmg ?? (myDmg + (j.dmg||0)));
        if(j.crit && critRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
          gsap.fromTo(critRef.current,{scale:0,y:-16,opacity:0},{scale:1.6,opacity:1,duration:0.22,ease:"back.out(1.6)",onComplete:()=> gsap.to(critRef.current!,{scale:1,duration:0.12})});
        }
        if(bossRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
          gsap.fromTo(bossRef.current,{x:-8},{x:8,duration:0.08,yoyo:true,repeat:1,ease:"power1.inOut",clearProps:"x"});
        }
      }catch{ setMsg("hit error"); }
    } else {
      // local shake already via ws hit ack
      if(bossRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
        // duplicate small? ws will shake, but add slight nudge
      }
    }
  },[me,boss?.status,myDmg]);

  const buyBoost=useCallback(async()=>{
    if(!me){ setMsg("Войди, братуха"); window.dispatchEvent(new CustomEvent("magnum:need-auth")); return; }
    if(boosted){ setMsg("Буст уже активен x2 до конца рейда"); return; }
    const bal=getCoins(); if(bal<42){ setMsg(`Нужно 42 монеты, у тебя ${bal}`); return; }
    try{
      const r=await fetch("/magnum/api/raid/boost",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({})});
      if(!r.ok){ const j=await r.json().catch(()=>({error:String(r.status)})); setMsg(j.error||"boost failed"); return; }
      const j=await r.json(); if(typeof j.balance==="number") addCoins(j.balance-getCoins());
      setBoosted(true); setMsg("Буст x2 активен до конца рейда 🔥");
    }catch{ setMsg("boost error"); }
  },[me,boosted]);

  const pct=boss? Math.max(0, Math.min(100, (boss.hp_cur/(boss.hp_max||RAID_HP))*100)):100;
  const remain=boss?.remain ?? 0;
  const isActive=boss?.status==="active";
  const isWaiting=boss?.status==="waiting";

  return <div ref={pageRef} style={{maxWidth:980, margin:"0 auto", padding:"18px 14px 40px"}}>
    <div style={{fontWeight:900,fontSize:22,letterSpacing:.3}}>БОСС-РЕЙД 42 <span style={{opacity:.6,fontWeight:600,fontSize:13}}>· глобальный 42с HP 42K · каждые 15м</span></div>
    <p style={{opacity:.7,fontSize:13,marginTop:6}}>Все онлайн бьют одного босса 42с · урон 1-42/клик крит x2 5% · буст x2 за 42 · CPS&gt;20 suspect throttle 30/с · WS /magnum/api/raid heartbeat 25с · награды +42 / +142 топ-10 / +420 топ-3 / +1420 MVP + титул Крушитель 42 · GSAP shake x±8 HP-bar 0.4s power3 крит burst 1.6 back.out confetti 140</p>
    {!me && <div style={{marginTop:12,padding:"12px 14px",borderRadius:12,background:"rgba(255,45,85,.10)",border:"1px solid rgba(255,45,85,.28)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><span style={{color:"#ff2d55",fontWeight:900}}>Войди, братуха — рейд только для залогиненных</span><span style={{display:"inline-flex"}}><AuthStatus/></span><button onClick={()=>window.dispatchEvent(new CustomEvent("magnum:need-auth"))} style={{padding:".5rem .9rem",borderRadius:999,background:"#ff2d55",color:"#fff",fontWeight:900,border:"none",cursor:"pointer"}}>Войти</button></div>}
    {msg && <div role="status" style={{marginTop:10,padding:"8px 12px",borderRadius:10,background:"rgba(255,204,0,.11)",border:"1px solid rgba(255,204,0,.22)",color:"#ffcc00",fontSize:13,fontWeight:700}}>{msg}</div>}
    {suspect && <div style={{marginTop:8,color:"#ff6b6b",fontWeight:800,fontSize:13}}>братуха, CPS&gt;20 suspect — снижай до 20/с ⏳ throttle 30/с</div>}
    <div style={{display:"grid",gap:12,marginTop:14}}>
      <div data-raid-card style={{position:"relative",overflow:"hidden",border:"1px solid rgba(255,255,255,.10)",borderRadius:16,padding:16,background:"rgba(255,255,255,.02)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <div style={{fontWeight:900}}>БОСС {RAID_HP.toLocaleString()} HP <span style={{opacity:.6,fontWeight:600,fontSize:12,marginLeft:8}}>{boss? `${boss.status} ${isActive? `· ${remain}с`: isWaiting? `· до старта ${new Date(boss.nextStart).toLocaleTimeString()}`:""}` : "загрузка…"}</span></div>
          <div style={{fontSize:12,opacity:.7}}>Таймер 42с · буст x2 за 42 {boosted? "· 🔥 активен":""}</div>
        </div>
        <div ref={bossRef} style={{marginTop:14,display:"grid",placeItems:"center",padding:"18px 0 10px",background:"radial-gradient(600px 200px at 50% 0%, rgba(255,45,85,.18), transparent)",borderRadius:12,border:"1px solid rgba(255,255,255,.06)"}}>
          <div style={{fontSize:52,lineHeight:1}}>👹</div>
          <div style={{fontWeight:900,letterSpacing:.4,marginTop:6}}>{boss? `${boss.hp_cur.toLocaleString()} / ${boss.hp_max.toLocaleString()}` : "—"} <span style={{opacity:.6,fontWeight:600,fontSize:13}}>{pct.toFixed(1)}%</span></div>
          <div style={{width:"100%",maxWidth:560,height:14,borderRadius:999,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.12)",overflow:"hidden",marginTop:10}}>
            <div ref={hpRef} style={{height:"100%",width:pct+"%",background:"linear-gradient(90deg,#ff2d55,#ffcc00)",boxShadow:"0 0 12px rgba(255,45,85,.35)"}}/>
          </div>
          <div style={{marginTop:8,fontSize:12,opacity:.6}}>HP-bar width 0.4s power3 · shake x±8 при ударе · крит burst 1.6 back.out</div>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center",justifyContent:"center",marginTop:14,flexWrap:"wrap"}}>
          <button onClick={onHit} disabled={!me || !isActive} style={{padding:"14px 28px",borderRadius:12,background: !me||!isActive? "rgba(255,255,255,.08)":"#ff2d55", color: !me||!isActive? "rgba(255,255,255,.45)":"#fff", fontWeight:900,border:"none",cursor: !me||!isActive? "not-allowed":"pointer", boxShadow: isActive? "0 0 14px rgba(255,45,85,.35)":"none",opacity: !me||!isActive?0.7:1}}>УДАР ⚔️</button>
          <button onClick={buyBoost} disabled={!me || boosted} style={{padding:"10px 14px",borderRadius:999,background: boosted? "rgba(0,255,136,.14)":"rgba(255,204,0,.12)",color: boosted? "#00ff88":"#ffcc00",fontWeight:800,border:"1px solid rgba(255,204,0,.22)",cursor: !me||boosted? "not-allowed":"pointer",opacity: !me?0.6:1}}>{boosted? "x2 активен ✓":"Буст x2 — 42"}</button>
          <span ref={critRef} style={{minWidth:72,textAlign:"center",padding:"6px 10px",borderRadius:999,background: crit? "rgba(255,45,85,.18)":"rgba(255,255,255,.06)",border:"1px solid rgba(255,45,85,.22)",fontWeight:900,color: crit? "#ff2d55":"rgba(255,255,255,.5)",fontSize:13}}>{lastDmg!=null? `${crit? "КРИТ x2 ":""}+${lastDmg}`:"—"}</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:12,fontSize:13}}>
          <span style={{opacity:.7}}>Твой урон: <b style={{color:"#ffcc00"}}>{myDmg}</b> {myRank? `· #${myRank}`:""}</span>
          <span style={{opacity:.6}}>Награды: +42 участие · топ-10 +142 · топ-3 +420 · MVP +1420 + титул Крушитель 42</span>
        </div>
      </div>

      <div data-raid-card style={{border:"1px solid rgba(255,255,255,.10)",borderRadius:14,padding:14,background:"rgba(255,255,255,.02)"}}>
        <div style={{fontWeight:800,marginBottom:8}}>Топ-5 вкладчиков live</div>
        {top.length===0? <div style={{opacity:.6,fontSize:13}}>Пока пусто — бей первым!</div> : top.map(t=>(
          <div key={t.userId} style={{display:"flex",justifyContent:"space-between",padding:"8px 10px",borderRadius:10,background: t.rank===1? "conic-gradient(from 0deg,#ffcc00,#ff2d55,#ffcc00)": t.rank<=3? "rgba(255,204,0,.08)":"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",marginBottom:6,boxShadow: t.rank===1? "0 0 12px rgba(255,204,0,.22)":"none"}}>
            <span>#{t.rank} {t.username} {t.rank===1? "👑 MVP":""}</span><b>{t.dmg.toLocaleString()}</b>
          </div>
        ))}
        <div style={{marginTop:8,fontSize:12,opacity:.55}}>Награды по вкладу: участие +42 топ-10 +142 топ-3 +420 MVP +1420 + титул Крушитель 42 · <a href="/magnum/api/raid/top" style={{color:"#ffcc00"}}>top JSON</a> · WS /magnum/api/raid heartbeat 25с</div>
        {finished && <div style={{marginTop:10,padding:"10px 12px",borderRadius:10,background:"rgba(0,255,136,.08)",border:"1px solid rgba(0,255,136,.14)",color:"#7cff7c",fontWeight:800}}>Рейд завершён — награды начислены в монеты + leaderboard raid42 + титул MVP. Жди следующий слот 15м.</div>}
      </div>

      <div data-raid-card style={{fontSize:11,opacity:.55,border:"1px solid rgba(255,255,255,.06)",borderRadius:10,padding:10,background:"rgba(255,255,255,.02)"}}>
        Протокол: <code>WS /magnum/api/raid</code> {"{type:'hit'}"} → <code>{"{type:'raid:hit' crit boost hp_cur top}"}</code> + heartbeat 25с · HTTP: <code>GET /magnum/api/raid/status</code> <code>POST /magnum/api/raid/hit</code> <code>POST /magnum/api/raid/boost</code> · урон 1-42 крит x2 5% буст x2 за 42 · CPS&gt;20 suspect throttle 30/с · Neon <code>magnum_raid_bosses(hp_max 42000)</code> <code>magnum_raid_hits</code> <code>magnum_leaderboard(game=raid42)</code> · GSAP boss shake x±8 HP 0.4s power3 burst 1.6 back.out confetti 140 stagger y14 0.06 · route <code>/magnum/raid</code>
      </div>
    </div>
  </div>;
}
