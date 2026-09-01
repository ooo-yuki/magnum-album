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

const PRESAVE = "https://music.thefence.me/psmagnum";

interface Event {
  id: string;
  date: string;
  sortKey: number; // YYYYMMDD for ordering
  title: string;
  detail: string;
  emoji: string;
}

const EVENTS: Event[] = [
  { id: "clay", date: "03.04.2026", sortKey: 20260403, title: "CLAY EP", detail: "5 треков, РЗТ 73/100. Clowns Laugh At You — пасхалка 10 лет.", emoji: "🤡" },
  { id: "vpn", date: "2026", sortKey: 20260501, title: "VPN — второй сингл", detail: "Поп-вайб 2:23. Дежавю-поп от дуэта. Ротация РЗТ.", emoji: "🔐" },
  { id: "meduza", date: "14.08.2026", sortKey: 20260814, title: "ТУСА МЕДУЗА", detail: "8K+ клипов TikTok, 200K+ просмотров. Первый выстрел MAGNUM.", emoji: "🪼" },
  { id: "album", date: "Осень 2026", sortKey: 20261001, title: "MAGNUM — 5 пуль", detail: "5 треков — 5 пуль. Финальный альбом 5opka × MellSher.", emoji: "💿" },
  { id: "tour", date: "2026", sortKey: 20261101, title: "MAGNUM тур", detail: "923K фолловеров Twitch, пик 28K. Стримы выходят оффлайн.", emoji: "🎤" },
  { id: "presave", date: "Открыт", sortKey: 20260101, title: "Пресейв MAGNUM", detail: "Один клик — 5 пуль прилетят первыми. Bandlink The Fence.", emoji: "🔗" },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i]!, a[j]!] = [a[j]!, a[i]!];
  }
  return a;
}

// WebAudio
let ac: AudioContext | null = null;
function ensureAC() {
  if (!ac) try { ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { return null; }
  if (ac && ac.state === "suspended") void ac.resume();
  return ac;
}
function playCorrect() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sine"; o.frequency.value = 660;
  o.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.1);
  g.gain.setValueAtTime(0.18, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
  o.start(); o.stop(ctx.currentTime + 0.25);
}
function playWrong() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "square"; o.frequency.value = 180;
  g.gain.setValueAtTime(0.15, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  o.start(); o.stop(ctx.currentTime + 0.3);
}
function playWin() {
  const ctx = ensureAC(); if (!ctx) return;
  [0, 0.12, 0.24, 0.36].forEach((d, i) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.value = 523 + i * 110;
    g.gain.setValueAtTime(0.15, ctx.currentTime + d);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.4);
    o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.4);
  });
}

export function Timeline2026Game() {
  const [state, setState] = useState<"menu" | "playing" | "win" | "fail">("menu");
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [cards, setCards] = useState<Event[]>([]);
  const [placed, setPlaced] = useState<Event[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"ok" | "bad" | null>(null);
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem("tl2026-best")) || 0; } catch { return 0; } });
  const listRef = useRef<HTMLDivElement>(null);
  const placedRef = useRef<HTMLDivElement>(null);

  const ROUNDS = 5;
  const POINTS_PER = 840; // 840*5 = 4200

  const startGame = useCallback(() => {
    const shuffled = shuffle(EVENTS);
    setCards(shuffled);
    setPlaced([]);
    setRound(0);
    setScore(0);
    setLives(3);
    setSelected(null);
    setFeedback(null);
    setState("playing");
  }, []);

  const pickCard = useCallback((id: string) => {
    if (feedback) return;
    setSelected(id);
  }, [feedback]);

  const placeCard = useCallback(() => {
    if (!selected || feedback) return;
    const card = cards.find(c => c.id === selected);
    if (!card) return;

    // Check if this is the correct next card (lowest sortKey among remaining)
    const remaining = cards.filter(c => !placed.find(p => p.id === c.id));
    const correctNext = remaining.reduce((min, c) => c.sortKey < min.sortKey ? c : min, remaining[0]!);
    const isCorrect = card.id === correctNext.id;

    if (isCorrect) {
      const newPlaced = [...placed, card];
      setPlaced(newPlaced);
      setScore(s => s + POINTS_PER);
      setFeedback("ok");
      playCorrect();

      // Animate placed card
      setTimeout(() => {
        if (placedRef.current) {
          const lastChild = placedRef.current.lastElementChild;
          if (lastChild) gsap.from(lastChild, { y: 20, opacity: 0, scale: 0.9, duration: 0.35, ease: "back.out(1.7)" });
        }
      }, 50);

      setTimeout(() => {
        setFeedback(null);
        setSelected(null);
        if (newPlaced.length === EVENTS.length) {
          // Round complete
          if (round + 1 >= ROUNDS) {
            const finalScore = score + POINTS_PER;
            if (finalScore > best) {
              setBest(finalScore);
              try { localStorage.setItem("tl2026-best", String(finalScore)); } catch {}
            }
            playWin();
            setState("win");
          } else {
            setRound(r => r + 1);
            setCards(shuffle(EVENTS));
            setPlaced([]);
            setSelected(null);
          }
        }
      }, 600);
    } else {
      setLives(l => l - 1);
      setFeedback("bad");
      playWrong();

      // Shake animation
      if (listRef.current) {
        gsap.to(listRef.current, { x: -8, duration: 0.06, yoyo: true, repeat: 5, ease: "power2.inOut" });
      }

      setTimeout(() => {
        setFeedback(null);
        setSelected(null);
        if (lives - 1 <= 0) {
          setState("fail");
        }
      }, 800);
    }
  }, [selected, cards, placed, round, score, lives, best, feedback]);

  // Keyboard: number keys 1-6 to select, Enter to place
  useEffect(() => {
    if (state !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Enter" || e.code === "Space") { e.preventDefault(); placeCard(); return; }
      const num = parseInt(e.key);
      if (num >= 1 && num <= cards.length) {
        const remaining = cards.filter(c => !placed.find(p => p.id === c.id));
        if (remaining[num - 1]) pickCard(remaining[num - 1]!.id);
      }
    };
    window.addEventListener("keydown", onKey);
  
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

  return () => window.removeEventListener("keydown", onKey);
  }, [state, cards, placed, placeCard, pickCard]);

  const remaining = cards.filter(c => !placed.find(p => p.id === c.id));
  const progressPct = (placed.length / EVENTS.length) * 100;

  return (
    <div className={styles.page}>
      <h1>ХРОНОЛОГИЯ 2026</h1>
      <p className={styles.sub}>Расставь события MAGNUM по порядку — от ранних к поздним</p>

      {state === "menu" && (
        <div className={styles.menu}>
          <div className={styles.rules}>
            <p>📅 Тебе показывают события 2026 года в случайном порядке</p>
            <p>👆 Выбери карточку и нажми «Поставить» — она встанет в хронологию</p>
            <p>✅ Правильный порядок = +{POINTS_PER} очков за карточку</p>
            <p>❌ Ошибка = −1 жизнь (всего 3)</p>
            <p>🏆 {ROUNDS} раундов × {EVENTS.length} событий = победа!</p>
            <p>💡 Подсказка: пресейв был первым, альбом — осенью</p>
          </div>
          <button className={styles.playBtn} onClick={startGame}>Начать!</button>
          <p className={styles.hint}>Рекорд: {best} pts • Клавиши 1-6 + Enter</p>
          <Link to="/magnum/games" className={styles.back}>← К играм</Link>
        </div>
      )}

      {state === "playing" && (
        <div className={styles.gameArea}>
          <div className={styles.hud}>
            <div className={styles.stat}><span>Раунд</span><strong>{round + 1} / {ROUNDS}</strong></div>
            <div className={styles.stat}><span>Очки</span><strong>{score}</strong></div>
            <div className={styles.stat}><span>Жизни</span><strong>{"❤️".repeat(lives)}{"🤍".repeat(3 - lives)}</strong></div>
          </div>
          <div className={styles.progress}><div className={styles.fill} style={{ width: `${progressPct}%` }} /></div>

          {/* Timeline: placed cards in order */}
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

          {/* Remaining cards to pick from */}
          <div className={styles.cardList} ref={listRef}>
            {remaining.map((ev, i) => (
              <button
                key={ev.id}
                className={`${styles.card} ${selected === ev.id ? styles.selected : ""}`}
                onClick={() => pickCard(ev.id)}
              >
                <span className={styles.cardIdx}>{i + 1}</span>
                <span className={styles.cardEmoji}>{ev.emoji}</span>
                <div className={styles.cardInfo}>
                  <strong>{ev.title}</strong>
                  <p>{ev.detail}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Place button */}
          <button
            className={`${styles.placeBtn} ${!selected ? styles.placeBtnDisabled : ""} ${feedback === "ok" ? styles.placeBtnOk : ""} ${feedback === "bad" ? styles.placeBtnBad : ""}`}
            onClick={placeCard}
            disabled={!selected || !!feedback}
          >
            {feedback === "ok" ? "✅ Верно!" : feedback === "bad" ? "❌ Не тот порядок!" : selected ? "Поставить в хронологию →" : "Выбери карточку"}
          </button>

          <div className={styles.navRow}>
            <button className={styles.restartBtn} onClick={startGame}>Заново</button>
            <Link to="/magnum/games" className={styles.backInline}>← К играм</Link>
          </div>
        </div>
      )}

      {state === "win" && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2>🏆 Хронолог — ты!</h2>
            <p>{score} очков • {ROUNDS} раундов пройдены</p>
            <p className={styles.winSub}>Ты знаешь хронологию MAGNUM 2026 лучше всех!</p>
            <a href={PRESAVE} target="_blank" rel="noreferrer" className={styles.presaveBtn}>Пресейв MAGNUM →</a>
            <button className={styles.restartBtn} onClick={startGame}>Ещё раз</button>
          </div>
        </div>
      )}

      {state === "fail" && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2>💥 Жизни кончились!</h2>
            <p>{score} очков • раунд {round + 1} • рекорд {best}</p>
            <p className={styles.failHint}>Вспоминая: пресейв → CLAY → VPN → ТУСА МЕДУЗА → альбом → тур</p>
            <button className={styles.playBtn} onClick={startGame}>Ещё попытка</button>
            <Link to="/magnum/games" className={styles.backInline}>← К играм</Link>
          </div>
        </div>
      )}
    </div>
  );
}