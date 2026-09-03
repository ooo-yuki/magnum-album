import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";

type GalleryProject = {
  id: number; prompt: string; title: string | null; previewUrl: string;
  likes: number; createdAt: string; username: string;
};

export function WorkshopGalleryPage() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [projects, setProjects] = useState<GalleryProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());

  const fetchGallery = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/magnum/api/workshop/gallery", { credentials: "include" });
      const j = (await r.json()) as { projects?: GalleryProject[] };
      if (Array.isArray(j.projects)) setProjects(j.projects);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchGallery(); }, [fetchGallery]);

  useEffect(() => {
    if (!wrapRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      const cards = wrapRef.current!.querySelectorAll("[data-gallery-card]");
      if (!cards.length) return;
      gsap.set(cards, { y: 16, opacity: 0 });
      gsap.to(cards, { y: 0, opacity: 1, duration: 0.38, stagger: 0.05, ease: "power2.out", overwrite: true });
    }, wrapRef);
    const safety = window.setTimeout(() => {
      const cards = wrapRef.current?.querySelectorAll("[data-gallery-card]");
      if (cards?.length) gsap.set(cards, { clearProps: "opacity,transform" });
    }, 1200);
    return () => { window.clearTimeout(safety); ctx.revert(); };
  }, [projects]);

  async function like(id: number) {
    if (likedIds.has(id)) return;
    try {
      const r = await fetch(`/magnum/api/workshop/${id}/like`, { method: "POST", credentials: "include" });
      if (r.status === 401 || r.status === 409) { setLikedIds((s) => new Set(s).add(id)); return; }
      const j = (await r.json()) as { likes?: number };
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, likes: typeof j.likes === "number" ? j.likes : p.likes + 1 } : p)));
      setLikedIds((s) => new Set(s).add(id));
    } catch {}
  }

  return (
    <div ref={wrapRef} style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em" }}>
        ГАЛЕРЕЯ МАСТЕРСКОЙ <span style={{ opacity: 0.6, fontSize: 14, fontWeight: 600 }}>— что уже наколдовали братухи</span>
      </h1>
      <p style={{ opacity: 0.7, marginTop: 6, fontSize: 13 }}>
        Готовые мини-приложения, сгенерированные ИИ-агентом. <Link to="/magnum/workshop" style={{ color: "#00ff88" }}>Создать своё →</Link>
      </p>

      {loading && projects.length === 0 && <div style={{ marginTop: 24, opacity: 0.6, fontSize: 13 }}>Загрузка…</div>}
      {!loading && projects.length === 0 && (
        <div style={{ marginTop: 24, opacity: 0.6, fontSize: 13, padding: 20, border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 12 }}>
          Пока пусто — стань первым, кто создаст приложение.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14, marginTop: 18 }}>
        {projects.map((p) => (
          <div
            key={p.id}
            data-gallery-card
            style={{ padding: 16, borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 8 }}
          >
            <Link to={`/magnum/workshop/${p.id}`} style={{ color: "#fff", textDecoration: "none" }}>
              <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
                {p.title || p.prompt}
              </div>
            </Link>
            <div style={{ fontSize: 11, opacity: 0.6 }}>автор {p.username} • {new Date(p.createdAt).toLocaleDateString("ru-RU")}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              <a
                href={p.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ flex: "1 1 auto", padding: "8px 12px", borderRadius: 10, border: "1px solid #00ff88", background: "rgba(0,255,136,0.16)", color: "#fff", fontWeight: 800, fontSize: 12, textDecoration: "none", textAlign: "center" }}
              >
                Открыть →
              </a>
              <button
                type="button"
                onClick={() => like(p.id)}
                disabled={likedIds.has(p.id)}
                style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(255,45,85,0.35)", background: likedIds.has(p.id) ? "rgba(255,45,85,0.06)" : "rgba(255,45,85,0.16)", color: "#fff", fontWeight: 800, fontSize: 12, cursor: likedIds.has(p.id) ? "default" : "pointer" }}
              >
                ❤️ {p.likes}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WorkshopGalleryPage;
