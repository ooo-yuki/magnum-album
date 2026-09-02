import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import gsap from "gsap";
import styles from "./Chain42Page.module.css";
import { CHAIN_RULES, LINK_TYPES, chainMult, formatChainClock, type LinkTypeId } from "../lib/chain42";
import { subscribeMe } from "../lib/authMe";

type ChainMeResp = {
  chain: null | { id:number; root_user_id:number; code:string; length:number; created_at:string; expires_at:string; broken:boolean; remainMs:number; mult:number };
  links?: { id:number; userId:number; username:string; joined_at:string; challenge_type:string }[];
  length?: number; mult?:number; remainMs?:number; broken?:boolean; code?:string; link?:string;
};
type FeedResp = { ok?:boolean; feed:{ id:number; code:string; length:number; root_username:string; username:string; mult:number; remainMs:number; rank:number; crown:boolean; isTop3:boolean }[] };
type CodeResp = { ok?:boolean; chain:{ id:number; code:string; length:number; expires_at:string; broken:boolean; remainMs:number; mult:number; root_username:string }; links:{ userId:number; username:string; joined_at:string; challenge_type:string }[]; code:string; link:string; broken:boolean };
type CreateResp = { ok?:boolean; code:string; link:string; length:number; mult?:number; remainMs?:number; reward?:number; error?:string };
type JoinResp = { ok?:boolean; reward:number; bankBonus:number; balance?:number; length:number; mult:number; error?:string };

const QUIZ_BANK: { q:string; a:string[]; correct:number }[] = [
  { q:"MAGNUM — сколько треков?", a:["5","7","10","12"], correct:0 },
  { q:"42 братухи — лозунг?", a:["Кринжа не существует","VPN в чартах","Туса медуза","Кузбасс 42"], correct:0 },
  { q:"ТУСА МЕДУЗА — сколько клипов?", a:["8K","42","1K","200K"], correct:0 },
  { q:"5opka — дата рождения?", a:["05.04.1996","01.01.2000","42.42.2042","14.02.1995"], correct:0 },
  { q:"Цепь 42 — сколько часов держится?", a:["42","24","12","72"], correct:0 },
];

export function Chain42Page(){
  const { code: joinCodeParam } = useParams<{code:string}>();
  const isJoin = !!joinCodeParam;
  return isJoin ? <ChainJoinView code={joinCodeParam!} /> : <ChainMainView />;
}

function ChainMainView(){
  const wrapRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<HTMLDivElement>(null);
  const prevRemainRef = useRef<number>(0);
  const nav = useNavigate();
  const [me, setMe] = useState<{id:number;username:string}|null>(null);
  const [chain, setChain] = useState<ChainMeResp["chain"]>(null);
  const [links, setLinks] = useState<NonNullable<ChainMeResp["links"]>>([]);
  const [length, setLength] = useState(0);
  const [remainMs, setRemainMs] = useState(0);
  const [mult, setMult] = useState(1);
  const [broken, setBroken] = useState(false);
  const [code, setCode] = useState<string|null>(null);
  const [feed, setFeed] = useState<FeedResp["feed"]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [shareOk, setShareOk] = useState(false);
  const [showChallenge, setShowChallenge] = useState(false);
  const [picked, setPicked] = useState<LinkTypeId>("click-10s");
  const [creating, setCreating] = useState(false);
  const [createdLink, setCreatedLink] = useState<string|null>(null);
  const [createdCode, setCreatedCode] = useState<string|null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // challenge state
  const [phase, setPhase] = useState<"pick"|"playing"|"success">("pick");
  const [clicks, setClicks] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10);
  const [quizIdx] = useState(()=> Math.floor(Math.random()*QUIZ_BANK.length));
  const [quizAns, setQuizAns] = useState<number|null>(null);
  const [memSeq] = useState<number[]>(()=> Array.from({length:4},()=> Math.floor(Math.random()*4)));
  const [memInput, setMemInput] = useState<number[]>([]);
  const [memShow, setMemShow] = useState(true);
  const timerTickRef = useRef<number|null>(null);
  const challengeTimerRef = useRef<number|null>(null);

  useEffect(()=> subscribeMe(setMe), []);

  const loadMe = useCallback(async()=>{
    setLoading(true); setErr("");
    try{
      const r = await fetch("/magnum/api/chain/me",{credentials:"include"});
      const j = await r.json() as ChainMeResp & {error?:string};
      if(r.ok){
        setChain(j.chain ?? null);
        setLinks((j.links ?? []) as typeof links);
        setLength(Number(j.length ?? j.chain?.length ?? 0));
        setRemainMs(Number(j.remainMs ?? j.chain?.remainMs ?? 0));
        setMult(Number(j.mult ?? j.chain?.mult ?? 1));
        setBroken(Boolean(j.broken ?? j.chain?.broken ?? false));
        setCode(j.code ?? j.chain?.code ?? null);
      } else setErr(j.error||"Ошибка загрузки");
    }catch{ setErr("Сеть"); }
    setLoading(false);
  },[]);
  const loadFeed = useCallback(async()=>{
    try{
      const r=await fetch("/magnum/api/chain/feed",{credentials:"include"});
      const j=await r.json() as FeedResp & {error?:string};
      if(Array.isArray(j.feed)) setFeed(j.feed);
      else if(Array.isArray((j as unknown as {top:unknown[]}).top)) setFeed((j as unknown as {top:FeedResp["feed"]}).top);
    }catch{}
  },[]);
  useEffect(()=>{ loadMe(); loadFeed(); },[loadMe, loadFeed]);

  // countdown 42h ticker 1s + flip 0.4s
  useEffect(()=>{
    if(!chain || broken) return;
    const base = remainMs;
    const start = Date.now();
    const id = window.setInterval(()=>{
      const elapsed = Date.now() - start;
      const cur = Math.max(0, base - elapsed);
      if(cur!==prevRemainRef.current){
        if(timerRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches && Math.floor(cur/1000)!==Math.floor(prevRemainRef.current/1000)){
          gsap.fromTo(timerRef.current,{y:-8,opacity:0.6},{y:0,opacity:1,duration:0.4,ease:"power2.out"});
        }
        prevRemainRef.current = cur;
        setRemainMs(cur);
        if(cur===0){ setBroken(true); window.clearInterval(id); }
      }
    }, 1000);
    return ()=> window.clearInterval(id);
  },[chain, broken, remainMs]);

  useEffect(()=>{
    if(!linksRef.current) return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const dots = linksRef.current.querySelectorAll<HTMLElement>("[data-link-dot]");
    if(!dots.length) return;
    const ctx = gsap.context(()=>{
      gsap.set(dots,{y:16,opacity:0,scale:0.9});
      gsap.to(dots,{y:0,opacity:1,scale:1,stagger:0.07,duration:0.9,ease:"power2.out"});
    }, linksRef);
    return ()=> ctx.revert();
  },[links]);

  useEffect(()=>{
    if(!feedRef.current) return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rows = feedRef.current.querySelectorAll<HTMLElement>("[data-feed-row]");
    if(!rows.length) return;
    const ctx = gsap.context(()=>{
      gsap.set(rows,{x:24,opacity:0});
      gsap.to(rows,{x:0,opacity:1,stagger:0.06,duration:0.3,ease:"power2.out"});
    }, feedRef);
    return ()=> ctx.revert();
  },[feed]);

  // confetti 120 on +1 звено
  function spawnConfetti(count=120){
    if(!wrapRef.current) return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for(let i=0;i<count;i++){
      const d=document.createElement("div");
      d.className=styles.confetti;
      d.style.left="50%"; d.style.top="42%";
      d.style.background= i%3===0?"#ff2d55": i%3===1?"#00ff88":"#ffcc00";
      wrapRef.current.appendChild(d);
      const ang=Math.random()*Math.PI*2, dist=60+Math.random()*220;
      gsap.to(d,{x:Math.cos(ang)*dist, y:Math.sin(ang)*dist+70, rotation:Math.random()*720, opacity:0, duration:0.8+Math.random()*0.5, ease:"power2.out", onComplete:()=> d.remove()});
    }
  }

  function openChallenge(){
    setShowChallenge(true); setPhase("pick"); setClicks(0); setTimeLeft(LINK_TYPES.find(t=>t.id===picked)?.durationSec ?? 10);
    setQuizAns(null); setMemInput([]); setMemShow(true);
    setTimeout(()=> setMemShow(false), 1200);
  }
  function startChallenge(id: LinkTypeId){
    setPicked(id); setPhase("playing");
    const meta = LINK_TYPES.find(t=> t.id===id)!;
    setTimeLeft(meta.durationSec); setClicks(0); setQuizAns(null); setMemInput([]); setMemShow(true);
    if(id==="mem-like") setTimeout(()=> setMemShow(false), 1100);
    if(challengeTimerRef.current) window.clearInterval(challengeTimerRef.current);
    const iv = window.setInterval(()=>{
      setTimeLeft(prev=>{
        if(prev<=1){ window.clearInterval(iv); challengeTimerRef.current=null; if(id==="click-10s") handleChallengeFail(); return 0; }
        return prev-1;
      });
    },1000);
    challengeTimerRef.current = iv as unknown as number;
  }
  function handleChallengeFail(){
    if(challengeTimerRef.current) { window.clearInterval(challengeTimerRef.current); challengeTimerRef.current=null; }
    setPhase("pick");
  }
  function handleChallengeSuccess(){
    if(challengeTimerRef.current) { window.clearInterval(challengeTimerRef.current); challengeTimerRef.current=null; }
    setPhase("success");
    // auto-create after 0.4s
    setTimeout(()=> doCreate(picked), 400);
  }

  // click challenge tick
  function handleClickStormTap(){
    if(phase!=="playing" || picked!=="click-10s") return;
    const next = clicks+1;
    setClicks(next);
    if(next>=42){ handleChallengeSuccess(); }
  }
  function handleQuizPick(idx:number){
    if(phase!=="playing" || picked!=="quiz-1q") return;
    if(quizAns!==null) return;
    setQuizAns(idx);
    const correct = QUIZ_BANK[quizIdx]!.correct;
    setTimeout(()=>{
      if(idx===correct) handleChallengeSuccess(); else handleChallengeFail();
    }, 300);
  }
  function handleMemPick(v:number){
    if(phase!=="playing" || picked!=="mem-like") return;
    if(memShow) return;
    const next=[...memInput, v];
    setMemInput(next);
    const exp = memSeq[next.length-1];
    if(v!==exp){ handleChallengeFail(); setMemInput([]); return; }
    if(next.length===memSeq.length) handleChallengeSuccess();
  }

  async function doCreate(challenge_type: LinkTypeId){
    setCreating(true);
    try{
      const r=await fetch("/magnum/api/chain/create",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({challenge_type})});
      const j=await r.json() as CreateResp;
      if(!r.ok){ setErr(j.error||"Ошибка создания"); setCreating(false); return; }
      setCreatedCode(j.code); setCreatedLink(j.link);
      spawnConfetti(120);
      // pulse on active chain
      if(wrapRef.current){
        const el = wrapRef.current.querySelector<HTMLElement>("[data-chain-card]");
        if(el && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.fromTo(el,{scale:1},{scale:1.08,duration:0.22,yoyo:true,repeat:1,ease:"power2.out"});
      }
      await loadMe(); await loadFeed();
      setShowChallenge(false); setPhase("pick");
    }catch{ setErr("Сеть"); }
    setCreating(false);
  }

  async function doShare(){
    const canvas=canvasRef.current;
    if(!canvas) return;
    canvas.width=1080; canvas.height=1920;
    const ctx=canvas.getContext("2d")!;
    const grad=ctx.createLinearGradient(0,0,1080,1920);
    grad.addColorStop(0,"#0a0a0a"); grad.addColorStop(0.55,"#1a1020"); grad.addColorStop(1,"#ff2d55");
    ctx.fillStyle=grad; ctx.fillRect(0,0,1080,1920);
    ctx.fillStyle="#fff"; ctx.font="900 84px Inter, sans-serif"; ctx.fillText("ЦЕПЬ 42 🔗",48,120);
    ctx.fillStyle="rgba(255,255,255,.92)"; ctx.font="700 36px Inter, sans-serif"; ctx.fillText(`братуха ${me?.username ?? "Братуха"} • длина ${length} • x${mult}`,48,190);
    ctx.fillStyle="#ffcc00"; ctx.font="600 28px Inter, sans-serif"; ctx.fillText(`42ч до обрыва • ${formatChainClock(remainMs)}`,48,250);
    ctx.fillStyle="rgba(255,255,255,.06)"; (ctx as unknown as {roundRect?:unknown}).roundRect ? null : null;
    // code block
    ctx.fillStyle="rgba(255,255,255,.06)"; ctx.fillRect(48,320,984,220);
    ctx.strokeStyle="rgba(255,255,255,.12)"; ctx.strokeRect(48,320,984,220);
    ctx.fillStyle="#fff"; ctx.font="700 26px Inter, sans-serif"; ctx.fillText("Код цепи",78,380);
    const disp = code ?? createdCode ?? "----";
    ctx.fillStyle="#ffcc00"; ctx.font="900 96px monospace"; ctx.fillText(disp,78,470);
    ctx.fillStyle="rgba(255,255,255,.7)"; ctx.font="400 22px Inter, sans-serif"; ctx.fillText(`/magnum/chain/join/${disp} • кинь звено другу`,78,520);
    // QR placeholder
    ctx.fillStyle="#fff"; ctx.fillRect(340,680,400,400);
    ctx.fillStyle="#111"; ctx.font="900 48px monospace"; ctx.fillText("QR",510,880);
    ctx.fillStyle="#555"; ctx.font="400 18px monospace"; ctx.fillText(`magnum/chain/join/${disp}`,360,930);
    ctx.fillStyle="rgba(255,255,255,.8)"; ctx.font="400 22px Inter, sans-serif"; ctx.fillText("MAGNUM • ЦЕПЬ 42 • 42 часа без обрыва",48,1860);
    ctx.fillStyle="rgba(255,255,255,.55)"; ctx.font="400 18px Inter, sans-serif"; ctx.fillText(`5opka.ru/magnum/chain • цепь ${disp} • ${new Date().toISOString().slice(0,10)}`,48,1890);
    try{
      const blob:Blob = await new Promise(res=> canvas.toBlob(b=> res(b!), "image/png")!);
      const file=new File([blob], `chain-42-${disp}.png`,{type:"image/png"});
      if(navigator.canShare && navigator.canShare({files:[file]})){
        await navigator.share({ title:`ЦЕПЬ 42 — ${disp} длина ${length}`, text:`Моя цепь ${length} звеньев • ${formatChainClock(remainMs)} до обрыва • вступай /magnum/chain/join/${disp}`, files:[file] });
      } else {
        const a=document.createElement("a"); a.href=canvas.toDataURL("image/png"); a.download=`chain-42-${disp}.png`; a.click();
      }
    }catch{ /* cancel */ }
    try{
      const r=await fetch("/magnum/api/chain/share",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({})});
      const j=await r.json() as { ok?:boolean; coins?:number; balance?:number; error?:string };
      if(r.ok && j.ok){ setShareOk(true); spawnConfetti(120); }
      else if(r.status===409) setShareOk(true);
    }catch{}
  }

  if(loading) return <div style={{padding:"4rem 2rem",textAlign:"center",color:"#ff2d55"}}>Загрузка…</div>;

  return (
    <div ref={wrapRef} className={styles.page} style={{position:"relative"}}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>ЦЕПЬ 42 <span>— челлендж-цепочка</span></div>
          <div className={styles.sub}>42ч без обрыва • длина N • mult x1.05 кап x2.0 • 1 звено/час • 1 приём/день • шаринг +42/день • OG 1080×1920</div>
        </div>
      </div>

      <div className={styles.card} data-chain-card style={{marginTop:14}}>
        <div className={styles.chainRow}>
          <span className={styles.badge}>длина {length || 0} звеньев</span>
          <span className={styles.badge}>mult x{mult}</span>
          {code && <span className={styles.badge}>код {code}</span>}
          {broken && <span className={styles.badge} style={{background:"rgba(255,45,85,.2)",borderColor:"rgba(255,45,85,.4)"}}>ОБРЫВ</span>}
          {!broken && length>0 && <span className={styles.badge} style={{background:"rgba(0,255,136,.12)",borderColor:"rgba(0,255,136,.3)"}}>активна</span>}
          <span style={{marginLeft:"auto",opacity:.6,fontSize:12}}>{err || (me? `братуха ${me.username}`: "войди чтобы создать цепь")}</span>
        </div>

        <div ref={timerRef} className={`${styles.timer} ${!broken && length>0 ? styles.pulse : ""}`} style={{marginTop:10}}>
          {broken ? "00:00:00 • ОБРЫВ" : formatChainClock(remainMs)} <span>до обрыва • топ-1 👑 +1420 epic</span>
        </div>

        <div ref={linksRef} className={styles.linkList}>
          {links.length===0 ? <span style={{opacity:.6,fontSize:13,padding:"8px 0"}}>{length===0 ? "Цепи ещё нет — кинь первое звено" : "Звенья загружаются…"}</span>
            : links.map((l, idx)=> (
            <div key={l.id} data-link-dot className={`${styles.linkDot} ${idx===links.length-1 && !broken ? styles.linkDotActive : ""}`} title={`${l.username} • ${l.challenge_type}`}>
              {idx===0 ? "⚓" : idx===links.length-1 ? "🔗" : "⭕"}
              <span style={{fontSize:9,opacity:.6,position:"absolute",marginTop:34}}>{String(l.challenge_type).slice(0,4)}</span>
            </div>
          ))}
        </div>
        <div style={{opacity:.6,fontSize:12,marginTop:6}}>Длина = кол-во звеньев • каждое +5% к наградам цепи (кап x2.0) • цепь рвётся через 42ч без нового звена</div>

        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:14}}>
          <button className={styles.btn} onClick={openChallenge} disabled={creating}>Кинуть звено другу</button>
          {code && <button className={styles.btnGhost} onClick={()=>{ const link=`${window.location.origin}/magnum/chain/join/${code}`; navigator.clipboard.writeText(link).then(()=> setErr("Ссылка скопирована ✓")).catch(()=>{}); }}>Копировать ссылку</button>}
          <button className={styles.btnGhost} onClick={doShare} disabled={shareOk && false}>Поделиться цепью +42/день</button>
          <button className={styles.btnGhost} onClick={()=> { loadMe(); loadFeed(); }}>Обновить</button>
        </div>
        {createdLink && <div style={{marginTop:10,background:"rgba(0,255,136,.08)",border:"1px solid rgba(0,255,136,.2)",borderRadius:12,padding:12}}>
          <div style={{fontWeight:800}}>Звено создано! Код <span style={{fontFamily:"monospace",fontSize:20,color:"#ffcc00"}}>{createdCode}</span></div>
          <div style={{opacity:.7,fontSize:13,marginTop:4}}>{window.location.origin}{createdLink} • кинь другу, он должен принять ≤42ч → цепь +1, оба +42 (×mult)</div>
          <div className={styles.qrBox}>QR<br/><span style={{fontSize:12,opacity:.6}}>/magnum/chain/join/{createdCode}</span></div>
          <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:8}}>
            <button className={styles.btnGhost} onClick={()=>{ navigator.clipboard.writeText(`${window.location.origin}${createdLink}`); }}>Копировать</button>
            <button className={styles.btnShare} onClick={doShare}>Шаринг 1080×1920</button>
          </div>
        </div>}
        {err && <div style={{marginTop:10,color:"#ffcc00",fontSize:13}}>{err}</div>}
      </div>

      <div className={styles.card} style={{marginTop:14}}>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <strong>Лента топ-цепей</strong>
          <span className={styles.badge}>топ-10 • crown 👑</span>
          <button onClick={loadFeed} className={styles.btnGhost} style={{marginLeft:"auto",padding:"6px 10px"}}>Обновить</button>
        </div>
        <div ref={feedRef} className={styles.feed}>
          {feed.length===0 && <div style={{opacity:.6,padding:16,textAlign:"center",border:"1px dashed rgba(255,255,255,.12)",borderRadius:12}}>Пока пусто — стань первым!</div>}
          {feed.map(it=> (
            <div key={it.id} data-feed-row className={`${styles.feedRow} ${me && it.root_username===me.username ? styles.feedMe : ""}`}>
              <div className={styles.rank}>{it.rank}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:800,fontSize:13,display:"flex",gap:6}}><span>{it.username}</span><span style={{opacity:.5,fontFamily:"monospace",fontSize:12}}>{it.code}</span><span style={{marginLeft:"auto"}}>длина {it.length} • x{it.mult}</span></div>
                <div style={{opacity:.6,fontSize:11}}>{formatChainClock(it.remainMs)} до обрыва • {it.crown ? "👑 топ-1" : it.isTop3 ? "топ-3" : `топ-${it.rank}`}</div>
              </div>
              {it.crown && <span style={{padding:"2px 6px",borderRadius:6,background:"linear-gradient(90deg,#ffcc00,#ff2d55)",color:"#111",fontWeight:800,fontSize:11}}>👑 +1420</span>}
              {it.rank===2 && <span style={{padding:"2px 6px",borderRadius:6,background:"rgba(255,204,0,.18)",color:"#ffcc00",fontWeight:800,fontSize:11}}>+420</span>}
              {it.rank===3 && <span style={{padding:"2px 6px",borderRadius:6,background:"rgba(0,255,136,.14)",color:"#00ff88",fontWeight:800,fontSize:11}}>+420</span>}
              <button className={styles.btnGhost} style={{padding:"6px 10px",fontSize:12}} onClick={()=> nav(`/magnum/chain/join/${it.code}`)}>Вступить</button>
            </div>
          ))}
        </div>
      </div>

      <canvas ref={canvasRef} width={1080} height={1920} style={{display:"none"}} />

      {showChallenge && (
        <div className={styles.modal} onClick={()=> setShowChallenge(false)}>
          <div className={styles.modalCard} onClick={e=> e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:900}}>Кинуть звено — выбери челлендж</div>
            <div style={{opacity:.6,fontSize:12,marginTop:4}}>1 звено/час • 1 приём/день • IP 5/мин • шаринг цепи +42/день</div>

            {phase==="pick" && (
              <div className={styles.challengeGrid}>
                {LINK_TYPES.map(t=> (
                  <button key={t.id} onClick={()=> setPicked(t.id)} className={`${styles.challengeCard} ${picked===t.id? styles.challengeActive:""}`}>
                    <div style={{fontSize:20}}>{t.icon}</div>
                    <h4>{t.title}</h4>
                    <p>{t.desc}</p>
                    <div style={{marginTop:6,opacity:.5,fontSize:11}}>{t.durationSec}с • цель {t.target}</div>
                  </button>
                ))}
              </div>
            )}

            {phase==="pick" && (
              <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:14}}>
                <button className={styles.btn} onClick={()=> startChallenge(picked)}>Начать {LINK_TYPES.find(t=>t.id===picked)?.shortTitle}</button>
                <button className={styles.btnGhost} onClick={()=> setShowChallenge(false)}>Отмена</button>
              </div>
            )}

            {phase==="playing" && picked==="click-10s" && (
              <div style={{marginTop:14}}>
                <div style={{fontSize:42,fontWeight:900}}>{timeLeft}с</div>
                <div style={{opacity:.7,fontSize:13}}>Накликай 42 за 10с — {clicks}/42</div>
                <button onClick={handleClickStormTap} style={{marginTop:12,width:"100%",height:96,borderRadius:12,border:"1px dashed rgba(255,45,85,.35)",background:"rgba(255,45,85,.08)",fontSize:22,fontWeight:900,cursor:"pointer"}}>ЖМИ! 👊 {clicks}</button>
              </div>
            )}
            {phase==="playing" && picked==="quiz-1q" && (
              <div style={{marginTop:14,textAlign:"left"}}>
                <div style={{fontWeight:800}}>{QUIZ_BANK[quizIdx]!.q}</div>
                <div style={{display:"grid",gap:8,marginTop:10}}>
                  {QUIZ_BANK[quizIdx]!.a.map((opt,i)=> (
                    <button key={i} onClick={()=> handleQuizPick(i)} style={{padding:"10px 12px",borderRadius:8,border: quizAns===i? "1px solid #ffcc00":"1px solid rgba(255,255,255,.12)",background: quizAns===i? "rgba(255,204,0,.12)":"rgba(255,255,255,.04)",color:"#fff",cursor:"pointer",textAlign:"left"}}>{opt}</button>
                  ))}
                </div>
                <div style={{opacity:.6,fontSize:12,marginTop:8}}>{timeLeft}с осталось</div>
              </div>
            )}
            {phase==="playing" && picked==="mem-like" && (
              <div style={{marginTop:14}}>
                <div style={{opacity:.7,fontSize:12}}>{memShow ? "Запомни" : "Повтори"} • {timeLeft}с</div>
                <div style={{display:"flex",gap:10,justifyContent:"center",marginTop:10}}>
                  {[0,1,2,3].map(v=> (
                    <button key={v} onClick={()=> handleMemPick(v)} style={{width:56,height:56,borderRadius:12,border: memShow && memSeq.includes(v) ? "2px solid #ffcc00":"1px solid rgba(255,255,255,.12)",background: memShow && memSeq[memInput.length]===v ? "rgba(255,204,0,.2)" : memInput.includes(v) ? "rgba(0,255,136,.14)":"rgba(255,255,255,.06)",fontSize:18,cursor:"pointer"}}>{["🔴","🟢","🔵","🟡"][v]}</button>
                  ))}
                </div>
                <div style={{opacity:.6,fontSize:11,marginTop:8}}>Введи {memInput.length}/{memSeq.length}</div>
              </div>
            )}

            {phase==="success" && <div style={{marginTop:14,color:"#00ff88",fontWeight:800}}>Челлендж пройден! Создаём звено…</div>}
            <div style={{marginTop:10,opacity:.5,fontSize:11}}>Создание звена 0 монет • приём +42 обоим +10% банка • top-1 +1420 chain-crown epic</div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChainJoinView({ code }: { code:string }){
  const nav = useNavigate();
  const [me, setMe] = useState<{id:number;username:string}|null>(null);
  const [data, setData] = useState<CodeResp|null>(null);
  const [err, setErr] = useState("");
  const [picked, setPicked] = useState<LinkTypeId>("quiz-1q");
  const [phase, setPhase] = useState<"pick"|"playing"|"done">("pick");
  const [joining, setJoining] = useState(false);
  const [result, setResult] = useState<JoinResp|null>(null);
  const [showChallenge, setShowChallenge] = useState(false);
  // reused challenge state minimal for join
  const [timeLeft, setTimeLeft] = useState(10);
  const [clicks, setClicks] = useState(0);
  const [quizAns, setQuizAns] = useState<number|null>(null);
  const quizIdx = Math.floor(Math.random()*QUIZ_BANK.length) % QUIZ_BANK.length;
  const memSeq = [0,1,2,3].slice(0,4).map(()=> Math.floor(Math.random()*4));
  const timerRef = useRef<number|null>(null);

  useEffect(()=> subscribeMe(setMe), []);
  useEffect(()=>{
    (async()=>{
      try{
        const r=await fetch(`/magnum/api/chain/join/${encodeURIComponent(code)}`,{credentials:"include"});
        const j=await r.json() as CodeResp & {error?:string};
        if(r.ok) setData(j); else setErr(j.error||"Цепь не найдена");
      }catch{ setErr("Сеть"); }
    })();
  },[code]);

  function startChallenge(id: LinkTypeId){
    setPicked(id); setPhase("playing"); setClicks(0); setQuizAns(null); setTimeLeft(LINK_TYPES.find(t=>t.id===id)?.durationSec ?? 10);
    if(timerRef.current) window.clearInterval(timerRef.current);
    const iv=window.setInterval(()=> setTimeLeft(p=> p<=1? (window.clearInterval(iv),0): p-1),1000);
    timerRef.current=iv as unknown as number;
  }
  async function doJoin(challenge_type: LinkTypeId){
    setJoining(true); setErr("");
    try{
      const r=await fetch("/magnum/api/chain/join",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({code, challenge_type})});
      const j=await r.json() as JoinResp & {error?:string; balance?:number};
      if(!r.ok){ setErr(j.error||"Ошибка"); setJoining(false); return; }
      setResult(j as JoinResp); setPhase("done");
      if(timerRef.current) window.clearInterval(timerRef.current);
    }catch{ setErr("Сеть"); }
    setJoining(false);
  }
  function handleClick(){
    const n=clicks+1; setClicks(n); if(n>=42) doJoin("click-10s");
  }
  function handleQuiz(idx:number){
    if(quizAns!==null) return; setQuizAns(idx);
    const correct=QUIZ_BANK[quizIdx]!.correct;
    setTimeout(()=> { if(idx===correct) doJoin("quiz-1q"); else setErr("Неверно — попробуй другой челлендж"); },300);
  }

  if(err && !data) return <div style={{maxWidth:980,margin:"0 auto",padding:"24px 16px",color:"#e8e8ef"}}><div style={{padding:32,textAlign:"center",border:"1px solid rgba(255,45,85,.3)",borderRadius:18,background:"rgba(255,45,85,.08)"}}><div style={{fontWeight:900,fontSize:20}}>ЦЕПЬ {code} — {err}</div><button onClick={()=> nav("/magnum/chain")} style={{marginTop:12,padding:"10px 16px",borderRadius:12,border:"1px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.06)",color:"#fff",cursor:"pointer"}}>К цепям</button></div></div>;
  if(!data) return <div style={{padding:"4rem 2rem",textAlign:"center",color:"#ff2d55"}}>Загрузка цепи {code}…</div>;

  return (
    <div style={{maxWidth:980,margin:"0 auto",padding:"24px 16px",color:"#e8e8ef"}}>
      <div className={styles.card}>
        <div style={{fontSize:28,fontWeight:900}}>ЦЕПЬ {data.code} <span style={{color:"#ff2d55"}}>— вступление</span></div>
        <div style={{opacity:.7,marginTop:6,fontSize:13}}>братуха {data.chain.root_username} • длина {data.chain.length} • x{data.chain.mult} • {data.broken? "ОБРЫВ": formatChainClock(data.chain.remainMs)+" до обрыва"}</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
          {data.links.slice(0,12).map(l=> <span key={l.userId+String(l.joined_at)} style={{padding:"6px 10px",borderRadius:999,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)",fontSize:12}}>{l.username} • {l.challenge_type}</span>)}
        </div>
        <div style={{marginTop:14,display:"flex",gap:8}}>
          <button className={styles.btn} onClick={()=> setShowChallenge(true)} disabled={joining || data.broken}>Вступить в цепь +42</button>
          <button className={styles.btnGhost} onClick={()=> nav("/magnum/chain")}>К ленте</button>
        </div>
        {data.broken && <div style={{marginTop:10,color:"#ff2d55",fontSize:13}}>Цепь оборвана — 42ч истекли, создай свою</div>}
        {err && <div style={{marginTop:10,color:"#ffcc00",fontSize:13}}>{err}</div>}
        {result && <div style={{marginTop:12,padding:12,borderRadius:12,background:"rgba(0,255,136,.08)",border:"1px solid rgba(0,255,136,.2)"}}><div style={{fontWeight:900,color:"#00ff88"}}>Вступил! Цепь теперь {result.length} • +{result.reward} монет (×{result.mult} + банк {result.bankBonus})</div><div style={{opacity:.7,fontSize:12}}>Баланс {result.balance} • mult x{result.mult} — с каждым звеном +5% к наградам (кап x2.0)</div></div>}
      </div>

      {showChallenge && (
        <div className={styles.modal} onClick={()=> setShowChallenge(false)}>
          <div className={styles.modalCard} onClick={e=> e.stopPropagation()}>
            <div style={{fontWeight:900}}>Челлендж для вступления</div>
            <div style={{opacity:.6,fontSize:12}}>Выбери один — докажи что братуха</div>
            <div className={styles.challengeGrid}>
              {LINK_TYPES.map(t=> (
                <button key={t.id} onClick={()=> startChallenge(t.id)} className={`${styles.challengeCard} ${picked===t.id? styles.challengeActive:""}`}>
                  <div style={{fontSize:20}}>{t.icon}</div><h4>{t.title}</h4><p>{t.desc}</p>
                </button>
              ))}
            </div>
            {phase==="playing" && picked==="click-10s" && (
              <div style={{marginTop:12}}>
                <div>{timeLeft}с • {clicks}/42</div>
                <button onClick={handleClick} style={{marginTop:8,width:"100%",height:72,borderRadius:12,border:"1px dashed rgba(255,45,85,.3)",background:"rgba(255,45,85,.08)",fontWeight:900}}>ЖМИ {clicks}</button>
              </div>
            )}
            {phase==="playing" && picked==="quiz-1q" && (
              <div style={{marginTop:12,textAlign:"left"}}>
                <div style={{fontWeight:800}}>{QUIZ_BANK[quizIdx].q}</div>
                <div style={{display:"grid",gap:6,marginTop:8}}>{QUIZ_BANK[quizIdx].a.map((opt,i)=> <button key={i} onClick={()=> handleQuiz(i)} style={{padding:"8px 10px",borderRadius:8,border:"1px solid rgba(255,255,255,.12)",background: quizAns===i?"rgba(255,204,0,.12)":"rgba(255,255,255,.04)",color:"#fff"}}>{opt}</button>)}</div>
              </div>
            )}
            {phase==="playing" && picked==="mem-like" && (
              <div style={{marginTop:12}}>
                <div style={{opacity:.7,fontSize:12}}>Нажми 4 цвета подряд — любой набор засчитается для MVP</div>
                <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:8}}>{[0,1,2,3].map(v=> <button key={v} onClick={()=> doJoin("mem-like")} style={{width:48,height:48,borderRadius:8,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)"}}>{["🔴","🟢","🔵","🟡"][v]}</button>)}</div>
              </div>
            )}
            <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:12}}>
              <button className={styles.btn} onClick={()=> doJoin(picked)} disabled={joining}>{joining? "Вступаем…":"Вступить без челленджа (dev)"}</button>
              <button className={styles.btnGhost} onClick={()=> setShowChallenge(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
