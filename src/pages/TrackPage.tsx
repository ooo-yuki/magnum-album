import { useParams, Link } from "react-router-dom";
import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./TrackPage.module.css";

gsap.registerPlugin(ScrollTrigger);

interface TrackData {
  slug: string;
  name: string;
  artists: string;
  cover: string;
  releaseDate: string;
  genre: string;
  duration: string;
  label: string;
  description: string;
  stats: { label: string; value: string }[];
  videoUrl: string;
  rzUrl?: string;
}

const TRACKS: Record<string, TrackData> = {
  "tusa-meduza": {
    slug: "tusa-meduza",
    name: "ТУСА МЕДУЗА",
    artists: "5opka, MellSher, Вова Солодков",
    cover: "/magnum/images/tusa-meduza.jpg",
    releaseDate: "14 августа 2026",
    genre: "Русский рэп / Поп",
    duration: "2:07",
    label: "The Fence",
    description:
      'Первый сингл из альбома MAGNUM. Трек стал трендом в TikTok — почти 8K клипов с песней. Клип набрал ~200K просмотров. Песня про вечеринку и танец медузы — новый сэк, который затмил все прошлые тусовки.',
    stats: [
      { label: "Клипов в TikTok", value: "~8K" },
      { label: "Просмотров клипа", value: "~200K" },
      { label: "В чартах", value: "✓" },
    ],
    videoUrl: "https://youtu.be/Mz69bLRpBEs",
  },
  vpn: {
    slug: "vpn",
    name: "VPN",
    artists: "5opka, MellSher",
    cover: "/magnum/images/covers/vpn.jpg",
    releaseDate: "2026",
    genre: "Поп",
    duration: "2:23",
    label: "The Fence",
    description:
      'Второй сингл из альбома MAGNUM. Трек про закрытую связь между людьми — метафора через VPN. "Между нами VPN на запястье". Один из последних совместных треков 5opka и MellSher перед расколом.',
    stats: [
      { label: "На РЗТ", value: "Есть рецензии" },
      { label: "Формат", value: "Сингл" },
    ],
    videoUrl: "https://youtu.be/or8Xj5kC1Ho",
    rzUrl: "https://risazatvorchestvo.com/track/vpn",
  },
};

export function TrackPage() {
  const { slug } = useParams<{ slug: string }>();
  const track = slug ? TRACKS[slug] : null;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !track) return;

    const ctx = gsap.context(() => {
      gsap.set(`.${styles.hero} > *`, { y: 30, opacity: 0 });
      gsap.set(`.${styles.section}`, { y: 40, opacity: 0 });

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.to(`.${styles.hero} > *`, {
        y: 0,
        opacity: 1,
        stagger: 0.12,
        duration: 0.8,
      });

      gsap.to(`.${styles.section}`, {
        y: 0,
        opacity: 1,
        stagger: 0.15,
        duration: 0.8,
        delay: 0.5,
      });

      // Parallax cover
      gsap.to(`.${styles.coverImg}`, {
        yPercent: -15,
        scrollTrigger: {
          trigger: `.${styles.hero}`,
          start: "top top",
          end: "bottom top",
          scrub: 1,
        },
      });
    }, containerRef);

    return () => ctx.revert();
  }, [track]);

  if (!track) {
    return (
      <div className={styles.page}>
        <h1>Трек не найден</h1>
        <Link to="/magnum">← На главную</Link>
      </div>
    );
  }

  return (
    <div className={styles.page} ref={containerRef}>
      <div className={styles.hero}>
        <div className={styles.coverWrap}>
          <img
            src={track.cover}
            alt={track.name}
            className={styles.coverImg}
          />
          <div className={styles.coverGlow} />
        </div>
        <div className={styles.heroInfo}>
          <div className={styles.badge}>{track.genre}</div>
          <h1>{track.name}</h1>
          <p className={styles.artists}>{track.artists}</p>
          <div className={styles.meta}>
            <span>{track.releaseDate}</span>
            <span>•</span>
            <span>{track.duration}</span>
            <span>•</span>
            <span>{track.label}</span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <p className={styles.description}>{track.description}</p>
      </div>

      <div className={styles.section}>
        <h2>Статистика</h2>
        <div className={styles.statsGrid}>
          {track.stats.map((stat) => (
            <div key={stat.label} className={styles.statCard}>
              <div className={styles.statValue}>{stat.value}</div>
              <div className={styles.statLabel}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h2>Клип</h2>
        <div className={styles.videoWrap}>
          <iframe
            src={`https://www.youtube.com/embed/${track.videoUrl.split("/").pop()?.split("?")[0]}`}
            title={track.name}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className={styles.video}
          />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.links}>
          {track.rzUrl && (
            <a
              href={track.rzUrl}
              target="_blank"
              className={styles.linkBtn}
            >
              Рецензии на РЗТ →
            </a>
          )}
          <a
            href={track.videoUrl}
            target="_blank"
            className={styles.linkBtn}
          >
            Смотреть на YouTube →
          </a>
          <Link to="/magnum" className={styles.linkBtnPrimary}>
            ← Назад к альбому
          </Link>
        </div>
      </div>
    </div>
  );
}
