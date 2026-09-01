import { useRef, useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import styles from "./RouletteGame.module.css";

const PRESAVE = "https://music.thefence.me/psmagnum";
const START_BALANCE = 1000;
const WIN_BALANCE = 4200;
const LS_BALANCE = "roulette42-balance";
const LS_HISTORY = "roulette42-history";

const CHIPS = [1, 5, 25, 100] as const;

const RED_NUMS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
type Color = "red"|"black"|"green";
function getColor(n: number): Color { if(n===0) return "green"; return RED_NUMS.has(n)?"red":"black"; }

// European order 0-36 clockwise
const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26] as const;
const WHEEL_COLORS: Record<number, string> = {};
WHEEL_ORDER.forEach(n=>{ WHEEL_COLORS[n]= getColor(n)==="green"?"#0a7a2e": getColor(n)==="red"?"#c81d25":"#1a1a1a"; });

type BetType = "straight"|"red"|"black"|"even"|"odd"|"low"|"high"|"dozen1"|"dozen2"|"dozen3";
interface Bet { type: BetType; amount: number; num?: number }
interface SpinRecord { n: number; color: Color; win: number; balance: number; }

function payout(bet: Bet, result: number, color: Color): number {
  if (bet.type==="straight") return bet.num===result ? bet.amount*35 : -bet.amount;
  if (bet.type==="red") return color==="red"? bet.amount : color==="green"? -bet.amount : -bet.amount;
  if (bet.type==="black") return color==="black"? bet.amount : color==="green"? -bet.amount : -bet.amount;
  if (bet.type==="even") return result!==0 && result%2===0 ? bet.amount : -bet.amount;
  if (bet.type==="odd") return result%2===1 ? bet.amount : -bet.amount;
  if (bet.type==="low") return result>=1 && result<=18 ? bet.amount : -bet.amount;
  if (bet.type==="high") return result>=19 && result<=36 ? bet.amount : -bet.amount;
  if (bet.type==="dozen1") return result>=1 && result<=12 ? bet.amount*2 : -bet.amount;
  if (bet.type==="dozen2") return result>=13 && result<=24 ? bet.amount*2 : -bet.amount;
  if (bet.type==="dozen3") return result>=25 && result<=36 ? bet.amount*2 : -bet.amount;
  return 0;
}
// for outside bets red/black etc payout is 1:1 except green loses, so net +amount
// dozen 2:1

let ac: AudioContext | null = null;
function ensureAC(){ try{ if(!ac) ac=new (window.AudioContext||(window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext)(); if(ac.state==="suspended") void ac.resume(); return ac; }catch{ return null; } }
function playTick(){ const c=ensureAC(); if(!c) return; const o=c.createOscillator(),g=c.createGain(); o.connect(g); g.connect(c.destination); o.type="square"; o.frequency.value=720+Math.random()*200; g.gain.setValueAtTime(0.08,c.currentTime); g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.08); o.start(); o.stop(c.currentTime+0.08); }
function playWinSound(){ const c=ensureAC(); if(!c) return; [0,0.12,0.24,0.38].forEach((d,i)=>{ const o=c.createOscillator(),g=c.createGain(); o.connect(g); g.connect(c.destination); o.type="sine"; o.frequency.value=520+i*120; g.gain.setValueAtTime(0.15,c.currentTime+d); g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+d+0.35); o.start(c.currentTime+d); o.stop(c.currentTime+d+0.35); }); }
function playLoseSound(){ const c=ensureAC(); if(!c) return; const o=c.createOscillator(),g=c.createGain(); o.connect(g); g.connect(c.destination); o.type="sawtooth"; o.frequency.value=140; o.frequency.linearRampToValueAtTime(80,c.currentTime+0.3); g.gain.setValueAtTime(0.1,c.currentTime); g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.35); o.start(); o.stop(c.currentTime+0.35); }

export function RouletteGame(){
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wheelRef = useRef({ rotation: 0 });
  const ballRef = useRef({ angle: 0 });
  const [balance, setBalance] = useState(()=>{ try{ const raw=localStorage.getItem(LS_BALANCE); if(raw===null) return START_BALANCE; const v=Number(raw); return isFinite(v)&&v>=0?v:START_BALANCE;}catch{return START_BALANCE;}});
  const [chip, setChip] = useState<number>(5);
  const [bets, setBets] = useState<Bet[]>([]);
  const [history, setHistory] = useState<SpinRecord[]>(()=>{ try{ return JSON.parse(localStorage.getItem(LS_HISTORY)||"[]"); }catch{ return []; }});
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number|null>(null);
  const [lastWin, setLastWin] = useState<number>(0);
  const [won, setWon] = useState(()=>{ try{ return Number(localStorage.getItem(LS_BALANCE))>=WIN_BALANCE; }catch{return false;}});
  const [showModal, setShowModal] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // persist
  useEffect(()=>{ try{ localStorage.setItem(LS_BALANCE, String(balance)); }catch{} if(balance>=WIN_BALANCE && !won){ setWon(true); setShowModal(true); playWinSound(); } },[balance, won]);
  useEffect(()=>{ try{ localStorage.setItem(LS_HISTORY, JSON.stringify(history.slice(0,20))); }catch{} },[history]);

  // GSAP entrance
  useEffect(()=>{
    if(!wrapRef.current) return;
    const ctx=gsap.context(()=>{ gsap.from(`.${styles.panel}`,{ y:30, opacity:0, duration:0.6, stagger:0.08, ease:"back.out(1.4)"}); },wrapRef);
    return ()=>ctx.revert();
  },[]);

  // wheel draw
  const draw = useCallback(()=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const ctx=canvas.getContext("2d"); if(!ctx) return;
    const dpr=window.devicePixelRatio||1;
    const w=canvas.clientWidth, h=canvas.clientHeight;
    canvas.width=w*dpr; canvas.height=h*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,w,h);
    const cx=w/2, cy=h/2, R=Math.min(w,h)/2 - 8;
    // outer ring shadow
    ctx.beginPath(); ctx.arc(cx,cy,R+6,0,Math.PI*2); ctx.fillStyle="#0d0d0d"; ctx.fill();
    ctx.strokeStyle="rgba(255,45,85,0.25)"; ctx.lineWidth=2; ctx.stroke();
    // segments
    const total=WHEEL_ORDER.length;
    const rot=wheelRef.current.rotation;
    WHEEL_ORDER.forEach((num, idx)=>{
      const start=(idx/total)*Math.PI*2 + rot;
      const end=((idx+1)/total)*Math.PI*2 + rot;
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,R,start,end); ctx.closePath();
      ctx.fillStyle=WHEEL_COLORS[num]||"#111";
      ctx.fill();
      ctx.strokeStyle="rgba(255,255,255,0.12)"; ctx.lineWidth=1; ctx.stroke();
      // number label
      const mid=(start+end)/2;
      const tx=cx+Math.cos(mid)*(R*0.74);
      const ty=cy+Math.sin(mid)*(R*0.74);
      ctx.save(); ctx.translate(tx,ty); ctx.rotate(mid+Math.PI/2);
      ctx.fillStyle=num===0? "#ffec99" : "#fff";
      ctx.font=`700 ${R<130?9:11}px Inter,system-ui`; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText(String(num),0,0);
      ctx.restore();
    });
    // center hub
    const grad=ctx.createRadialGradient(cx,cy, R*0.08, cx,cy, R*0.22);
    grad.addColorStop(0,"#2a2a2a"); grad.addColorStop(1,"#0a0a0a");
    ctx.beginPath(); ctx.arc(cx,cy,R*0.22,0,Math.PI*2); ctx.fillStyle=grad; ctx.fill();
    ctx.strokeStyle="rgba(255,255,255,0.15)"; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle="#ff2d55"; ctx.font=`800 ${R*0.12}px Inter`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("42",cx,cy);
    // ball track
    ctx.beginPath(); ctx.arc(cx,cy,R+10,0,Math.PI*2); ctx.strokeStyle="rgba(255,255,255,0.08)"; ctx.lineWidth=2; ctx.stroke();
    // ball
    const ballAngle=ballRef.current.angle;
    const br=R+10;
    const bx=cx+Math.cos(ballAngle)*br;
    const by=cy+Math.sin(ballAngle)*br;
    // ball shadow
    ctx.beginPath(); ctx.arc(bx+1,by+1,7,0,Math.PI*2); ctx.fillStyle="rgba(0,0,0,0.4)"; ctx.fill();
    ctx.beginPath(); ctx.arc(bx,by,6.5,0,Math.PI*2);
    const bg=ctx.createRadialGradient(bx-2,by-2,1, bx,by,6.5);
    bg.addColorStop(0,"#fff"); bg.addColorStop(1,"#e0e0e0");
    ctx.fillStyle=bg; ctx.fill();
    ctx.strokeStyle="rgba(0,0,0,0.2)"; ctx.lineWidth=1; ctx.stroke();
    // pointer at top
    ctx.save(); ctx.translate(cx, cy - R - 14);
    ctx.beginPath(); ctx.moveTo(0,10); ctx.lineTo(-8,-6); ctx.lineTo(8,-6); ctx.closePath();
    ctx.fillStyle="#ff2d55"; ctx.fill(); ctx.strokeStyle="#fff"; ctx.lineWidth=1; ctx.stroke();
    ctx.restore();
  },[]);

  useEffect(()=>{ draw(); const onResize=()=>draw(); window.addEventListener("resize", onResize); return()=>window.removeEventListener("resize", onResize); },[draw]);
  // redraw on rotation tick via rAF during gsap handled by onUpdate

  const totalBet = bets.reduce((s,b)=>s+b.amount,0);

  const placeBet = useCallback((type: BetType, num?: number)=>{
    if(spinning) return;
    if(balance - totalBet < chip) return;
    setBets(prev=>[...prev, { type, amount: chip, num }]);
    playTick();
  },[balance, totalBet, chip, spinning]);

  const removeLast = ()=> setBets(prev=>prev.slice(0,-1));
  const clearBets = ()=> setBets([]);

  const spin = useCallback(()=>{
    if(spinning || bets.length===0) return;
    setSpinning(true); setResult(null); setLastWin(0);
    // pick random number 0-36
    const idx=Math.floor(Math.random()*WHEEL_ORDER.length);
    const winningNumber=WHEEL_ORDER[idx]!;
    const col=getColor(winningNumber);
    // target rotation so winning number lands at top pointer (angle -PI/2)
    // wheel rotation rot: segment idx centered at angle idx/total*2pi + rot; want center == -PI/2
    const total=WHEEL_ORDER.length;
    const currentRot=wheelRef.current.rotation % (Math.PI*2);
    const targetCenter= -Math.PI/2;
    const segmentCenter=(idx+0.5)/total*Math.PI*2;
    // we want rot such that segmentCenter+rot == targetCenter (mod 2pi)
    let targetRot = targetCenter - segmentCenter;
    // add multiple spins 4-6 rounds
    const spins = 4 + Math.floor(Math.random()*3);
    // normalize to forward spin
    while(targetRot < currentRot) targetRot += Math.PI*2;
    targetRot += spins*Math.PI*2;
    const startRot=wheelRef.current.rotation;
    const delta=targetRot - startRot;
    // ball opposite direction faster
    const ballStart=ballRef.current.angle;
    const ballDelta= -(spins*2.2*Math.PI*2 + Math.random()*1.2);

    const obj={ p:0 };
    gsap.to(obj,{
      p:1, duration:4.2, ease:"power3.inOut",
      onUpdate:()=>{
        const t=obj.p;
        // ease
        wheelRef.current.rotation = startRot + delta*t;
        ballRef.current.angle = ballStart + ballDelta*t + Math.sin(t*Math.PI)*0.6;
        draw();
        if(Math.random()<0.08) playTick();
      },
      onComplete:()=>{
        wheelRef.current.rotation = targetRot % (Math.PI*2);
        // settle ball inside
        gsap.to(ballRef.current,{ angle: targetCenter, duration:0.35, ease:"back.out(1.5)", onUpdate:draw, onComplete:()=>{
          setResult(winningNumber);
          // calc payout net gain/loss
          let net=0;
          bets.forEach(b=>{
            const p=payout(b, winningNumber, col);
            net+=p;
          });
          // balance: deduct totalBet already? we compute net as sum of +/- amounts ; balance increases by net
          // But totalBet was not yet deducted ; apply: balance = balance + net
          // For winning straight: p = +35*amount (net profit) ; losing others -amount so correct.
          const newBalance = balance + net;
          const clamped = Math.max(0, newBalance);
          setBalance(clamped);
          setLastWin(net);
          setHistory(prev=>[{ n: winningNumber, color: col, win: net, balance: clamped }, ...prev].slice(0,20));
          setBets([]);
          setSpinning(false);
          if(net>0) playWinSound(); else playLoseSound();
          draw();
        }});
      }
    });
  },[spinning, bets, balance, draw]);

  const resetGame=()=>{
    setBalance(START_BALANCE); setBets([]); setHistory([]); setResult(null); setLastWin(0); setShowModal(false); setWon(false);
    try{ localStorage.removeItem(LS_BALANCE); localStorage.removeItem(LS_HISTORY);}catch{}
  };

  const canSpin = bets.length>0 && !spinning;

  // grouping for table: numbers 0 top, then 1-36 grid 3 cols x12 rows
  const straightTotal = (n:number)=> bets.filter(b=>b.type==="straight"&&b.num===n).reduce((s,b)=>s+b.amount,0);

  return (
    <div ref={wrapRef} className={styles.page}>
      <div className={styles.header}>
        <Link to="/magnum/games" className={styles.back}>← Игры</Link>
        <h1 className={styles.title}>РУЛЕТКА 42</h1>
        <p className={styles.sub}>Европейская 0-36 · собери 4200 монет</p>
      </div>

      <div className={styles.layout}>
        {/* left: wheel */}
        <div className={styles.wheelPanel + " " + styles.panel}>
          <div className={styles.balanceRow}>
            <span className={styles.balanceLabel}>Баланс</span>
            <span className={styles.balanceValue}>{balance} <span className={styles.coin}>◉</span></span>
            <span className={styles.target}>→ 4200</span>
          </div>
          <div className={styles.progressWrap}><div className={styles.progress} style={{width: `${Math.min(100, (balance/WIN_BALANCE)*100)}%`}} /></div>
          <div className={styles.canvasWrap}>
            <canvas ref={canvasRef} className={styles.canvas} width={320} height={320} />
          </div>
          {result!==null && (
            <div className={styles.resultBadge} style={{background: result===0?"#0a7a2e": RED_NUMS.has(result)?"#c81d25":"#1a1a1a"}}>
              {result} <span className={styles.resultColor}>{getColor(result)}</span> {lastWin!==0 && <span className={lastWin>0?styles.winTxt:styles.loseTxt}>{lastWin>0?`+${lastWin}`:lastWin}</span>}
            </div>
          )}
          <div className={styles.history}>
            {history.slice(0,14).map((h,i)=>(
              <span key={i} className={styles.histChip} data-color={h.color} title={`${h.n} ${h.win>0?`+${h.win}`:h.win}`}>{h.n}</span>
            ))}
            {history.length===0 && <span className={styles.histEmpty}>история спинов</span>}
          </div>
        </div>

        {/* right: betting table */}
        <div className={styles.betPanel + " " + styles.panel}>
          <div className={styles.chipRow}>
            {CHIPS.map(v=>(
              <button key={v} className={chip===v?styles.chipActive:styles.chip} onClick={()=>setChip(v)}>{v}</button>
            ))}
            <span className={styles.chipHint}>фишка: {chip}</span>
          </div>

          <div className={styles.table}>
            <button className={styles.zero} data-sel={straightTotal(0)>0?"1":undefined} onClick={()=>placeBet("straight",0)}>0<span className={styles.badge}>{straightTotal(0)||""}</span></button>
            <div className={styles.numGrid}>
              {Array.from({length:36},(_,i)=>i+1).map(n=>{
                const c=getColor(n);
                const amt=straightTotal(n);
                return <button key={n} className={styles.numCell} data-color={c} data-sel={amt>0?"1":undefined} onClick={()=>placeBet("straight",n)}>{n}{amt>0&&<span className={styles.badge}>{amt}</span>}</button>;
              })}
            </div>
            <div className={styles.outsideRow}>
              <button className={styles.outBtn} data-color="red" onClick={()=>placeBet("red")}>Красное ×2</button>
              <button className={styles.outBtn} data-color="black" onClick={()=>placeBet("black")}>Чёрное ×2</button>
              <button className={styles.outBtn} onClick={()=>placeBet("even")}>Чёт ×2</button>
              <button className={styles.outBtn} onClick={()=>placeBet("odd")}>Нечёт ×2</button>
              <button className={styles.outBtn} onClick={()=>placeBet("low")}>1-18 ×2</button>
              <button className={styles.outBtn} onClick={()=>placeBet("high")}>19-36 ×2</button>
            </div>
            <div className={styles.dozenRow}>
              <button className={styles.dozenBtn} onClick={()=>placeBet("dozen1")}>1-12 ×3</button>
              <button className={styles.dozenBtn} onClick={()=>placeBet("dozen2")}>13-24 ×3</button>
              <button className={styles.dozenBtn} onClick={()=>placeBet("dozen3")}>25-36 ×3</button>
            </div>
          </div>

          <div className={styles.betInfo}>
            <span>Ставка: <b>{totalBet}</b></span>
            <span className={styles.betCount}>{bets.length} фишек</span>
          </div>
          <div className={styles.betList}>
            {bets.slice(-8).map((b,i)=>(
              <span key={i} className={styles.betTag}>{b.type==="straight"?`#${b.num}`:b.type} {b.amount}</span>
            ))}
            {bets.length===0 && <span className={styles.betEmpty}>поставь фишки на поле</span>}
          </div>

          <div className={styles.actions}>
            <button className={styles.spinBtn} disabled={!canSpin} onClick={spin}>{spinning?"Крутим…":"КРУТИТЬ"}</button>
            <button className={styles.ghostBtn} onClick={removeLast} disabled={bets.length===0}>Отменить</button>
            <button className={styles.ghostBtn} onClick={clearBets} disabled={bets.length===0}>Сброс</button>
          </div>
          {balance<=0 && <div className={styles.busted}>Банк пуст <button className={styles.resetBtn} onClick={resetGame}>Заново 1000</button></div>}
          {balance>0 && balance<WIN_BALANCE && <button className={styles.resetLink} onClick={resetGame}>сбросить прогресс</button>}
          <p className={styles.payoutHint}>Прямая 35:1 · Дюжины 2:1 · Цвет/чёт/половины 1:1 · Zero забирает outside</p>
        </div>
      </div>

      {showModal && (
        <div className={styles.modalOverlay} onClick={()=>setShowModal(false)}>
          <div className={styles.modal} onClick={e=>e.stopPropagation()}>
            <div className={styles.modalBadge}>42</div>
            <h2>РУЛЕТКА 42 — ПОБЕДА!</h2>
            <p>Баланс {balance} · 4200 достигнуто. Твоя открытка ждёт.</p>
            <div className={styles.postcard}>MAGNUM — 42<br/><span>Спасибо, что сыграл. Забери пресейв и открытку.</span></div>
            <img src="/magnum/images/postcard-4200.png" alt="Открытка 42 — 4200 монет" className={styles.postcardImg} width={560} height={373} loading="eager" decoding="async" />
            <a href={PRESAVE} target="_blank" rel="noreferrer" className={styles.presaveBtn}>Открыть https://music.thefence.me/psmagnum</a>
            <div className={styles.modalActions}>
              <button className={styles.ghostBtn} onClick={()=>setShowModal(false)}>Продолжить играть</button>
              <Link to="/magnum/games" className={styles.ghostBtn}>К играм</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
