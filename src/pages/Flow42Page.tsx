import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { FLOW_BEATS, FLOW_BEAT_LABELS, FLOW_TAKT_SEC, FLOW_TIPS, WAGER_OPTIONS, SCORING, calcWPM, type Wager } from "../lib/flow42";
import { GuestGate } from "../components/GuestGate";
import { CosmeticIdentity, cosmeticBannerStyle, type LeaderCosmetics } from "../components/CosmeticBadge";

type JudgeResult = {
  ok: boolean;
  scores: { rhyme: number; punch: number; flow: number; total: number; wpm: number; wpmBonus: number; final: number };
  botScore: number;
  verdict: "win" | "lose" | "draw";
  botLines: string[];
  reward?: { coins: number; elo: number; streak: number; balance: number };
  error?: string;
};

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function Flow42Page() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [beat, setBeat] = useState<(typeof FLOW_BEATS)[number]>(86);
  const [wager, setWager] = useState<Wager>(0);
  const [lines, setLines] = useState<string[]>(["", "", "", ""]);
  const [takt, setTakt] = useState(0); // 0..3, 4=done
  const [secLeft, setSecLeft] = useState(FLOW_TAKT_SEC);
  const [running, setRunning] = useState(false);
  const [judging, setJudging] = useState(false);
  const [result, setResult] = useState<JudgeResult | null>(null);
  const [msg, setMsg] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [tipIdx, setTipIdx] = useState(0);
  const [top5, setTop5] = useState<Array<{ username: string; score: number; avatar?: string | null } & LeaderCosmetics>>([]);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const shareCanvasRef = useRef<HTMLCanvasElement>(null);

  // tip rotate
  useEffect(() => {
    const id = window.setInterval(() => setTipIdx((i) => (i + 1) % FLOW_TIPS.length), 3200);
    return () => window.clearInterval(id);
  }, []);

  // top-5
  const loadTop = useCallback(async () => {
    try {
      const r = await fetch("/magnum/api/flow/leaderboard", { credentials: "include" });
      const j = (await r.json()) as { top?: typeof top5 };
      if (Array.isArray(j.top)) setTop5(j.top);
    } catch {}
  }, []);
  useEffect(() => { void loadTop(); }, [loadTop]);

  useEffect(() => {
    if (!wrapRef.current) return;
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      const hero = wrapRef.current!.querySelectorAll<HTMLElement>("[data-hero] > *");
      if (hero.length) {
        gsap.set(hero, { y: 24, opacity: 0 });
        gsap.to(hero, { y: 0, opacity: 1, stagger: 0.12, duration: 0.55, ease: "power2.out" });
      }
      const cards = wrapRef.current!.querySelectorAll<HTMLElement>("[data-card]");
      if (cards.length) {
        gsap.set(cards, { y: 24, opacity: 0 });
        gsap.to(cards, { y: 0, opacity: 1, stagger: 0.12, duration: 0.5, ease: "power2.out", delay: 0.15 });
      }
    }, wrapRef);
    return () => ctx.revert();
  }, []);

  // caret pulse css (1.1s) handled via style + keyframes below

  const startBattle = useCallback(() => {
    setResult(null);
    setMsg("");
    setLines(["", "", "", ""]);
    setTakt(0);
    setSecLeft(FLOW_TAKT_SEC);
    setRunning(true);
    startRef.current = Date.now();
    setTimeout(() => inputRef.current?.focus(), 60);
  }, []);

  // takt timer 8s each
  useEffect(() => {
    if (!running) return;
    if (takt >= 4) {
      setRunning(false);
      // auto judge
      void doJudge();
      return;
    }
    setSecLeft(FLOW_TAKT_SEC);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      // startRef resets each takt
      // compute left
      const t = Date.now();
      const left = Math.max(0, FLOW_TAKT_SEC - Math.floor((t - startRef.current) / 1000));
      setSecLeft(left);
      if (left <= 0) {
        window.clearInterval(timerRef.current!);
        // miss = keep empty (0)
        startRef.current = Date.now();
        setTakt((prev) => {
          const next = prev + 1;
          if (next < 4) {
            setTimeout(() => inputRef.current?.focus(), 30);
          }
          return next;
        });
      }
    }, 200);
    // reset start for this takt
    startRef.current = Date.now();
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [running, takt]);

  const totalChars = lines.join(" ").length;
  const elapsedSec = running ? 32 - takt * 8 - secLeft + takt * 8 : 32;
  // simpler wpm calc: based on chars typed so far / elapsed
  const wpmNow = calcWPM(totalChars, Math.max(1, running ? (Date.now() - (startRef.current - takt * 8000)) / 1000 : 32));

  async function doJudge() {
    setJudging(true);
    setMsg("");
    try {
      const wpm = calcWPM(lines.join(" ").length, 32);
      const r = await fetch("/magnum/api/flow/judge", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines, wager, wpm, beat }),
      });
      const j = (await r.json()) as JudgeResult & { balance?: number; error?: string };
      if (!r.ok) {
        setMsg(j.error || "Ошибка судьи");
        setJudging(false);
        return;
      }
      setResult(j);
      if (typeof j.balance === "number") setBalance(j.balance);
      if (j.reward) setBalance(j.reward.balance);
      void loadTop();
      if (!prefersReducedMotion() && wrapRef.current) {
        if (j.verdict === "win") {
          const el = wrapRef.current.querySelector<HTMLElement>("[data-result-card]");
          if (el) gsap.fromTo(el, { scale: 1 }, { scale: 1.6, duration: 0.22, ease: "back.out(1.7)", yoyo: true, repeat: 1 });
          spawnConfetti(wrapRef.current, 120);
        } else if (j.verdict === "lose") {
          const el = wrapRef.current.querySelector<HTMLElement>("[data-result-card]");
          if (el) gsap.fromTo(el, { x: 0 }, { x: 8, duration: 0.06, yoyo: true, repeat: 5, ease: "power2.inOut" });
        }
      }
    } catch {
      setMsg("Сеть — попробуй ещё");
    }
    setJudging(false);
  }

  function spawnConfetti(root: HTMLElement, count: number) {
    for (let i = 0; i < count; i++) {
      const d = document.createElement("div");
      d.style.position = "absolute";
      d.style.left = "50%";
      d.style.top = "38%";
      d.style.width = "7px";
      d.style.height = "7px";
      d.style.borderRadius = "2px";
      d.style.background = i % 3 === 0 ? "#ff2d55" : i % 3 === 1 ? "#00ff88" : "#ffcc00";
      d.style.pointerEvents = "none";
      d.style.zIndex = "99";
      root.appendChild(d);
      const ang = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 220;
      gsap.to(d, { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist + 70, rotation: Math.random() * 720, opacity: 0, duration: 0.8 + Math.random() * 0.5, ease: "power2.out", onComplete: () => d.remove() });
    }
  }

  async function doShare() {
    if (!result) return;
    // draw 1080x1080 <2s
    const canvas = shareCanvasRef.current;
    if (!canvas) { setMsg("Canvas нет"); return; }
    const t0 = performance.now();
    canvas.width = 1080; canvas.height = 1080;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
    grad.addColorStop(0, "#0a0a0a"); grad.addColorStop(0.5, "#1a0a2a"); grad.addColorStop(1, "#ff2d55");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 1080, 1080);
    ctx.fillStyle = "#fff"; ctx.font = "900 72px Inter, sans-serif"; ctx.fillText("БИТВА ФЛОУ 42", 48, 96);
    ctx.font = "600 30px Inter, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(`Бит ${beat} BPM • Wager ${wager} • ${result.verdict === "win" ? "ПОБЕДА" : result.verdict === "lose" ? "ПОРАЖЕНИЕ" : "НИЧЬЯ"}`, 48, 150);
    ctx.font = "500 26px monospace"; ctx.fillStyle = "#ffcc00";
    const s = result.scores;
    ctx.fillText(`рифма ${s.rhyme}/42  панч ${s.punch}/42  флоу ${s.flow}/42`, 48, 200);
    ctx.fillText(`total ${s.total} x${s.wpmBonus} = ${s.final}  vs бот ${result.botScore}  WPM ${s.wpm}`, 48, 240);
    // lines
    ctx.font = "400 22px Inter, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.85)";
    lines.forEach((l, i) => {
      const txt = l ? `${i + 1}. ${l.slice(0, 80)}` : `${i + 1}. — пропуск —`;
      ctx.fillText(txt, 48, 310 + i * 36);
    });
    // verdict banner
    ctx.fillStyle = result.verdict === "win" ? "rgba(0,255,136,0.9)" : result.verdict === "lose" ? "rgba(255,45,85,0.9)" : "rgba(255,204,0,0.9)";
    ctx.fillRect(48, 500, 984, 120);
    ctx.fillStyle = "#0a0a0a"; ctx.font = "800 44px Inter, sans-serif";
    ctx.fillText(result.verdict === "win" ? "🏆 ПОБЕДА БРАТУХИ" : result.verdict === "lose" ? "💀 БРАТ-БОТ СИЛЬНЕЕ" : "🤝 НИЧЬЯ", 72, 575);
    // QR placeholder
    const qrUrl = `${window.location.origin}/magnum/flow`;
    ctx.fillStyle = "#fff"; ctx.fillRect(390, 680, 300, 300);
    ctx.fillStyle = "#0a0a0a"; ctx.font = "700 22px monospace"; ctx.fillText("QR", 520, 830);
    ctx.font = "400 16px monospace"; ctx.fillText(qrUrl.replace("https://", ""), 400, 870);
    ctx.fillStyle = "rgba(255,255,255,0.78)"; ctx.font = "400 20px Inter, sans-serif"; ctx.fillText("MAGNUM • 5opka — БИТВА ФЛОУ 42 • /magnum/flow", 48, 1020);
    const dt = performance.now() - t0;
    // share
    try {
      const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png")!);
      const file = new File([blob], `flow-42-${Date.now()}.png`, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: `БИТВА ФЛОУ 42 — ${s.final} vs ${result.botScore}`, text: `Мой флоу ${s.final} vs БРАТ-БОТ ${result.botScore} — ${qrUrl}`, files: [file] });
      } else if ((navigator as unknown as { share?: unknown }).share) {
        await (navigator as unknown as { share: (d: unknown) => Promise<void> }).share({ title: "БИТВА ФЛОУ 42", text: `Флоу ${s.final} vs ${result.botScore} — ${qrUrl}`, url: qrUrl });
      } else {
        const a = document.createElement("a"); a.href = canvas.toDataURL("image/png"); a.download = `flow-42-${Date.now()}.png`; a.click();
      }
    } catch { /* cancel */ }
    // +42/day guard
    try {
      const r = await fetch("/magnum/api/flow/share", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dayId: new Date().toISOString().slice(0, 10) }) });
      const j = (await r.json()) as { ok?: boolean; coins?: number; balance?: number; error?: string };
      if (r.ok && j.ok) {
        setMsg(`+${j.coins} монет за шаринг (${dt.toFixed(0)}мс) • баланс ${j.balance}`);
        if (typeof j.balance === "number") setBalance(j.balance);
      } else if (r.status === 409) setMsg("Уже делился сегодня — +42 1×/день");
      else if (j.error) setMsg(j.error);
    } catch { setMsg(`Шаринг OK ${dt.toFixed(0)}мс, но +42 не начислен — сеть`); }
  }

  const progressPct = Math.round(((takt + (running ? (FLOW_TAKT_SEC - secLeft) / FLOW_TAKT_SEC : 0)) / 4) * 100);

  return (
    <div ref={wrapRef} style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px", position: "relative" }}>
      <GuestGate action="попадать в топ Flow 42" />
      <div data-hero>
        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em" }}>БИТВА ФЛОУ 42 <span style={{ color: "#ff2d55" }}>— vs БРАТ-БОТ</span></h1>
        <p style={{ opacity: 0.7, marginTop: 6, fontSize: 13 }}>4 такта ×8с = 32с • печатай панчи • AI-судья mimo-v2.5 → рифма/панч/флоу 0-42 • WPM&gt;80 ×1.2 • wager 0/42/142/420</p>
      </div>

      {/* controls */}
      <div data-card style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14, alignItems: "center" }}>
        <span style={{ fontSize: 12, opacity: 0.7 }}>Бит:</span>
        {FLOW_BEATS.map((b) => (
          <button key={b} onClick={() => !running && setBeat(b)} style={{ padding: "7px 12px", borderRadius: 10, border: beat === b ? "1px solid #ff2d55" : "1px solid rgba(255,255,255,0.12)", background: beat === b ? "rgba(255,45,85,0.18)" : "rgba(255,255,255,0.04)", color: beat === b ? "#ff2d55" : "#fff", fontWeight: 800, cursor: running ? "not-allowed" : "pointer", fontSize: 12 }}>
            {b} BPM
          </button>
        ))}
        <span style={{ fontSize: 11, opacity: 0.55 }}>{FLOW_BEAT_LABELS[beat]}</span>
      </div>

      <div data-card style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
        <span style={{ fontSize: 12, opacity: 0.7 }}>Wager:</span>
        {WAGER_OPTIONS.map((w) => (
          <button key={w} onClick={() => !running && setWager(w)} style={{ padding: "7px 12px", borderRadius: 10, border: wager === w ? "1px solid #ffcc00" : "1px solid rgba(255,255,255,0.12)", background: wager === w ? "rgba(255,204,0,0.18)" : "rgba(255,255,255,0.04)", color: wager === w ? "#ffcc00" : "#fff", fontWeight: 800, cursor: running ? "not-allowed" : "pointer", fontSize: 12 }}>
            {w === 0 ? "0 тренер" : `${w}`}
          </button>
        ))}
        {balance !== null && <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>баланс {balance}</span>}
      </div>

      {/* tip */}
      <div data-card style={{ marginTop: 12, padding: "8px 12px", borderRadius: 10, background: "rgba(255,204,0,0.08)", border: "1px solid rgba(255,204,0,0.18)", fontSize: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <span>💡</span><span style={{ opacity: 0.9 }}>{FLOW_TIPS[tipIdx]}</span><span style={{ marginLeft: "auto", opacity: 0.4, fontSize: 11 }}>{tipIdx + 1}/{FLOW_TIPS.length}</span>
      </div>

      {/* arena */}
      {!result && (
        <div data-card style={{ marginTop: 16, padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <strong style={{ fontSize: 13 }}>АРЕНА 1vs1</strong>
            <span style={{ fontSize: 12, opacity: 0.7 }}>такт {Math.min(4, takt + 1)}/4 • {secLeft}с</span>
            <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>WPM ~{wpmNow} {wpmNow > 80 ? "×1.2" : ""}</span>
          </div>
          <div style={{ marginTop: 10, height: 8, borderRadius: 99, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <div style={{ width: `${progressPct}%`, height: "100%", background: "linear-gradient(90deg,#ff2d55,#ffcc00)", transition: "width 0.3s" }} />
          </div>

          {/* 4 line slots */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 10px", borderRadius: 10, background: i === takt && running ? "rgba(255,45,85,0.12)" : i < takt ? "rgba(0,255,136,0.08)" : "rgba(255,255,255,0.03)", border: i === takt && running ? "1px solid rgba(255,45,85,0.3)" : "1px solid rgba(255,255,255,0.06)", opacity: i < takt && !lines[i] ? 0.6 : 1 }}>
                <span style={{ fontWeight: 800, fontSize: 12, width: 18 }}>{i + 1}</span>
                {i === takt && running ? (
                  <input
                    ref={inputRef}
                    value={lines[i] ?? ""}
                    onChange={(e) => {
                      const v = e.target.value.slice(0, 80);
                      setLines((prev) => { const c = [...prev]; c[i] = v; return c; });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        // commit early and go next takt
                        if (timerRef.current) window.clearInterval(timerRef.current);
                        startRef.current = Date.now();
                        setTakt((prev) => Math.min(4, prev + 1));
                      }
                    }}
                    placeholder={i === 0 ? "панч 1 — 8с (Enter → дальше)" : `строка ${i + 1} — 8с`}
                    autoComplete="off"
                    style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 14 }}
                  />
                ) : (
                  <span style={{ flex: 1, fontSize: 13, opacity: lines[i] ? 1 : 0.45, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lines[i] || (i < takt ? "— пропуск (0)" : "— ждёт —")}</span>
                )}
                {i === takt && running && <span className="flow-caret" style={{ width: 2, height: 18, background: "#ff2d55", display: "inline-block", animation: "flowCaret 1.1s ease-in-out infinite" }} />}
                <span style={{ fontSize: 11, opacity: 0.5 }}>{(lines[i] ?? "").length}/80</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {!running ? (
              <button onClick={startBattle} style={{ padding: "10px 18px", borderRadius: 10, background: "#ff2d55", color: "#fff", fontWeight: 900, border: "none", cursor: "pointer" }}>▶ Старт 32с</button>
            ) : (
              <button onClick={() => { if (timerRef.current) window.clearInterval(timerRef.current); startRef.current = Date.now(); setTakt((p) => Math.min(4, p + 1)); }} style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer" }}>Пропустить такт →</button>
            )}
            <button onClick={() => void doJudge()} disabled={judging || lines.every((l) => !l.trim())} style={{ padding: "10px 14px", borderRadius: 10, background: judging ? "rgba(255,255,255,0.06)" : "rgba(255,204,0,0.14)", color: judging ? "#999" : "#ffcc00", border: "1px solid rgba(255,204,0,0.3)", cursor: judging ? "not-allowed" : "pointer", fontWeight: 800 }}>{judging ? "Судья…" : "Судить сейчас"}</button>
            <Link to="/magnum/board" style={{ marginLeft: "auto", fontSize: 12, opacity: 0.6, alignSelf: "center" }}>→ Доска 42</Link>
          </div>
          {msg && <div style={{ marginTop: 8, fontSize: 12, color: "#ffcc00" }}>{msg}</div>}
        </div>
      )}

      {/* result */}
      {result && (
        <div data-result-card style={{ marginTop: 16, padding: 14, borderRadius: 14, background: result.verdict === "win" ? "linear-gradient(135deg, rgba(0,255,136,0.14), rgba(255,204,0,0.12))" : result.verdict === "lose" ? "rgba(255,45,85,0.08)" : "rgba(255,204,0,0.08)", border: `1px solid ${result.verdict === "win" ? "rgba(0,255,136,0.25)" : result.verdict === "lose" ? "rgba(255,45,85,0.25)" : "rgba(255,204,0,0.25)"}` }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <strong style={{ fontSize: 16 }}>{result.verdict === "win" ? "🏆 ПОБЕДА" : result.verdict === "lose" ? "💀 ПОРАЖЕНИЕ" : "🤝 НИЧЬЯ"}</strong>
            <span style={{ fontSize: 12, opacity: 0.7 }}>{result.scores.final} vs бот {result.botScore} • WPM {result.scores.wpm} {result.scores.wpmBonus > 1 ? "×1.2" : ""}</span>
            {result.reward && <span style={{ fontSize: 12, color: "#00ff88" }}>+{result.reward.coins} монет • {result.reward.elo > 0 ? `+${result.reward.elo}` : result.reward.elo} ELO • streak {result.reward.streak}</span>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 10 }}>
            {(["rhyme", "punch", "flow"] as const).map((k) => (
              <div key={k} style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)", textAlign: "center" }}>
                <div style={{ fontSize: 11, opacity: 0.6 }}>{k === "rhyme" ? "рифма" : k === "punch" ? "панч" : "флоу"}</div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{(result.scores as unknown as Record<string, number>)[k]}/42</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, opacity: 0.6 }}>total {result.scores.total} ×{result.scores.wpmBonus} = {result.scores.final} vs бот база {result.botScore} • wager {wager} {result.verdict === "win" && wager > 0 ? `→ +${Math.round(wager * 1.5)}` : ""}</div>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8, display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ opacity: 0.6 }}>Твои 4 строки:</span>
            {lines.map((l, i) => <span key={i} style={{ opacity: l ? 1 : 0.4 }}>{i + 1}. {l || "— пропуск —"}</span>)}
            <span style={{ opacity: 0.55, marginTop: 6 }}>БРАТ-БОТ:</span>
            {result.botLines.map((l, i) => <span key={i} style={{ opacity: 0.7, fontStyle: "italic" }}>{i + 1}. {l}</span>)}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button onClick={() => { setResult(null); startBattle(); }} style={{ padding: "9px 14px", borderRadius: 10, background: "#ff2d55", color: "#fff", fontWeight: 800, border: "none", cursor: "pointer" }}>Ещё баттл</button>
            <button onClick={doShare} style={{ padding: "9px 14px", borderRadius: 10, background: "rgba(255,204,0,0.14)", color: "#ffcc00", border: "1px solid rgba(255,204,0,0.3)", fontWeight: 800, cursor: "pointer" }}>Шарить 1080×1080 +42</button>
            <button onClick={() => setResult(null)} style={{ padding: "9px 14px", borderRadius: 10, background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer" }}>К арене</button>
          </div>
          {msg && <div style={{ marginTop: 8, fontSize: 12, color: "#ffcc00" }}>{msg}</div>}
        </div>
      )}

      {/* top5 */}
      <div data-card style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontWeight: 800, fontSize: 12, opacity: 0.8 }}>ТОП-5 недели — ФЛОУ 42</div>
        {top5.length === 0 ? <div style={{ opacity: 0.5, fontSize: 12, marginTop: 6 }}>Пока пусто — стань первым!</div> : top5.slice(0, 5).map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.06)" : "none", fontSize: 13, ...cosmeticBannerStyle(r.banner) }}>
            <span style={{ width: 18, fontWeight: 800 }}>{i + 1}</span><span style={{ flex: 1, minWidth: 0 }}><CosmeticIdentity username={r.username} avatar={r.avatar} frame={r.frame} title={r.title} size={22} /></span><span style={{ fontWeight: 800 }}>{r.score}</span>
          </div>
        ))}
      </div>

      <canvas ref={shareCanvasRef} width={1080} height={1080} style={{ display: "none" }} />
      <style>{`@keyframes flowCaret{0%,100%{opacity:1;transform:scaleY(1)}50%{opacity:0.35;transform:scaleY(0.85)}}`}</style>
    </div>
  );
}
export default Flow42Page;
