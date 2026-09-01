import { useRef, useEffect, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./ArtistsPage.module.css";

gsap.registerPlugin(ScrollTrigger);

export function ArtistsPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);

  // ── GSAP entrance y24 stagger 0.12 • reduced-motion • context cleanup
  useEffect(() => {
    if (!containerRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (prefersReduced) {
        gsap.set(`.${styles.header} > *`, { y: 0, opacity: 1, clearProps: "transform" });
        gsap.set(`.${styles.artistCard}`, { y: 0, opacity: 1, clearProps: "transform" });
        return;
      }
      gsap.set(`.${styles.header} > *`, { y: 24, opacity: 0 });
      gsap.to(`.${styles.header} > *`, { y: 0, opacity: 1, stagger: 0.12, duration: 0.55, ease: "power2.out", delay: 0.05 });

      gsap.set(`.${styles.artistCard}`, { y: 24, opacity: 0 });
      gsap.to(`.${styles.artistCard}`, { y: 0, opacity: 1, stagger: 0.12, duration: 0.55, ease: "power2.out", delay: 0.28 });

      // parallax photo — respect reduced-motion already gated
      gsap.to(`.${styles.photo}`, {
        yPercent: -10,
        scrollTrigger: {
          trigger: `.${styles.artists}`,
          start: "top bottom",
          end: "bottom top",
          scrub: 1,
        },
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  // timelineMini items stagger on scroll
  useEffect(() => {
    if (!timelineRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      gsap.set(timelineRef.current.querySelectorAll(`.${styles.timelineMiniItem}`), { y: 0, opacity: 1, clearProps: "transform" });
      return;
    }
    const ctx = gsap.context(() => {
      const items = timelineRef.current!.querySelectorAll(`.${styles.timelineMiniItem}`);
      gsap.set(items, { y: 24, opacity: 0 });
      gsap.to(items, {
        y: 0,
        opacity: 1,
        stagger: 0.12,
        duration: 0.5,
        ease: "power2.out",
        scrollTrigger: { trigger: timelineRef.current, start: "top 85%", toggleActions: "play none none none" },
      });
    }, timelineRef);
    return () => ctx.revert();
  }, []);

  // media cards stagger on scroll
  useEffect(() => {
    if (!mediaRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      gsap.set(mediaRef.current.querySelectorAll(`.${styles.mediaCard}`), { y: 0, opacity: 1, clearProps: "transform" });
      return;
    }
    const ctx = gsap.context(() => {
      const cards = mediaRef.current!.querySelectorAll(`.${styles.mediaCard}`);
      gsap.set(cards, { y: 24, opacity: 0 });
      gsap.to(cards, {
        y: 0,
        opacity: 1,
        stagger: 0.12,
        duration: 0.5,
        ease: "power2.out",
        scrollTrigger: { trigger: mediaRef.current, start: "top 85%", toggleActions: "play none none none" },
      });
    }, mediaRef);
    return () => ctx.revert();
  }, []);

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
    gsap.to(e.currentTarget, {
      y: 0,
      boxShadow: "0 0 0 transparent",
      borderColor: "rgba(255,255,255,0.06)",
      duration: 0.35,
      ease: "power2.out",
      overwrite: true,
    });
  }, []);

  return (
    <div className={styles.page} ref={containerRef}>
      <div className={styles.header}>
        <div className={styles.badge}>Артисты • Ростов-на-Дону → Москва</div>
        <h1>5opka & MellSher</h1>
        <p className={styles.subtitle}>
          Два друга из Ростова-на-Дону, которые с 2011 прошли путь от Minecraft до РЗТ, SLAY и MAGNUM
        </p>
      </div>

      <div className={styles.artists}>
        <div className={styles.artistCard} onMouseEnter={onCardEnter} onMouseLeave={onCardLeave}>
          <div className={styles.photoWrap}>
            <img src="/magnum/images/artists/5opka.jpg" alt="5opka — Кирилл Баранов" className={styles.photo} loading="lazy" decoding="async" width={385} height={385} />
            <div className={styles.photoGlow} />
            <div className={styles.photoCaption}>Фото: 5opka / The Fence</div>
          </div>
          <div className={styles.info}>
            <h2>5opka (Пятерка)</h2>
            <p className={styles.realName}>Кирилл Владимирович Баранов • 5 апреля 1996 • Ростов-на-Дону</p>
            <div className={styles.meta}>
              <span>🎤 Рэп-исполнитель</span>
              <span>📹 Стример / блогер</span>
              <span>🏷️ Лейбл The Fence</span>
              <span>🥁 Продюсер Drumedy</span>
            </div>
            <p className={styles.bio}>
              Начал в 2011 на YouTube с Minecraft. Создал сервер «СП» (Сервер Подписчиков). Основатель движения «42 братухи». 
              Двукратный «Человек-мем года» на премии SLAY (2023, 2024) + 3 награды SLAY 2025 03.12.2025: Аудитория года, Minecraft-стример года, Трек года XXL feat MellSher. Сольный альбом <strong>CLAY</strong> (03.04.2026) — хип-хоп, 73 балла РЗТ, 81 рецензия. 
              Название CLAY = Clowns Laugh At You, пасхалка на 10 лет. Дебют — «1000 жизней» (фев 2024, 14 треков).
            </p>
            <div className={styles.facts}>
              <div className={styles.fact}><strong>Сервер «СП»</strong><span>Minecraft • сообщество с 2011</span></div>
              <div className={styles.fact}><strong>Премия SLAY</strong><span>Мем года 2023 и 2024</span></div>
              <div className={styles.fact}><strong>SLAY 2025×3</strong><span>03.12.2025 — Аудитория, Minecraft, XXL</span></div>
              <div className={styles.fact}><strong>42 братухи</strong><span>Основатель, «босс» движения</span></div>
              <div className={styles.fact}><strong>Коллабы</strong><span>илюха реп, Мазеллов, 6055, MellSher</span></div>
            </div>
            <blockquote className={styles.quote}>
              «TLDR: мультижанровый альбом — от детского сада до фанаток Анны Асти 50+. Каждый трек создан чтобы попасть в плейлист каждого.»
              <cite>— 5opka о MAGNUM</cite>
            </blockquote>
            <div className={styles.stats}>
              <div className={styles.statItem}><strong>923K+</strong><span>Twitch</span></div>
              <div className={styles.statItem}><strong>~1M</strong><span>YouTube</span></div>
              <div className={styles.statItem}><strong>400K+</strong><span>Яндекс Музыка / мес</span></div>
              <div className={styles.statItem}><strong>263K</strong><span>Spotify / мес</span></div>
              <div className={styles.statItem}><strong>1.8M+</strong><span>Стримы (Chartmetric)</span></div>
              <div className={styles.statItem}><strong>117K</strong><span>YouTube subs (Chartmetric)</span></div>
            </div>
            <div className={styles.links}>
              <a href="https://5opka.ru/" target="_blank" rel="noreferrer">Сайт 5opka.ru →</a>
              <a href="https://twitch.tv/5opka" target="_blank" rel="noreferrer">Twitch →</a>
              <a href="https://youtube.com/@5opka" target="_blank" rel="noreferrer">YouTube →</a>
              <a href="https://vk.com/5opka" target="_blank" rel="noreferrer">VK →</a>
              <a href="https://music.yandex.ru/artist/7544304" target="_blank" rel="noreferrer">Яндекс Музыка →</a>
              <a href="https://open.spotify.com/artist/6hSwHa5Se498WfUj6zf4WN" target="_blank" rel="noreferrer">Spotify →</a>
              <a href="https://www.deezer.com/ru/artist/67614242" target="_blank" rel="noreferrer">Deezer →</a>
              <a href="https://risazatvorchestvo.com/artist/5opka" target="_blank" rel="noreferrer">РЗТ →</a>
            </div>
          </div>
        </div>

        <div className={styles.artistCard} onMouseEnter={onCardEnter} onMouseLeave={onCardLeave}>
          <div className={styles.photoWrap}>
            <div className={styles.photoPlaceholder}>
              <span>🎙️</span>
              <small>MellSher • фото из VK/Telegram</small>
            </div>
            <div className={styles.photoGlow} />
          </div>
          <div className={styles.info}>
            <h2>MellSher</h2>
            <p className={styles.realName}>Игорь Николаевич Шерстюк • 22 апреля 1996 • Ростов-на-Дону</p>
            <div className={styles.meta}>
              <span>🎤 Музыкант</span>
              <span>📹 Стример • «король твича»</span>
              <span>🎵 Поп</span>
            </div>
            <p className={styles.bio}>
              «Всеми признанный король твича, любимый стример твоего любимого стримера». Друг Кирилла с Ростова. Вместе — альбомы{" "}
              <strong>SUPERNOVA</strong> (20.09.2024, 6.53 золотой) и <strong>SUPER PUPER NOVA</strong> (25.07.2025, 80 — альбом месяца) . Хит «XXL» — 86 баллов РЗТ, один из самых высоких треков сайта.
              Второй сингл MAGNUM — «VPN» (2:23, поп). Готовит серьёзный сольный альбом — разные стили стали причиной мягкого раскола дуэта.
            </p>
            <div className={styles.facts}>
              <div className={styles.fact}><strong>Дуэт с 2024</strong><span>2 совместных EP по 5 треков</span></div>
              <div className={styles.fact}><strong>Хит XXL</strong><span>86 баллов РЗТ</span></div>
              <div className={styles.fact}><strong>VPN</strong><span>Второй сингл MAGNUM</span></div>
              <div className={styles.fact}><strong>Соло далее</strong><span>Сольный альбом в работе</span></div>
            </div>
            <blockquote className={styles.quote}>
              «Между нами VPN на запястье» — метафора закрытой связи между людьми. Один из последних совместных треков перед соло-путями.
              <cite>— про трек VPN</cite>
            </blockquote>
            <div className={styles.stats}>
              <div className={styles.statItem}><strong>136K+</strong><span>Twitch</span></div>
              <div className={styles.statItem}><strong>~192</strong><span>Ср. онлайн</span></div>
              <div className={styles.statItem}><strong>5</strong><span>Треков в SUPERNOVA</span></div>
              <div className={styles.statItem}><strong>2</strong><span>Совместных альбома</span></div>
            </div>
            <div className={styles.links}>
              <a href="https://t.me/mellsher" target="_blank" rel="noreferrer">Telegram @mellsher →</a>
              <a href="https://vk.com/mellshermuz" target="_blank" rel="noreferrer">VK →</a>
              <a href="https://streamersbase.ru/streamers/mellsher" target="_blank" rel="noreferrer">StreamersBase →</a>
              <a href="https://www.deezer.com/ru/album/1053805132" target="_blank" rel="noreferrer">Deezer →</a>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.duo}>
        <h2>Дуэт • Драма • Соло</h2>
        <p>
          5opka и MellSher — друзья-ровесники (оба — апрель 1996, Ростов). Вместе взорвали РЗТ поп-экспериментами, а MAGNUM — их последний совместный альбом. 
          Дальше — сольные пути: Кирилл как хип-хоп (CLAY, 73), Игорь как серьёзный поп-артист. Все старые фиты останутся на площадках, новые подпишутся как <strong>MlSh</strong>.
        </p>
        <div className={styles.timelineMini} ref={timelineRef}>
          <div className={styles.timelineMiniItem} onMouseEnter={onCardEnter} onMouseLeave={onCardLeave}><span>20.09.2024</span><strong>SUPERNOVA</strong><small>Мерси — главный хит</small></div>
          <div className={styles.timelineMiniItem} onMouseEnter={onCardEnter} onMouseLeave={onCardLeave}><span>25.07.2025</span><strong>SUPER PUPER NOVA</strong><small>80 • альбом месяца • XXL 86</small></div>
          <div className={styles.timelineMiniItem} onMouseEnter={onCardEnter} onMouseLeave={onCardLeave}><span>03.04.2026</span><strong>CLAY (соло 5opka)</strong><small>73 • 81 рецензия</small></div>
          <div className={styles.timelineMiniItem} onMouseEnter={onCardEnter} onMouseLeave={onCardLeave}><span>14.08.2026</span><strong>ТУСА МЕДУЗА + VPN</strong><small>синглы MAGNUM</small></div>
          <div className={styles.timelineMiniItem} onMouseEnter={onCardEnter} onMouseLeave={onCardLeave}><span>2026</span><strong>MAGNUM</strong><small>5 треков — 5 пуль • последний фит</small></div>
        </div>
        <div className={styles.duoLinks}>
          <a href="https://risazatvorchestvo.com/artist/5opka/reviews" target="_blank" rel="noreferrer">Все рецензии РЗТ →</a>
          <a href="https://www.albumoftheyear.org/album/1756160-5opka-clay.php" target="_blank" rel="noreferrer">Album of the Year →</a>
          <a href="/magnum/discography">Дискография →</a>
          <a href="/magnum/42">Движение 42 →</a>
        </div>
      </div>

      <div className={styles.media} ref={mediaRef}>
        <h2>Где слушать и смотреть</h2>
        <div className={styles.mediaGrid}>
          <a href="https://music.yandex.ru/artist/7544304" target="_blank" rel="noreferrer" className={styles.mediaCard} onMouseEnter={onCardEnter as never} onMouseLeave={onCardLeave as never}><strong>Яндекс Музыка</strong><span>400K+ слушателей • 5opka</span></a>
          <a href="https://open.spotify.com/artist/6hSwHa5Se498WfUj6zf4WN" target="_blank" rel="noreferrer" className={styles.mediaCard} onMouseEnter={onCardEnter as never} onMouseLeave={onCardLeave as never}><strong>Spotify</strong><span>140–263K monthly listeners</span></a>
          <a href="https://www.deezer.com/ru/artist/67614242" target="_blank" rel="noreferrer" className={styles.mediaCard} onMouseEnter={onCardEnter as never} onMouseLeave={onCardLeave as never}><strong>Deezer</strong><span>5opka</span></a>
          <a href="https://music.amazon.com/artists/B07T2DVLP9/5opka" target="_blank" rel="noreferrer" className={styles.mediaCard} onMouseEnter={onCardEnter as never} onMouseLeave={onCardLeave as never}><strong>Amazon Music</strong><span>5opka</span></a>
          <a href="https://youtu.be/Mz69bLRpBEs" target="_blank" rel="noreferrer" className={styles.mediaCard} onMouseEnter={onCardEnter as never} onMouseLeave={onCardLeave as never}><strong>ТУСА МЕДУЗА • клип</strong><span>YouTube • ~200K • 8K TikTok</span></a>
          <a href="https://youtu.be/or8Xj5kC1Ho" target="_blank" rel="noreferrer" className={styles.mediaCard} onMouseEnter={onCardEnter as never} onMouseLeave={onCardLeave as never}><strong>VPN • клип</strong><span>YouTube</span></a>
        </div>
      </div>
    </div>
  );
}
