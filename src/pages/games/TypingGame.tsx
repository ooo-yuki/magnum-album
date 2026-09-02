import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./TypingGame.module.css";
gsap.registerPlugin(ScrollTrigger);

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
const RGB_GLOW = "0 12px 36px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,45,85,0.22), 0 0 28px rgba(255,45,85,0.22), 0 0 28px rgba(0,255,136,0.14), 0 0 32px rgba(255,204,0,0.10)";
function hoverIn(el: HTMLElement) {
  if (prefersReducedMotion()) return;
  gsap.to(el, { y: -4, boxShadow: RGB_GLOW, borderColor: "rgba(255,45,85,0.45)", duration: 0.3, ease: "power2.out", overwrite: true });
  const glow = el.querySelector<HTMLElement>("[data-glow]");
  if (glow) gsap.to(glow, { opacity: 1, duration: 0.3, overwrite: true });
}
function hoverOut(el: HTMLElement) {
  if (prefersReducedMotion()) { gsap.set(el, { clearProps: "boxShadow,borderColor" }); return; }
  gsap.to(el, { y: 0, boxShadow: "0 0 0 1px transparent, 0 0 0 transparent", borderColor: "rgba(35,35,43,1)", duration: 0.4, ease: "power2.out", overwrite: true });
  const glow = el.querySelector<HTMLElement>("[data-glow]");
  if (glow) gsap.to(glow, { opacity: 0.95, duration: 0.4, overwrite: true });
}
function safeRamp(param: AudioParam, fn: () => void, fallbackValue: number) {
  try { fn(); } catch { param.value = fallbackValue; }
}
const PRESAVE = "https://music.thefence.me/psmagnum";
interface Phrase { text: string; tag: string; }
const PHRASES: Phrase[] = [
  { text: "MAGNUM пять пуль финальный альбом 5opka и MellSher", tag: "Альбом 2026" },
  { text: "ТУСА МЕДУЗА восемь тысяч клипов в TikTok двести тысяч просмотров", tag: "Туса Медуза" },
  { text: "VPN второй сингл эры MAGNUM дежавю поп от дуэта", tag: "VPN" },
  { text: "CLAY Clowns Laugh At You пасхалка десять лет спрятанная в конце видео", tag: "CLAY" },
  { text: "СЛАВА БОССУ марш сорок два братухи посвящение в движение", tag: "42 братухи" },
  { text: "Drumedy продакшн The Fence лейбл пресейв на music dot thefence dot me", tag: "Пресейв" },
  { text: "пять треков мультижанровый финальный совместный альбом перед соло главой", tag: "5 пуль" },
  { text: "РЗТ рецензии семьдесят три балла восемьдесят один рецензия CLAY EP", tag: "РЗТ" },
  { text: "девятьсот двадцать три тысячи фолловеров Twitch пик двадцать восемь тысяч онлайна", tag: "Тур" },
  { text: "Super Duper Nova распалась последний фит пять треков танцуй тонированный жигуль", tag: "История" },
  { text: "Пятерка Кирилл Баранов MellSher Игорь Шерстюк дуэт который не умеет мимо", tag: "Артисты" },
  { text: "сорок два ответ на главный вопрос жизни вселенной и всего такого", tag: "42" },
];
const TYPING_TIPS: string[] = [
  "Печатай без взгляда на клавиатуру — 42 тренирует мышечную память",
  "Пробел — тоже символ, не забывай ритм",
  "Ошибся? Не стирай лихорадочно — вернись и добей комбо",
  "Комбо ×5 = горячий огонёк, ×10 = бог печати — держи серию",
  "3 фразы без ошибок → MAGNUM FEVER ×1.3 на 6 секунд",
  "MAGNUM — 5 пуль, 42 братухи, один финальный альбом",
  "ТУСА МЕДУЗА — 14.08, первый сингл эры MAGNUM",
  "VPN — второй сингл, дежавю-поп от дуэта",
  "Держи пальцы на ASDF JKL; — базовая позиция",
  "Скорость придёт с точностью — сначала 100% accuracy",
  "На Харде нужен 55 WPM — как у 42-го уровня братухи",
  "Пресейв даёт +42 монеты и сияющую обводку PRO",
  "Печатай фразу целиком — не торопись в конце",
  "FEVER подсвечивает золотом и ускоряет счётчик",
  "42 — ответ на главный вопрос, и твой WPM тоже",
];
type DiffKey = "easy" | "normal" | "hard";
const DIFFICULTY: Record<DiffKey, { label: string; emoji: string; win: number; phraseCount: number; desc: string; coinMul: number }> = {
  easy:   { label: "Изи",   emoji: "🟢", win: 28, phraseCount: 8,  desc: "8 фраз, 28 WPM — разогрев", coinMul: 1 },
  normal: { label: "Норм",  emoji: "🟡", win: 42, phraseCount: 12, desc: "12 фраз, 42 WPM — канон", coinMul: 1.5 },
  hard:   { label: "Хард",  emoji: "🔴", win: 55, phraseCount: 12, desc: "12 фраз, 55 WPM — бог печати", coinMul: 2 },
};
interface Particle { id: number; x: number; y: number; color: string; size: number; }
interface FloatText { id: number; text: string; color: string; }
function calcWPM(chars: number, ms: number): number {
  if (ms <= 0) return 0;
  const minutes = ms / 60000;
  const words = chars / 5;
  return Math.round(words / minutes);
}
function calcAccuracy(typed: string, target: string): number {
  if (typed.length === 0) return 100;
  let correct = 0;
  for (let i = 0; i < typed.length; i++) if (typed[i] === target[i]) correct++;
  return Math.round((correct / typed.length) * 100);
}
let ac: AudioContext | null = null;
function ensureAC() {
  if (!ac) try { ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { return null; }
  if (ac && ac.state === "suspended") void ac.resume();
  return ac;
}
function playKey(correct: boolean, combo: number) {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = correct ? "sine" : "square";
  const base = correct ? 560 + Math.min(combo * 22, 240) : 180;
  o.frequency.value = base;
  g.gain.setValueAtTime(correct ? 0.07 : 0.1, ctx.currentTime);
  safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (correct ? 0.08 : 0.12)), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.1);
  if (correct && combo > 0 && combo % 5 === 0) {
    const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
    o2.connect(g2); g2.connect(ctx.destination);
    o2.type = "triangle"; o2.frequency.value = 880 + combo * 10;
    g2.gain.setValueAtTime(0.12, ctx.currentTime + 0.02);
    safeRamp(g2.gain, () => g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22), 0.001);
    o2.start(ctx.currentTime + 0.02); o2.stop(ctx.currentTime + 0.25);
  }
}
function playFever() {
  const ctx = ensureAC(); if (!ctx) return;
  [0, 0.08, 0.16].forEach((d, i) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.value = 660 + i * 220;
    g.gain.setValueAtTime(0.14, ctx.currentTime + d);
    safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.3), 0.001);
    o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.35);
  });
}
function playPerfect() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "triangle"; o.frequency.value = 1040;
  g.gain.setValueAtTime(0.18, ctx.currentTime);
  safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.45);
}
function playWin() {
  const ctx = ensureAC(); if (!ctx) return;
  [0, 0.1, 0.2, 0.3].forEach((d, i) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.value = 440 + i * 110;
    g.gain.setValueAtTime(0.12, ctx.currentTime + d);
    safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.35), 0.001);
    o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.4);
  });
}
export function TypingGame() {
  const [state, setState] = useState<"menu" | "playing" | "done">("menu");
  const [diff, setDiff] = useState<DiffKey>(() => {
    try { const v = localStorage.getItem("typing42-diff") as DiffKey | null; return v && DIFFICULTY[v] ? v : "normal"; } catch { return "normal"; } // LS-UI-only: diff pref
  }); // LS-UI-only: diff pref
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [startTime, setStartTime] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [displayWpm, setDisplayWpm] = useState(0);
  const [bestWpm, setBestWpm] = useState(0);
  useEffect(()=>{ fetch("/magnum/api/games/my",{credentials:"include"}).then(r=>r.ok?r.json():null).then(j=>{ const arr=j?.scores as {game:string;score:number}[]|undefined; if(!arr) return; let m=0; for(const s of arr) if(s.game==="typing"&&s.score>m) m=s.score; if(m) setBestWpm(m); }).catch(()=>{}); },[]);
  const [completed, setCompleted] = useState(0);
  const [totalChars, setTotalChars] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [shake, setShake] = useState(false);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [comboPop, setComboPop] = useState(false);
  const [fever, setFever] = useState(false);
  const [perfectStreak, setPerfectStreak] = useState(0);
  const [phraseErrors, setPhraseErrors] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [floats, setFloats] = useState<FloatText[]>([]);
  const [tipIdx, setTipIdx] = useState(0);
  const [submitMsg, setSubmitMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const gameRef = useRef<HTMLDivElement>(null);
  const wpmRef = useRef<HTMLDivElement>(null);
  const feverTimerRef = useRef<number | null>(null);
  const cfg = DIFFICULTY[diff];
  const targetPhrases = PHRASES.slice(0, cfg.phraseCount);
  const phrase = targetPhrases[phraseIdx] ?? PHRASES[0]!;
  useEffect(() => { try { localStorage.setItem("typing42-diff", diff); } catch {} }, [diff]); // LS-UI-only
  const spawnParticles = useCallback((count: number, color: string) => {
    const id0 = Date.now();
    const arr: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: id0 + i, x: 50 + (Math.random() - 0.5) * 40, y: 50, color, size: 4 + Math.random() * 6,
    }));
    setParticles(p => [...p, ...arr]);
    setTimeout(() => setParticles(p => p.filter(x => !arr.some(a => a.id === x.id))), 700);
  }, []);
  const spawnFloat = useCallback((text: string, color: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setFloats(f => [...f, { id, text, color }]);
    setTimeout(() => setFloats(f => f.filter(x => x.id !== id)), 700);
  }, []);
  const startGame = useCallback(() => {
    setPhraseIdx(0); setTyped(""); setStartTime(0); setWpm(0); setDisplayWpm(0);
    setCompleted(0); setTotalChars(0); setTotalTime(0); setCombo(0); setMaxCombo(0);
    setFever(false); setPerfectStreak(0); setPhraseErrors(0); setParticles([]); setFloats([]); setSubmitMsg("");
    if (feverTimerRef.current) window.clearTimeout(feverTimerRef.current);
    setState("playing");
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);
  useEffect(() => {
    if (state !== "playing" || startTime === 0) return;
    const id = window.setInterval(() => {
      const elapsed = totalTime + (performance.now() - startTime);
      const chars = totalChars + typed.length;
      const raw = calcWPM(chars, elapsed);
      setWpm(raw);
      setDisplayWpm(fever ? Math.round(raw * 1.3) : raw);
    }, 150);
    return () => window.clearInterval(id);
  }, [state, startTime, totalTime, totalChars, typed.length, fever]);
  useEffect(() => {
    if (state !== "playing") return;
    const id = window.setInterval(() => setTipIdx(i => (i + 1) % TYPING_TIPS.length), 3200);
    return () => window.clearInterval(id);
  }, [state]);
  useEffect(() => {
    const root: HTMLElement | null = document.querySelector<HTMLElement>("[data-gsap-root]") || (gameRef.current as unknown as HTMLElement) || (document.body as unknown as HTMLElement);
    if (!root) return;
    if (prefersReducedMotion()) {
      const els = root.querySelectorAll<HTMLElement>(".card, [data-card]");
      if (els.length) gsap.set(els, { y: 0, opacity: 1, clearProps: "transform" });
      return;
    }
    const ctx = gsap.context(() => {
      const cards = root.querySelectorAll<HTMLElement>(".card, [data-card], .tile, .cell, [data-tip]");
      if (cards.length) {
        gsap.set(cards, { y: 24, opacity: 0 });
        ScrollTrigger.batch(cards, {
          onEnter: (batch) => gsap.to(batch, { y: 0, opacity: 1, stagger: 0.12, duration: 0.55, ease: "power2.out", overwrite: true }),
          start: "top 92%", once: true,
        });
      }
      const heroEls = root.querySelectorAll<HTMLElement>(".hero > *, [data-hero] > *");
      if (heroEls.length) {
        gsap.set(heroEls, { y: 24, opacity: 0 });
        gsap.to(heroEls, { y: 0, opacity: 1, stagger: 0.12, duration: 0.55, ease: "power2.out", delay: 0.05, overwrite: true });
      }
    }, root);
    return () => ctx.revert();
  }, [state]);
  const triggerFever = useCallback(() => {
    setFever(true); playFever(); spawnParticles(14, "#ffcc00"); spawnFloat("FEVER ×1.3", "#ffcc00");
    if (wpmRef.current && !prefersReducedMotion()) {
      gsap.fromTo(wpmRef.current, { scale: 1 }, { scale: 1.25, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.inOut" });
    }
    if (feverTimerRef.current) window.clearTimeout(feverTimerRef.current);
    feverTimerRef.current = window.setTimeout(() => setFever(false), 6000);
  }, [spawnParticles, spawnFloat]);
  const submitScore = useCallback(async (finalWpm: number, acc: number) => {
    const coins = Math.round(finalWpm * cfg.coinMul + (perfectStreak >= 3 ? 42 : 0) + (finalWpm >= cfg.win ? 42 : 0));
    try {
      const r = await fetch("/magnum/api/games/submit", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: "typing", score: finalWpm, accuracy: acc, combo: maxCombo, difficulty: diff, coins }),
      });
      if (r.ok) { const j = await r.json() as { coins?: number }; setSubmitMsg(`+${j.coins ?? coins} монет в Neon`); }
      else setSubmitMsg(`+${coins} монет (войди для сохранения)`);
    } catch { setSubmitMsg(`+${coins} монет`); }
  }, [cfg.coinMul, cfg.win, diff, maxCombo, perfectStreak]);
  const nextPhrase = useCallback(() => {
    const now = performance.now();
    const elapsed = now - startTime;
    const newCompleted = completed + 1;
    const newTotalChars = totalChars + phrase.text.length;
    const newTotalTime = totalTime + elapsed;
    const rawWpm = calcWPM(newTotalChars, newTotalTime);
    setCompleted(newCompleted); setTotalChars(newTotalChars); setTotalTime(newTotalTime);
    setWpm(rawWpm); setDisplayWpm(fever ? Math.round(rawWpm * 1.3) : rawWpm);
    const wasPerfect = phraseErrors === 0;
    if (wasPerfect) {
      const ns = perfectStreak + 1;
      setPerfectStreak(ns);
      playPerfect();
      spawnParticles(8, "#00ff88"); spawnFloat("PERFECT", "#00ff88");
      if (ns >= 3 && !fever) triggerFever();
      if (gameRef.current && !prefersReducedMotion()) {
        const el = gameRef.current.querySelector("[data-phrase]") as HTMLElement;
        if (el) gsap.fromTo(el, { scale: 1 }, { scale: 1.02, duration: 0.14, yoyo: true, repeat: 1, ease: "power2.inOut" });
      }
    } else {
      setPerfectStreak(0);
    }
    setPhraseErrors(0);
    if (newCompleted >= targetPhrases.length) {
      const finalWpm = calcWPM(newTotalChars, newTotalTime);
      const acc = 100;
      setBestWpm(v=> finalWpm>v?finalWpm:v);
      void fetch("/magnum/api/games/submit",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({game:"typing",score:finalWpm})}).catch(()=>{});
      playWin();
      if (wpmRef.current && !prefersReducedMotion()) gsap.fromTo(wpmRef.current, { scale: 1 }, { scale: 1.35, duration: 0.22, ease: "back.out(1.7)" });
      spawnParticles(18, finalWpm >= cfg.win ? "#ffcc00" : "#00ff88");
      setState("done");
      void submitScore(finalWpm, acc);
      return;
    }
    const nextIdx = (phraseIdx + 1) % targetPhrases.length;
    setPhraseIdx(nextIdx); setTyped(""); setStartTime(0);
    setTimeout(() => inputRef.current?.focus(), 40);
  }, [startTime, phrase, phraseErrors, perfectStreak, fever, completed, totalChars, totalTime, bestWpm, cfg.win, targetPhrases.length, phraseIdx, spawnParticles, spawnFloat, triggerFever, submitScore]);
  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (state !== "playing") return;
    if (startTime === 0 && val.length > 0) setStartTime(performance.now());
    if (val.length < typed.length) { setTyped(val); return; }
    if (val.length > typed.length) {
      const newCharIdx = val.length - 1;
      const expectedChar = phrase.text[newCharIdx];
      const newChar = val[newCharIdx];
      const correct = newChar === expectedChar;
      if (!correct) {
        playKey(false, combo);
        setShake(true); setTimeout(() => setShake(false), 200);
        setCombo(0); setPhraseErrors(c => c + 1);
        if (gameRef.current && !prefersReducedMotion()) {
          const el = gameRef.current.querySelector("[data-phrase]") as HTMLElement | null;
          if (el) gsap.fromTo(el, { x: 0 }, { x: 4, duration: 0.06, yoyo: true, repeat: 3, ease: "power2.inOut" });
        }
      } else {
        const newCombo = combo + 1;
        setCombo(newCombo); setMaxCombo(m => Math.max(m, newCombo));
        if (newCombo % 5 === 0) { setComboPop(true); setTimeout(() => setComboPop(false), 280); }
        playKey(true, newCombo);
        if (newCombo % 10 === 0) spawnParticles(6, "#ff2d55");
      }
    }
    setTyped(val);
    if (val === phrase.text) nextPhrase();
  }, [state, startTime, phrase, nextPhrase, typed.length, combo, spawnParticles]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === "Escape" && state === "playing") setState("menu"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);
  const accuracy = calcAccuracy(typed, phrase.text);
  const progress = (completed / targetPhrases.length) * 100;
  const comboTier = combo >= 10 ? "god" : combo >= 5 ? "hot" : combo >= 3 ? "warm" : "";
  const winWpm = cfg.win;
  return (
    <div className={styles.page} ref={gameRef} data-gsap-root>
      <h1 data-hero>СКОРОПЕЧАТАНИЕ 42</h1>
      <p className={styles.sub} data-hero>Печатай фразы MAGNUM — набери {winWpm} WPM на {cfg.label.toLowerCase()}!</p>
      {state === "menu" && (
        <div className={styles.menu} data-card>
          <div className={styles.diffRow} data-card>
            {(Object.keys(DIFFICULTY) as DiffKey[]).map(k => (
              <button key={k} onClick={() => setDiff(k)} onMouseEnter={e => hoverIn(e.currentTarget)} onMouseLeave={e => hoverOut(e.currentTarget)}
                className={`${styles.diffBtn} ${diff === k ? styles.diffActive : ""}`} data-glow>
                <span data-glow style={{ opacity: 0 }} />
                {DIFFICULTY[k].emoji} {DIFFICULTY[k].label}
              </button>
            ))}
          </div>
          <p className={styles.diffDesc}>{cfg.desc} · ×{cfg.coinMul} монет</p>
          <div className={styles.rules} data-card>
            <p>⌨️ Печатай точно как на экране — пробелы важны</p>
            <p>⏱️ WPM = символы ÷ 5 ÷ минуты</p>
            <p>🔥 Комбо за символы подряд — ×5 огонь, ×10 бог</p>
            <p>⚡ 3 идеальные фразы подряд → <strong style={{ color: "#ffcc00" }}>MAGNUM FEVER ×1.3</strong> на 6с</p>
            <p>🎯 {targetPhrases.length} фраз · цель {winWpm} WPM · {cfg.label}</p>
            <p>🏆 Пресейв MAGNUM — победа открывает +{Math.round(winWpm * cfg.coinMul)} монет</p>
          </div>
          <button className={styles.playBtn} onClick={startGame} onMouseEnter={e => hoverIn(e.currentTarget)} onMouseLeave={e => hoverOut(e.currentTarget)} data-testid="typing-play">Начать — {cfg.label}</button>
          {bestWpm > 0 && <p className={styles.hint}>Рекорд: {bestWpm} WPM · {bestWpm >= 55 ? "бог печати" : bestWpm >= 42 ? "братуха" : "новичок"}</p>}
          <Link to="/magnum/games" className={styles.back}>← К играм</Link>
        </div>
      )}
      {state === "playing" && (
        <div className={styles.gameArea}>
          <div className={styles.hud}>
            <div className={styles.stat}><span>Фраза</span><strong>{completed + 1} / {targetPhrases.length}</strong></div>
            <div ref={wpmRef} className={`${styles.stat} ${fever ? styles.fever : ""}`}><span>WPM {fever ? "FEVER ×1.3" : ""}</span><strong className={displayWpm >= winWpm ? styles.hot : ""}>{displayWpm}</strong></div>
            <div className={styles.stat}><span>Точность</span><strong>{accuracy}%</strong></div>
            <div className={`${styles.stat} ${comboTier ? styles[comboTier] : ""} ${comboPop ? styles.pop : ""}`}><span>Комбо</span><strong>{combo > 0 ? `×${combo}` : "—"}{combo >= 5 ? " 🔥" : ""}</strong></div>
            <div className={styles.stat}><span>Сложность</span><strong className={styles.tag}>{cfg.emoji} {cfg.label}</strong></div>
          </div>
          {fever && <div className={styles.feverBar}>⚡ MAGNUM FEVER ×1.3 — 6с золота!</div>}
          {combo >= 3 && <div className={`${styles.comboBar} ${styles[comboTier]}`}>КОМБО ×{combo} {combo >= 10 ? "— БОГ ПЕЧАТИ!" : combo >= 5 ? "— ОГОНЬ!" : ""}</div>}
          <div className={styles.progress}><div className={styles.fill} style={{ width: `${progress}%` }} /></div>
          <div className={styles.tip} data-tip>💡 {TYPING_TIPS[tipIdx]}</div>
          <div className={`${styles.phraseBox} ${shake ? styles.shake : ""} ${fever ? styles.phraseFever : ""}`} data-phrase>
            {phrase.text.split("").map((ch, i) => {
              let cls = "";
              if (i < typed.length) cls = typed[i] === ch ? styles.correct : styles.wrong;
              else if (i === typed.length) cls = styles.cursor;
              return <span key={`${phraseIdx}-${i}`} className={cls}>{ch}</span>;
            })}
            {particles.map(p => (
              <span key={p.id} className={styles.particle} style={{ left: `${p.x}%`, top: `${p.y}%`, background: p.color, width: p.size, height: p.size } as React.CSSProperties} />
            ))}
            {floats.map(f => (
              <span key={f.id} className={styles.floatText} style={{ color: f.color }}>{f.text}</span>
            ))}
          </div>
          <div className={styles.streakRow}>
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className={`${styles.streakDot} ${i < perfectStreak ? styles.streakOn : ""}`}>●</span>
            ))}
            <span className={styles.streakLabel}>PERFECT ×{perfectStreak}/3 → FEVER</span>
          </div>
          <input ref={inputRef} className={styles.input} value={typed} onChange={handleInput} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} placeholder="Начни печатать..." />
          <div className={styles.navRow}>
            <button className={styles.restartBtn} onClick={() => setState("menu")}>Меню</button>
            <Link to="/magnum/games" className={styles.backInline}>← К играм</Link>
          </div>
        </div>
      )}
      {state === "done" && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2>{displayWpm >= winWpm || wpm >= winWpm ? "🏆 Скорость братухи!" : "⌨️ Неплохо!"}</h2>
            <div className={styles.resultGrid}>
              <div className={styles.resultItem}><span>WPM</span><strong>{wpm}</strong></div>
              <div className={styles.resultItem}><span>Фраз</span><strong>{completed}</strong></div>
              <div className={styles.resultItem}><span>Рекорд</span><strong>{bestWpm}</strong></div>
              <div className={styles.resultItem}><span>Макс комбо</span><strong>×{maxCombo}</strong></div>
            </div>
            <p className={styles.resultText}>
              {wpm >= winWpm
                ? `${wpm} WPM на ${cfg.label} — ты печатаешь как настоящий 42 братуха! Все ${targetPhrases.length} фраз пройдены.`
                : `Набрано ${wpm} WPM из ${winWpm} нужных на ${cfg.label}. Попробуй ещё — тренируйся на фразах MAGNUM!`}
              {maxCombo >= 10 ? " 🔥 Комбо ×10 — бог печати!" : maxCombo >= 5 ? " Комбо радует!" : ""}
            </p>
            {submitMsg && <p className={styles.submitHint}>{submitMsg}</p>}
            <a href={PRESAVE} target="_blank" rel="noreferrer" className={styles.presaveBtn}>Пресейв MAGNUM →</a>
            <div className={styles.modalActions}>
              <button className={styles.playBtn} onClick={startGame}>Ещё раз</button>
              <button className={styles.diffBtn} onClick={() => setState("menu")} style={{ padding: "0.7rem 1.2rem", borderRadius: 100 }}>Сменить сложность</button>
              <Link to="/magnum/games" className={styles.backInline}>← К играм</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
