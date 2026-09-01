import { useEffect, useRef, useState, useCallback } from "react";
export function Scratch42Page(){
 const [st,setSt]=useState<any>(null); const [msg,setMsg]=useState(""); const [revealed,setRevealed]=useState<number|null>(null);
 const [giftTo,setGiftTo]=useState(""); const [progress,setProgress]=useState(0);
 const wrapRef=useRef<HTMLDivElement>(null); const cvRef=useRef<HTMLCanvasElement>(null);
 const fetchStatus=useCallback(async()=>{
   try{ const r=await fetch("/magnum/api/scratch/status",{credentials:"include"}); if(r.ok) setSt(await r.json()); else if(r.status===401) setMsg("Войди, братуха — нужен токен"); }catch{}
 },[]);
 useEffect(()=>{ fetchStatus(); },[fetchStatus]);
 const doClaim=useCallback(async()=>{
   setMsg(""); const r=await fetch("/magnum/api/scratch/claim",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({})});
   const j=await r.json().catch(()=>({}));
   if(!r.ok){ setMsg((j as {error?:string}).error||"Уже брал сегодня — завтра"); return; }
   setRevealed(Number((j as {dust:number}).dust));
   setMsg(`+${(j as {dust:number}).dust} dust ${(j as {isReferral:boolean}).isReferral?"x2 реферал": ""} ${(j as {coinsBonus:number}).coinsBonus?`+${(j as {coinsBonus:number}).coinsBonus} coins`: ""}`);
   fetchStatus();
 },[fetchStatus]);
 const doGift=useCallback(async()=>{
   if(!giftTo.trim()){ setMsg("Введи ник братухи"); return; }
   const r=await fetch("/magnum/api/scratch/gift",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({to: giftTo.trim()})});
   const j=await r.json().catch(()=>({}));
   if(!r.ok){ setMsg((j as {error?:string}).error||"Ошибка подарка"); return; }
   setMsg(`Подарок ${giftTo} +${(j as {gift:number}).gift} dust`);
   setGiftTo(""); fetchStatus();
 },[giftTo,fetchStatus]);
 // canvas scratch effect 3sec swipe
 useEffect(()=>{
   const c=cvRef.current; if(!c || !st?.canClaim) return;
   const ctx=c.getContext("2d"); if(!ctx) return;
   ctx.fillStyle="#1a1a1a"; ctx.fillRect(0,0,c.width,c.height);
   ctx.fillStyle="rgba(255,204,0,0.12)"; ctx.font="700 44px Inter,Arial"; ctx.textAlign="center"; ctx.fillText("СВАЙП 42", c.width/2, c.height/2+12);
   ctx.globalCompositeOperation="source-over";
   // foil overlay
   ctx.fillStyle="#c9a84c"; ctx.fillRect(0,0,c.width,c.height);
   ctx.fillStyle="rgba(0,0,0,0.12)"; for(let i=0;i<600;i++){ ctx.fillRect(Math.random()*c.width,Math.random()*c.height,2,2); }
   ctx.fillStyle="#fff"; ctx.font="900 18px Inter,Arial"; ctx.textAlign="center"; ctx.fillText("ТРИ 3 СЕК — СКРЕТЧ", c.width/2, 32);
   let scratch=0;
   const paint=(x:number,y:number)=>{ ctx.globalCompositeOperation="destination-out"; ctx.beginPath(); ctx.arc(x,y,28,0,Math.PI*2); ctx.fill(); scratch++; setProgress(p=> Math.min(100, p+0.22)); };
   const handler=(e: PointerEvent)=>{ const r=c.getBoundingClientRect(); const x=(e.clientX-r.left)*(c.width/r.width); const y=(e.clientY-r.top)*(c.height/r.height); paint(x,y); };
   c.addEventListener("pointermove", handler as unknown as EventListener);
   c.addEventListener("pointerdown", handler as unknown as EventListener);
   return ()=>{ c.removeEventListener("pointermove", handler as unknown as EventListener); c.removeEventListener("pointerdown", handler as unknown as EventListener); };
 },[st?.canClaim]);
 useEffect(()=>{ if(progress>42 && st?.canClaim && revealed===null){ const t=setTimeout(doClaim, 700); return ()=>clearTimeout(t);} },[progress, st, revealed, doClaim]);
 const canClaim=Boolean(st?.canClaim);
 const isReferral=Boolean(st?.isReferral);
 const og=st?.ogUrl ? String(st.ogUrl) : "/magnum/api/scratch/og";
 return (<div ref={wrapRef} style={{maxWidth:1100, margin:"0 auto", padding:"24px 16px", color:"#fff"}}>
  <h1 style={{fontSize:28, fontWeight:900}}>СКРЕТЧ 42 <span style={{fontWeight:400, opacity:.6}}>— 1/день свайп</span></h1>
  <p style={{opacity:.72}}>42/142/1420 dust • {isReferral?"x2 реферал активен 👑":"приведи братуху → x2 навсегда"} • Gacha Points +1 pity 90/180 синхрон • подарок другу + OG 1080</p>
  <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:16, marginTop:16}}>
    <div style={{border:"1px solid rgba(255,204,0,0.35)", borderRadius:18, padding:16, background:"linear-gradient(135deg,#ff2d55 0%,#1a1a00 100%)"}}>
      <div style={{fontWeight:800}}>Сегодня {st?.dayId||"…"}</div>
      <div style={{marginTop:8, fontSize:13, opacity:.8}}>Доступно: {canClaim?"1 скретч":"использовано — завтра"} {revealed!=null?`• выпало ${revealed} dust`: ""}</div>
      {st?.lastClaim && !canClaim && (<div style={{marginTop:6, fontSize:13}}>Вчера {String(st.lastClaim.dust)} dust x{String(st.lastClaim.multiplier)}</div>)}
      <div style={{marginTop:10, display:"flex", gap:8, flexWrap:"wrap"}}>
        <span style={{padding:"6px 10px", borderRadius:999, background:"rgba(0,0,0,0.3)", fontSize:12}}>pity epic {String((st?.pity?.standard as {epicToGo?:number})?.epicToGo ?? 90)} • leg {String((st?.pity?.standard as {legendaryToGo?:number})?.legendaryToGo ?? 180)}</span>
        <span style={{padding:"6px 10px", borderRadius:999, background:isReferral?"rgba(0,255,136,0.16)":"rgba(255,255,255,0.08)", color:isReferral?"#00ff88": "#fff", fontSize:12}}>{isReferral?"x2 dust":"без x2"}</span>
      </div>
      {msg && <div style={{marginTop:10, color:"#00ff88", fontSize:13}}>{msg}</div>}
      <div style={{marginTop:12, display:"flex", gap:8, alignItems:"center"}}>
        <button onClick={doClaim} disabled={!canClaim} style={{padding:"10px 14px", borderRadius:12, border:"1px solid #00ff88", background:canClaim?"rgba(0,255,136,0.18)":"rgba(255,255,255,0.06)", color: canClaim?"#00ff88":"rgba(255,255,255,0.4)", fontWeight:800}}>Забрать dust</button>
        <a href={og} target="_blank" rel="noreferrer" style={{padding:"10px 14px", borderRadius:12, border:"1px solid rgba(255,204,0,0.35)", background:"rgba(255,204,0,0.08)", color:"#ffcc00", textDecoration:"none", fontWeight:700}}>OG 1080</a>
      </div>
      <div style={{marginTop:10, fontSize:12, opacity:.6}}>Свайп 3 сек → авто-клейм • {progress.toFixed(0)}% стёрто</div>
    </div>
    <div style={{border:"1px solid rgba(255,255,255,0.08)", borderRadius:18, padding:12, background:"#111"}}>
      <div style={{fontWeight:800, marginBottom:8}}>Поле скретч</div>
      {!canClaim ? <div style={{height:220, display:"grid", placeItems:"center", background:"rgba(255,255,255,0.04)", borderRadius:12, color:"rgba(255,255,255,0.6)"}}>{revealed!=null?`+${revealed} dust — завтра снова`:"Уже брал сегодня"}</div>
      : <canvas ref={cvRef} width={420} height={220} style={{width:"100%", height:220, borderRadius:12, touchAction:"none", display:"block", background:"#0a0a0a", border:"1px solid rgba(255,204,0,0.18)"}}/>}
    </div>
    <div style={{border:"1px solid rgba(255,255,255,0.08)", borderRadius:18, padding:16, background:"#111"}}>
      <div style={{fontWeight:800}}>Подарить скретч другу</div>
      <p style={{fontSize:12, opacity:.6}}>Нужно взять свой сегодня — потом 1 подарок/день другу (sharing OG 1080)</p>
      <div style={{display:"flex", gap:8, marginTop:8}}>
        <input value={giftTo} onChange={e=>setGiftTo(e.target.value)} placeholder="ник братухи" style={{flex:1, padding:"10px 12px", borderRadius:12, border:"1px solid rgba(255,255,255,0.12)", background:"#0a0a0a", color:"#fff"}}/>
        <button onClick={doGift} style={{padding:"10px 14px", borderRadius:12, border:"1px solid #ff2d55", background:"rgba(255,45,85,0.14)", color:"#ff2d55", fontWeight:800}}>Подарить</button>
      </div>
      <div style={{marginTop:10, display:"flex", gap:8, flexWrap:"wrap"}}>
        <a href="/magnum/api/scratch/history" target="_blank" rel="noreferrer" style={{fontSize:12, color:"rgba(255,255,255,0.55)"}}>История 20</a>
        <a href="/magnum/api/scratch/gifts" target="_blank" rel="noreferrer" style={{fontSize:12, color:"rgba(255,255,255,0.55)"}}>Подарки</a>
      </div>
      <div style={{marginTop:10, fontSize:12, opacity:.55}}>Поделись OG 1080 в сторис — +20% реферал lifetime (gacha.game механика)</div>
    </div>
  </div>
 </div>);
}
