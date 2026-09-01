import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import styles from "./ArenaPage.module.css";

gsap.registerPlugin(useGSAP as never);

type LbRow = { player: string; score: number; created_at: string; avatar: string | null };
type LbRes = { leaderboard: LbRow[]; season: string; game: string; count: number; top3Bonus: number; crown: string; pulse: string };
type EloRes = { elo: number; top: Array<{ username: string; elo: number }> };

type ArenaLS = { rating: number; wins: number; season: string; streak: number; lastSeason?: string; claimedWin?: string; claimedStreak3?: string; claimedCrown?: string };

const LS_KEY = "magnum-arena-season";
const VOLCANO_PULSE = "1.2s";

function weekIdNow(): string {
  const d = new Date(); const jan1 = new Date(d.getFullYear(), 0, 1); const days = Math.floor((d.getTime() - jan1.getTime()) / 86400000);
  const week = Math.ceil((days + jan1.getDay() + 1) / 7); return `${d.getFullYear()}-W${String(week).padStart(2,"0")}`;
}
function season7dId(): string {
  // 7дн сезон — скользящее окно, но для LS и idempotence используем weekId
  return weekIdNow();
}
function loadLS(): ArenaLS {
  try { const raw = localStorage.getItem(LS_KEY); if (raw) return JSON.parse(raw) as ArenaLS; } catch {}
  return { rating: 1000, wins: 0, season: season7dId(), streak: 0 };
}
function saveLS(v: ArenaLS) { try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch {} }

function StreakCalendar({ streak, weekId }: { streak: number; weekId: string }) {
  return (
    <div className={styles.streakWrap} data-testid="streak-calendar">
      {Array.from({ length: 7 }, (_, i) => (
        <span key={i} className={`${styles.dot} ${i < streak ? styles.dotOn : ""}`}>{i < streak ? "✓" : i + 1}</span>
      ))}
      <span className={styles.weekLabel}>{weekId} • стрик {streak}/7 • VOLCANO 7дн</span>
    </div>
  );
}

export function ArenaPage() {
  const [lb, setLb] = useState<LbRow[]>([]);
  const [elo, setElo] = useState<number | null>(null);
  const [season] = useState(()=> season7dId());
  const [ls, setLs] = useState<ArenaLS>(()=> loadLS());
  const [msg, setMsg] = useState("");
  const [crownBonus] = useState(1420);
  const wrapRef = useRef<HTMLDivElement>(null);

  // hydrate LS once
  useEffect(()=>{ const v=loadLS(); if(v.season!==season){ v.season=season; } setLs(v); }, [season]);

  useEffect(()=>{
    let cancel=false;
    fetch("/magnum/api/leaderboard?game=duel42&limit=20", {credentials:"include"}).then(r=>r.json()).then((j:LbRes)=>{
      if(cancel) return;
      if(Array.isArray(j.leaderboard)) setLb(j.leaderboard);
    }).catch(()=>{});
    fetch("/magnum/api/duel42/elo",{credentials:"include"}).then(r=> r.ok? r.json(): null).then((j:EloRes|null)=>{
      if(cancel||!j) return; setElo(j.elo);
      // sync LS rating with server ELO if higher
      setLs(prev=>{
        if(j.elo!==prev.rating){ const nv={...prev, rating:j.elo, season}; saveLS(nv); return nv; }
        return prev;
      });
    }).catch(()=>{});
    return ()=>{ cancel=true; };
  }, [season]);

  // GSAP stagger y10 0.05 volcano-bar
  useGSAP(()=>{
    if(!wrapRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(prefersReduced) return;
    const bars = wrapRef.current.querySelectorAll<HTMLElement>(".volcano-bar");
    gsap.set(bars, { y: 10, opacity: 0 });
    gsap.to(bars, { y: 0, opacity: 1, duration: 0.42, stagger: 0.05, ease: "power2.out", overwrite: true });
    // also animate rows y10 stagger
    const rows = wrapRef.current.querySelectorAll<HTMLElement>("[data-arena-row]");
    gsap.set(rows, { y: 10, opacity: 0 });
    gsap.to(rows, { y: 0, opacity: 1, duration: 0.38, stagger: 0.05, ease: "power2.out", delay: 0.08 });
  }, { scope: wrapRef, dependencies: [lb] });

  // volcano-bar fill animation on lb change
  useEffect(()=>{
    if(!wrapRef.current) return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      wrapRef.current.querySelectorAll<HTMLElement>("[data-volcano-fill]").forEach(el=>{
        const pct = Number(el.dataset.pct||0); el.style.width = `${pct}%`;
      });
      return;
    }
    const fills = wrapRef.current.querySelectorAll<HTMLElement>("[data-volcano-fill]");
    fills.forEach(el=>{
      const pct = Number(el.dataset.pct||0);
      gsap.to(el, { width: `${pct}%`, duration: 0.45, ease: "power2.out", overwrite: true });
    });
  }, [lb]);

  const maxScore = Math.max(1, ...lb.map(r=>r.score), 1);

  async function claim(kind: "win"|"streak3"|"crown") {
    setMsg("");
    // LS guards for streak3/win (client streak) — server also guards via tx meta
    if(kind==="streak3" && ls.streak < 3) { setMsg("Нужен стрик 3 — выиграй 3 дуэли подряд"); return; }
    try{
      const r=await fetch("/magnum/api/arena/claim",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind, season})});
      const j=await r.json() as {ok?:boolean; already?:boolean; reward?:number; error?:string; balance?:number};
      if(!r.ok){ setMsg(j.error||"Ошибка"); return; }
      if(j.already){ setMsg(kind==="crown"? "👑 Crown уже получен в этом сезоне": kind==="streak3"? "🔥 Streak 3 уже получен": "✓ +42 уже получен"); return; }
      const reward = j.reward ?? (kind==="win"?42:kind==="streak3"?142:1420);
      setMsg(`+${reward} монет • ${kind} • ${season}`);
      // animate confetti-ish pulse on crown
      if(kind==="crown" && wrapRef.current){
        const c = wrapRef.current.querySelector<HTMLElement>("[data-crown]");
        if(c) { gsap.fromTo(c,{scale:0.8},{scale:1.08,duration:0.18,ease:"back.out(2)",yoyo:true,repeat:1}); }
      }
      // persist LS claimed flags
      const nv: ArenaLS = {...ls};
      if(kind==="win") nv.claimedWin = season;
      if(kind==="streak3") nv.claimedStreak3 = season;
      if(kind==="crown") nv.claimedCrown = season;
      setLs(nv); saveLS(nv);
    }catch{ setMsg("Сеть недоступна"); }
  }

  // simulate LS streak increment on win? For demo, expose helper to bump streak (cross with StreakCalendar)
  function bumpStreak() {
    const nv = {...ls, streak: Math.min(7, (ls.streak||0)+1), wins: (ls.wins||0)+1, season};
    setLs(nv); saveLS(nv); setMsg(`Стрик ${nv.streak}/7 • +1 win (LS) — нажми «Забрать +142» на 3-м`);
  }

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <h1 className={styles.title}>VOLCANO SEASON 42 <span style={{color:"#ff5722"}}>🌋</span></h1>
      <p className={styles.sub}>ELO 7дн • <span style={{color:"#ff5722",fontWeight:800}}>volcano-crown топ-3 👑</span> + pulse {VOLCANO_PULSE} + stagger y10 0.05 volcano-bar • /magnum/arena • StreakCalendar GSAP</p>

      <div className={styles.kpi}>
        <div className={styles.kpiItem}><div className={styles.kpiLab}>ELO 7дн</div><div className={styles.kpiVal}>{elo ?? ls.rating}</div></div>
        <div className={styles.kpiItem}><div className={styles.kpiLab}>Побед (LS)</div><div className={styles.kpiVal}>{ls.wins}</div></div>
        <div className={styles.kpiItem}><div className={styles.kpiLab}>Стрик</div><div className={styles.kpiVal}>{ls.streak}/7</div></div>
        <div className={styles.kpiItem}><div className={styles.kpiLab}>Сезон</div><div className={styles.kpiVal} style={{fontSize:14}}>{season} • 7дн</div></div>
        <div className={styles.kpiItem}><div className={styles.kpiLab}>Награды</div><div className={styles.kpiVal} style={{fontSize:12}}>+42 win / +142 streak3 / +{crownBonus} crown</div></div>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Лидерборд 7дн — magnum_leaderboard(game=duel42) • Neon</div>
          <div className={styles.meta} style={{marginTop:6}}>Топ-3: <span className={styles.badge}>👑 volcano-crown 42 + pulse 1.2s + {crownBonus} монет</span> • ELO +42 win / -12 loss • wager 42/142/420</div>
          <div className={styles.leader}>
            {lb.length===0 && <div className={styles.meta}>Загрузка… или пока нет боёв — сыграй в <a href="/magnum/games/duel-volcano" style={{color:"#ff5722",textDecoration:"underline"}}>DUEL VOLCANO</a></div>}
            {lb.map((r,i)=>{
              const pct = Math.max(6, Math.round((r.score / maxScore)*100));
              const isTop = i<3;
              return (
                <div key={`${r.player}-${i}`} data-arena-row className={`${styles.row} ${isTop?styles.rowTop:""}`}>
                  <div className={`${styles.crown} ${isTop?styles.crownVolcano:""}`} data-crown={isTop?1:0} style={isTop?{animation:"volcanoSpin 3s linear infinite, volcanoPulse 1.2s ease-in-out infinite"} as never:undefined} title={isTop?"volcano-crown 42 • conic-volcano + pulse 1.2s":""}>
                    {isTop ? "👑" : `#${i+1}`}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:800,fontSize:13,display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                      <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.player}</span>
                      {isTop && <span className={styles.badge} style={{fontSize:10}}>TOP {i+1} • +{crownBonus}</span>}
                      <span className={styles.meta} style={{marginLeft:"auto"}}>{r.score} pts</span>
                    </div>
                    <div className={`${styles.volcanoBar} volcano-bar`} style={{marginTop:6}}><div data-volcano-fill data-pct={pct} className={styles.volcanoFill} style={{width:`${pct}%`}} /></div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{marginTop:12,display:"flex",gap:8,flexWrap:"wrap"}}>
            <a href="/magnum/games/duel-volcano" className={`${styles.btn} ${styles.btnPrimary}`}>ИГРАТЬ VOLCANO →</a>
            <button type="button" className={styles.btn} onClick={bumpStreak}>+1 win (LS стрик)</button>
          </div>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Стрик-календарь 7дн • cross StreakCalendar</div>
            <StreakCalendar streak={ls.streak} weekId={season} />
            <div className={styles.meta} style={{marginTop:8}}>LS: <code>magnum-arena-season:{`{rating,wins,season,streak}`}</code> • streak 3 → +142 • crown топ-3 → +1420</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
              <button type="button" className={`${styles.btn} ${ls.claimedWin===season? "":styles.btnPrimary}`} disabled={ls.claimedWin===season} onClick={()=>claim("win")}>{ls.claimedWin===season?"✓ +42 получен":"+42 win"}</button>
              <button type="button" className={`${styles.btn} ${ls.claimedStreak3===season? "":styles.btnPrimary}`} disabled={ls.claimedStreak3===season || ls.streak<3} onClick={()=>claim("streak3")} title={ls.streak<3?"Нужен стрик 3":""}>{ls.claimedStreak3===season?"✓ +142 получен":"+142 streak 3"}</button>
              <button type="button" className={`${styles.btn} ${ls.claimedCrown===season? "":styles.btnPrimary}`} disabled={ls.claimedCrown===season} onClick={()=>claim("crown")}>{ls.claimedCrown===season?"✓ 👑 получен":"👑 +1420 crown топ-3"}</button>
            </div>
            {msg && <div className={styles.meta} style={{marginTop:8,color:"#7cff7c",fontWeight:700}}>{msg}</div>}
            <div className={styles.meta} style={{marginTop:8}}>Сброс: LS сбрасывается при смене weekId • сервер idempotent по (user, season, kind) в magnum_transactions</div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Как получить</div>
            <ul className={styles.meta} style={{marginTop:8,paddingLeft:16,display:"flex",flexDirection:"column",gap:4}}>
              <li><b>+42 win</b> — выиграй дуэль VOLCANO (WS 10с, volcano x11, eruption 2.5×)</li>
              <li><b>+142 streak 3</b> — 3 победы подряд в сезоне 7дн (LS стрик)</li>
              <li><b>+1420 crown</b> — войди в топ-3 ELO 7дн и забери crown (проверка Neon)</li>
              <li>Wager 42/142/420 • overheat 4с→1.5с • ghost-volcano trail</li>
            </ul>
            <a href="/magnum/games/duel-volcano" className={styles.btn} style={{marginTop:10,display:"inline-block",textAlign:"center"}}>Дуэль → /magnum/games/duel-volcano</a>
          </div>
        </div>
      </div>
    </div>
  );
}
