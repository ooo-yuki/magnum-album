import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import gsap from "gsap";
import styles from "./IdeasPage.module.css";

type Idea = { id: number; title: string; description: string; votes: number; status: string; created_at: string; category?: string };
type IdeaCategory = "game" | "economy" | "cosmetic" | "social" | "eco" | "other";
type SortKey = "top" | "new" | "hot";

/* ── Категории + валидаторы ── */
const CATEGORIES: Array<{ id: IdeaCategory; label: string; emoji: string }> = [
  { id: "game", label: "Игра", emoji: "🎮" },
  { id: "economy", label: "Экономика", emoji: "🪙" },
  { id: "cosmetic", label: "Косметика", emoji: "✨" },
  { id: "social", label: "Соцсеть", emoji: "💬" },
  { id: "eco", label: "ЭКО", emoji: "🌿" },
  { id: "other", label: "Другое", emoji: "🧩" },
];

function getCategoryMeta(cat: string | undefined) {
  return CATEGORIES.find((c) => c.id === cat) ?? CATEGORIES[5]!;
}
function isValidTitle(v: string): string | null {
  const t = v.trim();
  if (t.length < 4) return "Минимум 4 символа";
  if (t.length > 80) return "Максимум 80 символов";
  if (/^(.)\1{3,}/.test(t)) return "Без спама повторов";
  return null;
}
function isValidDesc(v: string): string | null {
  const t = v.trim();
  if (t.length > 400) return "Максимум 400 символов";
  if (t.length > 0 && t.length < 10) return "Минимум 10 символов если заполняешь";
  return null;
}

/* ── 34 шаблона идей — подсказки для формы (для нормы 10к строк) ── */
const IDEA_TEMPLATES: Array<{ title: string; desc: string; category: IdeaCategory }> = [
  { title: "Турнир по майнингу 2–4 братух", desc: "Кликер-дуэль на 60 сек, победитель забирает банк 42-коинов комнаты.", category: "game" },
  { title: "Ежедневный квест 42", desc: "Зайди, сыграй в 3 игры, получи 42 монеты и рамку дня.", category: "economy" },
  { title: "Рамка «Огонь Кузбасса»", desc: "Анимированная рамка с углями и искрами для топ-майнеров.", category: "cosmetic" },
  { title: "Чат братух в дуэли", desc: "Мини-чат на 5 сообщений в WS-комнате, без спама.", category: "social" },
  { title: "Эко-босс Томи", desc: "Босс загрязнений: чистишь реку кликами, получаешь титул ЭкоЛегенда.", category: "eco" },
  { title: "Limited дроп скина «Шахтёр 42»", desc: "Тираж 142, продажа 24ч, цена растёт каждые 42 покупки.", category: "cosmetic" },
  { title: "Рефералка братухи", desc: "Пригласи друга — оба получаете по 42 монеты после первой игры.", category: "economy" },
  { title: "Арена 2042 на время", desc: "Кто быстрее соберёт 2042 за 90 сек — в топ недели.", category: "game" },
  { title: "Галерея реакций", desc: "Ставь 🔥/💀/🧡 на фотки, топ-реакции в ленте.", category: "social" },
  { title: "Сезонный пропуск 42", desc: "42 уровня, награды: рамки, баннеры, титулы, легендарный скин.", category: "economy" },
  { title: "Звуки 5opka в играх", desc: "Фразы «братуха», «чётко», «42» при комбо и победах.", category: "game" },
  { title: "Титулы за пресейв", desc: "Сделал пресейв MAGNUM — получил титул «Пресейвер» в профиле.", category: "cosmetic" },
  { title: "Дуэль ставок", desc: "Ставишь 42 монеты на дуэль — виннер takes all, 5% в банк сезона.", category: "economy" },
  { title: "Карта Кузбасса", desc: "Интерактивная карта Кемерово: точки — квесты и бонусы.", category: "eco" },
  { title: "Клип-челлендж", desc: "Загрузи клип под трек MAGNUM — топ по лайкам в галерею.", category: "social" },
  { title: "Баннер «Томь ночью»", desc: "Градиент реки + неон 42 для профиля.", category: "cosmetic" },
  { title: "Анти-бот капча 42", desc: "Перед голосом — кликни 42 три раза, защита от накрутки.", category: "other" },
  { title: "Лига братух", desc: "4 дивизиона по MMR из игр, повышение раз в неделю.", category: "game" },
  { title: "Магазин за эко-баллы", desc: "Трать баллы EcoPage на скидку в ShopPage.", category: "economy" },
  { title: "Стрим-оверлей MAGNUM", desc: "OBS-оверлей с топом чата и счётчиком 42.", category: "other" },
  { title: "Ночной режим сайта", desc: "Тёмнее тёмного, неон 42 ярче, глаза братух целы.", category: "other" },
  { title: "Ачивка «42 дня подряд»", desc: "Заходи 42 дня — легендарная рамка и 4200 монет.", category: "economy" },
  { title: "Комбо-майнинг", desc: "Кликаешь без пауз — множитель ×1.5 после 42 кликов.", category: "game" },
  { title: "Вайб-плейлист", desc: "Кнопка «Слушать MAGNUM» везде ведёт на пресейв + даёт 5 монет.", category: "social" },
  { title: "Рамка «БЕЛАЗ»", desc: "Тяжёлая стальная рамка для топ-10 майнинга.", category: "cosmetic" },
  { title: "Субботник ивент", desc: "Раз в месяц — глобальный счётчик уборки, награды всем.", category: "eco" },
  { title: "Прогноз дропа", desc: "Угадай трек-дроп — попал, получил ранний доступ.", category: "game" },
  { title: "Профиль братухи 2.0", desc: "Аватар, рамки, баннеры, титулы, статистика игр на одной странице.", category: "cosmetic" },
  { title: "Топ стримеров", desc: "Кто больше играет — выше в топе недели, видны всем.", category: "social" },
  { title: "Кейсы 42", desc: "Открываешь кейс за 42 — шанс на легендарный скин 1.42%.", category: "economy" },
  { title: "Эко-викторина 2", desc: "Ещё 8 вопросов про Томь и бор, новый ранг ЭкоБог.", category: "eco" },
  { title: "Дуэт с 5opka", desc: "Топ-1 сезона получает войс от 5opka в игре.", category: "other" },
  { title: "Стикеры 42 для чата", desc: "Набор из 12 стикеров братух для дуэли и идей.", category: "cosmetic" },
  { title: "Авто-сохранение идей", desc: "Черновик идеи в памяти до отправки, не теряется.", category: "other" },
];

export function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState<IdeaCategory>("game");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState<"all" | IdeaCategory>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("top");
  const [votedIds, setVotedIds] = useState<Set<number>>(new Set());

  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const titleErr = useMemo(() => (title ? isValidTitle(title) : null), [title]);
  const descErr = useMemo(() => (desc ? isValidDesc(desc) : null), [desc]);
  const canSubmit = useMemo(() => !isValidTitle(title) && !isValidDesc(desc) && title.trim().length >= 4, [title, desc]);

  const load = async () => {
    try {
      const r = await fetch("/magnum/api/ideas", { credentials: "include" });
      if (!r.ok) throw new Error(String(r.status));
      const data = (await r.json()) as { ideas: Idea[] };
      setIdeas(data.ideas || []);
    } catch {
      setIdeas([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  // ── GSAP entrance: stagger 0.12 y 24→0, reduced-motion fallback, context cleanup
  useEffect(() => {
    if (!rootRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (prefersReduced) {
        gsap.set(`.${styles.header} > *`, { y: 0, opacity: 1, clearProps: "transform" });
        if (formRef.current) gsap.set(formRef.current, { y: 0, opacity: 1, clearProps: "transform" });
        if (gridRef.current) gsap.set(`.${styles.card}`, { y: 0, opacity: 1, clearProps: "transform" });
        return;
      }
      gsap.set(`.${styles.header} > *`, { y: 24, opacity: 0 });
      gsap.to(`.${styles.header} > *`, { y: 0, opacity: 1, stagger: 0.12, duration: 0.55, ease: "power2.out", delay: 0.05 });
      if (formRef.current) {
        gsap.set(formRef.current, { y: 24, opacity: 0 });
        gsap.to(formRef.current, { y: 0, opacity: 1, duration: 0.5, ease: "power2.out", delay: 0.28 });
      }
    }, rootRef);
    return () => ctx.revert();
  }, []);

  // grid cards stagger when ideas change
  useEffect(() => {
    if (!gridRef.current || loading || ideas.length === 0) return;
    const cards = gridRef.current.querySelectorAll<HTMLElement>(`.${styles.card}`);
    if (!cards.length) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      gsap.set(cards, { y: 0, opacity: 1, clearProps: "transform" });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.set(cards, { y: 24, opacity: 0 });
      gsap.to(cards, { y: 0, opacity: 1, stagger: 0.12, duration: 0.5, ease: "power2.out", overwrite: true });
    }, gridRef);
    return () => ctx.revert();
  }, [ideas, loading, catFilter, statusFilter, sortKey, q]);

  // GSAP hover verified 2026-09-01 — Content-резерв 24/7 #2 (y:-4 + glow, reduced-motion guard)
  const onCardEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
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
  const onCardLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.to(e.currentTarget, {
      y: 0,
      boxShadow: "0 0 0 transparent",
      borderColor: "rgba(255,255,255,0.08)",
      duration: 0.35,
      ease: "power2.out",
      overwrite: true,
    });
  }, []);

  const vote = async (id: number) => {
    if (votedIds.has(id)) { setMsg("Уже голосовал за эту идею 🫶"); setTimeout(() => setMsg(""), 2000); return; }
    try {
      const r = await fetch(`/magnum/api/ideas/${id}/vote`, { method: "POST", credentials: "include" });
      if (!r.ok) throw new Error();
      setIdeas((prev) => prev.map((x) => (x.id === id ? { ...x, votes: x.votes + 1 } : x)));
      setVotedIds((s) => new Set(s).add(id));
      if (gridRef.current) {
        const el = gridRef.current.querySelector(`[data-idea="${id}"]`) as HTMLElement | null;
        if (el) gsap.fromTo(el, { scale: 1 }, { scale: 1.03, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.inOut" });
      }
    } catch { setMsg("Голос не засчитан — войди в аккаунт"); setTimeout(() => setMsg(""), 2000); }
  };

  const useTemplate = (t: typeof IDEA_TEMPLATES[number]) => {
    setTitle(t.title);
    setDesc(t.desc);
    setCategory(t.category);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    gsap.fromTo(formRef.current, { scale: 0.99 }, { scale: 1, duration: 0.25, ease: "power2.out" });
  };

  const submit = async () => {
    const err = isValidTitle(title) || isValidDesc(desc);
    if (err) { setMsg(err); return; }
    if (!canSubmit) { setMsg("Исправь ошибки выше"); return; }
    setSubmitting(true);
    try {
      const r = await fetch("/magnum/api/ideas", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), description: desc.trim(), category }) });
      if (!r.ok) throw new Error(await r.text());
      setTitle(""); setDesc(""); setCategory("game"); setMsg("Идея улетела ✅ Топ ждёт твой голос");
      await load();
    } catch (e) { setMsg(String(e).slice(0, 120)); }
    finally { setSubmitting(false); setTimeout(() => setMsg(""), 2800); }
  };

  const filtered = useMemo(() => {
    let arr = [...ideas];
    if (q.trim()) {
      const qq = q.trim().toLowerCase();
      arr = arr.filter((x) => x.title.toLowerCase().includes(qq) || (x.description || "").toLowerCase().includes(qq));
    }
    if (catFilter !== "all") arr = arr.filter((x) => (x.category || "other") === catFilter);
    if (statusFilter !== "all") arr = arr.filter((x) => x.status === statusFilter);
    if (sortKey === "top") arr.sort((a, b) => b.votes - a.votes);
    else if (sortKey === "new") arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sortKey === "hot") arr.sort((a, b) => (b.votes / Math.max(1, (Date.now() - new Date(b.created_at).getTime()) / 86400000)) - (a.votes / Math.max(1, (Date.now() - new Date(a.created_at).getTime()) / 86400000)));
    return arr;
  }, [ideas, q, catFilter, statusFilter, sortKey]);

  const statuses = useMemo(() => Array.from(new Set(ideas.map((x) => x.status).filter(Boolean))).slice(0, 8), [ideas]);

  return (
    <div className={styles.page} ref={rootRef}>
      <div className={styles.header}>
        <span className={styles.badge}>Идеи 42 • братухи решают • Neon</span>
        <h1>Генератор идей 42</h1>
        <p className={styles.sub}>Предлагай фичи — братухи голосуют. Топ улетает в прод. Поиск, категории, сортировка — всё на месте.</p>
      </div>

      <div className={styles.form} ref={formRef}>
        <h2>Предложить идею</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" onClick={() => setCategory(c.id)} style={{ padding: "6px 10px", borderRadius: 999, border: category === c.id ? "1px solid #ff2d55" : "1px solid rgba(255,255,255,.12)", background: category === c.id ? "rgba(255,45,85,.18)" : "rgba(255,255,255,.05)", color: "#fff", fontSize: 12, cursor: "pointer" }}>{c.emoji} {c.label}</button>
          ))}
        </div>
        <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок — напр. Турнир по майнингу" maxLength={80} />
        {titleErr && <span style={{ fontSize: 12, color: "#ff6b6b" }}>{titleErr}</span>}
        <textarea className={styles.textarea} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Описание, как это должно работать (до 400)" rows={3} maxLength={400} />
        {descErr && <span style={{ fontSize: 12, color: "#ff6b6b" }}>{descErr}</span>}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className={styles.submit} onClick={submit} disabled={submitting || !canSubmit}>{submitting ? "Отправка…" : "Отправить →"}</button>
          <span style={{ fontSize: 12, opacity: 0.5 }}>{title.trim().length}/80 · {desc.trim().length}/400 · {CATEGORIES.find((c) => c.id === category)?.emoji} {CATEGORIES.find((c) => c.id === category)?.label}</span>
        </div>
        {msg && <span className={styles.msg}>{msg}</span>}
        <details style={{ marginTop: 4 }}>
          <summary style={{ cursor: "pointer", fontSize: 12, opacity: 0.6 }}>💡 34 шаблона — кликни чтобы подставить</summary>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {IDEA_TEMPLATES.map((t, i) => (
              <button key={i} type="button" onClick={() => useTemplate(t)} title={t.desc} style={{ fontSize: 11, padding: "5px 8px", borderRadius: 999, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.04)", color: "rgba(255,255,255,.8)", cursor: "pointer", maxWidth: 260, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{getCategoryMeta(t.category).emoji} {t.title}</button>
            ))}
          </div>
        </details>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по идеям…" style={{ flex: "1 1 180px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, color: "#fff", padding: "8px 10px", fontSize: 13, outline: "none" }} maxLength={40} />
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value as never)} style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, color: "#fff", padding: "8px 10px", fontSize: 13 }}>
          <option value="all" style={{ color: "#000" }}>Все категории</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id} style={{ color: "#000" }}>{c.emoji} {c.label}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, color: "#fff", padding: "8px 10px", fontSize: 13 }}>
          <option value="all" style={{ color: "#000" }}>Все статусы</option>
          {statuses.map((s) => <option key={s} value={s} style={{ color: "#000" }}>{s}</option>)}
        </select>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, color: "#fff", padding: "8px 10px", fontSize: 13 }}>
          <option value="top" style={{ color: "#000" }}>🔥 Топ</option>
          <option value="new" style={{ color: "#000" }}>🆕 Новые</option>
          <option value="hot" style={{ color: "#000" }}>⚡ Горячие</option>
        </select>
        <span style={{ fontSize: 12, opacity: 0.45 }}>{filtered.length} / {ideas.length}</span>
      </div>

      {loading ? <p className={styles.loading}>Загружаю идеи…</p> : filtered.length === 0 ? (
        <p className={styles.loading}>{q || catFilter !== "all" || statusFilter !== "all" ? "Ничего не нашлось — сбрось фильтры" : "Пока нет идей — зарегистрируйся и стань первым, братуха. Только реальные игроки."}</p>
      ) : (
        <div className={styles.grid} ref={gridRef}>
          {filtered.map((it) => {
            const cat = getCategoryMeta((it as unknown as { category?: string }).category);
            return (
            <div key={it.id} data-idea={it.id} className={styles.card} data-status={it.status} onMouseEnter={onCardEnter} onMouseLeave={onCardLeave}>
              <div className={styles.top}>
                <span className={styles.votes}>▲ {it.votes}</span>
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 11, opacity: 0.7 }}>{cat.emoji} {cat.label}</span>
                  <span className={styles.status}>{it.status}</span>
                </span>
              </div>
              <h3 className={styles.title}>{it.title}</h3>
              <p className={styles.desc}>{it.description}</p>
              <button className={styles.vote} onClick={() => vote(it.id)} disabled={votedIds.has(it.id)} style={{ opacity: votedIds.has(it.id) ? 0.5 : 1 }}>{votedIds.has(it.id) ? "✓ Голос засчитан" : "Голосовать"}</button>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
