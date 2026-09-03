import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { useMe, GuestGate } from "../components/GuestGate";
import { subscribe as subscribeCoins } from "../lib/coins";
import { WorkshopDrone } from "../components/WorkshopDrone";
import { WorkshopSkillsShop } from "../components/WorkshopSkillsShop";

const WORKSHOP_COST = 199;
const WORKSHOP_ORIGINAL_PRICE = 999;
const WORKSHOP_DISCOUNT_PCT = Math.round((1 - WORKSHOP_COST / WORKSHOP_ORIGINAL_PRICE) * 100);

const IDEAS = [
  "Игра-кликер со счётчиком и уровнями",
  "Таймер Помодоро с уведомлением",
  "Генератор случайных цитат",
  "Мини-калькулятор чаевых",
  "Список задач с drag&drop",
  "Простой пиксель-арт редактор",
];

type OwnProject = {
  id: number;
  prompt: string;
  title: string | null;
  status: string;
  previewUrl: string | null;
  likes: number;
  createdAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "в очереди…",
  generating: "агент пишет код…",
  ready: "готово ✅",
  failed: "ошибка ❌",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "#9aa4b2", generating: "#ffcc00", ready: "#00ff88", failed: "#ff2d55",
};

export function WorkshopPage() {
  const me = useMe();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const projectsRef = useRef<HTMLDivElement>(null);
  const [prompt, setPrompt] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [needAuth, setNeedAuth] = useState(false);
  const [projects, setProjects] = useState<OwnProject[]>([]);

  useEffect(() => subscribeCoins(setBalance), []);

  const fetchProjects = useCallback(async () => {
    if (!me) return;
    try {
      const r = await fetch("/magnum/api/workshop/list", { credentials: "include" });
      if (!r.ok) return;
      const j = (await r.json()) as { projects?: OwnProject[] };
      if (Array.isArray(j.projects)) setProjects(j.projects);
    } catch {}
  }, [me]);

  useEffect(() => { void fetchProjects(); }, [fetchProjects]);

  useEffect(() => {
    if (!rootRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      if (heroRef.current) {
        const heroItems = heroRef.current.querySelectorAll("[data-hero-item]");
        tl.set(heroItems, { y: 26, opacity: 0 });
        tl.to(heroItems, { y: 0, opacity: 1, duration: 0.6, stagger: 0.09 });
      }
      if (cardRef.current) {
        tl.fromTo(cardRef.current, { y: 30, opacity: 0, scale: 0.98 }, { y: 0, opacity: 1, scale: 1, duration: 0.6 }, "-=0.35");
      }
      // фоновые градиентные пятна — медленный плавающий парал­лакс
      const blobs = rootRef.current!.querySelectorAll("[data-blob]");
      blobs.forEach((b, i) => {
        gsap.to(b, { x: i % 2 === 0 ? 30 : -30, y: i % 2 === 0 ? -20 : 20, duration: 8 + i * 2, yoyo: true, repeat: -1, ease: "sine.inOut" });
      });
    }, rootRef);
    // страховка (как в PageTransition): если тикер где-то подвис/перебился модалкой —
    // ключевой контент (форма создания) не должен навсегда остаться невидимым
    const safety = window.setTimeout(() => {
      const targets = [heroRef.current?.querySelectorAll("[data-hero-item]"), cardRef.current].filter(Boolean) as (Element | NodeListOf<Element>)[];
      if (targets.length) gsap.set(targets, { clearProps: "opacity,transform" });
    }, 1400);
    return () => { window.clearTimeout(safety); ctx.revert(); };
  }, []);

  useEffect(() => {
    if (!projectsRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const items = projectsRef.current.querySelectorAll("[data-project-card]");
    if (!items.length) return;
    gsap.fromTo(items, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.42, stagger: 0.06, ease: "power2.out" });
    const safety = window.setTimeout(() => gsap.set(items, { clearProps: "opacity,transform" }), 1200);
    return () => window.clearTimeout(safety);
  }, [projects]);

  function pickIdea(idea: string) {
    setPrompt(idea);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (cardRef.current) gsap.fromTo(cardRef.current, { scale: 0.99 }, { scale: 1, duration: 0.3, ease: "back.out(2)" });
  }

  async function submit() {
    const text = prompt.trim();
    if (text.length < 5) { setMsg("опиши идею подробнее (минимум 5 символов)"); return; }
    setBusy(true); setMsg(""); setNeedAuth(false);
    try {
      const r = await fetch("/magnum/api/workshop/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      const j = (await r.json()) as { error?: string; projectId?: number; balance?: number };
      if (r.status === 401) { setNeedAuth(true); setMsg("Войди, братуха — нужен аккаунт"); return; }
      if (r.status === 402) { setMsg(`Не хватает монет — нужно ${WORKSHOP_COST}, на счету ${j.balance ?? 0}`); return; }
      if (r.status === 429) { setMsg(j.error || "Слишком часто — подожди минуту"); return; }
      if (!r.ok) { setMsg(j.error || "Не получилось создать проект"); return; }
      if (typeof j.balance === "number") setBalance(j.balance);
      if (typeof j.projectId === "number") navigate(`/magnum/workshop/${j.projectId}`);
    } catch {
      setMsg("Сеть не отвечает — попробуй ещё раз");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={rootRef} style={{ position: "relative", maxWidth: 900, margin: "0 auto", padding: "24px 16px 60px", overflow: "hidden" }}>
      {/* фоновые градиентные пятна в стиле Lovable/Cursor */}
      <div data-blob aria-hidden style={{ position: "absolute", top: -80, left: -60, width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(88,101,242,0.28), transparent 70%)", filter: "blur(10px)", pointerEvents: "none", zIndex: 0 }} />
      <div data-blob aria-hidden style={{ position: "absolute", top: 40, right: -80, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,255,136,0.20), transparent 70%)", filter: "blur(10px)", pointerEvents: "none", zIndex: 0 }} />
      <div data-blob aria-hidden style={{ position: "absolute", top: 260, left: "40%", width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.20), transparent 70%)", filter: "blur(10px)", pointerEvents: "none", zIndex: 0 }} />

      <WorkshopDrone />
      <WorkshopSkillsShop />

      <div ref={heroRef} style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
        <span data-hero-item style={{ display: "inline-block", padding: "5px 12px", borderRadius: 999, background: "rgba(88,101,242,0.14)", border: "1px solid rgba(88,101,242,0.32)", fontSize: 11.5, fontWeight: 800, letterSpacing: "0.04em", color: "#b9c0ff" }}>
          ✨ ИИ-АГЕНТ · ИЗОЛИРОВАННАЯ ПЕСОЧНИЦА · ЖИВОЙ ПРОГРЕСС
        </span>
        <h1 data-hero-item style={{ marginTop: 16, fontSize: "clamp(30px, 6vw, 46px)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.08, backgroundImage: "linear-gradient(135deg,#fff 20%,#b9c0ff 60%,#00ff88 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
          Мастерская
        </h1>
        <p data-hero-item style={{ marginTop: 10, fontSize: 15, opacity: 0.72, maxWidth: 560, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
          Опиши идею текстом — ИИ-агент напишет код и запустит приложение в изолированной песочнице.
          Готовый проект получает свою ссылку и попадает в <Link to="/magnum/workshop-gallery" style={{ color: "#00ff88" }}>публичную галерею</Link>.
        </p>
      </div>

      {me === null && <div style={{ position: "relative", zIndex: 1 }}><GuestGate action="создавать приложения в мастерской" /></div>}

      <div
        ref={cardRef}
        style={{
          position: "relative", zIndex: 1, marginTop: 22, padding: 20, borderRadius: 22,
          background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
          border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
          backdropFilter: "blur(6px)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", opacity: 0.8 }}>ЧТО СОЗДАЁМ?</span>
          <span style={{ padding: "5px 10px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12 }}>
            Баланс: {balance ?? "…"} монет
          </span>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Например: небольшая игра-кликер с анимацией, счётчиком и уровнями"
          rows={4}
          maxLength={1000}
          disabled={!me || busy}
          style={{
            width: "100%", marginTop: 12, padding: "14px 16px", borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)", background: "rgba(0,0,0,0.28)",
            color: "#fff", fontSize: 14, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5,
            outline: "none",
          }}
        />

        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {IDEAS.map((idea) => (
            <button
              key={idea}
              type="button"
              onClick={() => pickIdea(idea)}
              disabled={!me || busy}
              style={{
                padding: "6px 11px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.75)", fontSize: 11.5,
                cursor: !me || busy ? "not-allowed" : "pointer",
              }}
            >
              💡 {idea}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, flexWrap: "wrap", gap: 10 }}>
          <button
            type="button"
            onClick={submit}
            disabled={!me || busy || prompt.trim().length < 5}
            style={{
              position: "relative", padding: "13px 22px", borderRadius: 14, border: "none",
              background: busy ? "linear-gradient(135deg,#2f8f63,#1f6b8f)" : "linear-gradient(135deg,#00ff88,#5865f2)",
              color: "#04120a", fontWeight: 900, fontSize: 14,
              cursor: !me || busy ? "not-allowed" : "pointer", opacity: !me ? 0.6 : 1,
              boxShadow: "0 10px 26px rgba(0,255,136,0.22)",
              display: "flex", alignItems: "center", gap: 10,
            }}
          >
            <span>{busy ? "Создаю…" : "Создать приложение"}</span>
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ textDecoration: "line-through", opacity: 0.55, fontSize: 12, fontWeight: 700 }}>{WORKSHOP_ORIGINAL_PRICE}</span>
              <span style={{ fontSize: 15, fontWeight: 900 }}>{WORKSHOP_COST}</span>
            </span>
            <span style={{ position: "absolute", top: -10, right: -10, padding: "3px 8px", borderRadius: 999, background: "#ff2d55", color: "#fff", fontSize: 10.5, fontWeight: 900, boxShadow: "0 4px 10px rgba(255,45,85,0.4)" }}>
              -{WORKSHOP_DISCOUNT_PCT}%
            </span>
          </button>
          <span style={{ fontSize: 12, opacity: 0.8, color: needAuth ? "#ff2d55" : undefined }}>{msg}</span>
        </div>
      </div>

      {me && projects.length > 0 && (
        <div ref={projectsRef} style={{ position: "relative", zIndex: 1, marginTop: 26 }}>
          <h3 style={{ fontSize: 14, fontWeight: 900, letterSpacing: "0.04em" }}>МОИ ПРОЕКТЫ</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10, marginTop: 10 }}>
            {projects.map((p) => (
              <Link
                key={p.id}
                data-project-card
                to={`/magnum/workshop/${p.id}`}
                style={{
                  padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)", color: "#fff", textDecoration: "none",
                  display: "flex", flexDirection: "column", gap: 6,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                  {p.title || p.prompt}
                </span>
                <span style={{ fontSize: 11, color: STATUS_COLOR[p.status] ?? "#9aa4b2", fontWeight: 700 }}>{STATUS_LABEL[p.status] ?? p.status} • ❤️ {p.likes}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkshopPage;
