import { Link } from "react-router-dom";
import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./DiscographyPage.module.css";

gsap.registerPlugin(ScrollTrigger);

interface Album {
  name: string;
  year: string;
  artists: string;
  tracks: number;
  duration: string;
  rzScore: string;
  rzStatus: string;
  cover: string;
  rzUrl: string;
  tracklist: string[];
  description: string;
}

const ALBUMS: Album[] = [
  {
    name: "MAGNUM",
    year: "2026",
    artists: "5opka (feat. MellSher)",
    tracks: 5,
    duration: "~12 мин",
    rzScore: "Скоро",
    rzStatus: "Новый альбом",
    cover: "/magnum/images/tusa-meduza.jpg",
    rzUrl: "https://risazatvorchestvo.com/artist/5opka",
    tracklist: ["ТУСА МЕДУЗА (feat. MellSher, Вова Солодков)", "VPN (feat. MellSher)", "...и ещё 3 трека"],
    description:
      'Последний совместный альбом. 5 ебанутых треков, которые снесут башню. Название отсылает к пистолету Magnum с 3D-принтера — 5 огромных пуль = 5 треков.',
  },
  {
    name: "CLAY",
    year: "Апрель 2026",
    artists: "5opka (соло)",
    tracks: 5,
    duration: "~14 мин",
    rzScore: "73",
    rzStatus: "Участник сезона Весна 26",
    cover: "/magnum/images/covers/clay.jpg",
    rzUrl: "https://risazatvorchestvo.com/album/clay",
    tracklist: ["СЛАВА БОССУ", "Дай мне всё", "Слишком много ставок", "Пожарники (feat. илюха реп / Мазеллов)", "Ебанутый"],
    description:
      'Clowns Laugh At You — «Клоуны Смеются Над Тобой». Пасхалка, которую Кирилл прятал в конце видео 10 лет. Пропитан историей участия в премии SLAY. Название CLAY отличается от SLAY на одну букву.',
  },
  {
    name: "SUPER PUPER NOVA",
    year: "Июль 2025",
    artists: "5opka & MellSher",
    tracks: 5,
    duration: "12:23",
    rzScore: "80",
    rzStatus: "Альбом месяца (июль 2025)",
    cover: "/magnum/images/covers/repit.jpg",
    rzUrl: "https://risazatvorchestvo.com/album/super-puper-nova",
    tracklist: ["Танцуй", "Тонированный жигуль", "Кис-кис", "XXL", "Репит"],
    description:
      'Трек XXL получил 86 баллов на РЗТ — один из самых высокооценённых треков в истории сайта. Альбом месяца на РЗТ. Синглы выходили по одному перед релизом.',
  },
  {
    name: "SUPERNOVA",
    year: "Сентябрь 2024",
    artists: "MellSher & 5opka",
    tracks: 5,
    duration: "~14 мин",
    rzScore: "6.53",
    rzStatus: "Золотой альбом",
    cover: "/magnum/images/covers/vpn.jpg",
    rzUrl: "https://risazatvorchestvo.com/album/supernova",
    tracklist: ["Мерси", "Лонг Айленд", "Клеопатра", "Пятнистый ягуар", "Глаза львицы"],
    description:
      'Поп-эксперимент дуэта. «Мерси» — главный хит альбома. Смешанные отзывы: хвалят за попытку нового жанра, критикуют за отсутствие индивидуальности.',
  },
];

export function DiscographyPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      gsap.set(`.${styles.header} > *`, { y: 20, opacity: 0 });
      gsap.to(`.${styles.header} > *`, {
        y: 0,
        opacity: 1,
        stagger: 0.1,
        duration: 0.6,
      });

      gsap.set(`.${styles.albumCard}`, { y: 60, opacity: 0 });
      gsap.to(`.${styles.albumCard}`, {
        y: 0,
        opacity: 1,
        stagger: 0.2,
        duration: 0.8,
        ease: "power2.out",
        scrollTrigger: {
          trigger: `.${styles.albums}`,
          start: "top 80%",
        },
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className={styles.page} ref={containerRef}>
      <div className={styles.header}>
        <div className={styles.badge}>Дискография</div>
        <h1>Альбомы 5opka</h1>
        <p className={styles.subtitle}>
          От дебютного «1000 жизней» до MAGNUM — путь через хайп, РЗТ и SLAY
        </p>
      </div>

      <div className={styles.albums}>
        {ALBUMS.map((album) => (
          <div key={album.name} className={styles.albumCard}>
            <div className={styles.albumCover}>
              <img src={album.cover} alt={album.name} />
              <div className={styles.scoreBadge}>
                <span className={styles.scoreNumber}>{album.rzScore}</span>
                <span className={styles.scoreLabel}>РЗТ</span>
              </div>
            </div>
            <div className={styles.albumInfo}>
              <div className={styles.albumYear}>{album.year}</div>
              <h2>{album.name}</h2>
              <p className={styles.albumArtists}>{album.artists}</p>
              <p className={styles.albumMeta}>
                {album.tracks} треков • {album.duration}
              </p>
              <p className={styles.albumStatus}>{album.rzStatus}</p>
              <p className={styles.albumDesc}>{album.description}</p>
              <div className={styles.tracklist}>
                <h3>Треклист</h3>
                <ol>
                  {album.tracklist.map((track) => (
                    <li key={track}>{track}</li>
                  ))}
                </ol>
              </div>
              <div className={styles.albumLinks}>
                <a href={album.rzUrl} target="_blank" className={styles.linkBtn}>
                  РЗТ →
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.presave}>
        <h2>Пресейв MAGNUM</h2>
        <p>Новый альбом уже на площадках</p>
        <a
          href="https://music.thefence.me/psmagnum"
          target="_blank"
          className={styles.presaveBtn}
        >
          Пресейв на всех площадках →
        </a>
      </div>
    </div>
  );
}
