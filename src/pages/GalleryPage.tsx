import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import styles from "./GalleryPage.module.css";

// ─── типы и константы ─────────────────────────────────────

type Style42 = "СССР" | "Y2K" | "киберпанк" | "мемфис";
type FilterStyle = "все" | Style42;

const FILTERS: FilterStyle[] = ["все", "СССР", "Y2K", "киберпанк", "мемфис"];

interface Art42 {
  id: string;
  title: string;
  style: Style42;
  emoji: string;
  gradient: string;
  // путь под реальные файлы — положи арты в public/images/gallery-42/
  // напр. public/images/gallery-42/ussr-01.jpg и т.д.
  src: string;
  desc: string;
  tag: string;
}

const BASE_ARTS: Art42[] = [
  {
    id: "ussr-01",
    title: "Братуха на заводе",
    style: "СССР",
    emoji: "🏭",
    gradient: "linear-gradient(135deg,#ff2d55 0%,#8a162c 35%,#2b0e14 100%)",
    src: "/magnum/images/gallery-42/ussr-01.jpg",
    desc: "Плакат «42 удара в смену» — молот, неон и бетон.",
    tag: "агитплакат",
  },
  {
    id: "ussr-02",
    title: "Космос 42",
    style: "СССР",
    emoji: "🚀",
    gradient: "linear-gradient(135deg,#ff2d55 0%,#ff6b2d 35%,#1a1a2e 70%,#0a0a1a 100%)",
    src: "/magnum/images/gallery-42/ussr-02.jpg",
    desc: "Спутник с надписью «МАГНУМ — вперёд к звёздам».",
    tag: "космоплакат",
  },
  {
    id: "y2k-01",
    title: "Bling-бабл 42",
    style: "Y2K",
    emoji: "💿",
    gradient: "linear-gradient(135deg,#ffcc00 0%,#ff2d55 30%,#a855f7 65%,#22d3ee 100%)",
    src: "/magnum/images/gallery-42/y2k-01.jpg",
    desc: "Хром, глянец и Comic Sans — ностальгия 2007.",
    tag: "Y2K-bling",
  },
  {
    id: "y2k-02",
    title: "Флипфон 42",
    style: "Y2K",
    emoji: "📟",
    gradient: "linear-gradient(135deg,#00ff88 0%,#22d3ee 35%,#ff2d55 75%,#ffcc00 100%)",
    src: "/magnum/images/gallery-42/y2k-02.jpg",
    desc: "Раскладушка с монохромным экраном «42 пропущенных».",
    tag: "ретро-тек",
  },
  {
    id: "cyber-01",
    title: "Неон-Кузбасс 42",
    style: "киберпанк",
    emoji: "🌃",
    gradient: "linear-gradient(135deg,#0a0a0a 0%,#1a0a2e 25%,#ff2d55 55%,#00ff88 85%,#060a14 100%)",
    src: "/magnum/images/gallery-42/cyber-01.jpg",
    desc: "Кемерово 2142 — дождь, вывески и дрон с 42.",
    tag: "ночной город",
  },
  {
    id: "memphis-01",
    title: "Мемфис-мопс 42",
    style: "мемфис",
    emoji: "🎨",
    gradient: "linear-gradient(135deg,#ffcc00 0%,#ff2d55 25%,#00ff88 50%,#ff9ad5 75%,#5865f2 100%)",
    src: "/magnum/images/gallery-42/memphis-01.jpg",
    desc: "Сквот, точки, зигзаги — мопс в очках на фоне сетки.",
    tag: "мемфис-поп",
  },
];

// пул для мок-генерации — 42-agit-01 оптимизирован до 800px webp (3.4MB → 119KB)
const MOCK_POOL: Omit<Art42, "id">[] = [
  {
    title: "Ковёр 42",
    style: "СССР",
    emoji: "🧶",
    gradient: "linear-gradient(135deg,#8b1a2b,#d44d2a 40%,#1a1a1a 100%)",
    src: "/magnum/images/gallery-42/42-agit-01-800.webp",
    desc: "Ковёр на стене и братухи — уют по-магнумовски.",
    tag: "быт",
  },
  {
    title: "Тетрисуй 42",
    style: "Y2K",
    emoji: "🎮",
    gradient: "linear-gradient(135deg,#9147ff,#ff2d55 45%,#ffcc00 100%)",
    src: "/magnum/images/gallery-42/mock-tetris.jpg",
    desc: "Пиксели, сканлайны и цифра 42 из блоков.",
    tag: "пиксель",
  },
  {
    title: "Кибер-гараж",
    style: "киберпанк",
    emoji: "🏚️",
    gradient: "linear-gradient(135deg,#00ff88,#0a2e1a 40%,#ff2d55 80%,#000 100%)",
    src: "/magnum/images/gallery-42/mock-garage.jpg",
    desc: "Гараж с неоном и жигулями будущего.",
    tag: "гараж-панк",
  },
  {
    title: "Геометрия 42",
    style: "мемфис",
    emoji: "🔷",
    gradient: "linear-gradient(135deg,#ffcc00,#ff2d55 30%,#00ff88 60%,#7c3aed 100%)",
    src: "/magnum/images/gallery-42/mock-geo.jpg",
    desc: "Круги, треугольники и 42 как знак свободы.",
    tag: "паттерн",
  },
  {
    title: "Автомат 42",
    style: "СССР",
    emoji: "🥤",
    gradient: "linear-gradient(135deg,#ff2d55,#7a0a1a 40%,#c9c9c9 100%)",
    src: "/magnum/images/gallery-42/mock-soda.jpg",
    desc: "Газировка по 3 копейки — стакан гранёный.",
    tag: "автомат",
  },
  {
    title: "Тамагочи 42",
    style: "Y2K",
    emoji: "🥚",
    gradient: "linear-gradient(135deg,#ff9ad5,#ffcc00 35%,#00ff88 70%,#5865f2 100%)",
    src: "/magnum/images/gallery-42/mock-tama.jpg",
    desc: "Корми братуху каждые 42 минуты.",
    tag: "тамагочи",
  },
];

// ─── компонент ────────────────────────────────────────────

export function GalleryPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const lightboxCardRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  const [filter, setFilter] = useState<FilterStyle>("все");
  const [arts, setArts] = useState<Art42[]>(BASE_ARTS);
  const [selected, setSelected] = useState<Art42 | null>(null);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [imgError, setImgError] = useState<Record<string, boolean>>({});
  const genCounter = useRef(0);

  // фильтр
  const filtered = useMemo(() => {
    if (filter === "все") return arts;
    return arts.filter((a) => a.style === filter);
  }, [arts, filter]);

  // статистика по стилям
  const styleCounts = useMemo(() => {
    const m: Record<string, number> = { все: arts.length };
    for (const f of FILTERS.slice(1)) m[f] = arts.filter((a) => a.style === f).length;
    return m;
  }, [arts]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  // ── entrance анимация — spec: stagger 0.12, y 24→0, reduced-motion fallback, gsap.context cleanup
  useEffect(() => {
    if (!rootRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (prefersReduced) {
        gsap.set(`.${styles.header} > *`, { y: 0, opacity: 1, clearProps: "transform" });
        gsap.set(`.${styles.filterBar}`, { y: 0, opacity: 1, clearProps: "transform" });
        return;
      }
      gsap.set(`.${styles.header} > *`, { y: 24, opacity: 0 });
      gsap.to(`.${styles.header} > *`, {
        y: 0,
        opacity: 1,
        stagger: 0.12,
        duration: 0.55,
        ease: "power2.out",
        delay: 0.05,
      });
      gsap.set(`.${styles.filterBar}`, { y: 24, opacity: 0 });
      gsap.to(`.${styles.filterBar}`, {
        y: 0,
        opacity: 1,
        duration: 0.5,
        ease: "power2.out",
        delay: 0.3,
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  // ── карточки при смене фильтра / генерации — stagger 0.12 y 24→0, context cleanup
  useEffect(() => {
    if (!gridRef.current) return;
    const cards = cardsRef.current.filter(Boolean) as HTMLDivElement[];
    if (!cards.length) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      gsap.set(cards, { y: 0, opacity: 1, scale: 1, clearProps: "transform" });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        cards,
        { y: 24, opacity: 0, scale: 0.96 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.5,
          stagger: 0.12,
          ease: "back.out(1.2)",
          overwrite: true,
        }
      );
    }, gridRef);
    return () => ctx.revert();
  }, [filtered]);

  // ── RGB glow hover helpers
  const onCardEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = e.currentTarget;
    gsap.to(el, {
      y: -4,
      boxShadow: "0 12px 36px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,45,85,0.22), 0 0 28px rgba(255,45,85,0.22), 0 0 28px rgba(0,255,136,0.14), 0 0 32px rgba(255,204,0,0.10)",
      borderColor: "rgba(255,45,85,0.45)",
      duration: 0.3,
      ease: "power2.out",
      overwrite: true,
    });
    const glow = el.querySelector<HTMLElement>(`.${styles.cardGlow}`);
    if (glow) gsap.to(glow, { opacity: 1, duration: 0.3, ease: "power2.out", overwrite: true });
  }, []);
  const onCardLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(el, { clearProps: "boxShadow,borderColor" });
      return;
    }
    gsap.to(el, {
      y: 0,
      boxShadow: "0 0 0 1px transparent, 0 0 0 transparent",
      borderColor: "rgba(35,35,43,1)",
      duration: 0.4,
      ease: "power2.out",
      overwrite: true,
    });
    const glow = el.querySelector<HTMLElement>(`.${styles.cardGlow}`);
    if (glow) gsap.to(glow, { opacity: 0.95, duration: 0.4, ease: "power2.out", overwrite: true });
  }, []);

  // ── лайтбокс GSAP scale + body lock
  const openLightbox = useCallback((art: Art42) => {
    setSelected(art);
  }, []);

  const closeLightbox = useCallback(() => {
    if (!lightboxRef.current || !lightboxCardRef.current) {
      setSelected(null);
      return;
    }
    gsap.to(lightboxCardRef.current, {
      scale: 0.86,
      opacity: 0,
      duration: 0.28,
      ease: "power2.in",
    });
    gsap.to(lightboxRef.current, {
      opacity: 0,
      duration: 0.25,
      ease: "power2.in",
      onComplete: () => setSelected(null),
    });
  }, []);

  // открытие — анимация входа лайтбокса
  useEffect(() => {
    if (!selected) return;
    // лочим скролл
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // следующий тик — элементы в DOM
    requestAnimationFrame(() => {
      if (!lightboxRef.current || !lightboxCardRef.current) return;
      gsap.set(lightboxRef.current, { opacity: 0 });
      gsap.set(lightboxCardRef.current, { scale: 0.82, opacity: 0, y: 18 });
      gsap.to(lightboxRef.current, {
        opacity: 1,
        duration: 0.28,
        ease: "power2.out",
      });
      gsap.to(lightboxCardRef.current, {
        scale: 1,
        opacity: 1,
        y: 0,
        duration: 0.42,
        ease: "back.out(1.4)",
        delay: 0.06,
      });
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const idx = filtered.findIndex((a) => a.id === selected.id);
        if (idx === -1) return;
        const nextIdx =
          e.key === "ArrowRight"
            ? (idx + 1) % filtered.length
            : (idx - 1 + filtered.length) % filtered.length;
        setSelected(filtered[nextIdx]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [selected, filtered, closeLightbox]);

  // ── сгенерить ещё (мок)
  const handleGenerate = useCallback(() => {
    if (generating) return;
    setGenerating(true);
    showToast("42-нейросеть думает…");

    window.setTimeout(() => {
      const picks = [...MOCK_POOL].sort(() => 0.5 - Math.random()).slice(0, 2);
      const newArts: Art42[] = picks.map((p, i) => ({
        ...p,
        id: `gen-${Date.now()}-${genCounter.current++}-${i}`,
      }));
      setArts((prev) => [...prev, ...newArts]);
      setGenerating(false);
      showToast(`+${newArts.length} арта сгенерили — смотри внизу 🪄`);
      // лёгкий скролл к новым карточкам
      window.setTimeout(() => {
        gridRef.current?.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 250);
    }, 1200);
  }, [generating, showToast]);

  // высота заглушки по стилю — для цвета рамки
  const styleColor: Record<Style42, string> = {
    СССР: "#ff2d55",
    Y2K: "#ffcc00",
    киберпанк: "#00ff88",
    мемфис: "#ff9ad5",
  };

  return (
    <div className={styles.page} ref={rootRef}>
      {/* ── header ── */}
      <header className={styles.header}>
        <span className={styles.badge}>Галерея • 42-арты • RGB-неон</span>
        <h1 className={styles.title}>ГАЛЕРЕЯ 42</h1>
        <p className={styles.subtitle}>
          42 — это стиль. СССР-плакат, Y2K-хром, кибер-Кузбасс и мемфис-геометрия.
          Кликни арт — открой лайтбокс. Жми «Сгенерить ещё» — мок-дроп 2 артов.
        </p>
        <div className={styles.subtitleMeta}>
          <span className={styles.metaDot} aria-hidden />
          <span>
            Заглушки — CSS-градиенты + эмодзи. Подмени на файлы <code>public/images/gallery-42/*.jpg</code>
          </span>
        </div>
      </header>

      {/* ── статы ── */}
      <div className={styles.stats} aria-label="Статистика галереи">
        <div className={styles.stat}>
          <span className={styles.statNum}>{arts.length}</span>
          <span className={styles.statLabel}>артов всего</span>
        </div>
        <div className={styles.statDiv} />
        <div className={styles.stat}>
          <span className={styles.statNum}>{filtered.length}</span>
          <span className={styles.statLabel}>показано</span>
        </div>
        <div className={styles.statDiv} />
        <div className={styles.stat}>
          <span className={styles.statNum}>{styleCounts[filter] ?? 0}</span>
          <span className={styles.statLabel}>в фильтре «{filter}»</span>
        </div>
      </div>

      {/* ── фильтры ── */}
      <div className={styles.filterBar} role="toolbar" aria-label="Фильтр по стилю">
        <div className={styles.pills}>
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`${styles.pill} ${filter === f ? styles.pillActive : ""}`}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
            >
              <span className={styles.pillLabel}>{f}</span>
              <span className={styles.pillCount}>{styleCounts[f] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className={styles.filterRight}>
          <button
            type="button"
            className={`${styles.genBtn} ${generating ? styles.genBtnBusy : ""}`}
            onClick={handleGenerate}
            disabled={generating}
            aria-busy={generating}
          >
            <span className={styles.genIcon} aria-hidden>
              {generating ? "⏳" : "✨"}
            </span>
            {generating ? "Генерим…" : "Сгенерить ещё"}
          </button>
          <span className={styles.genHint}>мок · +2 арта</span>
        </div>
      </div>

      {/* ── сетка 3×2 ── */}
      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyEmoji}>🕳️</p>
          <p>В стиле «{filter}» пока пусто — сгенери или сбрось фильтр.</p>
          <div className={styles.emptyActions}>
            <button type="button" className={styles.btnGhost} onClick={() => setFilter("все")}>
              Показать все
            </button>
            <button type="button" className={styles.btnPrimary} onClick={handleGenerate} disabled={generating}>
              Сгенерить ещё
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.grid} ref={gridRef} aria-live="polite">
          {filtered.map((art, i) => (
            <div
              key={art.id}
              className={styles.card}
              ref={(el) => {
                cardsRef.current[i] = el;
              }}
              style={{ ["--accent42" as string]: styleColor[art.style] }}
              onClick={() => openLightbox(art)}
              onMouseEnter={onCardEnter}
              onMouseLeave={onCardLeave}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openLightbox(art);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`Открыть ${art.title} — ${art.style}`}
            >
              {/* glow */}
              <div className={styles.cardGlow} aria-hidden />

              {/* арт-обложка: градиент-заглушка + эмодзи + img под реальный файл */}
              <div className={styles.artWrap} style={{ background: art.gradient }}>
                {/* реальный файл — будет поверх градиента когда появится */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={art.src}
                  alt={art.title}
                  loading="lazy"
                  decoding="async"
                  className={`${styles.artImg} ${imgError[art.id] ? styles.artImgHidden : ""}`}
                  onError={() =>
                    setImgError((p) => ({
                      ...p,
                      [art.id]: true,
                    }))
                  }
                />
                {/* заглушка — всегда под img, видна пока файл 404 */}
                <span className={styles.artEmoji} aria-hidden>
                  {art.emoji}
                </span>
                <span className={styles.artBadge}>{art.style}</span>
                <span className={styles.artTag}>{art.tag}</span>
              </div>

              {/* подпись */}
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}>{art.title}</h3>
                <p className={styles.cardDesc}>{art.desc}</p>
                <div className={styles.cardFoot}>
                  <span className={styles.cardId}>#{art.id}</span>
                  <span className={styles.cardZoom} aria-hidden>
                    🔍 открыть
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── подсказки ── */}
      <div className={styles.hints}>
        <p>
          💡 Замени заглушки: положи реальные арты в <code>public/images/gallery-42/</code> с теми же именами
          (<code>ussr-01.jpg</code>, <code>y2k-01.jpg</code> …) — <code>&lt;img&gt;</code> подхватит автоматом.
          Есть готовые ассеты <code>postcard-4200.png</code> и <code>ai-bot-avatar.png</code> в{" "}
          <code>public/images/</code>.
        </p>
        <Link to="/magnum" className={styles.backLink}>
          ← На главную MAGNUM
        </Link>
      </div>

      {/* ── тост ── */}
      {toast && (
        <div className={styles.toast} role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {/* ── лайтбокс ── */}
      {selected && (
        <div
          className={styles.lightbox}
          ref={lightboxRef}
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label={selected.title}
        >
          <button
            type="button"
            className={styles.lbClose}
            onClick={closeLightbox}
            aria-label="Закрыть"
          >
            ×
          </button>

          {/* навигация если есть соседи */}
          {filtered.length > 1 && (
            <>
              <button
                type="button"
                className={`${styles.lbNav} ${styles.lbPrev}`}
                onClick={(e) => {
                  e.stopPropagation();
                  const idx = filtered.findIndex((a) => a.id === selected.id);
                  const prev = filtered[(idx - 1 + filtered.length) % filtered.length];
                  setSelected(prev);
                }}
                aria-label="Предыдущий"
              >
                ‹
              </button>
              <button
                type="button"
                className={`${styles.lbNav} ${styles.lbNext}`}
                onClick={(e) => {
                  e.stopPropagation();
                  const idx = filtered.findIndex((a) => a.id === selected.id);
                  const next = filtered[(idx + 1) % filtered.length];
                  setSelected(next);
                }}
                aria-label="Следующий"
              >
                ›
              </button>
            </>
          )}

          <div
            className={styles.lbCard}
            ref={lightboxCardRef}
            onClick={(e) => e.stopPropagation()}
            style={{ ["--accent42" as string]: styleColor[selected.style] }}
          >
            <div className={styles.lbArt} style={{ background: selected.gradient }}>
              <img
                src={selected.src}
                alt={selected.title}
                loading="lazy"
                decoding="async"
                className={`${styles.lbImg} ${imgError[selected.id] ? styles.artImgHidden : ""}`}
                onError={() =>
                  setImgError((p) => ({
                    ...p,
                    [selected.id]: true,
                  }))
                }
              />
              <span className={styles.lbEmoji} aria-hidden>
                {selected.emoji}
              </span>
            </div>
            <div className={styles.lbBody}>
              <div className={styles.lbTop}>
                <span className={styles.lbStyle} style={{ borderColor: styleColor[selected.style], color: styleColor[selected.style] }}>
                  {selected.style}
                </span>
                <span className={styles.lbTag}>{selected.tag}</span>
              </div>
              <h2 className={styles.lbTitle}>{selected.title}</h2>
              <p className={styles.lbDesc}>{selected.desc}</p>
              <p className={styles.lbMeta}>
                Файл: <code>{selected.src}</code> · id <code>{selected.id}</code>
              </p>
              <div className={styles.lbActions}>
                <button type="button" className={styles.btnPrimary} onClick={closeLightbox}>
                  Закрыть
                </button>
                <span className={styles.lbHint}>Esc · клик вне · ← →</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GalleryPage;
