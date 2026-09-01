import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import styles from "./PresaveRatingPage.module.css";

/* ── mock stats ───────────────────────── */
const STATS = {
  clips: 8124,
  views: 203_417,
  presaves: 1842,
  verified: 1290,
};

/* ── top-20 братух ────────────────────── */
type Row = {
  rank: number;
  nick: string;
  avatar: string;
  date: string; // YYYY-MM-DD
  clips: number;
  views: number;
  status: "топ" | "verified" | "pending";
  city: string;
};

const TOP20: Row[] = [
  { rank: 1, nick: "Шахтёр_42", avatar: "⛏️", date: "2026-08-10", clips: 42, views: 42000, status: "топ", city: "Кемерово" },
  { rank: 2, nick: "Томь_братуха", avatar: "🌊", date: "2026-08-12", clips: 31, views: 28400, status: "топ", city: "Кемерово" },
  { rank: 3, nick: "42_легенда", avatar: "👑", date: "2026-08-11", clips: 28, views: 22100, status: "топ", city: "Новокузнецк" },
  { rank: 4, nick: "Кузбасс_топ", avatar: "🏔️", date: "2026-08-14", clips: 22, views: 18400, status: "verified", city: "Белово" },
  { rank: 5, nick: "БЕЛАЗ_драйвер", avatar: "🚚", date: "2026-08-13", clips: 19, views: 14200, status: "verified", city: "Прокопьевск" },
  { rank: 6, nick: "Уголь_магнат", avatar: "🪨", date: "2026-08-15", clips: 17, views: 12100, status: "verified", city: "Междуреченск" },
  { rank: 7, nick: "Братуха_Кемерово", avatar: "🧢", date: "2026-08-16", clips: 15, views: 10420, status: "verified", city: "Кемерово" },
  { rank: 8, nick: "142_км/ч", avatar: "🏎️", date: "2026-08-16", clips: 14, views: 9800, status: "verified", city: "Кемерово" },
  { rank: 9, nick: "MAGNUM_фан", avatar: "🎧", date: "2026-08-17", clips: 12, views: 8400, status: "verified", city: "Ленинск" },
  { rank: 10, nick: "42_навсегда", avatar: "💛", date: "2026-08-18", clips: 11, views: 7200, status: "verified", city: "Киселёвск" },
  { rank: 11, nick: "Туса_42", avatar: "🪩", date: "2026-08-19", clips: 9, views: 6400, status: "verified", city: "Кемерово" },
  { rank: 12, nick: "РЗТ_топ", avatar: "🎤", date: "2026-08-20", clips: 9, views: 5900, status: "pending", city: "Кемерово" },
  { rank: 13, nick: "Медуза_42", avatar: "🪼", date: "2026-08-20", clips: 8, views: 5400, status: "pending", city: "Новосибирск" },
  { rank: 14, nick: "Братуха_из_общаги", avatar: "🏠", date: "2026-08-21", clips: 7, views: 4200, status: "pending", city: "Кемерово" },
  { rank: 15, nick: "Шахта_042", avatar: "🏗️", date: "2026-08-22", clips: 6, views: 3800, status: "pending", city: "Анжеро" },
  { rank: 16, nick: "Вайб_42", avatar: "😎", date: "2026-08-23", clips: 6, views: 3400, status: "pending", city: "Томск" },
  { rank: 17, nick: "Кемер_юнит", avatar: "🧃", date: "2026-08-24", clips: 5, views: 2900, status: "pending", city: "Кемерово" },
  { rank: 18, nick: "Уголёк", avatar: "🔥", date: "2026-08-25", clips: 5, views: 2600, status: "pending", city: "Мыски" },
  { rank: 19, nick: "Тур_42", avatar: "🚌", date: "2026-08-26", clips: 4, views: 2100, status: "pending", city: "Барнаул" },
  { rank: 20, nick: "Новичок_42", avatar: "🐣", date: "2026-08-27", clips: 3, views: 1600, status: "pending", city: "Кемерово" },
];

type CheckState = "idle" | "checking" | "ok" | "fail";

export function PresaveRatingPage() {
  const [filter, setFilter] = useState<"all" | Row["status"]>("all");
  const [q, setQ] = useState("");
  const [check, setCheck] = useState<CheckState>("idle");
  const [toast, setToast] = useState<string | null>(null);

  const heroRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    return TOP20.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (q.trim() && !r.nick.toLowerCase().includes(q.trim().toLowerCase())) return false;
      return true;
    });
  }, [filter, q]);

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

  const runCheck = () => {
    setCheck("checking");
    window.setTimeout(() => {
      const ok = Math.random() > 0.35;
      setCheck(ok ? "ok" : "fail");
      setToast(ok ? "БРАТ-БОТ: пресейв подтверждён — ты в рейтинге, братуха ✅" : "БРАТ-БОТ: пресейв не найден — поставь на Яндекс Музыке и жми снова");
      window.setTimeout(() => setToast(null), 2200);
      window.setTimeout(() => setCheck("idle"), 2600);
    }, 1400);
  };

  return (
    <div className={styles.page}>
      <header ref={heroRef} className={styles.header}>
        <div className={styles.badge}>★ РЕЙТИНГ ПРЕСЕЙВА · MAGNUM · 42 БРАТУХИ</div>
        <h1 className={styles.title}>КТО ПОСТАВИЛ<br />ПРЕСЕЙВ — ТОТ БРАТУХА</h1>
        <p className={styles.subtitle}>
          Мок-рейтинг братух, поддержавших альбом. 8K клипов · 200K просмотров · 1.8K пресейвов. Таблица топ-20 — аватары-эмодзи, дата, статус.
          Проверка — через <b>БРАТ-БОТа</b> (верификация по Яндекс Музыке).
        </p>
      </header>

      {toast && <div className={styles.toast} role="status">{toast}</div>}

      <div className={styles.kpiRow}>
        <div className={styles.kpi}>
          <div className={styles.kpiNum}>{STATS.clips.toLocaleString("ru-RU")}</div>
          <div className={styles.kpiLbl}>клипов с #MAGNUM42</div>
          <div className={styles.kpiHint}>TikTok · Reels · Shorts</div>
        </div>
        <div className={`${styles.kpi} ${styles.kpiAccent}`}>
          <div className={styles.kpiNum}>{(STATS.views / 1000).toFixed(0)}K</div>
          <div className={styles.kpiLbl}>просмотров</div>
          <div className={styles.kpiHint}>суммарно · +12% за неделю</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiNum}>{STATS.presaves.toLocaleString("ru-RU")}</div>
          <div className={styles.kpiLbl}>пресейвов</div>
          <div className={styles.kpiHint}>Яндекс Музыка</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiNum}>{STATS.verified.toLocaleString("ru-RU")}</div>
          <div className={styles.kpiLbl}>верифицировано ботом</div>
          <div className={styles.kpiHint}>БРАТ-БОТ · {Math.round((STATS.verified / STATS.presaves) * 100)}%</div>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          className={`${styles.checkBtn} ${check === "checking" ? styles.checking : ""} ${check === "ok" ? styles.ok : ""} ${check === "fail" ? styles.fail : ""}`}
          onClick={runCheck}
          disabled={check === "checking"}
        >
          {check === "idle" && "Проверить через БРАТ-БОТа →"}
          {check === "checking" && "БРАТ-БОТ проверяет…"}
          {check === "ok" && "✓ Пресейв подтверждён"}
          {check === "fail" && "× Не найден — поставь пресейв"}
        </button>
        <a className={styles.presaveLink} href="https://music.yandex.ru/artist/7544304" target="_blank" rel="noopener noreferrer">Поставить пресейв на Яндексе →</a>
        <span className={styles.verifyHint}>верификация занимает ~3 сек · нужен ник Яндекс ID</span>
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
        <span className={styles.count}>{filtered.length} / 20 братух</span>
      </div>

      <div ref={tableRef} className={styles.tableWrap}>
        <div className={styles.tableHead}>
          <span className={styles.thRank}>#</span>
          <span className={styles.thUser}>Братуха</span>
          <span className={styles.thMeta}>Дата · город</span>
          <span className={styles.thStats}>Клипы · просмотры</span>
          <span className={styles.thStatus}>Статус</span>
        </div>
        <div className={styles.tableBody}>
          {filtered.map((r) => (
            <div key={r.rank} className={`${styles.row} ${r.rank <= 3 ? styles.topRow : ""}`}>
              <span className={styles.rank}>
                {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : `#${r.rank}`}
              </span>
              <span className={styles.user}>
                <span className={styles.avatar} aria-hidden>{r.avatar}</span>
                <span className={styles.nick}>{r.nick}</span>
              </span>
              <span className={styles.meta}>
                <span className={styles.date}>{r.date}</span>
                <span className={styles.city}>{r.city}</span>
              </span>
              <span className={styles.stats}>
                <span className={styles.clips}>{r.clips} клипов</span>
                <span className={styles.views}>{r.views.toLocaleString("ru-RU")} просм.</span>
              </span>
              <span className={`${styles.status} ${r.status === "топ" ? styles.sTop : r.status === "verified" ? styles.sVerified : styles.sPending}`}>
                {r.status === "топ" ? "★ ТОП" : r.status === "verified" ? "✓ VERIFIED" : "… PENDING"}
              </span>
            </div>
          ))}
          {filtered.length === 0 && <div className={styles.empty}>Никого не нашли — попробуй другой фильтр, братуха</div>}
        </div>
      </div>

      <div className={styles.foot}>
        <div className={styles.footCard}>
          <strong>Как попасть в топ?</strong> Поставь пресейв на Яндекс Музыке → нажми «Проверить через БРАТ-БОТа» → бот сверяет Яндекс ID → статус становится <em>verified</em>.
          Топ-3 получают рамку 42 на аву + респект в лиде.
        </div>
        <div className={styles.footStats}>
          Мок-данные: {STATS.clips.toLocaleString("ru-RU")} клипов · {(STATS.views).toLocaleString("ru-RU")} просмотров · обновлено 30.08.2026 · источник: БРАТ-БОТ + Яндекс Музыка API (заглушка)
        </div>
      </div>
    </div>
  );
}
