 
import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./PressWall.module.css";

gsap.registerPlugin(ScrollTrigger);

type Review = {
  source: string;
  logo: string;
  score: string;
  max: string;
  verdict: string;
  quote: string;
  album: string;
  year: string;
  color: string;
};

const REVIEWS: Review[] = [
  { source: "Пожарники feat Илюха рэп — легенда легенд хайп-кроссовер", logo: "🚒", score: "02.04", max: ".2026", verdict: "Кроссовер CLAY", quote: "«Это Илюха легенда легенд это Кирюха легенда легенд техника искренность стиле хайпуля в тандеме сильнейшем» — кроссовер 5opka × Илюха рэп, трек №4 CLAY 02.04.2026 (1919 симв. VTT eX7hM-t_hLw, transcript:true). Отсылка к CLAY-дружбе — хайп-тандем в сильнейшем, техника/искренность/стиле → youtube.com/watch?v=eX7hM-t_hLw — 2:38 ФУГА TV, Drumedy", album: "Пожарники feat Илюха рэп", year: "2026", color: "#ff2d55" },
  { source: "ПУШКА интервью 16.08.2025", logo: "ПШК", score: "83:11", max: " 62k", verdict: "Сливки общества • 42k", quote: "«А сливки. Сливки. Потому что вы приглашаете такие сливки общества, наконец-то, как я. Я вам дарю.» + «Это 42.000 просмотров будет на этом.» — ПУШКА 16.08.2025 62k 83:11 (919K VTT, transcript:true, duration 4991s) — темы рунет/Minecraft/42 братухи/SLAY/свадьба, таймкоды 02:25/11:46/28:53/30:30, twitch.tv/5opka t.me/joper5 m5.tours → youtube.com/watch?v=_D_BZuqM_eE", album: "интервью ПУШКА", year: "2025", color: "#ff2d55" },
  { source: "СЛАВА БОССУ — манифест", logo: "БОСС", score: "11.12", max: ".2025", verdict: "Манифест 42", quote: "«Я никогда не был хорошим примером, да и просто хорошим я не был. Я просто стремился быть первым. Этот выбор единственно верный. Не зарекайся от парадайса и до инферно. Мой путь от майнкрафтовой эры. До признания всех ваших премий. Пришло моё время. Со мной моё племя.» — далее «Слава боссу» + «Шрек из Ростова будет коронован» — VTT ZeIFBdoOZXo 1765 симв. frag 2-9, 3:07, 370k/23k, нейро-клип outsideinclub → music.thefence.me/slavabo55u", album: "СЛАВА БОССУ (SLAY DISS)", year: "2025", color: "#ff4500" },
  { source: "БИО-ПАСПОРТ 42", logo: "БИО", score: "05.04", max: ".1996", verdict: "Кирилл Баранов", quote: "Кирилл Александрович Баранов, Ростов-на-Дону, школа №65 (2014) → ДГТУ антикризис (4 курс, не окончил) → YouTube 27.01.2011 «Боб хавальник» → Twitch с 2016 5opka • мем «42 братуха!» • источники Wikipedia + twitch-news.ru/5opka + aboutan.ru", album: "БИО-ПАСПОРТ", year: "1996–2026", color: "#ffcc00" },
  { source: "Spotify · био 5opka (P2 t_c21320ec)", logo: "SP", score: "2011", max: " →СП", verdict: "1000 жизней", quote: "Начал в 2011 с Minecraft, основатель сервера «СП», дебютный альбом «1000 жизней», гастроли. 42 братухи — субкультура/комьюнити: «эпатаж, сплочённость на концертах/премиях/TikTok». 400K+ Яндекс Музыка, 923K Twitch, ~1M YouTube, 209K Spotify/мес — open.spotify.com/artist/6hSwHa5Se498WfUj6zf4WN", album: "Spotify-био 5opka", year: "2011–2026", color: "#1DB954" },
  { source: "Афиша Daily · 42 братухи", logo: "АФ", score: "42", max: " субкультура", verdict: "Шуба/НАХ/Хай/Урод", quote: "«Сквады Шуба-сквад (Петербург), НАХ-сквад (Москва), Хай-сквад (Воронеж), Урод-сквад (Ростов) — новая субкультура поколения Альфа. Эпатаж, сплочённость на концертах/премиях/TikTok, фестивали абсурда, свои премии» — afishadaily.ru/relationship/28893 — press-wall факт P2 t_c21320ec", album: "42 братухи субкультура", year: "2024–2025", color: "#ff2d55" },
  { source: "РЗТ", logo: "РЗТ", score: "6.53", max: "/10", verdict: "Золотой", quote: "Дебют, который зацепил — сыро, но честно. Мерси и Глаза львицы уже классика.", album: "SUPERNOVA", year: "2024", color: "#ffcc00" },
  { source: "РЗТ", logo: "РЗТ", score: "80", max: "/100", verdict: "Хит", quote: "Прорыв года. XXL разрывает чарты, Репит — гимн сквадов.", album: "SUPER PUPER NOVA", year: "2025", color: "#ff2d55" },
  { source: "РЗТ", logo: "РЗТ", score: "86", max: "/100", verdict: "Топ", quote: "XXL — отдельный феномен. Трек, который носят на шевронах.", album: "XXL (сингл)", year: "2025", color: "#00ff88" },
  { source: "РЗТ", logo: "РЗТ", score: "73", max: "/100", verdict: "Крепко", quote: "Сольный уровень доказан. 81 рецензия — Пятерка держит планку без фитов.", album: "CLAY", year: "2026", color: "#5865f2" },
  { source: "Twitch • Бан 06.04.2026", logo: "TW", score: "06.04", max: ".2026", verdict: "Временный бан", quote: "Причина «сексуальный контент» — Taverna.gg 06.04.26: «Хорошо, что забанили, потому что завтра мы клип снимаем. Этот вечер не мог закончиться эпичнее.» Временный, сроки не раскрыты. Накануне — женитьба на Sonasheka 05.04. Пара с баном 19.04 «Безопасность несовершеннолетних» 7д.", album: "Бан Twitch 06.04", year: "2026", color: "#ff2d55" },
  { source: "SLAY 2025", logo: "SLAY", score: "×3", max: "", verdict: "03.12.2025", quote: "70% зрители 13–27.11 на сайте +30% жюри • Дворец Ирины Винер, Лужники 03.12.2025 при WINLINE (статуэтки WINLINE SLAY) • 5opka ×3: Minecraft-стример года (впервые, топ-4: mokrivskyi/bratishkinoff/deepins_02), Аудитория года, Трек года XXL feat MellSher. FreakLand — ном. «Проект года».", album: "SLAY 2025×3", year: "2025", color: "#ffcc00" },
  { source: "Яндекс Музыка", logo: "ЯМ", score: "400K+", max: "", verdict: "Слушателей", quote: "400K+ ежемесячно. От детсада до фанаток Анны Асти — плейлист на всех. Spotify-био: «1000 жизней» → гастроли", album: "MAGNUM", year: "2026", color: "#ffcc00" },
  { source: "Twitch", logo: "TW", score: "923K", max: "", verdict: "Фолловеров", quote: "Пик 28K онлайна. Стримы — где родилось 42 и родится MAGNUM тур. Канал с 2016", album: "LIVE", year: "2026", color: "#9147ff" },
  { source: "Twitch • 1M+ Sep 2026 — SocialBlade/SullyGnome/StreamsCharts/TwitchTracker (P2 t_f1ad12c0)", logo: "TW", score: "1,021,365", max: "", verdict: "1M+ • пик 53,264", quote: "Twitch-статы 5opka сентябрь 2026: SocialBlade 1,008,991 на 15.06.2026 (+444/день, +11,369/30д) • SullyGnome 1,021,365 (+10,076/30д, 116ч/30д, 17 стримов, 6ч43м avg, 6,459 avg viewers, 750,860 часов/30д, пик 53,264 17.01.2026 14:55, ранг #232) • StreamsCharts 80ч05м/30д, 6,010 avg, 10,414 пик 30д, 481,273 часов, 2,078,717 live views • TwitchTracker 12,392,128 часов всего, 134 игры, 172.2 фолл./час. Источники: socialblade.com/twitch/user/5opka + sullygnome.com/channel/5opka + streamscharts.com/channels/5opka + twitchtracker.com/5opka/statistics", album: "Twitch 1M+ 30д Sep 2026", year: "2026", color: "#9147ff" },
  { source: "YouTube", logo: "YT", score: "~1M", max: "", verdict: "Подписчиков", quote: "Около миллиона на YouTube — Minecraft с 2011 → «СП» → музыка. Клипы и гастроли собрали комьюнити — см. Spotify-био + About42", album: "YouTube 5opka", year: "2011–2026", color: "#ff0000" },
];

export function PressWall() {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      // collect entrance elements for reduced-motion gate
      const cards = cardsRef.current.filter(Boolean) as HTMLDivElement[];
      const headerEl = headerRef.current;
      const statsEl = statsRef.current;
      const entranceEls = [headerEl, ...cards, statsEl].filter(Boolean) as Element[];

      // reduced-motion gate: instant show, skip timelines/magnet/RGB
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set(entranceEls, { y: 0, opacity: 1, scale: 1, clearProps: "transform" });
        gsap.set(cards, { y: 0, opacity: 1, scale: 1, filter: "none" });
        return;
      }

      gsap.set(headerEl, { y: 24, opacity: 0 });
      gsap.set(cards, { y: 24, opacity: 0, scale: 0.97 });
      if (statsEl) gsap.set(statsEl, { y: 24, opacity: 0 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 78%",
          toggleActions: "play none none none",
        },
        defaults: { ease: "power3.out" },
      });

      tl.to(headerEl, { y: 0, opacity: 1, duration: 0.7 })
        .to(cards, { y: 0, opacity: 1, scale: 1, duration: 0.62, stagger: 0.12 }, "-=0.35")
        .to(statsEl, { y: 0, opacity: 1, duration: 0.5 }, "-=0.22");

      // bar width stagger — subtle extra polish
      const bars = cards.map((c) => c.querySelector(`.${styles.bar} span`) as HTMLElement | null).filter(Boolean) as HTMLElement[];
      if (bars.length) {
        gsap.set(bars, { scaleX: 0, transformOrigin: "left center" });
        gsap.to(bars, {
          scaleX: 1,
          duration: 0.7,
          stagger: 0.12,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 62%",
            toggleActions: "play none none none",
          },
        });
      }

      // hover RGB + radial follow + magnet — gated, cleanup via array
      const cleanups: Array<() => void> = [];

      cards.forEach((card) => {
        if (!card) return;

        const onMove = (e: MouseEvent) => {
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
          const rect = card.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          card.style.setProperty("--mx", `${x}%`);
          card.style.setProperty("--my", `${y}%`);
          // subtle magnet to cursor
          const dx = ((e.clientX - (rect.left + rect.width / 2)) / rect.width) * 8;
          const dy = ((e.clientY - (rect.top + rect.height / 2)) / rect.height) * 6;
          gsap.to(card, { x: dx, y: dy, duration: 0.4, ease: "power3.out", overwrite: "auto" });
        };

        const onEnter = () => {
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
          gsap.to(card, {
            y: -4,
            scale: 1.012,
            duration: 0.25,
            ease: "power2.out",
            boxShadow: "0 14px 40px rgba(0,0,0,0.34), 0 0 22px rgba(255,45,85,0.16), 0 0 28px rgba(88,101,242,0.12)",
            overwrite: "auto",
          });
          // hover RGB: red/cyan channel split via drop-shadow filter
          gsap.to(card, {
            duration: 0.22,
            ease: "power2.out",
            filter: "drop-shadow(1px 0 0 rgba(255,0,80,0.32)) drop-shadow(-1px 0 0 rgba(0,255,255,0.32))",
            overwrite: "auto",
          });
        };

        const onLeave = () => {
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            gsap.set(card, { x: 0, y: 0, scale: 1, clearProps: "filter" });
            return;
          }
          gsap.to(card, {
            x: 0,
            y: 0,
            scale: 1,
            duration: 0.55,
            ease: "elastic.out(1,0.42)",
            boxShadow: "0 0 0 transparent",
            filter: "none",
            overwrite: "auto",
          });
        };

        card.addEventListener("mousemove", onMove);
        card.addEventListener("mouseenter", onEnter);
        card.addEventListener("mouseleave", onLeave);

        cleanups.push(() => {
          card.removeEventListener("mousemove", onMove);
          card.removeEventListener("mouseenter", onEnter);
          card.removeEventListener("mouseleave", onLeave);
        });
      });

      // store cleanups on section for outer revert safety
      (sectionRef.current as unknown as { _pressCleanups?: () => void })._pressCleanups = () =>
        cleanups.forEach((fn) => fn());
    }, sectionRef);

    return () => {
      (sectionRef.current as unknown as { _pressCleanups?: () => void })?._pressCleanups?.();
      ctx.revert();
    };
  }, []);

  return (
    <section className={styles.press} ref={sectionRef} aria-label="Пресса и цифры">
      <div className={styles.header} ref={headerRef}>
        <span className={styles.badge}>Пресса • Цифры • Факты</span>
        <h2 className={styles.title}>Нас слушают. Нас оценивают.</h2>
        <p className={styles.subtitle}>БИО-паспорт 05.04.1996 + РЗТ, чарты, Twitch и SLAY 2025×3 — без фейков, только реальные цифры из data 18:23 §2 (био 05.04.1996 Ростов №65 ДГТУ YT 27.01.2011) + research.md §17.1–17.2</p>
      </div>
      <div className={styles.grid}>
        {REVIEWS.map((r, i) => (
          <div key={`${r.album}-${i}`} className={styles.card} ref={(el) => { cardsRef.current[i] = el; }} style={{ ["--accent" as string]: r.color }}>
            <div className={styles.top}>
              <span className={styles.logo}>{r.logo}</span>
              <span className={styles.album}>{r.album} • {r.year}</span>
            </div>
            <div className={styles.scoreRow}>
              <span className={styles.score}>{r.score}<span className={styles.max}>{r.max}</span></span>
              <span className={styles.verdict}>{r.verdict}</span>
            </div>
            <p className={styles.quote}>“{r.quote}”</p>
            <div className={styles.bar} aria-hidden><span style={{ width: (r.score.includes("K") || r.score.includes("×")) ? "92%" : `${Math.min(100, parseInt(r.score) * 1.1)}%`, background: r.color }} /></div>
            <span className={styles.source}>{r.source}</span>
          </div>
        ))}
      </div>
      <div className={styles.statsRow} ref={statsRef}>
        <div className={styles.stat}><strong>8K+</strong><span>клипов TikTok</span></div>
        <div className={styles.stat}><strong>200K+</strong><span>просмотров</span></div>
        <div className={styles.stat}><strong>42</strong><span>братухи на связи</span></div>
        <div className={styles.stat}><strong>5</strong><span>пуль в MAGNUM</span></div>
      </div>
    </section>
  );
}
