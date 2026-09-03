import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { fetchCoins } from "../lib/coins";

type Skill = { id: string; name: string; desc: string; price: number; icon: string; owned: boolean };

const PRESAVE_URL = "https://music.thefence.me/psmagnum";

/**
 * Маленькая кнопка "скиллы агента" на странице Мастерской. По клику — сначала
 * шуточный редирект-запрос в духе остальных пресейв-нотификаций сайта, потом
 * сама витрина навыков (постоянные усиления агента за монеты).
 */
export function WorkshopSkillsShop() {
  const [stage, setStage] = useState<"closed" | "confirm" | "catalog">("closed");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!btnRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(btnRef.current, { scale: 0, rotate: -12 }, { scale: 1, rotate: 0, duration: 0.6, delay: 0.4, ease: "back.out(1.8)" });
    const pulse = gsap.to(btnRef.current, { boxShadow: "0 0 0 10px rgba(88,101,242,0)", duration: 1.6, repeat: -1, ease: "power2.out" });
    return () => { pulse.kill(); };
  }, []);

  useEffect(() => {
    if (stage === "closed" || !modalRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = modalRef.current;
    gsap.fromTo(el, { y: 16, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.32, ease: "power2.out" });
    // страховка — модалка не должна навсегда остаться невидимой, даже если тикер подвиснет
    const safety = window.setTimeout(() => gsap.set(el, { clearProps: "opacity,transform" }), 700);
    return () => window.clearTimeout(safety);
  }, [stage]);

  useEffect(() => {
    if (stage !== "catalog") return;
    setLoading(true); setMsg("");
    fetch("/magnum/api/workshop/skills", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { skills?: Skill[] }) => { if (Array.isArray(j.skills)) setSkills(j.skills); })
      .catch(() => setMsg("Не получилось загрузить каталог"))
      .finally(() => setLoading(false));
  }, [stage]);

  async function buy(skillId: string) {
    setBuying(skillId); setMsg("");
    try {
      const r = await fetch("/magnum/api/workshop/skills/buy", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId }),
      });
      const j = (await r.json()) as { error?: string };
      if (r.status === 401) { setMsg("Войди, братуха, чтобы качать скиллы"); return; }
      if (r.status === 402) { setMsg(j.error || "Не хватает монет"); return; }
      if (r.status === 409) { setSkills((prev) => prev.map((s) => (s.id === skillId ? { ...s, owned: true } : s))); return; }
      if (!r.ok) { setMsg(j.error || "Не получилось купить"); return; }
      setSkills((prev) => prev.map((s) => (s.id === skillId ? { ...s, owned: true } : s)));
      void fetchCoins();
    } catch {
      setMsg("Сеть не отвечает");
    } finally {
      setBuying(null);
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setStage("confirm")}
        aria-label="Скиллы агента"
        title="Скиллы агента"
        style={{
          position: "fixed", left: 18, bottom: 22, zIndex: 45, width: 48, height: 48, borderRadius: "50%",
          border: "1px solid rgba(88,101,242,0.45)", background: "linear-gradient(135deg,#5865f2,#a855f7)",
          color: "#fff", fontSize: 20, cursor: "pointer", boxShadow: "0 6px 18px rgba(88,101,242,0.35)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        🧩
      </button>

      {stage === "confirm" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setStage("closed")}>
          <div
            ref={modalRef}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 380, width: "100%", padding: 22, borderRadius: 18, background: "linear-gradient(160deg,#161225,#0d0d16)", border: "1px solid rgba(168,85,247,0.28)", boxShadow: "0 20px 60px rgba(0,0,0,0.55)" }}
          >
            <div style={{ fontSize: 15, fontWeight: 900, lineHeight: 1.45 }}>
              Вы точно хотите перейти в каталог или сначала поставите пресейв?
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <a
                href={PRESAVE_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setStage("catalog")}
                style={{ flex: "1 1 140px", textAlign: "center", padding: "10px 12px", borderRadius: 10, border: "1px solid #00ff88", background: "rgba(0,255,136,0.14)", color: "#fff", fontWeight: 800, fontSize: 12.5, textDecoration: "none" }}
              >
                Сначала пресейв →
              </a>
              <button
                type="button"
                onClick={() => setStage("catalog")}
                style={{ flex: "1 1 140px", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}
              >
                Всё равно в каталог
              </button>
            </div>
          </div>
        </div>
      )}

      {stage === "catalog" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setStage("closed")}>
          <div
            ref={modalRef}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 560, width: "100%", maxHeight: "82vh", overflowY: "auto", padding: 22, borderRadius: 20, background: "linear-gradient(160deg,#141020,#0c0c14)", border: "1px solid rgba(88,101,242,0.28)", boxShadow: "0 24px 70px rgba(0,0,0,0.6)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 900 }}>🧩 Скиллы агента</div>
              <button type="button" onClick={() => setStage("closed")} aria-label="Закрыть" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 20, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>Постоянные усиления — куплено раз, работает во всех твоих генерациях.</div>

            {loading && <div style={{ marginTop: 16, opacity: 0.6, fontSize: 13 }}>Загрузка…</div>}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 10, marginTop: 14 }}>
              {skills.map((s) => (
                <div key={s.id} style={{ padding: 14, borderRadius: 14, background: s.owned ? "rgba(0,255,136,0.06)" : "rgba(255,255,255,0.04)", border: s.owned ? "1px solid rgba(0,255,136,0.28)" : "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ fontSize: 22 }}>{s.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, marginTop: 6 }}>{s.name}</div>
                  <div style={{ fontSize: 11.5, opacity: 0.65, marginTop: 4, lineHeight: 1.4 }}>{s.desc}</div>
                  <button
                    type="button"
                    onClick={() => buy(s.id)}
                    disabled={s.owned || buying === s.id}
                    style={{
                      marginTop: 10, width: "100%", padding: "8px 10px", borderRadius: 9, fontSize: 12, fontWeight: 800,
                      border: s.owned ? "1px solid rgba(0,255,136,0.35)" : "1px solid #5865f2",
                      background: s.owned ? "rgba(0,255,136,0.10)" : "rgba(88,101,242,0.20)",
                      color: "#fff", cursor: s.owned ? "default" : "pointer",
                    }}
                  >
                    {s.owned ? "Куплено ✓" : buying === s.id ? "…" : `Купить за ${s.price}`}
                  </button>
                </div>
              ))}
            </div>
            {msg && <div style={{ marginTop: 12, fontSize: 12, color: "#ff8a9a" }}>{msg}</div>}
          </div>
        </div>
      )}
    </>
  );
}

export default WorkshopSkillsShop;
