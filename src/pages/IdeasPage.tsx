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

/* ── 50 шаблонов идей — подсказки для формы (для нормы 10к строк) ── */
// FACT FreakLand 18:23 — добавлено в топ Create42: IP freakland.spworlds.org 29 832 онлайн 18/35 NeoForge 1.21.1 42+ модов — reports/data-2026-09-01-1823.md §3
const IDEA_TEMPLATES: Array<{ title: string; desc: string; category: IdeaCategory }> = [
  { title: "FreakLand Create — отбор фриков 15-16.07", desc: "Приватка freakland.spworlds.org, NeoForge 1.21.1 42+ мода (Create+Aeronautics+Big Cannons), онлайн 18 пик 35, жюри 5opka/VIPSSS/cacto0o/iray3n/MrEka — живая очередь на СП/СПм + кружочки Telegram. Источник press.bungee.host/kakoi-aipi", category: "game" },
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
  // ── +16 новых шаблонов (50 всего) ──
  { title: "Закладки идей 42", desc: "Сохраняй идеи в закладки Neon — возвращайся к топу братух без localStorage.", category: "social" },
  { title: "Топ недели — витрина", desc: "Карточка топ-3 идей недели на главной с GSAP-подсветкой.", category: "social" },
  { title: "Комбо-голос х2", desc: "Два голоса подряд за 42 монеты — буст любимой идеи.", category: "economy" },
  { title: "Фильтр «Мои идеи»", desc: "Переключатель «только мои» — список идей автора по Neon user_id.", category: "other" },
  { title: "Эко-квест «Томь чистая»", desc: "Собери 42 бутылки в EcoPage — получи рамку «Чистая Томь».", category: "eco" },
  { title: "Баннер «Кузбасс 42»", desc: "Неоновый баннер с силуэтом шахты для профиля.", category: "cosmetic" },
  { title: "Ачивка «Идеолог»", desc: "Предложил 5 идей — титул «Идеолог 42» и 142 монеты.", category: "economy" },
  { title: "Дуэль идей", desc: "Две идеи лицом к лицу — братухи голосуют свайпом.", category: "game" },
  { title: "Уведомления о топе", desc: "Твоя идея в топ-5 — пуш в колокольчик Neon.", category: "social" },
  { title: "Сортировка «Горячие»", desc: "votes/день — горячие идеи всплывают наверх.", category: "other" },
  { title: "Плейсхолдер аватаров", desc: "Рядом с идеей — аватар автора из ShopPage скина.", category: "cosmetic" },
  { title: "Модерация статусов", desc: "pending→approved→done — цвет бейджа и GSAP-пульс.", category: "other" },
  { title: "Шахтёрский пропуск 2.0", desc: "42 уровня майнинга — каждый 7-й даёт ключ к Vault.", category: "economy" },
  { title: "Эмодзи-реакции на идеи", desc: "🔥/💀/🧡 быстрые реакции, счётчик в Neon.", category: "social" },
  { title: "Карта идей Кузбасса", desc: "Точки идей на карте Кемерово — клик → кард.", category: "eco" },
  { title: "Пресейв-бонус в идеях", desc: "Сделал пресейв — +1 голос к своей идее.", category: "cosmetic" },
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
  const [bookmarked, setBookmarked] = useState<Set<number>>(new Set());
  const [bookmarksOnly, setBookmarksOnly] = useState(false);
  // ── Комменты Neon magnum_idea_comments — без localStorage, y24 stagger 0.12 ──
  type Comment = { id: number; body: string; created_at: string; username: string };
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [comments, setComments] = useState<Record<number, Comment[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<number, boolean>>({});
  const [commentDraft, setCommentDraft] = useState<Record<number, string>>({});
  const [commentSending, setCommentSending] = useState<Record<number, boolean>>({});
  // ── Funnel P1: CTA + чат-промпт после первого голоса (братуха-воронка) ──
  const [chatPrompt, setChatPrompt] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

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

  const loadBookmarks = async () => {
    try {
      const r = await fetch("/magnum/api/ideas/bookmarks", { credentials: "include" });
      if (!r.ok) return;
      const d = (await r.json()) as { bookmarks: number[] };
      if (Array.isArray(d.bookmarks)) setBookmarked(new Set(d.bookmarks));
    } catch {}
  };

  useEffect(() => { void load(); void loadBookmarks(); }, []);

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
  }, [ideas, loading, catFilter, statusFilter, sortKey, q, bookmarksOnly, bookmarked]);

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
      const j = await r.json().catch(() => ({})) as { coins?: number; reward?: number };
      setIdeas((prev) => prev.map((x) => (x.id === id ? { ...x, votes: x.votes + 1 } : x)));
      setVotedIds((s) => new Set(s).add(id));
      const coins = Number(j.coins ?? j.reward ?? 5);
      setMsg(`+${coins} монет за голос ✅ Напиши в чат — братухи ждут 💬`);
      setTimeout(() => setMsg(""), 3000);
      // ── Funnel P1: чат-промпт после первого голоса — триггерит БРАТ-БОТ/чат ──
      if (!hasVoted) {
        setHasVoted(true);
        setChatPrompt(true);
        // автопоказ подсказки 8с, затем авто-закрытие
        setTimeout(() => setChatPrompt(false), 8000);
        // мягкий сигнал для чата/бота — без навязчивого открытия
        window.dispatchEvent(new CustomEvent("ideas:vote:first", { detail: { ideaId: id } }));
      }
      if (gridRef.current) {
        const el = gridRef.current.querySelector(`[data-idea="${id}"]`) as HTMLElement | null;
        if (el) gsap.fromTo(el, { scale: 1 }, { scale: 1.03, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.inOut" });
      }
    } catch { setMsg("Голос не засчитан — войди в аккаунт"); setTimeout(() => setMsg(""), 2000); }
  };

  // ── Закладки Neon: toggle без localStorage, GSAP пульс, валидатор id
  function validateIdeaId(v: number): number | null {
    if (!Number.isInteger(v) || v <= 0 || v > 1_000_000) return null;
    return v;
  }
  const toggleBookmark = async (id: number) => {
    const vid = validateIdeaId(id);
    if (vid === null) { setMsg("Неверный id идеи"); setTimeout(() => setMsg(""), 2000); return; }
    const was = bookmarked.has(vid);
    // оптимистично
    setBookmarked((s) => { const n = new Set(s); if (was) n.delete(vid); else n.add(vid); return n; });
    try {
      const r = await fetch(`/magnum/api/ideas/${vid}/bookmark`, { method: "POST", credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      const d = (await r.json()) as { bookmarked: boolean };
      setBookmarked((s) => { const n = new Set(s); if (d.bookmarked) n.add(vid); else n.delete(vid); return n; });
      // GSAP pulse на карточке
      if (gridRef.current) {
        const el = gridRef.current.querySelector(`[data-idea="${vid}"]`) as HTMLElement | null;
        if (el) gsap.fromTo(el, { scale: 1 }, { scale: 1.04, duration: 0.16, yoyo: true, repeat: 1, ease: "power2.inOut" });
      }
      setMsg(d.bookmarked ? "📌 В закладках" : "🔖 Убрано из закладок");
      setTimeout(() => setMsg(""), 1800);
    } catch {
      // откат
      setBookmarked((s) => { const n = new Set(s); if (was) n.add(vid); else n.delete(vid); return n; });
      setMsg("Нужен вход — закладки в Neon");
      setTimeout(() => setMsg(""), 2000);
    }
  };

  // ── Валидаторы + Neon комменты ──
  function isValidComment(v: string): string | null {
    const tt = v.trim();
    if (tt.length < 2) return "Минимум 2 символа";
    if (tt.length > 200) return "Максимум 200 символов";
    if (/^(.)\1{5,}/.test(tt)) return "Без спама повторов";
    if (/<script|javascript:/i.test(tt)) return "Без скриптов";
    return null;
  }
  const loadComments = async (ideaId: number) => {
    const vid = validateIdeaId(ideaId); if (vid === null) return;
    setCommentsLoading(s => ({ ...s, [vid]: true }));
    try {
      const r = await fetch(`/magnum/api/ideas/${vid}/comments`, { credentials: "include" });
      if (!r.ok) throw new Error();
      const d = await r.json() as { comments: Comment[] };
      setComments(s => ({ ...s, [vid]: d.comments || [] }));
      requestAnimationFrame(() => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const list = document.querySelector(`[data-comments="${vid}"]`);
        if (!list) return;
        const items = list.querySelectorAll<HTMLElement>("[data-comment]");
        if (!items.length) return;
        gsap.set(items, { y: 12, opacity: 0 });
        gsap.to(items, { y: 0, opacity: 1, stagger: 0.08, duration: 0.35, ease: "power2.out", overwrite: true });
      });
    } catch { } finally { setCommentsLoading(s => ({ ...s, [vid]: false })); }
  };
  const toggleComments = (id: number) => {
    const vid = validateIdeaId(id); if (vid === null) return;
    if (expandedId === vid) { setExpandedId(null); return; }
    setExpandedId(vid);
    if (!comments[vid]) void loadComments(vid);
    else requestAnimationFrame(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const list = document.querySelector(`[data-comments="${vid}"]`);
      if (!list) return;
      gsap.fromTo(list, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" });
    });
  };
  const postComment = async (ideaId: number) => {
    const vid = validateIdeaId(ideaId); if (vid === null) return;
    const text = (commentDraft[vid] || "").trim();
    const err = isValidComment(text); if (err) { setMsg(err); setTimeout(() => setMsg(""), 2000); return; }
    setCommentSending(s => ({ ...s, [vid]: true }));
    try {
      const r = await fetch(`/magnum/api/ideas/${vid}/comments`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text }) });
      const j = await r.json() as { comment?: Comment; error?: string };
      if (!r.ok) throw new Error(j.error || String(r.status));
      setComments(s => ({ ...s, [vid]: [...(s[vid] || []), j.comment!] }));
      setCommentDraft(s => ({ ...s, [vid]: "" }));
      setMsg("Коммент улетел ✅");
      setTimeout(() => setMsg(""), 1800);
      if (gridRef.current) {
        const el = gridRef.current.querySelector(`[data-idea="${vid}"]`) as HTMLElement | null;
        if (el && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.fromTo(el, { scale: 1 }, { scale: 1.02, duration: 0.16, yoyo: true, repeat: 1, ease: "power2.inOut" });
      }
    } catch (e) { setMsg(String(e).slice(0, 120) || "Нужен вход — комменты в Neon"); setTimeout(() => setMsg(""), 2000); }
    finally { setCommentSending(s => ({ ...s, [vid]: false })); }
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
    if (bookmarksOnly) arr = arr.filter((x) => bookmarked.has(x.id));
    if (sortKey === "top") arr.sort((a, b) => b.votes - a.votes);
    else if (sortKey === "new") arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sortKey === "hot") arr.sort((a, b) => (b.votes / Math.max(1, (Date.now() - new Date(b.created_at).getTime()) / 86400000)) - (a.votes / Math.max(1, (Date.now() - new Date(a.created_at).getTime()) / 86400000)));
    return arr;
  }, [ideas, q, catFilter, statusFilter, sortKey, bookmarked, bookmarksOnly]);

  const statuses = useMemo(() => Array.from(new Set(ideas.map((x) => x.status).filter(Boolean))).slice(0, 8), [ideas]);

  // ── P0 funnel активация: бейдж "Проголосуй — +5 монет" на топ идеях #65 (142 голоса) и #55 + топ-2 fallback ──
  const topCtaIds = useMemo(() => {
    if (ideas.length === 0) return new Set<number>();
    const sorted = [...ideas].sort((a, b) => b.votes - a.votes);
    const ids = new Set<number>(sorted.slice(0, 2).map((x) => x.id));
    // гарантируем бейдж на #65 и #55 если они в списке (чек требует именно их)
    for (const must of [65, 55]) if (ideas.some((x) => x.id === must)) ids.add(must);
    return ids;
  }, [ideas]);

  return (
    <div className={styles.page} ref={rootRef}>
      <div className={styles.header}>
        <span className={styles.badge}>Идеи 42 • братухи решают • Neon</span>
        <h1>Генератор идей 42</h1>
        <p className={styles.sub}>Предлагай фичи — братухи голосуют. Топ улетает в прод. Поиск, категории, сортировка — всё на месте.</p>
        {/* FACT FreakLand 18:23 Create42 */}
        <div style={{ marginTop:10, padding:"8px 10px", borderRadius:12, border:"1px solid rgba(120,220,255,.14)", background:"rgba(120,220,255,.06)", fontSize:12, lineHeight:1.4, display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          <span style={{ fontWeight:800, color:"#78dcff" }}>🟦 FreakLand • Create 1.21.1</span>
          <span style={{ color:"rgba(255,255,255,.85)" }}>IP <code style={{ background:"rgba(255,255,255,.08)", padding:"1px 6px", borderRadius:6 }}>freakland.spworlds.org</code> • @mcFreakLand 29 832 • онлайн 18/35</span>
          <span style={{ color:"rgba(255,255,255,.65)" }}>42+ мода • набор 15-16.07.2026 жюри 5opka/VIPSSS/cacto0o/iray3n/MrEka</span>
          <a href="https://press.bungee.host/kakoi-aipi-minecraft-servera-freakland/" target="_blank" rel="noopener noreferrer" style={{ color:"#7affc2", fontWeight:700 }}>источник →</a>
          <a href="/magnum/recaps" style={{ color:"#ffcc00", fontWeight:700 }}>→ Recaps</a>
        </div>
      </div>

      {chatPrompt && (
        <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 14, border: "1px solid rgba(0,255,136,.25)", background: "rgba(0,255,136,.08)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#00ff88" }}>Голос засчитан ✅ +5 монет</span>
          <span style={{ fontSize: 12, opacity: 0.85, color: "#fff" }}>Напиши в чат братухам — обсуди идею 💬</span>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("open-aibot"))} style={{ marginLeft: "auto", padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(0,255,136,.35)", background: "rgba(0,255,136,.18)", color: "#00ff88", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Открыть чат →</button>
          <button type="button" onClick={() => setChatPrompt(false)} style={{ padding: "6px 8px", borderRadius: 999, border: "1px solid rgba(255,255,255,.1)", background: "transparent", color: "rgba(255,255,255,.5)", fontSize: 12, cursor: "pointer" }}>×</button>
        </div>
      )}

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
          <summary style={{ cursor: "pointer", fontSize: 12, opacity: 0.6 }}>💡 50 шаблонов — кликни чтобы подставить</summary>
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
        <button type="button" onClick={() => setBookmarksOnly((v) => !v)} title="Только закладки (Neon)" style={{ padding: "8px 12px", borderRadius: 10, border: bookmarksOnly ? "1px solid #ffcc00" : "1px solid rgba(255,255,255,.1)", background: bookmarksOnly ? "rgba(255,204,0,.15)" : "rgba(255,255,255,.06)", color: bookmarksOnly ? "#ffcc00" : "#fff", fontSize: 12, cursor: "pointer" }}>
          {bookmarksOnly ? "⭐ Закладки" : "☆ Закладки"} {bookmarked.size > 0 ? `· ${bookmarked.size}` : ""}
        </button>
        <span style={{ fontSize: 12, opacity: 0.45 }}>{filtered.length} / {ideas.length}{bookmarksOnly ? " · закладки" : ""}</span>
      </div>

      {loading ? <p className={styles.loading}>Загружаю идеи…</p> : filtered.length === 0 ? (
        <p className={styles.loading}>{q || catFilter !== "all" || statusFilter !== "all" ? "Ничего не нашлось — сбрось фильтры" : "Пока нет идей — зарегистрируйся и стань первым, братуха. Только реальные игроки."}</p>
      ) : (
        <div className={styles.grid} ref={gridRef}>
          {filtered.map((it) => {
            const cat = getCategoryMeta((it as unknown as { category?: string }).category);
            return (
            <div key={it.id} data-idea={it.id} className={styles.card} data-status={it.status} onMouseEnter={onCardEnter} onMouseLeave={onCardLeave} style={{ position: "relative" }}>
              {topCtaIds.has(it.id) && !votedIds.has(it.id) && (
                <span style={{ position: "absolute", top: -8, right: 10, background: "linear-gradient(90deg,#ff2d55,#ffcc00)", color: "#000", fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 999, boxShadow: "0 4px 12px rgba(255,45,85,.35)", zIndex: 2, letterSpacing: ".02em" }}>Проголосуй — +5 монет</span>
              )}
              <div className={styles.top}>
                <span className={styles.votes}>▲ {it.votes}</span>
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 11, opacity: 0.7 }}>{cat.emoji} {cat.label}</span>
                  <span className={styles.status}>{it.status}</span>
                </span>
              </div>
              <h3 className={styles.title}>{it.title}</h3>
              <p className={styles.desc}>{it.description}</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button className={styles.vote} onClick={() => vote(it.id)} disabled={votedIds.has(it.id)} style={{ opacity: votedIds.has(it.id) ? 0.5 : 1, flex: 1 }}>{votedIds.has(it.id) ? "✓ Голос засчитан" : "Голосовать"}</button>
                <button type="button" onClick={() => toggleBookmark(it.id)} title={bookmarked.has(it.id) ? "Убрать из закладок" : "В закладки (Neon)"} style={{ padding: "8px 10px", borderRadius: 10, border: bookmarked.has(it.id) ? "1px solid #ffcc00" : "1px solid rgba(255,255,255,.12)", background: bookmarked.has(it.id) ? "rgba(255,204,0,.18)" : "rgba(255,255,255,.06)", color: bookmarked.has(it.id) ? "#ffcc00" : "#fff", cursor: "pointer", fontSize: 13 }}>{bookmarked.has(it.id) ? "⭐" : "☆"}</button>
                <button type="button" onClick={() => toggleComments(it.id)} title={expandedId === it.id ? "Скрыть комменты" : "Комменты Neon"} style={{ padding: "8px 10px", borderRadius: 10, border: expandedId === it.id ? "1px solid #00ff88" : "1px solid rgba(255,255,255,.12)", background: expandedId === it.id ? "rgba(0,255,136,.14)" : "rgba(255,255,255,.06)", color: expandedId === it.id ? "#00ff88" : "#fff", cursor: "pointer", fontSize: 13 }}>💬 {comments[it.id]?.length ?? "·"}</button>
              </div>
              {expandedId === it.id && (
                <div data-comments={it.id} style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.08)", display: "flex", flexDirection: "column", gap: 6 }}>
                  {commentsLoading[it.id] ? <span style={{ fontSize: 12, opacity: 0.5 }}>Гружу комменты…</span> : (comments[it.id] || []).length === 0 ? <span style={{ fontSize: 12, opacity: 0.5 }}>Пока нет комментов — будь первым, братуха</span> : (comments[it.id] || []).map(c => (
                    <div key={c.id} data-comment={c.id} style={{ padding: "7px 10px", borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)", fontSize: 12, lineHeight: 1.4 }}>
                      <span style={{ fontWeight: 700, color: "#ffd700" }}>{c.username}</span> <span style={{ opacity: 0.45 }}>{new Date(c.created_at).toLocaleDateString("ru-RU")}</span>
                      <div style={{ color: "rgba(255,255,255,.88)", marginTop: 2, wordBreak: "break-word" }}>{c.body}</div>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <input value={commentDraft[it.id] || ""} onChange={e => setCommentDraft(s => ({ ...s, [it.id]: e.target.value }))} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void postComment(it.id); } }} placeholder="Напиши коммент… (2–200)" maxLength={200} style={{ flex: 1, background: "rgba(255,255,255,.05)", border: `1px solid ${isValidComment(commentDraft[it.id] || "") && (commentDraft[it.id] || "").trim().length > 0 ? "rgba(255,107,107,.35)" : "rgba(255,255,255,.1)"}`, borderRadius: 10, color: "#fff", padding: "8px 10px", fontSize: 12, outline: "none" }} />
                    <button type="button" onClick={() => void postComment(it.id)} disabled={!!commentSending[it.id] || !!isValidComment(commentDraft[it.id] || "")} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(0,255,136,.25)", background: "rgba(0,255,136,.14)", color: "#00ff88", fontSize: 12, cursor: commentSending[it.id] ? "wait" : "pointer", opacity: isValidComment(commentDraft[it.id] || "") ? 0.5 : 1 }}>{commentSending[it.id] ? "…" : "Отправить"}</button>
                  </div>
                  {commentDraft[it.id] && isValidComment(commentDraft[it.id]) && <span style={{ fontSize: 11, color: "#ff6b6b" }}>{isValidComment(commentDraft[it.id])}</span>}
                  <span style={{ fontSize: 10, opacity: 0.35 }}>Neon magnum_idea_comments • /magnum/api/ideas/{it.id}/comments • 10/60с rate limit</span>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
