import { useState, useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import styles from "./BlackjackGame.module.css";

const PRESAVE = "https://music.thefence.me/psmagnum";
const GOAL = 4200;
const START_BALANCE = 1000;
const LS_BALANCE = "blackjack42-balance";
const LS_BEST = "blackjack42-best";
const MIN_BET = 10;

type Suit = "♠" | "♥" | "♦" | "♣";
type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
interface Card { suit: Suit; rank: Rank; value: number; id: string; hidden?: boolean }

const SUITS: Suit[] = ["♠","♥","♦","♣"];
const RANKS: Rank[] = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

function cardValue(r: Rank): number {
  if (r==="A") return 11;
  if (["J","Q","K"].includes(r)) return 10;
  return Number(r);
}
function makeDeck(): Card[] {
  const d: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) d.push({ suit:s, rank:r, value: cardValue(r), id: `${r}${s}${Math.random().toString(36).slice(2,5)}` });
  return shuffle(d);
}
function shuffle<T>(a: T[]): T[] {
  const b=[...a];
  for(let i=b.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); const tmp=b[i]!; b[i]=b[j]!; b[j]=tmp; }
  return b;
}
function handValue(hand: Card[]): number {
  let total = hand.filter(c=>!c.hidden).reduce((s,c)=>s+c.value,0);
  let aces = hand.filter(c=>!c.hidden && c.rank==="A").length;
  while(total>21 && aces>0){ total-=10; aces--; }
  return total;
}
function isBlackjack(hand: Card[]): boolean { return hand.length===2 && handValue(hand)===21; }
function isBust(hand: Card[]): boolean { return handValue(hand)>21; }
function isSoft17(hand: Card[]): boolean {
  const v = handValue(hand);
  if(v!==17) return false;
  // check if ace counts as 11
  let total=0, aces=0;
  for(const c of hand.filter(c=>!c.hidden)){ total+=c.value; if(c.rank==="A") aces++; }
  while(total>21 && aces>0){ total-=10; aces--; }
  return aces>0;
}

type Phase = "betting"|"player"|"dealer"|"result";
type Result = "win"|"lose"|"push"|"blackjack"|null;

export function BlackjackGame(){
  const [balance,setBalance]=useState<number>(()=>{
    try{ const v=localStorage.getItem(LS_BALANCE); return v?Number(v):START_BALANCE; }catch{return START_BALANCE;}
  });
  const [best,setBest]=useState<number>(()=>{
    try{ return Number(localStorage.getItem(LS_BEST))||START_BALANCE; }catch{return START_BALANCE;}
  });
  const [bet,setBet]=useState(25);
  const [deck,setDeck]=useState<Card[]>(()=>makeDeck());
  const [player,setPlayer]=useState<Card[]>([]);
  const [dealer,setDealer]=useState<Card[]>([]);
  const [phase,setPhase]=useState<Phase>("betting");
  const [result,setResult]=useState<Result>(null);
  const [msg,setMsg]=useState("Сделай ставку, братуха!");
  const [history,setHistory]=useState<string[]>([]);
  const [showWin,setShowWin]=useState(false);
  const [dealt,setDealt]=useState(false);
  const winCheckedRef=useRef(false);

  // persist balance
  useEffect(()=>{ try{ localStorage.setItem(LS_BALANCE,String(balance)); }catch{} const nb=Math.max(best,balance); if(nb!==best){ setBest(nb); try{localStorage.setItem(LS_BEST,String(nb));}catch{}} },[balance,best]);
  // victory check
  useEffect(()=>{
    if(balance>=GOAL && !winCheckedRef.current){
      winCheckedRef.current=true;
      setShowWin(true);
    }
    if(balance<GOAL) winCheckedRef.current=false;
  },[balance]);

  const needReshuffle = useCallback((d: Card[])=> d.length<12,[]);

  const draw = useCallback((d: Card[], n=1): [Card[], Card[]]=>{
    let cur=[...d];
    if(needReshuffle(cur)) cur=makeDeck();
    const out: Card[]=[];
    for(let i=0;i<n;i++){
      if(cur.length===0) cur=makeDeck();
      out.push(cur.pop()!);
    }
    return [cur, out];
  },[needReshuffle]);

  const deal = useCallback(()=>{
    if(balance < bet){ setMsg("Недостаточно монет! Уменьши ставку."); return; }
    let d=[...deck];
    if(needReshuffle(d)) d=makeDeck();
    // deal order: P D P D(hidden)
    const [d1,c1]=draw(d,1);
    const [d2,c2]=draw(d1,1);
    const [d3,c3]=draw(d2,1);
    const [d4,c4]=draw(d3,1);
    const p: Card[]=[c1[0]!, c3[0]!];
    const dl: Card[]=[c2[0]!, {...c4[0]!, hidden:true }];
    setDeck(d4);
    setPlayer(p);
    setDealer(dl);
    setPhase("player");
    setResult(null);
    setDealt(true);

    // immediate blackjack checks
    const pj = isBlackjack(p);
    // dealer blackjack only if his visible is 10/A but we peek? simplified: reveal and check
    const dlFull: Card[]=[c2[0]!, c4[0]!];
    const dj = isBlackjack(dlFull);

    if(pj && dj){
      setDealer(dlFull);
      setPhase("result");
      setResult("push");
      setMsg("Оба БЛЭКДЖЕК — ничья!");
      setHistory(h=> [`PUSH (оба BJ) — ставка возвращена`,...h].slice(0,8));
    } else if(pj){
      const win = Math.floor(bet*1.5);
      setDealer(dlFull);
      setPhase("result");
      setResult("blackjack");
      setBalance(b=>b+win);
      setMsg(`БЛЭКДЖЕК 42! +${win} монет`);
      setHistory(h=> [`BLACKJACK +${win}`,...h].slice(0,8));
    } else if(dj){
      // peek dealer BJ - instant lose (rare)
      setDealer(dlFull);
      setPhase("result");
      setResult("lose");
      setBalance(b=>Math.max(0,b-bet));
      setMsg("У дилера БЛЭКДЖЕК — проигрыш");
      setHistory(h=> [`LOSE vs BJ -${bet}`,...h].slice(0,8));
    } else {
      setMsg(`Твоя рука ${handValue(p)} — ещё карту?`);
    }
  },[balance,bet,deck,draw,needReshuffle]);

  const hit = useCallback(()=>{
    if(phase!=="player") return;
    let d=[...deck];
    const [nd,c]=draw(d,1);
    const np=[...player, c[0]!];
    setDeck(nd);
    setPlayer(np);
    if(isBust(np)){
      setPhase("result");
      setResult("lose");
      setBalance(b=>Math.max(0,b-bet));
      setMsg(`Перебор ${handValue(np)} — сгорел!`);
      setHistory(h=> [`BUST ${handValue(np)} -${bet}`,...h].slice(0,8));
    } else if(handValue(np)===21){
      // auto stand on 21
      setMsg("21 — стоим!");
    } else {
      setMsg(`У тебя ${handValue(np)} — ещё?`);
    }
  },[phase,deck,draw,player,bet]);

  const stand = useCallback(()=>{
    if(phase!=="player") return;
    // reveal dealer
    let dl: Card[] = dealer.map(c=>({...c, hidden:false}));
    let d=[...deck];
    // dealer draws
    let msgLocal="";
    const doDealer = ()=>{
      while(true){
        const v=handValue(dl);
        if(v>21){ break; }
        if(v>17) break;
        if(v===17 && !isSoft17(dl)) break;
        // hit
        const [nd,c]=draw(d,1);
        d=nd;
        const nc = c[0]!; dl=[...dl, nc];
        if(isBust(dl)) break;
      }
      setDeck(d);
      setDealer(dl);
      const pv=handValue(player);
      const dv=handValue(dl);
      if(isBust(dl)){
        setResult("win");
        setBalance(b=>b+bet);
        msgLocal=`Дилер сгорел (${dv}) — победа +${bet}!`;
        setHistory(h=> [`WIN vs bust +${bet}`,...h].slice(0,8));
      } else if(dv>pv){
        setResult("lose");
        setBalance(b=>Math.max(0,b-bet));
        msgLocal=`Дилер ${dv} vs ${pv} — проигрыш -${bet}`;
        setHistory(h=> [`LOSE ${pv} vs ${dv} -${bet}`,...h].slice(0,8));
      } else if(dv < pv){
        setResult("win");
        setBalance(b=>b+bet);
        msgLocal=`${pv} vs ${dv} — победа +${bet}!`;
        setHistory(h=> [`WIN ${pv} vs ${dv} +${bet}`,...h].slice(0,8));
      } else {
        setResult("push");
        msgLocal=`Ничья ${pv}:${dv} — ставка сохранена`;
        setHistory(h=> [`PUSH ${pv}:${dv}`,...h].slice(0,8));
      }
      setMsg(msgLocal);
      setPhase("result");
    };
    // slight delay for drama
    setDealer(dl);
    setPhase("dealer");
    setMsg("Дилер добирает...");
    setTimeout(doDealer, 650);
  },[phase,dealer,deck,draw,player,bet]);

  const doubleDown = useCallback(()=>{
    if(phase!=="player" || player.length!==2) return;
    if(balance < bet*2){ setMsg("Недостаточно монет для удвоения!"); return; }
    // double bet for this hand
    let d=[...deck];
    const [nd,c]=draw(d,1);
    const np=[...player, c[0]!];
    setDeck(nd);
    setPlayer(np);
    const doubledBet = bet*2;
    if(isBust(np)){
      setDealer(dealer.map(c=>({...c, hidden:false}))); // reveal for info
      setPhase("result");
      setResult("lose");
      setBalance(b=>Math.max(0,b - doubledBet));
      setMsg(`Дабл — перебор ${handValue(np)}! -${doubledBet}`);
      setHistory(h=> [`DOUBLE BUST -${doubledBet}`,...h].slice(0,8));
      return;
    }
    // otherwise dealer plays with doubled bet
    let dl: Card[] = dealer.map(c=>({...c, hidden:false}));
    let curD=nd;
    // dealer loop
    while(true){
      const v=handValue(dl);
      if(v>21) break;
      if(v>17) break;
      if(v===17 && !isSoft17(dl)) break;
      const [n2,cc]=draw(curD,1);
      curD=n2;
      const nc2=cc[0]!; dl=[...dl, nc2] as Card[];
      if(isBust(dl)) break;
    }
    setDeck(curD);
    setDealer(dl);
    const pv=handValue(np);
    const dv=handValue(dl);
    if(isBust(dl)){
      setResult("win");
      setBalance(b=>b+doubledBet);
      setMsg(`Дабл! Дилер сгорел — +${doubledBet} 🔥`);
      setHistory(h=> [`DOUBLE WIN +${doubledBet}`,...h].slice(0,8));
    } else if(dv>pv){
      setResult("lose");
      setBalance(b=>Math.max(0,b-doubledBet));
      setMsg(`Дабл: ${pv} vs ${dv} — проигрыш -${doubledBet}`);
      setHistory(h=> [`DOUBLE LOSE -${doubledBet}`,...h].slice(0,8));
    } else if(dv < pv){
      setResult("win");
      setBalance(b=>b+doubledBet);
      setMsg(`Дабл победа ${pv} vs ${dv} +${doubledBet}!`);
      setHistory(h=> [`DOUBLE WIN +${doubledBet}`,...h].slice(0,8));
    } else {
      setResult("push");
      setMsg(`Дабл ничья ${pv}:${dv}`);
      setHistory(h=> [`DOUBLE PUSH`,...h].slice(0,8));
    }
    setPhase("result");
  },[phase,player,dealer,deck,draw,bet,balance]);

  const nextRound = useCallback(()=>{
    setPlayer([]);
    setDealer([]);
    setPhase("betting");
    setResult(null);
    setDealt(false);
    setMsg(balance<=0 ? "Банк пуст — сброс!" : "Новая раздача — ставь монеты");
    if(balance<=0){
      // auto reset to 200 to avoid softlock
      setBalance(200);
      setBet(25);
      setMsg("Банк пополнен до 200 — снова в игру!");
    }
  },[balance]);

  const resetAll = useCallback(()=>{
    setBalance(START_BALANCE);
    setBest(START_BALANCE);
    try{ localStorage.setItem(LS_BALANCE,String(START_BALANCE)); localStorage.setItem(LS_BEST,String(START_BALANCE)); }catch{}
    setPlayer([]); setDealer([]); setDeck(makeDeck()); setPhase("betting"); setResult(null); setShowWin(false); winCheckedRef.current=false; setMsg("Баланс сброшен — 1000 монет!");
    setHistory([]);
  },[]);

  const canDouble = phase==="player" && player.length===2 && balance>=bet*2;
  const playerVal = handValue(player);
  const dealerValVisible = dealer.filter(c=>!c.hidden).reduce((s,c)=>s+c.value,0) - (dealer.some(c=>c.hidden && c.rank==="A")?0:0);
  // better visible calc with ace soft
  const dealerShownVal = (()=>{ const v=dealer.filter(c=>!c.hidden); if(!v.length) return 0; return handValue(v as Card[]); })();

  const betChips = [10,25,50,100,250];

  return (
    <div className={styles.page}>
      <h1>БЛЭКДЖЕК 42</h1>
      <p className={styles.sub}>Собери 21 • Дилер берёт до 17 • Цель {GOAL.toLocaleString("ru-RU")} монет</p>

      <div className={styles.hud}>
        <div className={styles.balance}><span>Баланс</span><strong className={balance>=GOAL?styles.gold:""}>{balance} <i>◉</i></strong></div>
        <div className={styles.progressWrap}><div className={styles.progress}><div className={styles.fill} style={{width:`${Math.min(100, (balance/GOAL)*100)}%`}}/></div><span className={styles.goal}>{balance}/{GOAL}</span></div>
        <div className={styles.stat}><span>Рекорд</span><strong>{best}</strong></div>
      </div>

      <div className={styles.table}>
        {/* Dealer */}
        <div className={styles.handBlock}>
          <div className={styles.handHead}><span>Дилер</span><span className={styles.handVal}>{phase==="betting" ? "—" : phase==="result" || dealt && dealer.every(c=>!c.hidden) ? handValue(dealer) : `${dealerShownVal} + ?`}</span>{dealer.length>0 && isBlackjack(dealer.filter(c=>!c.hidden) as Card[]) && phase==="result" && <span className={styles.badgeBJ}>BJ</span>}</div>
          <div className={styles.cards}>
            {dealer.length===0 && <div className={styles.placeholder}>Карты дилера</div>}
            {dealer.map((c,i)=>(
              <div key={c.id+i} className={`${styles.card} ${c.hidden?styles.hidden:""} ${c.suit==="♥"||c.suit==="♦"?styles.red:""}`} style={{zIndex:i, marginLeft: i===0?0:-18}}>
                {c.hidden ? <div className={styles.cardBack}><span>42</span></div> : <><span className={styles.rank}>{c.rank}</span><span className={styles.suit}>{c.suit}</span><span className={styles.rankSm}>{c.rank}</span></>}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.divider}/>

        {/* Player */}
        <div className={styles.handBlock}>
          <div className={styles.handHead}><span>Ты</span><span className={`${styles.handVal} ${playerVal>21?styles.bust: playerVal===21?styles.twentyOne:""}`}>{player.length? playerVal : "—"}</span>{isBlackjack(player) && <span className={styles.badgeBJ}>BJ 3:2</span>}{playerVal>21 && <span className={styles.badgeBust}>ПЕРЕБОР</span>}</div>
          <div className={styles.cards}>
            {player.length===0 && <div className={styles.placeholder}>Твои карты</div>}
            {player.map((c,i)=>(
              <div key={c.id+i} className={`${styles.card} ${c.suit==="♥"||c.suit==="♦"?styles.red:""}`} style={{zIndex:i, marginLeft: i===0?0:-18}}>
                <span className={styles.rank}>{c.rank}</span><span className={styles.suit}>{c.suit}</span><span className={styles.rankSm}>{c.rank}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.msg} data-result={result||""}>{msg}</div>
      </div>

      {/* Betting */}
      {phase==="betting" && (
        <div className={styles.betting}>
          <div className={styles.betRow}>
            <span className={styles.betLabel}>Ставка:</span><strong className={styles.betVal}>{bet} ◉</strong>
            <button className={styles.miniBtn} onClick={()=>setBet(b=>Math.max(MIN_BET, b-10))}>−10</button>
            <button className={styles.miniBtn} onClick={()=>setBet(b=>Math.min(balance, b+10))}>+10</button>
            <button className={styles.miniBtn} onClick={()=>setBet(Math.min(balance, Math.max(MIN_BET, Math.floor(balance/2))))}>½</button>
            <button className={styles.miniBtn} onClick={()=>setBet(balance)}>MAX</button>
          </div>
          <div className={styles.chips}>
            {betChips.map(v=>(
              <button key={v} disabled={balance < v} onClick={()=>setBet(v)} className={`${styles.chip} ${bet===v?styles.chipActive:""}`}>{v}</button>
            ))}
          </div>
          <button className={styles.dealBtn} onClick={deal} disabled={balance<bet || bet<MIN_BET}>Раздать 🃏</button>
          <div className={styles.rules}>BJ платит 3:2 • Дилер стоит на 17 • Дабл только на 2 картах • Перебор = проигрыш</div>
        </div>
      )}

      {/* Player actions */}
      {phase==="player" && (
        <div className={styles.controls}>
          <button className={styles.hitBtn} onClick={hit}>Ещё карту</button>
          <button className={styles.standBtn} onClick={stand}>Хватит</button>
          <button className={styles.doubleBtn} onClick={doubleDown} disabled={!canDouble} title={!canDouble?"Нужны 2 карты и баланс x2":"Удвоить и взять 1 карту"}>Дабл x2</button>
        </div>
      )}
      {phase==="dealer" && <div className={styles.controls}><span className={styles.dealing}>Дилер играет...</span></div>}

      {phase==="result" && (
        <div className={styles.controls}>
          <div className={`${styles.resultBadge} ${result==="win"||result==="blackjack"?styles.win : result==="push"?styles.push:styles.lose}`}>
            {result==="blackjack" ? "БЛЭКДЖЕК!" : result==="win" ? "ПОБЕДА!" : result==="push" ? "НИЧЬЯ" : "ПРОИГРЫШ"}
          </div>
          <button className={styles.dealBtn} onClick={nextRound}>Следующая раздача</button>
        </div>
      )}

      <div className={styles.bottomRow}>
        <Link to="/magnum/games" className={styles.back}>← К играм</Link>
        <button className={styles.resetBtn} onClick={resetAll}>Сброс баланса</button>
      </div>

      {history.length>0 && (
        <div className={styles.history}>
          <span className={styles.historyTitle}>История</span>
          {history.map((h,i)=><span key={i} className={styles.historyItem}>{h}</span>)}
        </div>
      )}

      <p className={styles.hint}>Подсказка: стой на 17+, бери на 11- • Дилер стоит на soft 17 • Цель 4200 = Открытка 42</p>

      {showWin && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <div className={styles.modalIcon}>🎉</div>
            <h2>Открытка 42</h2>
            <p>Братуха, ты нафармил <strong>{balance}</strong> монет!</p>
            <p className={styles.winSub}>Цель {GOAL} достигнута — казино 42 повержено!</p>
            <div className={styles.modalStats}><span>Баланс {balance} ◉</span><span>Рекорд {best} ◉</span></div>
            <a href={PRESAVE} target="_blank" rel="noreferrer" className={styles.presaveBtn}>Забрать пресейв MAGNUM →</a>
            <div className={styles.modalActions}>
              <button className={styles.playAgainBtn} onClick={()=>setShowWin(false)}>Продолжить катать</button>
              <button className={styles.resetBtn} onClick={resetAll}>Новая игра</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
