import { useCallback, useEffect, useRef, useState } from "react";
import { drawShareCard, canvasToBlob, shareOrDownload } from "./ShareCard";

// — simple QR via api.qrserver with fallback grid —
async function loadQrImage(data: string, size: number): Promise<HTMLImageElement | null> {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&bgcolor=0A0A0A&color=FFFFFF&margin=8`;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const t = window.setTimeout(() => resolve(null), 3500);
    img.onload = () => { clearTimeout(t); resolve(img); };
    img.onerror = () => { clearTimeout(t); resolve(null); };
    img.src = url;
  });
}

function fallbackGrid(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, seedStr: string) {
  const cells = 21;
  const cell = size / cells;
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 0xffffffff;
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "#fff";
  for (let yy = 0; yy < cells; yy++) {
    for (let xx = 0; xx < cells; xx++) {
      const isFinder = (xx < 7 && yy < 7) || (xx >= cells - 7 && yy < 7) || (xx < 7 && yy >= cells - 7);
      let v: boolean;
      if (isFinder) {
        const fx = xx % 7, fy = yy % 7;
        v = fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4);
      } else v = rnd() > 0.48;
      if (v) ctx.fillRect(x + xx * cell + 0.5, y + yy * cell + 0.5, cell - 1, cell - 1);
    }
  }
}

// trigger for FirstInvitePopup — 1/day guard via localStorage + cookie fallback
export function triggerFirstInvitePopup(): boolean {
  const key = "magnum:first-invite-popup:date";
  const today = new Date().toISOString().slice(0, 10);
  try {
    const stored = localStorage.getItem(key);
    if (stored === today) return false;
    localStorage.setItem(key, today);
  } catch {
    // cookie fallback 1 day
    try {
      if (document.cookie.includes("magnum_first_invite=" + today)) return false;
      document.cookie = `magnum_first_invite=${today}; path=/; max-age=86400; SameSite=Lax`;
    } catch {}
  }
  // dispatch custom event so popup can react anywhere
  try { window.dispatchEvent(new CustomEvent("magnum:first-invite", { detail: { today } })); } catch {}
  return true;
}

export function shouldShowFirstInviteToday(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const v = localStorage.getItem("magnum:first-invite-popup:date");
    if (v === today) return false;
  } catch {}
  try {
    if (document.cookie.includes("magnum_first_invite=" + today)) return false;
  } catch {}
  return true;
}

type Props = {
  onFirstInvite?: () => void;
  variant?: "card" | "compact";
};

export function ReferralQR({ onFirstInvite, variant = "card" }: Props) {
  const [code, setCode] = useState<string | null>(null);
  const [invitedCount, setInvitedCount] = useState<number | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrSize = variant === "compact" ? 160 : 220;

  const deepLink = (() => {
    if (!code) return "";
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "https://5opka.ru";
      return `${origin}/magnum?ref=${encodeURIComponent(code)}`;
    } catch { return `https://5opka.ru/magnum?ref=${code}`; }
  })();

  const load = useCallback(async () => {
    try {
      const r = await fetch("/magnum/api/referral/code", { credentials: "include" });
      if (r.status === 401) { setAuthed(false); return; }
      if (r.ok) {
        const j = (await r.json()) as { code: string; invitedCount: number };
        if (j.code) setCode(j.code);
        if (typeof j.invitedCount === "number") setInvitedCount(j.invitedCount);
        setAuthed(true);
      }
    } catch {}
  }, []);

  useEffect(() => { void load(); }, [load]);

  // draw QR
  useEffect(() => {
    if (!canvasRef.current || !deepLink) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const S = qrSize;
    const pad = 12;
    canvas.width = S + pad * 2;
    canvas.height = S + pad * 2;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    (async () => {
      const img = await loadQrImage(deepLink, S);
      if (img) ctx.drawImage(img, pad, pad, S, S);
      else fallbackGrid(ctx, pad, pad, S, deepLink);
      // code overlay below QR? draw on same canvas small bar — keep simple: QR only, code is outside as text
    })();
  }, [deepLink, qrSize]);

  // tracking: if ?ref in URL on mount, ping /referral/track
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const ref = sp.get("ref")?.trim().toUpperCase() ?? "";
      if (/^42-[A-Z0-9]{4}$/.test(ref)) {
        // store for presave click forwarding
        try { localStorage.setItem("magnum:ref", ref); } catch {}
        try { document.cookie = `magnum_ref=${encodeURIComponent(ref)}; path=/; max-age=${30*86400}; SameSite=Lax`; } catch {}
        fetch(`/magnum/api/referral/track?ref=${encodeURIComponent(ref)}`, { credentials: "include" }).catch(() => {});
        // also patch presaveTracker ref forwarding — handlePresaveClick will also read cookie
      }
    } catch {}
  }, []);

  const showToast = useCallback((m: string) => { setToast(m); window.setTimeout(() => setToast(null), 2400); }, []);

  const copyCode = useCallback(async () => {
    if (!code) return;
    try { await navigator.clipboard.writeText(code); } catch { /* ignore */ }
    showToast("Братуха-код скопирован! " + code);
    const did = triggerFirstInvitePopup();
    if (did && onFirstInvite) onFirstInvite();
  }, [code, showToast, onFirstInvite]);

  const copyLink = useCallback(async () => {
    if (!deepLink) return;
    try { await navigator.clipboard.writeText(deepLink); } catch {}
    showToast("Ссылка скопирована: " + deepLink.slice(0, 60) + "…");
    const did = triggerFirstInvitePopup();
    if (did && onFirstInvite) onFirstInvite();
  }, [deepLink, showToast, onFirstInvite]);

  const handleShareOG = useCallback(async () => {
    if (!code) return;
    setBusy(true);
    try {
      const off = document.createElement("canvas");
      // fetch username for share card personalize
      let username: string | null = null;
      let verified = false;
      try {
        const r = await fetch("/magnum/api/frame/status", { credentials: "include" });
        if (r.ok) {
          const j = (await r.json()) as { frames?: Array<{ username: string; verified: boolean }> };
          const v = j.frames?.find((f) => f.verified);
          if (v) { username = v.username; verified = true; }
          else if (j.frames?.[0]) { username = j.frames[0].username; verified = Boolean(j.frames[0].verified); }
        }
      } catch {}
      const skinEmoji = "★";
      await drawShareCard(off, { username, verified, avatarEmoji: skinEmoji });
      // overlay referral code + deepLink hint onto the 1080 card bottom area — add text under QR
      const ctx = off.getContext("2d");
      if (ctx && deepLink) {
        ctx.fillStyle = "rgba(255,204,0,0.95)";
        ctx.font = "700 22px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`БРАТУХА-КОД ${code} · сканируй QR`, 540, 970);
        ctx.fillStyle = "rgba(255,255,255,0.62)";
        ctx.font = "500 16px Inter, sans-serif";
        ctx.fillText(deepLink.replace(/^https?:\/\//, ""), 540, 994);
      }
      const blob = await canvasToBlob(off);
      const safe = (username ?? code ?? "magnum").replace(/[^a-z0-9_-]/gi, "_").slice(0, 18) || "magnum";
      const res = await shareOrDownload(blob, `magnum-qr-${safe}-1080.png`);
      showToast(res === "shared" ? "Поделились · Я в 42 🔥" : "Скачано PNG 1080×1080 ✓");
      const did = triggerFirstInvitePopup();
      if (did && onFirstInvite) onFirstInvite();
    } catch (e) {
      showToast(String(e).slice(0, 96));
    } finally { setBusy(false); }
  }, [code, deepLink, showToast, onFirstInvite]);

  if (authed === false) {
    return (
      <div data-testid="referral-qr" style={{ padding: 14, border: "1px dashed rgba(255,204,0,0.24)", borderRadius: 16, background: "rgba(255,204,0,0.04)", textAlign: "center" as const }}>
        <div style={{ fontWeight: 900, fontSize: 13, color: "#ffcc00", letterSpacing: "0.06em" }}>ПРИГЛАСИ БРАТУХУ — QR</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.62)", marginTop: 6 }}>Войди чтобы получить БРАТУХА-КОД 42-XXXX и QR-диплинк</div>
        <a href="/magnum/presave-rating" style={{ display: "inline-block", marginTop: 10, fontSize: 12, color: "#ffcc00", textDecoration: "underline" }}>Войти · рейтинг →</a>
      </div>
    );
  }
  if (!code) {
    return <div data-testid="referral-qr" style={{ padding: 14, color: "rgba(255,255,255,0.55)", fontSize: 13 }}>Готовлю QR…</div>;
  }

  if (variant === "compact") {
    return (
      <div data-testid="referral-qr" style={{ display: "flex", gap: 12, alignItems: "center", padding: 12, border: "1px solid rgba(255,204,0,0.18)", borderRadius: 14, background: "rgba(255,204,0,0.06)" }}>
        <canvas ref={canvasRef} width={qrSize + 24} height={qrSize + 24} style={{ width: qrSize + 24, height: qrSize + 24, borderRadius: 10, background: "#fff", flexShrink: 0 }} aria-label={`QR для ${code}`} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 13, color: "#ffcc00" }}>ПРИГЛАСИ БРАТУХУ — QR</div>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#fff", marginTop: 4, fontFamily: "ui-monospace, monospace" }}>{code}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.52)", wordBreak: "break-all" as const, marginTop: 2 }}>{deepLink}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <button onClick={copyCode} data-testid="referral-qr-copy-code" style={{ padding: "6px 10px", borderRadius: 999, border: 0, background: "#ff2d55", color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Копи код</button>
            <button onClick={copyLink} data-testid="referral-qr-copy-link" style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Копи ссылку</button>
          </div>
        </div>
        {toast && <div role="status" style={{ position: "fixed", left: "50%", bottom: 18, transform: "translateX(-50%)", background: "rgba(20,20,20,0.96)", color: "#fff", border: "1px solid rgba(255,204,0,0.22)", padding: "10px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, zIndex: 50 }}>{toast}</div>}
      </div>
    );
  }

  return (
    <div data-testid="referral-qr" style={{ border: "1px solid rgba(255,204,0,0.22)", borderRadius: 18, background: "linear-gradient(180deg, rgba(255,204,0,0.08), rgba(255,45,85,0.06) 55%, rgba(18,18,22,0.96))", padding: 18, boxShadow: "0 12px 36px rgba(0,0,0,0.35), 0 0 22px rgba(255,204,0,0.08)" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, background: "rgba(255,204,0,0.14)", border: "1px solid rgba(255,204,0,0.28)", color: "#ffcc00", fontSize: 11, fontWeight: 900, letterSpacing: "0.08em" }}>ПРИГЛАСИ БРАТУХУ — QR</span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 700 }}>диплинк ?ref={code} · QR + OG 1080×1080</span>
        {invitedCount !== null && <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.42)" }}>Приглашено: {invitedCount}</span>}
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ background: "#fff", padding: 12, borderRadius: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}>
          <canvas ref={canvasRef} width={qrSize + 24} height={qrSize + 24} style={{ width: qrSize + 24, height: qrSize + 24, display: "block", borderRadius: 8 }} aria-label={`QR для ${code}`} />
          <div style={{ textAlign: "center" as const, marginTop: 8, fontWeight: 900, fontSize: 13, letterSpacing: "0.08em", color: "#0a0a0a", fontFamily: "ui-monospace, monospace" }}>{code}</div>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 900, fontSize: 16, color: "#fff", lineHeight: 1.25 }}>Твой БРАТУХА-КОД <span style={{ color: "#ffcc00", fontFamily: "ui-monospace, monospace" }}>{code}</span></div>
          <div style={{ marginTop: 6, fontSize: 13, color: "rgba(255,255,255,0.68)", lineHeight: 1.5, wordBreak: "break-all" as const }}>
            Диплинк: <span style={{ fontFamily: "ui-monospace, monospace", color: "rgba(255,255,255,0.88)" }}>{deepLink}</span>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.52)", lineHeight: 1.45 }}>
            Сканируй QR → пресейв с <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 6 }}> ?ref={code}</code>. Первый инвайт = <b style={{ color: "#ffcc00" }}>+142 dust обоим</b>, 3 инвайта = <b style={{ color: "#ffcc00" }}>+420</b>.
            OG-карта 1080×1080 из ShareCard — шарится с QR и кодом.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <button onClick={copyCode} data-testid="referral-qr-copy-code" style={{ appearance: "none", border: 0, padding: "10px 16px", borderRadius: 999, background: "#ff2d55", color: "#fff", fontWeight: 900, fontSize: 13, cursor: "pointer", boxShadow: "0 8px 20px rgba(255,45,85,0.22)" }}>Копировать код</button>
            <button onClick={copyLink} data-testid="referral-qr-copy-link" style={{ appearance: "none", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 800, fontSize: 13, padding: "10px 16px", borderRadius: 999, cursor: "pointer" }}>Копировать ссылку</button>
            <button onClick={handleShareOG} disabled={busy} data-testid="referral-qr-share-og" style={{ appearance: "none", border: "1px solid rgba(255,204,0,0.24)", background: busy ? "#333" : "linear-gradient(135deg,#ff2d55,#ffcc00)", color: busy ? "#aaa" : "#fff", fontWeight: 900, fontSize: 13, padding: "10px 16px", borderRadius: 999, cursor: busy ? "wait" : "pointer" }}>{busy ? "Готовлю 1080…" : "Поделиться OG 1080"}</button>
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.32)" }}>
            QR — canvas (api.qrserver + fallback grid) · диплинк ?ref=CODE · OG 1080×1080 ShareCard · UTM проброс в presave
          </div>
        </div>
      </div>
      {toast && <div role="status" style={{ position: "fixed", left: "50%", bottom: 18, transform: "translateX(-50%)", background: "rgba(20,20,20,0.96)", color: "#fff", border: "1px solid rgba(255,204,0,0.22)", padding: "10px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, zIndex: 50 }}>{toast}</div>}
    </div>
  );
}
export default ReferralQR;
