import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import gsap from "gsap";
import { fetchMe, subscribeMe, type MeUser } from "../lib/authMe";

type PubProfile = {
  user: { id: number; username: string; created_at: string };
  coins: number;
  balance: number;
  mining: { balance: number; upgrades: unknown } | null;
  avatar: string | null;
  cosmetics: Array<{ cosmeticId: string; slot: string }>;
  verified: boolean;
  counts: { achievements: number; transactions: number };
};

export function ProfilePage() {
  const { username: raw } = useParams<{ username: string }>();
  const username = decodeURIComponent(raw ?? "").trim().slice(0, 32);
  const [me, setMe] = useState<MeUser>(null);
  const [profile, setProfile] = useState<PubProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => subscribeMe(setMe as any), []);

  // fetch profile
  useEffect(() => {
    if (!username || username.length < 2) { setErr("username 2..32"); setLoading(false); return; }
    let cancelled = false;
    setLoading(true); setErr(null); setProfile(null);
    (async () => {
      try {
        const r = await fetch(`/magnum/api/profile/${encodeURIComponent(username)}`, { credentials: "include" });
        if (!r.ok) {
          const j = await r.json().catch(() => ({})) as { error?: string };
          if (!cancelled) { setErr(j.error || `not found ${r.status}`); setLoading(false); }
          return;
        }
        const j = await r.json() as PubProfile;
        if (!cancelled) { setProfile(j); setLoading(false); }
      } catch (e) { if (!cancelled) { setErr(String(e).slice(0, 120)); setLoading(false); } }
    })();
    return () => { cancelled = true; };
  }, [username]);

  // check following state via /magnum/api/follows
  useEffect(() => {
    if (!me || !profile) { setFollowing(null); return; }
    if (me.username.toLowerCase() === profile.user.username.toLowerCase()) { setFollowing(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/magnum/api/follows?box=following&limit=50`, { credentials: "include" });
        if (!r.ok) return;
        const j = await r.json() as { list?: Array<{ username: string }> };
        const list = j.list ?? [];
        const isFollowing = list.some(u => u.username.toLowerCase() === profile.user.username.toLowerCase());
        if (!cancelled) setFollowing(isFollowing);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [me, profile]);

  // GSAP entrance y24 stagger 0.08
  useEffect(() => {
    if (!wrapRef.current || loading || err) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const ctx = gsap.context(() => {
      gsap.set(wrapRef.current!.children, { y: 16, opacity: 0 });
      gsap.to(wrapRef.current!.children, { y: 0, opacity: 1, stagger: 0.06, duration: 0.42, ease: "power2.out" });
    }, wrapRef);
    return () => ctx.revert();
  }, [loading, err, profile]);

  // button pulse on following change + pulse if not following (null/false)
  useEffect(() => {
    if (!btnRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (following === false || following === null) {
      gsap.to(btnRef.current, { scale: 1.04, duration: 0.52, ease: "sine.inOut", repeat: -1, yoyo: true, boxShadow: "0 0 22px rgba(255,204,0,0.28)" });
    } else if (following === true) {
      gsap.killTweensOf(btnRef.current);
      gsap.fromTo(btnRef.current, { scale: 0.96 }, { scale: 1, duration: 0.32, ease: "back.out(1.4)" });
    } else {
      gsap.fromTo(btnRef.current, { scale: 0.96 }, { scale: 1, duration: 0.32, ease: "back.out(1.4)" });
    }
  }, [following]);

  const showToast = (m: string) => { setToast(m); window.setTimeout(() => setToast(null), 2400); };

  async function onFollow() {
    if (busy) return;
    const target = profile?.user.username ?? username;
    if (!me) {
      // anon -> попап логина, не 401
      window.dispatchEvent(new CustomEvent("magnum:need-auth"));
      showToast("Войди, братуха — подписка только для залогиненных");
      return;
    }
    if (!target || target.toLowerCase() === me.username.toLowerCase()) { showToast("нельзя подписаться на себя"); return; }
    setBusy(true);
    try {
      const r = await fetch("/magnum/api/follow", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: target }),
      });
      const j = await r.json().catch(() => ({})) as { ok?: boolean; following?: boolean; error?: string };
      if (!r.ok) { showToast(j.error || `ошибка ${r.status}`); return; }
      const nowFollowing = Boolean(j.following);
      setFollowing(nowFollowing);
      showToast(nowFollowing ? `Подписался на ${target} \u2713 — братуха увидит твой фоллоу` : `Отписался от ${target}`);
      // refresh health hint
      window.dispatchEvent(new CustomEvent("magnum:follow-change", { detail: { target, following: nowFollowing } }));
    } catch (e) { showToast(String(e).slice(0, 80)); }
    finally { setBusy(false); }
  }

  if (loading) return <div style={{ padding: "2rem", textAlign: "center", color: "rgba(255,255,255,.6)" }}>Загрузка профиля…</div>;
  if (err) return <div style={{ padding: "2rem", textAlign: "center" }}><p style={{ color: "#ff2d55", fontWeight: 800 }}>{err}</p><Link to="/magnum" style={{ color: "#7dd8ff" }}>→ на главную</Link></div>;
  if (!profile) return <div style={{ padding: "2rem", textAlign: "center", color: "#ff2d55" }}>Профиль не найден</div>;

  const isSelf = me ? me.username.toLowerCase() === profile.user.username.toLowerCase() : false;
  const avatarEmoji = profile.avatar ? (profile.avatar === "mops" ? "🐗" : profile.avatar === "rhino" ? "🦏" : profile.avatar === "shark" ? "🦈" : "👤") : "👤";

  return (
    <div ref={wrapRef} style={{ maxWidth: 860, margin: "0 auto", padding: "18px 14px 40px" }}>
      {/* hero — кнопка Подписаться видима без скролла (сразу под header, top 72px) */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap", padding: "18px 16px", borderRadius: 18, background: "linear-gradient(135deg, rgba(255,45,85,.14), rgba(122,30,203,.12))", border: "1px solid rgba(255,255,255,.08)", backdropFilter: "blur(8px)" }}>
        <div style={{ width: 72, height: 72, borderRadius: 18, display: "grid", placeItems: "center", fontSize: 32, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)" }}>{avatarEmoji}</div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>@{profile.user.username}</h1>
            {profile.verified && <span style={{ fontSize: 12, fontWeight: 900, color: "#0a0a0a", background: "#ffcc00", padding: "2px 7px", borderRadius: 999 }}>✓ VERIFIED</span>}
            {isSelf && <span style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.12)", padding: "2px 7px", borderRadius: 999 }}>это ты</span>}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,.58)", display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span>🪙 {profile.coins}</span>
            <span>🏆 ачивок {profile.counts.achievements}</span>
            <span>🧾 транзакций {profile.counts.transactions}</span>
            <span>📅 {new Date(profile.user.created_at).toLocaleDateString("ru-RU")}</span>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {!isSelf && (
              <button
                ref={btnRef}
                data-testid="followButton"
                id="followButton"
                onClick={onFollow}
                disabled={busy}
                style={{
                  padding: "9px 16px", borderRadius: 999, fontWeight: 900, fontSize: 13, cursor: busy ? "wait" : "pointer",
                  color: following ? "#fff" : "#0a0a0a",
                  background: following ? "rgba(255,255,255,.10)" : "#ffcc00",
                  border: following ? "1px solid rgba(255,255,255,.18)" : "1px solid #ffcc00",
                  opacity: busy ? 0.7 : 1, transition: "transform .14s",
                  boxShadow: !following ? "0 0 18px rgba(255,204,0,0.22)" : "none",
                  animation: !following ? "followPulse 1.5s ease-in-out infinite" : "none",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}
              >
                {busy ? "…" : following ? "Отписаться" : "Подписаться"}
              </button>
            )}
            {!following && !isSelf && <span style={{ fontSize: 11, color: "rgba(255,204,0,0.82)", fontWeight: 800, alignSelf: "center" }}>Подпишись — братуха увидит твой фоллоу</span>}
            {isSelf && <span style={{ fontSize: 12, color: "rgba(255,255,255,.45)" }}>Твой профиль — подписка недоступна</span>}
            <Link to="/magnum/presave-rating" style={{ padding: "9px 12px", borderRadius: 999, fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,.8)", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)", textDecoration: "none" }}>Рейтинг</Link>
          </div>
        </div>
      </div>

      {/* cosmetics strip */}
      {profile.cosmetics.length > 0 && (
        <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 14, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,.7)", marginBottom: 6 }}>Экипировка</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{profile.cosmetics.map(c => <span key={c.cosmeticId} style={{ fontSize: 11, fontWeight: 700, background: "rgba(255,204,0,.12)", border: "1px solid rgba(255,204,0,.18)", padding: "4px 8px", borderRadius: 999, color: "#ffcc00" }}>{c.slot}: {c.cosmeticId}</span>)}</div>
        </div>
      )}

      {/* mining strip */}
      {profile.mining && (
        <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 14, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)", color: "rgba(255,255,255,.7)", fontSize: 12 }}>
          Майнинг баланс: <b style={{ color: "#fff" }}>{profile.mining.balance}</b>
        </div>
      )}

      <div style={{ marginTop: 18, display: "flex", gap: 8 }}>
        <Link to="/magnum" style={{ color: "#7dd8ff", fontSize: 13, textDecoration: "none" }}>← На главную</Link>
        <span style={{ color: "rgba(255,255,255,.22)" }}>·</span>
        <a href={`/magnum/api/profile/${encodeURIComponent(profile.user.username)}`} target="_blank" rel="noreferrer" style={{ color: "rgba(255,255,255,.45)", fontSize: 12 }}>API /profile</a>
      </div>

      {toast && <div role="status" style={{ position: "fixed", left: "50%", bottom: 18, transform: "translateX(-50%)", background: "rgba(20,20,20,.96)", color: "#fff", border: "1px solid rgba(255,204,0,.22)", padding: "10px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, zIndex: 60 }}>{toast}</div>}
    </div>
  );
}
export default ProfilePage;
