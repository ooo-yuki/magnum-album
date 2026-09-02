import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./EcoPage.module.css";
import { CosmeticIdentity, cosmeticBannerStyle, type LeaderCosmetics } from "../components/CosmeticBadge";
import { GuestGate } from "../components/GuestGate";

gsap.registerPlugin(ScrollTrigger);
const prefersReduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Option = { label: string; points: number; hint: string };
type Question = { id: number; q: string; emoji: string; options: Option[] };
type LeaderEntry = { name: string; score: number; rank: string; date: string; avatar?: string | null; verified?: boolean } & LeaderCosmetics;
type EcoTierFront = { rating: number; tier: string; minScore: number; maxScore: number; color: string; badge: string; desc: string };
type EcoTopRow = { player: string; score: number; rating: number; tier: string; avatar?: string | null } & LeaderCosmetics;
type ChallengeState = { weekId: string; streak: number; freezeUsed: boolean; canFreeze: boolean; streakDays: number[] };

const PRESAVE_URL = "https://music.thefence.me/psmagnum";

// ── 8Q — ECO LES 42 — Лес/Тайга/Кузбасс + bio-вахта 7дн + MAGNUM 8K/200K VPN 28.04 CLAY73 NOVA80/XXL86 ──
const QUESTIONS: Question[] = [
  {
    id: 1,
    emoji: "🌲",
    q: "Лес Кузбасса — 4817,5 тыс га, 3 хребта. Что делаешь с лесом?",
    options: [
      { label: "Рублю без разрешения — доски дороже леса", points: -142, hint: "−142 вырубка" },
      { label: "Жгу костры в тайге без костровища", points: -42, hint: "Пожар -42" },
      { label: "Сажаю кедры и сосны весной, чищу валежник", points: 42, hint: "Лес 42 +42" },
      { label: "Организую субботник в Сосновом бору с плакатом 42", points: 42, hint: "Bio-вахта +42" },
    ],
  },
  {
    id: 2,
    emoji: "🏔️",
    q: "Тайга — Кузнецкий Алатау и Салаирский кряж. Твоя тропа?",
    options: [
      { label: "Не знаю где Алатау — тайга не для меня", points: -42, hint: "Учи Кузбасс" },
      { label: "Оставляю мусор на тропе — тайга скроет", points: -142, hint: "−142 мусор" },
      { label: "Хожу по экотропе, не схожу в заповедник", points: 42, hint: "Эко-тропа +42" },
      { label: "Фото-вахта: снимаю редкие кедры, не ломаю ветки", points: 42, hint: "Тайга 42 +42" },
    ],
  },
  {
    id: 3,
    emoji: "🌊",
    q: "Томь — 827 км через Кузбасс. Что с лесом у реки?",
    options: [
      { label: "Сливаю масло в Томь — река унесёт", points: -142, hint: "−142 и бан" },
      { label: "Оставил пикник на берегу — природа вывезет", points: -42, hint: "Не вывезет" },
      { label: "Убрал берег, донёс мусор до бака", points: 42, hint: "Томь +42" },
      { label: "Высадил ивы у Томи, укрепляю берег", points: 42, hint: "Bio-лес +42" },
    ],
  },
  {
    id: 4,
    emoji: "♻️",
    q: "Bio-вахта 7дн — твой челлендж на неделю?",
    options: [
      { label: "Не сортирую — всё в один пакет", points: -42, hint: "−42" },
      { label: "Сортирую иногда, когда не лень", points: 5, hint: "Полдела" },
      { label: "7 дней подряд: раздельно пластик/органика, мою и сдаю", points: 42, hint: "Вахта 7дн +42" },
      { label: "Веду bio-дневник, чищу лес под таймер 42 мин/день", points: 42, hint: "Bio-вахта легенда" },
    ],
  },
  {
    id: 5,
    emoji: "4️⃣2️⃣",
    q: "Число 42 — что для тебя MAGNUM 42?",
    options: [
      { label: "Просто число", points: -5, hint: "Мимо" },
      { label: "Шифр Кузбасса — 42 регион, наш код", points: 42, hint: "+42" },
      { label: "MAGNUM 42 — альбом 5opka, 42 — наш вайб", points: 42, hint: "+42" },
      { label: "42 монеты за каждый стрик — фармлю", points: 15, hint: "Норм" },
    ],
  },
  {
    id: 6,
    emoji: "📊",
    q: "MAGNUM 8K/200K — StreamsCharts 28,545 пик, 8K онлайна — твой вклад?",
    options: [
      { label: "Слушаю на пиратке, без пресейва", points: -42, hint: "−42" },
      { label: "Пресейв на Яндекс.Музыке + шарю друзьям", points: 42, hint: "+42 пресейв" },
      { label: "Стримлю 200K часов вместе с комьюнити", points: 42, hint: "8K/200K легенда" },
      { label: "Не слушаю MAGNUM", points: -142, hint: "−142" },
    ],
  },
  {
    id: 7,
    emoji: "🔒",
    q: "VPN — релиз 28.04, CLAY 73 — твой сетап?",
    options: [
      { label: "VPN 28.04 — качаю, шарю, стримлю", points: 42, hint: "+42" },
      { label: "CLAY 73 — знаю трек, подпеваю", points: 42, hint: "CLAY73 +42" },
      { label: "Не слышал про VPN/CLAY", points: -42, hint: "Послушай" },
      { label: "Скачал VPN через торрент", points: -10, hint: "Поддержи релиз" },
    ],
  },
  {
    id: 8,
    emoji: "🎤",
    q: "NOVA 80/XXL86 — NOVA 80, XXL86 — твой мув?",
    options: [
      { label: "NOVA 80/86 — в плейлисте, на повторе", points: 42, hint: "NOVA +42" },
      { label: "Кидаю мусор в тайге, слушаю NOVA", points: -142, hint: "Дисонанс" },
      { label: "Чищу лес под NOVA 80 на репите", points: 42, hint: "Вайб +42" },
      { label: "Не знаю NOVA", points: -5, hint: "Чекни" },
    ],
  },
];


function getRank(score: number): { title: string; emoji: string; cls: string; desc: string } {
  if (score >= 200) return { title: "ЭкоЛегенда", emoji: "🌿👑", cls: styles.rankLegend, desc: "Ты — дух тайги. Лес гуще, Томь чище. MAGNUM гордится." };
  if (score >= 100) return { title: "Братуха", emoji: "🤝", cls: styles.rankBrat, desc: "Крепкий братуха. Ещё чуть-чуть до легенды — жми!" };
  return { title: "Нормис", emoji: "😐", cls: styles.rankNormis, desc: "Пока нормис. Пора менять батилки и идти в лес." };
}

// Сервер отдаёт player/username + created_at; приводим к форме строки таблицы,
// иначе ник и дата рендерятся пустыми.
type RawLeaderRow = Partial<LeaderEntry> & { player?: string; username?: string; created_at?: string };
function normalizeLeaderRow(r: RawLeaderRow): LeaderEntry {
  const created = r.created_at ? new Date(r.created_at) : null;
  return {
    name: String(r.name ?? r.player ?? r.username ?? "Братуха"),
    score: Number(r.score ?? 0),
    rank: String(r.rank ?? "pending"),
    date: r.date ?? (created && !Number.isNaN(created.getTime())
      ? created.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
      : ""),
    avatar: r.avatar ?? null,
    verified: Boolean(r.verified),
    frame: r.frame ?? null,
    banner: r.banner ?? null,
    title: r.title ?? null,
  };
}
async function fetchLeaderboard(): Promise<LeaderEntry[]> {
  try {
    const res = await fetch("/magnum/api/eco/leaderboard", { credentials: "include" });
    if (!res.ok) return [];
    const data = await res.json() as { leaderboard?: RawLeaderRow[]; entries?: RawLeaderRow[] } | RawLeaderRow[];
    const raw = Array.isArray(data)
      ? data
      : Array.isArray((data as { leaderboard?: unknown }).leaderboard) ? (data as { leaderboard: RawLeaderRow[] }).leaderboard
      : Array.isArray((data as { entries?: unknown }).entries) ? (data as { entries: RawLeaderRow[] }).entries
      : [];
    return raw.map(normalizeLeaderRow);
  } catch { return []; }
}
async function submitEcoResult(entry: LeaderEntry & { score: number }): Promise<boolean> {
  try {
    const res = await fetch("/magnum/api/eco/submit", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry) });
    return res.ok;
  } catch { return false; }
}
// ── LS guards HYPE ECO FREEZE 42 — SPEC-42 §eco ──
const LS_FREEZE = "magnum-eco-freeze-used"; // value = weekId YYYY-Www, 1/неделю guard
const LS_SHARE = "magnum-share-claimed"; // value = "1" once +42 via POST /magnum/api/coins/add
function getLsFreezeWeek(): string | null { try { return localStorage.getItem(LS_FREEZE); } catch { return null; } }
function setLsFreezeWeek(weekId: string) { try { localStorage.setItem(LS_FREEZE, weekId); } catch {} }
function isShareClaimed(): boolean { try { return localStorage.getItem(LS_SHARE) === "1"; } catch { return false; } }
function setShareClaimed() { try { localStorage.setItem(LS_SHARE, "1"); } catch {} }
function weekIdNow(): string {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - jan1.getTime()) / 86400000);
  const w = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(w).padStart(2, "0")}`;
}
async function fetchChallenge(): Promise<ChallengeState | null> {
  try { const r = await fetch("/magnum/api/eco/challenge", { credentials: "include" }); if (!r.ok) return null; return await r.json() as ChallengeState; } catch { return null; }
}

export function EcoPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const resultRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const shareCanvasRef = useRef<HTMLCanvasElement>(null);

  const [answers, setAnswers] = useState<(number | null)[]>(() => Array(QUESTIONS.length).fill(null));
  const [showResult, setShowResult] = useState(false);
  const [nickname, setNickname] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [savedScore, setSavedScore] = useState<number | null>(null);
  const [ecoTiers, setEcoTiers] = useState<EcoTierFront[]>([]);
  const [ecoTop, setEcoTop] = useState<EcoTopRow[]>([]);
  const [ratingMsg, setRatingMsg] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<ChallengeState | null>(null);
  const [freezeMsg, setFreezeMsg] = useState<string | null>(null);
  const [shareBonus, setShareBonus] = useState<string | null>(null);
  const [shareModal, setShareModal] = useState(false);
  const [sharePreviewUrl, setSharePreviewUrl] = useState<string | null>(null);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);

  const answeredCount = useMemo(() => answers.filter((a) => a !== null).length, [answers]);
  const progress = Math.round((answeredCount / QUESTIONS.length) * 100);
  const score: number = useMemo(() => answers.reduce<number>((acc, ansIdx, qIdx) => ansIdx === null ? acc : acc + QUESTIONS[qIdx]!.options[ansIdx as number]!.points, 0), [answers]);
  const rank = useMemo(() => getRank(score as number), [score]);
  const allAnswered = answeredCount === QUESTIONS.length;
  const correctCount = useMemo(() => answers.reduce<number>((c, a, i) => a !== null && QUESTIONS[i]!.options[a as number]!.points > 0 ? c + 1 : c, 0), [answers]);
  const isBoss = correctCount === 8 && allAnswered;

  useEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      const cards = cardsRef.current.filter(Boolean) as HTMLElement[];
      const headerEls = rootRef.current!.querySelectorAll(`.${styles.header} > *`);
      if (prefersReduced()) {
        gsap.set(cards, { y: 0, opacity: 1, scale: 1, clearProps: "transform" });
        gsap.set(headerEls, { y: 0, opacity: 1, clearProps: "transform" });
        return;
      }
      gsap.set(headerEls, { y: 18, opacity: 0 });
      gsap.to(headerEls, { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: "power3.out" });
      gsap.set(cards, { y: 18, opacity: 0, scale: 0.97 });
      ScrollTrigger.batch(cards, {
        onEnter: (batch) => gsap.to(batch, { y: 0, opacity: 1, scale: 1, duration: 0.5, stagger: 0.1, ease: "back.out(1.4)", overwrite: "auto" }),
        start: "top 92%", once: true,
      });
      gsap.to(cards.slice(0, 3), { y: 0, opacity: 1, scale: 1, duration: 0.5, stagger: 0.1, ease: "back.out(1.4)", delay: 0.2, overwrite: "auto" });
      // conic-forest badge spring
      gsap.fromTo(`.${styles.badge}`, { backgroundPosition: "0% 50%" }, { backgroundPosition: "200% 50%", duration: 2.5, repeat: -1, ease: "none" });
      gsap.fromTo(`.${styles.progressFill}`, { backgroundPosition: "0% 50%" }, { backgroundPosition: "200% 50%", duration: 2, repeat: -1, ease: "none" });
      const cleanups: Array<() => void> = [];
      cards.forEach((card) => {
        const onEnter = () => { if (prefersReduced()) return; gsap.to(card, { y: -4, boxShadow: "0 12px 36px rgba(0,0,0,0.4), 0 0 22px rgba(34,197,94,0.20), 0 0 28px rgba(74,222,128,0.14)", borderColor: "rgba(34,197,94,0.38)", duration: 0.28, ease: "power2.out", overwrite: "auto" }); };
        const onLeave = () => { gsap.to(card, { y: 0, boxShadow: "0 0 0 transparent", borderColor: "rgba(255,255,255,0.06)", duration: 0.4, ease: "power2.out", overwrite: "auto" }); };
        card.addEventListener("mouseenter", onEnter); card.addEventListener("mouseleave", onLeave);
        cleanups.push(() => { card.removeEventListener("mouseenter", onEnter); card.removeEventListener("mouseleave", onLeave); });
      });
      (rootRef.current as unknown as { _ecoCleanups?: () => void })._ecoCleanups = () => cleanups.forEach((fn) => fn());
    }, rootRef);
    return () => { try { (rootRef.current as unknown as { _ecoCleanups?: () => void })?._ecoCleanups?.(); } catch {} ctx.revert(); };
  }, []);
  useEffect(() => { if (progressRef.current) gsap.to(progressRef.current, { width: `${progress}%`, duration: 0.6, ease: "power3.out" }); }, [progress]);
  useEffect(() => {
    if (!showResult || !resultRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(resultRef.current, { scale: 0.9, opacity: 0, y: 18, duration: 0.6, ease: "back.out(1.7)" });
      gsap.from(`.${styles.badgePop}`, { scale: 0, rotation: -12, duration: 0.7, ease: "elastic.out(1,0.5)", delay: 0.25 });
      gsap.from(`.${styles.shareBtn}`, { y: 12, opacity: 0, duration: 0.5, delay: 0.45 });
    }, resultRef);
    return () => ctx.revert();
  }, [showResult]);
  useEffect(() => {
    if (!boardRef.current) return;
    const rows = boardRef.current.querySelectorAll(`.${styles.boardRow}`);
    if (rows.length === 0) return;
    gsap.set(rows, { x: -16, opacity: 0 });
    gsap.to(rows, { x: 0, opacity: 1, duration: 0.45, stagger: 0.06, ease: "power2.out", delay: 0.1 });
  }, [leaderboard, showResult]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await fetchLeaderboard(); if (!cancelled) setLeaderboard(list);
      try {
        const rt = await fetch("/magnum/api/eco/tiers", { credentials: "include" });
        if (rt.ok) { const d = await rt.json() as { tiers: EcoTierFront[] }; if (Array.isArray(d.tiers)) setEcoTiers(d.tiers); }
        const rr = await fetch("/magnum/api/eco/rating", { credentials: "include" });
        if (rr.ok) { const d2 = await rr.json() as { top: EcoTopRow[] }; if (Array.isArray(d2.top)) setEcoTop(d2.top.slice(0, 10)); }
        const ch = await fetchChallenge(); if (!cancelled && ch) setChallenge(ch); else if (!cancelled) setChallenge({ weekId: weekIdNow(), streak: 0, freezeUsed: false, canFreeze: true, streakDays: [] });
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const selectAnswer = (qIdx: number, oIdx: number) => {
    setAnswers((prev) => { const next = [...prev]; next[qIdx] = oIdx; return next; });
    const el = cardsRef.current[qIdx]; if (el) gsap.fromTo(el, { scale: 1 }, { scale: 1.015, duration: 0.12, yoyo: true, repeat: 1, ease: "power2.inOut" });
  };
  const handleShowResult = () => {
    if (!allAnswered) { setToast("Ответь на все 8 вопросов, братуха!"); window.setTimeout(() => setToast(null), 2800); return; }
    setShowResult(true); setSavedScore(score);
    window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  };
  const handleSaveToBoard = async () => {
    const name = (nickname.trim() || "Аноним 42").slice(0, 18);
    const entry: LeaderEntry = { name, score, rank: rank.title, date: new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }) };
    const ok = await submitEcoResult(entry);
    if (!ok) {
      setToast("Не удалось сохранить — войди, братуха (401)");
      setBoardError("Результат не сохранён: нужен вход. В топе только результаты аккаунтов.");
      window.setTimeout(() => setToast(null), 3000);
      return;
    }
    try {
      const claimRes = await fetch("/magnum/api/eco/challenge/claim", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ score, answers: answers.map(a => a ?? 0), boss: isBoss }) });
      if (claimRes.ok) {
        const cj = await claimRes.json() as { coins?: number; streak?: number; weekId?: string; alreadyClaimed?: boolean };
        if (cj.coins) setClaimMsg(`+${cj.coins} монет • стрик ${cj.streak ?? "?"} • ${weekIdNow()}`);
        else if (cj.alreadyClaimed) setClaimMsg("Сегодня уже получал — завтра +42/142/420");
        window.setTimeout(() => setClaimMsg(null), 4000);
        const ch = await fetchChallenge(); if (ch) setChallenge(ch);
      }
      await fetch("/magnum/api/eco/rating", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ score, answers: answers.map(a => a ?? 0), player: name }) });
      const rr = await fetch("/magnum/api/eco/rating", { credentials: "include" });
      if (rr.ok) { const d2 = await rr.json() as { top: EcoTopRow[] }; if (Array.isArray(d2.top)) setEcoTop(d2.top.slice(0, 10)); }
      const cur = ecoTiers.find(t => score >= t.minScore && score <= t.maxScore);
      if (cur && cur.rating >= 7) setRatingMsg(`Рейтинг ${cur.rating}/10 — ${cur.tier} +${cur.rating===10?142:cur.rating>=9?84:42} монет`);
      else if (cur) setRatingMsg(`Рейтинг ${cur.rating}/10 — ${cur.tier}`);
      window.setTimeout(() => setRatingMsg(null), 4000);
    } catch {}
    // Никаких локальных подмешиваний: в таблице только то, что реально лежит на сервере.
    const list = await fetchLeaderboard();
    setLeaderboard(list);
    setBoardError(list.length === 0 ? "Топ не загрузился — обнови страницу" : null);
    setToast(`Сохранено! Ты в топе, ${name} — ${score} баллов`);
    window.setTimeout(() => setToast(null), 3000);
  };
  const handleFreeze = async () => {
    const wk = weekIdNow();
    // LS guard 1/неделю — мгновенный 429 без запроса
    const lsWeek = getLsFreezeWeek();
    if (lsWeek === wk) { setFreezeMsg("❄️ Уже заморожено на эту неделю (LS guard)"); window.setTimeout(() => setFreezeMsg(null), 3500); return; }
    if (challenge?.freezeUsed) { setFreezeMsg("❄️ Уже заморожено на эту неделю"); window.setTimeout(() => setFreezeMsg(null), 3500); return; }
    try {
      const r = await fetch("/magnum/api/eco/challenge/freeze", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } });
      const j = await r.json() as { ok?: boolean; error?: string; weekId?: string };
      if (r.ok && j.ok) { setLsFreezeWeek(j.weekId || wk); setFreezeMsg(`❄️ Заморозка активирована • ${j.weekId || wk} • -420 монет`); const ch = await fetchChallenge(); if (ch) setChallenge(ch); }
      else if (r.status === 429 || r.status === 409) { setLsFreezeWeek(wk); setFreezeMsg(j.error || "❄️ Уже использовано 1/неделю"); }
      else setFreezeMsg(j.error || "Не удалось заморозить");
      window.setTimeout(() => setFreezeMsg(null), 3500);
    } catch { setFreezeMsg("Ошибка сети"); window.setTimeout(() => setFreezeMsg(null), 3000); }
  };
  const handleShareOG = async () => {
    // LS 1× guard — magnum-share-claimed
    if (isShareClaimed()) { setShareBonus("Шаринг уже claimed 1× — +42 получено"); window.setTimeout(() => setShareBonus(null), 3000); setShareModal(true); return; }
    const canvas = shareCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    canvas.width = 1080; canvas.height = 1080;
    // forest gradient
    const g = ctx.createLinearGradient(0, 0, 1080, 1080);
    g.addColorStop(0, "#0a1f0a"); g.addColorStop(0.5, "#143d14"); g.addColorStop(1, "#1a4a2a");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1080);
    // conic forest badge
    const cg = ctx.createConicGradient(0, 540, 540);
    cg.addColorStop(0, "rgba(34,197,94,0.45)"); cg.addColorStop(0.5, "rgba(74,222,128,0.30)"); cg.addColorStop(1, "rgba(34,197,94,0.45)");
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(540, 420, 180, 0, Math.PI * 2); ctx.fill();
    // trees silhouette
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    for (let i = 0; i < 5; i++) { const x = 280 + i * 130; ctx.beginPath(); ctx.moveTo(x, 620); ctx.lineTo(x + 40, 480); ctx.lineTo(x + 80, 620); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = "#fff"; ctx.font = "900 72px Inter, sans-serif"; ctx.textAlign = "center"; ctx.fillText("ECO LES 42", 540, 380);
    ctx.font = "700 42px Inter, sans-serif"; ctx.fillStyle = "#4ade80"; ctx.fillText(`${rank.title} ${rank.emoji}`, 540, 470);
    ctx.font = "900 96px Inter, sans-serif"; ctx.fillStyle = "#fff"; ctx.fillText(`${score} баллов`, 540, 580);
    ctx.font = "600 28px Inter, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fillText(`${correctCount}/8 верно • ${isBoss ? "БОСС 8/8" : "LES 42"} • Кузбасс 4817,5к га • Томь 827км`, 540, 640);
    ctx.font = "600 26px Inter, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fillText(`Bio-вахта ${challenge?.streak ?? 0}/7 • ${weekIdNow()} • /magnum/eco`, 540, 700);
    ctx.strokeStyle = "rgba(34,197,94,0.45)"; ctx.lineWidth = 6; ctx.strokeRect(20, 20, 1040, 1040);
    try {
      const blob: Blob | null = await new Promise(res => canvas.toBlob(r => res(r), "image/png"));
      if (!blob) throw new Error("no blob");
      const file = new File([blob], "eco-les-42-1080.png", { type: "image/png" });
      // preview for modal
      try { const url = URL.createObjectURL(blob); setSharePreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; }); setShareModal(true); } catch {}
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: `ECO LES 42 — ${score} баллов`, text: `ECO LES 42 — ${rank.title} ${score} баллов • bio-вахта 7дн • /magnum/eco`, files: [file] });
      } else if (navigator.clipboard) {
        const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "eco-les-42-1080.png"; a.click(); URL.revokeObjectURL(url);
      }
      // SPEC: +42 via POST /magnum/api/coins/add with LS magnum-share-claimed 1× + server /eco/share
      try {
        const sr = await fetch("/magnum/api/eco/share", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ score }) });
        if (sr.ok) {
          const sj = await sr.json() as { coins?: number }; setShareClaimed(); setShareBonus(`+${sj.coins ?? 42} монет за шаринг 1080×1080`);
        } else if (sr.status === 429 || sr.status === 409) {
          setShareClaimed(); setShareBonus("Шаринг уже учтён 1× — +42 уже получено");
        } else {
          // fallback via coins/add as per task spec
          const cr = await fetch("/magnum/api/coins/add", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: 42 }) });
          if (cr.ok) { setShareClaimed(); setShareBonus("+42 монеты за шаринг 1080×1080"); }
          else setShareBonus("Шаринг 1080×1080 готов — сохрани картинку");
        }
        window.setTimeout(() => setShareBonus(null), 3500);
      } catch { setShareBonus("Шаринг 1080×1080 готов — сохрани картинку"); window.setTimeout(() => setShareBonus(null), 3000); }
    } catch {
      const url = canvas.toDataURL("image/png"); const a = document.createElement("a"); a.href = url; a.download = "eco-les-42-1080.png"; a.click();
    }
  };
  const handleCopyPresave = async () => {
    try { await navigator.clipboard.writeText(PRESAVE_URL); setCopied(true); window.setTimeout(() => setCopied(false), 2500); } catch { window.open(PRESAVE_URL, "_blank"); }
  };
  const handleReset = () => {
    setAnswers(Array(QUESTIONS.length).fill(null)); setShowResult(false); setToast(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => { gsap.set(cardsRef.current, { y: 18, opacity: 0 }); gsap.to(cardsRef.current, { y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: "power2.out" }); }, 200);
  };
  return (
    <div className={styles.page} ref={rootRef}>
      <GuestGate action="сохранять эко-результат в рейтинг" />
      <header className={styles.header}>
        <span className={styles.badge} style={{ background: "conic-gradient(from 0deg at 50% 50%, #22c55e 0%, #16a34a 35%, #4ade80 70%, #15803d 100%)", WebkitBackgroundClip: "text", borderImage: "conic-gradient(from 0deg, #22c55e, #16a34a, #4ade80) 1" }}>ECO LES 42 • Лес • Тайга • Кузбасс • Bio-вахта 7дн</span>
        <h1 className={styles.title}>ECO LES 42</h1>
        <p className={styles.subtitle}>8 вопросов: Лес 4817,5 тыс га/Тайга Алатау+Салаир/Томь 827км/Кузбасс 95,7k км² 86,6% 190M угля + 42+MAGNUM 8K/200K VPN 28.04 CLAY73 NOVA80/XXL86. Bio-вахта 7дн, freeze 420, OG 1080×1080 +42.</p>
        {savedScore !== null && !showResult && <div className={styles.savedHint}>Последний результат: {savedScore} баллов • пройди снова чтобы обновить</div>}
        <a href={PRESAVE_URL} target="_blank" rel="noopener noreferrer" onClick={() => { try { fetch("/magnum/api/presave/click", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: PRESAVE_URL }) }); } catch {} }} style={{ display: "inline-flex", marginTop: 14, padding: "10px 18px", borderRadius: 999, background: "linear-gradient(90deg,#22c55e,#16a34a)", color: "#fff", fontWeight: 900, fontSize: 13, letterSpacing: "0.04em", textTransform: "uppercase", textDecoration: "none", boxShadow: "0 0 18px rgba(34,197,94,0.35)" }}>🎧 Пресейв MAGNUM 42 →</a>
      </header>

      {/* bio-вахта 7дн + freeze */}
      <div style={{ maxWidth: 640, margin: "0 auto 18px", padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(34,197,94,0.25)", background: "rgba(34,197,94,0.06)", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <span key={i} style={{ width: 28, height: 28, borderRadius: 999, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800, border: `1px solid ${i < (challenge?.streak ?? 0) ? "#22c55e" : "rgba(255,255,255,0.14)"}`, background: i < (challenge?.streak ?? 0) ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.04)", color: i < (challenge?.streak ?? 0) ? "#22c55e" : "rgba(255,255,255,0.5)" }}>{i < (challenge?.streak ?? 0) ? "✓" : i + 1}</span>
          ))}
          <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 800, color: "#4ade80" }}>{challenge?.weekId ?? weekIdNow()} • bio-вахта {challenge?.streak ?? 0}/7</span>
        </div>
        <button type="button" onClick={handleFreeze} disabled={challenge?.freezeUsed} style={{ padding: "8px 14px", borderRadius: 999, border: `1px solid ${challenge?.freezeUsed ? "rgba(255,255,255,0.12)" : "#22c55e"}`, background: challenge?.freezeUsed ? "rgba(255,255,255,0.04)" : "rgba(34,197,94,0.14)", color: challenge?.freezeUsed ? "rgba(255,255,255,0.4)" : "#22c55e", fontWeight: 800, fontSize: 12, cursor: challenge?.freezeUsed ? "not-allowed" : "pointer" }}>
          {challenge?.freezeUsed ? "❄️ Заморожено" : "❄️ Freeze 420 1×/нед"}
        </button>
      </div>
      {freezeMsg && <div style={{ maxWidth: 640, margin: "0 auto 10px", textAlign: "center", fontSize: 12, color: "#4ade80" }}>{freezeMsg}</div>}

      <div className={styles.progressWrap} aria-label={`Прогресс ${progress}%`}>
        <div className={styles.progressTrack}><div className={styles.progressFill} ref={progressRef} style={{ width: `${progress}%` }} /><div className={styles.progressShine} aria-hidden /></div>
        <div className={styles.progressMeta}><span className={styles.progressLabel}>{answeredCount}/8 вопросов</span><span className={styles.progressPct}>{progress}%</span></div>
      </div>
      {toast && <div className={styles.toast} role="status">{toast}</div>}
      <section className={styles.grid} aria-label="Вопросы теста">
        {QUESTIONS.map((q, qIdx) => (
          <div key={q.id} ref={(el) => { cardsRef.current[qIdx] = el; }} className={`${styles.card} ${answers[qIdx] !== null ? styles.cardDone : ""}`}>
            <div className={styles.cardHead}><span className={styles.cardEmoji}>{q.emoji}</span><span className={styles.cardNum}>#{q.id}</span><h3 className={styles.cardQ}>{q.q}</h3></div>
            <div className={styles.options}>
              {q.options.map((opt, oIdx) => {
                const active = answers[qIdx] === oIdx;
                return (
                  <button key={oIdx} type="button" onClick={() => selectAnswer(qIdx, oIdx)} className={`${styles.opt} ${active ? styles.optActive : ""} ${opt.points > 0 ? styles.optPos : opt.points < 0 ? styles.optNeg : ""}`}>
                    <span className={styles.optLabel}>{opt.label}</span>
                    <span className={styles.optMeta}><span className={styles.optHint}>{opt.hint}</span><span className={`${styles.optPts} ${opt.points > 0 ? styles.ptsPos : opt.points < 0 ? styles.ptsNeg : styles.ptsZero}`}>{opt.points > 0 ? `+${opt.points}` : `${opt.points}`}</span></span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>
      <div className={styles.actions}>
        <button type="button" className={styles.btnPrimary} onClick={handleShowResult} disabled={!allAnswered}>{allAnswered ? "Узнать ранг →" : `Ответь ещё ${QUESTIONS.length - answeredCount}`}</button>
        <button type="button" className={styles.btnGhost} onClick={handleReset}>Сбросить</button>
      </div>
      {showResult && (
        <section className={styles.result} ref={resultRef} aria-live="polite">
          <div className={`${styles.badgePop} ${rank.cls}`} style={{ background: isBoss ? "conic-gradient(from 0deg, #22c55e, #4ade80, #16a34a)" : undefined, color: isBoss ? "#0a0a0a" : undefined, borderColor: isBoss ? "#22c55e" : undefined }}><span className={styles.badgeEmoji}>{rank.emoji}</span><span className={styles.badgeTitle}>{rank.title}{isBoss ? " • БОСС 8/8" : ""}</span></div>
          <div className={styles.scoreRow}><span className={styles.scoreNum}>{score}</span><span className={styles.scoreLbl}>баллов</span></div>
          <p className={styles.rankDesc}>{rank.desc}</p>
          <div className={styles.rankScale}>
            <div className={`${styles.scaleSeg} ${score <= 99 ? styles.segActive : ""}`}><span>Нормис</span><small>0–99</small></div>
            <div className={`${styles.scaleSeg} ${score >= 100 && score <= 199 ? styles.segActive : ""}`}><span>Братуха</span><small>100–199</small></div>
            <div className={`${styles.scaleSeg} ${score >= 200 ? styles.segActive : ""}`}><span>ЭкоЛегенда</span><small>200+</small></div>
          </div>
          {claimMsg && <p style={{ fontSize: 13, color: "#22c55e", fontWeight: 800 }}>{claimMsg}</p>}
          <div className={styles.saveRow}><input className={styles.nickInput} placeholder="Твой ник для топа (Аноним 42)" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={18} /><button type="button" className={styles.btnSave} onClick={handleSaveToBoard}>Сохранить в топ</button></div>
          <button type="button" className={styles.shareBtn} onClick={handleShareOG}>📤 Шаринг 1080×1080 +42</button>
          <canvas ref={shareCanvasRef} width={1080} height={1080} style={{ display: "none" }} aria-hidden />
          {shareBonus && <p style={{ marginTop: 8, fontSize: 12, color: "#4ade80" }}>{shareBonus}</p>}
          {ratingMsg && <p style={{ marginTop: 10, fontSize: 13, color: "#ffd700", textAlign: "center" }}>{ratingMsg}</p>}
          <p className={styles.shareHint}>OG canvas 1080×1080 • Web Share API • +42 за шаринг • bio-вахта 7дн</p>
          <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <a href={PRESAVE_URL} target="_blank" rel="noopener noreferrer" style={{ padding: "10px 18px", borderRadius: 12, background: "#1a1a1a", border: "1px solid #22c55e", color: "#22c55e", fontWeight: 800, fontSize: 13, textDecoration: "none" }}>🎧 Пресейв MAGNUM</a>
            <button type="button" onClick={handleCopyPresave} style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.35)", color: "#4ade80", fontWeight: 700, fontSize: 12 }}>{copied ? "✓ Скопировано" : "Копировать ссылку"}</button>
          </div>
          {ecoTiers.length > 0 && (
            <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
              {ecoTiers.map(t => {
                const active = score >= t.minScore && score <= t.maxScore;
                return <span key={t.rating} onMouseEnter={e => { if (prefersReduced()) return; import("gsap").then(({ default: gsap }) => { gsap.to(e.currentTarget, { y: -3, scale: 1.04, boxShadow: `0 0 14px ${t.color}66`, duration: 0.22, ease: "power2.out", overwrite: true }); }); }} onMouseLeave={e => { if (prefersReduced()) return; import("gsap").then(({ default: gsap }) => { gsap.to(e.currentTarget, { y: 0, scale: 1, boxShadow: "0 0 0 transparent", duration: 0.3, overwrite: true }); }); }} style={{ fontSize: 11, padding: "5px 8px", borderRadius: 999, border: active ? `1px solid ${t.color}` : "1px solid rgba(255,255,255,.10)", background: active ? `${t.color}22` : "rgba(255,255,255,.06)", color: active ? t.color : "rgba(255,255,255,.7)", fontWeight: active ? 700 : 400 }} title={`${t.tier} ${t.minScore}..${t.maxScore} — ${t.desc}`}>{t.badge} {t.rating} {t.tier}</span>;
              })}
            </div>
          )}
        </section>
      )}
      <section className={styles.board} ref={boardRef} aria-label="Топ-10 Эко-рейтинга">
        <h2 className={styles.boardTitle}>🏆 Топ-10 ЭкоЛегенд Кузбасса <span className={styles.boardSub}>magnum/api/eco/leaderboard</span></h2>
        {ecoTop.length > 0 && (
          <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 12, background: "rgba(34,197,94,.07)", border: "1px solid rgba(34,197,94,.18)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", marginBottom: 6 }}>⭐ Рейтинг 0-10 Лес • топ по tiers</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {ecoTop.map((r, i) => (
                <div key={`${r.player}-${i}`} style={{ display: "flex", gap: 8, fontSize: 12, alignItems: "center", ...cosmeticBannerStyle(r.banner) }}>
                  <span style={{ minWidth: 18, color: i < 3 ? "#4ade80" : "rgba(255,255,255,.6)" }}>{i + 1}</span>
                  <span style={{ flex: 1, color: "#fff", minWidth: 0 }}>
                    <CosmeticIdentity username={r.player} avatar={r.avatar} frame={r.frame} title={r.title} size={20} />
                  </span>
                  <span style={{ padding: "2px 6px", borderRadius: 999, background: "rgba(255,255,255,.08)", fontSize: 11 }}>{r.rating}/10 {r.tier}</span>
                  <span style={{ color: r.score > 0 ? "#22c55e" : "#ff6b6b" }}>{r.score > 0 ? `+${r.score}` : r.score}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {boardError && <p className={styles.boardEmpty} role="status">{boardError}</p>}
        {leaderboard.length === 0 ? <p className={styles.boardEmpty}>Пока пусто — стань первым ЭкоЛегендой! Пройди тест и сохрани результат.</p> : (
          <div className={styles.boardList}>
            {leaderboard.map((e, i) => (
              <div key={`${e.name}-${e.date}-${i}`} className={`${styles.boardRow} ${i < 3 ? styles.boardTop : ""}`} style={cosmeticBannerStyle(e.banner)}>
                <span className={styles.boardPos}>{i + 1}</span>
                <span className={styles.boardName}>
                  <CosmeticIdentity username={e.name} avatar={e.avatar} frame={e.frame} title={e.title} verified={e.verified} size={24} />
                </span>
                <span className={styles.boardRank}>{e.rank}</span><span className={styles.boardScore}>{e.score > 0 ? `+${e.score}` : e.score}</span><span className={styles.boardDate}>{e.date}</span>
              </div>
            ))}
          </div>
        )}
        <p className={styles.boardFoot}>Топ с сервера • Сортировка по баллам • 42/142/420 1×/сутки +1420 босс 8/8 • Freeze 420 1×/нед • bio-вахта 7дн</p>
      </section>
      {shareModal && (
        <div onClick={() => setShareModal(false)} style={{ position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "min(420px, 92vw)", background: "#0f1f0f", border: "1px solid rgba(34,197,94,0.35)", borderRadius: 18, padding: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 28px rgba(34,197,94,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontWeight: 900, color: "#4ade80", fontSize: 14 }}>SHARE OG 1080</span>
              <button onClick={() => setShareModal(false)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", borderRadius: 999, width: 28, height: 28, cursor: "pointer" }}>X</button>
            </div>
            {sharePreviewUrl ? <img src={sharePreviewUrl} alt="OG 1080 preview" style={{ width: "100%", aspectRatio: "1", borderRadius: 12, border: "1px solid rgba(34,197,94,0.25)", background: "#0a1f0a" }} /> : <div style={{ width: "100%", aspectRatio: "1", borderRadius: 12, background: "linear-gradient(135deg,#0a1f0a,#143d14)", border: "1px solid rgba(34,197,94,0.25)", display: "grid", placeItems: "center", color: "#4ade80", fontWeight: 800 }}>ECO LES 42</div>}
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "rgba(255,255,255,0.7)", textAlign: "center" }}>Gradient + stats + conic badge • Web Share API • +42 once</p>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={async () => { if (isShareClaimed()) { setShareBonus("Already 1x"); setShareModal(false); return; } try { const r = await fetch("/magnum/api/coins/add", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: 42 }) }); if (r.ok) { setShareClaimed(); setShareBonus("+42 share 1080"); } } catch {} setShareModal(false); }} style={{ flex: 1, padding: "10px 14px", borderRadius: 12, background: "linear-gradient(90deg,#22c55e,#16a34a)", color: "#fff", border: "none", fontWeight: 800, cursor: "pointer" }}>{isShareClaimed() ? "Already +42" : "Claim +42"}</button>
              <button onClick={() => { if (sharePreviewUrl) { const a = document.createElement("a"); a.href = sharePreviewUrl; a.download = "eco-les-42-1080.png"; a.click(); } }} style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Download 1080</button>
            </div>
          </div>
        </div>
      )}
      <footer className={styles.footer}><p>Сделано в Кемерово с любовью к тайге и Сосновому бору • MAGNUM 42 — Лес 4817,5к га • Тайга Алатау • Томь 827км • Кузбасс 95,7k км² 🌲 • OG 1080×1080 • <a href={PRESAVE_URL} target="_blank" rel="noopener noreferrer" style={{ color: "#4ade80" }}>Пресейв MAGNUM 42</a></p></footer>
    </div>
  );
}
export default EcoPage;
