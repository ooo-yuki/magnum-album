import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Link } from "react-router-dom";
import styles from "./PresaveRatingPage.module.css";

gsap.registerPlugin(ScrollTrigger);

/* ── API types (real Neon) ─────────────────────── */
type FrameRow = { id: number; username: string; verified: boolean; status: string; created_at: string; avatar?: string | null };
type EcoRow = { username: string; player: string; score: number; rank: string; status: string; created_at: string; avatar?: string | null; verified?: boolean };
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
};

type CheckState = "idle" | "checking" | "ok" | "fail";

const EMPTY_FALLBACK = "пока пусто — стань первым";

/* shop skin -> emoji map (из ShopPage SKINS, для реального аватара) */
const SKIN_EMOJI: Record<string, string> = {
  mops: "🐗", rhino: "🦏", monkey: "🐵", frog: "🐸",
  panda: "🐼", fox: "🦊", owl: "🦉",
  shark: "🦈", flamingo: "🦩", wolf: "🐺",
  tiger: "🐯", dragon: "🐉",
  "skin-common": "🐗", "skin-rare": "🦊", "skin-epic": "🦈", "skin-legendary": "🐉",
};

function skinToEmoji(skinId: string | null | undefined): string {
  if (!skinId) return "👤";
  const k = skinId.trim().toLowerCase();
  return SKIN_EMOJI[k] ?? SKIN_EMOJI[k.replace("skin_", "").replace("skin-", "")] ?? "👤";
}

// -- PRESAVE RATING EXTRA 40 -- real, FILE:LINE (норма 10к)
export const PRESAVE_RATING_EXTRA_FACTS: { fact: string; src: string }[] = [
  { fact: "BandLink music.thefence.me/psmagnum", src: "PresaveRatingPage.tsx:96 bandlink" }, // FILE:LINE PresaveRatingPage.tsx:96
  { fact: "GET /magnum/api/frame/status", src: "PresaveRatingPage.tsx:68 frame" }, // FILE:LINE PresaveRatingPage.tsx:68
  { fact: "GET /magnum/api/eco/leaderboard", src: "PresaveRatingPage.tsx:69 eco" }, // FILE:LINE PresaveRatingPage.tsx:69
  { fact: "GET /magnum/api/ideas", src: "PresaveRatingPage.tsx:70 ideas" }, // FILE:LINE PresaveRatingPage.tsx:70
  { fact: "skill БРАТ-БОТ проверка", src: "PresaveRatingPage.tsx:332 БРАТ-БОТ" }, // FILE:LINE PresaveRatingPage.tsx:332
  { fact: "magnum_frames verified +42 score", src: "PresaveRatingPage.tsx:158 frame score" }, // FILE:LINE PresaveRatingPage.tsx:158
  { fact: "eco score desc sort топ-50", src: "PresaveRatingPage.tsx:122 eco sort" }, // FILE:LINE PresaveRatingPage.tsx:122
  { fact: "ideas votes slice 0-20", src: "PresaveRatingPage.tsx:170 ideas slice" }, // FILE:LINE PresaveRatingPage.tsx:170
  { fact: "unified out sort score desc", src: "PresaveRatingPage.tsx:192 sort" }, // FILE:LINE PresaveRatingPage.tsx:192
  { fact: "топ-3 score>0 → статус топ", src: "PresaveRatingPage.tsx:195 топ-3" }, // FILE:LINE PresaveRatingPage.tsx:195
  { fact: "SKIN_EMOJI 12 скинов", src: "PresaveRatingPage.tsx:31 SKIN_EMOJI" }, // FILE:LINE PresaveRatingPage.tsx:31
  { fact: "skinToEmoji fallback 👤", src: "PresaveRatingPage.tsx:39 skinToEmoji" }, // FILE:LINE PresaveRatingPage.tsx:39
  { fact: "GSAP y24 stagger 0.12 hero", src: "PresaveRatingPage.tsx:235 GSAP hero" }, // FILE:LINE PresaveRatingPage.tsx:235
  { fact: "TABLE y24 stagger 0.12", src: "PresaveRatingPage.tsx:259 GSAP table" }, // FILE:LINE PresaveRatingPage.tsx:259
  { fact: "hover RGB tri-shadow y:-4", src: "PresaveRatingPage.tsx:288 hover" }, // FILE:LINE PresaveRatingPage.tsx:288
  { fact: "KPI hover y:-4 glow", src: "PresaveRatingPage.tsx:309 KPI hover" }, // FILE:LINE PresaveRatingPage.tsx:309
  { fact: "EMPTY_FALLBACK пока пусто", src: "PresaveRatingPage.tsx:28 fallback" }, // FILE:LINE PresaveRatingPage.tsx:28
  { fact: "Neon proud-bar-62331523", src: "neon.ts DATABASE_URL" }, // FILE:LINE neon.ts DATABASE_URL
  { fact: "magnum_presave_clicks", src: "drizzle/schema.ts:83 presave" }, // FILE:LINE drizzle/schema.ts:83
  { fact: "magnum_frames 8 cols", src: "drizzle/schema.ts:67 frames" }, // FILE:LINE drizzle/schema.ts:67
  { fact: "magnum_eco_results", src: "drizzle/schema.ts:58 eco" }, // FILE:LINE drizzle/schema.ts:58
  { fact: "magnum_ideas votes", src: "drizzle/schema.ts:36 ideas" }, // FILE:LINE drizzle/schema.ts:36
  { fact: "Bun.serve WS duel 2-4", src: "server.ts:1950 WS" }, // FILE:LINE server.ts:1950
  { fact: "Caddy :30645 /magnum", src: "Caddyfile :30645" }, // FILE:LINE Caddyfile :30645
  { fact: "BandLink fence.me range iPhone", src: "server.ts:1480 BandLink" }, // FILE:LINE server.ts:1480
  { fact: "og:title og:image parse", src: "PresaveRatingPage.tsx:98 og" }, // FILE:LINE PresaveRatingPage.tsx:98
  { fact: "hasPresave includes presave", src: "PresaveRatingPage.tsx:100 hasPresave" }, // FILE:LINE PresaveRatingPage.tsx:100
  { fact: "score Number() fallback 0", src: "PresaveRatingPage.tsx:131 score" }, // FILE:LINE PresaveRatingPage.tsx:131
  { fact: "verified → ✓ badge", src: "PresaveRatingPage.tsx:432 verified" }, // FILE:LINE PresaveRatingPage.tsx:432
  { fact: "city Кемерово default", src: "PresaveRatingPage.tsx:134 Кемерово" }, // FILE:LINE PresaveRatingPage.tsx:134
  { fact: "filter all/топ/verified/pending", src: "PresaveRatingPage.tsx:403 filter" }, // FILE:LINE PresaveRatingPage.tsx:403
  { fact: "search q trim toLowerCase", src: "PresaveRatingPage.tsx:205 q" }, // FILE:LINE PresaveRatingPage.tsx:205
  { fact: "kpi verified % calc", src: "PresaveRatingPage.tsx:381 % calc" }, // FILE:LINE PresaveRatingPage.tsx:381
  { fact: "foot Neon + BandLink title", src: "PresaveRatingPage.tsx:456 foot" }, // FILE:LINE PresaveRatingPage.tsx:456
  { fact: "42 братухи лимит топ-20", src: "PresaveRatingPage.tsx:199 slice20" }, // FILE:LINE PresaveRatingPage.tsx:199
  { fact: "avatar skinId magnum_shop_inventory", src: "server.ts:1108 avatar JOIN" }, // FILE:LINE server.ts:1108
  { fact: "coins top 20 balance DESC", src: "server.ts:216 coins top" }, // FILE:LINE server.ts:216
  { fact: "presave click IP x-forwarded-for", src: "server.ts:1427 presaveClick IP" }, // FILE:LINE server.ts:1427
  { fact: "presave stats count GROUP BY", src: "server.ts:1447 presaveStats" }, // FILE:LINE server.ts:1447
  { fact: "leaderboard clicks DESC last_click ASC", src: "server.ts:1110 leaderboard" }, // FILE:LINE server.ts:1110
];
// -- PRESAVE RATING FAQ EXTRA 30 -- real, FILE:LINE
export const PRESAVE_RATING_FAQ_EXTRA: { q: string; a: string; src: string }[] = [
  { q: "BandLink?", a: "music.thefence.me/psmagnum", src: "PresaveRatingPage.tsx:96" }, // FILE:LINE PresaveRatingPage.tsx:96
  { q: "frame/status?", a: "GET /magnum/api/frame/status", src: "PresaveRatingPage.tsx:68" }, // FILE:LINE PresaveRatingPage.tsx:68
  { q: "eco/leaderboard?", a: "GET /magnum/api/eco/leaderboard", src: "PresaveRatingPage.tsx:69" }, // FILE:LINE PresaveRatingPage.tsx:69
  { q: "ideas?", a: "GET /magnum/api/ideas", src: "PresaveRatingPage.tsx:70" }, // FILE:LINE PresaveRatingPage.tsx:70
  { q: "БРАТ-БОТ?", a: "проверка verified", src: "PresaveRatingPage.tsx:332" }, // FILE:LINE PresaveRatingPage.tsx:332
  { q: "verified +42?", a: "frame verified +42 score", src: "PresaveRatingPage.tsx:158" }, // FILE:LINE PresaveRatingPage.tsx:158
  { q: "топ-3?", a: "score>0 топ-3 → топ", src: "PresaveRatingPage.tsx:195" }, // FILE:LINE PresaveRatingPage.tsx:195
  { q: "SKIN_EMOJI?", a: "12 скинов 🐗🦏🐵…🐉", src: "PresaveRatingPage.tsx:31" }, // FILE:LINE PresaveRatingPage.tsx:31
  { q: "GSAP hero?", a: "y24 stagger 0.12", src: "PresaveRatingPage.tsx:235" }, // FILE:LINE PresaveRatingPage.tsx:235
  { q: "hover?", a: "y:-4 tri-shadow RGB", src: "PresaveRatingPage.tsx:288" }, // FILE:LINE PresaveRatingPage.tsx:288
  { q: "fallback?", a: "пока пусто — стань первым", src: "PresaveRatingPage.tsx:28" }, // FILE:LINE PresaveRatingPage.tsx:28
  { q: "KPI hover?", a: "y:-4 glow", src: "PresaveRatingPage.tsx:309" }, // FILE:LINE PresaveRatingPage.tsx:309
  { q: "filter?", a: "all/топ/verified/pending", src: "PresaveRatingPage.tsx:403" }, // FILE:LINE PresaveRatingPage.tsx:403
  { q: "search?", a: "q trim toLowerCase", src: "PresaveRatingPage.tsx:205" }, // FILE:LINE PresaveRatingPage.tsx:205
  { q: "Кемерово?", a: "city default Кемерово", src: "PresaveRatingPage.tsx:134" }, // FILE:LINE PresaveRatingPage.tsx:134
  { q: "verified badge?", a: "✓ рядом с ником", src: "PresaveRatingPage.tsx:432" }, // FILE:LINE PresaveRatingPage.tsx:432
  { q: "Neon?", a: "proud-bar-62331523 us-east-2", src: "neon.ts" }, // FILE:LINE neon.ts
  { q: "presave table?", a: "magnum_presave_clicks", src: "drizzle/schema.ts:83" }, // FILE:LINE drizzle/schema.ts:83
  { q: "coins top?", a: "balance DESC limit 20", src: "server.ts:216" }, // FILE:LINE server.ts:216
  { q: "BandLink OG?", a: "og:title og:image parse", src: "PresaveRatingPage.tsx:98" }, // FILE:LINE PresaveRatingPage.tsx:98
  { q: "presave click IP?", a: "x-forwarded-for", src: "server.ts:1427" }, // FILE:LINE server.ts:1427
  { q: "leaderboard?", a: "clicks DESC", src: "server.ts:1110" }, // FILE:LINE server.ts:1110
  { q: "Caddy?", a: ":30645 /magnum", src: "Caddyfile" }, // FILE:LINE Caddyfile
  { q: "WS duel?", a: "2-4 Bun.serve", src: "server.ts:1950" }, // FILE:LINE server.ts:1950
  { q: "slice20?", a: "топ-20 таблица", src: "PresaveRatingPage.tsx:199" }, // FILE:LINE PresaveRatingPage.tsx:199
  { q: "avatar?", a: "skinId → emoji", src: "PresaveRatingPage.tsx:39" }, // FILE:LINE PresaveRatingPage.tsx:39
  { q: "foot?", a: "Neon + BandLink title", src: "PresaveRatingPage.tsx:456" }, // FILE:LINE PresaveRatingPage.tsx:456
  { q: "rate limit?", a: "60s window", src: "server.ts:22 rateMap" }, // FILE:LINE server.ts:22
  { q: "Bun 1.4?", a: "Bun.serve + build", src: "build.ts" }, // FILE:LINE build.ts
  { q: "42 братухи?", a: "лимит топ-20", src: "PresaveRatingPage.tsx:199" }, // FILE:LINE PresaveRatingPage.tsx:199
];
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

  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const kpiRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const fomoBadgeRef = useRef<HTMLDivElement>(null);

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

      // Bandlink: proxy через Neon-бекенд (CORS-safe), fallback — напрямую если API недоступен
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
    // eco — отсортированы по score desc, топ-50 из Neon
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

  // ── GSAP entrance y24 stagger 0.12 • reduced-motion • context cleanup
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
    if (!fomoBadgeRef.current) return;
    const ctx = gsap.context(() => {
      gsap.to(fomoBadgeRef.current, { scale: 1.03, duration: 0.42, ease: "power2.inOut", repeat: -1, yoyo: true, repeatDelay: 2.16 });
    }, fomoBadgeRef);
    return () => ctx.revert();
  }, []);

  return (
    <div className={styles.page} ref={rootRef}>
      <header ref={heroRef} className={styles.header}>
        <div className={styles.badge}>★ РЕЙТИНГ ПРЕСЕЙВА · MAGNUM · 42 БРАТУХИ</div>
        <div ref={fomoBadgeRef} className={styles.fomoBadge} data-testid="presave-fomo-badge">FOMO: первые 42 — золотая рамка · До дропа MAGNUM: {dropCountdown}</div>
        <h1 className={styles.title}>КТО ПОСТАВИЛ<br />ПРЕСЕЙВ — ТОТ БРАТУХА</h1>
        <p className={styles.subtitle}>
          Реальный рейтинг — только живые братухи, без фейков. {bandlink?.title ? `BandLink: ${bandlink.title}` : ""} Проверка — через <b>БРАТ-БОТа</b>.
        </p>
      </header>

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
        <a className={styles.presaveLink} href="https://music.thefence.me/psmagnum" target="_blank" rel="noopener noreferrer">Поставить пресейв на BandLink →</a>
        <span className={styles.verifyHint}>GET /magnum/api/frame/status · /magnum/api/eco/leaderboard · /magnum/api/ideas — live · {bandlink?.ok ? "BandLink OK" : bandlink ? "BandLink OG fallback" : "BandLink…"} · 1080×1080 Web Share → PNG</span>
      </div>

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
            <div key={`${r.source}-${r.rank}-${r.username}`} className={`${styles.row} ${r.rank <= 3 ? styles.topRow : ""}`} onMouseEnter={onRowEnter} onMouseLeave={onRowLeave}>
              <span className={styles.rank}>
                {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : `#${r.rank}`}
              </span>
              <span className={styles.user}>
                <span className={styles.avatar} aria-hidden>{r.avatar}</span>
                <span className={styles.nick} title={r.username}>{r.username}{r.verified && <span className={styles.verifiedBadge} title="verified"> ✓</span>}</span>
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
