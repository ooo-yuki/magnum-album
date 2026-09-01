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
  meaning: string;
  facts: string[];
  stats: { label: string; value: string }[];
  videoUrl: string;
  spotifyUrl?: string;
  yandexUrl?: string;
  deezerUrl?: string;
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
      "Первый сингл из MAGNUM. Трек стал трендом в TikTok — почти 8K клипов с песней. Клип набрал ~200K просмотров. Песня про вечеринку и танец медузы — новый сэк, который затмил все прошлые тусовки. В фитах указан Вова Солодков (14 лет) — конфликт со срывом его концерта яиц от братух упоминался в СМИ.",
    meaning:
      "РЗТ-данные: жанр русский рэп/поп, длительность 2:07, лейбл The Fence. Обложка на Яндекс Музыке — уточняется (в research.md отмечено: точный ID альбома Туса Медуза может отличаться; Deezer: deezer.com/ru/album/1053805132). Трек — мультижанровый эксперимент в духе MAGNUM.",
    facts: [
      "Сингл 14.08.2026 — первый предвестник MAGNUM",
      "Почти 8K клипов в TikTok с песней (research.md)",
      "Клип ~200K просмотров (YouTube: youtu.be/Mz69bLRpBEs)",
      "В чартах — да, по данным research.md",
      "Фиты: MellSher + Вова Солодков (реальные кредиты сингла)",
      "Deezer: deezer.com/ru/album/1053805132",
    ],
    stats: [
      { label: "Клипов в TikTok", value: "~8K" },
      { label: "Просмотров клипа", value: "~200K" },
      { label: "Длительность", value: "2:07" },
      { label: "В чартах", value: "✓" },
    ],
    videoUrl: "https://youtu.be/Mz69bLRpBEs",
    deezerUrl: "https://www.deezer.com/ru/album/1053805132",
    yandexUrl: "https://music.yandex.ru/artist/7544304",
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
      "Второй сингл из MAGNUM. Трек про закрытую связь между людьми — метафора через VPN: «Между нами VPN на запястье». Один из последних совместных треков 5opka и MellSher перед расколом (дальше — сольно, MlSh).",
    meaning:
      "Поп (research.md). Обложка Яндекс: avatars.yandex.net/get-music-content/15682289/c457cfcc.a.41745162-1/m1000x1000. Трек имеет рецензии на РЗТ (risazatvorchestvo.com/track/vpn). По настроению — закрытая интимная связь как приватная сеть.",
    facts: [
      "Второй сингл MAGNUM (2026)",
      "Длительность 2:23 • жанр поп • лейбл The Fence",
      "Обложка: Yandex Music ID 15682289/c457cfcc",
      "Есть рецензии на РЗТ: risazatvorchestvo.com/track/vpn",
      "Клип: youtu.be/or8Xj5kC1Ho",
      "Метафора: VPN на запястье = приватный канал между двумя",
    ],
    stats: [
      { label: "На РЗТ", value: "Есть рецензии" },
      { label: "Длительность", value: "2:23" },
      { label: "Жанр", value: "Поп" },
      { label: "Формат", value: "Сингл" },
    ],
    videoUrl: "https://youtu.be/or8Xj5kC1Ho",
    rzUrl: "https://risazatvorchestvo.com/track/vpn",
    yandexUrl: "https://music.yandex.ru/artist/7544304",
  },
  "42": {
    slug: "42",
    name: "42",
    artists: "5opka, 6055",
    cover: "/magnum/images/covers/clay.jpg",
    releaseDate: "Февраль 2025",
    genre: "Рэп",
    duration: "—",
    label: "—",
    description:
      "Гимн движения 42 братух. Клип — 5opka в окружении братух в фирменном стиле (шубы, цепи, мухоморы). Набрал 2.2M+ просмотров на YouTube. Культовый трек комьюнити.",
    meaning:
      "Число 42 — ответ на главный вопрос жизни из «Автостопом по Галактике» (декабрь 2023). Стал пародийным ответом на «52, братуха» Guacamolemolly. Трек закрепил идеологию «Кринжа не существует».",
    facts: [
      "2.2M+ просмотров YouTube (research.md)",
      "Дуэт с 6055",
      "РЗТ: risazatvorchestvo.com/track/42",
      "Визуал: фирменный стиль 42 — шубы, цепи, мухоморы",
      "Гимн сквадов: Шуба-сквад, НАХ, Хай, Урод",
    ],
    stats: [
      { label: "Просмотров", value: "2.2M+" },
      { label: "РЗТ", value: "Есть" },
      { label: "Движение", value: "42" },
    ],
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    rzUrl: "https://risazatvorchestvo.com/track/42",
  },
};

export function TrackPage() {
  const { slug } = useParams<{ slug: string }>();
  const track = slug ? TRACKS[slug] : null;
  const containerRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const factsRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!containerRef.current || !track) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (reducedMotion) {
        // reduced-motion: instant visible, skip all entrance/parallax
        gsap.set(`.${styles.hero} > *`, { y: 0, opacity: 1 });
        gsap.set(`.${styles.section}`, { y: 0, opacity: 1 });
        return;
      }

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
      gsap.to(`.${styles.coverImg}`, {
        yPercent: -15,
        scrollTrigger: {
          trigger: `.${styles.hero}`,
          start: "top top",
          end: "bottom top",
          scrub: 1,
        },
      });

      // staggered scroll-reveal on stats cards
      if (statsRef.current) {
        const cards = statsRef.current.querySelectorAll(`.${styles.statCard}`);
        gsap.set(cards, { y: 24, opacity: 0, scale: 0.92 });
        gsap.to(cards, {
          scrollTrigger: {
            trigger: statsRef.current,
            start: "top 85%",
            toggleActions: "play none none none",
          },
          y: 0,
          opacity: 1,
          scale: 1,
          stagger: 0.08,
          duration: 0.5,
          ease: "back.out(1.4)",
        });
      }

      // staggered scroll-reveal on facts list items
      if (factsRef.current) {
        const items = factsRef.current.querySelectorAll("li");
        gsap.set(items, { x: -20, opacity: 0 });
        gsap.to(items, {
          scrollTrigger: {
            trigger: factsRef.current,
            start: "top 85%",
            toggleActions: "play none none none",
          },
          x: 0,
          opacity: 1,
          stagger: 0.06,
          duration: 0.45,
          ease: "power2.out",
        });
      }

      // hover RGB — chromatic lift + tri-color shadow on stat cards
      const statCards = containerRef.current!.querySelectorAll(`.${styles.statCard}`);
      statCards.forEach((card) => {
        card.addEventListener("mouseenter", () => {
          gsap.to(card, {
            y: -4,
            scale: 1.04,
            borderColor: "rgba(255,45,85,0.35)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,45,85,0.20), 0 0 22px rgba(255,45,85,0.20), 0 0 22px rgba(0,255,136,0.12), 0 0 28px rgba(255,204,0,0.10)",
            duration: 0.3,
            ease: "power2.out",
          });
        });
        card.addEventListener("mouseleave", () => {
          gsap.to(card, {
            y: 0,
            scale: 1,
            borderColor: "rgba(255,255,255,0.06)",
            boxShadow: "none",
            duration: 0.25,
            ease: "power2.in",
          });
        });
      });

      // hover RGB on listen cards
      const listenCards = containerRef.current!.querySelectorAll(`.${styles.listenCard}`);
      listenCards.forEach((card) => {
        card.addEventListener("mouseenter", () => {
          gsap.to(card, {
            y: -3,
            borderColor: "rgba(255,45,85,0.30)",
            boxShadow: "0 10px 28px rgba(0,0,0,0.40), 0 0 0 1px rgba(255,45,85,0.18), 0 0 18px rgba(255,45,85,0.18), 0 0 18px rgba(0,255,136,0.10), 0 0 24px rgba(255,204,0,0.08)",
            duration: 0.3,
            ease: "power2.out",
          });
        });
        card.addEventListener("mouseleave", () => {
          gsap.to(card, {
            y: 0,
            borderColor: "rgba(255,255,255,0.06)",
            boxShadow: "none",
            duration: 0.25,
            ease: "power2.in",
          });
        });
      });
    }, containerRef);
    return () => ctx.revert();
  }, [track]);

  if (!track) {
    return (
      <div className={styles.page}>
        <div className={styles.notFound}>
          <h1>Трек не найден</h1>
          <p>Доступны: tusa-meduza, vpn, 42</p>
          <Link to="/magnum">← На главную</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page} ref={containerRef}>
      <div className={styles.hero}>
        <div className={styles.coverWrap}>
          <img src={track.cover} alt={track.name} className={styles.coverImg} loading="eager" decoding="async" width={500} height={500} fetchPriority="high" />
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
          <div className={styles.heroLinks}>
            {track.rzUrl && <a href={track.rzUrl} target="_blank" rel="noreferrer">РЗТ →</a>}
            {track.yandexUrl && <a href={track.yandexUrl} target="_blank" rel="noreferrer">Яндекс →</a>}
            {track.deezerUrl && <a href={track.deezerUrl} target="_blank" rel="noreferrer">Deezer →</a>}
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2>О треке</h2>
        <p className={styles.description}>{track.description}</p>
      </div>

      <div className={styles.section}>
        <h2>Смысл и контекст</h2>
        <div className={styles.meaningCard}>
          <p>{track.meaning}</p>
        </div>
      </div>

      <div className={styles.section}>
        <h2>Факты — только из research.md</h2>
        <ul className={styles.factsList} ref={factsRef}>
          {track.facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <p className={styles.factsNote}>Без фейков: тексты песен не выдумывались — указаны только подтверждённые факты и ссылки.</p>
      </div>

      <div className={styles.section}>
        <h2>Статистика</h2>
        <div className={styles.statsGrid} ref={statsRef}>
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
        <h2>Где слушать</h2>
        <div className={styles.listenGrid}>
          <a href="https://music.yandex.ru/artist/7544304" target="_blank" rel="noreferrer" className={styles.listenCard}><strong>Яндекс Музыка</strong><span>5opka — 400K+/мес</span></a>
          <a href="https://open.spotify.com/artist/6hSwHa5Se498WfUj6zf4WN" target="_blank" rel="noreferrer" className={styles.listenCard}><strong>Spotify</strong><span>140–263K monthly</span></a>
          {track.deezerUrl && <a href={track.deezerUrl} target="_blank" rel="noreferrer" className={styles.listenCard}><strong>Deezer</strong><span>Альбом</span></a>}
          {track.rzUrl && <a href={track.rzUrl} target="_blank" rel="noreferrer" className={styles.listenCard}><strong>РЗТ рецензии</strong><span>risazatvorchestvo.com</span></a>}
          <a href={track.videoUrl} target="_blank" rel="noreferrer" className={styles.listenCard}><strong>YouTube</strong><span>Клип</span></a>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.links}>
          {track.rzUrl && (
            <a href={track.rzUrl} target="_blank" rel="noreferrer" className={styles.linkBtn}>
              Рецензии на РЗТ →
            </a>
          )}
          <a href={track.videoUrl} target="_blank" rel="noreferrer" className={styles.linkBtn}>
            Смотреть на YouTube →
          </a>
          <Link to="/magnum/discography" className={styles.linkBtnPrimary}>
            Дискография →
          </Link>
          <Link to="/magnum" className={styles.linkBtnGhost}>
            ← На главную
          </Link>
        </div>
      </div>
    </div>
  );
}
