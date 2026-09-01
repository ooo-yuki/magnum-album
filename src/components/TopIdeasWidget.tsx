import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type Idea = { id: number; title: string; description: string; votes: number; status: string };

export function TopIdeasWidget() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [voted, setVoted] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/magnum/api/ideas", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { ideas: [] }))
      .then((d) => {
        const arr: Idea[] = Array.isArray(d.ideas) ? d.ideas : [];
        arr.sort((a, b) => b.votes - a.votes);
        setIdeas(arr.slice(0, 3));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const vote = async (id: number) => {
    if (voted.has(id)) return;
    try {
      const r = await fetch(`/magnum/api/ideas/${id}/vote`, { method: "POST", credentials: "include" });
      if (r.status === 401) {
        window.dispatchEvent(new CustomEvent("magnum:need-auth"));
        return;
      }
      if (!r.ok) throw new Error();
      setVoted((s) => new Set(s).add(id));
      setIdeas((prev) => {
        const next = prev.map((x) => (x.id === id ? { ...x, votes: x.votes + 1 } : x));
        next.sort((a, b) => b.votes - a.votes);
        return next;
      });
      window.dispatchEvent(new CustomEvent("magnum:dust", { detail: { amount: 5 } }));
    } catch {}
  };

  if (loading) return null;
  if (ideas.length === 0) return null;

  return (
    <section
      data-testid="top-ideas-widget"
      style={{
        maxWidth: 1120,
        margin: "0 auto",
        padding: "1rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 16, fontWeight: 900, color: "#fff", margin: 0 }}>🔥 Топ-3 идеи — Мнение 42</h2>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,.5)" }}>голосуй — попади в прод</span>
        <Link to="/magnum/ideas" style={{ marginLeft: "auto", fontSize: 12, color: "#ffcc00", textDecoration: "none", fontWeight: 700 }}>Все идеи →</Link>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
        {ideas.map((it, idx) => (
          <div
            key={it.id}
            data-idea={it.id}
            style={{
              position: "relative",
              background: "rgba(255,255,255,.04)",
              border: "1px solid rgba(255,255,255,.08)",
              borderRadius: 16,
              padding: "12px 12px 10px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: -8,
                left: 10,
                background: idx === 0 ? "linear-gradient(90deg,#ffcc00,#ff2d55)" : "linear-gradient(90deg,#ff2d55,#ffcc00)",
                color: "#000",
                fontSize: 10,
                fontWeight: 800,
                padding: "2px 7px",
                borderRadius: 999,
              }}
            >
              #{idx + 1} • Мнение 42
            </span>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
              <span style={{ fontWeight: 800, color: "#ffcc00", fontSize: ".85rem" }}>▲ {it.votes}</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,.4)", border: "1px solid rgba(255,255,255,.08)", padding: "1px 6px", borderRadius: 999 }}>{it.status}</span>
            </div>
            <strong style={{ fontSize: 13, fontWeight: 800, color: "#fff", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" as never }}>{it.title}</strong>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,.55)", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" as never }}>{it.description}</span>
            <button
              type="button"
              onClick={() => vote(it.id)}
              disabled={voted.has(it.id)}
              data-testid={`top-idea-vote-${it.id}`}
              style={{
                marginTop: 4,
                padding: "7px 12px",
                borderRadius: 999,
                border: voted.has(it.id) ? "1px solid rgba(0,255,136,.25)" : "1px solid rgba(255,255,255,.12)",
                background: voted.has(it.id) ? "rgba(0,255,136,.14)" : "rgba(255,255,255,.06)",
                color: voted.has(it.id) ? "#00ff88" : "#fff",
                fontSize: 12,
                fontWeight: 700,
                cursor: voted.has(it.id) ? "default" : "pointer",
                opacity: voted.has(it.id) ? 0.8 : 1,
              }}
            >
              {voted.has(it.id) ? "✓ Голос засчитан" : "Голосовать +5"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
