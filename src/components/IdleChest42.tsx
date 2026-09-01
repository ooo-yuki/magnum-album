import { useCallback, useEffect, useState, useRef } from "react";
import gsap from "gsap";
import { getStreakMultiplier } from "../lib/spinRewards";
import { IDLE_CHEST_CAP_HOURS } from "../lib/idleChest";

type Status = {
  canClaim: boolean;
  waitMs: number;
  lastClaim: string | null;
  streak: number;
  nextStreak: number;
  totalClaims: number;
  multiplier: number;
  preview: { offlineHours: number; offlineBonus: number; baseWithBonus: number; dust: number; dustDoubled: number; cappedHours: number };
  dust: number;
  coins: number;
  shareText: string;
};

export function IdleChest42() {
  const [status, setStatus] = useState<Status | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [msg, setMsg] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const chestRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch("/magnum/api/idle/status", { credentials: "include" });
      if (r.status === 401) { setAuthed(false); return; }
      setAuthed(true);
      const j = (await r.json()) as Status;
      setStatus(j);
    } catch {}
  }, []);

  useEffect(() => { void fetchStatus(); }, [fetchStatus]);

  useEffect(() => {
    if (!cardRef.current) return;
    const el = cardRef.current;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(el, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "power2.out" });
  }, [status]);

  const showToast = useCallback((m: string) => { setToast(m); window.setTimeout(() => setToast(null), 3200); }, []);

  const doClaim = useCallback(async (doubled: boolean) => {
    if (claiming) return;
    if (!status?.canClaim) {
      const waitH = status ? Math.ceil(status.waitMs / 3600000) : 0;
      setMsg(`Уже забрано — жди ${waitH}ч`);
      return;
    }
    setClaiming(true); setMsg("");
    try {
      const r = await fetch("/magnum/api/idle/claim", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ double: doubled }) });
      const j = (await r.json()) as { error?: string; reward?: number; streak?: number; multiplier?: number; waitMs?: number; dust?: number; shareText?: string };
      if (r.status === 401) { setAuthed(false); setMsg("Войди, братуха"); setClaiming(false); return; }
      if (r.status === 429) { setMsg(j.error || "подожди"); fetchStatus(); setClaiming(false); return; }
      if (!r.ok) { setMsg(j.error || "Ошибка сундука"); setClaiming(false); return; }
      const reward = j.reward ?? 0;
      const mult = j.multiplier ?? 1;
      setMsg(`+${reward} dust ×${mult}${doubled ? " ×2 реклама!" : ""} 🔥`);
      if (chestRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.fromTo(chestRef.current, { scale: 0.9, rotation: -2 }, { scale: 1.08, rotation: 1, duration: 0.22, yoyo: true, repeat: 1, ease: "back.out(1.7)" });
        // confetti burst
        for (let i = 0; i < 18; i++) {
          const p = document.createElement("div");
          p.style.position = "absolute"; p.style.left = "50%"; p.style.top = "38%"; p.style.width = "7px"; p.style.height = "7px";
          p.style.borderRadius = "50%"; p.style.background = i % 3 === 0 ? "#ffcc00" : i % 3 === 1 ? "#ff2d55" : "#00ff88";
          p.style.pointerEvents = "none";
          chestRef.current.appendChild(p);
          gsap.to(p, { x: (Math.random() - 0.5) * 140, y: -30 - Math.random() * 90, opacity: 0, duration: 0.7 + Math.random() * 0.4, ease: "power2.out", onComplete: () => p.remove() });
        }
      }
      showToast(j.shareText ?? `забрал ${reward} dust пока спал!`);
      fetchStatus();
    } catch { setMsg("Сеть — попробуй ещё"); }
    finally { setClaiming(false); }
  }, [claiming, status, fetchStatus, showToast]);

  const handleShare = useCallback(async () => {
    const txt = status?.shareText ?? `забрал ${status?.preview.dust ?? 42} dust пока спал — сундук 42 🔥`;
    const url = typeof window !== "undefined" ? window.location.origin + "/magnum" : "https://5opka.ru/magnum";
    const full = `${txt} ${url}`;
    // canvas 1080x1080 share
    try {
      const off = document.createElement("canvas"); off.width = 1080; off.height = 1080;
      const ctx = off.getContext("2d");
      if (ctx) {
        const g = ctx.createLinearGradient(0, 0, 0, 1080);
        g.addColorStop(0, "#0a0a0a"); g.addColorStop(0.55, "#1a140a"); g.addColorStop(1, "#0d0d0d");
        ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1080);
        ctx.strokeStyle = "#ffcc00"; ctx.lineWidth = 14; ctx.strokeRect(7, 7, 1066, 1066);
        ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.font = "600 22px Inter, sans-serif"; ctx.textAlign = "center";
        ctx.fillText("MAGNUM  ·  СУНДУК 42  ·  OFFLINE CHEST", 540, 90);
        ctx.font = "900 72px Inter, sans-serif"; ctx.fillStyle = "#ffcc00"; (ctx as unknown as { shadowBlur: number }).shadowBlur = 16; ctx.fillText("ПОКА ТЕБЯ НЕ БЫЛО", 540, 190); (ctx as unknown as { shadowBlur: number }).shadowBlur = 0;
        ctx.font = "900 84px Inter, sans-serif"; ctx.fillStyle = "#fff"; ctx.fillText(`НАБЕЖАЛО ${status?.preview.dust ?? 42} dust`, 540, 280);
        ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = "600 24px Inter, sans-serif";
        ctx.fillText(`${status?.preview.offlineHours ?? 0}ч офлайн · кап ${IDLE_CHEST_CAP_HOURS}ч · стрик ${status?.streak ?? 0}дн ×${status?.multiplier ?? 1}`, 540, 330);
        // chest icon circle
        ctx.fillStyle = "rgba(255,204,0,0.12)"; ctx.beginPath(); ctx.arc(540, 540, 170, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(255,204,0,0.22)"; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = "900 72px Inter, sans-serif"; ctx.fillText("📦", 540, 560);
        ctx.fillStyle = "rgba(255,255,255,0.42)"; ctx.font = "400 18px Inter, sans-serif"; ctx.fillText("42 base + бонус за оффлайн · ×2 3дн · ×3 7дн", 540, 610);
        ctx.fillStyle = "#fff"; ctx.fillRect(540 - 120, 680, 240, 240);
        // fake QR grid
        const cells = 21; const cell = 240 / cells; let seed = 0; const s = (status?.shareText ?? "") + url; for (let i = 0; i < s.length; i++) seed = (seed * 31 + s.charCodeAt(i)) >>> 0;
        const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 0xffffffff;
        ctx.fillStyle = "#0a0a0a"; ctx.fillRect(540 - 120, 680, 240, 240); ctx.fillStyle = "#fff";
        for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) {
          const isFinder = (x < 7 && y < 7) || (x >= cells - 7 && y < 7) || (x < 7 && y >= cells - 7);
          let v: boolean; if (isFinder) { const fx = x % 7, fy = y % 7; v = fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4); } else v = rnd() > 0.5;
          if (v) ctx.fillRect(540 - 120 + x * cell + 0.3, 680 + y * cell + 0.3, cell - 0.6, cell - 0.6);
        }
        ctx.fillStyle = "rgba(255,255,255,0.62)"; ctx.font = "400 14px Inter, sans-serif"; ctx.textAlign = "center"; ctx.fillText(url.replace(/^https?:\/\//, ""), 540, 960);
        ctx.fillStyle = "rgba(255,204,0,0.95)"; ctx.font = "700 14px Inter, sans-serif"; ctx.fillText(`Сундук 42 · пока спал +${status?.preview.dust ?? 42} dust`, 540, 985);
        ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fillRect(0, 1020, 1080, 60);
        ctx.fillStyle = "rgba(255,255,255,0.62)"; ctx.font = "600 14px Inter, sans-serif"; ctx.textAlign = "left"; ctx.fillText("ДРОП 15.09.2026  ·  ПЕРВЫЕ 42 — ЗОЛОТО", 28, 1054);
        ctx.textAlign = "right"; ctx.fillStyle = "rgba(255,204,0,0.95)"; ctx.fillText("★ СУНДУК 42", 1052, 1054);
        const blob: Blob = await new Promise((res, rej) => off.toBlob(b => b ? res(b) : rej(new Error("toBlob null")), "image/png", 1.0));
        const file = new File([blob], `magnum-idle-${status?.preview.dust ?? 42}-1080.png`, { type: "image/png" });
        const nav = navigator as unknown as { canShare?: (d: { files: File[] }) => boolean; share?: (d: { files: File[]; title: string; text: string }) => Promise<void> };
        if (nav.canShare?.({ files: [file] }) && nav.share) {
          await nav.share({ files: [file], title: "MAGNUM — Сундук 42", text: full });
          showToast("Поделились 🔥");
          return;
        }
        const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = `magnum-idle-${status?.preview.dust ?? 42}-1080.png`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000);
        showToast("Скачано PNG 1080×1080 ✓");
        return;
      }
    } catch {}
    try { await navigator.clipboard.writeText(full); showToast("Скопировано: " + full.slice(0, 50) + "…"); } catch { showToast(full); }
  }, [status, showToast]);

  const mult = status ? getStreakMultiplier(status.streak) : 1;
  const waitH = status ? Math.ceil(status.waitMs / 3600000) : 0;

  if (authed === false) {
    return (
      <div data-testid="idle-chest" style={{ border: "1px dashed rgba(255,204,0,0.24)", borderRadius: 18, padding: 16, background: "rgba(255,204,0,0.04)", textAlign: "center" }}>
        <div style={{ fontWeight: 900, fontSize: 13, color: "#ffcc00", letterSpacing: "0.06em" }}>📦 СУНДУК 42</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.62)", marginTop: 6 }}>Войди — пока тебя не было, набежало 42 dust (стрик ×2/×3)</div>
      </div>
    );
  }

  return (
    <div ref={cardRef} data-testid="idle-chest" style={{ border: "1px solid rgba(255,204,0,0.22)", borderRadius: 18, background: "linear-gradient(180deg, rgba(255,204,0,0.08), rgba(255,45,85,0.06) 55%, rgba(18,18,22,0.96))", padding: 16, boxShadow: "0 12px 36px rgba(0,0,0,0.35), 0 0 22px rgba(255,204,0,0.08)" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, background: "rgba(255,204,0,0.14)", border: "1px solid rgba(255,204,0,0.28)", color: "#ffcc00", fontSize: 11, fontWeight: 900, letterSpacing: "0.08em" }}>📦 СУНДУК 42</span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 700 }}>офлайн кап {IDLE_CHEST_CAP_HOURS}ч · 42 + {IDLE_CHEST_CAP_HOURS * 5} бонус · x2/x3</span>
        {status && <span style={{ marginLeft: "auto", fontSize: 11, padding: "4px 8px", borderRadius: 999, background: mult > 1 ? "rgba(255,204,0,0.14)" : "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: mult > 1 ? "#ffcc00" : "rgba(255,255,255,0.62)", fontWeight: 800 }}>стрик {status.streak}дн {mult > 1 ? `×${mult} 🔥` : "×1"}</span>}
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
        <div ref={chestRef} style={{ position: "relative", width: 200, height: 200, flexShrink: 0, borderRadius: 24, border: "2px solid rgba(255,204,0,0.32)", background: "radial-gradient(circle at 30% 30%, rgba(255,204,0,0.18), rgba(255,45,85,0.08) 55%, rgba(18,18,22,1))", display: "grid", placeItems: "center", boxShadow: "0 8px 32px rgba(0,0,0,0.32), inset 0 0 24px rgba(255,204,0,0.08)", overflow: "hidden" }}>
          <div style={{ fontSize: 64, filter: "drop-shadow(0 8px 20px rgba(255,204,0,0.22))" }}>📦</div>
          <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, padding: "6px 8px", borderRadius: 999, background: "rgba(0,0,0,0.42)", border: "1px solid rgba(255,255,255,0.08)", textAlign: "center", fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.72)", letterSpacing: "0.06em" }}>ПОКА ТЕБЯ НЕ БЫЛО</div>
          <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 55%, rgba(255,204,0,0.06))", pointerEvents: "none" }} />
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          {status ? (
            <>
              <div style={{ fontWeight: 900, fontSize: 15, color: "#fff", lineHeight: 1.25 }}>
                {status.canClaim ? <span style={{ color: "#00ff88" }}>Набежало {status.preview.dust} dust ✓</span> : <span style={{ color: "rgba(255,255,255,0.55)" }}>Ждать {waitH}ч до сундука</span>}
                <span style={{ marginLeft: 6, fontSize: 11, padding: "3px 7px", borderRadius: 999, background: "rgba(255,204,0,0.1)", border: "1px solid rgba(255,204,0,0.14)", color: "rgba(255,255,255,0.72)" }}>{status.preview.offlineHours}ч офлайн · +{status.preview.offlineBonus} бонус (кап {IDLE_CHEST_CAP_HOURS}ч)</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.62)", lineHeight: 1.5 }}>
                <b style={{ color: "#ffcc00" }}>42</b> base + <b>{status.preview.offlineBonus}</b> за оффлайн ({status.preview.offlineHours}ч ×5/ч, кап {IDLE_CHEST_CAP_HOURS}ч) = <b style={{ color: "#fff" }}>{status.preview.baseWithBonus}</b> ×{status.multiplier} = <b style={{ color: "#00ff88" }}>{status.preview.dust} dust</b> · стрик 3дн ×2 · 7дн ×3 · реклама ×2
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <button onClick={() => doClaim(false)} disabled={claiming || !status.canClaim} data-testid="idle-chest-claim" style={{ appearance: "none", border: 0, padding: "10px 18px", borderRadius: 999, background: claiming ? "#333" : !status.canClaim ? "#2a2a2a" : "linear-gradient(135deg,#ffcc00,#ff6b35)", color: claiming || !status.canClaim ? "#aaa" : "#0a0a0a", fontWeight: 900, fontSize: 13, cursor: claiming || !status.canClaim ? "not-allowed" : "pointer", boxShadow: "0 8px 20px rgba(255,204,0,0.22)" }}>{claiming ? "Забираю…" : `Забрать ${status.preview.dust} dust`}</button>
                <button onClick={() => doClaim(true)} disabled={claiming || !status.canClaim} data-testid="idle-chest-double" style={{ appearance: "none", border: "1px solid rgba(255,204,0,0.24)", background: "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 800, fontSize: 12, padding: "10px 14px", borderRadius: 999, cursor: claiming || !status.canClaim ? "not-allowed" : "pointer", opacity: !status.canClaim ? 0.5 : 1 }}>📺 x2 ({status.preview.dustDoubled} dust)</button>
                <button onClick={handleShare} data-testid="idle-chest-share" style={{ appearance: "none", border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "rgba(255,255,255,0.72)", fontWeight: 700, fontSize: 12, padding: "10px 14px", borderRadius: 999, cursor: "pointer" }}>забрал {status.preview.dust} dust пока спал — шаринг 1080</button>
              </div>
              {msg && <div style={{ marginTop: 8, fontSize: 12, color: msg.includes("Ждать") || msg.includes("подожди") ? "rgba(255,255,255,0.62)" : "#00ff88", fontWeight: 700 }}>{msg}</div>}
              <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.42)" }}>Шаринг OG 1080×1080 · ретеншн: daily 28→32 D1 +10% · idle — главный хук возврата</div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>Готовлю сундук…</div>
          )}
        </div>
      </div>
      {toast && <div role="status" style={{ position: "fixed", left: "50%", bottom: 18, transform: "translateX(-50%)", background: "rgba(20,20,20,0.96)", color: "#fff", border: "1px solid rgba(255,204,0,0.22)", padding: "10px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, zIndex: 50 }}>{toast}</div>}
    </div>
  );
}
export default IdleChest42;
