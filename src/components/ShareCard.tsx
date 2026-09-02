import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";

const SHARE_URL = "https://music.thefence.me/psmagnum";
const SHARE_TEXT = "Я в 42 — MAGNUM пресейв. 5 пуль, 42 братухи, золотая рамка первым 42";
const CANVAS_SIZE = 1080;

// pure QR via api.qrserver (CORS-enabled) with fallback grid
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

export type ShareCardOpts = {
  username?: string | null;
  verified?: boolean;
  avatarEmoji?: string;
};

export async function drawShareCard(
  canvas: HTMLCanvasElement,
  opts: ShareCardOpts = {},
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = CANVAS_SIZE;
  const H = CANVAS_SIZE;
  canvas.width = W;
  canvas.height = H;

  // bg gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#0a0a0a");
  grad.addColorStop(0.35, "#141016");
  grad.addColorStop(0.7, "#1a0a14");
  grad.addColorStop(1, "#0d0d0d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // vignette radial
  const vg = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, 700);
  vg.addColorStop(0, "rgba(255,45,85,0.08)");
  vg.addColorStop(0.5, "rgba(255,204,0,0.04)");
  vg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // outer gold frame 14px
  ctx.strokeStyle = "#ffcc00";
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, W - 14, H - 14);
  ctx.strokeStyle = "rgba(255,204,0,0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(18, 18, W - 36, H - 36);

  // top kicker
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = '600 24px Inter, sans-serif';
  ctx.letterSpacing = "0.18em";
  ctx.textAlign = "center";
  ctx.fillText("MAGNUM  ·  5 ПУЛЬ  ·  THE FENCE / DRUMEDY", W / 2, 88);

  // MAGNUM title with gold gradient
  ctx.textAlign = "center";
  ctx.font = "900 148px Inter, sans-serif";
  ctx.letterSpacing = "0.04em";
  const titleGrad = ctx.createLinearGradient(W / 2 - 320, 0, W / 2 + 320, 0);
  titleGrad.addColorStop(0, "#ff2d55");
  titleGrad.addColorStop(0.5, "#ffcc00");
  titleGrad.addColorStop(1, "#ff2d55");
  ctx.fillStyle = titleGrad;
  // shadow
  ctx.shadowColor = "rgba(255,45,85,0.35)";
  ctx.shadowBlur = 22;
  ctx.fillText("MAGNUM", W / 2, 250);
  ctx.shadowBlur = 0;

  // subtitle 5opka x MellSher
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = "400 28px Inter, sans-serif";
  ctx.letterSpacing = "0.14em";
  ctx.fillText("5opka  ×  MellSher", W / 2, 295);

  // Я в 42 badge — centered card
  const badgeW = 520;
  const badgeH = 110;
  const badgeX = W / 2 - badgeW / 2;
  const badgeY = 340;
  // badge bg
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.strokeStyle = "rgba(255,45,85,0.35)";
  ctx.lineWidth = 1.5;
  // rounded rect
  const r = 22;
  ctx.beginPath();
  ctx.moveTo(badgeX + r, badgeY);
  ctx.arcTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + badgeH, r);
  ctx.arcTo(badgeX + badgeW, badgeY + badgeH, badgeX, badgeY + badgeH, r);
  ctx.arcTo(badgeX, badgeY + badgeH, badgeX, badgeY, r);
  ctx.arcTo(badgeX, badgeY, badgeX + badgeW, badgeY, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Я в 42 text
  ctx.fillStyle = "#fff";
  ctx.font = "900 62px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.letterSpacing = "0.04em";
  ctx.fillText("Я В 42", W / 2, badgeY + 72);
  // glow under badge
  ctx.fillStyle = "rgba(255,45,85,0.14)";
  ctx.beginPath();
  ctx.ellipse(W / 2, badgeY + badgeH + 18, 220, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // username + verified if present
  if (opts.username) {
    const y = badgeY + badgeH + 68;
    ctx.fillStyle = opts.verified ? "#ffcc00" : "rgba(255,255,255,0.92)";
    ctx.font = opts.verified ? "800 38px Inter, sans-serif" : "600 36px Inter, sans-serif";
    ctx.textAlign = "center";
    const label = opts.verified ? `${opts.avatarEmoji ?? "★"} ${opts.username}  ✓ VERIFIED` : opts.username;
    // bg pill behind username
    const metrics = ctx.measureText(label);
    const pw = metrics.width + 36;
    const px = W / 2 - pw / 2;
    ctx.fillStyle = opts.verified ? "rgba(255,204,0,0.14)" : "rgba(255,255,255,0.08)";
    // pill
    ctx.beginPath();
    // @ts-ignore roundRect may not be in lib
    if (typeof (ctx as unknown as { roundRect?: unknown }).roundRect === "function") {
      (ctx as unknown as { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(px, y - 34, pw, 46, 23);
      ctx.fill();
    } else {
      ctx.fillRect(px, y - 34, pw, 46);
    }
    ctx.fillStyle = opts.verified ? "#ffcc00" : "#fff";
    ctx.fillText(label, W / 2, y);
    // subhint
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "400 18px Inter, sans-serif";
    ctx.fillText(opts.verified ? "золотая рамка — первые 42" : "участник 42 братух", W / 2, y + 28);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.52)";
    ctx.font = "400 20px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("первые 42 — золотая рамка  ·  пресейв открыт", W / 2, badgeY + badgeH + 56);
  }

  // QR block — centered lower
  const qrSize = 260;
  const qrX = W / 2 - qrSize / 2;
  const qrY = opts.username ? 560 : 530;
  // QR bg
  ctx.fillStyle = "#fff";
  ctx.fillRect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 24);
  // try load real QR
  const qrImg = await loadQrImage(SHARE_URL, qrSize);
  if (qrImg) {
    // draw with slight inset
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  } else {
    // fallback: draw pseudo-QR grid
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(qrX, qrY, qrSize, qrSize);
    ctx.fillStyle = "#fff";
    const cells = 21;
    const cell = qrSize / cells;
    // simple pattern seeded by url
    let seed = 0;
    for (let i = 0; i < SHARE_URL.length; i++) seed = (seed * 31 + SHARE_URL.charCodeAt(i)) >>> 0;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 0xffffffff;
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        // finder patterns in corners
        const isFinder = (x < 7 && y < 7) || (x >= cells - 7 && y < 7) || (x < 7 && y >= cells - 7);
        let v: boolean;
        if (isFinder) {
          const fx = x % 7, fy = y % 7;
          v = (fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4));
        } else {
          v = rnd() > 0.48;
        }
        if (v) ctx.fillRect(qrX + x * cell + 0.5, qrY + y * cell + 0.5, cell - 1, cell - 1);
      }
    }
    ctx.fillStyle = "#0a0a0a";
    ctx.font = "600 14px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("QR", qrX + qrSize / 2, qrY + qrSize + 18);
  }
  // URL under QR
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.font = "600 20px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.letterSpacing = "0.04em";
  ctx.fillText("music.thefence.me/psmagnum", W / 2, qrY + qrSize + 44);
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.font = "400 15px Inter, sans-serif";
  ctx.fillText("Сканируй → пресейв  ·  5opka.ru/magnum", W / 2, qrY + qrSize + 68);

  // bottom bar: presave date + FOMO
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(0, H - 78, W, 78);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, H - 78);
  ctx.lineTo(W, H - 78);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.font = "600 14px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.letterSpacing = "0.1em";
  ctx.fillText("ДРОП 15.09.2026  ·  ПЕРВЫЕ 42 — ЗОЛОТО", 28, H - 32);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,204,0,0.95)";
  ctx.fillText("★ 42 БРАТУХИ", W - 28, H - 32);
}

export async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob null"))), "image/png", 1.0);
  });
}

export async function shareOrDownload(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: "image/png" });
  const text = SHARE_TEXT;
  // Web Share API with files
  try {
    const nav = navigator as unknown as { canShare?: (d: { files: File[] }) => boolean; share?: (d: { files: File[]; title: string; text: string; url?: string }) => Promise<void> };
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      await nav.share({ files: [file], title: "MAGNUM — Я в 42", text });
      return "shared" as const;
    }
    if (nav.share) {
      // text+url fallback (no files)
      try {
        await nav.share({ title: "MAGNUM — Я в 42", text: `${text} — ${SHARE_URL}`, url: SHARE_URL } as unknown as { files: File[]; title: string; text: string });
        return "shared" as const;
      } catch { /* fallthrough to download */ }
    }
  } catch { /* ignore, fallback */ }
  // download fallback
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "downloaded" as const;
}

export function ShareCardPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<{ username: string; verified: boolean; avatar?: string | null } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // fetch verified user from frame/status or me
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // try frame/status first
        const r = await fetch("/magnum/api/frame/status", { credentials: "include" });
        if (r.ok) {
          const j = (await r.json()) as { frames?: Array<{ username: string; verified: boolean; avatar?: string | null }> };
          const verified = j.frames?.find((f) => f.verified);
          if (verified && !cancelled) {
            setUser({ username: verified.username, verified: true, avatar: verified.avatar ?? null });
            return;
          }
          const any = j.frames?.[0];
          if (any && !cancelled) {
            setUser({ username: any.username, verified: Boolean(any.verified), avatar: any.avatar ?? null });
            return;
          }
        }
        // fallback: /magnum/api/me
        const r2 = await fetch("/magnum/api/me", { credentials: "include" });
        if (r2.ok) {
          const j2 = (await r2.json()) as { username?: string; verified?: boolean };
          if (j2.username && !cancelled) setUser({ username: j2.username, verified: Boolean(j2.verified) });
        }
        // query ?u= override for sharing demo
        const sp = new URLSearchParams(window.location.search);
        const qu = sp.get("u") || sp.get("user");
        if (qu && !cancelled) setUser((prev) => prev ?? { username: qu.slice(0, 24), verified: false });
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const render = useCallback(async () => {
    if (!canvasRef.current) return;
    setGenerating(true);
    try {
      const skinEmoji: Record<string, string> = { mops: "🐗", rhino: "🦏", monkey: "🐵", frog: "🐸", panda: "🐼", fox: "🦊", owl: "🦉", shark: "🦈", flamingo: "🦩", wolf: "🐺", tiger: "🐯", dragon: "🐉" };
      const emoji = user?.avatar ? (skinEmoji[user.avatar.toLowerCase()] ?? "★") : "★";
      await drawShareCard(canvasRef.current, { username: user?.username ?? null, verified: Boolean(user?.verified), avatarEmoji: emoji });
      setReady(true);
    } finally {
      setGenerating(false);
    }
  }, [user]);

  useEffect(() => { void render(); }, [render]);

  useEffect(() => {
    if (!wrapRef.current || !ready) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.set(wrapRef.current, { y: 18, opacity: 0 });
      gsap.to(wrapRef.current, { y: 0, opacity: 1, duration: 0.5, ease: "power2.out" });
      if (canvasRef.current) {
        gsap.set(canvasRef.current, { scale: 0.96, opacity: 0 });
        gsap.to(canvasRef.current, { scale: 1, opacity: 1, duration: 0.55, ease: "back.out(1.2)", delay: 0.12 });
      }
    }, wrapRef);
    return () => ctx.revert();
  }, [ready]);

  const onShare = async () => {
    if (!canvasRef.current) return;
    setGenerating(true);
    try {
      // re-render to ensure fresh username
      await render();
      const blob = await canvasToBlob(canvasRef.current);
      const safeName = (user?.username ?? "magnum").replace(/[^a-z0-9_-]/gi, "_").slice(0, 20) || "magnum";
      const res = await shareOrDownload(blob, `magnum-ya-v-42-${safeName}-1080.png`);
      setToast(res === "shared" ? "Поделились 🔥 — +42 братухи" : "Скачано PNG 1080×1080 ✓");
    } catch (e) {
      setToast(String(e).slice(0, 80));
    } finally {
      setGenerating(false);
      setTimeout(() => setToast(null), 2400);
    }
  };

  const onDownload = async () => {
    if (!canvasRef.current) return;
    const blob = await canvasToBlob(canvasRef.current);
    const safeName = (user?.username ?? "magnum").replace(/[^a-z0-9_-]/gi, "_").slice(0, 20) || "magnum";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `magnum-ya-v-42-${safeName}-1080.png`;
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    setToast("Скачано 1080×1080 ✓");
    setTimeout(() => setToast(null), 2200);
  };

  return (
    <div ref={wrapRef} style={{ maxWidth: 720, margin: "0 auto", padding: "28px 16px 40px", color: "#fff" }}>
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <div style={{ display: "inline-block", fontSize: 11, letterSpacing: "0.14em", fontWeight: 800, color: "#ffcc00", background: "rgba(255,204,0,0.1)", border: "1px solid rgba(255,204,0,0.28)", padding: "6px 12px", borderRadius: 999 }}>ШАРИНГ-КАРТОЧКА 1080×1080</div>
        <h1 style={{ fontSize: 32, fontWeight: 900, margin: "14px 0 8px", letterSpacing: "-0.02em" }}>Я в 42 — MAGNUM</h1>
        <p style={{ color: "rgba(255,255,255,0.62)", fontSize: 14, lineHeight: 1.5, maxWidth: 520, margin: "0 auto" }}>
          Карточка 1080×1080 для сторис. Обложка MAGNUM + «Я в 42» + QR на <a href={SHARE_URL} target="_blank" rel="noopener noreferrer" style={{ color: "#ffcc00", textDecoration: "underline" }}>music.thefence.me/psmagnum</a>
          {user?.verified ? <> · <span style={{ color: "#ffcc00" }}>{user.username} ✓ verified — золотая рамка</span></> : user?.username ? <> · {user.username}</> : null}
        </p>
      </div>

      <div style={{ display: "grid", placeItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 16 }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          style={{ width: "100%", maxWidth: 520, height: "auto", aspectRatio: "1 / 1", borderRadius: 12, background: "#0a0a0a", display: "block", boxShadow: "0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,204,0,0.12)" }}
          aria-label="Шаринг-карточка MAGNUM 1080x1080"
        />
        {!ready && <div style={{ color: "rgba(255,255,255,0.55)", marginTop: 10, fontSize: 13 }}>{generating ? "Генерирую 1080×1080…" : "Готовлю карточку…"}</div>}
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 16 }}>
        <button
          onClick={onShare}
          disabled={generating}
          style={{ appearance: "none", border: 0, background: generating ? "#555" : "linear-gradient(135deg,#ff2d55,#ff6b35)", color: "#fff", fontWeight: 800, fontSize: 15, padding: "12px 20px", borderRadius: 999, cursor: generating ? "wait" : "pointer", boxShadow: "0 8px 24px rgba(255,45,85,0.28)" }}
          data-testid="share-card-share"
        >
          {generating ? "Готовлю…" : "Поделиться"}
        </button>
        <button
          onClick={onDownload}
          disabled={generating}
          style={{ appearance: "none", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 700, fontSize: 15, padding: "12px 20px", borderRadius: 999, cursor: "pointer" }}
          data-testid="share-card-download"
        >
          Скачать PNG
        </button>
        <a href="/magnum/presave-rating" style={{ display: "inline-flex", alignItems: "center", color: "rgba(255,255,255,0.72)", fontSize: 13, textDecoration: "underline", padding: "12px 8px" }}>← рейтинг</a>
      </div>

      <div style={{ textAlign: "center", marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.38)" }}>
        1080×1080 · PNG · Web Share API → fallback скачивание · пресейв: music.thefence.me/psmagnum
      </div>

      {toast && <div role="status" style={{ position: "fixed", left: "50%", bottom: 18, transform: "translateX(-50%)", background: "rgba(20,20,20,0.96)", color: "#fff", border: "1px solid rgba(255,204,0,0.22)", padding: "10px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, zIndex: 50 }}>{toast}</div>}
    </div>
  );
}

export default ShareCardPage;
