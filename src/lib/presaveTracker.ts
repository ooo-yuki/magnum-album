import { useEffect } from "react";

export function usePresaveTracker() {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a[href*="music.thefence.me/psmagnum"]');
      if (!a) return;
      fetch("/magnum/api/presave/click", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: (a as HTMLAnchorElement).href, ts: Date.now() }) }).catch(() => {});
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);
}
