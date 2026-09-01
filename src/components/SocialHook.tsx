import { useCallback, useState } from "react";
import { drawShareCard, canvasToBlob, shareOrDownload } from "./ShareCard";

// ── UTM трекинг для шеринга ──
export const SOCIAL_UTM = "utm_source=share&utm_medium=42&utm_campaign=presave7";
export const SOCIAL_SHARE_URL_BASE = "https://music.thefence.me/psmagnum";
export function getShareUrlWithUtm(): string {
  return `${SOCIAL_SHARE_URL_BASE}?${SOCIAL_UTM}`;
}
export function getLocalShareUrlWithUtm(): string {
  if (typeof window !== "undefined" && window.location.origin) {
    return `${window.location.origin}/magnum/presave-rating?${SOCIAL_UTM}`;
  }
  return `https://5opka.ru/magnum/presave-rating?${SOCIAL_UTM}`;
}
export const SOCIAL_SHARE_TEXT = "Я в 42 — MAGNUM пресейв. 7 пресейвов → 42 братухи до золотой рамки. Челлендж: зашей скрин пресейва в сторис с #МАГНУМ42 — топ-3 по шарам получают obsidian/glacier скины (1420 dust value)";
export const SOCIAL_HASHTAG = "МАГНУМ42";

function vkShareUrl(url: string, title: string): string {
  return `https://vk.com/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
}
function tgShareUrl(url: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}
function twitterShareUrl(url: string, text: string): string {
  return `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}&hashtags=${encodeURIComponent(SOCIAL_HASHTAG)}`;
}

type PresaverLite = { username: string; avatar?: string | null; verified?: boolean };

const SKIN_EMOJI: Record<string, string> = {
  mops: "🐗", rhino: "🦏", monkey: "🐵", frog: "🐸",
  panda: "🐼", fox: "🦊", owl: "🦉",
  shark: "🦈", flamingo: "🦩", wolf: "🐺",
  tiger: "🐯", dragon: "🐉",
};

function skinToEmoji(skinId: string | null | undefined): string {
  if (!skinId) return "👤";
  const k = skinId.trim().toLowerCase();
  return SKIN_EMOJI[k] ?? SKIN_EMOJI[k.replace("skin_", "").replace("skin-", "")] ?? "👤";
}

export function SocialHook({
  presavers = [],
  compact = false,
}: {
  presavers?: PresaverLite[];
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const shareUrl = getShareUrlWithUtm();
  const localShareUrl = getLocalShareUrlWithUtm();

  // 42 ячейки: первые N реальные, остальные заглушки FOMO "42"
  const real = presavers.slice(0, 7);
  const placeholders = 42 - real.length;
  const cells: Array<{ kind: "real"; p: PresaverLite } | { kind: "empty" }> = [
    ...real.map((p) => ({ kind: "real" as const, p })),
    ...Array.from({ length: Math.max(0, placeholders) }, () => ({ kind: "empty" as const })),
  ];

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  }, []);

  const handleShareBratuham = useCallback(async () => {
    setBusy(true);
    try {
      const off = document.createElement("canvas");
      const top = real[0];
      const username = top?.username ?? null;
      const verified = Boolean(top?.verified);
      const emoji = skinToEmoji(top?.avatar ?? null);
      await drawShareCard(off, { username, verified, avatarEmoji: emoji });
      const blob = await canvasToBlob(off);
      const safe = (username ?? "magnum").replace(/[^a-z0-9_-]/gi, "_").slice(0, 18) || "magnum";
      // share text includes UTM url
      const shareTextWithUtm = `${SOCIAL_SHARE_TEXT} — ${shareUrl}`;
      // temporarily monkey-patch ShareCard text? use shareOrDownload which uses internal SHARE_TEXT;
      // we instead try Web Share with file + text containing UTM, then fallback to download + open social
      const file = new File([blob], `magnum-ya-v-42-${safe}-1080.png`, { type: "image/png" });
      const nav = navigator as unknown as { canShare?: (d: { files: File[] }) => boolean; share?: (d: { files: File[]; title: string; text: string; url?: string }) => Promise<void> };
      let shared = false;
      try {
        if (nav.canShare?.({ files: [file] }) && nav.share) {
          await nav.share({ files: [file], title: "MAGNUM — Я в 42", text: shareTextWithUtm });
          shared = true;
        } else if (nav.share) {
          try {
            await nav.share({ title: "MAGNUM — Я в 42", text: shareTextWithUtm, url: shareUrl } as unknown as { files: File[]; title: string; text: string });
            shared = true;
          } catch { /* fallthrough */ }
        }
      } catch { /* user cancel or not supported */ }

      if (shared) {
        showToast("Поделились · Я в 42 🔥");
        return;
      }

      // fallback: download + also try shareOrDownload (which does download)
      const res = await shareOrDownload(blob, `magnum-ya-v-42-${safe}-1080.png`);
      showToast(res === "shared" ? "Поделились · Я в 42 🔥" : "Скачано PNG 1080×1080 — зашей в сторис с #МАГНУМ42");
    } catch (e) {
      showToast(String(e).slice(0, 96));
    } finally {
      setBusy(false);
    }
  }, [real, shareUrl, showToast]);

  const openVk = useCallback(() => {
    const url = vkShareUrl(localShareUrl, SOCIAL_SHARE_TEXT);
    window.open(url, "_blank", "noopener,noreferrer");
  }, [localShareUrl]);
  const openTg = useCallback(() => {
    const url = tgShareUrl(localShareUrl, SOCIAL_SHARE_TEXT);
    window.open(url, "_blank", "noopener,noreferrer");
  }, [localShareUrl]);
  const openTw = useCallback(() => {
    const url = twitterShareUrl(localShareUrl, SOCIAL_SHARE_TEXT);
    window.open(url, "_blank", "noopener,noreferrer");
  }, [localShareUrl]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(localShareUrl);
      showToast("Ссылка скопирована · " + SOCIAL_UTM);
    } catch {
      showToast(localShareUrl);
    }
  }, [localShareUrl, showToast]);

  if (compact) {
    return (
      <div data-testid="social-hook" style={{ padding: 12, border: "1px solid rgba(255,204,0,0.22)", borderRadius: 14, background: "rgba(255,204,0,0.06)" }}>
        <div style={{ fontWeight: 900, fontSize: 13, color: "#ffcc00" }}>42 братухи уже тут — {real.length}/42</div>
        <button onClick={handleShareBratuham} disabled={busy} data-testid="social-hook-share" style={{ marginTop: 8, padding: "8px 14px", borderRadius: 999, border: 0, background: "linear-gradient(135deg,#ff2d55,#ffcc00)", color: "#fff", fontWeight: 800, cursor: busy ? "wait" : "pointer" }}>
          {busy ? "Готовлю 1080…" : "Рассказать братухам"}
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="social-hook"
      style={{
        border: "1px solid rgba(255,204,0,0.22)",
        borderRadius: 18,
        background: "linear-gradient(180deg, rgba(255,204,0,0.08), rgba(255,45,85,0.06) 55%, rgba(18,18,22,0.9))",
        padding: 18,
        margin: "14px 0 18px",
        boxShadow: "0 12px 36px rgba(0,0,0,0.35), 0 0 22px rgba(255,204,0,0.08)",
      }}
    >
      {/* challenge header */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, background: "rgba(255,204,0,0.14)", border: "1px solid rgba(255,204,0,0.28)", color: "#ffcc00", fontSize: 11, fontWeight: 900, letterSpacing: "0.08em" }}>
          ЧЕЛЛЕНДЖ #МАГНУМ42
        </span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 700 }}>
          7 пресейвов → 42 братухи до золотой рамки
        </span>
      </div>

      <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.4, color: "#fff", marginBottom: 6 }}>
        Зашей скрин пресейва в сторис с <span style={{ color: "#ffcc00" }}>#МАГНУМ42</span> — топ-3 по шарам получают <span style={{ color: "#ffcc00" }}>obsidian / glacier</span> скины <span style={{ color: "rgba(255,255,255,0.62)", fontWeight: 700 }}>(1420 dust value)</span>
      </div>
      <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.62)", lineHeight: 1.5, marginBottom: 14 }}>
        Колаб 42: первые 42 верифицированных — золотая рамка. Делись карточкой 1080×1080, фомо-таймер тикает. Трек: <span style={{ fontFamily: "ui-monospace, monospace", color: "rgba(255,255,255,0.72)" }}>?{SOCIAL_UTM}</span>
      </div>

      {/* 42 братухи уже тут — аватарки 7 + заглушки */}
      <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 900, letterSpacing: "0.06em", color: "#ffcc00", textTransform: "uppercase" }}>
        42 братухи уже тут — {real.length}/42
      </div>
      <div
        data-testid="social-hook-avatars"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(42px, 1fr))",
          gap: 8,
          marginBottom: 16,
        }}
      >
        {cells.map((c, i) => {
          if (c.kind === "real") {
            const p = c.p;
            return (
              <div
                key={`real-${i}-${p.username}`}
                title={`${p.username}${p.verified ? " ✓" : ""}`}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  display: "grid",
                  placeItems: "center",
                  background: p.verified ? "linear-gradient(135deg, rgba(255,204,0,0.22), rgba(255,45,85,0.14))" : "rgba(255,255,255,0.06)",
                  border: p.verified ? "1.5px solid rgba(255,204,0,0.42)" : "1px solid rgba(35,35,43,1)",
                  fontSize: 18,
                  fontWeight: 800,
                  color: "#fff",
                  boxShadow: p.verified ? "0 0 12px rgba(255,204,0,0.22)" : "none",
                  overflow: "hidden",
                }}
              >
                {skinToEmoji(p.avatar)}
              </div>
            );
          }
          return (
            <div
              key={`empty-${i}`}
              title="слот 42 — свободен"
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                display: "grid",
                placeItems: "center",
                background: "rgba(255,255,255,0.03)",
                border: "1px dashed rgba(255,204,0,0.22)",
                color: "rgba(255,204,0,0.55)",
                fontSize: 11,
                fontWeight: 900,
              }}
            >
              42
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", marginBottom: 14 }}>
        {real.length ? `${real.map((r) => r.username).join(" · ")} — уже в 42` : "пока пусто — стань первым, займи слот 42"} · FOMO: осталось {42 - real.length} мест до закрытия золотой рамки
      </div>

      {/* main CTA */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={handleShareBratuham}
          disabled={busy}
          data-testid="social-hook-share"
          style={{
            appearance: "none",
            border: 0,
            padding: "12px 20px",
            borderRadius: 999,
            background: busy ? "#333" : "linear-gradient(135deg,#ff2d55,#ffcc00)",
            color: busy ? "#aaa" : "#fff",
            fontWeight: 900,
            fontSize: 14,
            letterSpacing: "0.02em",
            cursor: busy ? "wait" : "pointer",
            boxShadow: "0 8px 24px rgba(255,45,85,0.22)",
            opacity: busy ? 0.85 : 1,
          }}
        >
          {busy ? "Готовлю 1080…" : "Рассказать братухам"}
        </button>
        <button
          onClick={copyLink}
          data-testid="social-hook-copy"
          style={{
            appearance: "none",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            padding: "10px 14px",
            borderRadius: 999,
            cursor: "pointer",
          }}
        >
          Копировать ссылку с UTM
        </button>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", fontFamily: "ui-monospace, monospace" }}>
          {getLocalShareUrlWithUtm().slice(-44)}
        </span>
      </div>

      {/* VK / TG / Twitter */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button
          onClick={openVk}
          data-testid="social-hook-vk"
          style={{ appearance: "none", border: "1px solid rgba(0,119,255,0.28)", background: "rgba(0,119,255,0.12)", color: "#7eb8ff", fontWeight: 800, fontSize: 12, padding: "8px 12px", borderRadius: 999, cursor: "pointer" }}
        >
          VK
        </button>
        <button
          onClick={openTg}
          data-testid="social-hook-tg"
          style={{ appearance: "none", border: "1px solid rgba(0,136,204,0.28)", background: "rgba(0,136,204,0.12)", color: "#7ec8e6", fontWeight: 800, fontSize: 12, padding: "8px 12px", borderRadius: 999, cursor: "pointer" }}
        >
          TG
        </button>
        <button
          onClick={openTw}
          data-testid="social-hook-tw"
          style={{ appearance: "none", border: "1px solid rgba(29,161,242,0.28)", background: "rgba(29,161,242,0.12)", color: "#8ecdf8", fontWeight: 800, fontSize: 12, padding: "8px 12px", borderRadius: 999, cursor: "pointer" }}
        >
          Twitter
        </button>
        <a
          href="/magnum/share-card"
          style={{ display: "inline-flex", alignItems: "center", fontSize: 12, color: "rgba(255,255,255,0.62)", textDecoration: "underline", padding: "8px 6px" }}
        >
          Открыть карточку 1080×1080 →
        </a>
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.32)", lineHeight: 1.5 }}>
        Шарит OG-карту 1080×1080 (Web Share API → PNG fallback) + UTM <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 6 }}>{SOCIAL_UTM}</code> · #МАГНУМ42
      </div>

      {toast && (
        <div role="status" style={{ position: "fixed", left: "50%", bottom: 18, transform: "translateX(-50%)", background: "rgba(20,20,20,0.96)", color: "#fff", border: "1px solid rgba(255,204,0,0.22)", padding: "10px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, zIndex: 50 }}>
          {toast}
        </div>
      )}
    </div>
  );
}

export default SocialHook;
