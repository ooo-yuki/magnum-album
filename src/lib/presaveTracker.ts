import { useEffect } from "react";

export type ABVariant = "a" | "b";

export function getABVariant(): ABVariant {
  if (typeof window === "undefined") return "a";
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("ab");
    if (q === "a" || q === "b") {
      try { localStorage.setItem("ab_cta", q); } catch {}
      return q;
    }
    const stored = localStorage.getItem("ab_cta");
    if (stored === "a" || stored === "b") return stored;
    const picked: ABVariant = Math.random() < 0.5 ? "a" : "b";
    try { localStorage.setItem("ab_cta", picked); } catch {}
    return picked;
  } catch {
    return "a";
  }
}

export function trackPresaveClick(variant?: string, url?: string): void {
  try { localStorage.setItem("presave_done", "1"); } catch {}
  try { sessionStorage.setItem("magnum:post-presave-bridge-at", String(Date.now())); } catch {}
  try { window.dispatchEvent(new CustomEvent("magnum:presave")); } catch {}
  const v = variant ?? getABVariant();
  fetch("/magnum/api/presave/click", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url ?? "https://music.thefence.me/psmagnum", ts: Date.now(), variant: v }) }).catch(() => {});
}

export function usePresaveTracker() {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a[href*="music.thefence.me/psmagnum"]');
      if (!a) return;
      // if CTA already carries data-variant=return-popup, preserve it
      const elVariant = (a as HTMLElement).getAttribute("data-variant");
      const variant = elVariant === "return-popup" ? "return-popup" : getABVariant();
      try { localStorage.setItem("presave_done", "1"); } catch {}
      try { sessionStorage.setItem("magnum:post-presave-bridge-at", String(Date.now())); } catch {}
      try { window.dispatchEvent(new CustomEvent("magnum:presave")); } catch {}
      fetch("/magnum/api/presave/click", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: (a as HTMLAnchorElement).href, ts: Date.now(), variant }) }).catch(() => {});
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);
}
