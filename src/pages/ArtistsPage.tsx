import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./ArtistsPage.module.css";

gsap.registerPlugin(ScrollTrigger);

export function ArtistsPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.set(`.${styles.artistCard}`, { y: 60, opacity: 0 });
      gsap.to(`.${styles.artistCard}`, {
        y: 0,
        opacity: 1,
        stagger: 0.3,
        duration: 1,
        ease: "power3.out",
      });
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
        <div className={styles.artistCard}>
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
              Двукратный «Человек-мем года» на премии SLAY (2023, 2024). Сольный альбом <strong>CLAY</strong> (03.04.2026) — хип-хоп, 73 балла РЗТ, 81 рецензия. 
              Название CLAY = Clowns Laugh At You, пасхалка на 10 лет. Дебют — «1000 жизней» (фев 2024, 14 треков).
            </p>
            <div className={styles.facts}>
              <div className={styles.fact}><strong>Сервер «СП»</strong><span>Minecraft • сообщество с 2011</span></div>
              <div className={styles.fact}><strong>Премия SLAY</strong><span>Мем года 2023 и 2024</span></div>
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

        <div className={styles.artistCard}>
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
        <div className={styles.timelineMini}>
          <div className={styles.timelineMiniItem}><span>20.09.2024</span><strong>SUPERNOVA</strong><small>Мерси — главный хит</small></div>
          <div className={styles.timelineMiniItem}><span>25.07.2025</span><strong>SUPER PUPER NOVA</strong><small>80 • альбом месяца • XXL 86</small></div>
          <div className={styles.timelineMiniItem}><span>03.04.2026</span><strong>CLAY (соло 5opka)</strong><small>73 • 81 рецензия</small></div>
          <div className={styles.timelineMiniItem}><span>14.08.2026</span><strong>ТУСА МЕДУЗА + VPN</strong><small>синглы MAGNUM</small></div>
          <div className={styles.timelineMiniItem}><span>2026</span><strong>MAGNUM</strong><small>5 треков — 5 пуль • последний фит</small></div>
        </div>
        <div className={styles.duoLinks}>
          <a href="https://risazatvorchestvo.com/artist/5opka/reviews" target="_blank" rel="noreferrer">Все рецензии РЗТ →</a>
          <a href="https://www.albumoftheyear.org/album/1756160-5opka-clay.php" target="_blank" rel="noreferrer">Album of the Year →</a>
          <a href="/magnum/discography">Дискография →</a>
          <a href="/magnum/42">Движение 42 →</a>
        </div>
      </div>

      <div className={styles.media}>
        <h2>Где слушать и смотреть</h2>
        <div className={styles.mediaGrid}>
          <a href="https://music.yandex.ru/artist/7544304" target="_blank" rel="noreferrer" className={styles.mediaCard}><strong>Яндекс Музыка</strong><span>400K+ слушателей • 5opka</span></a>
          <a href="https://open.spotify.com/artist/6hSwHa5Se498WfUj6zf4WN" target="_blank" rel="noreferrer" className={styles.mediaCard}><strong>Spotify</strong><span>140–263K monthly listeners</span></a>
          <a href="https://www.deezer.com/ru/artist/67614242" target="_blank" rel="noreferrer" className={styles.mediaCard}><strong>Deezer</strong><span>5opka</span></a>
          <a href="https://music.amazon.com/artists/B07T2DVLP9/5opka" target="_blank" rel="noreferrer" className={styles.mediaCard}><strong>Amazon Music</strong><span>5opka</span></a>
          <a href="https://youtu.be/Mz69bLRpBEs" target="_blank" rel="noreferrer" className={styles.mediaCard}><strong>ТУСА МЕДУЗА • клип</strong><span>YouTube • ~200K • 8K TikTok</span></a>
          <a href="https://youtu.be/or8Xj5kC1Ho" target="_blank" rel="noreferrer" className={styles.mediaCard}><strong>VPN • клип</strong><span>YouTube</span></a>
        </div>
      </div>
    </div>
  );
}
