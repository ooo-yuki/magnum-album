import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./DiscographyPage.module.css";

gsap.registerPlugin(ScrollTrigger);

interface TrackItem {
  title: string;
  duration?: string;
  note?: string;
}

interface Album {
  name: string;
  year: string;
  artists: string;
  tracks: number;
  duration: string;
  rzScore: string;
  rzStatus: string;
  rzScoreKind: "gold" | "silver" | "hot" | "soon";
  cover: string;
  rzUrl: string;
  spotifyUrl?: string;
  yandexUrl?: string;
  bandlinkUrl?: string;
  tracklist: TrackItem[];
  description: string;
  reviewCount?: string;
  label?: string;
  genre?: string;
}

const ALBUMS: Album[] = [
  {
    name: "MAGNUM",
    year: "2026",
    artists: "5opka (feat. MellSher → MlSh)",
    tracks: 5,
    duration: "~12 мин",
    rzScore: "Скоро",
    rzStatus: "Последний совместный альбом",
    rzScoreKind: "soon",
    cover: "/magnum/images/tusa-meduza.jpg",
    rzUrl: "https://risazatvorchestvo.com/artist/5opka",
    bandlinkUrl: "https://music.thefence.me/psmagnum",
    yandexUrl: "https://music.yandex.ru/artist/7544304",
    genre: "Мультижанровый • The Fence / Drumedy",
    tracklist: [
      { title: "ТУСА МЕДУЗА", duration: "2:07", note: "feat. MellSher, Вова Солодков — сингл 14.08.2026" },
      { title: "VPN", duration: "2:23", note: "feat. MellSher" },
      { title: "Трек 3", note: "анонс" },
      { title: "Трек 4", note: "анонс" },
      { title: "Трек 5", note: "анонс" },
    ],
    description:
      "Мультижанровый манифест: от детского сада до фанаток Анны Асти 50+. Название — отсылка к пистолету Magnum с 3D-принтера: 5 огромных пуль = 5 треков. Последний совместный релиз перед сольными путями.",
    label: "The Fence",
  },
  {
    name: "CLAY",
    year: "03.04.2026",
    artists: "5opka (соло)",
    tracks: 5,
    duration: "~14 мин",
    rzScore: "73",
    rzStatus: "Участник сезона Весна 26",
    rzScoreKind: "hot",
    cover: "/magnum/images/covers/clay.jpg",
    rzUrl: "https://risazatvorchestvo.com/album/clay",
    yandexUrl: "https://music.yandex.ru/artist/7544304",
    bandlinkUrl: "https://music.thefence.me/5opkaclay",
    spotifyUrl: "https://open.spotify.com/artist/6hSwHa5Se498WfUj6zf4WN",
    genre: "Хип-хоп • Drumedy / The Fence",
    reviewCount: "81 рецензия",
    label: "The Fence",
    tracklist: [
      { title: "СЛАВА БОССУ", note: "марш 42 братух" },
      { title: "Дай мне всё" },
      { title: "Слишком много ставок" },
      { title: "Пожарники", note: "feat. илюха реп / Мазеллов" },
      { title: "Ебанутый", note: "манифест" },
    ],
    description:
      "CLAY = Clowns Laugh At You — «Клоуны Смеются Над Тобой». Пасхалка, которую Кирилл прятал в конце видео 10 лет. CLAY отличается от SLAY на одну букву и пропитан историей премии SLAY. Продюсер — Drumedy: «шестой релиз Кирилла полностью спродюсированный нашей командой».",
  },
  {
    name: "SUPER PUPER NOVA",
    year: "25.07.2025",
    artists: "5opka & MellSher",
    tracks: 5,
    duration: "12:23",
    rzScore: "80",
    rzStatus: "Альбом месяца • июль 2025",
    rzScoreKind: "gold",
    cover: "/magnum/images/covers/repit.jpg",
    rzUrl: "https://risazatvorchestvo.com/album/super-puper-nova",
    spotifyUrl: "https://open.spotify.com/album/4dTPMq2ac765VCUlGYuXsF",
    yandexUrl: "https://music.yandex.ru/artist/7544304",
    genre: "Поп • The Fence",
    reviewCount: "Альбом месяца РЗТ",
    label: "The Fence",
    tracklist: [
      { title: "Танцуй" },
      { title: "Тонированный жигуль", note: "сингл" },
      { title: "Кис-кис", note: "сингл" },
      { title: "XXL", note: "86 баллов на РЗТ — хит июля, один из самых высоких треков в истории РЗТ" },
      { title: "Репит" },
    ],
    description:
      "Трек XXL — 86 баллов на РЗТ, хит июля. Синглы «Тонированный жигуль», «Кис-кис», «XXL» выходили по одному перед релизом. Взлёт дуэта как поп-эксперимента после SUPERNOVA.",
  },
  {
    name: "SUPERNOVA",
    year: "20.09.2024",
    artists: "MellSher & 5opka",
    tracks: 5,
    duration: "~14 мин",
    rzScore: "6.53",
    rzStatus: "Золотой альбом",
    rzScoreKind: "silver",
    cover: "/magnum/images/covers/vpn.jpg",
    rzUrl: "https://risazatvorchestvo.com/album/supernova",
    spotifyUrl: "https://open.spotify.com/album/4dTPMq2ac765VCUlGYuXsF",
    genre: "Поп • The Fence",
    reviewCount: "9+ страниц рецензий",
    tracklist: [
      { title: "Мерси", duration: "2:26", note: "главный хит" },
      { title: "Лонг Айленд", duration: "3:09", note: "для машины" },
      { title: "Клеопатра", duration: "2:37" },
      { title: "Пятнистый ягуар", duration: "2:16" },
      { title: "Глаза львицы", duration: "3:04" },
    ],
    description:
      "Первый поп-эксперимент дуэта. Смешанные отзывы: хвалят за попытку нового жанра, критикуют за отсутствие индивидуальности. «Мерси» — главный хит, «Лонг Айленд» — для прослушивания в машине.",
  },
];

const OTHER_RELEASES = [
  { name: "1000 жизней", year: "Фев 2024", detail: "Дебютный альбом • 14 треков" },
  { name: "Головоломка", year: "Окт 2024", detail: "EP • 5 треков" },
  { name: "+1up", year: "14.03.2025", detail: "EP" },
  { name: "Вредные советы", year: "—", detail: "Альбом" },
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
        stagger: 0.18,
        duration: 0.8,
        ease: "power2.out",
        scrollTrigger: {
          trigger: `.${styles.albums}`,
          start: "top 80%",
        },
      });

      // breathing glow pulse on gold/hot score badges
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.to(`.${styles.gold}`, {
          boxShadow: "0 0 22px rgba(255,204,0,0.55), 0 0 44px rgba(255,204,0,0.2)",
          duration: 1.5,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          delay: 0.5,
          scrollTrigger: {
            trigger: `.${styles.albums}`,
            start: "top 80%",
            toggleActions: "play pause resume pause",
          },
        });
        gsap.to(`.${styles.hot}`, {
          boxShadow: "0 0 22px rgba(255,45,85,0.55), 0 0 44px rgba(255,45,85,0.2)",
          duration: 1.5,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          delay: 0.8,
          scrollTrigger: {
            trigger: `.${styles.albums}`,
            start: "top 80%",
            toggleActions: "play pause resume pause",
          },
        });
      }
      // shimmer sweep on album cover overlays
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const container = containerRef.current;
        if (container) {
          const shines = container.querySelectorAll(`.${styles.coverShine}`);
          shines.forEach((shine) => {
            const shimmerTl = gsap.timeline({
              repeat: -1,
              delay: 2 + Math.random() * 2,
              scrollTrigger: {
                trigger: shine,
                start: "top 85%",
                toggleActions: "play pause resume pause",
              },
            });
            shimmerTl.fromTo(
              shine,
              { backgroundPosition: "-200% 0" },
              { backgroundPosition: "200% 0", duration: 1.4, ease: "power2.inOut" },
            );
            shimmerTl.to({}, { duration: 4 + Math.random() * 2 }); // pause between sweeps
          });
        }
      }
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <div className={styles.page} ref={containerRef}>
      <div className={styles.header}>
        <div className={styles.badge}>Дискография • 4 релиза + MAGNUM</div>
        <h1>Альбомы 5opka</h1>
        <p className={styles.subtitle}>
          От дебютного «1000 жизней» до MAGNUM — путь через РЗТ, SLAY и 42. Все оценки — реальные баллы РЗТ (risazatvorchestvo.com).
        </p>
        <div className={styles.rztLegend}>
          <span className={styles.legendItem}><i className={styles.dotGold} /> 80 = Альбом месяца</span>
          <span className={styles.legendItem}><i className={styles.dotHot} /> 73 = Весна 26</span>
          <span className={styles.legendItem}><i className={styles.dotSilver} /> 6.53 = Золотой</span>
        </div>
      </div>

      <div className={styles.albums}>
        {ALBUMS.map((album) => (
          <div key={album.name} className={styles.albumCard}>
            <div className={styles.albumCover}>
              <img src={album.cover} alt={album.name} loading="lazy" decoding="async" width={400} height={400} />
              <div className={`${styles.scoreBadge} ${styles[album.rzScoreKind]}`}>
                <span className={styles.scoreNumber}>{album.rzScore}</span>
                <span className={styles.scoreLabel}>РЗТ</span>
              </div>
              <div className={styles.coverShine} />
            </div>

            <div className={styles.albumInfo}>
              <div className={styles.albumYear}>{album.year} • {album.genre}</div>
              <h2>{album.name}</h2>
              <p className={styles.albumArtists}>{album.artists} • {album.label ?? "The Fence"}</p>
              <p className={styles.albumMeta}>
                {album.tracks} треков • {album.duration} {album.reviewCount ? `• ${album.reviewCount}` : ""}
              </p>
              <p className={styles.albumStatus}>{album.rzStatus}</p>
              <p className={styles.albumDesc}>{album.description}</p>

              <div className={styles.tracklist}>
                <h3>Треклист</h3>
                <ol>
                  {album.tracklist.map((t) => (
                    <li key={t.title} className={styles.trackRow}>
                      <span className={styles.trackTitle}>{t.title}</span>
                      <span className={styles.trackMeta}>
                        {t.duration && <em>{t.duration}</em>}
                        {t.note && <span>{t.note}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              {album.spotifyUrl && (
                <div className={styles.player}>
                  <iframe
                    src={`https://open.spotify.com/embed/album/${album.spotifyUrl.split("/").pop()?.split("?")[0]}?utm_source=generator`}
                    width="100%"
                    height="152"
                    frameBorder="0"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    title={`${album.name} player`}
                  />
                </div>
              )}

              <div className={styles.albumLinks}>
                <a href={album.rzUrl} target="_blank" rel="noreferrer" className={styles.linkBtn}>
                  РЗТ → {album.rzScore} баллов
                </a>
                {album.spotifyUrl && (
                  <a href={album.spotifyUrl} target="_blank" rel="noreferrer" className={styles.linkBtnGhost}>
                    Spotify →
                  </a>
                )}
                {album.yandexUrl && (
                  <a href={album.yandexUrl} target="_blank" rel="noreferrer" className={styles.linkBtnGhost}>
                    Яндекс Музыка →
                  </a>
                )}
                {album.bandlinkUrl && (
                  <a href={album.bandlinkUrl} target="_blank" rel="noreferrer" className={styles.linkBtnGhost}>
                    Слушать везде →
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.other}>
        <h2>Другие релизы</h2>
        <p className={styles.otherSub}>Из research.md — без выдумок, указаны только подтверждённые релизы</p>
        <div className={styles.otherGrid}>
          {OTHER_RELEASES.map((r) => (
            <div key={r.name} className={styles.otherCard}>
              <strong>{r.name}</strong>
              <span>{r.year}</span>
              <p>{r.detail}</p>
            </div>
          ))}
        </div>
        <div className={styles.otherLinks}>
          <a href="https://risazatvorchestvo.com/artist/5opka/reviews" target="_blank" rel="noreferrer">Все рецензии РЗТ →</a>
          <a href="https://www.albumoftheyear.org/album/1756160-5opka-clay.php" target="_blank" rel="noreferrer">Album of the Year (CLAY) →</a>
          <a href="https://music.yandex.ru/artist/7544304" target="_blank" rel="noreferrer">Яндекс Музыка →</a>
          <a href="https://open.spotify.com/artist/6hSwHa5Se498WfUj6zf4WN" target="_blank" rel="noreferrer">Spotify →</a>
        </div>
      </div>

      <div className={styles.presave}>
        <h2>Пресейв MAGNUM</h2>
        <p>Последний совместный альбом — уже на площадках. 5 треков = 5 пуль.</p>
        <div className={styles.presaveBtns}>
          <a href="https://music.thefence.me/psmagnum" target="_blank" rel="noreferrer" className={styles.presaveBtn}>
            Пресейв на всех площадках →
          </a>
          <a href="https://music.yandex.ru/artist/7544304" target="_blank" rel="noreferrer" className={styles.presaveBtnGhost}>
            Яндекс Музыка
          </a>
        </div>
      </div>
    </div>
  );
}
