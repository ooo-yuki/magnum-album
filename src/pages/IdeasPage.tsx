import { useEffect, useState } from "react";
import styles from "./IdeasPage.module.css";

type Idea = { id: number; title: string; description: string; votes: number; status: string; created_at: string };

export function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    try {
      const r = await fetch("/magnum/api/ideas");
      if (!r.ok) throw new Error(String(r.status));
      const data = (await r.json()) as { ideas: Idea[] };
      setIdeas(data.ideas || []);
    } catch {
      // fallback demo if API not yet deployed
      setIdeas([
        { id: 1, title: "Мультиплеер арена", description: "Hot-seat дуэль + WS", votes: 42, status: "approved", created_at: new Date().toISOString() },
        { id: 2, title: "Эко-челлендж", description: "8 вопросов Кемерово", votes: 27, status: "approved", created_at: new Date().toISOString() },
        { id: 3, title: "Магазин скинов", description: "12 скинов 42/142/420/1420", votes: 15, status: "pending", created_at: new Date().toISOString() },
      ]);
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const vote = async (id: number) => {
    try {
      const r = await fetch(`/magnum/api/ideas/${id}/vote`, { method: "POST" });
      if (!r.ok) throw new Error();
      setIdeas((prev) => prev.map((x) => (x.id === id ? { ...x, votes: x.votes + 1 } : x)));
    } catch { setMsg("Голос не засчитан — войди в аккаунт"); setTimeout(() => setMsg(""), 2000); }
  };

  const submit = async () => {
    if (!title.trim() || title.trim().length < 4) { setMsg("Название минимум 4 символа"); return; }
    setSubmitting(true);
    try {
      const r = await fetch("/magnum/api/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), description: desc.trim() }) });
      if (!r.ok) throw new Error(await r.text());
      setTitle(""); setDesc(""); setMsg("Идея улетела в Neon ✅"); await load();
    } catch (e) { setMsg(String(e).slice(0, 120)); }
    finally { setSubmitting(false); setTimeout(() => setMsg(""), 2500); }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.badge}>Neon • magnum_ideas</span>
        <h1>Генератор идей 42</h1>
        <p className={styles.sub}>Предлагай фичи — братухи голосуют. Топ улетает в прод. Всё в Lakebase, не в localStorage.</p>
      </div>

      <div className={styles.form}>
        <h2>Предложить идею</h2>
        <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок — напр. Турнир по майнингу" maxLength={80} />
        <textarea className={styles.textarea} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Описание, как это должно работать" rows={3} maxLength={300} />
        <button className={styles.submit} onClick={submit} disabled={submitting}>{submitting ? "Отправка…" : "Отправить в Neon →"}</button>
        {msg && <span className={styles.msg}>{msg}</span>}
      </div>

      {loading ? <p className={styles.loading}>Гружу идеи из Neon…</p> : (
        <div className={styles.grid}>
          {ideas.sort((a,b)=>b.votes-a.votes).map((it) => (
            <div key={it.id} className={styles.card} data-status={it.status}>
              <div className={styles.top}>
                <span className={styles.votes}>▲ {it.votes}</span>
                <span className={styles.status}>{it.status}</span>
              </div>
              <h3 className={styles.title}>{it.title}</h3>
              <p className={styles.desc}>{it.description}</p>
              <button className={styles.vote} onClick={() => vote(it.id)}>Голосовать</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
