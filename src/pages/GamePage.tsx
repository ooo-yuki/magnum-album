import { useState, useRef, useEffect, useCallback } from "react";
import gsap from "gsap";
import styles from "./GamePage.module.css";

const PRESAVE_URL = "https://music.thefence.me/psmagnum";

interface Question {
  q: string;
  options: string[];
  correct: number;
  fact: string;
}

const QUESTIONS: Question[] = [
  {
    q: "Что означает число 42?",
    options: [
      "Ответ на главный вопрос жизни",
      "Код региона Кемеровской области",
      "Количество треков в альбоме",
      "День рождения Пятерки",
    ],
    correct: 0,
    fact: "Из фильма «Автостопом по Галактике» — суперкомпьютер назвал 42 ответом на всё.",
  },
  {
    q: "Как расшифровывается CLAY?",
    options: [
      "Cool Life And Youth",
      "Clowns Laugh At You",
      "Create Love Always Yours",
      "Club Level All Year",
    ],
    correct: 1,
    fact: "Пасхалка, которую Кирилл прятал в конце видео 10 лет.",
  },
  {
    q: "Сколько баллов получил трек XXL на РЗТ?",
    options: ["73", "80", "86", "92"],
    correct: 2,
    fact: "Один из самых высокооценённых треков в истории РЗТ.",
  },
  {
    q: "Какой жест символизирует 42?",
    options: [
      "Кулак с двумя пальцами",
      "4 пальца на одной руке + 2 на другой",
      "V-знак дважды",
      "Палец вверх",
    ],
    correct: 1,
    fact: "4 + 2 = 42. Просто и понятно.",
  },
  {
    q: "Как зовут MellSher?",
    options: [
      "Игорь Шерстюк",
      "Игорь Меллшер",
      "Кирилл Баранов",
      "Игорь Солодков",
    ],
    correct: 0,
    fact: "Игорь Николаевич Шерстюк — полное имя.",
  },
  {
    q: "Какой первый сквад 42 братух?",
    options: [
      "НАХ-сквад (Москва)",
      "Шуба-сквад (Петербург)",
      "Хай-сквад (Воронеж)",
      "Урод-сквад (Ростов)",
    ],
    correct: 1,
    fact: "Первый сквад появился в Петербурге в 2024 году.",
  },
  {
    q: "Сколько треков в SUPER PUPER NOVA?",
    options: ["3", "4", "5", "7"],
    correct: 2,
    fact: "5 треков: Танцуй, Тонированный жигуль, Кис-кис, XXL, Репит.",
  },
  {
    q: "Кто посвящён в «братухи 42» 24 февраля 2025?",
    options: ["Эльдар Джарахов", "Дмитрий Маликов", "Стинт", "Вова Солодков"],
    correct: 1,
    fact: "Дмитрий Маликов — певец, неожиданный союзник движения.",
  },
];

export function GamePage() {
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showFact, setShowFact] = useState(false);
  const [finished, setFinished] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const resultCtxRef = useRef<gsap.Context | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    gsap.from(`.${styles.hero} > *`, {
      y: 30,
      opacity: 0,
      stagger: 0.1,
      duration: 0.8,
    });
  }, []);

  // staggered option reveal on each new question
  useEffect(() => {
    if (!optionsRef.current || finished) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;
    const buttons = optionsRef.current.querySelectorAll(`.${styles.option}`);
    gsap.set(buttons, { x: -16, opacity: 0 });
    gsap.to(buttons, {
      x: 0,
      opacity: 1,
      stagger: 0.06,
      duration: 0.35,
      ease: "power2.out",
      delay: 0.08,
    });
  }, [current, finished]);

  // result screen entrance animation
  useEffect(() => {
    if (!finished || !resultRef.current) return;
    resultCtxRef.current?.revert();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      const card = resultRef.current?.querySelector(`.${styles.resultCard}`);
      if (!card) return;
      gsap.set(card, { scale: 0.85, y: 30, opacity: 0 });
      gsap.to(card, {
        scale: 1,
        y: 0,
        opacity: 1,
        duration: 0.6,
        ease: "back.out(1.6)",
      });
      if (!reducedMotion) {
        // breathing glow on result card
        gsap.to(card, {
          boxShadow: "0 0 32px rgba(255,45,85,0.3), 0 0 64px rgba(255,45,85,0.1)",
          duration: 1.8,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          delay: 0.7,
        });
      }
      // stagger children: score, h2, text, actions
      const children = card.children;
      gsap.set(children, { y: 16, opacity: 0 });
      gsap.to(children, {
        y: 0,
        opacity: 1,
        stagger: 0.1,
        duration: 0.5,
        ease: "power2.out",
        delay: 0.2,
      });
    }, resultRef);
    resultCtxRef.current = ctx;
    return () => ctx.revert();
  }, [finished]);

  const handleSelect = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    const isCorrect = idx === QUESTIONS[current]!.correct;
    if (isCorrect) {
      setScore((s) => s + 1);
    }
    setShowFact(true);

    // answer feedback animation
    if (optionsRef.current) {
      const buttons = optionsRef.current.querySelectorAll(`.${styles.option}`);
      const btn = buttons[idx] as HTMLElement | undefined;
      if (btn) {
        gsap.to(btn, {
          scale: 1.04,
          duration: 0.15,
          yoyo: true,
          repeat: 1,
          ease: "power2.out",
        });
        if (isCorrect) {
          gsap.to(btn, {
            boxShadow: "0 0 20px rgba(0,255,136,0.5), 0 0 40px rgba(0,255,136,0.2)",
            duration: 0.4,
            ease: "power2.out",
          });
        } else {
          gsap.to(btn, {
            x: -6,
            duration: 0.08,
            yoyo: true,
            repeat: 3,
            ease: "power2.inOut",
          });
        }
      }
    }

    // Animate card
    if (cardRef.current) {
      gsap.from(cardRef.current, {
        scale: 0.95,
        duration: 0.3,
        ease: "back.out(1.7)",
      });
    }
  };

  const handleNext = () => {
    if (current < QUESTIONS.length - 1) {
      setCurrent((c) => c + 1);
      setSelected(null);
      setShowFact(false);
    } else {
      setFinished(true);
    }
  };

  const handleRestart = () => {
    setCurrent(0);
    setScore(0);
    setSelected(null);
    setShowFact(false);
    setFinished(false);
  };

  const q = QUESTIONS[current]!;
  const progress = ((current + 1) / QUESTIONS.length) * 100;

  return (
    <div className={styles.page} ref={containerRef}>
      <div className={styles.hero}>
        <div className={styles.badge}>Мини-игра</div>
        <h1>Квиз 42</h1>
        <p className={styles.subtitle}>
          Проверь, насколько ты братуха. Ответь на вопросы про 42, альбомы и
          артистов.
        </p>
      </div>

      {!finished ? (
        <div className={styles.gameArea}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className={styles.questionNum}>
            Вопрос {current + 1} из {QUESTIONS.length}
          </div>

          <div className={styles.card} ref={cardRef}>
            <h2 className={styles.question}>{q.q}</h2>
            <div className={styles.options} ref={optionsRef}>
              {q.options.map((opt, idx) => (
                <button
                  key={opt}
                  className={`${styles.option} ${
                    selected !== null
                      ? idx === q.correct
                        ? styles.correct
                        : idx === selected
                          ? styles.wrong
                          : ""
                      : ""
                  }`}
                  onClick={() => handleSelect(idx)}
                  disabled={selected !== null}
                >
                  {opt}
                </button>
              ))}
            </div>

            {showFact && (
              <div className={styles.fact}>
                <p>{q.fact}</p>
                <button className={styles.nextBtn} onClick={handleNext}>
                  {current < QUESTIONS.length - 1
                    ? "Следующий вопрос →"
                    : "Показать результат →"}
                </button>
              </div>
            )}
          </div>

          <div className={styles.score}>
            Счёт: <strong>{score}</strong>
          </div>
        </div>
      ) : (
        <div className={styles.result} ref={resultRef}>
          <div className={styles.resultCard}>
            <div className={styles.resultScore}>
              {score}/{QUESTIONS.length}
            </div>
            <h2>
              {score === QUESTIONS.length
                ? "Ты настоящий братуха! 🎉"
                : score >= QUESTIONS.length / 2
                  ? "Неплохо, но можно лучше! 💪"
                  : "Попробуй ещё раз! 🔄"}
            </h2>
            <p className={styles.resultText}>
              {score === QUESTIONS.length
                ? "Ты знаешь всё про 42 и MAGNUM. Теперь время пресейвить альбом!"
                : "Узнай больше про движение 42 и альбом MAGNUM на нашем сайте."}
            </p>
            <div className={styles.resultActions}>
              <a
                href={PRESAVE_URL}
                target="_blank"
                className={styles.presaveBtn}
              >
                Пресейв MAGNUM →
              </a>
              <button className={styles.restartBtn} onClick={handleRestart}>
                Попробовать ещё раз
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
