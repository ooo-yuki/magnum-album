import { useState, useRef, useEffect } from "react";
import styles from "./AiBot.module.css";

/**
 * БРАТ-БОТ 42 — AI-помощник пресейва на базе Xiaomi MiMo v2.5 (vision).
 * Пользователь кидает скриншот "я поставил пресейв" → бот хвалит.
 * Не поставил / нет скрина → бот всеми способами уговаривает поставить.
 *
 * API вызывается через прокси /magnum/api/ai (Bun.serve в server.ts),
 * ключ не светится в клиентском бандле.
 */

const PRESAVE_URL = "https://music.thefence.me/psmagnum";

type Msg = {
  role: "user" | "bot";
  text: string;
  image?: string; // dataURL превью пользовательского скрина
};

const PRAISES = [
  "БРАТУХА! Ты легенда, пресейв поставлен — я это вижу на скрине 🔥 Ты теперь официально в списке тех, кто услышит MAGNUM первым.",
  "ПОДТВЕРЖДАЮ: скрин настоящий, пресейв стоит. Пять пуль уже ждут тебя в плейлисте. Ты сделал правильный выбор, брат.",
  "Вот это поступок! Скрин принят, пресейв засчитан. Скидывай скрин друзьям — пусть вся школа будет готова к MAGNUM.",
];

const NAGS = [
  "Слышь, братуха. MAGNUM — 5 пуль из 3D-принтера. Без пресейва ты услышишь их ПОСЛЕДНИМ. Не позорь 42.",
  "Туса Медуза уже 200K просмотров. VPN разрывает чарты. А ты всё ещё без пресейва? Серьёзно?",
  "Каждый нормис без пресейва автоматически попадает в список Мизулина. Не рискуй, братуха — одна кнопка.",
  "42 братухи смотрят на тебя. Пятерка смотрит на тебя. Диско-шар смотрит на тебя. Пресейв. Прямо сейчас.",
  "Если бы пресейв был учеником, он был бы отличником. А ты до сих пор учитель, который его не поставил. Фикси.",
];

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

export function AiBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "bot",
      text: "Я БРАТ-БОТ 42 🤖 Кидай скрин, что поставил пресейв MAGNUM — похвалю. Не поставил? Убедю. У меня на это 1 000 000 контекста токенов.",
    },
  ]);
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  // open via global nav event: window.dispatchEvent(new CustomEvent("open-aibot"))
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("open-aibot", onOpen as EventListener);
    return () => window.removeEventListener("open-aibot", onOpen as EventListener);
  }, []);

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(file);
    });

  // сжатие скрина до max 1280px + JPEG — чтобы влезть в лимиты MiMo vision
  const compressImage = (dataUrl: string): Promise<string> =>
    new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1280;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return res(dataUrl);
        ctx.drawImage(img, 0, 0, w, h);
        res(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => res(dataUrl);
      img.src = dataUrl;
    });

  const callAi = async (userText: string, imageDataUrl: string | null): Promise<string> => {
    const history = messages.slice(-8).map((m) => ({
      role: m.role === "bot" ? "assistant" : "user",
      content: m.text,
    }));
    const resp = await fetch("/magnum/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: userText, image: imageDataUrl, history }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = (await resp.json()) as { text?: string };
    return data.text || "Я подгрузился не до конца, братуха. Повтори.";
  };

  const send = async (text: string, image: string | null) => {
    if (busy) return;
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text, image: image ?? undefined }]);
    setInput("");
    setPendingImage(null);
    try {
      const reply = await callAi(text, image);
      setMessages((m) => [...m, { role: "bot", text: reply }]);
    } catch {
      const fallback = image
        ? pick(PRAISES) + " (бот офлайн, но скрин я запомнил)"
        : pick(NAGS) + " (бот офлайн, но правда не офлайн)";
      setMessages((m) => [...m, { role: "bot", text: fallback }]);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessages((m) => [...m, { role: "bot", text: "Это не картинка, братуха. Скрин — это PNG/JPG." }]);
      return;
    }
    const raw = await fileToDataUrl(file);
    const compressed = await compressImage(raw);
    setPendingImage(compressed);
    e.target.value = "";
  };

  const onSend = () => {
    const t = input.trim();
    if (!t && !pendingImage) return;
    void send(t || "Смотри на скрин 👇", pendingImage);
  };

  return (
    <>
      <button
        className={styles.fab}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Закрыть БРАТ-БОТА" : "Открыть БРАТ-БОТА"}
      >
        {open ? "✕" : "🤖"}
      </button>

      {open && (
        <div className={styles.panel} role="dialog" aria-label="БРАТ-БОТ 42">
          <div className={styles.header}>
            <picture>
              <source srcSet="/magnum/images/ai-bot-avatar.webp" type="image/webp" />
              <img src="/magnum/images/ai-bot-avatar.png" alt="" className={styles.avatar} width={40} height={40} loading="eager" decoding="async" fetchPriority="high" />
            </picture>
            <div className={styles.headerText}>
              <strong>БРАТ-БОТ 42</strong>
              <span className={styles.status}>● онлайн</span>
            </div>
            <a href={PRESAVE_URL} target="_blank" rel="noreferrer" className={styles.headerLink}>
              Пресейв →
            </a>
          </div>

          <div className={styles.list} ref={listRef}>
            {messages.map((m, i) => (
              <div key={i} className={m.role === "bot" ? styles.rowBot : styles.rowUser}>
                {m.image && <img src={m.image} alt="скрин пользователя" className={styles.userImg} />}
                <div className={m.role === "bot" ? styles.bubbleBot : styles.bubbleUser}>{m.text}</div>
              </div>
            ))}
            {busy && <div className={styles.typing}>БРАТ-БОТ думает<span className={styles.dots}>…</span></div>}
          </div>

          {pendingImage && (
            <div className={styles.pending}>
              <img src={pendingImage} alt="скрин для отправки" className={styles.pendingImg} />
              <button className={styles.pendingRemove} onClick={() => setPendingImage(null)} aria-label="Убрать скрин">
                ✕
              </button>
            </div>
          )}

          <div className={styles.inputRow}>
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className={styles.fileInput} aria-hidden tabIndex={-1} />
            <button className={styles.attach} onClick={() => fileRef.current?.click()} aria-label="Прикрепить скрин">
              📎
            </button>
            <input
              className={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSend()}
              placeholder={pendingImage ? "Добавь комментарий к скрину…" : "Спроси / докажи скрином…"}
              aria-label="Сообщение боту"
            />
            <button className={styles.send} onClick={onSend} disabled={busy} aria-label="Отправить">
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}
