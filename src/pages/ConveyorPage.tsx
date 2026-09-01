import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import s from "./ConveyorPage.module.css";
type CatalogItem = { idx:number; id:string; name:string; icon:string; base:number; price:number };
type State = { levels:number[]; prestige:number; dust:number; perMin:number; pending:number; elapsedMin:number; capMin:number; bonusX2:boolean; balance:number; catalog:CatalogItem[]; prestigeNeed:number; prestigeBonus:string };
export function ConveyorPage(){
  const [st,setSt]=useState<State|null>(null);
  const [loading,setLoading]=useState(true);
  const [toast,setToast]=useState<string|null>(null);
  const [claiming,setClaiming]=useState(false);
  const pageRef=useRef<HTMLDivElement>(null);
  const beltRef=useRef<HTMLDivElement>(null);
  const claimRef=useRef<HTMLButtonElement>(null);
  const prestigeRef=useRef<HTMLButtonElement>(null);
  const cardsRef=useRef<HTMLDivElement>(null);
  const showToast=useCallback((m:string)=>{setToast(m); setTimeout(()=>setToast(null),1600);},[]);
  const fetchState=useCallback(async()=>{
    try{ const r=await fetch("/magnum/api/conveyor/state",{credentials:"include"}); if(r.ok){ const j=await r.json(); setSt(j); } }catch{}
    finally{ setLoading(false); }
  },[]);
  useEffect(()=>{ fetchState(); },[fetchState]);
  // poll pending every 5s
  useEffect(()=>{ const id=window.setInterval(fetchState,5000); return()=>clearInterval(id); },[fetchState]);
  // GSAP belt translateX loop 2s linear
  useEffect(()=>{
    if(!beltRef.current) return;
    const track=beltRef.current.querySelector(`.${s.beltTrack}`) as HTMLElement|null;
    if(!track) return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx=gsap.context(()=>{
      gsap.set(track,{x:0});
      gsap.to(track,{x:-60,duration:2,repeat:-1,ease:"none"});
    },beltRef);
    return()=>ctx.revert();
  },[st]);
  // stagger y16 0.07
  useEffect(()=>{
    if(!cardsRef.current) return;
    const cards=cardsRef.current.querySelectorAll(`.${s.card}`);
    if(!cards.length) return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){ gsap.set(cards,{y:0,opacity:1}); return; }
    const ctx=gsap.context(()=>{
      gsap.set(cards,{y:16,opacity:0});
      gsap.to(cards,{y:0,opacity:1,stagger:0.07,duration:0.45,ease:"power2.out"});
    },cardsRef);
    return()=>ctx.revert();
  },[st]);
  // prestige pulse 1.06 1.2s
  useEffect(()=>{
    if(!prestigeRef.current) return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx=gsap.context(()=>{ gsap.to(prestigeRef.current,{scale:1.06,duration:1.2,repeat:-1,yoyo:true,ease:"sine.inOut"}); },prestigeRef);
    return()=>ctx.revert();
  },[st?.prestige]);
  const claim=async()=>{
    if(claiming) return; setClaiming(true);
    try{
      const r=await fetch("/magnum/api/conveyor/claim",{method:"POST",credentials:"include"});
      const j=await r.json() as {claimed?:number; balance?:number; dust?:number; error?:string};
      if(!r.ok){ showToast(j.error||"Ошибка claim"); return; }
      const claimed=j.claimed||0;
      showToast(claimed?`+${claimed} dust → баланс`:"Нечего забирать");
      if(claimRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
        gsap.fromTo(claimRef.current,{scale:1},{scale:1.08,duration:0.35,ease:"back.out(1.7)",yoyo:true,repeat:1});
      }
      await fetchState();
      window.dispatchEvent(new CustomEvent("magnum:coins:update"));
    }catch{ showToast("Сеть"); } finally{ setClaiming(false); }
  };
  const upgrade=async(idx:number,bulk:boolean)=>{
    try{
      const r=await fetch("/magnum/api/conveyor/upgrade",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({idx, bulk})});
      const j=await r.json() as {error?:string; price?:number; balance?:number; required?:number};
      if(!r.ok){ if(r.status===402) showToast(`Нужно ${j.required||j.price} монет`); else showToast(j.error||"Ошибка"); return; }
      showToast(bulk?"Куплено x10":"Куплено +1");
      await fetchState();
    }catch{ showToast("Сеть"); }
  };
  const prestige=async()=>{
    try{
      const r=await fetch("/magnum/api/conveyor/prestige",{method:"POST",credentials:"include"});
      const j=await r.json() as {error?:string; prestige?:number};
      if(!r.ok){ showToast(j.error||"Нужно 42000 dust"); return; }
      showToast(`Смена +15%! Prestige ${j.prestige}`);
      await fetchState();
    }catch{ showToast("Сеть"); }
  };
  if(loading) return <div className={s.page}>Загрузка конвейера…</div>;
  if(!st) return <div className={s.page}>Войди, братуха — конвейер только для залогиненных. <a href="/magnum">/magnum</a></div>;
  const incomeLabel=`+${st.perMin}/мин${st.bonusX2?" x2 пресейв":""}`;
  const canPrestige=st.dust>=st.prestigeNeed;
  return <div ref={pageRef} className={s.page}>
    <h1 style={{fontSize:28,fontWeight:900}}>КОНВЕЙЕР 42 — Idle-завод Кузбасса</h1>
    <p style={{opacity:.7}}>6 цехов · оффлайн-накопление видно сразу (+N/мин) · пресейв-бонус x2 · кап 4ч</p>
    <div ref={beltRef} className={s.belt}><div className={s.beltTrack}>{Array.from({length:22}).map((_,i)=><div key={i} className={s.beltItem}/>)}</div></div>
    <div className={s.header}>
      <div className={s.statCard}><div className={s.statLabel}>Доход</div><div className={s.statValue}>{incomeLabel}</div><div className={s.cardMeta}>база {st.perMin} · престиж {st.prestigeBonus}</div></div>
      <div className={s.statCard}><div className={s.statLabel}>Оффлайн</div><div className={s.statValue + " " + s.pending}>{st.pending} dust</div><div className={s.cardMeta}>{st.elapsedMin}/{st.capMin} мин · кап 4ч</div></div>
      <div className={s.statCard}><div className={s.statLabel}>Баланс</div><div className={s.statValue}>{st.balance} 🪙</div><div className={s.cardMeta}>dust всего {st.dust}</div></div>
    </div>
    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      <button ref={claimRef} className={s.claimBtn} onClick={claim} disabled={st.pending<=0 || claiming}>{st.pending>0?`Забрать +${st.pending}`:"Нечего забирать"}</button>
      <button ref={prestigeRef} className={s.prestigeBtn} onClick={prestige} disabled={!canPrestige} title={canPrestige?"Сбросить цеха → +15% навсегда":"Нужно 42k"}>Смена {canPrestige?"✅ доступна":"— нужно 42k"} {st.prestige>0?`· lvl ${st.prestige}`:""}</button>
    </div>
    <div ref={cardsRef} className={s.grid}>
      {st.catalog.map(c=>{
        const lvl=st.levels[c.idx]||0;
        const inc=lvl*c.base;
        const price=c.price;
        const bulkPrice=price*10;
        const canBuy=st.balance>=price;
        const canBulk=st.balance>=bulkPrice;
        return <div key={c.idx} className={s.card}>
          <div className={s.cardHead}><span className={s.icon}>{c.icon}</span><span className={s.cardName}>{c.name}</span><span style={{marginLeft:"auto",opacity:.6, fontSize:12}}>{lvl} ур · +{inc}/мин</span></div>
          <div className={s.cardMeta}>база {c.base}/мин · цена {price} 🪙 · {c.idx===0?"Шахта 4/мин → ТЭЦ 142/мин":"доход 4-420/мин"}</div>
          <div className={s.bar}><div className={s.barFill} style={{width:Math.min(100,lvl*7+8)+"%", opacity:lvl?1:.4}}/></div>
          <div className={s.actions}>
            <button className={s.upBtn} disabled={!canBuy} onClick={()=>upgrade(c.idx,false)}>+1 за {price}</button>
            <button className={s.bulkBtn} disabled={!canBulk} onClick={()=>upgrade(c.idx,true)}>x10 за {bulkPrice}</button>
          </div>
        </div>;
      })}
    </div>
    <p style={{marginTop:14,opacity:.55,fontSize:12}}>Престиж «Смена» сброс→ +15% пермамент dust за каждые 42k добытых. Dust→скидки в ShopVault. Анти-инфляция кап 4ч. GSAP: лента translateX 2s linear · stagger y16 0.07 · pulse 1.06 1.2s · claim burst back.out 0.35</p>
    {toast && <div className={s.toast}>{toast}</div>}
  </div>;
}
