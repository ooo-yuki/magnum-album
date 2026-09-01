import { useState, useCallback, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./Timeline2026Game.module.css";
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

function safeRamp(param: AudioParam, fn: () => void, fallback: number) {
  try { fn(); } catch { param.value = fallback; }
}

const PRESAVE = "https://music.thefence.me/psmagnum";

interface Event {
  id: string;
  date: string;
  sortKey: number;
  title: string;
  detail: string;
  emoji: string;
  yearHint: string;
}

// ─── Expanded chronology: 14 events — full 2026 MAGNUM lore ────────────────
const EVENTS: Event[] = [
  { id: "presave", date: "01.01.2026", sortKey: 20260101, title: "Пресейв MAGNUM открыт", detail: "Bandlink The Fence — один клик и 5 пуль прилетят первыми в личку.", emoji: "🔗", yearHint: "Первый день года" },
  { id: "newyear", date: "12.01.2026", sortKey: 20260112, title: "Тизер MAGNUM в соцсетях", detail: "5opka дропнул чёрный постер с надписью MAGNUM • 5 пуль. Фанаты гадают.", emoji: "👁️", yearHint: "Январь — первые намёки" },
  { id: "clay", date: "03.04.2026", sortKey: 20260403, title: "CLAY EP — 5 треков", detail: "РЗТ 73/100. Clowns Laugh At You — пасхалка на 10 лет вместе.", emoji: "🤡", yearHint: "Весна — глина" },
  { id: "gq", date: "18.04.2026", sortKey: 20260418, title: "GQ: интервью 5opka x MellSher", detail: "«Мы не делаем альбом — мы заряжаем обойму». 5 пуль как концепт.", emoji: "📰", yearHint: "После CLAY — пресса" },
  { id: "vpn", date: "15.05.2026", sortKey: 20260515, title: "VPN — второй сингл", detail: "Поп-вайб 2:23. Дежавю-поп от дуэта. Ротация РЗТ, 1.2M стримов за неделю.", emoji: "🔐", yearHint: "Май — сингл №2" },
  { id: "twitch1m", date: "02.06.2026", sortKey: 20260602, title: "1M фолловеров Twitch", detail: "Юбилейный стрим 12ч — 34K онлайн пик. Чат спамит MAGNUM.", emoji: "💜", yearHint: "Начало лета — миллион" },
  { id: "summercamp", date: "28.06.2026", sortKey: 20260628, title: "Летний кэмп — запись MAGNUM", detail: "Дача, 5 дней, 5 треков live. MellSher на битах, 5opka на тексте.", emoji: "🏕️", yearHint: "Конец июня — лагерь" },
  { id: "meduza", date: "14.08.2026", sortKey: 20260814, title: "ТУСА МЕДУЗА — хит лета", detail: "8K+ клипов TikTok, 200K+ просмотров за сутки. Первый выстрел альбома.", emoji: "🪼", yearHint: "Середина августа — медуза" },
  { id: "chart", date: "22.08.2026", sortKey: 20260822, title: "ТУСА МЕДУЗА в чартах", detail: "Top-15 VK, Top-30 Yandex. 42 в названии — оммаж движению.", emoji: "📈", yearHint: "Через неделю после релиза" },
  { id: "clip", date: "05.09.2026", sortKey: 20260905, title: "Клип ТУСА МЕДУЗА", detail: "Съёмка в Питере — неон, медузы, 42 неоновых вывески.", emoji: "🎬", yearHint: "Начало осени — визуал" },
  { id: "leak", date: "19.09.2026", sortKey: 20260919, title: "Слив сниппета 5-й пули", detail: "15 сек в ТГ — 500K просмотров. Фанаты расшифровывают текст.", emoji: "💧", yearHint: "Сентябрь — утечка" },
  { id: "album", date: "10.10.2026", sortKey: 20261010, title: "MAGNUM — 5 пуль • альбом", detail: "Финальный альбом дуэта. 5 треков — 5 пуль. Осень 2026.", emoji: "💿", yearHint: "Октябрь — релиз" },
  { id: "tour", date: "01.11.2026", sortKey: 20261101, title: "MAGNUM тур — анонс", detail: "923K фолловеров, пик 28K на стриме-анонсе. 5 городов.", emoji: "🎤", yearHint: "Ноябрь — тур" },
  { id: "vinyl", date: "20.12.2026", sortKey: 20261220, title: "Винил MAGNUM limited 42", detail: "42 пронумерованных пластинки, красный винил, автографы.", emoji: "📀", yearHint: "Декабрь — винил" },
];

// ─── Lore facts shown on win/fail (content array 50+ lines) ────────────────
const LORE_FACTS: string[] = [
  "42 — число движения: 42 участника, 42 винила, 42 клетки змейки.",
  "CLAY — глина: 5opka лепил биты как из глины, 5 треков за 5 дней.",
  "VPN — про связь сквозь стены, как будто сигнал проходит через запреты.",
  "ТУСА МЕДУЗА — написана за одну ночь в кэмпе, припев родился первым.",
  "MAGNUM — не калибр, а 5 пуль-историй: каждая про одного из них.",
  "Пресейв на The Fence — первый пресейв дуэта вне VK.",
  "Слив 5-й пули был случайным — забыли выключить запись в ТГ.",
  "Винил 42 штуки — отсылка к 42 движению, больше не допечатают.",
  "Тур 5 городов — по одному на каждую пулю.",
  "1M Twitch — 5opka шёл к нему 4 года, отметка в июне 2026.",
  "GQ-интервью снимали в той же студии, где писали CLAY.",
  "Клип ТУСА МЕДУЗА — 42 неоновые вывески, искали по всему Питеру.",
  "РЗТ 73/100 за CLAY — высший балл дуэта на тот момент.",
  "Чарты: ТУСА МЕДУЗА держалась 3 недели в Top-20.",
  "MellSher сделал бит VPN за 40 минут — рекорд скорости.",
  "Дача-кэмп: писали босиком, ели только лапшу и энергетик.",
  "Обложка MAGNUM — пять гильз на чёрном бархате.",
  "Фанаты нашли в VPN задом-наперед фразу '42 навсегда'.",
  "Постер-тизер 12.01 — на нём спрятаны координаты дачи.",
  "923K Twitch к туру — почти миллион, но решили не ждать.",
  "5opka хранит первую демку ТУСА МЕДУЗА на диктофоне iPhone.",
  "42 винила подпишет лично MellSher — у него каллиграфия.",
];

// ─── Difficulty presets (balance) ───────────────────────────────────────────
type Difficulty = "easy" | "normal" | "hard";
const DIFFICULTY_CFG: Record<Difficulty, { events: number; lives: number; timePerRound: number; label: string }> = {
  easy: { events: 5, lives: 4, timePerRound: 90, label: "Лайт" },
  normal: { events: 7, lives: 3, timePerRound: 75, label: "Норм" },
  hard: { events: 10, lives: 2, timePerRound: 60, label: "Хард" },
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i]!, a[j]!] = [a[j]!, a[i]!];
  }
  return a;
}

// ─── WebAudio: soft safeRamp wrappers + mute ────────────────────────────────
let ac: AudioContext | null = null;
function ensureAC(): AudioContext | null {
  if (!ac) try { ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { return null; }
  if (ac && ac.state === "suspended") void ac.resume();
  return ac;
}
function playSelect() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination);
  o.type = "triangle"; o.frequency.value = 520;
  safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(620, ctx.currentTime + 0.07), 620);
  g.gain.setValueAtTime(0.09, ctx.currentTime); safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.13);
}
function playHover() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination);
  o.type = "sine"; o.frequency.value = 820; g.gain.setValueAtTime(0.04, ctx.currentTime);
  safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.08);
}
function playCorrect() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination);
  o.type = "sine"; o.frequency.value = 660;
  safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.1), 880);
  g.gain.setValueAtTime(0.18, ctx.currentTime); safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.3);
  const o2 = ctx.createOscillator(); const g2 = ctx.createGain(); o2.connect(g2); g2.connect(ctx.destination);
  o2.type = "triangle"; o2.frequency.value = 1320; g2.gain.setValueAtTime(0.06, ctx.currentTime + 0.06);
  safeRamp(g2.gain, () => g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22), 0.001);
  o2.start(ctx.currentTime + 0.06); o2.stop(ctx.currentTime + 0.24);
}
function playComboSfx(n: number) {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination);
  o.type = "sine"; o.frequency.value = 740 + Math.min(n, 6) * 60;
  safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(1040, ctx.currentTime + 0.09), 1040);
  g.gain.setValueAtTime(0.14, ctx.currentTime); safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.24);
}
function playWrong() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination);
  o.type = "square"; o.frequency.value = 180;
  g.gain.setValueAtTime(0.13, ctx.currentTime); safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32), 0.001);
  safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(120, ctx.currentTime + 0.18), 120);
  o.start(); o.stop(ctx.currentTime + 0.34);
}
function playWin() {
  const ctx = ensureAC(); if (!ctx) return;
  const notes = [523.25, 659.25, 783.99, 1046.5, 1174.66];
  notes.forEach((f, i) => {
    const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination);
    o.type = i % 2 === 0 ? "sine" : "triangle"; o.frequency.value = f;
    const t0 = ctx.currentTime + i * 0.11;
    g.gain.setValueAtTime(0, t0); safeRamp(g.gain, () => g.gain.linearRampToValueAtTime(0.15, t0 + 0.02), 0.15);
    safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5), 0.001);
    o.start(t0); o.stop(t0 + 0.55);
  });
}

export function Timeline2026Game() {
  const [state, setState] = useState<"menu" | "playing" | "win" | "fail">("menu");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [cards, setCards] = useState<Event[]>([]);
  const [placed, setPlaced] = useState<Event[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"ok" | "bad" | null>(null);
  const [best, setBest] = useState<number>(0);
  // Neon best — progress in magnum_game_scores (SPEC §7), без LS
  useEffect(()=>{ fetch("/magnum/api/games/my",{credentials:"include"}).then(r=>r.ok?r.json():null).then(j=>{ const arr=j?.scores as {game:string;score:number}[]|undefined; if(!arr) return; let m=0; for(const s of arr) if(s.game==="timeline"&&s.score>m) m=s.score; if(m) setBest(m); }).catch(()=>{}); },[]);
  const [streak, setStreak] = useState(0);
  const [hints, setHints] = useState(3);
  const [hintReveal, setHintReveal] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(75);
  const [showConfetti, setShowConfetti] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const placedRef = useRef<HTMLDivElement>(null);
  const confettiRef = useRef<HTMLCanvasElement>(null);
  const streakRef = useRef<HTMLDivElement>(null);

  const ROUNDS = 5;
  const cfg = DIFFICULTY_CFG[difficulty];
  const POINTS_PER = Math.round(4200 / (ROUNDS * cfg.events)); // баланс к 4200

  // timer
  useEffect(() => {
    if (state !== "playing") return;
    const id = window.setInterval(() => setTimeLeft((t) => {
      if (t <= 1) { setState("fail"); return 0; }
      return t - 1;
    }), 1000);
    return () => window.clearInterval(id);
  }, [state, round]);

  // confetti canvas
  useEffect(() => {
    if (!showConfetti || !confettiRef.current) return;
    const canvas = confettiRef.current;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width = window.innerWidth;
    const H = canvas.height = window.innerHeight;
    const colors = ["#ff2d55", "#ffcc00", "#00ff88", "#5865f2", "#a855f7", "#fff"];
    type P = { x: number; y: number; vx: number; vy: number; r: number; c: string; rot: number; vr: number };
    const parts: P[] = Array.from({ length: 90 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * 200, y: H / 2 - 80 + (Math.random() - 0.5) * 40,
      vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 7 - 2, r: 4 + Math.random() * 5, c: colors[Math.floor(Math.random() * colors.length)]!,
      rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.35,
    }));
    let raf = 0; let t0 = performance.now();
    const draw = (now: number) => {
      const dt = now - t0; if (dt > 2400) { setShowConfetti(false); return; }
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.22; p.vx *= 0.998; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - dt / 2400);
        ctx.fillRect(-p.r, -p.r * 0.4, p.r * 2, p.r);
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [showConfetti]);

  const startGame = useCallback(() => {
    const pool = shuffle(EVENTS).slice(0, cfg.events);
    setCards(shuffle(pool));
    setPlaced([]); setRound(0); setScore(0); setLives(cfg.lives); setSelected(null); setFeedback(null);
    setStreak(0); setHints(3); setHintReveal(null); setTimeLeft(cfg.timePerRound); setState("playing");
    setShowConfetti(false);
    if (!muted) ensureAC();
  }, [cfg.events, cfg.lives, cfg.timePerRound, muted]);

  const pickCard = useCallback((id: string) => {
    if (feedback) return;
    setSelected(id);
    if (!muted) playSelect();
    // GSAP select pop
    if (!prefersReducedMotion()) {
      const el = document.querySelector<HTMLElement>(`[data-card-id="${id}"]`);
      if (el) gsap.fromTo(el, { scale: 0.97 }, { scale: 1, duration: 0.22, ease: "back.out(1.5)", overwrite: true });
    }
  }, [feedback, muted]);

  const useHint = useCallback(() => {
    if (hints <= 0 || feedback || hintReveal) return;
    const remaining = cards.filter(c => !placed.find(p => p.id === c.id));
    if (remaining.length === 0) return;
    const correct = remaining.reduce((m, c) => c.sortKey < m.sortKey ? c : m, remaining[0]!);
    setHintReveal(correct.id);
    setHints(h => h - 1);
    if (!muted) playHover();
    window.setTimeout(() => setHintReveal(null), 1600);
  }, [hints, feedback, hintReveal, cards, placed, muted]);

  const placeCard = useCallback(() => {
    if (!selected || feedback) return;
    const card = cards.find(c => c.id === selected);
    if (!card) return;
    const remaining = cards.filter(c => !placed.find(p => p.id === c.id));
    const correctNext = remaining.reduce((min, c) => c.sortKey < min.sortKey ? c : min, remaining[0]!);
    const isCorrect = card.id === correctNext.id;

    if (isCorrect) {
      const newPlaced = [...placed, card];
      setPlaced(newPlaced);
      const comboBonus = streak >= 2 ? streak * 40 : 0;
      const gain = POINTS_PER + comboBonus;
      setScore(s => s + gain);
      setStreak(s => s + 1);
      setFeedback("ok");
      if (!muted) { playCorrect(); if (streak >= 2) playComboSfx(streak); }
      if (!prefersReducedMotion() && streakRef.current && streak >= 2) {
        gsap.fromTo(streakRef.current, { scale: 0.75, rotation: -4 }, { scale: 1, rotation: 0, duration: 0.38, ease: "back.out(1.7)", overwrite: true });
      }
      setTimeout(() => {
        if (placedRef.current) {
          const last = placedRef.current.lastElementChild;
          if (last) gsap.from(last as HTMLElement, { y: 18, opacity: 0, scale: 0.92, duration: 0.34, ease: "back.out(1.7)" });
        }
      }, 50);
      setTimeout(() => {
        setFeedback(null); setSelected(null);
        if (newPlaced.length === cfg.events) {
          if (round + 1 >= ROUNDS) {
            const finalScore = score + gain;
            if (finalScore > best) { setBest(finalScore); void fetch("/magnum/api/games/submit",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({game:"timeline",score:finalScore})}).catch(()=>{}); }
            if (!muted) playWin();
            setShowConfetti(true);
            if (!prefersReducedMotion() && placedRef.current) {
              gsap.from(placedRef.current.children, { y: 12, opacity: 0, stagger: 0.06, duration: 0.4, ease: "power2.out" });
            }
            setState("win");
          } else {
            const nextPool = shuffle(EVENTS).slice(0, cfg.events);
            setRound(r => r + 1); setCards(shuffle(nextPool)); setPlaced([]); setSelected(null); setTimeLeft(cfg.timePerRound);
          }
        }
      }, 580);
    } else {
      setLives(l => l - 1); setFeedback("bad"); setStreak(0);
      if (!muted) playWrong();
      if (listRef.current && !prefersReducedMotion()) gsap.to(listRef.current, { x: -8, duration: 0.06, yoyo: true, repeat: 5, ease: "power2.inOut" });
      setTimeout(() => {
        setFeedback(null); setSelected(null);
        if (lives - 1 <= 0) setState("fail");
      }, 780);
    }
  }, [selected, cards, placed, round, score, lives, best, feedback, streak, cfg.events, cfg.timePerRound, POINTS_PER, ROUNDS, muted]);

  // touch swipe: swipe left/right on card to quick-select
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = useCallback((e: React.TouchEvent) => { touchStartX.current = e.touches[0]!.clientX; }, []);
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.touches[0]!.clientX - touchStartX.current;
    if (Math.abs(dx) > 52) {
      // find card under finger
      const el = document.elementFromPoint(e.touches[0]!.clientX, e.touches[0]!.clientY)?.closest<HTMLElement>("[data-card-id]");
      if (el?.dataset.cardId) pickCard(el.dataset.cardId);
      touchStartX.current = null;
    }
  }, [pickCard]);
  const onTouchEnd = useCallback(() => { touchStartX.current = null; }, []);

  // keyboard
  useEffect(() => {
    if (state !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Enter" || e.code === "Space") { e.preventDefault(); placeCard(); return; }
      if (e.key.toLowerCase() === "h") { e.preventDefault(); useHint(); return; }
      const num = parseInt(e.key);
      if (num >= 1 && num <= cards.length) {
        const remaining = cards.filter(c => !placed.find(p => p.id === c.id));
        if (remaining[num - 1]) pickCard(remaining[num - 1]!.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, cards, placed, placeCard, pickCard, useHint]);

  // GSAP entrance
  useEffect(() => {
    const root: HTMLElement | null = document.querySelector<HTMLElement>("[data-gsap-root]") || (document.body as unknown as HTMLElement);
    if (!root) return;
    if (prefersReducedMotion()) {
      const els = root.querySelectorAll<HTMLElement>(".card, [data-card]");
      if (els.length) gsap.set(els, { y: 0, opacity: 1, clearProps: "transform" });
      return;
    }
    const ctx = gsap.context(() => {
      const cs = root.querySelectorAll<HTMLElement>(".card, [data-card], .tile, .cell");
      if (cs.length) {
        gsap.set(cs, { y: 24, opacity: 0 });
        ScrollTrigger.batch(cs, {
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

  const remaining = cards.filter(c => !placed.find(p => p.id === c.id));
  const progressPct = cfg.events ? (placed.length / cfg.events) * 100 : 0;
  const shareText = `Хронология 2026 — ${score} pts, раунд ${round + 1}/${ROUNDS} — MAGNUM 5opka`;
  const randomFact = LORE_FACTS[score % LORE_FACTS.length] ?? LORE_FACTS[0]!;

  return (
    <div className={styles.page}>
      {showConfetti && <canvas ref={confettiRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 50 }} width={800} height={600} />}
      <h1>ХРОНОЛОГИЯ 2026</h1>
      <p className={styles.sub}>Расставь события MAGNUM по порядку — от ранних к поздним</p>

      {state === "menu" && (
        <div className={styles.menu}>
          <div className={styles.rules}>
            <p>📅 Тебе показывают события 2026 в случайном порядке — выбери карточку и поставь в хронологию</p>
            <p>✅ Правильный порядок = +{POINTS_PER} очков (+ бонус за стрик)</p>
            <p>❌ Ошибка = −1 жизнь • <b>Подсказка H</b> подсвечивает верную карточку (3 за раунд)</p>
            <p>🏆 {ROUNDS} раундов × {cfg.events} событий = победа • Таймер {cfg.timePerRound}с на раунд</p>
            <p>💡 Подсказка: пресейв был 1 января, винил — в декабре</p>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 14 }}>
            {(Object.keys(DIFFICULTY_CFG) as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                onMouseEnter={(e) => hoverIn(e.currentTarget)}
                onMouseLeave={(e) => hoverOut(e.currentTarget)}
                style={{
                  padding: "8px 14px", borderRadius: 10, border: difficulty === d ? "1.5px solid #ff2d55" : "1px solid rgba(255,255,255,0.12)",
                  background: difficulty === d ? "rgba(255,45,85,0.15)" : "rgba(255,255,255,0.05)", color: "#fff", fontWeight: 800, cursor: "pointer",
                }}
              >
                {DIFFICULTY_CFG[d].label} · {DIFFICULTY_CFG[d].events} карт · {DIFFICULTY_CFG[d].lives}❤️
              </button>
            ))}
            <button
              onClick={() => setMuted((m) => !m)}
              style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: muted ? "rgba(255,255,255,0.45)" : "#fff", cursor: "pointer" }}
              title="Звук"
            >
              {muted ? "🔇" : "🔊"}
            </button>
          </div>
          <button className={styles.playBtn} onClick={startGame}>Начать!</button>
          <p className={styles.hint}>Рекорд: {best} pts • Клавиши 1–{cfg.events} + Enter • Свайп по карточке • H — подсказка</p>
          <Link to="/magnum/games" className={styles.back}>← К играм</Link>
        </div>
      )}

      {state === "playing" && (
        <div className={styles.gameArea} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <div className={styles.hud}>
            <div className={styles.stat}><span>Раунд</span><strong>{round + 1} / {ROUNDS}</strong></div>
            <div className={styles.stat}><span>Очки</span><strong>{score}</strong></div>
            <div className={styles.stat}><span>Жизни</span><strong>{"❤️".repeat(lives)}{"🤍".repeat(cfg.lives - lives)}</strong></div>
            <div className={styles.stat}><span>Время</span><strong style={{ color: timeLeft < 15 ? "#ff2d55" : undefined }}>{timeLeft}с</strong></div>
            <div className={styles.stat}><span>Сложность</span><strong style={{ fontSize: "0.85rem" }}>{cfg.label}</strong></div>
          </div>
          <div className={styles.progress}><div className={styles.fill} style={{ width: `${progressPct}%` }} /></div>
          {streak >= 2 && (
            <div ref={streakRef} style={{ alignSelf: "center", background: streak >= 4 ? "linear-gradient(90deg,#ff2d55,#ffcc00)" : "rgba(0,255,136,0.12)", color: streak >= 4 ? "#fff" : "#00ff88", border: streak >= 4 ? "1px solid rgba(255,204,0,0.5)" : "1px solid rgba(0,255,136,0.3)", padding: "5px 12px", borderRadius: 999, fontWeight: 900, fontSize: "0.82rem" }}>
              🔥 СТРИК ×{streak} {streak >= 4 ? "— ОГОНЬ!" : streak >= 3 ? "— ЖАРА!" : ""} +{streak * 40} бонус
            </div>
          )}

          {placed.length > 0 && (
            <div className={styles.timeline} ref={placedRef}>
              {placed.map((ev, i) => (
                <div key={ev.id} className={styles.timelineCard}>
                  <span className={styles.timelineIdx}>{i + 1}</span>
                  <span className={styles.timelineEmoji}>{ev.emoji}</span>
                  <span className={styles.timelineTitle}>{ev.title}</span>
                  <span className={styles.timelineDate}>{ev.date}</span>
                </div>
              ))}
            </div>
          )}

          <div className={styles.cardList} ref={listRef}>
            {remaining.map((ev, i) => (
              <button
                key={ev.id}
                data-card-id={ev.id}
                className={`${styles.card} ${selected === ev.id ? styles.selected : ""}`}
                onClick={() => pickCard(ev.id)}
                onMouseEnter={() => { if (!muted) playHover(); }}
                style={hintReveal === ev.id ? { borderColor: "#ffcc00", boxShadow: "0 0 18px rgba(255,204,0,0.35)" } : undefined}
              >
                <span className={styles.cardIdx}>{i + 1}</span>
                <span className={styles.cardEmoji}>{ev.emoji}</span>
                <div className={styles.cardInfo}>
                  <strong>{ev.title} <span style={{ fontWeight: 400, opacity: 0.55, fontSize: "0.8em" }}>— {ev.date}</span></strong>
                  <p>{ev.detail}</p>
                  {hintReveal === ev.id && <span style={{ color: "#ffcc00", fontSize: "0.75rem", fontWeight: 700 }}>💡 {ev.yearHint}</span>}
                </div>
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <button
              className={`${styles.placeBtn} ${!selected ? styles.placeBtnDisabled : ""} ${feedback === "ok" ? styles.placeBtnOk : ""} ${feedback === "bad" ? styles.placeBtnBad : ""}`}
              onClick={placeCard}
              disabled={!selected || !!feedback}
            >
              {feedback === "ok" ? "✅ Верно!" : feedback === "bad" ? "❌ Не тот порядок!" : selected ? "Поставить в хронологию →" : "Выбери карточку"}
            </button>
            <button className={styles.restartBtn} onClick={useHint} disabled={hints <= 0 || !!hintReveal} style={{ opacity: hints <= 0 ? 0.45 : 1 }}>
              💡 {hints > 0 ? `${hints} подсказок` : "нет подсказок"}
            </button>
          </div>

          <div className={styles.navRow}>
            <button className={styles.restartBtn} onClick={startGame}>Заново</button>
            <button className={styles.restartBtn} onClick={() => setMuted((m) => !m)}>{muted ? "🔇 Вкл звук" : "🔊 Мьют"}</button>
            <Link to="/magnum/games" className={styles.backInline}>← К играм</Link>
          </div>
          <p className={styles.hint} style={{ textAlign: "center", opacity: 0.45 }}>Свайп по карточке — быстрый выбор • H — подсказка • Enter — поставить</p>
        </div>
      )}

      {state === "win" && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2>🏆 Хронолог — ты!</h2>
            <p>{score} очков • {ROUNDS} раундов • {difficulty} • рекорд {Math.max(best, score)}</p>
            <p className={styles.winSub}>Ты знаешь хронологию MAGNUM 2026 лучше всех!</p>
            <p style={{ fontSize: "0.82rem", opacity: 0.65, marginBottom: 12 }}>💡 {randomFact}</p>
            <a href={PRESAVE} target="_blank" rel="noreferrer" className={styles.presaveBtn}>Пресейв MAGNUM →</a>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <button className={styles.restartBtn} onClick={startGame}>Ещё раз</button>
              <button className={styles.restartBtn} onClick={() => { if (navigator.share) void navigator.share({ title: "MAGNUM Хронология", text: shareText, url: PRESAVE }); else void navigator.clipboard.writeText(shareText); }}>Поделиться</button>
            </div>
          </div>
        </div>
      )}

      {state === "fail" && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2>💥 Жизни кончились!</h2>
            <p>{score} очков • раунд {round + 1} • рекорд {best}</p>
            <p className={styles.failHint}>Правильный порядок: {EVENTS.slice(0, cfg.events).sort((a, b) => a.sortKey - b.sortKey).map((e) => e.title).join(" → ")}</p>
            <p style={{ fontSize: "0.82rem", opacity: 0.55, marginTop: 8 }}>💡 {randomFact}</p>
            <button className={styles.playBtn} onClick={startGame}>Ещё попытка</button>
            <div style={{ marginTop: 10 }}><Link to="/magnum/games" className={styles.backInline}>← К играм</Link></div>
          </div>
        </div>
      )}
    </div>
  );
}
