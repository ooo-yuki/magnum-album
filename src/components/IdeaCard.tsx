import gsap from "gsap";

type Idea = { id: number; title: string; description: string; votes: number; status: string; category?: string };

/**
 * P1 CTA — карточка идеи + кнопка голосования
 * Вынесена отдельно для переиспользования в IdeasPage и тестах.
 * Кнопка: onVote(id) → POST /magnum/api/ideas/:id/vote 200 → health ideaVotes+1, топ пересортировка.
 * Для anon: не шлёт 401, а триггерит magnum:need-auth (попап логина).
 * P1 funnel: после голоса — inline nudge "Оставь коммент +42" + CTA "Поделись идеей" (шаринг-хук).
 */
export function IdeaCard({
  idea,
  voted,
  onVote,
  onEnter,
  onLeave,
}: {
  idea: Idea;
  voted: boolean;
  onVote: (id: number) => void;
  onEnter?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  const handleShare = async () => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/magnum/ideas?idea=${idea.id}&utm_source=share&utm_medium=42&utm_campaign=ideas` : `https://5opka.ru/magnum/ideas?idea=${idea.id}`;
    const text = `Зацени идею "${idea.title}" на MAGNUM 42 — я уже проголосовал!`;
    try {
      const nav = navigator as unknown as { share?: (d: { title: string; text: string; url: string }) => Promise<void> };
      if (nav.share) await nav.share({ title: "Идея 42 — MAGNUM", text, url });
      else await navigator.clipboard.writeText(url);
    } catch { try { await navigator.clipboard.writeText(url); } catch {} }
    window.dispatchEvent(new CustomEvent("ideas:share", { detail: { ideaId: idea.id } }));
  };
  return (
    <div
      data-idea={idea.id}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        background: "rgba(255,255,255,.04)",
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 18,
        padding: "0.9rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.4rem",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 800, color: "#ffcc00", fontSize: ".85rem" }}>▲ {idea.votes}</span>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 999, background: "linear-gradient(90deg,#ff2d55,#ffcc00)", color: "#000" }}>Мнение 42</span>
          <span style={{ fontSize: ".68rem", letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(240,240,240,.45)", border: "1px solid rgba(255,255,255,.08)", padding: ".18rem .45rem", borderRadius: 999 }}>{idea.status}</span>
        </span>
      </div>
      <h3 style={{ fontSize: "1rem", fontWeight: 800, margin: 0 }}>{idea.title}</h3>
      <p style={{ fontSize: ".85rem", lineHeight: 1.45, color: "rgba(240,240,240,.7)", margin: 0, minHeight: "2.2rem" }}>{idea.description}</p>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => onVote(idea.id)}
          disabled={voted}
          data-testid="idea-vote"
          data-idea-vote={idea.id}
          style={{
            marginTop: ".2rem",
            background: voted ? "rgba(0,255,136,.12)" : "rgba(255,255,255,.06)",
            border: `1px solid ${voted ? "rgba(0,255,136,.25)" : "rgba(255,255,255,.1)"}`,
            color: voted ? "#00ff88" : "#fff",
            borderRadius: 999,
            padding: ".4rem .7rem",
            fontSize: ".8rem",
            fontWeight: 600,
            cursor: voted ? "default" : "pointer",
            opacity: voted ? 0.85 : 1,
          }}
          onMouseEnter={(e) => {
            if (voted || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
            gsap.to(e.currentTarget, { scale: 1.04, duration: 0.18, ease: "power2.out" });
          }}
          onMouseLeave={(e) => {
            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
            gsap.to(e.currentTarget, { scale: 1, duration: 0.2, ease: "power2.out" });
          }}
        >
          {voted ? "✓ Голос засчитан" : "Голосовать"}
        </button>
        <button
          type="button"
          onClick={handleShare}
          data-testid="idea-share"
          data-idea-share={idea.id}
          style={{
            marginTop: ".2rem",
            background: "rgba(120,220,255,.08)",
            border: "1px solid rgba(120,220,255,.18)",
            color: "#78dcff",
            borderRadius: 999,
            padding: ".4rem .7rem",
            fontSize: ".78rem",
            fontWeight: 700,
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
            gsap.to(e.currentTarget, { scale: 1.03, duration: 0.16, ease: "power2.out" });
          }}
          onMouseLeave={(e) => {
            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
            gsap.to(e.currentTarget, { scale: 1, duration: 0.16, ease: "power2.out" });
          }}
        >
          Поделись идеей
        </button>
      </div>
      {voted && <span style={{ fontSize: 11, color: "#00ff88", fontWeight: 700, background: "rgba(0,255,136,.08)", border: "1px solid rgba(0,255,136,.14)", padding: "3px 7px", borderRadius: 999, alignSelf: "flex-start" }}>Оставь коммент +42 🪙</span>}
    </div>
  );
}
