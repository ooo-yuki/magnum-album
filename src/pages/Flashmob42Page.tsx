import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import styles from "./Flashmob42Page.module.css";
import { FLASHMOB_TYPES, getFlashmobForDay, todayDayString, seededQuizForDay, seededMemorySequence, type QuizQ } from "../lib/flashmob42";
import { subscribeMe } from "../lib/authMe";
import { GuestGate } from "../components/GuestGate";

type TodayResp = { ok?:boolean; day:string; type:string; title:string; shortTitle?:string; desc?:string; seed:number; durationSec:number; target:number; icon?:string; myScore?:number|null; myRank?:number|null; count?:number };
type LbItem = { userId:number; username:string; score:number; rank:number; avatar:string|null; created_at:string };
type SubmitResp = { ok?:boolean; score:number; rank:number; count:number; pct:number; coins?:number; streak?:number; topReward?:number; error?:string };

function useToday(){
  const [today, setToday] = useState<TodayResp|null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(async()=>{
    try{
      const r = await fetch("/magnum/api/flashmob/today", { credentials:"include" });
      const j = await r.json() as TodayResp & { error?:string };
      if(r.ok) setToday(j as TodayResp);
      else setErr(j.error||"Ошибка");
    }catch{ setErr("Сеть"); }
  },[]);
  useEffect(()=>{ load(); },[load]);
  return { today, err, reload: load };
}

export function Flashmob42Page(){
  const wrapRef = useRef<HTMLDivElement>(null);
  const lbRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLDivElement>(null);
  const countdownRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { today, err, reload } = useToday();
  const day = today?.day ?? todayDayString();
  const typeId = today?.type ?? getFlashmobForDay(day).id;
  const typeMeta = FLASHMOB_TYPES.find(t=> t.id===typeId) ?? FLASHMOB_TYPES[0]!;

  const [phase, setPhase] = useState<"idle"|"countdown"|"playing"|"finished">("idle");
  const [countdown, setCountdown] = useState<number|null>(null);
  const [timeLeft, setTimeLeft] = useState(42);
  const [score, setScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LbItem[]>([]);
  const [myRank, setMyRank] = useState<number|null>(null);
  const [myScore, setMyScore] = useState<number|null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [msg, setMsg] = useState("");
  const [shareOk, setShareOk] = useState(false);
  const [showResult, setShowResult] = useState<SubmitResp|null>(null);
  const [me, setMe] = useState<{id:number;username:string}|null>(null);

  // quiz/memory seeded state
  const [quizQs, setQuizQs] = useState<QuizQ[]>(()=> seededQuizForDay(day, 7));
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizAns, setQuizAns] = useState<number|null>(null);
  const [memSeq, setMemSeq] = useState<number[]>(()=> seededMemorySequence(day, 6));
  const [memInput, setMemInput] = useState<number[]>([]);
  const [memShow, setMemShow] = useState(false);
  const tickRef = useRef<number|null>(null);

  useEffect(()=>{
    return subscribeMe(setMe);
  },[]);
  useEffect(()=>{ if(today) { setQuizQs(seededQuizForDay(today.day,7)); setMemSeq(seededMemorySequence(today.day,6)); } },[today?.day]);

  const loadLb = useCallback(async()=>{
    try{
      const r = await fetch(`/magnum/api/flashmob/leaderboard?day=${encodeURIComponent(day)}`,{credentials:"include"});
      const j = await r.json() as { ok?:boolean; items?:LbItem[]; myRank?:number|null; myScore?:number|null; count?:number };
      if(Array.isArray(j.items)) setLeaderboard(j.items.slice(0,10));
      if(typeof j.myRank==="number") setMyRank(j.myRank); else if(j.myRank===null) setMyRank(null);
      if(typeof j.myScore==="number") setMyScore(j.myScore); else if(j.myScore===null) setMyScore(null);
      if(typeof j.count==="number") setTotalCount(j.count);
    }catch{}
  },[day]);
  useEffect(()=>{ loadLb(); },[loadLb]);
  useEffect(()=>{
    if(today?.myRank!=null) setMyRank(today.myRank);
    if(today?.myScore!=null) setMyScore(today.myScore);
    if(typeof today?.count==="number") setTotalCount(today.count);
  },[today]);

  useEffect(()=>{
    if(!lbRef.current) return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rows = lbRef.current.querySelectorAll<HTMLElement>("[data-lb-row]");
    if(!rows.length) return;
    const ctx = gsap.context(()=>{
      gsap.set(rows,{y:14,opacity:0});
      gsap.to(rows,{y:0,opacity:1,stagger:0.05,duration:0.38,ease:"power2.out"});
    },lbRef);
    return ()=> ctx.revert();
  },[leaderboard]);

  useEffect(()=>{
    if(!scoreRef.current) return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(scoreRef.current,{scale:1.06},{scale:1,duration:0.05,ease:"power2.out"});
  },[score]);

  // cleanup tick
  useEffect(()=> ()=>{ if(tickRef.current) window.clearInterval(tickRef.current); },[]);

  function startCountdown(){
    if(phase!=="idle") return;
    setPhase("countdown");
    setCountdown(3);
    const seq = [3,2,1];
    let i=0;
    const id = window.setInterval(()=>{
      i++;
      if(i<seq.length){
        setCountdown(seq[i]!);
        if(countdownRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
          const el = countdownRef.current;
          gsap.set(el,{scale:0.6});
          gsap.to(el,{scale:1.4,duration:0.32,ease:"back.out(1.7)"});
        }
      } else {
        window.clearInterval(id);
        setCountdown(null);
        beginPlaying();
      }
    }, 600);
    // animate first 3 immediately
    if(countdownRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
      gsap.set(countdownRef.current,{scale:0.6});
      gsap.to(countdownRef.current,{scale:1.4,duration:0.32,ease:"back.out(1.7)"});
    }
    tickRef.current = id as unknown as number;
  }

  function beginPlaying(){
    setPhase("playing");
    setTimeLeft(42);
    setScore(0);
    setQuizIdx(0); setQuizAns(null); setMemInput([]); setMemShow(true);
    // memory show 1.2s
    setTimeout(()=> setMemShow(false), 1200);
    const id = window.setInterval(()=>{
      setTimeLeft(prev=>{
        if(prev<=1){
          window.clearInterval(id);
          finishGame();
          return 0;
        }
        return prev-1;
      });
    },1000);
    tickRef.current = id as unknown as number;
  }

  async function finishGame(){
    if(tickRef.current) { window.clearInterval(tickRef.current); tickRef.current=null; }
    setPhase("finished");
    // compute final score by type: for click-storm it's score; for quiz it's score; for others already
    const finalScore = score;
    // submit
    try{
      const r = await fetch("/magnum/api/flashmob/submit",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({ day, score: finalScore })});
      const j = await r.json() as SubmitResp & { error?:string; balance?:number };
      if(!r.ok){
        setMsg(j.error||"Ошибка отправки");
        setShowResult(null);
        loadLb();
        return;
      }
      setShowResult(j as SubmitResp);
      if(typeof j.rank==="number") setMyRank(j.rank);
      if(typeof j.count==="number") setTotalCount(j.count);
      setMyScore(finalScore);
      const pct = typeof j.pct==="number" ? j.pct : 0;
      setMsg(`Ты в топ-${pct}%!`);
      loadLb();
      // confetti burst 120 if top-10?
      if(wrapRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
        spawnConfetti(wrapRef.current,120);
        const burst = wrapRef.current.querySelector<HTMLElement>("[data-burst]");
        if(burst) gsap.fromTo(burst,{scale:1},{scale:1.4,duration:0.22,ease:"power2.out",yoyo:true,repeat:1});
      }
    }catch{ setMsg("Сеть — результат не сохранён"); }
  }

  function handleClickStorm(){
    if(phase!=="playing") return;
    if(typeId!=="click-storm" && typeId!=="dodge-wave") return;
    setScore(s=> s+1);
  }
  function handleQuizPick(idx:number){
    if(phase!=="playing" || typeId!=="eco-quiz") return;
    if(quizAns!==null) return;
    setQuizAns(idx);
    const correct = quizQs[quizIdx]?.correct ?? -1;
    const ok = idx===correct;
    if(ok) setScore(s=> s+6);
    setTimeout(()=>{
      if(quizIdx+1 >= quizQs.length){
        // quiz loop: reshuffle same set
        setQuizIdx(0); setQuizAns(null);
      } else {
        setQuizIdx(i=> i+1); setQuizAns(null);
      }
    },320);
  }
  function handleMemPick(v:number){
    if(phase!=="playing" || typeId!=="memory") return;
    if(memShow) return;
    const next = [...memInput, v];
    setMemInput(next);
    // check step
    const exp = memSeq[next.length-1];
    if(v!==exp){
      // wrong -> minus?
      setMemInput([]);
      return;
    }
    if(next.length===memSeq.length){
      setScore(s=> s+12);
      // next round longer? regenerate with seed+score
      const seed = (Date.now() + score) >>>0;
      const rnd = Math.floor((Math.sin(seed)*10000)%4+4)%4;
      setMemSeq(s=> [...s, rnd]);
      setMemInput([]);
      setMemShow(true);
      setTimeout(()=> setMemShow(false), 900);
    }
  }
  function handleRhythmTap(){
    if(phase!=="playing") return;
    if(typeId!=="rhythm-42") return;
    setScore(s=> s+42);
  }
  function handleGenericTap(){
    if(phase!=="playing") return;
    if(["rhythm-42","snake-42","typing-42"].includes(typeId)){
      setScore(s=> s+1);
    }
  }

  async function doShare(){
    const canvas = canvasRef.current;
    if(!canvas){ setMsg("Canvas нет"); return; }
    canvas.width=1080; canvas.height=1920;
    const ctx = canvas.getContext("2d")!;
    // bg viral gradient
    const grad = ctx.createLinearGradient(0,0,1080,1920);
    grad.addColorStop(0,"#0a0a0a"); grad.addColorStop(0.35,"#1a1a00"); grad.addColorStop(0.65,"#ff2d55"); grad.addColorStop(1,"#ffcc00");
    ctx.fillStyle=grad; ctx.fillRect(0,0,1080,1920);
    // header
    ctx.fillStyle="#fff"; ctx.font="900 84px Inter, sans-serif"; ctx.fillText("ФЛЕШМОБ 42",48,120);
    ctx.font="700 36px Inter, sans-serif"; ctx.fillStyle="rgba(255,255,255,.95)";
    const title = today?.title ?? typeMeta.title;
    ctx.fillText(title,48,190);
    ctx.font="600 42px Inter, sans-serif"; ctx.fillStyle="#ffcc00";
    const sc = showResult?.score ?? myScore ?? score;
    ctx.fillText(`Счёт: ${sc}`,48,280);
    if(showResult?.rank){
      ctx.fillStyle="rgba(255,255,255,.9)"; ctx.font="600 32px Inter, sans-serif";
      ctx.fillText(`Топ-${showResult.rank} из ${showResult.count} • топ-${showResult.pct}%`,48,330);
    }
    // type badge
    ctx.fillStyle="rgba(255,255,255,.12)"; ctx.fillRect(48,360,420,64);
    ctx.fillStyle="#fff"; ctx.font="700 26px Inter, sans-serif"; ctx.fillText(`${typeMeta.icon} ${typeMeta.shortTitle} 42с`,72,400);
    // QR placeholder
    const qrUrl = `${window.location.origin}/magnum/flashmob?d=${encodeURIComponent(day)}`;
    ctx.fillStyle="#fff"; ctx.fillRect(390,520,300,300);
    ctx.fillStyle="#111"; ctx.font="700 28px monospace"; ctx.fillText("QR",520,670);
    ctx.font="400 16px monospace"; ctx.fillText(qrUrl.replace("https://",""),400,710);
    ctx.fillStyle="rgba(255,255,255,.8)"; ctx.font="400 22px Inter, sans-serif";
    ctx.fillText("MAGNUM • Board42 челлендж • /magnum/flashmob",48,1860);
    ctx.fillStyle="rgba(255,255,255,.55)"; ctx.font="400 18px Inter, sans-serif";
    ctx.fillText(`day ${day} seed ${today?.seed ?? 0} • вирус 42`,48,1890);
    try{
      const blob:Blob = await new Promise(res=> canvas.toBlob(b=> res(b!), "image/png")!);
      const file = new File([blob], `flashmob-42-${day}-${sc}.png`, { type:"image/png" });
      if(navigator.canShare && navigator.canShare({files:[file]})){
        await navigator.share({ title:`ФЛЕШМОБ 42 — ${title} ${sc}`, text:`Мой счёт ${sc} в ${title} — побей в /magnum/flashmob ⚡`, files:[file] });
      } else if((navigator as unknown as {share?:unknown}).share){
        await (navigator as unknown as {share:(d:unknown)=>Promise<void>}).share({ title:"ФЛЕШМОБ 42", text:`${sc} в ${title} — ${qrUrl}`, url: qrUrl });
      } else {
        const a=document.createElement("a"); a.href=canvas.toDataURL("image/png"); a.download=`flashmob-42-${day}.png`; a.click();
      }
    }catch{ /* cancel */ }
    // +42 guard
    try{
      const r = await fetch("/magnum/api/flashmob/share",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({ day })});
      const j = await r.json() as { ok?:boolean; coins?:number; balance?:number; error?:string };
      if(r.ok && j.ok){
        setMsg(`+${j.coins} монет за шаринг • баланс ${j.balance}`);
        setShareOk(true);
        if(wrapRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
          spawnConfetti(wrapRef.current,120);
          const burst = wrapRef.current.querySelector<HTMLElement>("[data-burst]");
          if(burst) gsap.fromTo(burst,{scale:1},{scale:1.4,duration:0.3,ease:"back.out(1.7)"});
        }
      } else if(r.status===409){
        setMsg("Уже делился сегодня — +42 1×/день");
        setShareOk(true);
      } else if(j.error) setMsg(j.error);
    }catch{ setMsg("Шаринг OK, но +42 не начислен — сеть"); }
  }

  function spawnConfetti(root:HTMLElement,count:number){
    for(let i=0;i<count;i++){
      const d=document.createElement("div");
      d.className=styles.confetti;
      d.style.left="50%"; d.style.top="38%";
      d.style.background= i%3===0?"#ff2d55": i%3===1?"#00ff88":"#ffcc00";
      root.appendChild(d);
      const ang=Math.random()*Math.PI*2, dist=60+Math.random()*200;
      gsap.to(d,{x:Math.cos(ang)*dist, y:Math.sin(ang)*dist+70, rotation:Math.random()*720, opacity:0, duration:0.8+Math.random()*0.5, ease:"power2.out", onComplete:()=> d.remove()});
    }
  }

  const pct = showResult?.pct ?? (myRank && totalCount ? Math.round((myRank/totalCount)*100) : null);

  return (
    <div ref={wrapRef} className={styles.page} style={{position:"relative"}}>
      <GuestGate action="участвовать во флешмобе" />
      <div className={styles.header}>
        <div>
          <div className={styles.title}>ФЛЕШМОБ 42 <span>— вирус</span></div>
          <div className={styles.sub}>1 челлендж/день • 7 типов ротация seed YYYY-MM-DD • одинаков для всех • 42с • шаринг 1080×1920 +42/день • топ-3 +142/420/1420</div>
        </div>
      </div>

      <div className={styles.card} style={{marginTop:14}}>
        <div className={styles.todayRow}>
          <span className={styles.todayBadge}>{day}</span>
          <span className={styles.chip}>{typeMeta.icon} {typeMeta.title}</span>
          <span className={styles.chip}>seed {today?.seed ?? "..."}</span>
          <span style={{marginLeft:"auto",opacity:.6,fontSize:12}}>{err || (today ? "синк" : "загрузка…")}</span>
        </div>
        <div style={{marginTop:10,display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
          <div className={styles.timer}>{phase==="countdown" && countdown!==null ? <span ref={countdownRef} className={styles.countdown}>{countdown}</span> : <>{String(timeLeft).padStart(2,"0")}<span>с</span></>}</div>
          <div style={{opacity:.7,fontSize:13}}>{phase==="idle" ? "— нажми Старт" : phase==="playing" ? `играем • цель ${typeMeta.target}` : phase==="finished" ? "финиш" : "3-2-1"}</div>
          <div ref={scoreRef} className={styles.scoreBig} data-burst style={{marginLeft:"auto"}}>{score}</div>
        </div>
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <button className={styles.startBtn} onClick={startCountdown} disabled={phase!=="idle"}>Старт</button>
          <button className={styles.shareBtn} onClick={doShare} disabled={!showResult && myScore===null}>Поделиться результатом</button>
          <button onClick={()=>{ setPhase("idle"); setTimeLeft(42); setScore(0); setShowResult(null); setMsg(""); setShareOk(false); loadLb(); reload(); }} style={{padding:"10px 14px",borderRadius:12,border:"1px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.06)",color:"#fff",fontWeight:700,cursor:"pointer"}}>Сброс</button>
        </div>
        {msg && <div style={{marginTop:10,color: shareOk? "#7cff7c":"#ffcc00",fontSize:13}}>{msg}</div>}
        {/* game zone per type */}
        <div
          className={styles.clickZone}
          onClick={()=>{
            if(typeId==="click-storm" || typeId==="dodge-wave") handleClickStorm();
            else if(typeId==="rhythm-42") handleRhythmTap();
            else if(["snake-42","typing-42"].includes(typeId)) handleGenericTap();
          }}
        >
          {(typeId==="click-storm" || typeId==="dodge-wave") && (
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:18,fontWeight:800,opacity:.8}}>{phase==="playing" ? "ЖМИ!" : phase==="idle" ? "Нажми Старт, затем кликай" : "Клики засчитаны"}</div>
              <div style={{fontSize:42,marginTop:6}}>{phase==="playing" ? "👊" : "⚡"}</div>
              <div style={{opacity:.6,fontSize:12,marginTop:6}}>42с • набей {typeMeta.target}</div>
            </div>
          )}
          {typeId==="eco-quiz" && (
            <div style={{width:"100%",maxWidth:520,padding:12}}>
              {phase!=="playing" ? <div style={{textAlign:"center",opacity:.7}}>Квиз стартует после Старт • 7 вопросов</div> : (
                <div>
                  <div style={{fontWeight:800}}>{quizIdx+1}. {quizQs[quizIdx]?.q}</div>
                  <div style={{display:"grid",gap:8,marginTop:10}}>
                    {quizQs[quizIdx]?.a.map((opt,i)=> (
                      <button key={i} onClick={(e)=>{ e.stopPropagation(); handleQuizPick(i); }} className={`${styles.quizOpt} ${quizAns===i? styles.quizOptActive:""}`} style={{borderColor: quizAns!==null ? (i===quizQs[quizIdx]?.correct ? "#00ff88" : quizAns===i? "#ff2d55" : "rgba(255,255,255,.08)"):"rgba(255,255,255,.08)"}}>{opt}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {typeId==="memory" && (
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:13,opacity:.7}}>{memShow ? "Запомни" : phase==="playing" ? "Повтори" : "Память 42"}</div>
              <div style={{display:"flex",gap:10,justifyContent:"center",marginTop:10}}>
                {[0,1,2,3].map(v=> (
                  <button key={v} onClick={(e)=>{ e.stopPropagation(); handleMemPick(v); }} style={{width:64,height:64,borderRadius:12,border: memShow && memSeq.includes(v) ? "2px solid #ffcc00" : "1px solid rgba(255,255,255,.12)", background: memShow && memSeq[memInput.length]===v ? "rgba(255,204,0,.2)" : memInput.includes(v) ? "rgba(0,255,136,.14)":"rgba(255,255,255,.06)", opacity: memShow ? (memSeq.slice(0,memSeq.length).includes(v)?1:.45):1, fontSize:20}}>{["🔴","🟢","🔵","🟡"][v]}</button>
                ))}
              </div>
              <div style={{opacity:.6,fontSize:12,marginTop:8}}>Последовательность {memSeq.length} • +12 за раунд</div>
            </div>
          )}
          {(typeId==="rhythm-42" || typeId==="snake-42" || typeId==="typing-42") && (
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:18,fontWeight:800}}>{typeId==="rhythm-42" ? "ТАПАЙ В РИТМ" : typeId==="snake-42" ? "ЖМИ — РАСТИ ЗМЕЙКУ" : "КЛАЦАЙ — ПЕЧАТАЙ"}</div>
              <div style={{fontSize:42,marginTop:6}}>{typeId==="rhythm-42" ? "🎵" : typeId==="snake-42" ? "🐍" : "⌨️"}</div>
              <div style={{opacity:.6,fontSize:12}}>42с • цель {typeMeta.target}</div>
            </div>
          )}
        </div>
      </div>

      <div className={styles.card} style={{marginTop:14}}>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
          <strong>Топ-10 дня</strong>
          <span className={styles.chip}>всего {totalCount} участников</span>
          {myRank && <span className={styles.chip}>ты #{myRank} • {myScore ?? score} • топ-{pct}%</span>}
          <button onClick={loadLb} style={{marginLeft:"auto",padding:"6px 10px",borderRadius:8,border:"1px solid rgba(255,255,255,.12)",background:"transparent",color:"#fff",cursor:"pointer"}}>Обновить</button>
        </div>
        <div ref={lbRef} className={styles.lb}>
          {leaderboard.length===0 && <div style={{opacity:.6,padding:16,textAlign:"center",border:"1px dashed rgba(255,255,255,.12)",borderRadius:12}}>Пока пусто — стань первым!</div>}
          {leaderboard.map(it=> (
            <div key={`${it.userId}-${it.created_at}`} data-lb-row className={`${styles.lbRow} ${me && it.userId===me.id ? styles.lbMe : ""}`}>
              <div className={styles.lbRank}>{it.rank}</div>
              <div style={{width:32,height:32,borderRadius:999,background: it.avatar? `url(${it.avatar}) center/cover`:"linear-gradient(135deg,#ff2d55,#ffcc00)",display:"grid",placeItems:"center",fontWeight:900,fontSize:12}}>{!it.avatar && String(it.username).slice(0,2).toUpperCase()}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:800,fontSize:13,display:"flex",gap:6}}><span>{it.username}</span><span style={{opacity:.6,fontSize:11,alignSelf:"center"}}>#{it.userId}</span><span style={{marginLeft:"auto"}}>{it.score}</span></div>
                <div style={{opacity:.6,fontSize:11}}>{new Date(it.created_at).toLocaleString("ru-RU")}</div>
              </div>
              {it.rank===1 && <span style={{padding:"2px 6px",borderRadius:6,background:"linear-gradient(90deg,#ffcc00,#ff2d55)",color:"#111",fontWeight:800,fontSize:11}}>+1420</span>}
              {it.rank===2 && <span style={{padding:"2px 6px",borderRadius:6,background:"rgba(255,204,0,.18)",color:"#ffcc00",fontWeight:800,fontSize:11}}>+420</span>}
              {it.rank===3 && <span style={{padding:"2px 6px",borderRadius:6,background:"rgba(0,255,136,.14)",color:"#00ff88",fontWeight:800,fontSize:11}}>+142</span>}
            </div>
          ))}
        </div>
      </div>

      <canvas ref={canvasRef} width={1080} height={1920} style={{display:"none"}} />

      {showResult && (
        <div className={styles.modal} onClick={()=> setShowResult(null)}>
          <div className={styles.modalCard} onClick={e=> e.stopPropagation()}>
            <div style={{fontSize:22,fontWeight:900}}>Ты в топ-{showResult.pct}%! <span data-burst style={{display:"inline-block"}}>🎉</span></div>
            <div style={{opacity:.7,marginTop:6}}>Счёт {showResult.score} • место #{showResult.rank} из {showResult.count}</div>
            {typeof showResult.topReward==="number" && showResult.topReward>0 && <div style={{marginTop:8,color:"#ffcc00",fontWeight:800}}>+{showResult.topReward} монет за топ-{showResult.rank}!</div>}
            {typeof showResult.streak==="number" && showResult.streak>=3 && <div style={{marginTop:6,color:"#7cff7c",fontWeight:800}}>Стрик {showResult.streak} дня — +142!</div>}
            {typeof showResult.coins==="number" && showResult.coins>0 && <div style={{marginTop:6,opacity:.8}}>+{showResult.coins} монет суммарно</div>}
            <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:14}}>
              <button className={styles.shareBtn} onClick={doShare}>Поделиться результатом</button>
              <button onClick={()=> setShowResult(null)} style={{padding:"10px 16px",borderRadius:12,border:"1px solid rgba(255,255,255,.12)",background:"transparent",color:"#fff",cursor:"pointer"}}>Закрыть</button>
            </div>
            <div style={{marginTop:10,opacity:.6,fontSize:12}}>Вызов друга: Board42 челлендж • шаринг 1080×1920</div>
          </div>
        </div>
      )}
    </div>
  );
}
