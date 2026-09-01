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

function getRank(score: number): { title: string; emoji: string; cls: string; desc: string } {
  if (score >= 200) return { title: "ЭкоЛегенда", emoji: "🌿👑", cls: styles.rankLegend, desc: "Ты — дух Кузбасса. Томь чище, бор зеленее. MAGNUM гордится." };
  if (score >= 100) return { title: "Братуха", emoji: "🤝", cls: styles.rankBrat, desc: "Крепкий братуха. Ещё чуть-чуть до легенды — жми!" };
  return { title: "Нормис", emoji: "😐", cls: styles.rankNormis, desc: "Пока нормис. Пора менять батилки и привычки." };
}

/* ── localStorage ключи ───────────────────────────────────── */

const RESULT_KEY = "magnum-eco-result";
const LEADER_KEY = "magnum-eco-leaderboard";

function loadLeaderboard(): LeaderEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LEADER_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveLeaderboard(list: LeaderEntry[]): void {
  try {
    localStorage.setItem(LEADER_KEY, JSON.stringify(list.slice(0, 10)));
  } catch {
    /* ignore */
  }
}

function loadResult(): { score: number; date: string } | null {
  try {
    const raw = JSON.parse(localStorage.getItem(RESULT_KEY) || "null");
    if (raw && typeof raw.score === "number") return raw;
    return null;
  } catch {
    return null;
  }
}

function saveResult(score: number): void {
  try {
    localStorage.setItem(RESULT_KEY, JSON.stringify({ score, date: new Date().toISOString() }));
  } catch {
    /* ignore */
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
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>(() => loadLeaderboard());
  const [savedScore, setSavedScore] = useState<number | null>(() => loadResult()?.score ?? null);

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
    saveResult(score);
    setSavedScore(score);
    // автосохранение в лидерборд если введён ник
    window.setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const handleSaveToBoard = () => {
    const name = nickname.trim() || "Аноним 42";
    const entry: LeaderEntry = {
      name: name.slice(0, 18),
      score,
      rank: rank.title,
      date: new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }),
    };
    const next = [entry, ...leaderboard]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    setLeaderboard(next);
    saveLeaderboard(next);
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
          🏆 Топ-10 ЭкоЛегенд Кузбасса <span className={styles.boardSub}>magnum-eco-leaderboard</span>
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
        <p className={styles.boardFoot}>Сохранение в localStorage • Топ сортируется по баллам • Обновляется после каждого теста</p>
      </section>

      {/* ── Футер ── */}
      <footer className={styles.footer}>
        <p>Сделано в Кемерово с любовью к Томи и Сосновому бору • MAGNUM 42 — ироничная пропаганда, серьёзный эко-вайб 🌲</p>
      </footer>
    </div>
  );
}

export default EcoPage;
