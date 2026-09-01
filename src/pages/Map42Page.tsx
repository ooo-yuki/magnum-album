import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import gsap from "gsap";
import styles from "./Map42Page.module.css";

type Opt = { label: string; correct: boolean; hint: string };
type Q = { q: string; emoji: string; options: Opt[] };
type PointDef = { id: string; name: string; sub: string; x: number; y: number; color: string; theme: string; qs: Q[] };

const POINTS: PointDef[] = [
  {
    id: "kemerovo", name: "КЕМЕРОВО", sub: "Томь • 557k • адмцентр", x: 470, y: 210, color: "#00ff88", theme: "Томь/пластик",
    qs: [
      { emoji: "🌊", q: "Томь в Кемерово — 827 км. Куда пластиковую бутылку?", options: [
        { label: "В общий мусор — авось переработают", correct: false, hint: "мимо" },
        { label: "Сдать в фандомат «Лента» / раздельный бак", correct: true, hint: "+42" },
        { label: "Сжечь на берегу", correct: false, hint: "дым −142" },
        { label: "Оставить на Красном озере", correct: false, hint: "анти-эко" },
      ]},
      { emoji: "🏭", q: "Кемерово — химпром Кузбасса. Что помогает Томи чище?", options: [
        { label: "Сортировка 7дн: ПЭТ/стекло/органика", correct: true, hint: "+42" },
        { label: "Сливать всё в Томь", correct: false, hint: "−142" },
        { label: "Жечь пластик в мангале", correct: false, hint: "хуже" },
        { label: "Не сортировать — всё в один пакет", correct: false, hint: "−42" },
      ]},
    ]
  },
  {
    id: "novokuznetsk", name: "НОВОКУЗНЕЦК", sub: "Разрезы • 553k • юг", x: 620, y: 420, color: "#ff2d55", theme: "Уголь/разрезы",
    qs: [
      { emoji: "⛏️", q: "Кузбасс — 190 млн т угля в год. Что с рекультивацией разрезов?", options: [
        { label: "Бросить разрез — природа сама", correct: false, hint: "долго" },
        { label: "Рекультивация + посадка кедров/леса", correct: true, hint: "+42" },
        { label: "Засыпать мусором", correct: false, hint: "−142" },
        { label: "Не знать где разрез", correct: false, hint: "учи" },
      ]},
      { emoji: "🌲", q: "Лес Кузбасса — 4817,5 тыс га. Твой мув?", options: [
        { label: "Сажаю весной кедры, агитирую за субботники", correct: true, hint: "+42" },
        { label: "Жгу уголь без фильтра", correct: false, hint: "коптим" },
        { label: "Рублю бор без посадки", correct: false, hint: "−142" },
        { label: "Не в курсе про лес", correct: false, hint: "−42" },
      ]},
    ]
  },
  {
    id: "belovo", name: "БЕЛОВО", sub: "Беловское вдхр • 68k", x: 540, y: 340, color: "#ffcc00", theme: "Вода/пластик",
    qs: [
      { emoji: "♻️", q: "Беловское водохранилище — пластик у воды?", options: [
        { label: "Собрал в пакет, донёс до бака", correct: true, hint: "+42" },
        { label: "Оставил на берегу — природа вывезет", correct: false, hint: "−142" },
        { label: "Кинул в воду", correct: false, hint: "−142" },
        { label: "Сжёг на пляже", correct: false, hint: "дым" },
      ]},
      { emoji: "🧴", q: "Пластик — куда после пикника?", options: [
        { label: "Разделил ПЭТ/стекло — сдал", correct: true, hint: "+42" },
        { label: "В общий мусор", correct: false, hint: "−5" },
        { label: "Закопал", correct: false, hint: "−42" },
        { label: "Сжёг", correct: false, hint: "хуже" },
      ]},
    ]
  },
  {
    id: "prokopievsk", name: "ПРОКОПЬЕВСК", sub: "Шахты • 187k • уголь", x: 580, y: 380, color: "#9147ff", theme: "Шахты/уголь",
    qs: [
      { emoji: "🏗️", q: "Прокопьевск — шахты Кузбасса. Что с угольной пылью?", options: [
        { label: "Фильтры + брикеты + субботники на Томи", correct: true, hint: "+42" },
        { label: "Топлю чем попало без фильтра", correct: false, hint: "−142" },
        { label: "Не знаю что такое пыль", correct: false, hint: "учи" },
        { label: "Жгу мусор с углём", correct: false, hint: "−42" },
      ]},
      { emoji: "🪨", q: "Уголь Кузбасса — 95,7 тыс км², 3 хребта (Кузнецкий Алатау, Салаир). Твой вклад?", options: [
        { label: "Переработка + агитация MAGNUM 42", correct: true, hint: "+42" },
        { label: "Выкинул пластик в Томь", correct: false, hint: "−142" },
        { label: "Игнор", correct: false, hint: "мимо" },
        { label: "Только уголь жгу", correct: false, hint: "−42" },
      ]},
    ]
  },
  {
    id: "mezhdurechensk", name: "МЕЖДУРЕЧЕНСК", sub: "Горная Шория • 96k • исток Томи", x: 700, y: 520, color: "#00ffcc", theme: "Исток/тайга",
    qs: [
      { emoji: "🏔️", q: "Междуреченск — у истока Томи, тайга. Что с лесом?", options: [
        { label: "Посадка кедров + защита бора", correct: true, hint: "+42" },
        { label: "Рублю без восстановления", correct: false, hint: "−142" },
        { label: "Мусор в тайге", correct: false, hint: "−142" },
        { label: "Не знаю где исток", correct: false, hint: "−42" },
      ]},
      { emoji: "🌲", q: "Сосновый бор Кемерово — субботник?", options: [
        { label: "Иду на субботник, собираю 42 бутылки", correct: true, hint: "+42" },
        { label: "Не хожу — пусть другие", correct: false, hint: "−42" },
        { label: "Мусорю в бору", correct: false, hint: "−142" },
        { label: "Жгу костёр с пластиком", correct: false, hint: "хуже" },
      ]},
    ]
  },
];

const BOSS_Q: Q[] = [
  { emoji: "🗺️", q: "Кузбасс — 42 регион. Что в сердце региона?", options: [
    { label: "Томь 827 км + 95,7k км² + 190M уголь", correct: true, hint: "+1420" },
    { label: "Не знаю", correct: false, hint: "учи" },
    { label: "Только уголь", correct: false, hint: "мало" },
    { label: "42 — просто число", correct: false, hint: "мимо" },
  ]},
  { emoji: "♻️", q: "Эко-миссия Кузбасса — что делаешь для Томи?", options: [
    { label: "Сортировка 7дн + фандомат + субботники", correct: true, hint: "+1420" },
    { label: "Кидаю пластик в реку", correct: false, hint: "−142" },
    { label: "Жгу пластик", correct: false, hint: "дым" },
    { label: "Игнор", correct: false, hint: "мимо" },
  ]},
];

const ECO_MONITORING_URL = "https://kuzbass-ecology.ru/monitoring"; // сводка эко-мониторинга Кузбасса

function weekIdNow(): string { const d=new Date(); const jan1=new Date(d.getFullYear(),0,1); const days=Math.floor((d.getTime()-jan1.getTime())/86400000); const w=Math.ceil((days+jan1.getDay()+1)/7); return `${d.getFullYear()}-W${String(w).padStart(2,"0")}`; }
function prefersReduced(){ return typeof window!=="undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }

type ProgressDTO = { userId?: number; points: Record<string, boolean>; completed: number; streak: number; weekId: string; freezeUsed: boolean; canFreeze: boolean; streakDays: string[]; bossDone?: boolean; guest?: boolean };

export function Map42Page(){
  const rootRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [progress, setProgress] = useState<ProgressDTO>({ points: {}, completed: 0, streak: 0, weekId: weekIdNow(), freezeUsed: false, canFreeze: true, streakDays: [] });
  const [activePoint, setActivePoint] = useState<string|null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [toast, setToast] = useState<string|null>(null);
  const [busy, setBusy] = useState(false);
  const [bossMode, setBossMode] = useState(false);
  const [bossQi, setBossQi] = useState(0);
  const [confetti, setConfetti] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string|null>(null);

  const activeDef = useMemo(()=> POINTS.find(p=>p.id===activePoint) ?? null, [activePoint]);
  const completed = progress.completed ?? 0;
  const pct = Math.round((completed/5)*100);
  const allDone = completed >= 5;

  const fetchProgress = useCallback(async()=>{
    try{
      const r = await fetch("/magnum/api/map/progress", { credentials:"include" });
      if(r.ok){ const j = await r.json() as ProgressDTO; setProgress(j); return j; }
      return null;
    }catch{ return null; }
  }, []);

  useEffect(()=>{ void fetchProgress(); }, [fetchProgress]);

  // GSAP: map path draw 1.2s power2.inOut + point pulse + reduced-motion gate
  useEffect(()=>{
    if(!mapRef.current) return;
    if(prefersReduced()) return;
    const ctx = gsap.context(()=>{
      const path = mapRef.current!.querySelector("#tom-path") as SVGPathElement | null;
      if(path){
        const len = path.getTotalLength();
        gsap.set(path,{ strokeDasharray: len, strokeDashoffset: len });
        gsap.to(path,{ strokeDashoffset: 0, duration: 1.2, ease: "power2.inOut" });
      }
      const dots = mapRef.current!.querySelectorAll<HTMLElement>("[data-point]");
      gsap.set(dots,{ scale: 0, opacity: 0 });
      gsap.to(dots,{ scale:1, opacity:1, duration:0.45, stagger: 0.08, ease:"back.out(1.4)", delay:0.2 });
      dots.forEach((el)=>{
        if(el.getAttribute("data-done")==="true") return;
        gsap.to(el,{ scale:1.14, duration:1.4, repeat:-1, yoyo:true, ease:"sine.inOut" });
      });
    }, mapRef);
    return ()=>ctx.revert();
  }, [completed]);

  useEffect(()=>{
    if(progressRef.current) gsap.to(progressRef.current,{ width:`${pct}%`, duration:0.6, ease:"power3.out" });
  }, [pct]);

  const showToast=(msg:string)=>{ setToast(msg); window.setTimeout(()=>setToast(null), 2600); };

  const openPoint=(id:string)=>{
    const done = !!progress.points[id];
    if(done){ showToast("Точка уже закрашена — иди к боссу или жми 5/5"); return; }
    setActivePoint(id); setQIndex(0); setBossMode(false);
    // animate cards flip
    window.setTimeout(()=>{
      const cards = document.querySelectorAll(`.${styles.quizCard} .${styles.opts} button`);
      if(!prefersReduced() && cards.length) gsap.from(cards,{ y:12, opacity:0, duration:0.25, stagger:0.08, ease:"power2.out" });
    }, 30);
  };

  const answerPoint = async (opt: Opt)=>{
    if(!activeDef || busy) return;
    if(!opt.correct){
      showToast(`Мимо — ${opt.hint}. Попробуй ещё`);
      return;
    }
    const qs = activeDef.qs;
    if(qIndex < qs.length - 1){
      setQIndex(v=>v+1);
      window.setTimeout(()=>{
        const cards = document.querySelectorAll(`.${styles.quizCard} .${styles.opts} button`);
        if(!prefersReduced() && cards.length) gsap.from(cards,{ y:12, opacity:0, duration:0.25, stagger:0.08, ease:"power2.out" });
      }, 20);
      return;
    }
    // last q correct -> complete point
    setBusy(true);
    try{
      const r = await fetch("/magnum/api/map/answer",{ method:"POST", credentials:"include", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ pointId: activeDef.id })});
      const j = await r.json() as { ok?:boolean; error?:string; completed?:number; points?:Record<string,boolean>; streak?:number; weekId?:string; coins?:number; already?:boolean };
      if(!r.ok){
        if(r.status===401){ showToast("Войди, братуха — прогресс только для залогиненных"); }
        else if(j.already){ showToast("Точка уже закрашена"); await fetchProgress(); setActivePoint(null); }
        else showToast(j.error || "Ошибка");
      } else {
        await fetchProgress();
        showToast(j.coins ? `+${j.coins} монет • ${activeDef.name} закрашена` : `${activeDef.name} закрашена`);
        setActivePoint(null);
        if(j.completed===5){
          setConfetti(true); window.setTimeout(()=>setConfetti(false), 2800);
          // 90 конфетти via GSAP/dom
          if(!prefersReduced()){
            const layer = document.getElementById("map-confetti");
            if(layer){
              layer.innerHTML="";
              for(let i=0;i<90;i++){
                const el=document.createElement("div");
                el.className=styles.confetti;
                el.style.left = Math.random()*100+"%";
                el.style.top = "-10px";
                el.style.background = ["#00ff88","#78dcff","#ffcc00","#ff2d55","#9147ff"][Math.floor(Math.random()*5)]!;
                el.style.transform = `rotate(${Math.random()*360}deg)`;
                layer.appendChild(el);
                gsap.to(el,{ y: window.innerHeight+40, x: (Math.random()-0.5)*260, rotation: 360+Math.random()*360, duration: 1.6+Math.random()*0.9, ease:"power1.out", delay: Math.random()*0.2 });
                gsap.to(el,{ opacity:0, duration:0.5, delay:1.2 });
              }
              window.setTimeout(()=>{ if(layer) layer.innerHTML=""; }, 3200);
            }
          }
        }
      }
    }catch{ showToast("Сеть — попробуй снова"); }
    finally{ setBusy(false); }
  };

  const handleBossAnswer = async (opt: Opt)=>{
    if(!opt.correct){ showToast("Мимо — босс ждёт правильный ответ"); return; }
    if(bossQi < BOSS_Q.length - 1){ setBossQi(v=>v+1); return; }
    setBusy(true);
    try{
      const r = await fetch("/magnum/api/map/boss",{ method:"POST", credentials:"include", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({})});
      const j = await r.json() as { ok?:boolean; error?:string; coins?:number };
      if(!r.ok){ showToast(j.error || "Босс не дался"); }
      else {
        await fetchProgress(); showToast(j.coins ? `БОСС Кузбасс +${j.coins} монет • 1420` : "Босс пройден +1420");
        setBossMode(false); setConfetti(true); window.setTimeout(()=>setConfetti(false), 2600);
      }
    }catch{ showToast("Сеть"); }
    finally{ setBusy(false); }
  };

  const handleFreeze = async()=>{
    setBusy(true);
    try{
      const r=await fetch("/magnum/api/map/freeze",{ method:"POST", credentials:"include", headers:{ "Content-Type":"application/json" }});
      const j= await r.json() as { ok?:boolean; error?:string; weekId?:string };
      if(r.ok && j.ok){ showToast(`❄️ Заморозка • ${j.weekId} • -420 монет`); await fetchProgress(); }
      else showToast(j.error || "Не удалось заморозить");
    }catch{ showToast("Сеть"); }
    finally{ setBusy(false); }
  };

  const handleShareOG = async()=>{
    const canvas = canvasRef.current; if(!canvas) return;
    const ctx = canvas.getContext("2d"); if(!ctx) return;
    canvas.width=1080; canvas.height=1080;
    const g=ctx.createLinearGradient(0,0,1080,1080); g.addColorStop(0,"#0a1a2a"); g.addColorStop(0.5,"#0a3a2a"); g.addColorStop(1,"#1a3a5a");
    ctx.fillStyle=g; ctx.fillRect(0,0,1080,1080);
    // Tom line
    ctx.strokeStyle="#78dcff"; ctx.lineWidth=18; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(460,70); ctx.bezierCurveTo(480,160,430,240,440,320); ctx.bezierCurveTo(460,400,520,440,500,520); ctx.bezierCurveTo(480,600,460,640,460,640); ctx.stroke();
    // points
    POINTS.forEach(p=>{
      const done = !!progress.points[p.id];
      ctx.fillStyle = done ? "#00ff88" : "rgba(255,255,255,.22)";
      ctx.strokeStyle="#fff"; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(p.x*1.08, p.y*1.08+80, 16, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle="#fff"; ctx.font="800 14px Inter, sans-serif"; ctx.textAlign="center"; ctx.fillText(p.name, p.x*1.08, p.y*1.08+110);
    });
    ctx.fillStyle="#fff"; ctx.font="900 62px Inter, sans-serif"; ctx.textAlign="center"; ctx.fillText("КАРТА КУЗБАССА 42",540,380);
    ctx.font="700 34px Inter, sans-serif"; ctx.fillStyle="#7affc2"; ctx.fillText(`${completed}/5 регионов • ${pct}% • стрик ${progress.streak}/7`,540,440);
    ctx.font="600 26px Inter, sans-serif"; ctx.fillStyle="rgba(255,255,255,.82)"; ctx.fillText(`Томь 827км • 95,7k км² • /magnum/map • ${progress.weekId}`,540,500);
    ctx.strokeStyle="rgba(120,220,255,.45)"; ctx.lineWidth=6; ctx.strokeRect(20,20,1040,1040);
    try{
      const blob: Blob|null = await new Promise(res=>canvas.toBlob(r=>res(r),"image/png"));
      if(!blob) throw new Error("no blob");
      const file=new File([blob],"map-kuzbass-42-1080.png",{type:"image/png"});
      if(navigator.share && navigator.canShare?.({files:[file]})){
        await navigator.share({ title:`КАРТА КУЗБАССА 42 — ${completed}/5`, text:`Карта Кузбасса 42 — ${completed}/5 • Томь 827км • /magnum/map`, files:[file] });
      } else {
        const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="map-kuzbass-42-1080.png"; a.click(); URL.revokeObjectURL(url);
      }
      const sr=await fetch("/magnum/api/map/share",{ method:"POST", credentials:"include", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({})});
      if(sr.ok){ const sj= await sr.json() as { coins?:number }; showToast(`+${sj.coins ?? 42} монет за шаринг 1080×1080`); }
      else showToast("Шаринг 1080×1080 готов — сохрани картинку");
    }catch{
      const url=canvas.toDataURL("image/png"); const a=document.createElement("a"); a.href=url; a.download="map-kuzbass-42-1080.png"; a.click();
    }
  };

  const handleVerifyVision = async (e: React.ChangeEvent<HTMLInputElement>)=>{
    const f=e.target.files?.[0]; if(!f) return;
    const reader=new FileReader();
    reader.onload=async()=>{
      const dataUrl=String(reader.result||"");
      if(!dataUrl.startsWith("data:image/")){ setVerifyMsg("Нужна картинка"); return; }
      setVerifyMsg("Проверяем фото у БРАТ-БОТА…");
      try{
        const r=await fetch("/magnum/api/ai",{ method:"POST", credentials:"include", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ text:"Это фото-отчёт эко-уборки у Томи/в Кузбассе? Фото реального мусора/сортировки/реки/леса считается посещением. Оцени и скажи засчитано ли.", image: dataUrl, history:[] })});
        const j= await r.json() as { text?:string; error?:string };
        if(!r.ok){ setVerifyMsg(j.error || "Ошибка vision"); return; }
        const txt=(j.text||"").toLowerCase();
        const ok = txt.includes("засчитан") || txt.includes("легенда") || txt.includes("зачёт");
        if(ok){
          // mark random undone point as visited via answer trick: call verify endpoint
          const undone = POINTS.find(p=>!progress.points[p.id]);
          if(undone){
            const vr=await fetch("/magnum/api/map/verify",{ method:"POST", credentials:"include", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ pointId: undone.id })});
            const vj=await vr.json() as { ok?:boolean; error?:string; coins?:number };
            if(vr.ok){ await fetchProgress(); setVerifyMsg(`Фото засчитано ✅ ${undone.name} +${vj.coins ?? 42}`); showToast(`Фото-отчёт засчитан — ${undone.name} +${vj.coins ?? 42}`); }
            else setVerifyMsg(vj.error || "Фото ок, но точка уже была");
          } else setVerifyMsg("Фото крутое, но карта уже 5/5 — иди к боссу");
        } else {
          setVerifyMsg(`Не засчитано: ${j.text?.slice(0,120) || "попробуй фото уборки у реки"}`);
        }
      }catch{ setVerifyMsg("Сеть — попробуй снова"); }
    };
    reader.readAsDataURL(f);
    e.target.value="";
  };

  const bossAvailable = allDone && !progress.bossDone;

  return (
    <div className={styles.page} ref={rootRef}>
      <header className={styles.header}>
        <span className={styles.badge}>КАРТА КУЗБАССА 42 • Томь 827км • 5 точек • Кузбасс 95,7k км²</span>
        <h1 className={styles.title}>КАРТА КУЗБАССА 42</h1>
        <p className={styles.subtitle}>Интерактивная эко-карта: Томь-линия + 5 точек — Кемерово / Новокузнецк / Белово / Прокопьевск / Междуреченск. Клик → квиз 2Q + прогресс-бар региона. 5/5 → босс-квиз Кузбасс +1420. Стрик 7дн, freeze 420, OG 1080×1080.</p>
        <div className={styles.realLinks}>
          <a href={ECO_MONITORING_URL} target="_blank" rel="noopener noreferrer">📊 Сводка эко-мониторинга Кузбасса</a>
          <a href="/magnum/eco">→ Эко-рейтинг 8Q</a>
          <a href="/magnum/mining">→ Майнинг Кузбасса</a>
          <label style={{ cursor:"pointer", fontSize:12, fontWeight:700, color:"#78dcff", border:"1px solid rgba(120,220,255,.22)", padding:"6px 10px", borderRadius:999, background:"rgba(120,220,255,.06)" }}>📸 Фото-отчёт БРАТ-БОТ vision — засчитать посещение<input type="file" accept="image/*" onChange={handleVerifyVision} style={{ display:"none" }} /></label>
        </div>
        {verifyMsg && <div style={{ marginTop:8, fontSize:12, color:"rgba(120,220,255,.9)" }}>{verifyMsg}</div>}
      </header>

      <div className={styles.streakWrap}>
        <div className={styles.dots}>
          {Array.from({length:7}).map((_,i)=>(
            <span key={i} className={`${styles.dot} ${i < (progress.streak ?? 0) ? styles.dotOn : ""}`}>{i < (progress.streak ?? 0) ? "✓" : i+1}</span>
          ))}
          <span className={styles.weekLabel}>{progress.weekId} • стрик {progress.streak ?? 0}/7</span>
        </div>
        <button className={styles.freezeBtn} onClick={handleFreeze} disabled={!!progress.freezeUsed || busy}>{progress.freezeUsed ? "❄️ Заморожено" : "❄️ Freeze 420 1×/нед"}</button>
      </div>

      <div className={styles.progressWrap} aria-label={`Прогресс ${pct}%`}>
        <div className={styles.progressTrack}><div className={styles.progressFill} ref={progressRef} style={{ width: `${pct}%` }} /></div>
        <div className={styles.progressMeta}><span className={styles.progressLbl}>{completed}/5 регионов</span><span className={styles.progressPct}>{pct}%</span></div>
      </div>

      <div className={styles.mapCard} ref={mapRef} aria-label="Карта Кузбасса 5 точек">
        <div className={styles.mapSvgWrap}>
          <svg viewBox="0 0 1000 700" role="img" aria-label="Карта Кузбасса SVG 5 точек">
            <rect width="1000" height="700" rx="24" fill="#0a1620"/>
            <path d="M 180 140 L 820 120 L 880 280 L 760 560 L 420 620 L 180 480 L 140 260 Z" fill="#0f2a32" stroke="#1e4a5a" strokeWidth="3" opacity="0.9"/>
            <path id="tom-path" d="M 460 70 C 470 150 430 220 440 300 C 450 380 520 420 500 500 C 480 580 460 640 460 640" fill="none" stroke="#38bdf8" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity="0.95"/>
            <path d="M 460 70 C 470 150 430 220 440 300 C 450 380 520 420 500 500 C 480 580 460 640 460 640" fill="none" stroke="#7dd8ff" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
            <text x="490" y="95" fill="#78dcff" fontSize="13" fontWeight="800" letterSpacing="0.12em">ТОМЬ 827КМ</text>
            {POINTS.map(p=>{
              const done=!!progress.points[p.id];
              return (
                <g key={p.id} data-point={p.id} data-done={done ? "true":"false"} onClick={()=>openPoint(p.id)} style={{ cursor: done ? "default":"pointer" }}>
                  <circle cx={p.x} cy={p.y} r={done ? 16 : 14} fill={done ? "#00ff88" : p.color} stroke={done ? "#fff" : "#fff"} strokeWidth={done ? 2.5 : 2} opacity={done ? 1 : 0.95}/>
                  {done && <text x={p.x} y={p.y+5} textAnchor="middle" fontSize="14" fontWeight="900" fill="#0a0a0a">✓</text>}
                  {!done && <circle cx={p.x} cy={p.y} r={18} fill="none" stroke={p.color} strokeWidth="1.5" opacity="0.3"/>}
                  <text x={p.x} y={p.y+28} textAnchor="middle" fill={done ? "#00ff88" : "#fff"} fontSize="11" fontWeight="800" style={{ paintOrder:"stroke", stroke:"rgba(0,0,0,.55)", strokeWidth:3 }}>{p.name}</text>
                  <text x={p.x} y={p.y+40} textAnchor="middle" fill="rgba(255,255,255,.55)" fontSize="9" fontWeight="600">{done ? "закрашена ✓" : "клик → квиз 2Q"}</text>
                </g>
              );
            })}
            <text x="20" y="685" fill="rgba(255,255,255,0.35)" fontSize="10">95,7 тыс км² • 86,6% город • 190M уголь • 4817,5 тыс га леса • Кузнецкий Алатау • Салаир</text>
          </svg>
        </div>
        <div className={styles.regionGrid}>
          {POINTS.map(p=>{
            const done=!!progress.points[p.id];
            return (
              <div key={p.id} className={`${styles.regionTile} ${done ? styles.regionTileDone : ""}`}>
                <div className={styles.regionName}>{p.name}</div>
                <div className={styles.regionSub}>{p.sub}</div>
                <div className={styles.regionSub} style={{ color: done ? "#00ff88" : "rgba(154,164,178,.7)" }}>{p.theme}</div>
                <div className={styles.regionBar}><div className={styles.regionFill} style={{ width: done ? "100%" : "0%" }} /></div>
                <div style={{ marginTop:6, fontSize:11, fontWeight:800, color: done ? "#00ff88" : "rgba(255,255,255,.35)" }}>{done ? "✓ +42" : "0/2Q"}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.btnPrimary} onClick={()=>{ if(bossAvailable) setBossMode(true); else if(allDone) showToast("Босс уже пройден 💎"); else showToast(`Закрась ещё ${5-completed} точек → босс`); }}>{bossAvailable ? "👑 Босс-квиз Кузбасс +1420" : allDone ? "✅ 5/5 карта пройдена" : `Прогресс ${completed}/5 → босс +1420`}</button>
        <button className={styles.btnGhost} onClick={handleShareOG}>📤 Шаринг OG 1080×1080 +42</button>
        <button className={styles.btnGhost} onClick={()=>fetchProgress()}>↻ Обновить прогресс</button>
      </div>

      {toast && <div className={styles.toast} role="status">{toast}</div>}

      {/* quiz modal */}
      {activeDef && (
        <div className={styles.quizOverlay} onClick={()=>!busy && setActivePoint(null)} role="dialog" aria-modal="true">
          <div className={styles.quizCard} onClick={e=>e.stopPropagation()}>
            <div className={styles.quizHead}>
              <span className={styles.quizBadge} style={{ borderColor: activeDef.color, color: activeDef.color }}>{activeDef.name} • {activeDef.theme}</span>
              <span style={{ fontSize:11, color:"rgba(255,255,255,.5)" }}>{qIndex+1}/2 • {activeDef.sub}</span>
              <button onClick={()=>setActivePoint(null)} style={{ marginLeft:"auto", background:"transparent", border:"1px solid rgba(255,255,255,.14)", color:"#fff", borderRadius:999, width:32, height:32, cursor:"pointer" }}>×</button>
            </div>
            {(() => {
              const qq = activeDef.qs[qIndex]!;
              return (
                <>
                  <h3 className={styles.qText}>{qq.emoji} {qq.q}</h3>
                  <div className={styles.opts}>
                    {qq.options.map((o, i)=>(
                      <button key={i} className={styles.opt} onClick={()=>answerPoint(o)} disabled={busy}>
                        <span className={styles.optLabel}>{o.label}</span>
                        <span className={styles.optMeta}><span style={{ fontSize:11, color:"rgba(154,164,178,.9)" }}>{o.hint}</span><span className={`${styles.pts} ${o.correct ? styles.ptsPos : styles.ptsNeg}`}>{o.correct ? "+42" : "−42"}</span></span>
                      </button>
                    ))}
                  </div>
                  <p style={{ marginTop:10, fontSize:11, color:"rgba(154,164,178,.7)" }}>Ответ → сразу проверка. 2/2 верно → точка закрашивается +42. Фото-отчёт Брато-бота vision также засчитывает посещение.</p>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {bossMode && (
        <div className={styles.quizOverlay} onClick={()=>!busy && setBossMode(false)} role="dialog" aria-modal="true">
          <div className={styles.quizCard} onClick={e=>e.stopPropagation()}>
            <div className={styles.quizHead}>
              <span className={styles.quizBadge} style={{ borderColor:"#ffd700", color:"#ffd700", background:"rgba(255,215,0,.12)" }}>👑 БОСС КУЗБАСС • 5/5</span>
              <span style={{ fontSize:11, color:"rgba(255,255,255,.5)" }}>{bossQi+1}/2</span>
              <button onClick={()=>setBossMode(false)} style={{ marginLeft:"auto", background:"transparent", border:"1px solid rgba(255,255,255,.14)", color:"#fff", borderRadius:999, width:32, height:32, cursor:"pointer" }}>×</button>
            </div>
            {(() => {
              const qq = BOSS_Q[bossQi]!;
              return (
                <>
                  <h3 className={styles.qText}>{qq.emoji} {qq.q}</h3>
                  <div className={styles.opts}>
                    {qq.options.map((o,i)=>(
                      <button key={i} className={styles.opt} onClick={()=>handleBossAnswer(o)} disabled={busy}>
                        <span className={styles.optLabel}>{o.label}</span>
                        <span className={`${styles.pts} ${o.correct ? styles.ptsPos : styles.ptsNeg}`}>{o.correct ? "+1420" : "−42"}</span>
                      </button>
                    ))}
                  </div>
                  <div className={styles.bossBox}>Пройди 2/2 босс-вопроса → +1420 монет • легенда Кузбасса • сияние 42</div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      <div id="map-confetti" className={styles.confettiLayer} aria-hidden>{confetti ? null : null}</div>
      <canvas ref={canvasRef} width={1080} height={1080} style={{ display:"none" }} aria-hidden />

      <footer className={styles.footer}>
        <p>Карта Кузбасса 42 — Томь 827км • Кемерово 557k • Разрезы/Томь/Шахты/Пластик/Уголь • 5 точек ×2Q • 5/5 → босс +1420 • OG 1080×1080 • Сводка эко-мониторинга + vision фото-зачёт<br/>Сделано в Кемерово с любовью к Томи и Сосновому бору 🌲</p>
      </footer>
    </div>
  );
}
export default Map42Page;
