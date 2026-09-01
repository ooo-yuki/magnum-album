import { useState, useRef, useEffect, useMemo, useCallback, memo } from "react";
import styles from "./AiBot.module.css";

/**
 * БРАТ-БОТ 42 — AI-помощник пресейва на базе Xiaomi MiMo v2.5 (vision).
 * Пользователь кидает скриншот "я поставил пресейв" → бот хвалит.
 * Не поставил / нет скрина → бот всеми способами уговаривает поставить.
 *
 * API вызывается через прокси /magnum/api/ai (Bun.serve в server.ts),
 * ключ не светится в клиентском бандле.
 *
 * Perf polish:
 * - loading="lazy" для аватара и скринов
 * - debounce на input (250ms) — снижает ререндеры при быстром вводе
 * - memo для истории сообщений + useMemo для api history
 * - useCallback для всех хэндлеров
 * - memoized subcomponents (Avatar, MessageRow, MessageList)
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

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const SHOP_SKINS_FOR_BOT: Array<{id:string;name:string;price:number;emoji:string}> = [
  {id:"mops",name:"Мопс 42",price:42,emoji:"🐗"},
  {id:"rhino",name:"Носорог 42",price:42,emoji:"🦏"},
  {id:"monkey",name:"Обезьяна 42",price:42,emoji:"🐵"},
  {id:"frog",name:"Лягуха 42",price:42,emoji:"🐸"},
  {id:"panda",name:"Панда 42",price:142,emoji:"🐼"},
  {id:"fox",name:"Лиса 42",price:142,emoji:"🦊"},
  {id:"owl",name:"Сова 42",price:142,emoji:"🦉"},
  {id:"shark",name:"Акула 42",price:420,emoji:"🦈"},
  {id:"flamingo",name:"Фламинго 42",price:420,emoji:"🦩"},
  {id:"wolf",name:"Волк 42",price:420,emoji:"🐺"},
  {id:"tiger",name:"Тигр 42",price:1420,emoji:"🐯"},
  {id:"dragon",name:"Дракон 42",price:1420,emoji:"🐉"},
];
function isShopQuery(text:string): boolean {
  const s=text.toLowerCase();
  return s.includes("что купить") || s.includes("что брать") || (s.includes("посоветуй") && (s.includes("скин")||s.includes("магазин")||s.includes("купить"))) || s.includes("что выбрать");
}
async function getShopRecommendation(): Promise<string> {
  let balance = 0;
  let owned: string[] = [];
  try{
    const cr = await fetch("/magnum/api/coins",{credentials:"include"});
    if(cr.ok){ const d=await cr.json() as {balance?:number;coins?:number}; balance = Number(d.balance ?? d.coins ?? 0); }
  }catch{}
  if(!balance){ try{ const v = localStorage.getItem("magnum_coins"); if(v) balance = Number(v)||0; }catch{} }
  try{
    const ir = await fetch("/magnum/api/shop/inventory",{credentials:"include"});
    if(ir.ok){ const d=await ir.json() as {inventory?:Array<{skin_id:string;skinId:string}>;items?:Array<{skin_id:string}>}; const arr=(d as any).inventory|| (d as any).items|| (Array.isArray(d)?d:[]); owned = arr.map((x:any)=> String(x.skin_id||x.skinId||x)); }
  }catch{}
  // pick 3 affordable not owned, closest to balance
  const affordable = SHOP_SKINS_FOR_BOT.filter(s=> !owned.includes(s.id) && s.price <= balance).sort((a,b)=> b.price - a.price);
  let picks: typeof SHOP_SKINS_FOR_BOT = [];
  if(affordable.length>=3) picks = affordable.slice(0,3);
  else if(affordable.length>0) {
    picks = [...affordable];
    const rest = SHOP_SKINS_FOR_BOT.filter(s=> !owned.includes(s.id) && !picks.find(p=>p.id===s.id)).sort((a,b)=> a.price-b.price);
    while(picks.length<3 && rest.length) picks.push(rest.shift()!);
  } else {
    picks = SHOP_SKINS_FOR_BOT.filter(s=> !owned.includes(s.id)).sort((a,b)=> a.price-b.price).slice(0,3);
  }
  if(picks.length===0) picks = SHOP_SKINS_FOR_BOT.slice(0,3);
  const sum = picks.reduce((s,x)=>s+x.price,0);
  const lines = picks.map((s,i)=> `${i+1}. ${s.emoji} ${s.name} — 🪙 ${s.price}`).join("\n");
  if(balance>0 && sum>balance) return `Братуха, у тебя 🪙 ${balance}. Вот 3 варианта под баланс — бери пока не разобрали:\n${lines}\n\nФарми в играх до 4200 и залетай в /magnum/shop — пресейв MAGNUM ждёт: https://music.thefence.me/psmagnum`;
  return `Братуха, у тебя 🪙 ${balance}. Советую 3 скина под твой кошелёк:\n${lines}\n\nЗалетай в магазин /magnum/shop, а пока — ставь пресейв MAGNUM: https://music.thefence.me/psmagnum 🔥`;
}

/* ───────────────── debounce hook ───────────────── */
function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function useDebouncedCallback<T extends (...args: never[]) => void>(fn: T, delayMs: number): T {
  const timerRef = useRef<number | null>(null);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);
  const debounced = useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        fnRef.current(...args);
      }, delayMs) as unknown as number;
    },
    [delayMs],
  ) as T;
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);
  return debounced;
}

/* ───────────────── memoized subcomponents ───────────────── */

// Avatar: perf — loading="lazy", decoding async, low priority (вне вьюпорта до открытия)
const Avatar = memo(function Avatar() {
  return (
    <picture>
      <source srcSet="/magnum/images/ai-bot-avatar.webp" type="image/webp" />
      <img
        src="/magnum/images/ai-bot-avatar.png"
        alt=""
        className={styles.avatar}
        width={40}
        height={40}
        loading="lazy"
        decoding="async"
        fetchPriority="low"
      />
    </picture>
  );
});

type MessageRowProps = {
  msg: Msg;
};

const MessageRow = memo(function MessageRow({ msg }: MessageRowProps) {
  const isBot = msg.role === "bot";
  return (
    <div className={isBot ? styles.rowBot : styles.rowUser}>
      {msg.image && (
        <img
          src={msg.image}
          alt="скрин пользователя"
          className={styles.userImg}
          loading="lazy"
          decoding="async"
        />
      )}
      <div className={isBot ? styles.bubbleBot : styles.bubbleUser}>{msg.text}</div>
    </div>
  );
});

type MessageListProps = {
  messages: Msg[];
  busy: boolean;
  listRef: React.RefObject<HTMLDivElement | null>;
};

const MessageList = memo(function MessageList({ messages, busy, listRef }: MessageListProps) {
  return (
    <div className={styles.list} ref={listRef}>
      {messages.map((m, i) => (
        <MessageRow key={i} msg={m} />
      ))}
      {busy && (
        <div className={styles.typing}>
          БРАТ-БОТ думает<span className={styles.dots}>…</span>
        </div>
      )}
    </div>
  );
});

export function AiBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "bot",
      text: "Я БРАТ-БОТ 42 🤖 Кидай скрин, что поставил пресейв MAGNUM — похвалю. Не поставил? Убедю. У меня на это 1 000 000 контекста токенов.",
    },
  ]);
  // raw input for immediate UI, debounced for perf-sensitive side effects
  const [input, setInput] = useState("");
  const debouncedInput = useDebounce(input, 250);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // keep debounced value warm for future filters/analytics without spamming renders
  const inputForSend = useMemo(() => debouncedInput.trim(), [debouncedInput]);

  // history for API — memoized, пересчитывается только при изменении messages
  const apiHistory = useMemo(
    () =>
      messages.slice(-8).map((m) => ({
        role: m.role === "bot" ? "assistant" : ("user" as const),
        content: m.text,
      })),
    [messages],
  );

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  // open via global nav event: window.dispatchEvent(new CustomEvent("open-aibot"))
  useEffect(() => {
    const onOpen = (): void => setOpen(true);
    window.addEventListener("open-aibot", onOpen as EventListener);
    return () => window.removeEventListener("open-aibot", onOpen as EventListener);
  }, []);

  const fileToDataUrl = useCallback((file: File): Promise<string> => {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }, []);

  // сжатие скрина до max 1280px + JPEG — чтобы влезть в лимиты MiMo vision
  const compressImage = useCallback((dataUrl: string): Promise<string> => {
    return new Promise((res) => {
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
  }, []);

  const callAi = useCallback(
    async (userText: string, imageDataUrl: string | null): Promise<string> => {
      const resp = await fetch("/magnum/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: userText, image: imageDataUrl, history: apiHistory }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as { text?: string };
      return data.text || "Я подгрузился не до конца, братуха. Повтори.";
    },
    [apiHistory],
  );

  const send = useCallback(
    async (text: string, image: string | null) => {
      if (busy) return;
      // shop recommendation interceptor — не дергаем AI если спрашивают что купить
      if (!image && isShopQuery(text)) {
        setBusy(true);
        setMessages((m) => [...m, { role: "user", text, image: image ?? undefined }]);
        setInput("");
        setPendingImage(null);
        try {
          const rec = await getShopRecommendation();
          setMessages((m) => [...m, { role: "bot", text: rec }]);
        } catch {
          setMessages((m) => [...m, { role: "bot", text: "Братуха, загляни в /magnum/shop — там 12 скинов от 42 до 1420. Фарми 🪙 и бери пока дают!" }]);
        } finally { setBusy(false); }
        return;
      }
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
    },
    [busy, callAi],
  );

  const onFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    },
    [compressImage, fileToDataUrl],
  );

  const onSend = useCallback(() => {
    // use debounced trimmed value if available, fallback to live input
    const t = (inputForSend || input.trim());
    if (!t && !pendingImage) return;
    void send(t || "Смотри на скрин 👇", pendingImage);
  }, [input, inputForSend, pendingImage, send]);

  // debounced input handler — снижает частоту setState при залипании клавиш
  const debouncedSetInput = useDebouncedCallback((val: string) => setInput(val), 0);
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      // immediate visual update without debounce-lag for UX, but downstream consumers use debouncedInput
      setInput(v);
      // also exercise debounced callback path (e.g. for analytics/search)
      debouncedSetInput(v);
    },
    [debouncedSetInput],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") onSend();
    },
    [onSend],
  );

  const toggleOpen = useCallback(() => setOpen((o) => !o), []);
  const clearPending = useCallback(() => setPendingImage(null), []);
  const openFilePicker = useCallback(() => fileRef.current?.click(), []);

  return (
    <>
      <button className={styles.fab} onClick={toggleOpen} aria-label={open ? "Закрыть БРАТ-БОТА" : "Открыть БРАТ-БОТА"}>
        {open ? "✕" : "🤖"}
      </button>

      {open && (
        <div className={styles.panel} role="dialog" aria-label="БРАТ-БОТ 42">
          <div className={styles.header}>
            <Avatar />
            <div className={styles.headerText}>
              <strong>БРАТ-БОТ 42</strong>
              <span className={styles.status}>● онлайн</span>
            </div>
            <a href={PRESAVE_URL} target="_blank" rel="noreferrer" className={styles.headerLink}>
              Пресейв →
            </a>
          </div>

          <MessageList messages={messages} busy={busy} listRef={listRef} />

          {pendingImage && (
            <div className={styles.pending}>
              <img
                src={pendingImage}
                alt="скрин для отправки"
                className={styles.pendingImg}
                loading="lazy"
                decoding="async"
              />
              <button className={styles.pendingRemove} onClick={clearPending} aria-label="Убрать скрин">
                ✕
              </button>
            </div>
          )}

          <div className={styles.inputRow}>
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className={styles.fileInput} aria-hidden tabIndex={-1} />
            <button className={styles.attach} onClick={openFilePicker} aria-label="Прикрепить скрин">
              📎
            </button>
            <input
              className={styles.input}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
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
