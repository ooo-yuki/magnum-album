// CosmeticBadge — показ купленной косметики (рамка/баннер/титул) в публичных рейтингах.
// Сервер отдаёт в строках лидерборда только id (frame/banner/title), стиль берётся
// из единого каталога src/lib/cosmetics.ts.
import type { CSSProperties, ReactNode } from "react";
import { COSMETICS_CATALOG, SKIN_EMOJI } from "../lib/cosmetics";

const BY_ID = new Map(COSMETICS_CATALOG.map((c) => [c.id, c]));

export type LeaderCosmetics = {
  frame?: string | null;
  banner?: string | null;
  title?: string | null;
};

function isGradient(style: string): boolean {
  return style.startsWith("conic-gradient") || style.startsWith("linear-gradient") || style.startsWith("radial-gradient");
}

export function cosmeticStyle(id?: string | null): string | null {
  if (!id) return null;
  return BY_ID.get(id)?.style ?? null;
}

export function cosmeticName(id?: string | null): string | null {
  if (!id) return null;
  return BY_ID.get(id)?.name ?? null;
}

/** Эмодзи скина-аватара (magnum_shop_inventory.skin_id), не URL картинки. */
export function skinEmoji(skinId?: string | null): string | null {
  if (!skinId) return null;
  return SKIN_EMOJI[skinId] ?? null;
}

/** Аватар в купленной рамке. Градиентные рамки рисуются кольцом, обычные — border. */
export function CosmeticAvatar({
  avatar,
  frame,
  size = 32,
  fallback,
  title,
}: {
  avatar?: string | null;
  frame?: string | null;
  size?: number;
  fallback?: ReactNode;
  title?: string;
}) {
  const frameStyle = cosmeticStyle(frame);
  const emoji = skinEmoji(avatar);
  const inner: CSSProperties = {
    width: size, height: size, borderRadius: 999,
    display: "grid", placeItems: "center",
    fontSize: Math.round(size * 0.56), lineHeight: 1,
    background: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  };
  const content = <span style={inner}>{emoji ?? fallback ?? "🙂"}</span>;
  if (!frameStyle) {
    return <span title={title} style={{ display: "inline-flex" }}>{content}</span>;
  }
  if (isGradient(frameStyle)) {
    return (
      <span
        title={title ?? cosmeticName(frame) ?? undefined}
        style={{ display: "inline-flex", padding: 2, borderRadius: 999, background: frameStyle }}
      >
        {content}
      </span>
    );
  }
  return (
    <span
      title={title ?? cosmeticName(frame) ?? undefined}
      style={{ display: "inline-flex", borderRadius: 999, border: frameStyle }}
    >
      {content}
    </span>
  );
}

/** Купленный титул под/рядом с ником. Градиентные титулы — градиент по тексту. */
export function CosmeticTitle({ title, fontSize = 10 }: { title?: string | null; fontSize?: number }) {
  const style = cosmeticStyle(title);
  const name = cosmeticName(title);
  if (!style || !name) return null;
  const base: CSSProperties = {
    fontSize, fontWeight: 800, letterSpacing: "0.02em",
    padding: "1px 6px", borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    whiteSpace: "nowrap",
  };
  if (isGradient(style)) {
    return (
      <span style={{ ...base, backgroundImage: style, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
        {name}
      </span>
    );
  }
  return <span style={{ ...base, color: style }}>{name}</span>;
}

/** Полоска купленного баннера — фон строки рейтинга. */
export function cosmeticBannerStyle(banner?: string | null): CSSProperties | undefined {
  const style = cosmeticStyle(banner);
  if (!style) return undefined;
  return {
    backgroundImage: style,
    backgroundRepeat: "no-repeat",
    backgroundSize: "100% 3px",
    backgroundPosition: "bottom left",
  };
}

/** Готовая связка «аватар + ник + титул» для строки лидерборда. */
export function CosmeticIdentity({
  username,
  avatar,
  frame,
  title,
  verified,
  size = 28,
  nameStyle,
}: LeaderCosmetics & {
  username: string;
  avatar?: string | null;
  verified?: boolean;
  size?: number;
  nameStyle?: CSSProperties;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      <CosmeticAvatar avatar={avatar} frame={frame} size={size} title={username} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...nameStyle }}>{username}</span>
      {verified && <span title="verified 42" style={{ color: "#ffd700", fontSize: 11 }}>✓</span>}
      <CosmeticTitle title={title} />
    </span>
  );
}
