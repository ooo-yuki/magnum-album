import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";

type Pet = {
  stage: number; xp: number; hunger: number; happiness: number; energy: number;
  stageName: string; emoji: string; miningBonus: number; conveyorBonus?: number; buff?: string;
  thresholds: number[];
};
type PetGet = { ok:true; pet: Pet; balance:number; dust:number; offline:{hours:number;decay:number}; canClaimDaily:boolean; nextStageXp:number|null };

const STAGE_LABELS=["🥚 яйцо","🐛 личинка","🪼 медуза","🐉 титан"];

export function Pet42Page(){
  const [data,setData]=useState<PetGet|null>(null);
  const [loading,setLoading]=useState(true);
  const [toast,setToast]=useState<string|null>(null);
  const [busy,setBusy]=useState<string|null>(null);
  const petRef=useRef<HTMLDivElement>(null);
  const barsRef=useRef<HTMLDivElement>(null);
  const confettiRoot=useRef<HTMLDivElement>(null);
  const pageRef=useRef<HTMLDivElement>(null);

  const showToast=useCallback((m:string)=>{ setToast(m); setTimeout(()=>setToast(null),1700); },[]);

  const fetchPet=useCallback(async()=>{
    try{
      const r=await fetch("/magnum/api/pet",{credentials:"include"});
      if(r.status===401){ setLoading(false); return; }
      if(r.ok){ const j=await r.json() as PetGet; setData(j); }
    }catch{}
    finally{ setLoading(false); }
  },[]);
  useEffect(()=>{ fetchPet(); },[fetchPet]);

  // GSAP: яйцо pulse 1.08 1.2s + stagger y14 0.06 + шкалы width 0.4s power2
  useEffect(()=>{
    if(!pageRef.current) return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx=gsap.context(()=>{
      const cards=pageRef.current!.querySelectorAll<HTMLElement>("[data-stagger]");
      gsap.set(cards,{y:14,opacity:0});
      gsap.to(cards,{y:0,opacity:1,stagger:0.06,duration:0.45,ease:"power2.out",delay:0.08});
    },pageRef);
    return()=>ctx.revert();
  },[data]);

  // pulse for egg stage
  useEffect(()=>{
    if(!petRef.current) return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const stage=data?.pet.stage ?? 0;
    if(stage!==0) return;
    const ctx=gsap.context(()=>{
      gsap.to(petRef.current,{scale:1.08,duration:1.2,repeat:-1,yoyo:true,ease:"sine.inOut"});
    },petRef);
    return()=>ctx.revert();
  },[data?.pet.stage]);

  // bars width animation 0.4s power2
  useEffect(()=>{
    if(!barsRef.current) return;
    const prefersReduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fills=barsRef.current.querySelectorAll<HTMLElement>("[data-fill]");
    fills.forEach(el=>{
      const pct=Number(el.dataset.pct||0);
      if(prefersReduced){ el.style.width=`${pct}%`; return; }
      gsap.to(el,{width:`${pct}%`,duration:0.4,ease:"power2.out",overwrite:true});
    });
  },[data?.pet.hunger, data?.pet.happiness, data?.pet.energy]);

  const burst=useCallback(()=>{
    if(!petRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(petRef.current,{scale:0.6},{scale:1,duration:0.6,ease:"back.out(1.7)"});
    // confetti 120
    const root=confettiRoot.current ?? petRef.current.parentElement as HTMLElement;
    if(!root) return;
    for(let i=0;i<120;i++){
      const d=document.createElement("div");
      d.style.position="absolute"; d.style.left="50%"; d.style.top="42%";
      d.style.width="6px"; d.style.height="6px"; d.style.borderRadius="1px";
      d.style.background=i%3===0?"#ff2d55":i%3===1?"#00ff88":"#ffd42a";
      d.style.pointerEvents="none";
      root.appendChild(d);
      const ang=Math.random()*Math.PI*2, dist=50+Math.random()*160;
      gsap.to(d,{x:Math.cos(ang)*dist, y:Math.sin(ang)*dist+70, rotation:Math.random()*720, opacity:0,duration:0.9+Math.random()*0.5,ease:"power2.out",onComplete:()=>d.remove()});
    }
  },[]);

  const feed=async()=>{
    if(busy) return; setBusy("feed");
    try{
      const r=await fetch("/magnum/api/pet/feed",{method:"POST",credentials:"include"});
      const j=await r.json() as {ok?:boolean; error?:string; balance?:number; cost?:number; pet?:{evolved?:boolean; stage?:number}; xpGain?:number; required?:number};
      if(!r.ok){
        if(r.status===402) showToast(`Нужно ${j.required??42} монет`);
        else showToast(j.error||"Ошибка кормёжки");
        return;
      }
      if(j.pet?.evolved){ burst(); showToast(`Эволюция! Стадия ${STAGE_LABELS[j.pet.stage!]}`); }
      else showToast(`+${j.xpGain??42} XP · −${j.cost??42} 🪙`);
      if(petRef.current) gsap.fromTo(petRef.current,{scale:1},{scale:1.06,duration:0.18,yoyo:true,repeat:1,ease:"power2.inOut"});
      await fetchPet();
      window.dispatchEvent(new CustomEvent("magnum:coins:update"));
    }catch{ showToast("Сеть"); } finally{ setBusy(null); }
  };
  const play=async()=>{
    if(busy) return; setBusy("play");
    try{
      const r=await fetch("/magnum/api/pet/play",{method:"POST",credentials:"include"});
      const j=await r.json() as {ok?:boolean; error?:string; remainingMin?:number; pet?:{evolved?:boolean}};
      if(!r.ok){
        if(j.error==="cooldown") showToast(`Кулдаун ${j.remainingMin}м · играй позже`);
        else showToast(j.error||"Ошибка");
        return;
      }
      if(j.pet?.evolved) burst();
      showToast("+15 счастье · +24 XP");
      await fetchPet();
    }catch{ showToast("Сеть"); } finally{ setBusy(null); }
  };
  const sleep=async()=>{
    if(busy) return; setBusy("sleep");
    try{
      const r=await fetch("/magnum/api/pet/sleep",{method:"POST",credentials:"include"});
      const j=await r.json() as {ok?:boolean; error?:string; remainingMin?:number};
      if(!r.ok){
        if(j.error==="cooldown") showToast(`Сон кулдаун ${j.remainingMin}м · 4ч`);
        else showToast(j.error||"Ошибка");
        return;
      }
      showToast("+30 энергия · сон 4ч");
      if(petRef.current) gsap.fromTo(petRef.current,{rotation:-2},{rotation:2,duration:0.12,yoyo:true,repeat:3,ease:"sine.inOut"});
      await fetchPet();
    }catch{ showToast("Сеть"); } finally{ setBusy(null); }
  };
  const claim=async()=>{
    if(busy) return; setBusy("claim");
    try{
      const r=await fetch("/magnum/api/pet/claim",{method:"POST",credentials:"include"});
      const j=await r.json() as {ok?:boolean; reward?:number; epic?:boolean; error?:string};
      if(!r.ok){ showToast(j.error||"Уже забрано"); return; }
      showToast(j.epic?`EPIC яйцо-кейс +${j.reward} 🥚✨`:`+${j.reward} монет · daily`);
      burst();
      await fetchPet();
      window.dispatchEvent(new CustomEvent("magnum:coins:update"));
    }catch{ showToast("Сеть"); } finally{ setBusy(null); }
  };
  const prestige=async()=>{
    if(busy) return; setBusy("prestige");
    try{
      const r=await fetch("/magnum/api/pet/prestige",{method:"POST",credentials:"include"});
      const j=await r.json() as {ok?:boolean; error?:string; skin?:string; dust?:number};
      if(!r.ok){ showToast(j.error||"Нужно 1420 XP + 1420 dust"); return; }
      showToast(`Скин питомца ${j.skin} ✨ · dust ${j.dust}`);
      await fetchPet();
    }catch{ showToast("Сеть"); } finally{ setBusy(null); }
  };

  if(loading) return <div style={{padding:"48px 20px",maxWidth:980,margin:"0 auto",color:"#f2f2f2"}}>Загрузка питомца…</div>;
  if(!data) return <div style={{padding:"48px 20px",maxWidth:980,margin:"0 auto",color:"#f2f2f2"}}>Войди, братуха — питомец только для залогиненных. <a href="/magnum" style={{color:"#ff2d55"}}>/magnum</a></div>;

  const p=data.pet;
  const xpPct=(()=>{
    const nxt=data.nextStageXp;
    if(nxt==null) return 100;
    const curTh=p.thresholds[p.stage]??0;
    const range=nxt - curTh;
    const cur=p.xp - curTh;
    return Math.max(0,Math.min(100, Math.round(cur/range*100)));
  })();

  return <div ref={pageRef} style={{maxWidth:980,margin:"0 auto",padding:"48px 20px 80px",color:"#f2f2f2",fontFamily:"Inter,system-ui,sans-serif",position:"relative"}}>
    <h1 data-stagger style={{fontSize:28,fontWeight:900,letterSpacing:-0.02+'em'}}>ПИТОМЕЦ 42 — тамагочи-маскот MAGNUM</h1>
    <p data-stagger style={{opacity:.65,marginTop:6}}>яйцо → личинка 142 → медуза 420 → титан 1420 XP · корм 42/игра 0/сон 0 · offline тик −1/ч кап 24ч · бафф к майнингу/конвейеру</p>

    <div data-stagger style={{display:"grid",gridTemplateColumns:"1fr",gap:14,marginTop:18}}>
      <div style={{position:"relative",border:"1px solid #23232b",borderRadius:18,background:"linear-gradient(180deg,#141418,#0f0f13)",padding:18,overflow:"hidden"}}>
        <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          <div ref={petRef} style={{width:110,height:110,display:"grid",placeItems:"center",fontSize:62,borderRadius:16,background:"radial-gradient(300px 120px at 50% 0%,rgba(255,204,0,.14),transparent 70%),#121216",border:"1px solid #23232b"}}>
            {p.emoji}
          </div>
          <div style={{flex:1,minWidth:180}}>
            <div style={{fontWeight:900,fontSize:18,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>{p.stageName} <span style={{opacity:.6,fontSize:12,border:"1px solid #23232b",padding:"3px 8px",borderRadius:999}}>stage {p.stage}/3 · {p.xp} XP</span> {p.miningBonus? <span style={{fontSize:11,padding:"4px 8px",borderRadius:999,background:"rgba(255,204,0,.12)",border:"1px solid rgba(255,204,0,.32)",color:"#ffd42a"}}>бафф +{p.miningBonus}% mining{p.conveyorBonus?` · +${p.conveyorBonus}% conveyor`:``}</span>:null}</div>
            <div style={{opacity:.6,fontSize:12,marginTop:4}}>до титана {data.nextStageXp? `${data.nextStageXp - p.xp} XP` : "MAX"} · next {data.nextStageXp ?? "—"} · баланс {data.balance} 🪙 · dust {data.dust}</div>
            <div style={{height:8,background:"#23232b",borderRadius:999,overflow:"hidden",marginTop:8}}>
              <div style={{height:"100%",width:`${xpPct}%`,background:"linear-gradient(90deg,#ff2d55,#ffd42a)",transition:"width .4s ease"}} />
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
              <button onClick={feed} disabled={busy==="feed"} style={{padding:"10px 14px",borderRadius:12,border:"1px solid #ffd42a",background:"rgba(255,212,42,.12)",color:"#ffd42a",fontWeight:800,cursor:"pointer"}}>Корм 42 🪙 +20 голода</button>
              <button onClick={play} disabled={busy==="play"} style={{padding:"10px 14px",borderRadius:12,border:"1px solid #23232b",background:"#17171d",color:"#f2f2f2",fontWeight:700,cursor:"pointer"}}>Игра +15 счастье (30м)</button>
              <button onClick={sleep} disabled={busy==="sleep"} style={{padding:"10px 14px",borderRadius:12,border:"1px solid #23232b",background:"#17171d",color:"#f2f2f2",fontWeight:700,cursor:"pointer"}}>Сон +30 энергия (4ч)</button>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>
              <button onClick={claim} disabled={busy==="claim"} style={{padding:"10px 14px",borderRadius:12,border:"1px solid #00ff88",background: data.canClaimDaily ? "rgba(0,255,136,.14)" : "rgba(255,255,255,.04)",color: data.canClaimDaily ? "#00ff88" : "#6b7685",fontWeight:800,cursor:"pointer"}}>{p.stage>=3?`Яйцо-кейс ${42}-${142} · 5% epic`:`Daily`} +42 {data.canClaimDaily?"":"· уже"}</button>
              <button onClick={prestige} disabled={p.xp<1420 || data.dust<1420} title={p.xp<1420?`Нужно 1420 XP, сейчас ${p.xp}`: data.dust<1420?`Нужно 1420 dust, сейчас ${data.dust}`:"Престиж"} style={{padding:"10px 14px",borderRadius:12,border:"1px solid #23232b",background: (p.xp>=1420 && data.dust>=1420) ? "rgba(255,45,85,.12)" : "#111",color:(p.xp>=1420 && data.dust>=1420)?"#ff2d55":"#6b7685",fontWeight:800,cursor:"pointer"}}>Престиж 1420 dust → скин титана</button>
            </div>
          </div>
        </div>
        <div ref={confettiRoot} style={{position:"absolute",inset:0,pointerEvents:"none"}} />
        {data.offline.hours>0 && <div style={{marginTop:10,opacity:.55,fontSize:12}}>оффлайн {data.offline.hours}ч · −{data.offline.decay} к шкалам (last_tick)</div>}
      </div>

      <div ref={barsRef} style={{display:"grid",gap:10}}>
        {[
          {label:"Голод", val:p.hunger, color:"#ffd42a"},
          {label:"Счастье", val:p.happiness, color:"#00ff88"},
          {label:"Энергия", val:p.energy, color:"#ff2d55"},
        ].map(b=>(
          <div key={b.label} data-stagger style={{border:"1px solid #23232b",borderRadius:12,background:"#121216",padding:"12px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,opacity:.7}}><span>{b.label}</span><span>{b.val}/100</span></div>
            <div style={{height:10,background:"#23232b",borderRadius:999,overflow:"hidden",marginTop:6}}>
              <div data-fill data-pct={Math.max(0,Math.min(100,b.val))} style={{height:"100%",width:`${b.val}%`,background:b.color}} />
            </div>
          </div>
        ))}
      </div>

      <div data-stagger style={{border:"1px dashed #23232b",borderRadius:12,padding:12,opacity:.6,fontSize:12}}>
        Баффы: s2 (личинка) +5% mining · s3 (медуза) +10% conveyor · s4 (титан) +15% + ежедневный яйцо-кейс 42-142 (epic 5%). Каждая стадия +5% к майнингу. GSAP: яйцо pulse 1.08 1.2s · эволюция burst 0.6→1 back.out 0.6s + confetti 120 · шкалы width 0.4s power2 · stagger y14 0.06
      </div>
    </div>
    {toast && <div style={{position:"fixed",top:18,left:"50%",transform:"translateX(-50%)",zIndex:70,padding:"11px 18px",borderRadius:12,border:"1px solid #ffd42a",background:"rgba(255,204,0,.12)",color:"#ffd42a",fontWeight:800,boxShadow:"0 0 22px rgba(255,204,0,.22)"}}>{toast}</div>}
  </div>;
}
