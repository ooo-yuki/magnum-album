export const DUEL_SHARE_BASE = "https://5opka.ru/magnum/duel/lobby";
export const DUEL_UTM = "utm_source=duel_share&utm_medium=share&utm_campaign=magnum42";

export function buildDuelShareUrl(opts: { code?: string; score?: number; game?: string } = {}): string {
  const params = new URLSearchParams(DUEL_UTM);
  if (opts.code) params.set("code", opts.code.toUpperCase().slice(0,4));
  if (typeof opts.score === "number") params.set("score", String(Math.round(opts.score)));
  if (opts.game) params.set("game", opts.game);
  return `${DUEL_SHARE_BASE}?${params.toString()}`;
}

export function duelShareText(score?: number, elo?: number): string {
  const s = typeof score === "number" ? ` — ${Math.round(score)} очков` : "";
  const e = typeof elo === "number" ? ` · ELO ${elo}` : "";
  return `Я вызвал на дуэль в MAGNUM${s}${e} — прими вызов 42!`;
}

const CANVAS_SIZE = 1080;

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

export type DuelCardOpts = {
  username?: string | null;
  score?: number;
  elo?: number;
  gameLabel?: string;
  code?: string;
  wager?: number;
};

export async function drawDuelShareCard(
  canvas: HTMLCanvasElement,
  opts: DuelCardOpts = {},
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = CANVAS_SIZE, H = CANVAS_SIZE;
  canvas.width = W; canvas.height = H;

  // bg — volcano gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#0a0a0a");
  grad.addColorStop(0.28, "#1a0a12");
  grad.addColorStop(0.55, "#2a0e14");
  grad.addColorStop(1, "#0d0d0d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // vignette
  const vg = ctx.createRadialGradient(W*0.5, H*0.4, 0, W*0.5, H*0.4, 760);
  vg.addColorStop(0, "rgba(255,69,0,0.10)");
  vg.addColorStop(0.5, "rgba(255,45,85,0.06)");
  vg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = vg;
  ctx.fillRect(0,0,W,H);

  // outer frame — volcano
  ctx.strokeStyle = "#ff4500";
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, W-12, H-12);
  ctx.strokeStyle = "rgba(255,204,0,0.32)";
  ctx.lineWidth = 1;
  ctx.strokeRect(18, 18, W-36, H-36);

  // kicker
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "600 22px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("MAGNUM  ·  ДУЭЛЬ 42  ·  5 ПУЛЬ", W/2, 84);

  // title gradient
  ctx.textAlign = "center";
  ctx.font = "900 92px Inter, sans-serif";
  const titleGrad = ctx.createLinearGradient(W/2-360,0,W/2+360,0);
  titleGrad.addColorStop(0, "#ff4500");
  titleGrad.addColorStop(0.5, "#ffcc00");
  titleGrad.addColorStop(1, "#ff2d55");
  ctx.fillStyle = titleGrad;
  ctx.shadowColor = "rgba(255,69,0,0.32)";
  ctx.shadowBlur = 22;
  ctx.fillText("ВЫЗОВ НА", W/2, 200);
  ctx.fillText("ДУЭЛЬ", W/2, 300);
  ctx.shadowBlur = 0;

  //subtitle volcano
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "600 26px Inter, sans-serif";
  ctx.letterSpacing = "0.10em";
  const sub = opts.gameLabel ? `5opka × MAGNUM  ·  ${opts.gameLabel}` : "5opka × MAGNUM  ·  ELO АРЕНА";
  ctx.fillText(sub, W/2, 344);

  // badge — Я вызвал на дуэль
  const badgeW = 620, badgeH = 96;
  const badgeX = W/2 - badgeW/2, badgeY = 382;
  ctx.fillStyle = "rgba(255,69,0,0.10)";
  ctx.strokeStyle = "rgba(255,69,0,0.38)";
  ctx.lineWidth = 1.5;
  const r = 18;
  ctx.beginPath();
  ctx.moveTo(badgeX+r, badgeY);
  ctx.arcTo(badgeX+badgeW, badgeY, badgeX+badgeW, badgeY+badgeH, r);
  ctx.arcTo(badgeX+badgeW, badgeY+badgeH, badgeX, badgeY+badgeH, r);
  ctx.arcTo(badgeX, badgeY+badgeH, badgeX, badgeY, r);
  ctx.arcTo(badgeX, badgeY, badgeX+badgeW, badgeY, r);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = "900 42px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.letterSpacing = "0.03em";
  ctx.fillText("Я ВЫЗВАЛ НА ДУЭЛЬ", W/2, badgeY+62);

  // score + ELO line
  const lineY = badgeY + badgeH + 52;
  const parts: string[] = [];
  if (typeof opts.score === "number") parts.push(`${Math.round(opts.score)} очков`);
  if (typeof opts.elo === "number") parts.push(`ELO ${opts.elo}`);
  if (typeof opts.wager === "number" && opts.wager>0) parts.push(`ставка ${opts.wager} dust`);
  const line = parts.length ? parts.join("  ·  ") : "прими вызов — 10с NITRO арена";
  ctx.fillStyle = parts.length ? "#ffcc00" : "rgba(255,255,255,0.62)";
  ctx.font = "700 26px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(line, W/2, lineY);

  // username pill
  if (opts.username) {
    const y = lineY + 42;
    const label = opts.username.slice(0,24);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    const m = ctx.measureText(label);
    const pw = m.width + 36, px = W/2 - pw/2;
    ctx.beginPath();
    const rr = 20;
    ctx.moveTo(px+rr, y-28);
    ctx.arcTo(px+pw, y-28, px+pw, y+14, rr);
    ctx.arcTo(px+pw, y+14, px, y+14, rr);
    ctx.arcTo(px, y+14, px, y-28, rr);
    ctx.arcTo(px, y-28, px+pw, y-28, rr);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "700 30px Inter, sans-serif";
    ctx.fillText(label, W/2, y);
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "400 16px Inter, sans-serif";
    ctx.fillText("братуха 42  ·  volcano-crown 👑", W/2, y+26);
  }

  // QR
  const url = buildDuelShareUrl({ code: opts.code, score: opts.score, game: opts.gameLabel });
  const qrSize = 260;
  const qrY = opts.username ? 572 : 542;
  const qrX = W/2 - qrSize/2;
  ctx.fillStyle = "#fff";
  ctx.fillRect(qrX-12, qrY-12, qrSize+24, qrSize+24);
  const qrImg = await loadQrImage(url, qrSize);
  if (qrImg) {
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  } else {
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(qrX, qrY, qrSize, qrSize);
    ctx.fillStyle = "#fff";
    const cells=21, cell=qrSize/cells;
    let seed=0; for(let i=0;i<url.length;i++) seed=(seed*31+url.charCodeAt(i))>>>0;
    const rnd=()=>(seed=(seed*1664525+1013904223)>>>0)/0xffffffff;
    for(let y=0;y<cells;y++) for(let x=0;x<cells;x++){
      const isFinder=(x<7&&y<7)||(x>=cells-7&&y<7)||(x<7&&y>=cells-7);
      let v:boolean;
      if(isFinder){ const fx=x%7,fy=y%7; v=(fx===0||fx===6||fy===0||fy===6||(fx>=2&&fx<=4&&fy>=2&&fy<=4)); }
      else v=rnd()>0.48;
      if(v) ctx.fillRect(qrX+x*cell+0.5, qrY+y*cell+0.5, cell-1, cell-1);
    }
  }
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.font = "600 18px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("5opka.ru/magnum/duel/lobby", W/2, qrY+qrSize+38);
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.font = "400 14px Inter, sans-serif";
  const utmLine = "utm_source=duel_share  ·  сканируй → прими вызов";
  ctx.fillText(utmLine, W/2, qrY+qrSize+60);
  if (opts.code) {
    ctx.fillStyle = "rgba(255,204,0,0.95)";
    ctx.font = "800 22px Inter, sans-serif";
    ctx.fillText(`КОД ${opts.code.toUpperCase()}`, W/2, qrY+qrSize+86);
  }

  // bottom bar
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(0, H-72, W, 72);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0,H-72); ctx.lineTo(W,H-72); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.font = "600 13px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("ДРОП 15.09.2026  ·  ДУЭЛЬ 42  ·  +42 ELO ЗА ПОБЕДУ", 28, H-32);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,69,0,0.95)";
  ctx.fillText("🌋 VOLCANO ARENA", W-28, H-32);
}

export async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => b ? resolve(b) : reject(new Error("toBlob null")), "image/png", 1.0);
  });
}

export async function shareDuelCard(blob: Blob, filename: string, shareUrl: string, shareText: string) {
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as unknown as { canShare?: (d:{files:File[]})=>boolean; share?: (d:{files?:File[]; title:string; text:string; url?:string})=>Promise<void> };
  try {
    if (nav.canShare?.({files:[file]}) && nav.share) {
      await nav.share({ files:[file], title:"MAGNUM — Вызов на дуэль", text: shareText });
      return "shared" as const;
    }
    if (nav.share) {
      try {
        await nav.share({ title:"MAGNUM — Вызов на дуэль", text: `${shareText} — ${shareUrl}`, url: shareUrl } as unknown as {files:File[]; title:string; text:string});
        return "shared" as const;
      } catch {/* fallback */}
    }
  } catch {/* fallback */}
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  return "downloaded" as const;
}
