import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./Singles.module.css";

gsap.registerPlugin(ScrollTrigger);

interface Single {
  name: string;
  artists: string;
  meta: string;
  cover: string;
  url: string;
}

const SINGLES: Single[] = [
  {
    name: "ТУСА МЕДУЗА",
    artists: "5opka, MellSher, Вова Солодков",
    meta: "Уже в чартах • ~8K клипов в TikTok • ~200K просмотров",
    cover: "/magnum/images/tusa-meduza.jpg",
    url: "https://youtu.be/Mz69bLRpBEs?si=4ho4wjdN0N-W9w3L",
  },
  {
    name: "VPN",
    artists: "5opka, MellSher",
    meta: "Сингл из альбома MAGNUM",
    cover: "/magnum/images/vpn.jpg",
    url: "https://youtu.be/or8Xj5kC1Ho?si=8uLKoXab4xpM9tj4",
  },
];

export function Singles() {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const cardsRef = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.set(titleRef.current, { y: 20, opacity: 0 });
      gsap.set(cardsRef.current, { x: -40, opacity: 0 });

      gsap.to(titleRef.current, {
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
          toggleActions: "play none none none",
        },
        y: 0,
        opacity: 1,
        duration: 0.6,
      });

      gsap.to(cardsRef.current, {
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 70%",
          toggleActions: "play none none none",
        },
        x: 0,
        opacity: 1,
        stagger: 0.2,
        duration: 0.8,
        ease: "power2.out",
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className={styles.singles} id="singles" ref={sectionRef}>
      <h2 className={styles.title} ref={titleRef}>
        Синглы из альбома
      </h2>
      {SINGLES.map((single, i) => (
        <a
          key={single.name}
          href={single.url}
          target="_blank"
          className={styles.card}
          ref={(el) => {
            cardsRef.current[i] = el;
          }}
        >
          <img
            src={single.cover}
            alt={single.name}
            className={styles.cover}
            loading="lazy"
            decoding="async"
            width={640}
            height={360}
          />
          <div className={styles.info}>
            <div className={styles.name}>{single.name}</div>
            <div className={styles.artists}>{single.artists}</div>
            <div className={styles.meta}>{single.meta}</div>
          </div>
          <div className={styles.play}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </div>
        </a>
      ))}
    </section>
  );
}
