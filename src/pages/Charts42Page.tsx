import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { TRACKS, formatK, type Period, type TrackSlug } from "../lib/charts42";
import s from "./Charts42Page.module.css";

type Row = { track_slug: TrackSlug; title: string; plays: number; views: number; delta: number; delta_views: number; color: string };
const PERIODS: Period[] = ["week", "month", "all"];
const LABEL: Record<Period, string> = { week: "Неделя", month: "Месяц", all: "Всё время" };

export function Charts42Page() {
  const [period, setPeriod] = useState<Period>("week");
  const [sort, setSort] = useState<"plays" | "views">("plays");
  const [rows, setRows] = useState<Row[]>([]);
  const [guess, setGuess] = useState<TrackSlug | null>(null);
  const [msg, setMsg] = useState("");
  const [isVip, setIsVip] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // vip check via subscriptions
  useEffect(() => {
    fetch("/magnum/api/shop/subscriptions", { credentials: "include" }).then(r=>r.json()).then(j=>{
      if (j?.tier) setIsVip(true);
    }).catch(()=>{});
  }, []);

  const load = async (p: Period) => {
    const r = await fetch(`/magnum/api/charts?period=${p}`, { credentials: "include" });
    const j = await r.json() as { snapshots?: Array<{ track_slug: string; plays: number; views: number; delta: number; delta_views?: number; color?:string }>; ok?:boolean };
    const snaps = (j.snapshots ?? []) as Row[];
    // enrich title/color from TRACKS
    const enriched: Row[] = snaps.map(sn => {
      const t = TRACKS.find(x=>x.slug===sn.track_slug);
      return { track_slug: sn.track_slug as TrackSlug, title: t?.title ?? sn.track_slug.toUpperCase(), plays: sn.plays, views: sn.views, delta: sn.delta, delta_views: (sn as unknown as { delta_views:number}).delta_views ?? Math.round(sn.delta*2.2), color: t?.color ?? "#ff2d55" };
    });
    setRows(enriched);
  };
  useEffect(()=>{ load(period); }, [period]);

  // sort
  const sorted = [...rows].sort((a,b)=> sort==="plays" ? b.plays - a.plays : b.views - a.views);
  const max = Math.max(1, ...sorted.map(r=> sort==="plays"?r.plays:r.views));

  useEffect(()=>{
    if (!wrapRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(()=>{
      const bars = wrapRef.current!.querySelectorAll("[data-bar-fill]");
      gsap.fromTo(bars, { width: "0%" }, { width: (i:number,el:Element)=> (el as HTMLElement).dataset.w+"%" , duration:0.9, ease:"power3.out", stagger:0.08, overwrite:true });
      const ranks = wrapRef.current!.querySelectorAll("[data-rank]");
      gsap.fromTo(ranks, { y:12, opacity:0 }, { y:0, opacity:1, duration:0.3, stagger:0.06, ease:"power2.out" });
    }, wrapRef);
    return ()=>ctx.revert();
  }, [sorted, sort]);

  const doGuess = async () => {
    if (!guess) { setMsg("Выбери трек #1"); return; }
    const r = await fetch("/magnum/api/charts/guess", { method:"POST", credentials:"include", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ track: guess, period })});
    const j = await r.json() as { ok?:boolean; hit?:boolean; error?:string; reward?:number };
    if (!r.ok) { setMsg(j.error||"Ошибка"); return; }
    setMsg(j.hit ? `+${j.reward ?? 42} — угадал!` : "Мимо — попробуй завтра");
  };

  const doShare = async () => {
    const top = sorted[0];
    if (!top) { setMsg("Нет данных"); return; }
    const canvas = canvasRef.current;
    if (!canvas) { setMsg("Canvas нет"); return; }
    canvas.width=1080; canvas.height=1080;
    const ctx = canvas.getContext("2d")!;
    // bg
    const g = ctx.createLinearGradient(0,0,1080,1080);
    g.addColorStop(0,"#0a0a0a"); g.addColorStop(0.5,"#1a0a14"); g.addColorStop(1,"#ffcc00");
    ctx.fillStyle=g; ctx.fillRect(0,0,1080,1080);
    ctx.fillStyle="#fff"; ctx.font="900 72px Inter,sans-serif"; ctx.fillText("ЧАРТЫ 42",48,120);
    ctx.font="700 36px Inter,sans-serif"; ctx.fillText(`${LABEL[period]} • MAGNUM 5 треков`,48,180);
    ctx.font="800 54px Inter,sans-serif"; ctx.fillStyle="#ffcc00";
    ctx.fillText(`Мой топ — ${top.title} #1 ${formatK(top.plays)}`,48,280);
    ctx.fillStyle="rgba(255,255,255,.9)"; ctx.font="400 28px Inter,sans-serif";
    ctx.fillText(`Прослушивания • дельта 24ч ${top.delta>0?"+":""}${formatK(top.delta)}`,48,330);
    // bars mini
    let y=420;
    sorted.forEach((r, idx)=>{
      const pct = Math.round(( (sort==="plays"?r.plays:r.views) / max)*100);
      ctx.fillStyle="rgba(255,255,255,.12)"; ctx.fillRect(48,y,984,36);
      ctx.fillStyle=r.color; ctx.fillRect(48,y, Math.round(984*pct/100),36);
      ctx.fillStyle="#fff"; ctx.font="700 22px Inter"; ctx.fillText(`${idx+1}. ${r.title} — ${formatK(sort==="plays"?r.plays:r.views)}`,60,y+24);
      y+=52;
    });
    // QR placeholder
    ctx.fillStyle="rgba(255,255,255,.95)"; ctx.fillRect(390, y+20, 300,300);
    ctx.fillStyle="#000"; ctx.font="700 24px monospace"; ctx.fillText("QR", 520, y+170);
    ctx.font="400 18px monospace"; ctx.fillText(`${(typeof window!=="undefined"?window.location.origin:"")}/magnum/charts`, 260, y+340);
    ctx.fillStyle="rgba(255,255,255,.8)"; ctx.font="400 22px Inter"; ctx.fillText("MAGNUM • 5opka — 5 пуль • /magnum/charts",48,1050);
    // flip anim
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      canvas.classList.add(s.flip);
      setTimeout(()=>canvas.classList.remove(s.flip), 420);
    }
    // web share + download fallback
    try{
      const blob: Blob = await new Promise(res=> canvas.toBlob(b=>res(b!), "image/png"));
      const file = new File([blob], `charts42-${Date.now()}.png`, {type:"image/png"});
      const url = `${window.location.origin}/magnum/charts`;
      if ((navigator as unknown as { canShare?: (d:{files:File[]})=>boolean }).canShare?.({files:[file]})) {
        await navigator.share({ title:`ЧАРТЫ 42 — ${top.title} #1 ${formatK(top.plays)}`, text:`Мой топ ${period} — ${top.title} #1`, files:[file] });
      } else if ((navigator as unknown as { share?: (d:unknown)=>Promise<void>}).share) {
        await (navigator as unknown as { share:(d:unknown)=>Promise<void>}).share({ title:"ЧАРТЫ 42", text:`Мой топ ${top.title} #1 ${formatK(top.plays)} — ${url}`, url });
      } else {
        const a=document.createElement("a"); a.href=canvas.toDataURL("image/png"); a.download=`charts42-${Date.now()}.png`; a.click();
      }
    }catch{
      const a=document.createElement("a"); a.href=canvas.toDataURL("image/png"); a.download=`charts42-${Date.now()}.png`; a.click();
    }
    // +42 coins
    const day = new Date().toISOString().slice(0,10);
    const r = await fetch("/magnum/api/charts/share", { method:"POST", credentials:"include", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ dayId: day })});
    const j = await r.json() as { ok?:boolean; coins?:number; balance?:number; error?:string };
    if (r.ok && j.ok) setMsg(`+${j.coins} монет за шаринг • баланс ${j.balance}`);
    else if (r.status===409) setMsg("Уже делился сегодня — +42 1×/день");
    else if (j.error) setMsg(j.error);
  };

  return (
    <div ref={wrapRef} className={s.wrap}>
      <h1 className={s.h1}>ЧАРТЫ 42 <span style={{color:"#ff2d55"}}>— MAGNUM 5 треков</span></h1>
      <p className={s.sub}>Live-стримы/просмотры • дельта 24ч • бейдж #1 • шаринг 1080×1080 +42/день • угадай #1 +42</p>

      <div className={s.tabs}>
        {PERIODS.map(p=>(
          <button key={p} onClick={()=>setPeriod(p)} className={period===p ? `${s.tab} ${s.tabActive}` : s.tab}>{LABEL[p]}</button>
        ))}
      </div>

      <div className={s.sortRow}>
        <span style={{opacity:.7}}>Сортировка:</span>
        <button onClick={()=>setSort("plays")} className={sort==="plays"?`${s.sortBtn} ${s.sortBtnActive}`:s.sortBtn}>Прослушивания</button>
        <button onClick={()=>setSort("views")} className={sort==="views"?`${s.sortBtn} ${s.sortBtnActive}`:s.sortBtn}>Просмотры</button>
        <span className={s.badge}>5 треков</span>
      </div>

      <div>
        {sorted.map((r, idx)=> {
          const val = sort==="plays"?r.plays:r.views;
          const delta = sort==="plays"?r.delta:r.delta_views;
          const pct = Math.max(8, Math.round(val/max*100));
          const isFirst = idx===0;
          return (
            <div key={r.track_slug} className={s.barRow} style={isFirst&&isVip?{border:"2px solid #ffcc00", boxShadow:"0 0 18px rgba(255,204,0,.45)"}:undefined}>
              <span data-rank className={s.rank}>{idx+1}</span>
              {isFirst && <span className={s.crown} style={{fontSize:18}}>👑</span>}
              <span className={s.track} style={{color:r.color}}>{r.title}</span>
              <div className={s.barTrack}>
                <div data-bar-fill data-w={String(pct)} className={isFirst&&isVip?`${s.barFill} ${s.conicGold}`:s.barFill} style={{width:pct+"%", background: isFirst&&isVip ? undefined : r.color, opacity:.95}} />
              </div>
              <span className={s.num} style={{minWidth:72,textAlign:"right",fontWeight:700}}>{formatK(val)}</span>
              <span className={delta>=0? s.deltaPos : s.deltaNeg} style={{minWidth:64,textAlign:"right"}}>{delta>0?`+${formatK(delta)}`:formatK(delta)}</span>
              {isFirst && <span className={s.badge} style={{background:isVip?"conic-gradient(from 0deg,#ffcc00,#ffd700,#ffcc00)":""}}>#1</span>}
            </div>
          );
        })}
      </div>

      <div className={s.guessRow}>
        {TRACKS.map(t=>(
          <button key={t.slug} onClick={()=>setGuess(t.slug)} className={guess===t.slug?`${s.guessBtn} ${s.guessBtnActive}`:s.guessBtn} style={{borderColor:guess===t.slug? t.color:undefined}}>{t.title}</button>
        ))}
        <button onClick={doGuess} className={s.shareBtn} style={{background:"#00ff88",color:"#000"}}>Угадать #1 недели +42</button>
      </div>

      <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",marginTop:12}}>
        <button onClick={doShare} className={s.shareBtn} data-share-btn>Шерить 1080×1080 +42</button>
        {msg && <span style={{color:"#ffcc00"}}>{msg}</span>}
      </div>

      <canvas ref={canvasRef} width={1080} height={1080} style={{display:"none"}} />
      <p style={{opacity:.5,marginTop:12,fontSize:12}}>VIP #1 — conic-gold подсветка • GSAP bar 0.9s power3 stagger 0.08 • crown pulse 1.06 1.4s</p>
    </div>
  );
}
export default Charts42Page;
