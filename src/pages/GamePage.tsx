import { useState, useRef, useEffect, useCallback } from "react";
import gsap from "gsap";
import styles from "./GamePage.module.css";

const PRESAVE_URL = "https://music.thefence.me/psmagnum";

interface Question {
  q: string;
  options: string[];
  correct: number;
  fact: string;
  difficulty: 1 | 2 | 3;
}

const QUESTIONS: Question[] = [
  {
    q: "Что означает число 42?",
    options: ["Ответ на главный вопрос жизни", "Код региона Кемеровской области", "Количество треков в альбоме", "День рождения Пятерки"],
    correct: 0,
    fact: "Из «Автостопом по Галактике» — суперкомпьютер назвал 42 ответом на всё.",
    difficulty: 1,
  },
  {
    q: "Как расшифровывается CLAY?",
    options: ["Cool Life And Youth", "Clowns Laugh At You", "Create Love Always Yours", "Club Level All Year"],
    correct: 1,
    fact: "Пасхалка, которую Кирилл прятал в конце видео 10 лет.",
    difficulty: 1,
  },
  {
    q: "Сколько баллов получил трек XXL на РЗТ?",
    options: ["73", "80", "86", "92"],
    correct: 2,
    fact: "Один из самых высокооценённых треков в истории РЗТ.",
    difficulty: 2,
  },
  {
    q: "Какой жест символизирует 42?",
    options: ["Кулак с двумя пальцами", "4 пальца на одной руке + 2 на другой", "V-знак дважды", "Палец вверх"],
    correct: 1,
    fact: "4 + 2 = 42. Просто и понятно.",
    difficulty: 1,
  },
  {
    q: "Как зовут MellSher?",
    options: ["Игорь Шерстюк", "Игорь Меллшер", "Кирилл Баранов", "Игорь Солодков"],
    correct: 0,
    fact: "Игорь Николаевич Шерстюк — полное имя.",
    difficulty: 1,
  },
  {
    q: "Какой первый сквад 42 братух?",
    options: ["НАХ-сквад (Москва)", "Шуба-сквад (Петербург)", "Хай-сквад (Воронеж)", "Урод-сквад (Ростов)"],
    correct: 1,
    fact: "Первый сквад появился в Петербурге в 2024 году.",
    difficulty: 1,
  },
  {
    q: "Сколько треков в SUPER PUPER NOVA?",
    options: ["3", "4", "5", "7"],
    correct: 2,
    fact: "5 треков: Танцуй, Тонированный жигуль, Кис-кис, XXL, Репит.",
    difficulty: 1,
  },
  {
    q: "Кто посвящён в «братухи 42» 24 февраля 2025?",
    options: ["Эльдар Джарахов", "Дмитрий Маликов", "Стинт", "Вова Солодков"],
    correct: 1,
    fact: "Дмитрий Маликов — певец, неожиданный союзник движения.",
    difficulty: 2,
  },
  // --- новые 12 вопросов (расширение до 20) ---
  {
    q: "Какой альбом MAGNUM выходит в 2026?",
    options: ["MAGNUM", "42 FOREVER", "SHUBA PARTY", "CLAY LEGACY"],
    correct: 0,
    fact: "Дебютный полноформатный альбом Кирилла — MAGNUM, релиз в 2026.",
    difficulty: 1,
  },
  {
    q: "Какой трек открыл эру MAGNUM 31 декабря 2024?",
    options: ["Эйфория", "Отключи", "Танцуй", "Веном Бой"],
    correct: 1,
    fact: "«Отключи» — первый сингл MAGNUM, дроп 31.12.2024.",
    difficulty: 2,
  },
  {
    q: "Где Кирилл учился до отчисления?",
    options: ["МГУ", "Школа 65, Кемерово", "Лицей 42, Москва", "Гимназия 12, Краснодар"],
    correct: 1,
    fact: "Школа 65 в Кемерово — оттуда отчислили, началась история.",
    difficulty: 2,
  },
  {
    q: "Сколько см рост у 5opka?",
    options: ["170", "174", "183", "188"],
    correct: 2,
    fact: "183 см — Кирилл среднего роста, но энергия на 2 метра.",
    difficulty: 1,
  },
  {
    q: "Какая команда выиграла Лигу Кубизма?",
    options: ["Шуба-сквад", "Лига Кубизма 597→1M", "Урод-сквад", "NAH-сквад"],
    correct: 1,
    fact: "Лига Кубизма собрала 597→1M и взяла кубок.",
    difficulty: 3,
  },
  {
    q: "Когда вышел Venom Boy?",
    options: ["12.01.2026", "28.02.2026", "14.03.2026", "01.04.2026"],
    correct: 1,
    fact: "Venom Boy — 28.02.2026, дата вписана в лор.",
    difficulty: 3,
  },
  {
    q: "Что такое SubShield у MellSher?",
    options: ["Щит от страйков", "Система защиты сабов", "Мод для Twitch", "Анти-бот"],
    correct: 1,
    fact: "SubShield — фирменная защита сабов/подписок.",
    difficulty: 2,
  },
  {
    q: "Сколько метров Красная Горка?",
    options: ["5м", "8м", "12м", "20м"],
    correct: 2,
    fact: "Красная Горка — 12 метров культовой высоты.",
    difficulty: 2,
  },
  {
    q: "Какой жанр у «Танцуй»?",
    options: ["Дрилл", "Данс-поп / хайперпоп", "Лоуфай", "Фонк"],
    correct: 1,
    fact: "«Танцуй» — танцевальный дроп в стиле данс-поп.",
    difficulty: 1,
  },
  {
    q: "Сколько участников в 42 братухах на старте?",
    options: ["12", "24", "42", "100"],
    correct: 2,
    fact: "42 — сакральное число, с него начался движ.",
    difficulty: 1,
  },
  {
    q: "Что даёт VIP-обводка в MAGNUM Store?",
    options: ["+10% монет", "Сияющая рамка + рейтинг", "Скидка 50%", "Доступ к демо"],
    correct: 1,
    fact: "VIP/VIP+/PRO — сияющие обводки и буст рейтинга.",
    difficulty: 2,
  },
  {
    q: "Какой чип отвечает за звук в WebAudio квизе?",
    options: ["OscillatorNode", "VideoNode", "CanvasNode", "FetchNode"],
    correct: 0,
    fact: "OscillatorNode — сердце синтеза WebAudio.",
    difficulty: 3,
  },
];

// ——— WebAudio harness (no samples, pure synthesis) ———
let actx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!actx) actx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  if (actx.state === "suspended") actx.resume().catch(() => {});
  return actx;
}
function tone(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.22, slideTo?: number) {
  const ctx = getCtx(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur * 0.7);
  g.gain.value = gain;
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g).connect(ctx.destination);
  o.start(); o.stop(ctx.currentTime + dur);
}
function sfxCorrect() { tone(880, 0.22, "sine", 0.25); setTimeout(() => tone(1320, 0.35, "sine", 0.18), 90); }
function sfxWrong() { tone(180, 0.35, "sawtooth", 0.18, 90); }
function sfxClick() { tone(600, 0.08, "square", 0.08); }
function sfxTick() { tone(1200, 0.06, "sine", 0.06); }
function sfxFanfare() {
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.4, "triangle", 0.2), i * 110));
  setTimeout(() => [784, 880, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.5, "sine", 0.18), i * 90)), 500);
}
function sfxCombo(n: number) { tone(440 + n * 90, 0.3, "sine", 0.16, 660 + n * 120); }

const DIFFICULTY_LABEL: Record<number, string> = { 1: "ИЗИ", 2: "МЕДИУМ", 3: "ХАРД" };
const TIME_BY_DIFF: Record<number, number> = { 1: 15, 2: 12, 3: 9 };

// ——— ранги и награды (контент-массив 15 строк) ———
const RANKS = [
  { min: 20, title: "Бог 42 👑", color: "#ffcc00", reward: 420, desc: "Абсолют. Ты — легенда движения." },
  { min: 18, title: "Шуба-лорд 🧥", color: "#ff2d55", reward: 300, desc: "Почти идеал, один шаг до трона." },
  { min: 15, title: "Братуха PRO 🔥", color: "#ff6b35", reward: 200, desc: "Крепкий хардкор, уважение чата." },
  { min: 10, title: "Кент 42 🤝", color: "#00ff88", reward: 100, desc: "База есть, подтяни лор." },
  { min: 5, title: "Новичок 🌱", color: "#7b61ff", reward: 50, desc: "Старт положен — читай вики!" },
  { min: 0, title: "Мимо кассы 💤", color: "#888", reward: 10, desc: "Бывает. Перепройди и стань братухой." },
] as const;
function getRank(score: number) { return RANKS.find((r) => score >= r.min)!; }
function shareText(score: number, bestStreak: number) {
  const r = getRank(score);
  return `Квиз 42 — ${score}/20 · ${r.title} · стрик ${bestStreak} 🔥 Проверь себя на oooyuki.zomb.top/magnum/games/quiz #MAGNUM #42`;
}

// GSAP пресеты для переиспользования
const GSAP_PRESETS = {
  cardIn: { scale: 0.96, y: 12, opacity: 0 },
  cardOut: { scale: 1, y: 0, opacity: 1, duration: 0.35, ease: "back.out(1.4)" },
  shake: { x: -6, duration: 0.08, yoyo: true, repeat: 3, ease: "power2.inOut" },
  glowCorrect: { boxShadow: "0 0 20px rgba(0,255,136,0.5), 0 0 40px rgba(0,255,136,0.2)", duration: 0.4 },
  glowStreak: { boxShadow: "0 0 24px rgba(255,204,0,0.5), 0 0 48px rgba(255,204,0,0.18)", duration: 0.5 },
} as const;

export function GamePage() {
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showFact, setShowFact] = useState(false);
  const [finished, setFinished] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_BY_DIFF[QUESTIONS[0]!.difficulty]!);
  const [hints, setHints] = useState(2);
  const [eliminated, setEliminated] = useState<number[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const resultCtxRef = useRef<gsap.Context | null>(null);
  const confettiRef = useRef<HTMLDivElement>(null);

  const q = QUESTIONS[current]!;

  // timer
  useEffect(() => {
    if (finished || showFact) return;
    if (timeLeft <= 0) {
      // auto-fail on timeout
      sfxWrong();
      setSelected(-1);
      setShowFact(true);
      setStreak(0);
      if (cardRef.current) gsap.to(cardRef.current, { x: -8, duration: 0.07, yoyo: true, repeat: 5, ease: "power2.inOut" });
      return;
    }
    if (timeLeft <= 3) sfxTick();
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, finished, showFact]);

  // reset timer on new question
  useEffect(() => {
    setTimeLeft(TIME_BY_DIFF[q.difficulty]!);
    setEliminated([]);
  }, [current, q.difficulty]);

  useEffect(() => {
    if (!containerRef.current) return;
    gsap.from(`.${styles.hero} > *`, { y: 30, opacity: 0, stagger: 0.1, duration: 0.8 });
  }, []);

  useEffect(() => {
    if (!optionsRef.current || finished) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;
    const buttons = optionsRef.current.querySelectorAll(`.${styles.option}`);
    gsap.set(buttons, { x: -16, opacity: 0 });
    gsap.to(buttons, { x: 0, opacity: 1, stagger: 0.06, duration: 0.35, ease: "power2.out", delay: 0.08 });
  }, [current, finished]);

  // progress bar GSAP width
  useEffect(() => {
    const fill = containerRef.current?.querySelector(`.${styles.progressFill}`) as HTMLElement | null;
    if (!fill) return;
    const pct = ((current + (showFact ? 1 : 0)) / QUESTIONS.length) * 100;
    gsap.to(fill, { width: `${pct}%`, duration: 0.5, ease: "power2.out", overwrite: true });
  }, [current, showFact]);

  // result + confetti
  useEffect(() => {
    if (!finished || !resultRef.current) return;
    resultCtxRef.current?.revert();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const perfect = score === QUESTIONS.length;
    if (perfect) sfxFanfare();
    const ctx = gsap.context(() => {
      const card = resultRef.current?.querySelector(`.${styles.resultCard}`);
      if (!card) return;
      gsap.set(card, { scale: 0.85, y: 30, opacity: 0 });
      gsap.to(card, { scale: 1, y: 0, opacity: 1, duration: 0.6, ease: "back.out(1.6)" });
      if (!reducedMotion) {
        gsap.to(card, { boxShadow: "0 0 32px rgba(255,45,85,0.3), 0 0 64px rgba(255,45,85,0.1)", duration: 1.8, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 0.7 });
      }
      const children = (card as HTMLElement).children;
      gsap.set(children, { y: 16, opacity: 0 });
      gsap.to(children, { y: 0, opacity: 1, stagger: 0.1, duration: 0.5, ease: "power2.out", delay: 0.2 });
      // confetti burst
      if (perfect && confettiRef.current && !reducedMotion) {
        const c = confettiRef.current;
        c.innerHTML = "";
        for (let i = 0; i < 28; i++) {
          const d = document.createElement("div");
          d.style.cssText = `position:absolute;left:50%;top:18%;width:10px;height:10px;border-radius:2px;background:${["#ff2d55","#00ff88","#ffcc00","#7b61ff","#00d4ff"][i % 5]};`;
          c.appendChild(d);
          gsap.set(d, { x: 0, y: 0, rotation: Math.random() * 360, scale: 0 });
          gsap.to(d, { x: (Math.random() - 0.5) * 520, y: 320 + Math.random() * 260, rotation: Math.random() * 720 - 360, scale: 1, duration: 1.1 + Math.random() * 0.6, delay: Math.random() * 0.25, ease: "power2.out" });
          gsap.to(d, { opacity: 0, duration: 0.4, delay: 1.2 + Math.random() * 0.3 });
        }
      }
    }, resultRef);
    resultCtxRef.current = ctx;
    return () => ctx.revert();
  }, [finished, score]);

  // keyboard 1-4 + Enter/Space
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished) { if (e.key === "Enter" || e.key === " ") handleRestart(); return; }
      if (showFact) { if (e.key === "Enter" || e.key === " ") handleNext(); return; }
      const n = Number(e.key);
      if (n >= 1 && n <= 4) { const idx = n - 1; if (!eliminated.includes(idx)) handleSelect(idx); }
      if (e.key === "h" || e.key === "H") handleHint();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // swipe for next after fact (mobile)
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = useCallback((e: React.TouchEvent) => { touchStartX.current = e.touches[0]!.clientX; }, []);
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current == null || !showFact) return;
    const dx = e.changedTouches[0]!.clientX - touchStartX.current;
    touchStartX.current = null;
    if (dx < -50) handleNext();
  }, [showFact]);

  const handleHint = () => {
    if (hints <= 0 || selected !== null || showFact) return;
    sfxClick();
    setHints((h) => h - 1);
    // eliminate one wrong answer
    const wrong = q.options.map((_, i) => i).filter((i) => i !== q.correct && !eliminated.includes(i));
    if (wrong.length > 0) {
      const pick = wrong[Math.floor(Math.random() * wrong.length)]!;
      setEliminated((e) => [...e, pick]);
      // GSAP fade out eliminated
      requestAnimationFrame(() => {
        const btns = optionsRef.current?.querySelectorAll(`.${styles.option}`);
        const el = btns?.[pick] as HTMLElement | undefined;
        if (el) gsap.to(el, { opacity: 0.28, scale: 0.96, duration: 0.3, ease: "power2.out" });
      });
    }
  };

  const handleSelect = (idx: number) => {
    if (selected !== null) return;
    if (eliminated.includes(idx)) return;
    sfxClick();
    setSelected(idx);
    const isCorrect = idx === q.correct;
    if (isCorrect) {
      sfxCorrect();
      setScore((s) => s + 1);
      const ns = streak + 1;
      setStreak(ns);
      setBestStreak((b) => Math.max(b, ns));
      if (ns >= 2) sfxCombo(Math.min(ns, 6));
    } else {
      sfxWrong();
      setStreak(0);
    }
    setShowFact(true);
    if (optionsRef.current) {
      const buttons = optionsRef.current.querySelectorAll(`.${styles.option}`);
      const btn = buttons[idx] as HTMLElement | undefined;
      if (btn) {
        gsap.to(btn, { scale: 1.04, duration: 0.15, yoyo: true, repeat: 1, ease: "power2.out" });
        if (isCorrect) gsap.to(btn, { boxShadow: "0 0 20px rgba(0,255,136,0.5), 0 0 40px rgba(0,255,136,0.2)", duration: 0.4, ease: "power2.out" });
        else gsap.to(btn, { x: -6, duration: 0.08, yoyo: true, repeat: 3, ease: "power2.inOut" });
      }
    }
    if (cardRef.current) gsap.from(cardRef.current, { scale: 0.95, duration: 0.3, ease: "back.out(1.7)" });
  };

  const handleNext = () => {
    sfxClick();
    if (current < QUESTIONS.length - 1) {
      setCurrent((c) => c + 1);
      setSelected(null);
      setShowFact(false);
    } else {
      setFinished(true);
    }
  };

  const handleRestart = () => {
    sfxClick();
    setCurrent(0); setScore(0); setSelected(null); setShowFact(false); setFinished(false);
    setStreak(0); setBestStreak(0); setHints(2); setEliminated([]);
    setTimeLeft(TIME_BY_DIFF[QUESTIONS[0]!.difficulty]!);
  };

  const handleCopy = async () => {
    const t = shareText(score, bestStreak);
    try { await navigator.clipboard.writeText(t); sfxCorrect(); } catch { sfxWrong(); }
  };

  const rank = finished ? getRank(score) : null;
  const progress = ((current + (showFact ? 1 : 0)) / QUESTIONS.length) * 100;
  const timePct = (timeLeft / TIME_BY_DIFF[q.difficulty]!) * 100;

  return (
    <div className={styles.page} ref={containerRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className={styles.hero}>
        <div className={styles.badge}>Мини-игра · ⌨️ 1-4 · H-подсказка · свайп → далее</div>
        <h1>Квиз 42</h1>
        <p className={styles.subtitle}>20 вопросов про 42, MAGNUM и лор. Таймер, стрик, подсказки — проверь, братуха ли ты.</p>
      </div>

      {!finished ? (
        <div className={styles.gameArea}>
          <div className={styles.progressBar}><div className={styles.progressFill} style={{ width: `${progress}%` }} /></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap" }}>
            <div className={styles.questionNum}>Вопрос {current + 1} / {QUESTIONS.length} · <span style={{ color: q.difficulty === 3 ? "#ff2d55" : q.difficulty === 2 ? "#ffcc00" : "#00ff88" }}>{DIFFICULTY_LABEL[q.difficulty]}</span> · ⏱ {timeLeft}с</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, opacity: 0.7 }}>🔥 {streak} · best {bestStreak}</span>
              <button onClick={handleHint} disabled={hints <= 0 || selected !== null} title="H — убрать один неверный" style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.15)", background: hints > 0 && selected === null ? "rgba(255,204,0,0.15)" : "rgba(255,255,255,0.06)", color: "#fff", cursor: hints > 0 && selected === null ? "pointer" : "not-allowed", opacity: hints > 0 && selected === null ? 1 : 0.5 }}>💡 {hints}</button>
            </div>
          </div>
          {/* timer bar */}
          <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden", marginBottom: 14 }}>
            <div style={{ height: "100%", width: `${timePct}%`, background: timeLeft <= 3 ? "#ff2d55" : timeLeft <= 6 ? "#ffcc00" : "#00ff88", transition: "width 0.9s linear, background 0.3s" }} />
          </div>

          <div className={styles.card} ref={cardRef}>
            <h2 className={styles.question}>{q.q}</h2>
            <div className={styles.options} ref={optionsRef}>
              {q.options.map((opt, idx) => (
                <button key={opt} className={`${styles.option} ${selected !== null ? (idx === q.correct ? styles.correct : idx === selected ? styles.wrong : "") : ""}`} onClick={() => handleSelect(idx)} disabled={selected !== null || eliminated.includes(idx)} style={eliminated.includes(idx) ? { opacity: 0.32, pointerEvents: "none" } : undefined}>
                  <span style={{ opacity: 0.5, marginRight: 8, fontSize: 12 }}>{idx + 1}</span>{opt}
                </button>
              ))}
            </div>

            {showFact && (
              <div className={styles.fact}>
                <p>{q.fact}{streak >= 3 ? ` · 🔥 Стрик ${streak}!` : ""}</p>
                <button className={styles.nextBtn} onClick={handleNext}>{current < QUESTIONS.length - 1 ? "Следующий вопрос →" : "Показать результат →"}</button>
                <div style={{ fontSize: 11, opacity: 0.45, marginTop: 8, textAlign: "center" }}>свайп влево или Enter — далее</div>
              </div>
            )}
          </div>

          <div className={styles.score}>Счёт: <strong>{score}</strong> · осталось {QUESTIONS.length - current - (showFact ? 1 : 0)}</div>
        </div>
      ) : (
        <div className={styles.result} ref={resultRef} style={{ position: "relative" }}>
          <div ref={confettiRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }} />
          <div className={styles.resultCard}>
            <div className={styles.resultScore} style={rank ? { color: rank.color, textShadow: `0 0 18px ${rank.color}66` } : undefined}>{score}/{QUESTIONS.length}</div>
            <div style={{ fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", color: rank?.color, marginBottom: 6 }}>{rank?.title} · +{rank?.reward} монет</div>
            <h2>{score === QUESTIONS.length ? "Ты настоящий братуха! 🎉" : score >= 15 ? "Легенда 42! 🔥" : score >= 10 ? "Неплохо, но можно лучше! 💪" : "Попробуй ещё раз! 🔄"}</h2>
            <p className={styles.resultText}>{rank?.desc} {score === QUESTIONS.length ? "Идеально! 20/20 — фанфары и конфетти твои." : `Best стрик: ${bestStreak} · Набери 20/20 для фанфар.`}</p>
            {/* rank ladder */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, margin: "14px 0 6px", textAlign: "left" }}>
              {RANKS.slice(0, 6).map((r) => (
                <div key={r.min} style={{ padding: "6px 8px", borderRadius: 10, background: score >= r.min ? `${r.color}18` : "rgba(255,255,255,0.04)", border: `1px solid ${score >= r.min ? r.color + "55" : "rgba(255,255,255,0.06)"}`, opacity: score >= r.min ? 1 : 0.55, fontSize: 11 }}>
                  <span style={{ color: r.color, fontWeight: 800 }}>{r.title}</span> <span style={{ opacity: 0.7 }}>· {r.min}+</span>
                </div>
              ))}
            </div>
            <div className={styles.resultActions}>
              <a href={PRESAVE_URL} target="_blank" className={styles.presaveBtn}>Пресейв MAGNUM →</a>
              <button className={styles.restartBtn} onClick={handleRestart}>Попробовать ещё раз</button>
              <button className={styles.restartBtn} onClick={handleCopy} style={{ borderStyle: "dashed" }}>Копировать результат 📋</button>
            </div>
            <div style={{ fontSize: 11, opacity: 0.4, marginTop: 8 }}>GSAP: {Object.keys(GSAP_PRESETS).join(" · ")} · WebAudio: OscillatorNode · свайп/клавиатура</div>
          </div>
        </div>
      )}
    </div>
  );
}
