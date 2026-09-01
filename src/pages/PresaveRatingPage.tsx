import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import styles from "./PresaveRatingPage.module.css";

/* ── API types (Neon real) ─────────────────────── */
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

  const heroRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(`.${styles.kpi}`, { y: 16, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.08, duration: 0.5, ease: "power2.out", delay: 0.1 });
      gsap.fromTo(heroRef.current, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: "power3.out" });
      gsap.fromTo(`.${styles.row}`, { y: 10, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.03, duration: 0.35, ease: "power2.out", delay: 0.22 });
    });
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!tableRef.current) return;
    gsap.fromTo(tableRef.current.querySelectorAll(`.${styles.row}`), { y: 8, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.025, duration: 0.3, ease: "power2.out", overwrite: "auto" });
  }, [filtered.length, filter, q]);

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
    <div className={styles.page}>
      <header ref={heroRef} className={styles.header}>
        <div className={styles.badge}>★ РЕЙТИНГ ПРЕСЕЙВА · MAGNUM · 42 БРАТУХИ · Neon</div>
        <h1 className={styles.title}>КТО ПОСТАВИЛ<br />ПРЕСЕЙВ — ТОТ БРАТУХА</h1>
        <p className={styles.subtitle}>
          Реальный рейтинг из Neon: <b>magnum_frames</b> + <b>magnum_eco_results</b> + <b>magnum_ideas</b>. Никакого мока — только живые данные.
          Проверка — через <b>БРАТ-БОТа</b>.
        </p>
      </header>

      {toast && <div className={styles.toast} role="status">{toast}</div>}

      <div className={styles.kpiRow}>
        <div className={styles.kpi}>
          <div className={styles.kpiNum}>{loading ? "…" : stats.frames}</div>
          <div className={styles.kpiLbl}>рамок выдано</div>
          <div className={styles.kpiHint}>magnum_frames</div>
        </div>
        <div className={`${styles.kpi} ${styles.kpiAccent}`}>
          <div className={styles.kpiNum}>{loading ? "…" : stats.ecoCount}</div>
          <div className={styles.kpiLbl}>эко-результатов</div>
          <div className={styles.kpiHint}>magnum_eco_results</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiNum}>{loading ? "…" : stats.ideasCount}</div>
          <div className={styles.kpiLbl}>идей в Neon</div>
          <div className={styles.kpiHint}>magnum_ideas · {stats.totalVotes} голосов</div>
        </div>
        <div className={styles.kpi}>
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
          {check === "idle" && "Обновить из Neon →"}
          {check === "checking" && "Гружу Neon…"}
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
          {loading && <div className={styles.empty}>Гружу Neon…</div>}
          {!loading && err && <div className={styles.empty}>Ошибка Neon: {err}</div>}
          {!loading && !err && isEmpty && <div className={styles.empty}>{EMPTY_FALLBACK}</div>}
          {!loading && !err && !isEmpty && filtered.length === 0 && <div className={styles.empty}>{EMPTY_FALLBACK}</div>}
          {!loading && !err && filtered.map((r) => (
            <div key={`${r.source}-${r.rank}-${r.username}`} className={`${styles.row} ${r.rank <= 3 ? styles.topRow : ""}`}>
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
          <strong>Как попасть в топ?</strong> Поставь пресейв → эко-тест /magnum/eco → идея /magnum/ideas → данные падают в Neon и появляются здесь.
          Топ-3 получают рамку 42 + респект.
        </div>
        <div className={styles.footStats}>
          Live Neon: magnum_frames {stats.frames} · magnum_eco_results {stats.ecoCount} · magnum_ideas {stats.ideasCount} · {new Date().toISOString().slice(0,10)} · proud-bar-62331523
        </div>
      </div>
    </div>
  );
}
