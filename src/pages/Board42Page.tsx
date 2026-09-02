import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { CosmeticIdentity, cosmeticBannerStyle, type LeaderCosmetics } from "../components/CosmeticBadge";

type FeedItem = { game:string; score:number; username:string; userId:number; avatar:string|null; created_at:string; timeAgo:string };
type ChallengeItem = { id:number; challengerId:number; challengedId:number; challenger:string; challenged:string; game:string; score:number; status:string; created_at:string; expires_at:string; remainingMs:number; remainingH:string };
type LbItem = { rank:number; userId:number; username:string; score:number; plays:number; avatar:string|null; reward:number; crown:string; isTop3:boolean } & LeaderCosmetics;
const GAMES = ["all","mining","conveyor","duel","pet","studio"] as const;
const TABS = ["global","friends","challenges"] as const;

export function Board42Page(){
  const nav=useNavigate();
  const wrapRef=useRef<HTMLDivElement>(null);
  const feedRef=useRef<HTMLDivElement>(null);
  const [tab,setTab]=useState<typeof TABS[number]>("global");
  const [game,setGame]=useState<string>("all");
  const [page,setPage]=useState(1);
  const [feed,setFeed]=useState<FeedItem[]>([]);
  const [challenges,setChallenges]=useState<ChallengeItem[]>([]);
  const [lb,setLb]=useState<LbItem[]>([]);
  const [globalCount,setGlobalCount]=useState(0);
  const [msg,setMsg]=useState("");
  const [me,setMe]=useState<{id:number;username:string}|null>(null);
  const [loading,setLoading]=useState(true);
  const [challengeMsg,setChallengeMsg]=useState("");
  const shareCanvasRef=useRef<HTMLCanvasElement>(null);
  const [shareUrl,setShareUrl]=useState("");

  useEffect(()=>{
    fetch("/magnum/api/auth/me",{credentials:"include"}).then(r=>r.ok?r.json():null).then(j=> setMe(j?.user??null)).catch(()=>{});
  },[]);

  const loadFeed=useCallback(async()=>{
    setLoading(true);
    try{
      const params=new URLSearchParams({tab, page:String(page), ...(game!=="all"?{game}:{})});
      const r=await fetch(`/magnum/api/board/feed?${params}`,{credentials:"include"});
      const j=await r.json() as {ok?:boolean; items?: FeedItem[]|ChallengeItem[]; tab?:string};
      if(j.ok && Array.isArray(j.items)){
        if(j.tab==="challenges") setChallenges(j.items as ChallengeItem[]);
        else setFeed(j.items as FeedItem[]);
      } else {
        if(tab==="challenges") setChallenges([]);
        else setFeed([]);
      }
    }catch{ /* */ }
    setLoading(false);
  },[tab,game,page]);

  const loadLb=useCallback(async()=>{
    try{
      const r=await fetch("/magnum/api/board/leaderboard",{credentials:"include"});
      const j=await r.json() as {top?:LbItem[]; globalCount?:number};
      if(Array.isArray(j.top)) setLb(j.top);
      if(typeof j.globalCount==="number") setGlobalCount(j.globalCount);
    }catch{}
  },[]);

  useEffect(()=>{ loadFeed(); },[loadFeed]);
  useEffect(()=>{ loadLb(); },[loadLb]);

  useEffect(()=>{
    if(!feedRef.current) return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rows=feedRef.current.querySelectorAll<HTMLElement>("[data-feed-row]");
    if(!rows.length) return;
    const ctx=gsap.context(()=>{
      gsap.set(rows,{y:16,opacity:0});
      gsap.to(rows,{y:0,opacity:1,stagger:0.07,duration:0.42,ease:"power2.out"});
    },feedRef);
    return()=>ctx.revert();
  },[feed,tab]);

  useEffect(()=>{
    if(tab!=="challenges"||!challenges.length) return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el=document.querySelectorAll<HTMLElement>("[data-challenge-row]");
    const ctx=gsap.context(()=>{
      gsap.set(el,{x:24,opacity:0});
      gsap.to(el,{x:0,opacity:1,duration:0.3,stagger:0.06,ease:"power2.out"});
      // shake after slide
      setTimeout(()=> gsap.to(el,{x:6,duration:0.06,yoyo:true,repeat:5,ease:"power2.inOut"}), 320);
    });
    return()=>ctx.revert();
  },[challenges,tab]);

  async function doChallenge(friendId:number, g:string, score:number){
    if(!me){ setChallengeMsg("Войди, братуха"); return; }
    setChallengeMsg("");
    try{
      const r=await fetch("/magnum/api/board/challenge",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({friendId, game:g, score})});
      const j=await r.json() as {ok?:boolean; error?:string};
      if(!r.ok){ setChallengeMsg(j.error||"Ошибка"); return; }
      setChallengeMsg(`Вызов брошен — ${g} ${score} vs ${friendId} ⚔️`);
      // slide animation on button
      if(wrapRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
        gsap.fromTo(wrapRef.current.querySelectorAll("[data-challenge-btn]"),{scale:0.96},{scale:1,duration:0.2,ease:"back.out(1.6)"});
      }
    }catch{ setChallengeMsg("Сеть"); }
  }

  async function doAccept(id:number){
    try{
      const r=await fetch("/magnum/api/board/accept",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({challengeId:id})});
      const j=await r.json() as {ok?:boolean; redirect?:string; error?:string};
      if(!r.ok){ setMsg(j.error||"Ошибка"); return; }
      setMsg("Принято — переход в игру");
      if(j.redirect) nav(j.redirect);
    }catch{ setMsg("Сеть"); }
  }

  async function doShare(rec:FeedItem){
    const dayId=new Date().toISOString().slice(0,10);
    const canvas=shareCanvasRef.current;
    if(!canvas){ setMsg("Canvas нет"); return; }
    // draw 1080x1080 OG
    canvas.width=1080; canvas.height=1080;
    const ctx=canvas.getContext("2d")!;
    // bg conic-gold like
    const grad=ctx.createLinearGradient(0,0,1080,1080);
    grad.addColorStop(0,"#0a0a0a"); grad.addColorStop(0.5,"#1a1a00"); grad.addColorStop(1,"#ffcc00");
    ctx.fillStyle=grad; ctx.fillRect(0,0,1080,1080);
    ctx.fillStyle="#fff"; ctx.font="900 72px Inter, sans-serif"; ctx.fillText("ДОСКА 42",48,96);
    ctx.font="600 36px Inter, sans-serif"; ctx.fillStyle="rgba(255,255,255,0.9)"; ctx.fillText(`${rec.username} • ${rec.game} • ${rec.score}`,48,160);
    ctx.font="400 28px Inter, sans-serif"; ctx.fillStyle="rgba(255,255,255,0.7)"; ctx.fillText(rec.timeAgo,48,210);
    // vs block
    ctx.fillStyle="rgba(255,45,85,0.9)"; ctx.fillRect(48,260,984,180);
    ctx.fillStyle="#fff"; ctx.font="700 44px Inter, sans-serif"; ctx.fillText(`ВЫЗОВ: побей ${rec.score}!`,72,340);
    ctx.font="400 28px Inter, sans-serif"; ctx.fillText("Твой рекорд vs его рекорд — докажи, братуха ⚔️",72,390);
    // QR placeholder — URL to /magnum/board
    const qrUrl=`${window.location.origin}/magnum/board`;
    setShareUrl(qrUrl);
    ctx.fillStyle="#fff"; ctx.fillRect(390,500,300,300);
    ctx.fillStyle="#0a0a0a"; ctx.font="700 24px monospace"; ctx.fillText("QR", 520, 650);
    ctx.font="400 18px monospace"; ctx.fillStyle="#0a0a0a"; ctx.fillText(qrUrl.replace("https://",""), 400, 690);
    // footer
    ctx.fillStyle="rgba(255,255,255,0.8)"; ctx.font="400 22px Inter, sans-serif"; ctx.fillText("MAGNUM • 5opka — 5 треков — 5 пуль • /magnum/board",48,1020);
    // try Web Share API
    try{
      const blob:Blob = await new Promise(res=> canvas.toBlob(b=> res(b!), "image/png")!);
      const file=new File([blob],`board-42-${rec.game}-${rec.score}.png`,{type:"image/png"});
      if(navigator.canShare && navigator.canShare({files:[file]})){
        await navigator.share({title:`ДОСКА 42 — ${rec.game} ${rec.score}`, text:`${rec.username} набрал ${rec.score} в ${rec.game} — побей!`, files:[file]});
      } else if((navigator as unknown as {share?:unknown}).share){
        // text share fallback
        await (navigator as unknown as {share:(d:unknown)=>Promise<void>}).share({title:`ДОСКА 42`, text:`${rec.username} ${rec.game} ${rec.score} — ${qrUrl}`, url:qrUrl});
      } else {
        // download
        const a=document.createElement("a"); a.href=canvas.toDataURL("image/png"); a.download=`board-42-${Date.now()}.png`; a.click();
      }
    }catch{ /* user cancel */ }
    // +42 guard dayId via API
    try{
      const r=await fetch("/magnum/api/board/share",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({dayId})});
      const j=await r.json() as {ok?:boolean; coins?:number; error?:string; balance?:number; globalCount?:number};
      if(r.ok && j.ok){
        setMsg(`+${j.coins} монет за шаринг • баланс ${j.balance}`);
        if(typeof j.globalCount==="number") setGlobalCount(j.globalCount);
        if(wrapRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
          const burst=wrapRef.current.querySelector<HTMLElement>("[data-share-burst]");
          if(burst) gsap.fromTo(burst,{scale:0.8},{scale:1,duration:0.5,ease:"back.out(1.7)"});
          spawnConfetti(wrapRef.current,80);
        }
      } else if(r.status===409){
        setMsg("Уже делился сегодня — +42 1×/день");
      } else if(j.error) setMsg(j.error);
    }catch{ setMsg("Шаринг OK, но +42 не начислен — сеть"); }
  }

  function spawnConfetti(root:HTMLElement,count:number){
    for(let i=0;i<count;i++){
      const d=document.createElement("div");
      d.style.position="absolute"; d.style.left="50%"; d.style.top="40%"; d.style.width="7px"; d.style.height="7px"; d.style.borderRadius="2px";
      d.style.background= i%3===0?"#ff2d55": i%3===1?"#00ff88":"#ffcc00"; d.style.pointerEvents="none"; d.style.zIndex="99";
      root.appendChild(d);
      const ang=Math.random()*Math.PI*2, dist=60+Math.random()*200;
      gsap.to(d,{x:Math.cos(ang)*dist, y:Math.sin(ang)*dist+70, rotation:Math.random()*720, opacity:0, duration:0.8+Math.random()*0.5, ease:"power2.out", onComplete:()=> d.remove()});
    }
  }

  return (
    <div ref={wrapRef} style={{maxWidth:980,margin:"0 auto",padding:"24px 16px",position:"relative"}}>
      <h1 style={{fontSize:28,fontWeight:900,letterSpacing:"-0.02em"}}>ДОСКА 42 <span style={{color:"#ff2d55"}}>— лента рекордов</span></h1>
      <p style={{opacity:0.7,marginTop:6,fontSize:13}}>Глобальные рекорды • друзья • вызовы 24ч • шаринг 1080×1080 +42/день • топ-3 недели +1420 crown conic-gold</p>
      {}
      <div style={{marginTop:14,padding:12,borderRadius:12,background:"rgba(145,71,255,0.08)",border:"1px solid rgba(145,71,255,0.22)"}}>
        <div style={{fontWeight:900,fontSize:13,color:"#9147ff"}}>💜 Twitch 5opka — 1M+ Sep 2026 • 30д стата (P2 t_f1ad12c0)</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8,marginTop:8}}>
          <div style={{padding:8,borderRadius:8,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)"}}><div style={{fontWeight:800,fontSize:13}}>SocialBlade 1,008,991</div><div style={{opacity:0.65,fontSize:11}}>15.06.2026 • +444/день • +11,369/30д</div></div>
          <div style={{padding:8,borderRadius:8,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)"}}><div style={{fontWeight:800,fontSize:13}}>SullyGnome 1,021,365</div><div style={{opacity:0.65,fontSize:11}}>+10,076/30д • 116ч/30д • 17 стримов • 6ч43м avg • 6,459 avg viewers • 750,860ч/30д • пик 53,264 17.01.2026 14:55 • ранг #232</div></div>
          <div style={{padding:8,borderRadius:8,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)"}}><div style={{fontWeight:800,fontSize:13}}>StreamsCharts 80ч05м</div><div style={{opacity:0.65,fontSize:11}}>6,010 avg • 10,414 пик 30д • 481,273ч • 2,078,717 live views • пик 28,545 08.12.2024</div></div>
          <div style={{padding:8,borderRadius:8,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)"}}><div style={{fontWeight:800,fontSize:13}}>TwitchTracker 12,392,128ч</div><div style={{opacity:0.65,fontSize:11}}>всего • 134 игры • 172.2 фолл./час</div></div>
        </div>
        <div style={{opacity:0.5,fontSize:11,marginTop:8,wordBreak:"break-all"}}>Источники: <a href="https://socialblade.com/twitch/user/5opka" target="_blank" rel="noreferrer" style={{color:"#9147ff"}}>socialblade.com/twitch/user/5opka</a> • <a href="https://sullygnome.com/channel/5opka" target="_blank" rel="noreferrer" style={{color:"#9147ff"}}>sullygnome.com/channel/5opka</a> • <a href="https://streamscharts.com/channels/5opka" target="_blank" rel="noreferrer" style={{color:"#9147ff"}}>streamscharts.com/channels/5opka</a> • <a href="https://twitchtracker.com/5opka/statistics" target="_blank" rel="noreferrer" style={{color:"#9147ff"}}>twitchtracker.com/5opka/statistics</a></div>
      </div>

      <div style={{display:"flex",gap:8,marginTop:16,flexWrap:"wrap"}}>
        { (TABS as readonly string[]).map(t=> (
          <button key={t} onClick={()=>{setTab(t as typeof TABS[number]); setPage(1);}} style={{padding:"8px 14px",borderRadius:10,border:tab===t?"1px solid #ff2d55":"1px solid rgba(255,255,255,0.12)",background:tab===t?"rgba(255,45,85,0.18)":"rgba(255,255,255,0.04)",color:tab===t?"#ff2d55":"#fff",fontWeight:800,cursor:"pointer"}}>{t==="global"?"Глобал":t==="friends"?"Друзья":"Вызовы"}</button>
        ))}
        <span style={{marginLeft:"auto",opacity:0.6,fontSize:12,alignSelf:"center"}}>global shares: {globalCount}</span>
      </div>

      <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
        { (GAMES as readonly string[]).map(g=> (
          <button key={g} onClick={()=>{setGame(g); setPage(1);}} style={{padding:"6px 10px",borderRadius:8,border:game===g?"1px solid #ffcc00":"1px solid rgba(255,255,255,0.1)",background:game===g?"rgba(255,204,0,0.15)":"transparent",color:game===g?"#ffcc00":"#fff",fontSize:12,cursor:"pointer"}}>{g}</button>
        ))}
      </div>

      {/* weekly top-3 */}
      <div style={{marginTop:14,display:"flex",gap:10,flexWrap:"wrap"}}>
        {lb.slice(0,3).map((r,i)=> (
          <div key={r.userId} style={{flex:"1 1 140px",padding:12,borderRadius:12,background:"linear-gradient(135deg, rgba(255,204,0,0.15), rgba(255,45,85,0.12))",border:"1px solid rgba(255,204,0,0.25)",textAlign:"center",...cosmeticBannerStyle(r.banner)}}>
            <div style={{fontSize:22,animation:"crownPulse 1.2s ease-in-out infinite, conicSpin 3s linear infinite",display:"inline-block"}}>👑</div>
            <div style={{fontWeight:800,marginTop:4,display:"flex",gap:6,alignItems:"center",justifyContent:"center",flexWrap:"wrap"}}>
              <span>{i+1}.</span>
              <CosmeticIdentity username={r.username} avatar={r.avatar} frame={r.frame} title={r.title} size={22} />
            </div>
            <div style={{opacity:0.7,fontSize:12}}>{r.score} • +{r.reward} crown</div>
            <div style={{marginTop:6,height:6,borderRadius:99,background:"rgba(255,255,255,0.08)",overflow:"hidden"}}><div style={{width: String(Math.max(12,Math.round((r.score/Math.max(1,lb[0]?.score||1))*100))) + "%",height:"100%",background:"conic-gradient(from 0deg, #ffcc00, #ff2d55, #ffcc00)",animation:"conicSpin 3s linear infinite"}} /></div>
          </div>
        ))}
      </div>

      <div ref={feedRef} style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
        {loading && <div style={{opacity:0.6}}>Загрузка…</div>}
        {!loading && tab!=="challenges" && feed.length===0 && <div style={{opacity:0.6,padding:24,textAlign:"center",border:"1px dashed rgba(255,255,255,0.12)",borderRadius:12}}>Пока пусто — сыграй в /magnum/mining /conveyor /games/duel-volcano и будет лента</div>}
        {!loading && tab!=="challenges" && feed.map((it,idx)=> (
          <div key={`${it.userId}-${it.created_at}-${idx}`} data-feed-row style={{display:"flex",gap:12,alignItems:"center",padding:12,borderRadius:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)"}}>
            <div style={{width:38,height:38,borderRadius:999,background: it.avatar?`url(${it.avatar}) center/cover`:"linear-gradient(135deg,#ff2d55,#ffcc00)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:14}}>{!it.avatar && String(it.username).slice(0,2).toUpperCase()}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:800,fontSize:13,display:"flex",gap:6,flexWrap:"wrap"}}><span>{it.username}</span><span style={{opacity:0.5,border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,padding:"0 6px",fontSize:11}}>{it.game}</span><span style={{marginLeft:"auto",opacity:0.7}}>{it.score}</span></div>
              <div style={{opacity:0.6,fontSize:11,marginTop:2}}>{it.timeAgo} • {new Date(it.created_at).toLocaleString("ru-RU")}</div>
            </div>
            <button data-challenge-btn onClick={()=> doChallenge(it.userId, it.game, it.score)} style={{padding:"7px 10px",borderRadius:8,border:"1px solid rgba(255,45,85,0.4)",background:"rgba(255,45,85,0.12)",color:"#ff2d55",fontWeight:800,cursor:"pointer",fontSize:12}}>Вызвать</button>
            <button data-share-burst onClick={()=> doShare(it)} style={{padding:"7px 10px",borderRadius:8,border:"1px solid rgba(255,204,0,0.4)",background:"rgba(255,204,0,0.12)",color:"#ffcc00",fontWeight:800,cursor:"pointer",fontSize:12}}>Шарить</button>
          </div>
        ))}
        {!loading && tab==="challenges" && challenges.length===0 && <div style={{opacity:0.6,padding:24,textAlign:"center",border:"1px dashed rgba(255,255,255,0.12)",borderRadius:12}}>Нет входящих вызовов — брось первым во вкладке Глобал</div>}
        {!loading && tab==="challenges" && challenges.map(c=> (
          <div key={c.id} data-challenge-row style={{padding:12,borderRadius:12,background:"rgba(255,45,85,0.08)",border:"1px solid rgba(255,45,85,0.25)",display:"flex",gap:10,alignItems:"center"}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:800}}>Вызов от {c.challenger} → тебе</div>
              <div style={{opacity:0.7,fontSize:12,marginTop:2}}>{c.game} • {c.score} • ⏳ {c.remainingH}ч / 24ч • {new Date(c.expires_at).toLocaleString("ru-RU")}</div>
            </div>
            <button onClick={()=> doAccept(c.id)} style={{padding:"8px 14px",borderRadius:10,border:"1px solid #00ff88",background:"rgba(0,255,136,0.14)",color:"#00ff88",fontWeight:800,cursor:"pointer"}}>Принять → дуэль</button>
          </div>
        ))}
      </div>

      <div style={{display:"flex",gap:8,marginTop:14,alignItems:"center"}}>
        <button onClick={()=> setPage(p=> Math.max(1,p-1))} disabled={page===1} style={{padding:"7px 12px",borderRadius:8,opacity:page===1?0.4:1}}>‹ Назад</button>
        <span style={{opacity:0.6,fontSize:12}}>стр {page} • 20/стр</span>
        <button onClick={()=> setPage(p=>p+1)} style={{padding:"7px 12px",borderRadius:8}}>Вперёд ›</button>
        {challengeMsg && <span style={{marginLeft:8,color:"#7cff7c",fontSize:12}}>{challengeMsg}</span>}
        {msg && <span style={{marginLeft:8,color:"#ffcc00",fontSize:12}}>{msg}</span>}
      </div>

      <canvas ref={shareCanvasRef} width={1080} height={1080} style={{display:"none"}} />
      {shareUrl && <div style={{opacity:0.5,fontSize:11,marginTop:8,wordBreak:"break-all"}}>QR → {shareUrl}</div>}
      <style>{`@keyframes crownPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}} @keyframes conicSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
