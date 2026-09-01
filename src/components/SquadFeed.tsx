import { useEffect, useRef } from "react";
import gsap from "gsap";

type Battle={id:number;winnerId:number|null;winner?:string;score:any;created_at:string};

export function SquadFeed({battles,onShare}:{battles:Battle[];onShare:()=>void}){
  const listRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!listRef.current) return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx=gsap.context(()=>{
      const items=listRef.current!.querySelectorAll("[data-battle]");
      gsap.set(items,{x:24,opacity:0});
      gsap.to(items,{x:0,opacity:1,stagger:0.06,duration:0.3,ease:"power2.out"});
    },listRef);
    return()=>ctx.revert();
  },[battles]);

  if(battles.length===0) return <div style={{marginTop:14,padding:"1rem",borderRadius:16,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.06)",color:"rgba(255,255,255,.5)"}}>Лента битв пуста — вызови батальон и устрой дуэль 10с!</div>;

  return <div style={{marginTop:14}}>
    <strong style={{color:"#fff"}}>Лента последних 20 битв</strong>
    <div ref={listRef} style={{display:"grid",gap:10,marginTop:10}}>
      {battles.slice(0,20).map(b=>{
        const sc=b.score as any;
        const scores:Array<{name:string;score:number}> = Array.isArray(sc?.scores) ? sc.scores : (Array.isArray(sc) ? sc : []);
        const winner=b.winner || sc?.winner || "";
        const totalClicks=scores.reduce((s,x)=>s+Number(x.score||0),0);
        const cps=scores.length? (totalClicks/10/scores.length).toFixed(1):"—";
        return <div key={b.id} data-battle style={{padding:"12px 14px",borderRadius:14,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
          <div style={{minWidth:0}}>
            <div style={{fontWeight:800,fontSize:13,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{winner? `🏆 ${winner}`:"Ничья"} · {new Date(b.created_at).toLocaleString("ru-RU")}</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.6)",marginTop:4,display:"flex",gap:8,flexWrap:"wrap"}}>
              {scores.map((p,i)=><span key={i} style={{padding:"2px 6px",borderRadius:999,background: p.name===winner?"rgba(255,45,85,.18)":"rgba(255,255,255,.06)"}}>{p.name}: {Math.round(p.score)} ({(Number(p.score)/10).toFixed(1)}/сек)</span>)}
              {!scores.length && <span style={{color:"rgba(255,255,255,.45)"}}>реплей кликов/сек: {cps}</span>}
            </div>
          </div>
          <button onClick={onShare} style={{flexShrink:0,padding:"8px 12px",borderRadius:999,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.12)",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:12}}>Шаринг</button>
        </div>;
      })}
    </div>
  </div>;
}
