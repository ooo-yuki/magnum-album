const CANVAS_SIZE = 1080;

export type DuelShareOpts = {
  score: number;
  game: string;
  username?: string | null;
  code?: string | null;
  elo?: number | null;
  durationSec?: number;
};

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

export async function drawDuelShareCard(canvas: HTMLCanvasElement, opts: DuelShareOpts): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = CANVAS_SIZE, H = CANVAS_SIZE;
  canvas.width = W; canvas.height = H;

  // bg gradient — volcano theme
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#0a0a0a");
  grad.addColorStop(0.3, "#1a0a0a");
  grad.addColorStop(0.6, "#2a0a00");
  grad.addColorStop(1, "#0d0d0d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // vignette
  const vg = ctx.createRadialGradient(W * 0.5, H * 0.38, 0, W * 0.5, H * 0.38, 720);
  vg.addColorStop(0, "rgba(255,87,34,0.12)");
  vg.addColorStop(0.5, "rgba(255,45,85,0.06)");
  vg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // outer gold frame
  ctx.strokeStyle = "#ff5722";
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, W - 12, H - 12);
  ctx.strokeStyle = "rgba(255,204,0,0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(16, 16, W - 32, H - 32);

  // top kicker
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "600 22px Inter, sans-serif";
  ctx.textAlign = "center";
  (ctx as unknown as { letterSpacing: string }).letterSpacing = "0.16em";
  ctx.fillText("MAGNUM  ·  DUEL 42  ·  10С  ·  WS 2-4", W / 2, 78);

  // volcano emoji big
  ctx.font = "900 72px Inter, sans-serif";
  ctx.fillText("🌋", W / 2, 145);

  // title DUEL 42
  ctx.font = "900 96px Inter, sans-serif";
  ctx.textAlign = "center";
  (ctx as unknown as { letterSpacing: string }).letterSpacing = "0.04em";
  const tGrad = ctx.createLinearGradient(W / 2 - 260, 0, W / 2 + 260, 0);
  tGrad.addColorStop(0, "#ff5722");
  tGrad.addColorStop(0.5, "#ffcc00");
  tGrad.addColorStop(1, "#ff5722");
  ctx.fillStyle = tGrad;
  ctx.shadowColor = "rgba(255,87,34,0.35)";
  ctx.shadowBlur = 18;
  ctx.fillText("DUEL 42", W / 2, 230);
  ctx.shadowBlur = 0;

  // score badge
  const badgeW = 620, badgeH = 120, badgeX = W / 2 - badgeW / 2, badgeY = 270;
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.strokeStyle = "rgba(255,87,34,0.35)";
  ctx.lineWidth = 1.5;
  const r = 20;
  ctx.beginPath();
  ctx.moveTo(badgeX + r, badgeY);
  ctx.arcTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + badgeH, r);
  ctx.arcTo(badgeX + badgeW, badgeY + badgeH, badgeX, badgeY + badgeH, r);
  ctx.arcTo(badgeX, badgeY + badgeH, badgeX, badgeY, r);
  ctx.arcTo(badgeX, badgeY, badgeX + badgeW, badgeY, r);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.font = "900 52px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${opts.score} очков · ${opts.game.toUpperCase()}`, W / 2, badgeY + 72);
  // sub
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.font = "500 18px Inter, sans-serif";
  ctx.fillText(`${opts.durationSec ?? 42}с дуэль · брось вызов братухам`, W / 2, badgeY + badgeH + 26);

  // code pill if present
  if (opts.code) {
    const label = `КОД ${opts.code.toUpperCase()}`;
    ctx.font = "900 36px Inter, sans-serif";
    const m = ctx.measureText(label);
    const pw = m.width + 40, ph = 48, px = W / 2 - pw / 2, py = badgeY + badgeH + 42;
    ctx.fillStyle = "rgba(255,204,0,0.14)";
    ctx.strokeStyle = "rgba(255,204,0,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const rr = 24;
    ctx.moveTo(px + rr, py);
    ctx.arcTo(px + pw, py, px + pw, py + ph, rr);
    ctx.arcTo(px + pw, py + ph, px, py + ph, rr);
    ctx.arcTo(px, py + ph, px, py, rr);
    ctx.arcTo(px, py, px + pw, py, rr);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ffcc00";
    ctx.fillText(label, W / 2, py + 34);
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "400 14px Inter, sans-serif";
    ctx.fillText("введи на /magnum/duel/lobby → Join", W / 2, py + ph + 18);
  }

  // ELO teaser + username
  if (opts.username) {
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "700 26px Inter, sans-serif";
    ctx.fillText(`@${opts.username}${opts.elo != null ? ` · ${opts.elo} ELO` : ""}`, W / 2, 520);
  }
  ctx.fillStyle = "rgba(255,204,0,0.9)";
  ctx.font = "800 20px Inter, sans-serif";
  ctx.fillText("ТОП-3 🌋 VOLCANO CROWN +1420 · ELO +42", W / 2, opts.username ? 550 : 530);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "400 15px Inter, sans-serif";
  ctx.fillText("победи → забери корону вулкана", W / 2, opts.username ? 572 : 552);

  // QR block
  const shareUrl = `https://5opka.ru/magnum/duel/lobby?code=${(opts.code ?? "DUEL").toUpperCase()}&utm_source=duel_share&score=${opts.score}&game=${encodeURIComponent(opts.game)}`;
  const qrSize = 240, qrX = W / 2 - qrSize / 2, qrY = 620;
  ctx.fillStyle = "#fff";
  ctx.fillRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
  const qrImg = await loadQrImage(shareUrl, qrSize);
  if (qrImg) ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  else {
    ctx.fillStyle = "#0a0a0a"; ctx.fillRect(qrX, qrY, qrSize, qrSize);
    ctx.fillStyle = "#fff"; ctx.font = "600 14px Inter, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("QR", qrX + qrSize / 2, qrY + qrSize / 2);
  }
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.font = "600 18px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("5opka.ru/magnum/duel/lobby", W / 2, qrY + qrSize + 32);
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.font = "400 14px Inter, sans-serif";
  ctx.fillText(`Сканируй → дуэль 42с · код ${opts.code?.toUpperCase() ?? "DUEL"}`, W / 2, qrY + qrSize + 54);

  // bottom bar
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(0, H - 70, W, 70);
  ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, H - 70); ctx.lineTo(W, H - 70); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.font = "600 13px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("DUEL 42 · 10С · KOMBO X4 +25% · ERUPTION 2.5X", 22, H - 28);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,87,34,0.95)";
  ctx.fillText("🌋 VOLCANO CROWN", W - 22, H - 28);
}

export async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob null"))), "image/png", 1.0);
  });
}

export async function shareOrDownloadDuel(blob: Blob, filename: string, text: string) {
  const file = new File([blob], filename, { type: "image/png" });
  try {
    const nav = navigator as unknown as { canShare?: (d: { files: File[] }) => boolean; share?: (d: { files: File[]; title: string; text: string; url?: string }) => Promise<void> };
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      await nav.share({ files: [file], title: "DUEL 42 — вызов", text });
      return "shared" as const;
    }
    if (nav.share) {
      try { await nav.share({ title: "DUEL 42 — вызов", text, url: `https://5opka.ru/magnum/duel/lobby` } as unknown as { files: File[]; title: string; text: string }); return "shared" as const; } catch {}
    }
  } catch {}
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "downloaded" as const;
}
