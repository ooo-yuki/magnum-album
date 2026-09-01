import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./PresaveRatingPage.module.css";

gsap.registerPlugin(ScrollTrigger);

/* ── API types ─────────────────────── */
type FrameRow = { id: number; username: string; verified: boolean; status: string; created_at: string };
type EcoRow = { username: string; player: string; score: number; rank: string; status: string; created_at: string };
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
};

type CheckState = "idle" | "checking" | "ok" | "fail";

const EMPTY_FALLBACK = "пока пусто — стань первым";

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

  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const kpiRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const loadAll = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [frRes, ecoRes, ideasRes] = await Promise.all([
        fetch("/magnum/api/frame/status", { credentials: "include" }),
        fetch("/magnum/api/eco/leaderboard", { credentials: "include" }),
        fetch("/magnum/api/ideas", { credentials: "include" }),
      ]);

      // frame/status
      if (frRes.ok) {
        const j = (await frRes.json()) as { frames?: FrameRow[]; total?: number };
        if (Array.isArray(j.frames)) setFrames(j.frames);
        else setFrames([]);
      } else setFrames([]);

      // eco/leaderboard
      if (ecoRes.ok) {
        const j = (await ecoRes.json()) as { leaderboard?: EcoRow[]; entries?: EcoRow[] } | EcoRow[];
        if (Array.isArray(j)) setEco(j as EcoRow[]);
        else if (Array.isArray((j as { leaderboard?: EcoRow[] }).leaderboard)) setEco((j as { leaderboard: EcoRow[] }).leaderboard);
        else if (Array.isArray((j as { entries?: EcoRow[] }).entries)) setEco((j as { entries: EcoRow[] }).entries!);
        else setEco([]);
      } else setEco([]);

      // ideas
      if (ideasRes.ok) {
        const j = (await ideasRes.json()) as { ideas?: IdeaRow[] };
        if (Array.isArray(j.ideas)) setIdeas(j.ideas);
        else setIdeas([]);
      } else setIdeas([]);
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
    // eco first sorted by score desc
    const sortedEco = [...eco].sort((a, b) => b.score - a.score);
    sortedEco.forEach((e, i) => {
      const s = String(e.status || e.rank || "").toLowerCase();
      let status: RatingRow["status"] = "pending";
      if (s.includes("топ") || s.includes("legend") || i < 3) status = i < 3 ? "топ" : "verified";
      else if (s.includes("verified") || s.includes("approved") || s.includes("братуха")) status = "verified";
      out.push({
        rank: i + 1,
        username: e.username || e.player || "Братуха",
        score: Number(e.score) || 0,
        status,
        date: e.created_at ? String(e.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
        city: "Кемерово",
        source: "eco",
        avatar: i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🌿",
      });
    });
    // frames — append after eco
    frames.forEach((f) => {
      const idx = out.length;
      out.push({
        rank: idx + 1,
        username: f.username,
        score: f.verified ? 42 : 0,
        status: f.verified ? "verified" : "pending",
        date: f.created_at ? String(f.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
        city: "Кемерово",
        source: "frame",
        avatar: f.verified ? "✓" : "…",
      });
    });
    // ideas — append, votes as score
    const sortedIdeas = [...ideas].sort((a, b) => b.votes - a.votes);
    sortedIdeas.forEach((it) => {
      const s = String(it.status || "").toLowerCase();
      let status: RatingRow["status"] = "pending";
      if (s === "approved" || s === "топ") status = "топ";
      else if (s === "verified") status = "verified";
      const idx = out.length;
      out.push({
        rank: idx + 1,
        username: it.title.slice(0, 22),
        score: Number(it.votes) || 0,
        status,
        date: it.created_at ? String(it.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
        city: "Идея",
        source: "idea",
        avatar: "💡",
      });
    });
    // re-rank by score desc for unified rating, but keep stable top logic
    out.sort((a, b) => b.score - a.score);
    out.forEach((r, i) => (r.rank = i + 1));
    // fix status for top 3 after resort
    out.forEach((r, i) => {
      if (i < 3 && r.score > 0) r.status = "топ";
    });
    return out;
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

  // hover RGB — chromatic lift + tri-color shadow
  const onRowEnter = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.to(e.currentTarget, {
      y: -2,
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

  const isEmpty = !loading && ratingRows.length === 0;

  return (
    <div className={styles.page} ref={rootRef}>
      <header ref={heroRef} className={styles.header}>
        <div className={styles.badge}>★ РЕЙТИНГ ПРЕСЕЙВА · MAGNUM · 42 БРАТУХИ</div>
        <h1 className={styles.title}>КТО ПОСТАВИЛ<br />ПРЕСЕЙВ — ТОТ БРАТУХА</h1>
        <p className={styles.subtitle}>
          Реальный рейтинг — только живые братухи, без фейков.
          Проверка — через <b>БРАТ-БОТа</b>.
        </p>
      </header>

      {toast && <div className={styles.toast} role="status">{toast}</div>}

      <div className={styles.kpiRow} ref={kpiRef}>
        <div className={styles.kpi} onMouseEnter={onKpiEnter} onMouseLeave={onKpiLeave}>
          <div className={styles.kpiNum}>{loading ? "…" : stats.frames}</div>
          <div className={styles.kpiLbl}>рамок выдано</div>
          <div className={styles.kpiHint}>magnum_frames</div>
        </div>
        <div className={`${styles.kpi} ${styles.kpiAccent}`} onMouseEnter={onKpiEnter} onMouseLeave={onKpiLeave}>
          <div className={styles.kpiNum}>{loading ? "…" : stats.ecoCount}</div>
          <div className={styles.kpiLbl}>эко-результатов</div>
          <div className={styles.kpiHint}>magnum_eco_results</div>
        </div>
        <div className={styles.kpi} onMouseEnter={onKpiEnter} onMouseLeave={onKpiLeave}>
          <div className={styles.kpiNum}>{loading ? "…" : stats.ideasCount}</div>
          <div className={styles.kpiLbl}>идей</div>
          <div className={styles.kpiHint}>{stats.totalVotes} голосов</div>
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
        <a className={styles.presaveLink} href="https://music.yandex.ru/artist/7544304" target="_blank" rel="noopener noreferrer">Поставить пресейв на Яндексе →</a>
        <span className={styles.verifyHint}>GET /magnum/api/frame/status · /magnum/api/eco/leaderboard · /magnum/api/ideas — live</span>
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
                <span className={styles.nick} title={r.username}>{r.username}</span>
              </span>
              <span className={styles.meta}>
                <span className={styles.date}>{r.date}</span>
                <span className={styles.city}>{r.source === "eco" ? "эко" : r.source === "frame" ? "рамка" : "идея"} · {r.city}</span>
              </span>
              <span className={styles.stats}>
                <span className={styles.clips}>{r.score} очков</span>
                <span className={styles.views}>{r.source}</span>
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
          Топ-3 получают рамку 42 + респект.
        </div>
        <div className={styles.footStats}>
          {stats.frames} фреймов · {stats.ecoCount} эко · {stats.ideasCount} идей · {new Date().toISOString().slice(0,10)}
        </div>
      </div>
    </div>
  );
}
