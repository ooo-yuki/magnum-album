import { useEffect, useState } from "react";

type ReferralInfo = {
  code: string;
  invitedCount: number;
  prestige: number;
  prestigeBonus: number;
  invited: { invitedId: number; rewardClaimed: boolean; created_at: string }[];
};

export function ReferralCard() {
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [msg, setMsg] = useState("");
  const [authed, setAuthed] = useState<boolean | null>(null);

  async function load() {
    const r = await fetch("/magnum/api/referral/code", { credentials: "include" });
    if (r.status === 401) { setAuthed(false); return; }
    if (r.ok) { setInfo(await r.json()); setAuthed(true); }
  }
  useEffect(() => { load(); }, []);

  async function redeem() {
    const c = codeInput.trim().toUpperCase();
    if (!c) return setMsg("введи код 42-XXXX");
    if (!/^42-[A-Z0-9]{4}$/.test(c)) return setMsg("формат 42-XXXX");
    const r = await fetch("/magnum/api/referral/redeem", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: c }) });
    const j = await r.json();
    if (!r.ok) return setMsg(j.error || "ошибка");
    setMsg(`+42 обоим! братуха ${c} зачтён`);
    load();
  }

  if (authed === false) return <div style={{ padding: 12, border: "1px solid #333", borderRadius: 12 }}>Войди чтобы получить БРАТУХА-КОД 42-XXXX</div>;
  if (!info) return <div>загрузка…</div>;
  return (
    <div style={{ border: "1px solid #ff2d55", borderRadius: 16, padding: 16, background: "#111" }}>
      <div style={{ fontWeight: 800 }}>БРАТУХА-КОД: <span style={{ color: "#ff2d55" }}>{info.code}</span> <button onClick={() => { navigator.clipboard.writeText(info.code); setMsg("скопировано"); }} style={{ marginLeft: 8 }}>копи</button></div>
      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Пригласи братуху → обоим +42 монеты. Валидация: реферал делает пресейв или 1 игру → тебе +1 Social Prestige.</div>
      <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
        <span>Social Prestige: <b>{info.prestige}</b> (+{info.prestigeBonus}% редкости, кап 10%)</span>
      </div>
      <div style={{ marginTop: 8, fontSize: 12 }}>Приглашено: {info.invitedCount} | валидных: {info.prestige}</div>
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <input value={codeInput} onChange={e => setCodeInput(e.target.value)} placeholder="42-XXXX" maxLength={7} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #333", background: "#000", color: "#fff" }} />
        <button onClick={redeem} style={{ padding: "8px 14px", borderRadius: 8, background: "#ff2d55", color: "#fff", border: 0, fontWeight: 700 }}>Активировать</button>
      </div>
      {msg && <div style={{ marginTop: 8, fontSize: 13, color: "#ffd700" }}>{msg}</div>}
      <div style={{ marginTop: 8, fontSize: 11, opacity: 0.6 }}>Питомец МАГНУМ-42 получает корм за каждого приглашённого братуху.</div>
    </div>
  );
}
