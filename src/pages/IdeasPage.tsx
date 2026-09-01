import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import styles from "./IdeasPage.module.css";

type Idea = { id: number; title: string; description: string; votes: number; status: string; created_at: string };

export function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const r = await fetch("/magnum/api/ideas", { credentials: "include" });
      if (!r.ok) throw new Error(String(r.status));
      const data = (await r.json()) as { ideas: Idea[] };
      setIdeas(data.ideas || []);
    } catch {
      setIdeas([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  // ── GSAP entrance: stagger 0.12 y 24→0, reduced-motion fallback, context cleanup
  useEffect(() => {
    if (!rootRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (prefersReduced) {
        gsap.set(`.${styles.header} > *`, { y: 0, opacity: 1, clearProps: "transform" });
        if (formRef.current) gsap.set(formRef.current, { y: 0, opacity: 1, clearProps: "transform" });
        if (gridRef.current) gsap.set(`.${styles.card}`, { y: 0, opacity: 1, clearProps: "transform" });
        return;
      }
      gsap.set(`.${styles.header} > *`, { y: 24, opacity: 0 });
      gsap.to(`.${styles.header} > *`, { y: 0, opacity: 1, stagger: 0.12, duration: 0.55, ease: "power2.out", delay: 0.05 });
      if (formRef.current) {
        gsap.set(formRef.current, { y: 24, opacity: 0 });
        gsap.to(formRef.current, { y: 0, opacity: 1, duration: 0.5, ease: "power2.out", delay: 0.28 });
      }
    }, rootRef);
    return () => ctx.revert();
  }, []);

  // grid cards stagger when ideas change
  useEffect(() => {
    if (!gridRef.current || loading || ideas.length === 0) return;
    const cards = gridRef.current.querySelectorAll<HTMLElement>(`.${styles.card}`);
    if (!cards.length) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      gsap.set(cards, { y: 0, opacity: 1, clearProps: "transform" });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.set(cards, { y: 24, opacity: 0 });
      gsap.to(cards, { y: 0, opacity: 1, stagger: 0.12, duration: 0.5, ease: "power2.out", overwrite: true });
    }, gridRef);
    return () => ctx.revert();
  }, [ideas, loading]);

  const onCardEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.to(e.currentTarget, {
      y: -4,
      boxShadow: "0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,45,85,0.20), 0 0 22px rgba(255,45,85,0.20), 0 0 22px rgba(0,255,136,0.12), 0 0 28px rgba(255,204,0,0.10)",
      borderColor: "rgba(255,45,85,0.35)",
      duration: 0.28,
      ease: "power2.out",
      overwrite: true,
    });
  }, []);
  const onCardLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.to(e.currentTarget, {
      y: 0,
      boxShadow: "0 0 0 transparent",
      borderColor: "rgba(255,255,255,0.08)",
      duration: 0.35,
      ease: "power2.out",
      overwrite: true,
    });
  }, []);

  const vote = async (id: number) => {
    try {
      const r = await fetch(`/magnum/api/ideas/${id}/vote`, { method: "POST", credentials: "include" });
      if (!r.ok) throw new Error();
      setIdeas((prev) => prev.map((x) => (x.id === id ? { ...x, votes: x.votes + 1 } : x)));
    } catch { setMsg("Голос не засчитан — войди в аккаунт"); setTimeout(() => setMsg(""), 2000); }
  };

  const submit = async () => {
    if (!title.trim() || title.trim().length < 4) { setMsg("Название минимум 4 символа"); return; }
    setSubmitting(true);
    try {
      const r = await fetch("/magnum/api/ideas", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), description: desc.trim() }) });
      if (!r.ok) throw new Error(await r.text());
      setTitle(""); setDesc(""); setMsg("Идея улетела ✅"); await load();
    } catch (e) { setMsg(String(e).slice(0, 120)); }
    finally { setSubmitting(false); setTimeout(() => setMsg(""), 2500); }
  };

  return (
    <div className={styles.page} ref={rootRef}>
      <div className={styles.header}>
        <span className={styles.badge}>Идеи 42 • братухи решают</span>
        <h1>Генератор идей 42</h1>
        <p className={styles.sub}>Предлагай фичи — братухи голосуют. Топ улетает в прод.</p>
      </div>

      <div className={styles.form} ref={formRef}>
        <h2>Предложить идею</h2>
        <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок — напр. Турнир по майнингу" maxLength={80} />
        <textarea className={styles.textarea} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Описание, как это должно работать" rows={3} maxLength={300} />
        <button className={styles.submit} onClick={submit} disabled={submitting}>{submitting ? "Отправка…" : "Отправить →"}</button>
        {msg && <span className={styles.msg}>{msg}</span>}
      </div>

      {loading ? <p className={styles.loading}>Загружаю идеи…</p> : ideas.length === 0 ? (
        <p className={styles.loading}>Пока нет идей — зарегистрируйся и стань первым, братуха. Только реальные игроки.</p>
      ) : (
        <div className={styles.grid} ref={gridRef}>
          {ideas.sort((a,b)=>b.votes-a.votes).map((it) => (
            <div key={it.id} className={styles.card} data-status={it.status} onMouseEnter={onCardEnter} onMouseLeave={onCardLeave}>
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
