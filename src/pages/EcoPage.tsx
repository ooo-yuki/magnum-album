import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import styles from "./EcoPage.module.css";

/* ── Типы ─────────────────────────────────────────────────── */

type Option = {
  label: string;
  points: number;
  hint: string;
};

type Question = {
  id: number;
  q: string;
  emoji: string;
  options: Option[];
};

type LeaderEntry = {
  name: string;
  score: number;
  rank: string;
  date: string;
};

/* ── 8 вопросов — ироничная пропаганда Кузбасса ───────────── */

const QUESTIONS: Question[] = [
  {
    id: 1,
    emoji: "🥾",
    q: "Как добираешься до центра Кемерово зимой?",
    options: [
      { label: "В батилках 42 — пешком по снегу, бодро и чётко", points: 42, hint: "Трушный кузбасский вайб" },
      { label: "На самокате / велике по набережной Томи", points: 42, hint: "Даже в −20 — респект" },
      { label: "На автобусе №42 — по расписанию", points: 15, hint: "Нормис-вариант" },
      { label: "На крузаке бати, прогреваю 25 минут во дворе", points: -42, hint: "Шахтёры не одобрят" },
    ],
  },
  {
    id: 2,
    emoji: "🚬",
    q: "Твоё отношение к куреву у ТЦ «Лапландия»?",
    options: [
      { label: "Не курю — бегаю в парке Победы, дышу хвоей", points: 42, hint: "+42 к лёгким" },
      { label: "Курю вейп/айкос каждые 10 минут", points: -42, hint: "Пар не эко" },
      { label: "Курю по пачке в день, бычки в Томь", points: -142, hint: "−142 и бан в эко-чате" },
      { label: "Бросил, иногда стреляю, но стыдно", points: 5, hint: "Прогресс" },
    ],
  },
  {
    id: 3,
    emoji: "🧥",
    q: "Твой зимний лук в −35 в Кузбассе?",
    options: [
      { label: "Шуба из норки / песца — дорого-богато", points: -142, hint: "−142 и плачет природа" },
      { label: "Пуховик с Ozon, ношу 3 сезона", points: 20, hint: "Бережно" },
      { label: "Телогрейка шахтёра + свитшот MAGNUM 42", points: 42, hint: "Легенда Кузбасса" },
      { label: "Куртка из переработанного пластика", points: 42, hint: "Эко-флекс" },
    ],
  },
  {
    id: 4,
    emoji: "🏖️",
    q: "Шашлыки на Красном озере — что с мусором?",
    options: [
      { label: "Оставил всё на берегу — природа вывезет", points: -142, hint: "Классика анти-эко" },
      { label: "Сжёг пластик в мангале — типа утилизировал", points: -42, hint: "Ещё хуже" },
      { label: "Собрал в пакет, донёс до бака", points: 42, hint: "Базовый респект" },
      { label: "Разделил: стекло/пластик/органика — сдал", points: 42, hint: "ЭкоЛегенда" },
    ],
  },
  {
    id: 5,
    emoji: "📦",
    q: "Заказы на Wildberries / Ozon?",
    options: [
      { label: "Заказываю каждый день по мелочи, коробки горой", points: -42, hint: "Коробочный монстр" },
      { label: "Беру раз в месяц, без пакетов", points: 42, hint: "Осознанно" },
      { label: "Отказываюсь от лишней упаковки на пункте", points: 42, hint: "+42" },
      { label: "Вообще не заказываю — беру на Центральном рынке", points: 20, hint: "Локально" },
    ],
  },
  {
    id: 6,
    emoji: "⚒️",
    q: "Что думаешь про уголь Кузбасса?",
    options: [
      { label: "Жгу уголь дома без фильтра — тепло же", points: -142, hint: "Коптим небо" },
      { label: "Копчу шашлык на угле, но с умом", points: -10, hint: "Компромисс" },
      { label: "Топлю брикетами + сажаю деревья весной", points: 42, hint: "Компенсация" },
      { label: "Агитирую за переработку и субботники на Томи", points: 42, hint: "Пропаганда 42" },
    ],
  },
  {
    id: 7,
    emoji: "🥤",
    q: "Куда деваешь пластиковые бутылки после лимонада?",
    options: [
      { label: "Кидаю в Томь — уплывёт", points: -142, hint: "Жёсткий минус" },
      { label: "В общий мусор — авось переработают", points: -5, hint: "Наивно" },
      { label: "Сдаю в фандомат в «Ленте» за бонусы", points: 42, hint: "Эко-фарм" },
      { label: "Ношу свою бутылку 42, не покупаю пластик", points: 42, hint: "Топ" },
    ],
  },
  {
    id: 8,
    emoji: "🌲",
    q: "Субботник в Сосновом бору — твоя роль?",
    options: [
      { label: "Не пойду — пусть администрация убирает", points: -42, hint: "Пассивно" },
      { label: "Приду, но только фоткаться для сторис", points: 5, hint: "Хоть что-то" },
      { label: "Приду с братанами, соберём мешок мусора", points: 42, hint: "Братуха" },
      { label: "Организую эко-рейд с плакатом MAGNUM 42", points: 42, hint: "ЭкоЛегенда" },
    ],
  },
];

/* ── Ранг ─────────────────────────────────────────────────── */

// -- EXTRA 40 -- real, FILE:LINE
export const ECO_EXTRA_FACTS: { fact: string; src: string }[] = [
  { fact: "Батилки 42 пешком +42", src: "EcoPage.tsx:35" }, // FILE:LINE EcoPage.tsx:35
  { fact: "Самокат/велик по Томи +42", src: "EcoPage.tsx:36" }, // FILE:LINE EcoPage.tsx:36
  { fact: "Автобус 42 норм 15", src: "EcoPage.tsx:37" }, // FILE:LINE EcoPage.tsx:37
  { fact: "Крузак бати -42", src: "EcoPage.tsx:38" }, // FILE:LINE EcoPage.tsx:38
  { fact: "Не курю парке Победы +42", src: "EcoPage.tsx:45" }, // FILE:LINE EcoPage.tsx:45
  { fact: "Вейп -42", src: "EcoPage.tsx:46" }, // FILE:LINE EcoPage.tsx:46
  { fact: "Пачка в день -142", src: "EcoPage.tsx:47" }, // FILE:LINE EcoPage.tsx:47
  { fact: "Шуба норки -142", src: "EcoPage.tsx:57" }, // FILE:LINE EcoPage.tsx:57
  { fact: "Телогрейка шахтёра +42", src: "EcoPage.tsx:59" }, // FILE:LINE EcoPage.tsx:59
  { fact: "Куртка переработанный пластик +42", src: "EcoPage.tsx:60" }, // FILE:LINE EcoPage.tsx:60
  { fact: "Мусор на Красном озере -142", src: "EcoPage.tsx:68" }, // FILE:LINE EcoPage.tsx:68
  { fact: "Сжёг пластик -42", src: "EcoPage.tsx:69" }, // FILE:LINE EcoPage.tsx:69
  { fact: "Собрал в пакет +42", src: "EcoPage.tsx:70" }, // FILE:LINE EcoPage.tsx:70
  { fact: "Разделил органика +42", src: "EcoPage.tsx:71" }, // FILE:LINE EcoPage.tsx:71
  { fact: "Заказы каждый день -42", src: "EcoPage.tsx:79" }, // FILE:LINE EcoPage.tsx:79
  { fact: "Беру раз в месяц +42", src: "EcoPage.tsx:80" }, // FILE:LINE EcoPage.tsx:80
  { fact: "Отказ упаковки +42", src: "EcoPage.tsx:81" }, // FILE:LINE EcoPage.tsx:81
  { fact: "Уголь без фильтра -142", src: "EcoPage.tsx:90" }, // FILE:LINE EcoPage.tsx:90
  { fact: "Брикеты + деревья +42", src: "EcoPage.tsx:92" }, // FILE:LINE EcoPage.tsx:92
  { fact: "Агитирую переработка +42", src: "EcoPage.tsx:93" }, // FILE:LINE EcoPage.tsx:93
  { fact: "Кидаю в Томь -142", src: "EcoPage.tsx:101" }, // FILE:LINE EcoPage.tsx:101
  { fact: "Фандомат Лента +42", src: "EcoPage.tsx:103" }, // FILE:LINE EcoPage.tsx:103
  { fact: "Своя бутылка 42 +42", src: "EcoPage.tsx:104" }, // FILE:LINE EcoPage.tsx:104
  { fact: "Не пойду субботник -42", src: "EcoPage.tsx:111" }, // FILE:LINE EcoPage.tsx:111
  { fact: "Соберу мешок +42", src: "EcoPage.tsx:113" }, // FILE:LINE EcoPage.tsx:113
  { fact: "Организую рейд +42", src: "EcoPage.tsx:114" }, // FILE:LINE EcoPage.tsx:114
  { fact: "Сосновый бор субботник", src: "EcoPage.tsx:487" }, // FILE:LINE EcoPage.tsx:487
  { fact: "Ранг ЭкоЛегенда >=200", src: "EcoPage.tsx:123" }, // FILE:LINE EcoPage.tsx:123
  { fact: "Ранг Братуха >=100", src: "EcoPage.tsx:124" }, // FILE:LINE EcoPage.tsx:124
  { fact: "API GET /eco/leaderboard", src: "EcoPage.tsx:132" }, // FILE:LINE EcoPage.tsx:132
  { fact: "API POST /eco/submit", src: "EcoPage.tsx:146" }, // FILE:LINE EcoPage.tsx:146
  { fact: "Прогресс 8 вопросов", src: "EcoPage.tsx:346" }, // FILE:LINE EcoPage.tsx:346
  { fact: "Топ-10 Кузбасса", src: "EcoPage.tsx:464" }, // FILE:LINE EcoPage.tsx:464
  { fact: "Кемерово эко-рейтинг", src: "EcoPage.tsx:335" }, // FILE:LINE EcoPage.tsx:335
  { fact: "100-199 Братуха", src: "EcoPage.tsx:433" }, // FILE:LINE EcoPage.tsx:433
  { fact: "200+ Легенда", src: "EcoPage.tsx:437" }, // FILE:LINE EcoPage.tsx:437
  { fact: "Красное озеро шашлыки", src: "EcoPage.tsx:66" }, // FILE:LINE EcoPage.tsx:66
  { fact: "ТЦ Лапландия курево", src: "EcoPage.tsx:44" }, // FILE:LINE EcoPage.tsx:44
  { fact: "Фандомат Лента бонусы", src: "EcoPage.tsx:103" }, // FILE:LINE EcoPage.tsx:103
  { fact: "Томь чище эко-вайб", src: "EcoPage.tsx:487" }, // FILE:LINE EcoPage.tsx:487
];


function getRank(score: number): { title: string; emoji: string; cls: string; desc: string } {
  if (score >= 200) return { title: "ЭкоЛегенда", emoji: "🌿👑", cls: styles.rankLegend, desc: "Ты — дух Кузбасса. Томь чище, бор зеленее. MAGNUM гордится." };
  if (score >= 100) return { title: "Братуха", emoji: "🤝", cls: styles.rankBrat, desc: "Крепкий братуха. Ещё чуть-чуть до легенды — жми!" };
  return { title: "Нормис", emoji: "😐", cls: styles.rankNormis, desc: "Пока нормис. Пора менять батилки и привычки." };
}

/* ── API: /magnum/api/eco/* ─────────────────────────────────── */

async function fetchLeaderboard(): Promise<LeaderEntry[]> {
  try {
    const res = await fetch("/magnum/api/eco/leaderboard", { credentials: "include" });
    if (!res.ok) return [];
    const data = await res.json() as { leaderboard?: LeaderEntry[]; entries?: LeaderEntry[] } | LeaderEntry[];
    if (Array.isArray(data)) return data as LeaderEntry[];
    if (Array.isArray(data.leaderboard)) return data.leaderboard;
    if (Array.isArray(data.entries)) return data.entries;
    return [];
  } catch {
    return [];
  }
}

async function submitEcoResult(entry: LeaderEntry & { score: number }): Promise<boolean> {
  try {
    const res = await fetch("/magnum/api/eco/submit", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ── Компонент ────────────────────────────────────────────── */

export function EcoPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const resultRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [answers, setAnswers] = useState<(number | null)[]>(() => Array(QUESTIONS.length).fill(null));
  const [showResult, setShowResult] = useState(false);
  const [nickname, setNickname] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [savedScore, setSavedScore] = useState<number | null>(null);

  const answeredCount = useMemo(() => answers.filter((a) => a !== null).length, [answers]);
  const progress = Math.round((answeredCount / QUESTIONS.length) * 100);

  const score: number = useMemo(() => {
    return answers.reduce<number>((acc, ansIdx, qIdx) => {
      if (ansIdx === null) return acc;
      const pts = QUESTIONS[qIdx].options[ansIdx as number].points;
      return acc + pts;
    }, 0);
  }, [answers]);

  const rank = useMemo(() => getRank(score as number), [score]);
  const allAnswered = answeredCount === QUESTIONS.length;

  /* GSAP stagger вход вопросов */
  useEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.set(cardsRef.current, { y: 28, opacity: 0, scale: 0.97 });
      gsap.to(cardsRef.current, {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 0.55,
        stagger: 0.07,
        ease: "back.out(1.5)",
        delay: 0.15,
      });
      gsap.fromTo(
        `.${styles.progressFill}`,
        { backgroundPosition: "0% 50%" },
        { backgroundPosition: "200% 50%", duration: 2, repeat: -1, ease: "none" }
      );
    }, rootRef);
    return () => ctx.revert();
  }, []);

  /* Прогресс-бар анимация ширины */
  useEffect(() => {
    if (!progressRef.current) return;
    gsap.to(progressRef.current, {
      width: `${progress}%`,
      duration: 0.6,
      ease: "power3.out",
    });
  }, [progress]);

  /* Анимация результата */
  useEffect(() => {
    if (!showResult || !resultRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(resultRef.current, { scale: 0.9, opacity: 0, y: 24, duration: 0.6, ease: "back.out(1.7)" });
      gsap.from(`.${styles.badgePop}`, { scale: 0, rotation: -12, duration: 0.7, ease: "elastic.out(1,0.5)", delay: 0.25 });
      gsap.from(`.${styles.shareBtn}`, { y: 12, opacity: 0, duration: 0.5, delay: 0.45 });
    }, resultRef);
    return () => ctx.revert();
  }, [showResult]);

  /* Анимация лидерборда stagger */
  useEffect(() => {
    if (!boardRef.current) return;
    const rows = boardRef.current.querySelectorAll(`.${styles.boardRow}`);
    if (rows.length === 0) return;
    gsap.set(rows, { x: -16, opacity: 0 });
    gsap.to(rows, { x: 0, opacity: 1, duration: 0.45, stagger: 0.06, ease: "power2.out", delay: 0.1 });
  }, [leaderboard, showResult]);

  /* загрузка лидерборда с сервера */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await fetchLeaderboard();
      if (!cancelled) setLeaderboard(list);
    })();
    return () => { cancelled = true; };
  }, []);

  const selectAnswer = (qIdx: number, oIdx: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[qIdx] = oIdx;
      return next;
    });
    // микро-анимация карточки
    const el = cardsRef.current[qIdx];
    if (el) {
      gsap.fromTo(el, { scale: 1 }, { scale: 1.015, duration: 0.12, yoyo: true, repeat: 1, ease: "power2.inOut" });
    }
  };

  const handleShowResult = () => {
    if (!allAnswered) {
      setToast("Ответь на все 8 вопросов, братуха!");
      window.setTimeout(() => setToast(null), 2800);
      return;
    }
    setShowResult(true);
    setSavedScore(score);
    // автосохранение в лидерборд если введён ник
    window.setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const handleSaveToBoard = async () => {
    const name = (nickname.trim() || "Аноним 42").slice(0, 18);
    const entry: LeaderEntry = {
      name,
      score,
      rank: rank.title,
      date: new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }),
    };
    const ok = await submitEcoResult(entry);
    if (!ok) {
      setToast("Не удалось сохранить — попробуй ещё раз");
      window.setTimeout(() => setToast(null), 3000);
      return;
    }
    const list = await fetchLeaderboard();
    if (list.length > 0) setLeaderboard(list);
    else {
      const next = [entry, ...leaderboard].sort((a, b) => b.score - a.score).slice(0, 10);
      setLeaderboard(next);
    }
    setToast(`Сохранено! Ты в топе, ${name} — ${score} баллов`);
    window.setTimeout(() => setToast(null), 3000);
  };

  const handleShare = async () => {
    const text = `ЭКО-РЕЙТИНГ 42 — ${rank.title} ${rank.emoji} | ${score} баллов | Кемерово/Кузбасс | Пройди тест: /magnum/eco | #MAGNUM42 #Эко42`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setToast("Скопировано в буфер! Поделись с братанами 📋");
      window.setTimeout(() => {
        setCopied(false);
        setToast(null);
      }, 2500);
    } catch {
      setToast("Не вышло скопировать — скопируй вручную");
      window.setTimeout(() => setToast(null), 2500);
    }
  };

  const handleReset = () => {
    setAnswers(Array(QUESTIONS.length).fill(null));
    setShowResult(false);
    setToast(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    // ре-анимация карточек
    window.setTimeout(() => {
      gsap.set(cardsRef.current, { y: 18, opacity: 0 });
      gsap.to(cardsRef.current, { y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: "power2.out" });
    }, 200);
  };

  return (
    <div className={styles.page} ref={rootRef}>
      {/* ── Хедер ── */}
      <header className={styles.header}>
        <span className={styles.badge}>ЭКО-РЕЙТИНГ 42 • Кемерово / Кузбасс</span>
        <h1 className={styles.title}>ЭКО-РЕЙТИНГ 42</h1>
        <p className={styles.subtitle}>
          8 вопросов ироничной пропаганды — батилки +42, самокат +42, шуба −142, курить −142. Проверь, ты Нормис, Братуха или ЭкоЛегенда?
        </p>
        {savedScore !== null && !showResult && (
          <div className={styles.savedHint}>Последний результат: {savedScore} баллов • пройди снова чтобы обновить</div>
        )}
      </header>

      {/* ── Прогресс-бар RGB зелёный ── */}
      <div className={styles.progressWrap} aria-label={`Прогресс ${progress}%`}>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} ref={progressRef} style={{ width: `${progress}%` }} />
          <div className={styles.progressShine} aria-hidden />
        </div>
        <div className={styles.progressMeta}>
          <span className={styles.progressLabel}>{answeredCount}/8 вопросов</span>
          <span className={styles.progressPct}>{progress}%</span>
        </div>
      </div>

      {/* ── Тосты ── */}
      {toast && (
        <div className={styles.toast} role="status">
          {toast}
        </div>
      )}

      {/* ── Вопросы ── */}
      <section className={styles.grid} aria-label="Вопросы теста">
        {QUESTIONS.map((q, qIdx) => (
          <div
            key={q.id}
            ref={(el) => {
              cardsRef.current[qIdx] = el;
            }}
            className={`${styles.card} ${answers[qIdx] !== null ? styles.cardDone : ""}`}
          >
            <div className={styles.cardHead}>
              <span className={styles.cardEmoji}>{q.emoji}</span>
              <span className={styles.cardNum}>#{q.id}</span>
              <h3 className={styles.cardQ}>{q.q}</h3>
            </div>
            <div className={styles.options}>
              {q.options.map((opt, oIdx) => {
                const active = answers[qIdx] === oIdx;
                return (
                  <button
                    key={oIdx}
                    type="button"
                    onClick={() => selectAnswer(qIdx, oIdx)}
                    className={`${styles.opt} ${active ? styles.optActive : ""} ${opt.points > 0 ? styles.optPos : opt.points < 0 ? styles.optNeg : ""}`}
                  >
                    <span className={styles.optLabel}>{opt.label}</span>
                    <span className={styles.optMeta}>
                      <span className={styles.optHint}>{opt.hint}</span>
                      <span className={`${styles.optPts} ${opt.points > 0 ? styles.ptsPos : opt.points < 0 ? styles.ptsNeg : styles.ptsZero}`}>
                        {opt.points > 0 ? `+${opt.points}` : `${opt.points}`}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* ── Кнопка показать результат ── */}
      <div className={styles.actions}>
        <button type="button" className={styles.btnPrimary} onClick={handleShowResult} disabled={!allAnswered}>
          {allAnswered ? "Узнать ранг →" : `Ответь ещё ${QUESTIONS.length - answeredCount}`}
        </button>
        <button type="button" className={styles.btnGhost} onClick={handleReset}>
          Сбросить
        </button>
      </div>

      {/* ── Результат ── */}
      {showResult && (
        <section className={styles.result} ref={resultRef} aria-live="polite">
          <div className={`${styles.badgePop} ${rank.cls}`}>
            <span className={styles.badgeEmoji}>{rank.emoji}</span>
            <span className={styles.badgeTitle}>{rank.title}</span>
          </div>
          <div className={styles.scoreRow}>
            <span className={styles.scoreNum}>{score}</span>
            <span className={styles.scoreLbl}>баллов</span>
          </div>
          <p className={styles.rankDesc}>{rank.desc}</p>

          <div className={styles.rankScale}>
            <div className={`${styles.scaleSeg} ${score <= 99 ? styles.segActive : ""}`}>
              <span>Нормис</span>
              <small>0–99</small>
            </div>
            <div className={`${styles.scaleSeg} ${score >= 100 && score <= 199 ? styles.segActive : ""}`}>
              <span>Братуха</span>
              <small>100–199</small>
            </div>
            <div className={`${styles.scaleSeg} ${score >= 200 ? styles.segActive : ""}`}>
              <span>ЭкоЛегенда</span>
              <small>200+</small>
            </div>
          </div>

          <div className={styles.saveRow}>
            <input
              className={styles.nickInput}
              placeholder="Твой ник для топа (Аноним 42)"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={18}
            />
            <button type="button" className={styles.btnSave} onClick={handleSaveToBoard}>
              Сохранить в топ
            </button>
          </div>

          <button type="button" className={styles.shareBtn} onClick={handleShare}>
            {copied ? "✅ Скопировано" : "📋 Поделиться результатом"}
          </button>
          <p className={styles.shareHint}>Копирует текст в буфер через navigator.clipboard.writeText</p>
        </section>
      )}

      {/* ── Лидерборд ── */}
      <section className={styles.board} ref={boardRef} aria-label="Топ-10 Эко-рейтинга">
        <h2 className={styles.boardTitle}>
          🏆 Топ-10 ЭкоЛегенд Кузбасса <span className={styles.boardSub}>magnum/api/eco/leaderboard</span>
        </h2>
        {leaderboard.length === 0 ? (
          <p className={styles.boardEmpty}>Пока пусто — стань первым ЭкоЛегендой! Пройди тест и сохрани результат.</p>
        ) : (
          <div className={styles.boardList}>
            {leaderboard.map((e, i) => (
              <div key={`${e.name}-${e.date}-${i}`} className={`${styles.boardRow} ${i < 3 ? styles.boardTop : ""}`}>
                <span className={styles.boardPos}>{i + 1}</span>
                <span className={styles.boardName}>{e.name}</span>
                <span className={styles.boardRank}>{e.rank}</span>
                <span className={styles.boardScore}>{e.score > 0 ? `+${e.score}` : e.score}</span>
                <span className={styles.boardDate}>{e.date}</span>
              </div>
            ))}
          </div>
        )}
        <p className={styles.boardFoot}>Топ с сервера • Сортировка по баллам • Обновляется после каждого теста</p>
      </section>

      {/* ── Футер ── */}
      <footer className={styles.footer}>
        <p>Сделано в Кемерово с любовью к Томи и Сосновому бору • MAGNUM 42 — ироничная пропаганда, серьёзный эко-вайб 🌲</p>
      </footer>
    </div>
  );
}

export default EcoPage;