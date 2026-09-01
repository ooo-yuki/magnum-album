// src/lib/galleryTokens.ts — extracted from GalleryPage.tsx:791-965 (P2-2)
// Real design tokens, no mock — source: GalleryPage.tsx:791
export const TOKENS = {
  color: {
    bg: "#0a0a0a", card: "#121214", card2: "#17171c", line: "#23232b",
    text: "#f2f2f2", dim: "#9aa4b2", red: "#ff2d55", yellow: "#ffcc00",
    green: "#00ff88", pink: "#ff9ad5", purple: "#7c3aed", blue: "#5865f2",
    cyan: "#22d3ee", orange: "#ff6b2d", gray: "#4b5563",
  },
  radius: { sm: 10, md: 14, lg: 16, xl: 20, pill: 999 },
  shadow: {
    card: "0 12px 32px rgba(0,0,0,0.45)",
    glowRed: "0 0 28px rgba(255,45,85,0.22)",
    glowGreen: "0 0 28px rgba(0,255,136,0.14)",
    glowYellow: "0 0 32px rgba(255,204,0,0.10)",
    focus: "0 0 0 3px rgba(255,45,85,0.22)",
  },
  motion: {
    entranceY: 24, stagger: 0.12, duration: 0.55, ease: "power2.out",
    hoverY: -4, hoverDur: 0.3, leaveDur: 0.4,
    lightboxIn: 0.42, lightboxOut: 0.28, gridDur: 0.5,
  },
  bp: { sm: 640, md: 768, lg: 1024, xl: 1280 },
} as const;
export type TokenColor = keyof typeof TOKENS.color;
export type TokenShadow = keyof typeof TOKENS.shadow;

// GSAP presets — source: GalleryPage.tsx:857
export const GSAP_PRESETS = {
  entrance: { y: 24, opacity: 0, stagger: 0.12, duration: 0.55, ease: "power2.out" },
  cards: { from: { y: 24, opacity: 0, scale: 0.96 }, to: { y: 0, opacity: 1, scale: 1, duration: 0.5, stagger: 0.12, ease: "back.out(1.2)" } },
  hoverEnter: { y: -4, duration: 0.3, ease: "power2.out" },
  hoverLeave: { y: 0, duration: 0.4, ease: "power2.out" },
  lightboxIn: { scale: 0.82, opacity: 0, y: 18, duration: 0.42, ease: "back.out(1.4)" },
  lightboxOut: { scale: 0.86, opacity: 0, duration: 0.28, ease: "power2.in" },
  scrollTrigger: { start: "top 92%", once: true },
} as const;

// Canonical real gallery files — единый источник (4 стиля × webp) — imported by GalleryPage.tsx
export const REAL_BY_STYLE: Record<string, string> = {
  "СССР": "/magnum/images/gallery-42/42-agit-01-800.webp",
  "Y2K": "/magnum/images/gallery-42/42-y2k-01-800.webp",
  "киберпанк": "/magnum/images/gallery-42/42-cyber-01-800.webp",
  "мемфис": "/magnum/images/gallery-42/42-memphis-01-800.webp",
};
// backward compat alias for tests that import REAL_BY_STYLE_FALLBACK
export const REAL_BY_STYLE_FALLBACK: Record<string, string> = REAL_BY_STYLE;
export function getRealSrc(style: string, src?: string): string {
  if (style in REAL_BY_STYLE) return REAL_BY_STYLE[style]!;
  if (src && src.startsWith("/magnum/")) return src;
  if (typeof console !== "undefined") console.warn("[gallery] unknown style", style);
  // DEV: fail fast to catch typos like "Y2k"/"ссср" in ARCHIVE_42
  if (typeof import.meta !== "undefined" && (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
    throw new Error(`[gallery] unknown style "${style}" — expected one of ${Object.keys(REAL_BY_STYLE).join(", ")}`);
  }
  return REAL_BY_STYLE["СССР"]!;
}
