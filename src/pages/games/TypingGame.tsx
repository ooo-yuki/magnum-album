import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import styles from "./TypingGame.module.css";

const PRESAVE = "https://music.thefence.me/psmagnum";
const WIN_WPM = 42; // thematic target

interface Phrase {
  text: string;
  tag: string;
}

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

function calcWPM(chars: number, ms: number): number {
  if (ms <= 0) return 0;
  const minutes = ms / 60000;
  const words = chars / 5; // standard: 5 chars = 1 word
  return Math.round(words / minutes);
}

function calcAccuracy(typed: string, target: string): number {
  if (typed.length === 0) return 100;
  let correct = 0;
  for (let i = 0; i < typed.length; i++) {
    if (typed[i] === target[i]) correct++;
  }
  return Math.round((correct / typed.length) * 100);
}

// WebAudio
let ac: AudioContext | null = null;
function ensureAC() {
  if (!ac) try { ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { return null; }
  if (ac && ac.state === "suspended") void ac.resume();
  return ac;
}
function playKey(correct: boolean) {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = correct ? "sine" : "square";
  o.frequency.value = correct ? 660 : 180;
  g.gain.setValueAtTime(correct ? 0.06 : 0.1, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
  o.start(); o.stop(ctx.currentTime + 0.1);
}
function playWin() {
  const ctx = ensureAC(); if (!ctx) return;
  [0, 0.1, 0.2, 0.3].forEach((d, i) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.value = 440 + i * 110;
    g.gain.setValueAtTime(0.12, ctx.currentTime + d);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.35);
    o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.4);
  });
}

export function TypingGame() {
  const [state, setState] = useState<"menu" | "playing" | "done">("menu");
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [startTime, setStartTime] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [bestWpm, setBestWpm] = useState(() => { try { return Number(localStorage.getItem("typing42-best")) || 0; } catch { return 0; } });
  const [completed, setCompleted] = useState(0);
  const [totalChars, setTotalChars] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const phrase = PHRASES[phraseIdx]!;

  const startGame = useCallback(() => {
    setPhraseIdx(0);
    setTyped("");
    setStartTime(0);
    setWpm(0);
    setCompleted(0);
    setTotalChars(0);
    setTotalTime(0);
    setState("playing");
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  const nextPhrase = useCallback(() => {
    const now = performance.now();
    const elapsed = now - startTime;
    const phraseWpm = calcWPM(phrase.text.length, elapsed);
    const newCompleted = completed + 1;
    const newTotalChars = totalChars + phrase.text.length;
    const newTotalTime = totalTime + elapsed;
    setCompleted(newCompleted);
    setTotalChars(newTotalChars);
    setTotalTime(newTotalTime);
    setWpm(calcWPM(newTotalChars, newTotalTime));

    if (newCompleted >= PHRASES.length) {
      // finished all phrases
      const finalWpm = calcWPM(newTotalChars, newTotalTime);
      if (finalWpm > bestWpm) {
        setBestWpm(finalWpm);
        try { localStorage.setItem("typing42-best", String(finalWpm)); } catch {}
      }
      playWin();
      setState("done");
      return;
    }

    const nextIdx = (phraseIdx + 1) % PHRASES.length;
    setPhraseIdx(nextIdx);
    setTyped("");
    setStartTime(0);
    setTimeout(() => inputRef.current?.focus(), 40);
  }, [startTime, phrase, completed, totalChars, totalTime, phraseIdx, bestWpm]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (state !== "playing") return;

    // start timer on first keystroke
    if (startTime === 0 && val.length > 0) {
      setStartTime(performance.now());
    }

    // check each char
    const lastChar = val[val.length - 1];
    const expectedChar = phrase.text[val.length - 1];
    if (lastChar !== undefined && lastChar !== expectedChar) {
      playKey(false);
      setShake(true);
      setTimeout(() => setShake(false), 200);
    } else if (lastChar !== undefined) {
      playKey(true);
    }

    setTyped(val);

    // phrase complete
    if (val === phrase.text) {
      nextPhrase();
    }
  }, [state, startTime, phrase, nextPhrase]);

  // keyboard shortcut: Escape to restart
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape" && state === "playing") {
        setState("menu");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  const accuracy = calcAccuracy(typed, phrase.text);
  const progress = (completed / PHRASES.length) * 100;

  return (
    <div className={styles.page}>
      <h1>СКОРОПЕЧАТАНИЕ 42</h1>
      <p className={styles.sub}>Печатай фразы MAGNUM — набери {WIN_WPM} WPM!</p>

      {state === "menu" && (
        <div className={styles.menu}>
          <div className={styles.rules}>
            <p>⌨️ Печатай текст точно как на экране</p>
            <p>⏱️ Скорость считается в словах в минуту (WPM)</p>
            <p>🎯 {PHRASES.length} фраз про MAGNUM, 42 и альбом 2026</p>
            <p>🏆 Цель: {WIN_WPM}+ WPM — скорость братухи</p>
          </div>
          <button className={styles.playBtn} onClick={startGame}>Начать!</button>
          {bestWpm > 0 && <p className={styles.hint}>Рекорд: {bestWpm} WPM</p>}
          <Link to="/magnum/games" className={styles.back}>← К играм</Link>
        </div>
      )}

      {state === "playing" && (
        <div className={styles.gameArea}>
          <div className={styles.hud}>
            <div className={styles.stat}><span>Фраза</span><strong>{completed + 1} / {PHRASES.length}</strong></div>
            <div className={styles.stat}><span>WPM</span><strong className={wpm >= WIN_WPM ? styles.hot : ""}>{wpm}</strong></div>
            <div className={styles.stat}><span>Точность</span><strong>{accuracy}%</strong></div>
            <div className={styles.stat}><span>Тег</span><strong className={styles.tag}>{phrase.tag}</strong></div>
          </div>
          <div className={styles.progress}><div className={styles.fill} style={{ width: `${progress}%` }} /></div>

          <div className={`${styles.phraseBox} ${shake ? styles.shake : ""}`}>
            {phrase.text.split("").map((ch, i) => {
              let cls = "";
              if (i < typed.length) {
                cls = typed[i] === ch ? styles.correct : styles.wrong;
              } else if (i === typed.length) {
                cls = styles.cursor;
              }
              return (
                <span key={`${phraseIdx}-${i}`} className={cls}>
                  {ch}
                </span>
              );
            })}
          </div>

          <input
            ref={inputRef}
            className={styles.input}
            value={typed}
            onChange={handleInput}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Начни печатать..."
          />

          <div className={styles.navRow}>
            <button className={styles.restartBtn} onClick={() => setState("menu")}>Меню</button>
            <Link to="/magnum/games" className={styles.backInline}>← К играм</Link>
          </div>
        </div>
      )}

      {state === "done" && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2>{wpm >= WIN_WPM ? "🏆 Скорость братухи!" : "⌨️ Неплохо!"}</h2>
            <div className={styles.resultGrid}>
              <div className={styles.resultItem}><span>WPM</span><strong>{wpm}</strong></div>
              <div className={styles.resultItem}><span>Фраз</span><strong>{completed}</strong></div>
              <div className={styles.resultItem}><span>Рекорд</span><strong>{bestWpm}</strong></div>
            </div>
            <p className={styles.resultText}>
              {wpm >= WIN_WPM
                ? `${wpm} WPM — ты печатаешь как настоящий 42 братуха! Все ${PHRASES.length} фраз пройдены.`
                : `Набрано ${wpm} WPM из ${WIN_WPM} нужных. Попробуй ещё — тренируйся на фразах MAGNUM!`}
            </p>
            <a href={PRESAVE} target="_blank" rel="noreferrer" className={styles.presaveBtn}>Пресейв MAGNUM →</a>
            <div className={styles.modalActions}>
              <button className={styles.playBtn} onClick={startGame}>Ещё раз</button>
              <Link to="/magnum/games" className={styles.backInline}>← К играм</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
