import { useEffect, useState } from "react";
import { getTamagotchiState, tamagotchiEmoji } from "../lib/tamagotchi";

export function TamagotchiWidget() {
  const [streak, setStreak] = useState(0);
  const [prestige, setPrestige] = useState(0);
  const [canClaim, setCanClaim] = useState(false);
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("magnum_token") : null;
  useEffect(() => {
    if (!token) return;
    fetch("/magnum/api/daily/status", { headers: { Authorization: `Bearer ${token}` } }).then(r=>r.json()).then(j=>{ if(j.streak!=null) setStreak(j.streak||0); if(j.canClaim!=null) setCanClaim(!!j.canClaim); }).catch(()=>{});
    fetch("/magnum/api/referral/prestige", { headers: { Authorization: `Bearer ${token}` } }).then(r=>r.json()).then(j=>{ if(j.prestige!=null) setPrestige(j.prestige); }).catch(()=>{});
  }, []);
  const st = getTamagotchiState({ streak, prestige, canClaim });
  const [tick, setTick] = useState(0);
  useEffect(()=>{ const id=setInterval(()=>setTick(t=>t+1),1200); return ()=>clearInterval(id); },[]);
  const y = Math.sin(tick*0.9)*4;
  if (!token) return null;
  return (
    <div style={{ maxWidth:1120, margin:"0 auto", padding:"0 1rem" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", borderRadius:16, background:"rgba(20,20,20,0.9)", border:"1px solid rgba(255,45,85,0.3)" }}>
        <div style={{ fontSize:28, transform:`translateY(${y}px)`, transition:"transform 0.3s" }}>{tamagotchiEmoji(st.stage)}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:800 }}>МАГНУМ-42 <span style={{ fontSize:12, opacity:0.7 }}>{st.stage}</span> {st.fedToday?"😋":"🥺"}</div>
          <div style={{ fontSize:12, opacity:0.8 }}>голод {st.hunger}% • энергия {st.energy}% • стрик {streak}дн • престиж {prestige} (+{st.bonus}%)</div>
          <div style={{ fontSize:11, opacity:0.6 }}>Покорми = daily вход. Эволюция на 7дн. Пригласи братуху → питомец получает корм.</div>
        </div>
        <div style={{ width:56, height:6, background:"rgba(255,255,255,0.1)", borderRadius:99, overflow:"hidden" }}><div style={{ width:`${st.energy}%`, height:"100%", background:"linear-gradient(90deg,#ff2d55,#ffcc00)" }} /></div>
      </div>
    </div>
  );
}
