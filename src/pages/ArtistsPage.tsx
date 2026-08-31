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

      // Parallax on photos
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
        <div className={styles.badge}>Артисты</div>
        <h1>5opka & MellSher</h1>
        <p className={styles.subtitle}>
          Два друга из Ростова-на-Дону, которые создали музыкальный дуэт и
          покорили миллионы
        </p>
      </div>

      <div className={styles.artists}>
        <div className={styles.artistCard}>
          <div className={styles.photoWrap}>
            <img
              src="/magnum/images/artists/5opka.jpg"
              alt="5opka"
              className={styles.photo}
            />
            <div className={styles.photoGlow} />
          </div>
          <div className={styles.info}>
            <h2>5opka (Пятерка)</h2>
            <p className={styles.realName}>Кирилл Владимирович Баранов</p>
            <div className={styles.meta}>
              <span>🎂 5 апреля 1996</span>
              <span>📍 Ростов-на-Дону</span>
              <span>🎤 Рэп-исполнитель</span>
              <span>📹 Стример, блогер</span>
            </div>
            <p className={styles.bio}>
              Начал карьеру в 2011 году на YouTube с контента по Minecraft.
              Создатель сервера «СП» (Сервер Подписчиков). Основатель движения
              «42 братухи». Двукратный «Человек-мем года» на премии SLAY (2023,
              2024). Артист лейбла The Fence, продюсерский коллектив Drumedy.
            </p>
            <div className={styles.stats}>
              <div className={styles.statItem}>
                <strong>923K+</strong>
                <span>Twitch</span>
              </div>
              <div className={styles.statItem}>
                <strong>400K+</strong>
                <span>Яндекс Музыка</span>
              </div>
              <div className={styles.statItem}>
                <strong>263K</strong>
                <span>Spotify</span>
              </div>
              <div className={styles.statItem}>
                <strong>1.8M+</strong>
                <span>Стримы</span>
              </div>
            </div>
            <div className={styles.links}>
              <a href="https://5opka.ru/" target="_blank">Сайт</a>
              <a href="https://twitch.tv/5opka" target="_blank">Twitch</a>
              <a href="https://music.yandex.ru/artist/7544304" target="_blank">Яндекс Музыка</a>
              <a href="https://open.spotify.com/artist/6hSwHa5Se498WfUj6zf4WN" target="_blank">Spotify</a>
            </div>
          </div>
        </div>

        <div className={styles.artistCard}>
          <div className={styles.photoWrap}>
            <div className={styles.photoPlaceholder}>🎤</div>
          </div>
          <div className={styles.info}>
            <h2>MellSher</h2>
            <p className={styles.realName}>Игорь Николаевич Шерстюк</p>
            <div className={styles.meta}>
              <span>🎂 22 апреля 1996</span>
              <span>📍 Ростов-на-Дону</span>
              <span>🎤 Музыкант</span>
              <span>📹 Стример</span>
            </div>
            <p className={styles.bio}>
              «Всеми признанный король твича, любимый стример твоего любимого
              стримера». Готовит серьёзный сольный альбом. Решение о расколе
              дуэта связано с творческими разногласиями — разные стили музыки.
            </p>
            <div className={styles.stats}>
              <div className={styles.statItem}>
                <strong>136K+</strong>
                <span>Twitch</span>
              </div>
              <div className={styles.statItem}>
                <strong>192</strong>
                <span>Ср. онлайн</span>
              </div>
            </div>
            <div className={styles.links}>
              <a href="https://t.me/mellsher" target="_blank">Telegram</a>
              <a href="https://vk.com/mellshermuz" target="_blank">VK</a>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.duo}>
        <h2>Дуэт</h2>
        <p>
          5opka и MellSher — друзья из Ростова-на-Дону. Вместе создали альбомы
          SUPERNOVA (2024) и SUPER PUPER NOVA (2025). MAGNUM — их последний
          совместный альбом. После этого 5opka продолжает сольно, а MellSher
          готовит свой сольный проект.
        </p>
        <div className={styles.duoLinks}>
          <a href="https://risazatvorchestvo.com/artist/5opka" target="_blank">
            Рецензии на РЗТ →
          </a>
          <a href="https://www.albumoftheyear.org/album/1756160-5opka-clay.php" target="_blank">
            Album of the Year →
          </a>
        </div>
      </div>
    </div>
  );
}
