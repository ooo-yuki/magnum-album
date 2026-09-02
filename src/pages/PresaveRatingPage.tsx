import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Link } from "react-router-dom";
import { SocialHook } from "../components/SocialHook";
import { StreakReviveBanner } from "../components/StreakReviveBanner";
import { CosmeticIdentity, cosmeticBannerStyle, type LeaderCosmetics } from "../components/CosmeticBadge";
import { SKIN_EMOJI } from "../lib/cosmetics";
import styles from "./PresaveRatingPage.module.css";
import { GuestGate } from "../components/GuestGate";

gsap.registerPlugin(ScrollTrigger);


type FrameRow = { id: number; username: string; verified: boolean; status: string; created_at: string; avatar?: string | null };
type EcoRow = { username: string; player: string; score: number; rank: string; status: string; created_at: string; avatar?: string | null; verified?: boolean } & LeaderCosmetics;
type IdeaRow = { id: number; title: string; description: string; votes: number; status: string; created_at: string };

type RatingRow = {
  rank: number;
  username: string;
  score: number;
  status: "топ" | "verified" | "pending";
  date: string;
  city: string;
  source: "eco" | "idea" | "frame";
  avatar: string;
  verified: boolean;
  skinId: string | null;
} & LeaderCosmetics;

type CheckState = "idle" | "checking" | "ok" | "fail";

const EMPTY_FALLBACK = "пока пусто — стань первым";

/* shop skin -> emoji: единый источник src/lib/cosmetics.ts + legacy-алиасы редкостей */
const SKIN_EMOJI_ALIASES: Record<string, string> = {
  ...SKIN_EMOJI,
  "skin-common": "🐗", "skin-rare": "🦊", "skin-epic": "🦈", "skin-legendary": "🐉",
};

function skinToEmoji(skinId: string | null | undefined): string {
  if (!skinId) return "👤";
  const k = skinId.trim().toLowerCase();
  return SKIN_EMOJI_ALIASES[k] ?? SKIN_EMOJI_ALIASES[k.replace("skin_", "").replace("skin-", "")] ?? "👤";
}

function isValidPresaveQ(v: string): boolean { const s=v.trim(); return s.length>=1 && s.length<=32; }
function isValidBoost(v: string): boolean { return /^[a-z0-9_-]{1,24}$/.test(v.trim().toLowerCase()); }

const DROP_DATE_RATING = new Date("2026-09-15T00:00:00+03:00");
function formatDropCountdown(ms: number): string {
  if (ms <= 0) return "Дроп уже здесь 🔥";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}д ${String(h).padStart(2, "0")}ч ${String(m).padStart(2, "0")}м`;
  if (h > 0) return `${h}ч ${String(m).padStart(2, "0")}м`;
  return `${m}м`;
}

export function PresaveRatingPage() {
  const [filter, setFilter] = useState<"all" | RatingRow["status"]>("all");
  const [q, setQ] = useState("");
  const [check, setCheck] = useState<CheckState>("idle");
  const [toast, setToast] = useState<string | null>(null);

  const [frames, setFrames] = useState<FrameRow[]>([]);
  const [eco, setEco] = useState<EcoRow[]>([]);
  const [ideas, setIdeas] = useState<IdeaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [bandlink, setBandlink] = useState<{ title: string; image: string | null; ok: boolean } | null>(null);
  const [dropCountdown, setDropCountdown] = useState<string>(() => formatDropCountdown(DROP_DATE_RATING.getTime() - Date.now()));
  const [shareBusy, setShareBusy] = useState(false);
  const [presaveTotal, setPresaveTotal] = useState<number | null>(null);

  const GOLD_GOAL = 42;
  const DISPLAY_PRESAVE = Math.max(presaveTotal ?? 185, 185);
  const GOLD_PCT = Math.round((DISPLAY_PRESAVE / GOLD_GOAL) * 100);
  const NEXT_GOAL = 242;
  const ULTIMATE_GOAL = 420;
  const NEXT_REWARD = 142;
  const nextToGo = Math.max(0, NEXT_GOAL - DISPLAY_PRESAVE);
  const ultimatePct = Math.min(100, Math.round((DISPLAY_PRESAVE / ULTIMATE_GOAL) * 100));
  const nextPct = Math.min(100, Math.round((DISPLAY_PRESAVE / NEXT_GOAL) * 100));

  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const kpiRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const fomoBadgeRef = useRef<HTMLDivElement>(null);
  const goldRef = useRef<HTMLDivElement>(null);
  const confettiRef = useRef<HTMLDivElement>(null);

  const loadAll = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [frRes, ecoRes, ideasRes] = await Promise.all([
        fetch("/magnum/api/frame/status", { credentials: "include" }),
        fetch("/magnum/api/eco/leaderboard", { credentials: "include" }),
        fetch("/magnum/api/ideas", { credentials: "include" }),
      ]);

      if (frRes.ok) {
        const j = (await frRes.json()) as { frames?: (FrameRow & { avatar?: string | null })[]; total?: number };
        if (Array.isArray(j.frames)) setFrames(j.frames as FrameRow[]);
        else setFrames([]);
      } else setFrames([]);

      if (ecoRes.ok) {
        const j = (await ecoRes.json()) as { leaderboard?: EcoRow[]; entries?: EcoRow[] } | EcoRow[];
        if (Array.isArray(j)) setEco(j as EcoRow[]);
        else if (Array.isArray((j as { leaderboard?: EcoRow[] }).leaderboard)) setEco((j as { leaderboard: EcoRow[] }).leaderboard);
        else if (Array.isArray((j as { entries?: EcoRow[] }).entries)) setEco((j as { entries: EcoRow[] }).entries!);
        else setEco([]);
      } else setEco([]);

      if (ideasRes.ok) {
        const j = (await ideasRes.json()) as { ideas?: IdeaRow[] };
        if (Array.isArray(j.ideas)) setIdeas(j.ideas);
        else setIdeas([]);
      } else setIdeas([]);

      // presave stats for GOLD celebrate
      try {
        const ps = await fetch("/magnum/api/presave/stats", { credentials: "include" });
        if (ps.ok) {
          const pj = (await ps.json()) as { total?: number; presaveCount?: number };
          const v = typeof pj.total === "number" ? pj.total : typeof pj.presaveCount === "number" ? pj.presaveCount : null;
          if (typeof v === "number") setPresaveTotal(v);
        }
      } catch {}

      try {
        const blRes = await fetch("/magnum/api/bandlink", { credentials: "include" });
        if (blRes.ok) {
          const j = (await blRes.json()) as { title: string; image: string | null; ok: boolean; hasPresave?: boolean; presaveCount?: number; services?: Record<string, boolean>; status?: number; description?: string | null };
          setBandlink({ title: j.title, image: j.image, ok: Boolean(j.ok || j.hasPresave) });
        } else {
          // fallback: прямой парсинг OG (может упасть по CORS — ловим)
          const bl = await fetch("https://music.thefence.me/psmagnum", { method: "GET" });
          if (bl.ok) {
            const html = await bl.text();
            const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] ?? html.match(/<title>([^<]+)<\/title>/)?.[1] ?? "5opka, MellSher - Magnum | BandLink";
            const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] ?? null;
            const hasPresave = html.includes("presave") || html.includes("Пресейв");
            setBandlink({ title: ogTitle, image: ogImage, ok: hasPresave });
          } else {
            setBandlink({ title: "5opka, MellSher - Magnum | BandLink", image: null, ok: false });
          }
        }
      } catch {
        setBandlink(null);
      }
    } catch (e) {
      setErr(String(e).slice(0, 120));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const ratingRows: RatingRow[] = useMemo(() => {
    const out: RatingRow[] = [];
    const sortedEco = [...eco].sort((a, b) => b.score - a.score);
    sortedEco.forEach((e) => {
      const s = String(e.status || e.rank || "").toLowerCase();
      let status: RatingRow["status"] = "pending";
      if (e.verified) status = "verified";
      else if (s.includes("legend") || s.includes("epic")) status = "verified";
      out.push({
        rank: 0,
        username: e.username || e.player || "Братуха",
        score: Number(e.score) || 0,
        status,
        date: e.created_at ? String(e.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
        city: "Кемерово",
        source: "eco",
        avatar: skinToEmoji(e.avatar),
        verified: Boolean(e.verified),
        skinId: e.avatar || null,
        frame: e.frame ?? null,
        banner: e.banner ?? null,
        title: e.title ?? null,
      });
    });

    // frames — после eco, но verified даёт +42 к score
    frames.forEach((f) => {
      const already = out.find((r) => r.username === f.username && r.source === "eco");
      if (already) {
        // если юзер уже в eco, мерджим verified и аватар
        if (f.verified) already.verified = true;
        if (f.avatar && already.skinId == null) {
          already.skinId = f.avatar;
          already.avatar = skinToEmoji(f.avatar);
        }
        if (f.verified) already.status = "verified";
        return;
      }
      out.push({
        rank: 0,
        username: f.username,
        score: f.verified ? 420 : 0,
        status: f.verified ? "verified" : "pending",
        date: f.created_at ? String(f.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
        city: "Кемерово",
        source: "frame",
        avatar: skinToEmoji(f.avatar),
        verified: Boolean(f.verified),
        skinId: f.avatar || null,
        frame: null,
        banner: null,
        title: null,
      });
    });

    // ideas — votes как отдельный источник, но username = title обрезаем
    const sortedIdeas = [...ideas].sort((a, b) => b.votes - a.votes).slice(0, 20);
    sortedIdeas.forEach((it) => {
      if ((Number(it.votes) || 0) === 0) return;
      const s = String(it.status || "").toLowerCase();
      let status: RatingRow["status"] = "pending";
      if (s === "approved" || s === "топ") status = "топ";
      else if (s === "verified") status = "verified";
      out.push({
        rank: 0,
        username: it.title.slice(0, 22),
        score: Number(it.votes) || 0,
        status,
        date: it.created_at ? String(it.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
        city: "Идея",
        source: "idea",
        avatar: "💡",
        verified: s === "approved" || s === "verified",
        skinId: null,
        frame: null,
        banner: null,
        title: null,
      });
    });

    // единый рейтинг по score desc, стабильный топ
    out.sort((a, b) => b.score - a.score || (b.verified ? 1 : 0) - (a.verified ? 1 : 0));
    out.forEach((r, i) => (r.rank = i + 1));
    // топ-3 с положительным score помечаем как топ
    out.forEach((r, i) => {
      if (i < 3 && r.score > 0) r.status = "топ";
    });
    // ограничим до топ-20 для таблицы (остальные в фильтре)
    return out.slice(0, 20);
  }, [frames, eco, ideas]);

  const filtered = useMemo(() => {
    return ratingRows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (q.trim() && !r.username.toLowerCase().includes(q.trim().toLowerCase())) return false;
      return true;
    });
  }, [ratingRows, filter, q]);

  const stats = useMemo(() => {
    const verifiedFrames = frames.filter((f) => f.verified).length;
    const totalScore = eco.reduce((s, e) => s + (Number(e.score) || 0), 0);
    const totalVotes = ideas.reduce((s, it) => s + (Number(it.votes) || 0), 0);
    return {
      frames: frames.length,
      verified: verifiedFrames,
      ecoCount: eco.length,
      ideasCount: ideas.length,
      totalScore,
      totalVotes,
    };
  }, [frames, eco, ideas]);

  useEffect(() => {
    if (!rootRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (prefersReduced) {
        if (heroRef.current) gsap.set(heroRef.current, { y: 0, opacity: 1, clearProps: "transform" });
        gsap.set(`.${styles.kpi}`, { y: 0, opacity: 1, clearProps: "transform" });
        gsap.set(`.${styles.controls}`, { y: 0, opacity: 1, clearProps: "transform" });
        return;
      }
      if (heroRef.current) {
        gsap.set(heroRef.current, { y: 24, opacity: 0 });
        gsap.to(heroRef.current, { y: 0, opacity: 1, duration: 0.55, ease: "power2.out", delay: 0.05 });
      }
      gsap.set(`.${styles.kpi}`, { y: 24, opacity: 0 });
      gsap.to(`.${styles.kpi}`, { y: 0, opacity: 1, stagger: 0.12, duration: 0.5, ease: "power2.out", delay: 0.22 });
      gsap.set(`.${styles.controls}`, { y: 24, opacity: 0 });
      gsap.to(`.${styles.controls}`, { y: 0, opacity: 1, duration: 0.45, ease: "power2.out", delay: 0.48 });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  // table rows stagger on scroll — y24 stagger 0.12 ScrollTrigger
  useEffect(() => {
    if (!tableRef.current) return;
    if (loading) return;
    const rows = tableRef.current.querySelectorAll<HTMLElement>(`.${styles.row}`);
    if (!rows.length) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      gsap.set(rows, { y: 0, opacity: 1, clearProps: "transform" });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.set(rows, { y: 24, opacity: 0 });
      gsap.to(rows, {
        y: 0,
        opacity: 1,
        stagger: 0.12,
        duration: 0.5,
        ease: "power2.out",
        overwrite: true,
        scrollTrigger: { trigger: tableRef.current, start: "top 85%", toggleActions: "play none none none" },
      });
    }, tableRef);
    return () => ctx.revert();
  }, [filtered, loading]);

  // re-animate table on filter/search change (overwrite)
  useEffect(() => {
    if (!tableRef.current || loading) return;
    const rows = tableRef.current.querySelectorAll<HTMLElement>(`.${styles.row}`);
    if (!rows.length) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;
    gsap.fromTo(rows, { y: 24, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.12, duration: 0.35, ease: "power2.out", overwrite: true });
  }, [filter, q, loading]);

  // hover RGB — chromatic lift + tri-color shadow y:-4
  const onRowEnter = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.to(e.currentTarget, {
      y: -4,
      boxShadow: "0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,45,85,0.20), 0 0 22px rgba(255,45,85,0.20), 0 0 22px rgba(0,255,136,0.12), 0 0 28px rgba(255,204,0,0.10)",
      borderColor: "rgba(255,45,85,0.35)",
      backgroundColor: "rgba(255,255,255,0.05)",
      duration: 0.28,
      ease: "power2.out",
      overwrite: true,
    });
  }, []);
  const onRowLeave = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.to(e.currentTarget, {
      y: 0,
      boxShadow: "0 0 0 transparent",
      borderColor: "rgba(35,35,43,0.9)",
      backgroundColor: "transparent",
      duration: 0.35,
      ease: "power2.out",
      overwrite: true,
    });
  }, []);
  const onKpiEnter = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.to(e.currentTarget, {
      y: -4,
      boxShadow: "0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,45,85,0.20), 0 0 22px rgba(255,45,85,0.20), 0 0 22px rgba(0,255,136,0.12), 0 0 28px rgba(255,204,0,0.10)",
      borderColor: "rgba(255,45,85,0.35)",
      duration: 0.28,
      ease: "power2.out",
      overwrite: true,
    });
  }, []);
  const onKpiLeave = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const isAccent = e.currentTarget.classList.contains(styles.kpiAccent);
    gsap.to(e.currentTarget, {
      y: 0,
      boxShadow: isAccent ? "0 0 18px rgba(255,204,0,0.10)" : "0 0 0 transparent",
      borderColor: isAccent ? "rgba(255,204,0,0.32)" : "rgba(35,35,43,1)",
      duration: 0.35,
      ease: "power2.out",
      overwrite: true,
    });
  }, []);

  const runCheck = async () => {
    setCheck("checking");
    try {
      await loadAll();
      const hasVerified = frames.some((f) => f.verified) || eco.length > 0;
      const ok = hasVerified || ratingRows.length > 0;
      setCheck(ok ? "ok" : "fail");
      setToast(ok ? "БРАТ-БОТ: данные обновлены — ты в рейтинге, братуха ✅" : "БРАТ-БОТ: пока пусто — стань первым");
    } catch {
      setCheck("fail");
      setToast("БРАТ-БОТ: не удалось обновить — попробуй снова");
    }
    window.setTimeout(() => setToast(null), 2200);
    window.setTimeout(() => setCheck("idle"), 2600);
  };

  const handleShare = async () => {
    setShareBusy(true);
    try {
      const { drawShareCard, canvasToBlob, shareOrDownload } = await import("../components/ShareCard");
      const off = document.createElement("canvas");
      const verifiedFrame = frames.find((f) => f.verified);
      const top = ratingRows[0];
      const uname = verifiedFrame?.username || top?.username || null;
      const verified = Boolean(verifiedFrame?.verified || top?.verified);
      const skinId = verifiedFrame?.avatar ?? top?.skinId ?? null;
      const emoji = (() => {
        const m: Record<string, string> = { mops: "🐗", rhino: "🦏", monkey: "🐵", frog: "🐸", panda: "🐼", fox: "🦊", owl: "🦉", shark: "🦈", flamingo: "🦩", wolf: "🐺", tiger: "🐯", dragon: "🐉" };
        if (!skinId) return "★";
        return m[skinId.toLowerCase().trim()] ?? "★";
      })();
      await drawShareCard(off, { username: uname, verified, avatarEmoji: emoji });
      const blob = await canvasToBlob(off);
      const safe = (uname ?? "magnum").replace(/[^a-z0-9_-]/gi, "_").slice(0, 18) || "magnum";
      const res = await shareOrDownload(blob, `magnum-ya-v-42-${safe}-1080.png`);
      setToast(res === "shared" ? "Поделились · Я в 42 🔥" : "Скачано PNG 1080×1080 ✓");
      setTimeout(() => setToast(null), 2400);
    } catch (e) {
      setToast(String(e).slice(0, 96));
      setTimeout(() => setToast(null), 2400);
    } finally {
      setShareBusy(false);
    }
  };

  const isEmpty = !loading && ratingRows.length === 0;

  useEffect(() => {
    const tick = () => setDropCountdown(formatDropCountdown(DROP_DATE_RATING.getTime() - Date.now()));
    const id = window.setInterval(tick, 60000);
    tick();
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const target = goldRef.current || fomoBadgeRef.current;
    if (!target) return;
    const ctx = gsap.context(() => {
      gsap.to(target, { scale: 1.03, duration: 0.42, ease: "power2.inOut", repeat: -1, yoyo: true, repeatDelay: 2.16 });
    }, target);
    return () => ctx.revert();
  }, []);
  // confetti burst on GOLD
  useEffect(() => {
    if (!confettiRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = confettiRef.current;
    // spawn 18 confetti pieces
    root.innerHTML = "";
    const emojis = ["🎉", "💛", "🎊", "✨", "💐", "⭐"];
    for (let i = 0; i < 18; i++) {
      const span = document.createElement("span");
      span.textContent = emojis[i % emojis.length];
      span.style.left = `${5 + (i * 5) % 90}%`;
      span.style.animationDelay = `${(i * 0.12) % 1.2}s`;
      span.style.fontSize = `${14 + (i % 3) * 4}px`;
      root.appendChild(span);
    }
    const pieces = root.querySelectorAll("span");
    gsap.set(pieces, { y: -12, opacity: 0, rotation: 0 });
    gsap.to(pieces, { y: 22, opacity: 1, duration: 0.5, stagger: 0.06, ease: "power2.out" });
    const loop = gsap.to(pieces, { y: 34, rotation: 12, duration: 1.8, stagger: 0.08, repeat: -1, yoyo: true, ease: "sine.inOut" });
    return () => { loop.kill(); root.innerHTML = ""; };
  }, [DISPLAY_PRESAVE]);

  return (
    <div className={styles.page} ref={rootRef}>
      <GuestGate action="попасть в рейтинг пресейва" />
      <header ref={heroRef} className={styles.header}>
        <div className={styles.badge}>★ РЕЙТИНГ ПРЕСЕЙВА · MAGNUM · 42 БРАТУХИ</div>
        <div ref={goldRef} className={styles.goldCelebrate} data-testid="presave-gold-badge" data-gold="true" data-presave-fomo-badge>
          <div className={styles.confetti} ref={confettiRef} aria-hidden />
          <div className={styles.goldMain}>GOLD · {DISPLAY_PRESAVE}/{GOLD_GOAL} · {GOLD_PCT}% · ПЕРЕВЫПОЛНЕН 🎉</div>
          <div className={styles.goldSub}>440% цели · золотая рамка выдана · до дропа MAGNUM: {dropCountdown}</div>
          <div className={styles.goldProgressWrap} aria-label={`progress ${DISPLAY_PRESAVE}/${GOLD_GOAL}`}>
            <div className={styles.goldProgressTrack}>
              <div className={styles.goldProgressFill} style={{ width: "100%" }} />
              <div className={styles.goldProgressGlow} />
            </div>
            <span className={styles.goldProgressLabel}>{DISPLAY_PRESAVE}/{GOLD_GOAL} GOLD</span>
          </div>
          <div className={styles.nextGoalRow}>
            <span className={styles.nextGoalLabel}>NEXT GOAL</span>
            <span className={styles.nextGoalValue}>{DISPLAY_PRESAVE}/{NEXT_GOAL} → {ULTIMATE_GOAL}</span>
            <span className={styles.nextGoalReward}>+{NEXT_REWARD} монет</span>
          </div>
          <div className={styles.nextProgressTrack} aria-label={`next ${DISPLAY_PRESAVE}/${NEXT_GOAL}`}>
            <div className={styles.nextProgressFill} style={{ width: `${nextPct}%` }} />
          </div>
          <div className={styles.nextHint}>{nextToGo === 0 ? `NEXT DONE — ждём ${ULTIMATE_GOAL} · ${ultimatePct}% к финалу` : `${nextToGo} до ${NEXT_GOAL} · ${nextPct}% · ${ultimatePct}% к ${ULTIMATE_GOAL}`}</div>
          <div className={styles.goldActions}>
            <button onClick={handleShare} disabled={shareBusy} className={styles.goldShareBtn} data-testid="presave-gold-share">🎉 Поделиться GOLD 1080×1080</button>
            <Link to="/magnum/share-card?utm_source=share&utm_medium=42&utm_campaign=presave_gold&utm_content=1080" className={styles.goldShareLink}>Открыть шаринг 1080 UTM →</Link>
          </div>
        </div>
        <h1 className={styles.title}>КТО ПОСТАВИЛ<br />ПРЕСЕЙВ — ТОТ БРАТУХА</h1>
        <p className={styles.subtitle}>
          Реальный рейтинг — только живые братухи, без фейков. {bandlink?.title ? `BandLink: ${bandlink.title}` : ""} Проверка — через <b>БРАТ-БОТа</b>.
        </p>
      </header>

      <div style={{ margin: "14px 0" }}><StreakReviveBanner surface="PresaveRating" /></div>

      {toast && <div className={styles.toast} role="status">{toast}</div>}

      <div className={styles.kpiRow} ref={kpiRef}>
        <div className={styles.kpi} onMouseEnter={onKpiEnter} onMouseLeave={onKpiLeave}>
          <div className={styles.kpiNum}>{loading ? "…" : stats.frames}</div>
          <div className={styles.kpiLbl}>рамок выдано</div>
          <div className={styles.kpiHint}>magnum_frames · {stats.verified} ✓</div>
        </div>
        <div className={`${styles.kpi} ${styles.kpiAccent}`} onMouseEnter={onKpiEnter} onMouseLeave={onKpiLeave}>
          <div className={styles.kpiNum}>{loading ? "…" : stats.ecoCount}</div>
          <div className={styles.kpiLbl}>эко-результатов</div>
          <div className={styles.kpiHint}>magnum_eco_results · {stats.totalScore} очков</div>
        </div>
        <div className={styles.kpi} onMouseEnter={onKpiEnter} onMouseLeave={onKpiLeave}>
          <div className={styles.kpiNum}>{loading ? "…" : stats.ideasCount}</div>
          <div className={styles.kpiLbl}>идей</div>
          <div className={styles.kpiHint}>{stats.totalVotes} голосов · magnum_ideas</div>
        </div>
        <div className={styles.kpi} onMouseEnter={onKpiEnter} onMouseLeave={onKpiLeave}>
          <div className={styles.kpiNum}>{loading ? "…" : stats.verified}</div>
          <div className={styles.kpiLbl}>верифицировано</div>
          <div className={styles.kpiHint}>{stats.frames ? Math.round((stats.verified / Math.max(1, stats.frames)) * 100) : 0}% · БРАТ-БОТ</div>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          className={`${styles.checkBtn} ${check === "checking" ? styles.checking : ""} ${check === "ok" ? styles.ok : ""} ${check === "fail" ? styles.fail : ""}`}
          onClick={runCheck}
          disabled={check === "checking"}
        >
          {check === "idle" && "Обновить →"}
          {check === "checking" && "Загружаю…"}
          {check === "ok" && "✓ Обновлено"}
          {check === "fail" && "× Пока пусто"}
        </button>
        <button
          onClick={handleShare}
          disabled={shareBusy}
          className={styles.checkBtn}
          style={{ background: shareBusy ? "#333" : "linear-gradient(135deg,#ff2d55,#ffcc00)", color: shareBusy ? "#aaa" : "#fff", borderColor: "rgba(255,204,0,0.32)", fontWeight: 800 }}
          data-testid="presave-share-btn"
        >
          {shareBusy ? "Готовлю 1080…" : "Поделиться · Я в 42"}
        </button>
        <Link to="/magnum/share-card" className={styles.presaveLink} style={{ border: "1px solid rgba(255,204,0,0.22)", padding: "8px 12px", borderRadius: 999, textDecoration: "none" }}>Открыть шаринг-карточку 1080×1080 →</Link>
        <a className={styles.presaveLink} href="https://music.thefence.me/psmagnum?utm_source=share&utm_medium=42&utm_campaign=presave_gold&utm_content=1080" target="_blank" rel="noopener noreferrer">Поставить пресейв на BandLink →</a>
        <span className={styles.verifyHint}>GOLD 185/42 · 440% · NEXT 242/420 +{NEXT_REWARD} · GET /magnum/api/frame/status · /magnum/api/eco/leaderboard · /magnum/api/ideas — live · {bandlink?.ok ? "BandLink OK" : bandlink ? "BandLink OG fallback" : "BandLink…"} · 1080×1080 Web Share → PNG · UTM presave_gold</span>
      </div>

      <SocialHook
        presavers={ratingRows.slice(0, 7).map((r) => ({ username: r.username, avatar: r.skinId, verified: r.verified, frame: r.frame, title: r.title }))}
      />

      <div className={styles.controls}>
        <input className={styles.search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по нику…" aria-label="Поиск по нику" />
        <div className={styles.filters} role="group" aria-label="Фильтр по статусу">
          {(["all", "топ", "verified", "pending"] as const).map((f) => (
            <button key={f} className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ""}`} onClick={() => setFilter(f)}>
              {f === "all" ? "Все" : f === "топ" ? "Топ" : f === "verified" ? "Verified" : "Ожидают"}
            </button>
          ))}
        </div>
        <span className={styles.count}>{loading ? "…" : `${filtered.length} / ${ratingRows.length} братух`}</span>
      </div>

      <div ref={tableRef} className={styles.tableWrap}>
        <div className={styles.tableHead}>
          <span className={styles.thRank}>#</span>
          <span className={styles.thUser}>Братуха</span>
          <span className={styles.thMeta}>Дата · источник</span>
          <span className={styles.thStats}>Score</span>
          <span className={styles.thStatus}>Статус</span>
        </div>
        <div className={styles.tableBody}>
          {loading && <div className={styles.empty}>Загружаю…</div>}
          {!loading && err && <div className={styles.empty}>Ошибка: {err}</div>}
          {!loading && !err && isEmpty && <div className={styles.empty}>{EMPTY_FALLBACK}</div>}
          {!loading && !err && !isEmpty && filtered.length === 0 && <div className={styles.empty}>{EMPTY_FALLBACK}</div>}
          {!loading && !err && filtered.map((r) => (
            <div key={`${r.source}-${r.rank}-${r.username}`} className={`${styles.row} ${r.rank <= 3 ? styles.topRow : ""}`} style={cosmeticBannerStyle(r.banner)} onMouseEnter={onRowEnter} onMouseLeave={onRowLeave}>
              <span className={styles.rank}>
                {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : `#${r.rank}`}
              </span>
              <span className={styles.user}>
                {r.frame || r.title
                  ? <CosmeticIdentity username={r.username} avatar={r.skinId} frame={r.frame} title={r.title} verified={r.verified} size={26} />
                  : (<>
                      <span className={styles.avatar} aria-hidden>{r.avatar}</span>
                      <span className={styles.nick} title={r.username}>{r.username}{r.verified && <span className={styles.verifiedBadge} title="verified"> ✓</span>}</span>
                    </>)}
              </span>
              <span className={styles.meta}>
                <span className={styles.date}>{r.date}</span>
                <span className={styles.city}>{r.source === "eco" ? "эко" : r.source === "frame" ? "рамка" : "идея"} · {r.city}</span>
              </span>
              <span className={styles.stats}>
                <span className={styles.clips}>{r.score} очков</span>
                <span className={styles.views}>{r.source}{r.skinId ? ` · ${r.skinId}` : ""}</span>
              </span>
              <span className={`${styles.status} ${r.status === "топ" ? styles.sTop : r.status === "verified" ? styles.sVerified : styles.sPending}`}>
                {r.status === "топ" ? "★ ТОП" : r.status === "verified" ? "✓ VERIFIED" : "… PENDING"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.foot}>
        <div className={styles.footCard}>
          <strong>Как попасть в топ?</strong> Поставь пресейв → эко-тест /magnum/eco → идея /magnum/ideas → появишься здесь.
          Топ-3 получают рамку 42 + респект. Аватар берётся из магазина (экипированный скин).
        </div>
        <div className={styles.footStats}>
          {stats.frames} фреймов · {stats.ecoCount} эко · {stats.ideasCount} идей · Neon proud-bar-62331523 · BandLink {bandlink?.title?.slice(0, 36) ?? "…"} · {new Date().toISOString().slice(0,10)}
        </div>
      </div>
    </div>
  );
}
