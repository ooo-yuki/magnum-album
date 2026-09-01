import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { subscribeMe, type MeUser } from "../lib/authMe";

type ChatMsg = { id: number; body: string; replyTo: number | null; created_at: string; username: string; avatar: string | null };

export function ChatPanel() {
  const [me, setMe] = useState<MeUser>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [followBusy, setFollowBusy] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeMe(setMe as any), []);

  const showToast = useCallback((m: string) => { setToast(m); window.setTimeout(() => setToast(null), 2400); }, []);

  const fetchChat = useCallback(async () => {
    try {
      const r = await fetch("/magnum/api/chat?limit=30", { credentials: "include" });
      if (!r.ok) return;
      const j = await r.json() as { messages?: ChatMsg[] };
      if (Array.isArray(j.messages)) setMessages(j.messages);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchChat(); }, [fetchChat]);
  // poll 5s
  useEffect(() => {
    const id = window.setInterval(() => { void fetchChat(); }, 5000);
    return () => window.clearInterval(id);
  }, [fetchChat]);

  // auto-scroll to bottom on new messages
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  async function onSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const body = text.trim();
    if (!body || body.length < 1 || body.length > 500) { showToast("сообщение 1..500"); return; }
    if (body.includes("<") || body.includes(">")) { showToast("без <>"); return; }
    if (!me) { window.dispatchEvent(new CustomEvent("magnum:need-auth")); showToast("Войди, братуха — чат только для залогиненных"); return; }
    setSending(true);
    try {
      const r = await fetch("/magnum/api/chat", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
      const j = await r.json().catch(() => ({})) as { error?: string };
      if (!r.ok) { showToast(j.error || `ошибка ${r.status}`); if (r.status === 401) window.dispatchEvent(new CustomEvent("magnum:need-auth")); return; }
      setText("");
      await fetchChat();
    } catch (err) { showToast(String(err).slice(0, 80)); }
    finally { setSending(false); }
  }

  async function onNickClick(target: string) {
    if (!target || target.length < 2) return;
    if (!me) { window.dispatchEvent(new CustomEvent("magnum:need-auth")); showToast("Войди, братуха — подписка только для залогиненных"); return; }
    if (target.toLowerCase() === me.username.toLowerCase()) { showToast("это ты ✓"); return; }
    if (followBusy) return;
    setFollowBusy(target);
    try {
      const r = await fetch("/magnum/api/follow", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: target }) });
      const j = await r.json().catch(() => ({})) as { ok?: boolean; following?: boolean; error?: string };
      if (!r.ok) {
        if (r.status === 401) { window.dispatchEvent(new CustomEvent("magnum:need-auth")); showToast("Войди, братуха"); }
        else showToast(j.error || `ошибка ${r.status}`);
        return;
      }
      showToast(j.following ? `Подписался на ${target} ✓` : `Отписался от ${target}`);
      window.dispatchEvent(new CustomEvent("magnum:follow-change", { detail: { target, following: j.following } }));
    } catch (err) { showToast(String(err).slice(0, 80)); }
    finally { setFollowBusy(null); }
  }

  return (
    <div style={{ borderRadius: 16, background: "rgba(18,18,22,.86)", border: "1px solid rgba(255,255,255,.08)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: 520 }}>
      <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,.06)", background: "rgba(255,255,255,.02)" }}>
        <strong style={{ color: "#fff", fontSize: 13, letterSpacing: ".02em" }}>Чат 42 — общий</strong>
        <span data-testid="chat-follow-badge" style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.06em", color: "#ffcc00", background: "rgba(255,204,0,0.12)", border: "1px solid rgba(255,204,0,0.22)", padding: "4px 8px", borderRadius: 999, animation: followBusy ? "none" : "chatBadgePulse 1.6s ease-in-out infinite" }}>Фоллови братух — взаимка</span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,.45)" }}>{messages.length}/30 · авто 5с</span>
      </div>
      <style>{`@keyframes chatBadgePulse{0%,100%{box-shadow:0 0 10px rgba(255,204,0,0.12)}50%{box-shadow:0 0 18px rgba(255,204,0,0.22)}} @keyframes followPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.02)}}`}</style>

      <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "10px 10px", display: "grid", gap: 8, minHeight: 220, maxHeight: 360 }}>
        {loading && <div style={{ color: "rgba(255,255,255,.45)", fontSize: 12, textAlign: "center", padding: 16 }}>Загрузка чата…</div>}
        {!loading && messages.length === 0 && <div style={{ color: "rgba(255,255,255,.35)", fontSize: 12, textAlign: "center", padding: 16 }}>Пока пусто — напиши первым, братуха 42</div>}
        {!loading && messages.map(m => (
          <div key={m.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "7px 8px", borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.05)" }}>
            <span style={{ width: 26, height: 26, borderRadius: 999, display: "grid", placeItems: "center", fontSize: 12, background: "rgba(255,204,0,.14)", border: "1px solid rgba(255,204,0,.18)", flexShrink: 0 }}>{m.avatar ? "👤" : "🧑‍🎤"}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  data-testid={`chat-nick-${m.username}`}
                  onClick={() => onNickClick(m.username)}
                  title={me ? `Подписаться на @${m.username}` : "Войди, братуха"}
                  style={{
                    fontWeight: 800, fontSize: 12, color: "#ffcc00", background: "transparent", border: "1px solid transparent",
                    padding: "1px 5px", borderRadius: 999, cursor: "pointer", maxWidth: "40vw", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,204,0,.22)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,204,0,.08)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  @{m.username}
                </button>
                <Link to={`/magnum/u/${encodeURIComponent(m.username)}`} style={{ fontSize: 11, color: "rgba(125,216,255,.7)", textDecoration: "none" }}>профиль</Link>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,.32)" }}>{new Date(m.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
                {followBusy === m.username && <span style={{ fontSize: 11, color: "#ffcc00" }}>…</span>}
              </div>
              <div style={{ marginTop: 3, fontSize: 12, color: "rgba(255,255,255,.86)", wordBreak: "break-word", lineHeight: 1.35 }}>{m.body}</div>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={onSend} style={{ display: "flex", gap: 8, padding: "10px 10px", borderTop: "1px solid rgba(255,255,255,.06)", background: "rgba(0,0,0,.14)" }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          maxLength={500}
          placeholder={me ? "Напиши 42 — до 500, без <>" : "Войди, братуха — чат закрыт"}
          disabled={sending}
          style={{
            flex: 1, minWidth: 0, padding: "9px 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,.12)",
            background: me ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.03)", color: "#fff", fontSize: 13, outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          style={{
            padding: "9px 14px", borderRadius: 999, fontWeight: 900, fontSize: 12, cursor: sending ? "wait" : "pointer",
            color: "#0a0a0a", background: "#ffcc00", border: "1px solid #ffcc00", opacity: sending || !text.trim() ? 0.6 : 1,
          }}
        >
          {sending ? "…" : "Отправить"}
        </button>
      </form>

      {toast && <div role="status" style={{ position: "fixed", left: "50%", bottom: 18, transform: "translateX(-50%)", background: "rgba(20,20,20,.96)", color: "#fff", border: "1px solid rgba(255,204,0,.22)", padding: "10px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, zIndex: 60 }}>{toast}</div>}
    </div>
  );
}
export default ChatPanel;
