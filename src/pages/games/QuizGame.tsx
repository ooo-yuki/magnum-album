// QuizGame polish 2 — WebAudio (question/correct/wrong/win) + particles + shake + 15s timer + 4200 win → presave
import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./QuizGame.module.css";
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

const PRESAVE = "https://music.thefence.me/psmagnum";
const WIN_SCORE = 4200;
const POINTS_PER_CORRECT = 525; // 525*8 = 4200
const TIME_PER_Q = 15;

interface Question {
  q: string;
  options: string[];
  correct: number;
  fact: string;
}

const QUESTIONS: Question[] = [
  { q: "Что означает число 42?", options: ["Ответ на главный вопрос жизни", "Код региона Кемеровской области", "Количество треков в альбоме", "День рождения Пятерки"], correct: 0, fact: "Из «Автостопом по Галактике» — суперкомпьютер назвал 42 ответом на всё." },
  { q: "Как расшифровывается CLAY?", options: ["Cool Life And Youth", "Clowns Laugh At You", "Create Love Always Yours", "Club Level All Year"], correct: 1, fact: "Пасхалка, которую Кирилл прятал в конце видео 10 лет." },
  { q: "Сколько баллов получил трек XXL на РЗТ?", options: ["73", "80", "86", "92"], correct: 2, fact: "Один из самых высокооценённых треков в истории РЗТ." },
  { q: "Какой жест символизирует 42?", options: ["Кулак с двумя пальцами", "4 пальца на одной руке + 2 на другой", "V-знак дважды", "Палец вверх"], correct: 1, fact: "4 + 2 = 42. Просто и понятно." },
  { q: "Как зовут MellSher?", options: ["Игорь Шерстюк", "Игорь Меллшер", "Кирилл Баранов", "Игорь Солодков"], correct: 0, fact: "Игорь Николаевич Шерстюк — полное имя." },
  { q: "Какой первый сквад 42 братух?", options: ["НАХ-сквад (Москва)", "Шуба-сквад (Петербург)", "Хай-сквад (Воронеж)", "Урод-сквад (Ростов)"], correct: 1, fact: "Первый сквад появился в Петербурге в 2024 году." },
  { q: "Сколько треков в SUPER PUPER NOVA?", options: ["3", "4", "5", "7"], correct: 2, fact: "5 треков: Танцуй, Тонированный жигуль, Кис-кис, XXL, Репит." },
  { q: "Кто посвящён в «братухи 42» 24 февраля 2025?", options: ["Эльдар Джарахов", "Дмитрий Маликов", "Стинт", "Вова Солодков"], correct: 1, fact: "Дмитрий Маликов — певец, неожиданный союзник движения." },
  // ── новый контент-пакет MAGNUM 2026 (16 вопросов) ──
  { q: "Как назывался дебютный трек 5opka x MellSher?", options: ["Вокруг", "Молодой", "Кис-кис", "XXL"], correct: 0, fact: "«Вокруг» — совместный дроп Кирилла и Игоря, старт истории MAGNUM." },
  { q: "Что означает шифр M4GNUM на обложке?", options: ["MAGNUM с 4 вместо A", "42+MAGNUM", "Год 2024", "4 трека в альбоме"], correct: 0, fact: "Стилизация MAGNUM — буква A заменена на 4, отсылка к 42." },
  { q: "Какой трек MAGNUM — про ночной вайб и неон?", options: ["VPN", "Туса-медуза", "Молодой", "Репит"], correct: 0, fact: "VPN — ночной неоновый гимн, клип с киберпанком." },
  { q: "Сколько монет дают за победу в Квиз 42?", options: ["42", "100", "420", "4200"], correct: 3, fact: "4200 — магическое число, как и в остальных мини-играх." },
  { q: "Какой цвет — главный в палитре MAGNUM?", options: ["#ff2d55 неон-розовый", "#00ff00 лайм", "#0099ff синий", "#ffcc00 золотой"], correct: 0, fact: "Неон-розовый #ff2d55 — акцент всех обложек и сайта." },
  { q: "Кто автор дизайна сайта 5opka.ru/magnum?", options: ["Олег + команда 42", "Tilda шаблон", "MellSher сам", "Нейросеть"], correct: 0, fact: "Дизайн собирала команда 42 — Олег и братухи." },
  { q: "Что такое «пресейв» MAGNUM?", options: ["Сохранить альбом заранее", "Купить мерч", "Подписаться на Twitch", "Задонатить"], correct: 0, fact: "Пресейв — добавить альбом в библиотеку до релиза, бустит чарты." },
  { q: "Какой город — столица 42 братух?", options: ["Петербург", "Москва", "Кемерово 42", "Казань"], correct: 0, fact: "Петербург — там зародился первый Шуба-сквад." },
  { q: "Что даёт VIP-статус на сайте?", options: ["Сияющая обводка + бонусы", "Только аватарку", "Ничего", "Бан"], correct: 0, fact: "VIP/VIP+/PRO — сияющая обводка, множители монет и доступ к дропам." },
  { q: "Какой жанр у трека «Туса-медуза»?", options: ["Дэнс-поп / гиперпоп", "Рэп", "Рок", "Джаз"], correct: 0, fact: "Дэнс-поп с гиперпоп-вайбом — летний хит 2025." },
  { q: "Сколько братух на арте «42 Characters»?", options: ["2", "5", "9", "12"], correct: 2, fact: "9 персонажей — вся банда 42 в одном постере." },
  { q: "Что такое «монетки» в экономике MAGNUM?", options: ["Игровая валюта сайта", "Крипта", "Биткоины", "Фантики"], correct: 0, fact: "Монетки фармятся в играх, тратятся в магазине и у нейро-бота." },
  { q: "Какой трек — коллаб 5opka и Молодой Платон?", options: ["На стиле", "XXL", "Кис-кис", "Вокруг"], correct: 0, fact: "«На стиле» — фит с Молодым Платоном, модный бэнгер." },
  { q: "Что означает «42 + 42» в лоре?", options: ["84 — двойной ответ", "Год 4242", "Цена мерча", "Код домофона"], correct: 0, fact: "84 — двойная сила 42, пасхалка для внимательных." },
  { q: "Какой ивент — главный для MAGNUM в 2026?", options: ["Релиз альбома MAGNUM", "Тур по школам", "Стрим 24 часа", "Распродажа"], correct: 0, fact: "Релиз MAGNUM — главное событие, всё ведёт к нему." },
  { q: "Что делает нейро-бот на сайте?", options: ["Отвечает и продаёт за монетки", "Банит", "Играет в шахматы", "Рисует"], correct: 0, fact: "Нейро-бот отвечает на вопросы и торгует подсказками за монетки." },
];

// ── баланс: стрик-бонус и подсказки ──
const STREAK_BONUS = 110; // +110 за каждый верный подряд начиная с 3-го
const HINT_PENALTY = 80; // -80 за подсказку 50/50
const CATEGORY_LABELS: Record<string, string> = {
  "42": "лор 42", MAGNUM: "MAGNUM", eco: "экономика", geo: "гео", fan: "фан",
};

// ---------- WebAudio ----------
let ac: AudioContext | null = null;
function ensureAC(): AudioContext | null {
  if (!ac) {
    try {
      const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      ac = new Ctx();
    } catch { return null; }
  }
  if (ac && ac.state === "suspended") void ac.resume();
  return ac;
}
function safeRamp(param: AudioParam, fn: () => void, fallback: number) {
  try { fn(); } catch { param.value = fallback; }
}
function playTone(freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number) {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = type; o.frequency.value = freq;
  if (slideTo !== undefined) safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(slideTo, ctx.currentTime + dur * 0.7), slideTo);
  g.gain.setValueAtTime(gain, ctx.currentTime);
  safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur), 0.001);
  o.start(); o.stop(ctx.currentTime + dur);
}
function playQuestion() { playTone(520, 0.14, "sine", 0.13, 680); }
function playCorrect() {
  const ctx = ensureAC(); if (!ctx) return;
  [0, 0.11].forEach((d, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.value = i === 0 ? 660 : 880;
    safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(i === 0 ? 760 : 1060, ctx.currentTime + d + 0.09), 1060);
    g.gain.setValueAtTime(0.16, ctx.currentTime + d);
    safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.24), 0.001);
    o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.24);
  });
}
function playWrong() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "square"; o.frequency.value = 190;
  safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(115, ctx.currentTime + 0.22), 115);
  g.gain.setValueAtTime(0.13, ctx.currentTime);
  safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.28);
  const o2 = ctx.createOscillator(), g2 = ctx.createGain();
  o2.connect(g2); g2.connect(ctx.destination);
  o2.type = "square"; o2.frequency.value = 120;
  g2.gain.setValueAtTime(0.09, ctx.currentTime + 0.08);
  safeRamp(g2.gain, () => g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2), 0.001);
  o2.start(ctx.currentTime + 0.08); o2.stop(ctx.currentTime + 0.2);
}
function playWin() {
  const ctx = ensureAC(); if (!ctx) return;
  [0, 0.14, 0.28, 0.42, 0.6].forEach((d, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = i % 2 === 0 ? "sine" : "triangle"; o.frequency.value = 440 + i * 110;
    g.gain.setValueAtTime(0.15, ctx.currentTime + d);
    safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.48), 0.001);
    o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.5);
  });
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sine"; o.frequency.value = 110;
  g.gain.setValueAtTime(0.2, ctx.currentTime);
  safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.75);
}
function playTick() { playTone(900, 0.06, "sine", 0.07, 920); }
function playHint() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination);
  o.type = "triangle"; o.frequency.value = 420; safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(620, ctx.currentTime + 0.12), 620);
  g.gain.setValueAtTime(0.12, ctx.currentTime); safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.18);
  const o2 = ctx.createOscillator(), g2 = ctx.createGain(); o2.connect(g2); g2.connect(ctx.destination);
  o2.type = "sine"; o2.frequency.value = 880; g2.gain.setValueAtTime(0.08, ctx.currentTime + 0.06);
  safeRamp(g2.gain, () => g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18), 0.001);
  o2.start(ctx.currentTime + 0.06); o2.stop(ctx.currentTime + 0.18);
}
function playStreak(n: number) {
  const ctx = ensureAC(); if (!ctx) return;
  const base = 700 + Math.min(n, 5) * 90;
  [0, 0.07].forEach((d, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.value = base + i * 140;
    g.gain.setValueAtTime(0.13, ctx.currentTime + d); safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.2), 0.001);
    o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.2);
  });
}

// ---------- Particles ----------
function Confetti({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!active || !ref.current) return;
    const canvas = ref.current; const ctx = canvas.getContext("2d")!;
    const upd = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    upd();
    const colors = ["#ff2d55", "#ffcc00", "#00ff88", "#5865f2", "#fff"];
    type P = { x: number; y: number; vx: number; vy: number; r: number; c: string; rot: number; vr: number };
    const parts: P[] = Array.from({ length: 180 }, () => ({
      x: Math.random() * canvas.width, y: -20 - Math.random() * 420,
      vx: (Math.random() - 0.5) * 9, vy: 2 + Math.random() * 7,
      r: 5 + Math.random() * 7, c: colors[Math.floor(Math.random() * colors.length)]!, rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.36
    }));
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = 0;
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.09; p.rot += p.vr; p.vx *= 0.992;
        if (p.y < canvas.height + 30) alive++;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - (p.y / canvas.height) * 0.22);
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6); ctx.restore();
      }
      if (alive > 0) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", upd);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", upd); };
  }, [active]);
  if (!active) return null;
  return <canvas ref={ref} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 500 }} />;
}

type Burst = { x: number; y: number; id: number; good: boolean };
function BurstLayer({ bursts, onDone }: { bursts: Burst[]; onDone: (id: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (bursts.length === 0) return;
    const canvas = ref.current!; const ctx = canvas.getContext("2d")!;
    const upd = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    upd(); window.addEventListener("resize", upd);
    type P2 = { x: number; y: number; vx: number; vy: number; r: number; life: number; c: string };
    const all: P2[] = [];
    for (const b of bursts) {
      const col = b.good ? ["#00ff88", "#ffcc00", "#fff"] : ["#ff2d55", "#ff7a00", "#fff"];
      for (let i = 0; i < 18; i++) {
        const ang = (Math.PI * 2 * i) / 18 + Math.random() * 0.35;
        const sp = 2.5 + Math.random() * 7;
        all.push({ x: b.x, y: b.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - Math.random() * 1.8, r: 3 + Math.random() * 4, life: 1, c: col[Math.floor(Math.random() * col.length)]! });
      }
    }
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let any = false;
      for (const p of all) {
        if (p.life <= 0) continue;
        p.x += p.vx; p.y += p.vy; p.vy += 0.26; p.vx *= 0.985; p.life -= 0.022;
        if (p.life > 0) any = true;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (any) raf = requestAnimationFrame(draw);
      else bursts.forEach((b) => onDone(b.id));
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", upd); };
  }, [bursts, onDone]);
  if (bursts.length === 0) return null;
  return <canvas ref={ref} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 200 }} />;
}

export function QuizGame() {
  // рандомная выборка 8 из 24 чтобы реиграбельность
  const [pool] = useState(() => {
    const arr = [...QUESTIONS];
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const tmp = arr[i]!; arr[i] = arr[j]!; arr[j] = tmp; }
    return arr.slice(0, 8);
  });
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showFact, setShowFact] = useState(false);
  const [finished, setFinished] = useState(false);
  const [won, setWon] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_Q);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [scoreBump, setScoreBump] = useState(false);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [eliminated, setEliminated] = useState<number[]>([]);
  const [hintUsed, setHintUsed] = useState(false);
  const [streakFlash, setStreakFlash] = useState(false);
  const [bestScore, setBestScore] = useState(() => { try { return Number(localStorage.getItem("quiz42-best") || 0); } catch { return 0; } });

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const burstIdRef = useRef(0);
  const scoreRef = useRef(0);
  void CATEGORY_LABELS;

  // keep score ref for timer closure
  useEffect(() => { scoreRef.current = score; }, [score]);

  // intro stagger
  useEffect(() => {
    if (!containerRef.current) return;
    gsap.from(`.${styles.hero} > *`, { y: 22, opacity: 0, stagger: 0.12, duration: 0.6, ease: "power2.out" });
  }, []);

  // question entrance + sound
  useEffect(() => {
    if (finished) return;
    playQuestion();
    if (!optionsRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const btns = optionsRef.current.querySelectorAll(`.${styles.option}`);
    gsap.set(btns, { x: -14, opacity: 0 });
    gsap.to(btns, { x: 0, opacity: 1, stagger: 0.12, duration: 0.32, ease: "power2.out", delay: 0.08 });
    if (cardRef.current) gsap.fromTo(cardRef.current, { scale: 0.98, opacity: 0.7 }, { scale: 1, opacity: 1, duration: 0.32, ease: "power2.out" });
  }, [current, finished]);

  // result animation
  useEffect(() => {
    if (!finished || !resultRef.current) return;
    const ctx = gsap.context(() => {
      const card = resultRef.current?.querySelector(`.${styles.resultCard}`);
      if (!card) return;
      gsap.set(card, { scale: 0.88, y: 24, opacity: 0 });
      gsap.to(card, { scale: 1, y: 0, opacity: 1, duration: 0.58, ease: "back.out(1.6)" });
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.to(card, { boxShadow: "0 0 28px rgba(255,45,85,.26), 0 0 64px rgba(88,101,242,.14)", duration: 1.7, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 0.6 });
      }
      const ch = (card as HTMLElement).children;
      gsap.set(ch, { y: 14, opacity: 0 });
      gsap.to(ch, { y: 0, opacity: 1, stagger: 0.09, duration: 0.44, ease: "power2.out", delay: 0.18 });
    }, resultRef);
  
  // GSAP spec: y24 stagger 0.12 ScrollTrigger batch + reduced-motion gate + gsap.context cleanup + hover y:-4 RGB glow
  useEffect(() => {
    const root: HTMLElement | null = document.querySelector<HTMLElement>("[data-gsap-root]") || (document.body as unknown as HTMLElement);
    if (!root) return;
    if (prefersReducedMotion()) {
      const els = root.querySelectorAll<HTMLElement>(".card, [data-card]");
      if (els.length) gsap.set(els, { y: 0, opacity: 1, clearProps: "transform" });
      return;
    }
    const ctx = gsap.context(() => {
      const cards = root.querySelectorAll<HTMLElement>(".card, [data-card], .tile, .cell");
      if (cards.length) {
        gsap.set(cards, { y: 24, opacity: 0 });
        ScrollTrigger.batch(cards, {
          onEnter: (batch) => gsap.to(batch, { y: 0, opacity: 1, stagger: 0.12, duration: 0.55, ease: "power2.out", overwrite: true }),
          start: "top 92%",
          once: true,
        });
      }
      const heroEls = root.querySelectorAll<HTMLElement>(".hero > *, [data-hero] > *");
      if (heroEls.length) {
        gsap.set(heroEls, { y: 24, opacity: 0 });
        gsap.to(heroEls, { y: 0, opacity: 1, stagger: 0.12, duration: 0.55, ease: "power2.out", delay: 0.05, overwrite: true });
      }
    }, root);
    return () => ctx.revert();
  }, []);

  return () => ctx.revert();
  }, [finished]);

  // timer 15s per question
  useEffect(() => {
    if (finished || showFact) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    setTimeLeft(TIME_PER_Q);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // time out -> auto wrong
          if (timerRef.current) window.clearInterval(timerRef.current);
          // defer to avoid setState during render
          setTimeout(() => handleTimeout(), 0);
          return 0;
        }
        if (prev <= 6) playTick();
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, finished, showFact]);

  const triggerBurst = useCallback((el: HTMLElement | null, good: boolean) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const id = ++burstIdRef.current;
    setBursts((prev) => [...prev, { x, y, id, good }]);
  }, []);

  const handleHint = useCallback(() => {
    if (hintUsed || selected !== null || eliminated.length > 0) return;
    const qh = pool[current]!;
    const wrongs = [0, 1, 2, 3].filter((i) => i !== qh.correct);
    // убрать 2 случайных неверных
    const pick = wrongs.sort(() => Math.random() - 0.5).slice(0, 2);
    setEliminated(pick);
    setHintUsed(true);
    playHint();
    try { if (navigator.vibrate) navigator.vibrate(40); } catch {}
    // оверлейный штраф к счёту (не ниже 0)
    setScore((s) => Math.max(0, s - HINT_PENALTY));
    scoreRef.current = Math.max(0, scoreRef.current - HINT_PENALTY);
    if (optionsRef.current) {
      const btns = optionsRef.current.querySelectorAll(`.${styles.option}`);
      pick.forEach((idx) => {
        const b = btns[idx] as HTMLElement | undefined;
        if (b) gsap.to(b, { opacity: 0.28, scale: 0.96, duration: 0.28, ease: "power2.out" });
      });
    }
  }, [hintUsed, selected, eliminated, current, pool]);

  const handleTimeout = useCallback(() => {
    if (selected !== null) return;
    setSelected(-1); // sentinel for timeout: no option selected
    setShowFact(true);
    setStreak(0);
    playWrong();
    try { if (navigator.vibrate) navigator.vibrate([60, 30, 60]); } catch {}
    if (cardRef.current) {
      gsap.to(cardRef.current, { x: 7, duration: 0.06, yoyo: true, repeat: 5, ease: "power1.inOut", onComplete: () => gsap.set(cardRef.current!, { x: 0 }) });
    }
    if (optionsRef.current) {
      const btns = optionsRef.current.querySelectorAll(`.${styles.option}`);
      gsap.to(btns, { x: 3, duration: 0.05, yoyo: true, repeat: 3, ease: "power1.inOut", onComplete: () => gsap.set(btns as unknown as HTMLElement, { x: 0 }) });
    }
  }, [selected]);

  const handleSelect = useCallback((idx: number) => {
    if (selected !== null) return;
    if (eliminated.includes(idx)) return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    setSelected(idx);
    const q = pool[current]!;
    const isCorrect = idx === q.correct;

    if (isCorrect) {
      const curStreak = streak + 1;
      setStreak(curStreak);
      setMaxStreak((m) => Math.max(m, curStreak));
      let add = POINTS_PER_CORRECT;
      if (curStreak >= 3) add += STREAK_BONUS + (curStreak - 3) * 40;
      // бонус за скорость: +1 за каждую оставшуюся секунду сверх 8
      if (timeLeft > 8) add += (timeLeft - 8) * 12;
      const nextScore = scoreRef.current + add;
      setScore(nextScore);
      scoreRef.current = nextScore;
      try { if (navigator.vibrate) navigator.vibrate(20); } catch {}
      if (curStreak >= 3) playStreak(curStreak); else playCorrect();
      setScoreBump(true); setTimeout(() => setScoreBump(false), 320);
      if (curStreak >= 3) { setStreakFlash(true); setTimeout(() => setStreakFlash(false), 500); }
    } else {
      setStreak(0);
      playWrong();
      try { if (navigator.vibrate) navigator.vibrate([40, 30, 40]); } catch {}
    }
    setShowFact(true);

    // anim feedback
    if (optionsRef.current) {
      const btns = optionsRef.current.querySelectorAll(`.${styles.option}`);
      const btn = btns[idx] as HTMLElement | undefined;
      if (btn) {
        gsap.to(btn, { scale: 1.03, duration: 0.12, yoyo: true, repeat: 1, ease: "power2.out" });
        if (isCorrect) {
          gsap.to(btn, { boxShadow: "0 0 18px rgba(0,255,136,.45)", duration: 0.35 });
          triggerBurst(btn, true);
        } else {
          gsap.to(btn, { x: -6, duration: 0.07, yoyo: true, repeat: 3, ease: "power1.inOut", onComplete: () => gsap.set(btn, { x: 0 }) });
          if (cardRef.current) gsap.to(cardRef.current, { x: 6, duration: 0.06, yoyo: true, repeat: 4, ease: "power1.inOut", onComplete: () => gsap.set(cardRef.current!, { x: 0 }) });
          triggerBurst(btn, false);
          // also highlight correct
          const correctBtn = btns[q.correct] as HTMLElement | undefined;
          if (correctBtn) gsap.to(correctBtn, { boxShadow: "0 0 14px rgba(0,255,136,.32)", duration: 0.4 });
        }
      }
    }
  }, [selected, current, pool, eliminated, streak, timeLeft, triggerBurst]);

  const handleNext = useCallback(() => {
    if (current < pool.length - 1) {
      setCurrent((c) => c + 1);
      setSelected(null);
      setShowFact(false);
      setEliminated([]);
      setHintUsed(false);
    } else {
      setFinished(true);
      const finalScore = scoreRef.current;
      const isWon = finalScore >= WIN_SCORE;
      setWon(isWon);
      try {
        const prev = Number(localStorage.getItem("quiz42-best") || 0);
        if (finalScore > prev) { localStorage.setItem("quiz42-best", String(finalScore)); setBestScore(finalScore); }
        localStorage.setItem("quiz42-last", String(finalScore));
      } catch {}
      if (isWon) {
        playWin();
        try { if (navigator.vibrate) navigator.vibrate([30, 40, 30, 60]); } catch {}
        if (containerRef.current) gsap.to(containerRef.current, { x: 6, duration: 0.05, yoyo: true, repeat: 7, ease: "power1.inOut", onComplete: () => gsap.set(containerRef.current!, { x: 0 }) });
      } else {
        try { if (navigator.vibrate) navigator.vibrate(50); } catch {}
      }
    }
  }, [current, pool]);

  const handleRestart = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setCurrent(0); setScore(0); scoreRef.current = 0; setSelected(null); setShowFact(false); setFinished(false); setWon(false); setTimeLeft(TIME_PER_Q); setBursts([]); setScoreBump(false);
    setStreak(0); setMaxStreak(0); setEliminated([]); setHintUsed(false); setStreakFlash(false);
  }, []);

  // клавиатура 1-4, H подсказка, Enter далее, свайп
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleRestart(); } return; }
      if (showFact) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleNext(); } return; }
      if (e.key >= "1" && e.key <= "4") { const idx = Number(e.key) - 1; if (!eliminated.includes(idx)) handleSelect(idx); }
      if (e.key.toLowerCase() === "h") handleHint();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finished, showFact, eliminated, handleSelect, handleHint, handleNext, handleRestart]);

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = useCallback((e: React.TouchEvent) => { const t = e.touches[0]; if (t) touchStart.current = { x: t.clientX, y: t.clientY }; }, []);
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current || !showFact) return;
    const t = e.changedTouches[0]; if (!t) return;
    const dx = t.clientX - touchStart.current.x;
    if (dx < -44) handleNext();
    touchStart.current = null;
  }, [showFact, handleNext]);

  const q = pool[current]!;
  const progress = ((current + 1) / pool.length) * 100;
  const timePct = (timeLeft / TIME_PER_Q) * 100;
  const timerClass = timeLeft <= 5 ? styles.timerDanger : timeLeft <= 8 ? styles.timerWarn : "";

  return (
    <div className={styles.page} ref={containerRef} style={{ position: "relative" }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <Confetti active={won} />
      <BurstLayer bursts={bursts} onDone={(id) => setBursts((prev) => prev.filter((b) => b.id !== id))} />
      <div className={styles.hero}>
        <div className={styles.badge}>🧠 Мини-игра • 24 вопроса в пуле</div>
        <h1>Квиз 42</h1>
        <p className={styles.subtitle}>8 случайных из 24 про 42, MAGNUM и 5opka — {TIME_PER_Q}с на вопрос • стрик ≥3 = +{STREAK_BONUS} • подсказка 50/50 (H) −{HINT_PENALTY} • набери <b style={{ color: "#ffcc00" }}>{WIN_SCORE}</b></p>
        {bestScore > 0 && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.42)", marginTop: 4 }}>Рекорд: <b style={{ color: "#ffcc00" }}>{bestScore}</b> • пул {QUESTIONS.length} вопросов • свайп ← далее</p>}
      </div>

      {!finished ? (
        <div className={styles.gameArea}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress}%`, background: won ? "linear-gradient(90deg,#00ff88,#ffcc00)" : undefined }} />
          </div>
          <div style={{ height: 4, background: "rgba(255,255,255,.06)", borderRadius: 999, overflow: "hidden", marginBottom: 12, border: "1px solid rgba(255,255,255,.05)" }}>
            <div style={{ width: `${timePct}%`, height: "100%", background: timeLeft <= 5 ? "#ff2d55" : timeLeft <= 8 ? "#ffcc00" : "linear-gradient(90deg,#00ff88,#5865f2)", transition: "width .45s linear", boxShadow: timeLeft <= 5 ? "0 0 8px #ff2d55" : undefined }} />
          </div>
          <div className={styles.timerRow}>
            <span>Вопрос {current + 1} / {pool.length}</span>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {streak >= 2 && <span style={{ background: streakFlash ? "#ffcc00" : streak >= 3 ? "rgba(255,204,0,0.18)" : "rgba(255,255,255,0.06)", color: streak >= 3 ? "#ffcc00" : "rgba(255,255,255,0.7)", padding: "3px 9px", borderRadius: 999, fontSize: 12, fontWeight: 800, border: "1px solid rgba(255,204,0,0.22)", transform: streakFlash ? "scale(1.14)" : "scale(1)", transition: "all .18s" }}>🔥 x{streak}</span>}
              <span className={`${styles.timer} ${timerClass}`}>⏱ {String(timeLeft).padStart(2, "0")}с</span>
            </span>
          </div>

          <div className={styles.card} ref={cardRef}>
            <h2 className={styles.question}>{q.q}</h2>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", letterSpacing: "0.06em", textTransform: "uppercase" }}>клавиши 1-4 • H подсказка • Enter далее</span>
              <button onClick={handleHint} disabled={hintUsed || selected !== null} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 999, background: hintUsed ? "rgba(255,255,255,0.05)" : "rgba(255,204,0,0.14)", border: "1px solid rgba(255,204,0,0.22)", color: hintUsed ? "rgba(255,255,255,0.32)" : "#ffcc00", cursor: hintUsed || selected !== null ? "not-allowed" : "pointer", opacity: hintUsed || selected !== null ? 0.5 : 1 }}>💡 50/50 {hintUsed ? "✓" : `−${HINT_PENALTY}`}</button>
            </div>
            <div className={styles.options} ref={optionsRef}>
              {q.options.map((opt, idx) => (
                <button
                  key={opt}
                  className={`${styles.option} ${selected !== null ? (idx === q.correct ? styles.correct : idx === selected ? styles.wrong : "") : ""}`}
                  onClick={() => handleSelect(idx)}
                  disabled={selected !== null || eliminated.includes(idx)}
                  style={eliminated.includes(idx) ? { opacity: 0.28, pointerEvents: "none", filter: "grayscale(0.6)" } : undefined}
                >
                  <span style={{ opacity: 0.5, marginRight: 6, fontSize: 11 }}>{idx + 1}</span>{opt}{eliminated.includes(idx) ? " — скрыто" : ""}
                </button>
              ))}
            </div>
            {showFact && (
              <div className={styles.fact}>
                <p>{selected === -1 ? "⏰ Время вышло! " : ""}{q.fact}{streak >= 3 && selected !== -1 && selected === q.correct ? ` • 🔥 стрик ${streak} +${STREAK_BONUS + (streak - 3) * 40}!` : ""}{timeLeft > 8 && selected === q.correct ? ` +${(timeLeft - 8) * 12} за скорость` : ""}{hintUsed && eliminated.length > 0 ? ` • подсказка −${HINT_PENALTY}` : ""}</p>
                <button className={styles.nextBtn} onClick={handleNext}>
                  {current < pool.length - 1 ? "Следующий вопрос →" : "Показать результат →"}
                </button>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginTop: 6 }}>свайп ← или Enter / Space — далее</p>
              </div>
            )}
          </div>

          <div className={styles.scoreRow}>
            <span
              className={`${styles.scorePill} ${scoreBump ? styles.scorePillWin : ""}`}
              style={{ display: "inline-block", transform: scoreBump ? "scale(1.06)" : "scale(1)", transition: "transform .18s" }}
            >
              Очки: <strong>{score}</strong> / {WIN_SCORE} {maxStreak >= 3 ? <span style={{ color: "#ffcc00", fontSize: 11 }}>• max x{maxStreak}</span> : null}
            </span>
            <span className={styles.scorePill}>Прогресс: <strong>{Math.round(progress)}%</strong></span>
            <span className={styles.scorePill}>{score >= WIN_SCORE ? "🔥 К победе!" : `до победы ${WIN_SCORE - score}`}</span>
          </div>
          <div style={{ textAlign: "center", marginTop: 14 }}>
            <Link to="/magnum/games" className={styles.back}>← К играм</Link>
          </div>
        </div>
      ) : (
        <div className={styles.result} ref={resultRef}>
          <div className={styles.resultCard} style={{ boxShadow: won ? "0 0 32px rgba(0,255,136,.22)" : undefined, borderColor: won ? "rgba(0,255,136,.16)" : undefined }}>
            <div className={styles.resultScore} style={{ background: won ? "linear-gradient(90deg,#00ff88,#ffcc00)" : undefined, WebkitBackgroundClip: won ? "text" as const : undefined, WebkitTextFillColor: won ? "transparent" as const : undefined }}>
              {score} / {WIN_SCORE}
            </div>
            <h2>{won ? "Ты настоящий братуха! 🎉" : score >= WIN_SCORE / 2 ? "Неплохо, но можно лучше! 💪" : "Попробуй ещё раз! 🔄"}</h2>
            <p className={styles.resultText}>
              {won ? `Идеально — ${score} очков из ${WIN_SCORE}! 8/8 верно • стрик x${maxStreak} • Теперь время пресейвить MAGNUM.` : `${score} очков — до победы ${WIN_SCORE} не хватило ${WIN_SCORE - score}. Лучший стрик x${maxStreak} • Отвечай быстрее и без подсказок!`}
            </p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,.32)", letterSpacing: ".06em", textTransform: "uppercase" as const, marginBottom: 4 }}>победа {WIN_SCORE} → пресейв • рекорд {bestScore} • пул {QUESTIONS.length}</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.42)", marginBottom: 12 }}>Подсказок: {hintUsed ? "1 (50/50)" : "0"} • пул рандомизируется каждый рестарт • 24 вопроса</p>
            <div className={styles.resultActions}>
              <a href={PRESAVE} target="_blank" rel="noreferrer" className={styles.presaveBtn}>Пресейв MAGNUM →</a>
              <button className={styles.restartBtn} onClick={handleRestart}>Попробовать ещё раз (случайные 8)</button>
              <Link to="/magnum/games" className={styles.back} style={{ textAlign: "center" }}>← К играм</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}