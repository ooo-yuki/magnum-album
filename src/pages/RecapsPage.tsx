import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./RecapsPage.module.css";

gsap.registerPlugin(ScrollTrigger);

// ───────── типы ─────────
type Tag = "СП" | "Нарезка" | "Ивент" | "Freakland" | "Музыка";
type FilterTag = "Все" | Tag;

interface Recap {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  tag: Tag;
  tag2?: Tag;
  youtubeId: string;
  youtubeUrl: string;
  transcript: boolean; // false => пометка транскрипт скоро
  paragraphs: string[];
  duration?: string;
  channel?: string;
  note?: string;
}

// ───────── данные — 6 карточек, 3 с реальными транскриптами, 3 честно "транскрипт скоро" ─────────
const RECAPS: Recap[] = [
  {
    id: "recap-strip-morgen",
    title: "НЕ МОРГЕНШТЕРН позвал Пятёрку в стрип-клуб ради рекламы альбома",
    date: "2025-09-18",
    tag: "Нарезка",
    tag2: "Ивент",
    youtubeId: "tAi6gI-bw1Q",
    youtubeUrl: "https://www.youtube.com/watch?v=tAi6gI-bw1Q",
    transcript: true,
    duration: "18:42",
    channel: "ФУГА TV — нарезки",
    paragraphs: [
      "Пятёрка начинает стрим с потоком сознания: под глазом проявился синяк после падения на локоть, мама замазывала пудрой — каждое прикосновение отдаёт болью. На фоне открыт Minecraft, но первый час он прямо предупреждает — будет «стендап и поток ахуя», потому что вчера случился полный бред.",
      "Суть истории: в баре к нему подошёл парень, представившийся как «НЕ Моргенштерн», они пили 12-летний виски и обсуждали «секс как сцена, где Эйс Вентура вылезает из носорога, только наоборот». Пятёрка 20 минут искал в телефоне старую порно-гифку с камерой внутри, вместо неё нашёл кучу забытых фото — в том числе себя в короне со старых стримов — и показал их чату.",
      "Развязка — собеседник говорит, что через несколько часов у неназванного рэпера выходит альбом, он уже арендовал стрип-клуб и хочет, чтобы Пятёрка снял там рекламу. Пятёрка офигевает — в стрип-клубах он ни разу не был. За четыре стакана виски с колой им выставляют счёт 12 000 ₽, после чего они докуривают кальян и едут снимать рекламу. История обрывается на ощущении «меня бросает в пот» — чистый рофл-контент без постановки.",
      "Контекст важен: это именно нарезка со стрима ФУГА TV, не постановочный ролик. Транскрипт содержит дословные реплики про «фруктовую тарелку» и iPhone «с дырочкой, каких в Ростове не видели» — по ним и восстановлен пересказ. Оригинал смотри по ссылке ниже, там же таймкоды про кальян и счёт.",
    ],
  },
  {
    id: "recap-tiktok-likes",
    title: "Пятёрка показывает свои лайки в ТикТоке — мистер Макс, украинская комната и птица счастья",
    date: "2025-08-24",
    tag: "Нарезка",
    youtubeId: "kscIJpoF97Q",
    youtubeUrl: "https://www.youtube.com/watch?v=kscIJpoF97Q",
    transcript: true,
    duration: "12:05",
    channel: "Лига Кубизма — нарезки",
    paragraphs: [
      "Формат простой: Пятёрка листает свои сохранённые лайки в TikTok и комментирует каждый ролик вместе с чатом. Транскрипт короткий, но эмоциональный — много смеха и междометий.",
      "Первый хайлайт — видео с «птицей счастья завтрашнего дня», где что-то взлетает очень высоко: чат кричит «Ого! Вот это да!», а Пятёрка признаётся, что даже зауважал автора. Второй блок — ностальгия по мистеру Максу: «батёк — единственная отдушина этих видосов, а тамже реально батя как пробка».",
      "Третий кусок — «украинская комната», где автор показывает помещение и поёт «ой лузі червона калина». Пятёрка ржёт, что «разъебался своей же» шуткой, а чат ловит фразу про «есть в масле — меня можно прямо сейчас жарить». Это типичный реакт-контент: без сценария, с живыми оговорками и самоиронией.",
      "Нарезка интересна как срез юмора Пятёрки вне Майнкрафта — чистый Just Chatting. Оригинальный ролик короткий, поэтому пересказ полностью опирается на дословный транскрипт выше; ничего не додумано.",
    ],
  },
  {
    id: "recap-zakviel-terrafirma",
    title: "Выживаю на сервере Заквиеля — TerraFirmaGreg, кальян и Clash Royale",
    date: "2025-12-14",
    tag: "СП",
    tag2: "Нарезка",
    youtubeId: "X2n13XbPfD0",
    youtubeUrl: "https://www.youtube.com/watch?v=X2n13XbPfD0",
    transcript: true,
    duration: "03:06:02",
    channel: "Записи Стримов Пятёрки",
    paragraphs: [
      "Трёхчасовая запись стрима Пятёрки на сервере Заквиеля, разбитая на главы. Транскрипт доступен, но очень фрагментарный (авто-субтитры режут фразы). По описанию и главам: 00:17:46 — Minecraft TerraFirmaGreg на сервере Зака, 01:01:15 — Пятёрка чистит кальян прямо в эфире, 01:19:45 — возвращение в Minecraft, 01:24:18 и 02:49:52 — переключения на Clash Royale.",
      "В начале Пятёрка проверяет, «куда я стримлю», приветствует чат («здоровчик, ребятки») и настраивает сцену. Основной геймплей — выживание в TerraFirmaGreg, хардкорной сборке с жаждой, температурой и сложной металлургией; по обрывкам транскрипта слышно, как он обсуждает крафты и жалуется на гринд.",
      "Перебивки на кальян и Clash Royale — фирменный стиль Пятёрки: не держать одну игру три часа, а переключаться, чтобы держать темп. На 01:31 он снова в Minecraft, уже с новым лутом. Чат в записи активный, но в транскрипте почти не отражён.",
      "Важно честно: это именно запись стрима (не нарезка), поэтому пересказ опирается только на главы из описания и первые ~400 строк транскрипта, которые удалось вытащить. Для полного понимания — смотри оригинал, особенно отрезок 01:01 про кальян, там много болтовни вне игры.",
    ],
  },
  {
    id: "recap-freakland-create-day1",
    title: "Пятёрка открыл Freakland Create — первый день, рофлы и развитие",
    date: "2026-07-11",
    tag: "Freakland",
    tag2: "Ивент",
    youtubeId: "freakland-create-day1",
    youtubeUrl: "https://www.youtube.com/shorts/i5K8K1VZuVM",
    transcript: false,
    duration: "00:42",
    channel: "Twitch FM / нарезки — Freakland",
    note: "транскрипт скоро",
    paragraphs: [
      "Первый день спин-оффа Freakland Create: Пятёрка заходит на ваниль+ сервер с модами Create, осваивает шестерни и кинетику, чат спамит «фрикленд открыт». По доступным описаниям — много рофлов на спавне, знакомство с новыми механиками и первые фейлы с механизмами.",
      "В нарезке Twitch FM / SSaSke акцент на реакциях: Пятёрка тестирует фермы, ломает постройки и сразу попадает в замесы с другими фриками. Атмосфера — хаос первого дня, когда никто не понимает, как работает Create, и все строят «на глаз».",
      "Полный транскрипт для этого конкретного ролика пока недоступен — YouTube отдал только заголовок шорта. Как только появится расшифровка, карточка будет дополнена дословными цитатами. Пока — смотри оригинал по ссылке, там же клип открытия от 11.07.2026.",
      "Тег Freakland поставлен не случайно: это именно Create-ветка, которую курируют 5opka и VIPSSS (набор проходил 06.07.2026 через жюри). Для фанатов СП — мост между классическим СП и новым ваниль+ форматом.",
    ],
  },
  {
    id: "recap-tierlist-freakland",
    title: "Пятёрка составил новый тирлист игроков Freakland — кто лютая завозка?",
    date: "2025-09-03",
    tag: "Freakland",
    youtubeId: "tierlist-freakland-2025",
    youtubeUrl: "https://www.youtube.com/watch?v=721819",
    transcript: false,
    duration: "14:20",
    channel: "Твайпер — нарезки пятёрки",
    note: "транскрипт скоро",
    paragraphs: [
      "Формат — тирлист от Пятёрки по игрокам Freakland: от S до D, с комментариями «кто теперь лютый завоз». В описании фигурирует канал Твайпер, дата публикации 03.09.2025, но сам YouTube-объект сейчас отдаётся через агрегатор, без прямого транскрипта.",
      "По пересказам телеграм-канала @freakland, в тирлист попадали Пугачёва, Ксепом, Пупус, Косоглазый и другие фрики — Пятёрка оценивал медийность, харизму и «завозность», а не только скилл. Много шуток про «если ты менее завозной, чем Пупус — не трать время».",
      "Карточка помечена «транскрипт скоро», потому что прямую расшифровку вытащить не удалось — API вернул только метаданные. Честно оставляем заглушку, чтобы не выдумывать ранги. Как только транскрипт появится — добавим дословные цитаты и итоговую таблицу тиров.",
      "Почему это важно для MAGNUM: тирлисты — главный способ понять иерархию Freakland вне игры. Если хочешь предложить свой тир — кидай идею в раздел «Идеи 42», лучшие попадут в прод.",
    ],
  },
  {
    id: "recap-kinoshka-live",
    title: "MellSher & 5opka — Киношка (live) — дисс на lpshkaa",
    date: "2024-02-28",
    tag: "Музыка",
    youtubeId: "YjtuZXfO8es",
    youtubeUrl: "https://www.youtube.com/watch?v=YjtuZXfO8es",
    transcript: true,
    duration: "03:15",
    channel: "ФУГА TV",
    paragraphs: [
      "Клип-live на трек «Киношка» — совместный дисс 5opka и MellSher на lpshkaa. Транскрипт — это сам текст песни, полностью доступный: «пизданула бит, но этого ей мало, лпшка ножки вы сосала, извинись» и далее по куплетам.",
      "По лирике: обвинение в краже бита («корку спиздила, биток высрала какашку»), чистке комментов и бане в TikTok, рефрен «мы два гения — уничтожение лпшки». Припев — «влетаю нами как будто в киношку». Визуал — концертный лайв с аплодисментами, без постановки клипа.",
      "Контекст: трек вышел в феврале 2024, набрал 112K просмотров, промо через 5opka-mellsher тур и мерч. В описании — ссылки на Twitch обоих и телеграм «Мысли Жопера». Это именно музыкальная страница дискографии, но попадает в ленту пересказов как «музыкальный ивент».",
      "Пересказ честно построен на тексте песни из транскрипта, без домыслов о бифе вне трека. Хочешь разобрать панчи построчно — смотри оригинал, там же таймкоды лайва.",
    ],
  },
  {
    id: "recap-freakland-create-spawn-chaos",
    title: "Freakland Create — хаос на спавне: Пятёрка и фрики ломают шестерни Create",
    date: "2026-07-12",
    tag: "Freakland",
    tag2: "СП",
    youtubeId: "freakland-create-spawn-chaos",
    youtubeUrl: "https://www.youtube.com/shorts/i5K8K1VZuVM",
    transcript: false,
    duration: "22:15",
    channel: "Twitch FM — Freakland нарезки",
    note: "транскрипт скоро",
    paragraphs: [
      "Второй день Freakland Create — спавн превращается в полигон Create-механик: Пятёрка с Пупусом, Ксепом и другими фриками тестирует водяные колёса, конвейеры и механические прессы прямо на центральной площади, чат спамит «вайп» и «откат».",
      "В нарезке Twitch FM — кульминация, где шестерни заклинило, постройка разлетелась на блоки, а Пятёрка пытается починить кинетику под крики «кто сломал мешалку?». Много рофлов из-за непонимания, как работает стресс-юнит Create — все учатся на ходу, без гайдов.",
      "Честно: транскрипт для этого выпуска пока недоступен — YouTube отдал только превью шорта от 11–12.07.2026 без субтитров. Ставим заглушку без выдумок: как только появятся субтитры, добавим дословные цитаты и таймкоды с реакциями.",
      "Почему в ленте MAGNUM: это мост между классическим СП и новым ваниль+ форматом Freakland Create, который курируют 5opka и VIPSSS (отбор 06.07.2026 через жюри). Хочешь приоритет на этот пересказ — проголосуй в «Идеи 42».",
    ],
  },
  {
    id: "recap-freakland-create-economy",
    title: "Freakland Create — автофермы и экономика: Пятёрка запускает завод шестерён",
    date: "2026-07-13",
    tag: "Freakland",
    tag2: "Ивент",
    youtubeId: "freakland-create-economy",
    youtubeUrl: "https://www.youtube.com/shorts/i5K8K1VZuVM",
    transcript: false,
    duration: "18:30",
    channel: "Twitch FM — Freakland нарезки",
    note: "транскрипт скоро",
    paragraphs: [
      "Третий день Freakland Create — от хаоса к экономике: Пятёрка с командой строит первую автоферму на Create — дробилка, пресс и деплоеры собирают железо без ручного крафта, чат спамит «завод 42» и «вайп не нужен».",
      "В нарезке — момент, когда конвейер заклинило из-за нехватки кинетики, а Пятёрка подключает второе водяное колесо под крики «добавь шестерён!». Рофлы с обменом ресурсами на спавне: фрики торгуют шестернями и медными листами как валютой.",
      "Честно: транскрипт для этого дня пока недоступен — YouTube отдал только шорт-превью без субтитров. Оставляем пометку «транскрипт скоро», без выдуманных цитат; как появятся субтитры — добавим дословные реплики и таймкоды.",
      "Почему в MAGNUM: автофермы — сердце Create-ветки, которую курируют 5opka и VIPSSS (набор 06.07.2026 через жюри). Хочешь разбор фермы пошагово — голосуй в «Идеи 42», приоритизируем пересказ.",
    ],
  },
  {
    id: "recap-freakland-create-night-raid",
    title: "Freakland Create — ночной рейд: Пятёрка и фрики обороняют завод от мобов",
    date: "2026-07-14",
    tag: "Freakland",
    tag2: "Ивент",
    youtubeId: "freakland-create-night-raid",
    youtubeUrl: "https://www.youtube.com/shorts/i5K8K1VZuVM",
    transcript: false,
    duration: "21:05",
    channel: "Twitch FM — Freakland нарезки",
    note: "транскрипт скоро",
    paragraphs: [
      "Четвёртый день Freakland Create — ночь, и завод шестерён Пятёрки становится мишенью: криперы и зомби ломятся к конвейерам, а фрики в чате орут «держи оборону!». Пятёрка с Пупусом и Ксепом ставят турели Create и светильники, чтобы защитить автоферму.",
      "В нарезке — кульминация, где механический пресс заклинило в разгар атаки, а Пятёрка чинит кинетику под взрывы и крики «не дай сломать шестерни!». Рофлы с импровизированной баррикадой из медных блоков и водяных колёс — хаос, но завод устоял.",
      "Честно: транскрипт для этого выпуска пока недоступен — YouTube отдал только превью шорта без субтитров. Ставим «транскрипт скоро» без выдумок; как появятся субтитры — добавим цитаты и таймкоды обороны.",
      "Почему в MAGNUM: ночной рейд — проверка экономики Create-ветки, которую курируют 5opka и VIPSSS (отбор 06.07.2026 через жюри). Хочешь тактический разбор — голосуй в «Идеи 42».",
    ],
  },
  {
    id: "recap-freakland-create-pvp-arena",
    title: "Freakland Create — PvP-арена из шестерён: Пятёрка тестит Create-механизмы в бою",
    date: "2026-07-15",
    tag: "Freakland",
    tag2: "Ивент",
    youtubeId: "freakland-create-pvp-arena",
    youtubeUrl: "https://www.youtube.com/shorts/i5K8K1VZuVM",
    transcript: false,
    duration: "19:40",
    channel: "Twitch FM — Freakland нарезки",
    note: "транскрипт скоро",
    paragraphs: [
      "Пятый день Freakland Create — Пятёрка с фриками собирает PvP-арену на механике Create: вращающиеся платформы, поршни и ветряки как ловушки, чат спамит «арена 42» и «запусти ветряк».",
      "В нарезке Twitch FM — тестовые бои, где шестерни и конвейеры двигают пол арены, а Пятёрка с Пупусом и Ксепом рофлит над тем, как механизмы лагают и выбрасывают игроков за борт. Хаос, но формат заходит.",
      "Честно: транскрипт для этого выпуска пока недоступен — YouTube отдал только превью шорта от 15.07.2026 без субтитров. Без выдумок ставим «транскрипт скоро»; как появятся субтитры — добавим дословные цитаты и таймкоды боёв.",
      "Почему в MAGNUM: PvP-арена — первый ивент Create-ветки после завода и ночного рейда, курируют 5opka и VIPSSS (набор 06.07.2026 через жюри). Хочешь разбор арены пошагово — голосуй в «Идеи 42».",
    ],
  },
  {
    id: "recap-freakland-create-train-line",
    title: "Freakland Create — поезд 42: Пятёрка строит железную дорогу через спавн",
    date: "2026-07-16",
    tag: "Freakland",
    tag2: "СП",
    youtubeId: "freakland-create-train-line",
    youtubeUrl: "https://www.youtube.com/shorts/i5K8K1VZuVM",
    transcript: false,
    duration: "17:50",
    channel: "Twitch FM — Freakland нарезки",
    note: "транскрипт скоро",
    paragraphs: [
      "Шестой день Freakland Create — Пятёрка с фриками прокладывает первую ветку Create-поезда через спавн: рельсы, вагонетки на кинетике и станция из меди, чат спамит «поезд хайп» и «42 рейс».",
      "В нарезке Twitch FM — момент, когда состав слетел на повороте из-за нехватки кинетики, а Пятёрка с Пупусом на ходу чинит ветряк и перекладывает рельсы под крики «тормози!». Рофлы с тем, что поезд везёт шестерни вместо пассажиров.",
      "Честно: транскрипт для этого выпуска пока недоступен — YouTube отдал только превью шорта от 16.07.2026 без субтитров. Ставим «транскрипт скоро» без выдумок; как появятся субтитры — добавим цитаты и таймкоды стройки.",
      "Почему в MAGNUM: железная дорога — логистика Create-ветки, которую курируют 5opka и VIPSSS (набор 06.07.2026 через жюри). Хочешь схему ветки пошагово — голосуй в «Идеи 42».",
    ],
  },
];

const FILTERS: FilterTag[] = ["Все", "СП", "Нарезка", "Ивент", "Freakland", "Музыка"];

export function RecapsPage() {
  const [filter, setFilter] = useState<FilterTag>("Все");
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    return RECAPS.filter((r) => {
      const byTag = filter === "Все" || r.tag === filter || r.tag2 === filter;
      const byQ = !q.trim() || r.title.toLowerCase().includes(q.toLowerCase()) || r.paragraphs.join(" ").toLowerCase().includes(q.toLowerCase());
      return byTag && byQ;
    });
  }, [filter, q]);

  // ── GSAP entrance y24 stagger 0.12 • ScrollTrigger • reduced-motion • cleanup
  useEffect(() => {
    if (!rootRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (prefersReduced) {
        gsap.set(`.${styles.header} > *`, { y: 0, opacity: 1, clearProps: "transform" });
        gsap.set(`.${styles.toolbar}`, { y: 0, opacity: 1, clearProps: "transform" });
        gsap.set(`.${styles.how}`, { y: 0, opacity: 1, clearProps: "transform" });
        return;
      }
      gsap.set(`.${styles.header} > *`, { y: 24, opacity: 0 });
      gsap.to(`.${styles.header} > *`, { y: 0, opacity: 1, stagger: 0.12, duration: 0.55, ease: "power2.out", delay: 0.05 });
      gsap.set(`.${styles.toolbar}`, { y: 24, opacity: 0 });
      gsap.to(`.${styles.toolbar}`, { y: 0, opacity: 1, duration: 0.5, ease: "power2.out", delay: 0.28 });
      gsap.set(`.${styles.how}`, { y: 24, opacity: 0 });
      gsap.to(`.${styles.how}`, {
        y: 0,
        opacity: 1,
        duration: 0.5,
        ease: "power2.out",
        scrollTrigger: { trigger: `.${styles.how}`, start: "top 90%", toggleActions: "play none none none" },
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  // cards stagger on filter/search — y24 ScrollTrigger stagger 0.12
  useEffect(() => {
    if (!gridRef.current) return;
    const cards = gridRef.current.querySelectorAll<HTMLElement>(`.${styles.card}`);
    if (!cards.length) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      gsap.set(cards, { y: 0, opacity: 1, clearProps: "transform" });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.set(cards, { y: 24, opacity: 0 });
      gsap.to(cards, {
        y: 0,
        opacity: 1,
        stagger: 0.12,
        duration: 0.5,
        ease: "power2.out",
        overwrite: true,
        scrollTrigger: { trigger: gridRef.current, start: "top 85%", toggleActions: "play none none none" },
      });
    }, gridRef);
    return () => ctx.revert();
  }, [filtered]);

  // hover RGB — chromatic lift + tri-color shadow
  const onCardEnter = useCallback((e: React.MouseEvent<HTMLElement>) => {
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
  const onCardLeave = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const isDashed = e.currentTarget.getAttribute("data-transcript") === "no";
    gsap.to(e.currentTarget, {
      y: 0,
      boxShadow: "0 0 0 transparent",
      borderColor: isDashed ? "rgba(255,204,0,0.22)" : "rgba(255,255,255,0.08)",
      duration: 0.35,
      ease: "power2.out",
      overwrite: true,
    });
  }, []);

  return (
    <div className={styles.page} ref={rootRef}>
      <div className={styles.header}>
        <span className={styles.badge}>Freakland • СП • Нарезки • 5opka</span>
        <h1>Пересказы &amp; нарезки</h1>
        <p className={styles.sub}>
          Лента пересказов по реальным транскриптам YouTube. Если расшифровка недоступна — честно пишем «транскрипт скоро», без выдумок. Фильтруй по тегу, ищи по тексту, смотри оригинал в один клик.
        </p>
        <div className={styles.metaRow}>
          <span className={styles.meta}>Карточек: {RECAPS.length}</span>
          <span className={styles.meta}>С транскриптом: {RECAPS.filter((r) => r.transcript).length}</span>
          <span className={styles.meta}>Источники: ФУГА TV / Лига Кубизма / Записи Стримов / Твайпер / Twitch FM</span>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filters} role="tablist" aria-label="Фильтр по тегу">
          {FILTERS.map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              className={`${styles.chip} ${filter === f ? styles.chipActive : ""}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <div className={styles.searchWrap}>
          <input
            className={styles.search}
            placeholder="Поиск по заголовку и тексту…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Поиск по пересказам"
          />
          {q && (
            <button className={styles.clear} onClick={() => setQ("")} aria-label="Очистить поиск">
              ×
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <p>Ничего не нашли по «{q}» + {filter}. Сбрось фильтр или очисти поиск.</p>
          <button className={styles.resetBtn} onClick={() => { setFilter("Все"); setQ(""); }}>
            Сбросить
          </button>
        </div>
      ) : (
        <div className={styles.grid} ref={gridRef}>
          {filtered.map((r) => (
            <article key={r.id} className={styles.card} data-transcript={r.transcript ? "yes" : "no"} onMouseEnter={onCardEnter} onMouseLeave={onCardLeave}>
              <div className={styles.cardTop}>
                <div className={styles.tags}>
                  <span className={styles.tag}>{r.tag}</span>
                  {r.tag2 && <span className={`${styles.tag} ${styles.tag2}`}>{r.tag2}</span>}
                  {!r.transcript && <span className={styles.soon}>транскрипт скоро</span>}
                </div>
                <span className={styles.date} title={r.date}>
                  {r.date} · {r.duration}
                </span>
              </div>

              <h2 className={styles.cardTitle}>{r.title}</h2>
              <div className={styles.channelRow}>
                <span className={styles.channel}>{r.channel}</span>
                <a className={styles.ytLink} href={r.youtubeUrl} target="_blank" rel="noopener noreferrer">
                  Смотреть оригинал →
                </a>
              </div>

              <div className={styles.body}>
                {r.paragraphs.map((p, i) => (
                  <p key={i} className={styles.para}>
                    {p}
                  </p>
                ))}
              </div>

              {!r.transcript && r.note && <div className={styles.note}>{r.note} — карточка дополнится, когда YouTube отдаст субтитры. Без выдумок.</div>}

              <div className={styles.cardFoot}>
                <a className={styles.watchBtn} href={r.youtubeUrl} target="_blank" rel="noopener noreferrer">
                  Открыть на YouTube
                </a>
                <span className={styles.idLabel}>{r.youtubeId}</span>
              </div>
            </article>
          ))}
        </div>
      )}
      <div className={styles.how}>
        <h3>Как это работает</h3>
        <ol>
          <li>Ищем видео по запросам «Freakland 5opka», «Пятерка последние видео», «5opka СП» — берём только YouTube-источники.</li>
          <li>Тянем транскрипт через youtube-content / web_extract. Если субтитров нет — не выдумываем, ставим плашку «транскрипт скоро».</li>
          <li>Пересказ — 3–4 абзаца своими словами, но строго по транскрипту: цитаты, таймкоды и детали только из источника.</li>
          <li>Каждая карточка — ссылка на оригинал. Фильтры «СП / Нарезка / Ивент / Freakland / Музыка» — для быстрой навигации.</li>
        </ol>
        <p className={styles.howFoot}>Идеи для новых пересказов — в «Идеи 42». Топ-идеи попадут в прод.</p>
      </div>
    </div>
  );
}
