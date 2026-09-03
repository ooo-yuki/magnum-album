import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { useMe, GuestGate } from "../components/GuestGate";
import { subscribe as subscribeCoins } from "../lib/coins";

const WORKSHOP_COST = 200;

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

export function WorkshopPage() {
  const me = useMe();
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
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
    if (!wrapRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.set(wrapRef.current, { y: -16, opacity: 0 });
      gsap.to(wrapRef.current, { y: 0, opacity: 1, duration: 0.5, ease: "power2.out" });
    }, wrapRef);
    return () => ctx.revert();
  }, []);

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
      const j = (await r.json()) as { error?: string; projectId?: number; balance?: number; required?: number; balance_?: number };
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
    <div ref={wrapRef} style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em" }}>
        МАСТЕРСКАЯ <span style={{ opacity: 0.6, fontSize: 14, fontWeight: 600 }}>— вайбкодинг мини-приложений</span>
      </h1>
      <p style={{ opacity: 0.7, marginTop: 6, fontSize: 13 }}>
        Опиши текстом игру или мини-приложение — ИИ-агент напишет код и запустит его в изолированной песочнице.
        Готовый проект получает свою ссылку и попадает в{" "}
        <Link to="/magnum/workshop-gallery" style={{ color: "#00ff88" }}>публичную галерею</Link>.
      </p>

      {me === null && <GuestGate action="создавать приложения в мастерской" />}

      <div style={{ marginTop: 16, padding: 16, borderRadius: 18, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", opacity: 0.8 }}>ОПИШИ ИДЕЮ</span>
          <span style={{ padding: "5px 10px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12 }}>
            Баланс: {balance ?? "…"} монет • стоимость генерации {WORKSHOP_COST}
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
            width: "100%", marginTop: 10, padding: "10px 12px", borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.22)",
            color: "#fff", fontSize: 13, resize: "vertical", fontFamily: "inherit",
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            onClick={submit}
            disabled={!me || busy || prompt.trim().length < 5}
            style={{
              padding: "10px 18px", borderRadius: 10, border: "1px solid #00ff88",
              background: busy ? "rgba(0,255,136,0.10)" : "rgba(0,255,136,0.20)",
              color: "#fff", fontWeight: 900, fontSize: 13,
              cursor: !me || busy ? "not-allowed" : "pointer", opacity: !me ? 0.6 : 1,
            }}
          >
            {busy ? "Создаю…" : `Создать за ${WORKSHOP_COST} монет`}
          </button>
          <span style={{ fontSize: 12, opacity: 0.75, color: needAuth ? "#ff2d55" : undefined }}>{msg}</span>
        </div>
      </div>

      {me && projects.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <h3 style={{ fontSize: 14, fontWeight: 900, letterSpacing: "0.04em" }}>МОИ ПРОЕКТЫ</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10, marginTop: 10 }}>
            {projects.map((p) => (
              <Link
                key={p.id}
                to={`/magnum/workshop/${p.id}`}
                style={{
                  padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)", color: "#fff", textDecoration: "none",
                  display: "flex", flexDirection: "column", gap: 6,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                  {p.title || p.prompt}
                </span>
                <span style={{ fontSize: 11, opacity: 0.65 }}>{STATUS_LABEL[p.status] ?? p.status} • ❤️ {p.likes}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkshopPage;
