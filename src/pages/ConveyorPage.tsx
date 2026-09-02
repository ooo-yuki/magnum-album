import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import s from "./ConveyorPage.module.css";
import { GuestGate } from "../components/GuestGate";

const CATALOG_PREVIEW = [
  { icon:"⛏️", name:"Шахта", desc:"Базовая добыча · 4 dust/мин" },
  { icon:"🪨", name:"Дробилка", desc:"Переработка руды · 14 dust/мин" },
  { icon:"🚚", name:"Конвейер", desc:"Транспортёр · 42 dust/мин" },
  { icon:"🏭", name:"Обогатиловка", desc:"Обогащение · 84 dust/мин" },
  { icon:"⚡", name:"ТЭЦ", desc:"Энергия завода · 142 dust/мин" },
  { icon:"🔬", name:"Лаборатория", desc:"Наука · 420 dust/мин" },
];

function Onboarding(){
  const pageRef=useRef<HTMLDivElement>(null);
  const beltRef=useRef<HTMLDivElement>(null);
  const stepsRef=useRef<HTMLDivElement>(null);
  const cardsRef=useRef<HTMLDivElement>(null);
  const ctaRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    if(!pageRef.current) return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx=gsap.context(()=>{
      // title fade up
      gsap.from(`.${s.onboard} h1`,{y:30,opacity:0,duration:.7,ease:"power3.out"});
      gsap.from(`.${s.onboardSub}`,{y:20,opacity:0,duration:.6,delay:.15,ease:"power3.out"});
      // belt slide in
      gsap.from(`.${s.previewBelt}`,{scaleX:0,opacity:0,duration:.8,delay:.3,ease:"power2.out",transformOrigin:"left center"});
      // steps stagger
      const steps=pageRef.current!.querySelectorAll(`.${s.step}`);
      gsap.from(steps,{y:24,opacity:0,stagger:.12,duration:.5,delay:.5,ease:"power2.out"});
      // cards stagger
      const cards=pageRef.current!.querySelectorAll(`.${s.previewCard}`);
      gsap.from(cards,{y:20,opacity:0,scale:.92,stagger:.08,delay:.9,duration:.45,ease:"back.out(1.4)"});
      // CTA pop
      gsap.from(`.${s.ctaWrap}`,{y:16,opacity:0,duration:.5,delay:1.3,ease:"power2.out"});
      // FAQ
      const faq=pageRef.current!.querySelectorAll(`.${s.faqItem}`);
      gsap.from(faq,{y:16,opacity:0,stagger:.1,delay:1.5,duration:.4,ease:"power2.out"});
    },pageRef);
    return()=>ctx.revert();
  },[]);

  // belt loop animation
  useEffect(()=>{
    if(!beltRef.current) return;
    const track=beltRef.current.querySelector(`.${s.previewBeltTrack}`) as HTMLElement|null;
    if(!track) return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx=gsap.context(()=>{
      gsap.set(track,{x:0});
      gsap.to(track,{x:-60,duration:2,repeat:-1,ease:"none"});
    },beltRef);
    return()=>ctx.revert();
  },[]);

  const goAuth=()=>window.dispatchEvent(new CustomEvent("magnum:need-auth"));

  return <div ref={pageRef} className={s.page}>
  <GuestGate action="качать конвейер и попадать в топ" />
    <div className={s.onboard}>
      <h1>КОНВЕЙЕР 42</h1>
      <p className={s.onboardSub}>
        Idle-завод Кузбасса. Построй 6 цехов, собирай dust оффлайн,
        забирай монеты и прокачивай производство. Пресейв → доход x2.
      </p>

      {/* animated belt */}
      <div ref={beltRef} className={s.previewBelt}>
        <div className={s.previewBeltTrack}>
          {Array.from({length:22}).map((_,i)=><div key={i} className={s.previewBeltItem}/>)}
        </div>
      </div>

      {/* how it works */}
      <div className={s.howSection}>
        <div className={s.howTitle}>Как играть</div>
        <div ref={stepsRef} className={s.steps}>
          <div className={s.step}>
            <div className={`${s.stepNum} ${s.stepNumBuy}`}>1</div>
            <div className={s.stepText}>
              <strong>Построй цеха</strong>
              <span>6 производств — от Шахты (42 🪙) до Лаборатории (420 🪙). Каждый цех даёт доход в dust/мин.</span>
            </div>
          </div>
          <div className={s.step}>
            <div className={`${s.stepNum} ${s.stepNumEarn}`}>2</div>
            <div className={s.stepText}>
              <strong>Копи оффлайн</strong>
              <span>Dust накапливается даже когда ты не на сайте. Кап — 4 часа, потом приходи забирать.</span>
            </div>
          </div>
          <div className={s.step}>
            <div className={`${s.stepNum} ${s.stepNumClaim}`}>3</div>
            <div className={s.stepText}>
              <strong>Забери монеты</strong>
              <span>Преврати dust в монеты 🪙 — трать на апгрейды цехов или скидки в магазине.</span>
            </div>
          </div>
          <div className={s.step}>
            <div className={`${s.stepNum} ${s.stepNumPrestige}`}>4</div>
            <div className={s.stepText}>
              <strong>Смена (престиж)</strong>
              <span>Накопил 42k dust? Сбрось цеха → +15% к доходу навсегда. Чем больше смен — тем мощнее завод.</span>
            </div>
          </div>
        </div>
      </div>

      {/* preview cards */}
      <div className={s.howTitle}>Цеха завода</div>
      <div ref={cardsRef} className={s.previewGrid}>
        {CATALOG_PREVIEW.map((c,i)=>(
          <div key={i} className={s.previewCard}>
            <div className={s.previewCardIcon}>{c.icon}</div>
            <div className={s.previewCardName}>{c.name}</div>
            <div className={s.previewCardDesc}>{c.desc}</div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div ref={ctaRef} className={s.ctaWrap}>
        <button className={`${s.ctaBtn} ${s.ctaLogin}`} onClick={goAuth}>Войти и начать</button>
        <button className={`${s.ctaBtn} ${s.ctaQuick}`} onClick={goAuth}>⚡ Регистрация 1 клик</button>
      </div>

      {/* FAQ */}
      <div className={s.onboardFaq}>
        <div className={s.faqTitle}>Частые вопросы</div>
        <div className={s.faqItem}>
          <div className={s.faqQ}>Нужно ли быть онлайн?</div>
          <div className={s.faqA}>Нет. Dust копится оффлайн до 4 часов. Заходи, забирай, продолжай.</div>
        </div>
        <div className={s.faqItem}>
          <div className={s.faqQ}>Что даёт пресейв?</div>
          <div className={s.faqA}>Доход конвейера x2. Один пресейв — и весь завод работает вдвое быстрее.</div>
        </div>
        <div className={s.faqItem}>
          <div className={s.faqQ}>Зачем нужен престиж (Смена)?</div>
          <div className={s.faqA}>Каждая смена = +15% к базовому доходу навсегда. Цеха сбрасываются, но бонус растёт экспоненциально.</div>
        </div>
        <div className={s.faqItem}>
          <div className={s.faqQ}>Dust и монеты — это одно и то же?</div>
          <div className={s.faqA}>Dust — ресурс конвейера. Забирая его, ты получаешь монеты 🪙 для апгрейдов и магазина. Dust также даёт скидки в ShopVault.</div>
        </div>
      </div>
    </div>
  </div>;
}
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
  if(!st) return <Onboarding />;
  const incomeLabel=`+${st.perMin}/мин${st.bonusX2?" x2 пресейв":""}`;
  const canPrestige=st.dust>=st.prestigeNeed;
  return <div ref={pageRef} className={s.page}>
    <GuestGate action="качать конвейер и попадать в топ" />
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
