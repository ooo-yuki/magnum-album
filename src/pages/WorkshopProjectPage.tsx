import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import gsap from "gsap";
import { useMe } from "../components/GuestGate";

type EventItem = { type: string; text: string; meta?: Record<string, unknown>; created_at: string };
type Project = {
  id: number; userId: number; username: string; prompt: string; title: string | null;
  status: string; previewUrl: string | null; errorMessage: string | null;
  isPublic: boolean; likes: number; createdAt: string; updatedAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "В очереди…",
  generating: "Агент пишет код…",
  ready: "Готово",
  failed: "Ошибка",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "#9aa4b2",
  generating: "#ffcc00",
  ready: "#00ff88",
  failed: "#ff2d55",
};

function eventIcon(type: string): string {
  if (type === "tool") return "🛠️";
  if (type === "message") return "💬";
  if (type === "error") return "⚠️";
  return "•";
}

export function WorkshopProjectPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const logRef = useRef<HTMLDivElement>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [wsOffline, setWsOffline] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editMsg, setEditMsg] = useState("");
  const [likes, setLikes] = useState<number | null>(null);
  const [liked, setLiked] = useState(false);
  const [toast, setToast] = useState("");

  const fetchProject = useCallback(async () => {
    if (!id) return;
    try {
      const r = await fetch(`/magnum/api/workshop/${id}`, { credentials: "include" });
      if (r.status === 404) { setNotFound(true); return; }
      if (!r.ok) return;
      const j = (await r.json()) as { project?: Project; events?: EventItem[] };
      if (j.project) { setProject(j.project); setLikes(j.project.likes); }
      if (Array.isArray(j.events)) setEvents(j.events);
    } catch {}
  }, [id]);

  useEffect(() => { void fetchProject(); }, [fetchProject]);

  // live-подписка на прогресс: собственный WS, роль workshop — без дуэльной матчмейки
  useEffect(() => {
    if (!id) return;
    let closedByUs = false;
    let retries = 0;
    let socket: WebSocket | null = null;

    function connect() {
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      try {
        socket = new WebSocket(`${proto}//${location.host}/magnum/api/ws?role=workshop`);
      } catch {
        setWsOffline(true);
        return;
      }
      socket.onopen = () => {
        retries = 0;
        setWsOffline(false);
        try { socket?.send(JSON.stringify({ type: "workshop:subscribe", projectId: Number(id) })); } catch {}
      };
      socket.onmessage = (e) => {
        try {
          const m = JSON.parse(String(e.data)) as { type?: string; projectId?: number; event?: EventItem; status?: string; previewUrl?: string; errorMessage?: string };
          if (m.type === "ping") { try { socket?.send(JSON.stringify({ type: "pong" })); } catch {} return; }
          if (Number(m.projectId) !== Number(id)) return;
          if (m.type === "workshop:event" && m.event) {
            setEvents((prev) => [...prev, m.event as EventItem]);
          } else if (m.type === "workshop:status" && m.status) {
            setProject((prev) => prev ? { ...prev, status: m.status!, previewUrl: m.previewUrl ?? prev.previewUrl, errorMessage: m.errorMessage ?? null } : prev);
          }
        } catch {}
      };
      socket.onclose = () => {
        if (closedByUs) return;
        setWsOffline(true);
        if (retries < 5) { retries++; window.setTimeout(connect, 1000 * retries); }
      };
      socket.onerror = () => setWsOffline(true);
    }
    connect();
    return () => { closedByUs = true; try { socket?.close(); } catch {} };
  }, [id]);

  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [events]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const items = document.querySelectorAll("[data-workshop-event]");
    if (!items.length) return;
    gsap.set(items, { y: 8, opacity: 0 });
    gsap.to(items, { y: 0, opacity: 1, duration: 0.28, stagger: 0.03, ease: "power2.out", overwrite: true });
  }, [events.length]);

  async function submitEdit() {
    const text = editPrompt.trim();
    if (!id || text.length < 3) { setEditMsg("опиши правку подробнее"); return; }
    setEditBusy(true); setEditMsg("");
    try {
      const r = await fetch(`/magnum/api/workshop/${id}/prompt`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      const j = (await r.json()) as { error?: string };
      if (r.status === 401) { setEditMsg("Войди, братуха"); return; }
      if (r.status === 403) { setEditMsg("Это не твой проект"); return; }
      if (r.status === 409) { setEditMsg(j.error || "Проект сейчас занят"); return; }
      if (!r.ok) { setEditMsg(j.error || "Не получилось отправить правку"); return; }
      setEditPrompt("");
      setProject((prev) => prev ? { ...prev, status: "generating" } : prev);
    } catch {
      setEditMsg("Сеть не отвечает");
    } finally {
      setEditBusy(false);
    }
  }

  async function doLike() {
    if (!id || liked) return;
    try {
      const r = await fetch(`/magnum/api/workshop/${id}/like`, { method: "POST", credentials: "include" });
      if (r.status === 401) { setToast("Войди, чтобы ставить лайки"); return; }
      if (r.status === 409) { setLiked(true); return; }
      const j = (await r.json()) as { likes?: number };
      if (typeof j.likes === "number") setLikes(j.likes);
      setLiked(true);
    } catch {}
  }

  function copyShareLink() {
    const url = `${location.origin}/magnum/workshop/${id}`;
    navigator.clipboard.writeText(url).then(
      () => setToast("Ссылка скопирована"),
      () => setToast("Не получилось скопировать — скопируй вручную"),
    );
  }

  if (notFound) {
    return (
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "48px 16px", textAlign: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>Проект не найден</h1>
        <Link to="/magnum/workshop" style={{ color: "#00ff88" }}>← вернуться в мастерскую</Link>
      </div>
    );
  }

  const isOwner = Boolean(me && project && me.id === project.userId);
  const status = project?.status ?? "pending";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
      <Link to="/magnum/workshop" style={{ fontSize: 12, opacity: 0.7, color: "#fff" }}>← мастерская</Link>

      <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.3 }}>{project?.title || project?.prompt || "Загрузка…"}</h1>
          {project && <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>автор {project.username} • {new Date(project.createdAt).toLocaleString("ru-RU")}</div>}
        </div>
        <span style={{ padding: "6px 12px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border: `1px solid ${STATUS_COLOR[status] ?? "#9aa4b2"}55`, color: STATUS_COLOR[status] ?? "#9aa4b2", fontWeight: 800, fontSize: 12, whiteSpace: "nowrap" }}>
          {STATUS_LABEL[status] ?? status}
        </span>
      </div>

      {project?.status === "failed" && project.errorMessage && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "rgba(255,45,85,0.10)", border: "1px solid rgba(255,45,85,0.28)", fontSize: 12, color: "#ff8a9a" }}>
          {project.errorMessage}
        </div>
      )}

      {project?.status === "ready" && project.previewUrl && (
        <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a
            href={project.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid #00ff88", background: "rgba(0,255,136,0.20)", color: "#fff", fontWeight: 900, fontSize: 13, textDecoration: "none" }}
          >
            Открыть приложение →
          </a>
          <button
            type="button"
            onClick={copyShareLink}
            style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}
          >
            🔗 Поделиться
          </button>
          <button
            type="button"
            onClick={doLike}
            disabled={liked}
            style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid rgba(255,45,85,0.35)", background: liked ? "rgba(255,45,85,0.06)" : "rgba(255,45,85,0.16)", color: "#fff", fontWeight: 800, fontSize: 13, cursor: liked ? "default" : "pointer" }}
          >
            ❤️ {likes ?? project.likes}
          </button>
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.06em", opacity: 0.85 }}>ЛОГ ГЕНЕРАЦИИ</h3>
          {wsOffline && (status === "pending" || status === "generating") && <span style={{ fontSize: 11, color: "#ff2d55" }}>соединение прервалось — пробую снова…</span>}
        </div>
        <div
          ref={logRef}
          style={{
            marginTop: 8, maxHeight: 420, overflowY: "auto", padding: 12, borderRadius: 12,
            background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.08)",
            display: "flex", flexDirection: "column", gap: 8,
          }}
        >
          {events.length === 0 && <span style={{ fontSize: 12, opacity: 0.5 }}>Пока тихо — агент ещё не начал…</span>}
          {events.map((ev, i) => (
            <div
              key={i}
              data-workshop-event
              style={{
                fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
                color: ev.type === "error" ? "#ff8a9a" : ev.type === "message" ? "#e8e8e8" : "rgba(255,255,255,0.7)",
              }}
            >
              <span style={{ marginRight: 6 }}>{eventIcon(ev.type)}</span>{ev.text}
            </div>
          ))}
        </div>
      </div>

      {isOwner && project?.status !== "pending" && (
        <div style={{ marginTop: 18, padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.06em", opacity: 0.85 }}>ПРАВКА</h3>
          <textarea
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            placeholder="Опиши, что поменять…"
            rows={3}
            maxLength={1000}
            disabled={editBusy || project?.status === "generating"}
            style={{ width: "100%", marginTop: 8, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.22)", color: "#fff", fontSize: 13, resize: "vertical", fontFamily: "inherit" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              onClick={submitEdit}
              disabled={editBusy || project?.status === "generating" || editPrompt.trim().length < 3}
              style={{ padding: "9px 16px", borderRadius: 10, border: "1px solid #5865f2", background: "rgba(88,101,242,0.20)", color: "#fff", fontWeight: 800, fontSize: 12, cursor: editBusy || project?.status === "generating" ? "not-allowed" : "pointer" }}
            >
              {project?.status === "generating" ? "Идёт генерация…" : editBusy ? "Отправляю…" : "Внести правку (бесплатно)"}
            </button>
            <span style={{ fontSize: 12, opacity: 0.75 }}>{editMsg}</span>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", padding: "10px 18px", borderRadius: 999, background: "rgba(20,20,20,0.92)", border: "1px solid rgba(255,255,255,0.14)", fontSize: 13, fontWeight: 700, zIndex: 50 }}>
          {toast}
        </div>
      )}
    </div>
  );
}

export default WorkshopProjectPage;
