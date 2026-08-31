import { useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import styles from "./LastFit.module.css";

export function LastFitPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      gsap.set(`.${styles.hero} > *`, { y: 30, opacity: 0 });
      gsap.set(`.${styles.section}`, { y: 40, opacity: 0 });

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.to(`.${styles.hero} > *`, {
        y: 0,
        opacity: 1,
        stagger: 0.15,
        duration: 0.8,
      });

      gsap.to(`.${styles.section}`, {
        y: 0,
        opacity: 1,
        stagger: 0.2,
        duration: 0.8,
        delay: 0.6,
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className={styles.page} ref={containerRef}>
      <div className={styles.hero}>
        <div className={styles.badge}>Важная новость</div>
        <h1>Последний фит</h1>
        <p className={styles.subtitle}>
          5opka × MellSher — MAGNUM будет последним совместным альбомом
        </p>
      </div>

      <div className={styles.section}>
        <h2>Что произошло</h2>
        <div className={styles.quote}>
          <p>
            Из-за творческих разногласий с Игорем Меллшером MAGNUM будет{" "}
            <strong>моим альбомом</strong> и на обложке буду я. MellSher будет
            прописан в фитах, но потом скорее всего это поменяется и в фитах
            будет прописан <strong>MlSh</strong>.
          </p>
          <cite>— Пятерка</cite>
        </div>
      </div>

      <div className={styles.section}>
        <h2>Причина</h2>
        <div className={styles.cards}>
          <div className={styles.card}>
            <div className={styles.cardIcon}>🎵</div>
            <h3>Сольный путь</h3>
            <p>
              Игорь — серьёзный артист, готовит сольный альбом. Чтобы в его
              карточке музыканта найти сольный трек, нужно пролистать 10
              совместных фитов. Это тормозит его развитие как творца.
            </p>
          </div>
          <div className={styles.card}>
            <div className={styles.cardIcon}>🎤</div>
            <h3>Разные стили</h3>
            <p>
              Пятерка делает «дебильные треки про сиськи и жопы», а Игорь —
              жизненные, грустные песни. Совместные релизы оттягивают внимание
              от его сольного творчества.
            </p>
          </div>
          <div className={styles.card}>
            <div className={styles.cardIcon}>🚌</div>
            <h3>Тур на носу</h3>
            <p>
              Договорённости с лейблом и тур-агентством заставляют принимать
              резкие решения. Времени на мягкий переход не было — надо успеть
              исполнить песни на концертах.
            </p>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2>Что изменится</h2>
        <div className={styles.changes}>
          <div className={styles.change}>
            <span className={styles.check}>✓</span>
            <p>Все существующие треки останутся на площадках</p>
          </div>
          <div className={styles.change}>
            <span className={styles.check}>✓</span>
            <p>Вы также сможете слушать кайфовые треки</p>
          </div>
          <div className={styles.change}>
            <span className={styles.check}>✓</span>
            <p>Дружба между Пятеркой и Игорем не заканчивается</p>
          </div>
          <div className={styles.change}>
            <span className={styles.x}>→</span>
            <p>
              MellSher будет заменён на <strong>MlSh</strong> в фитах
            </p>
          </div>
          <div className={styles.change}>
            <span className={styles.x}>→</span>
            <p>Совместные релизы уйдут с карточки MellSher</p>
          </div>
          <div className={styles.change}>
            <span className={styles.x}>→</span>
            <p>
              Super Duper Nova и Super Пупенова — будут{" "}
              <strong>без Меллшера</strong>
            </p>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2>Слова Пятерки</h2>
        <div className={styles.quote}>
          <p>
            Я очень люблю и уважаю Игоря. Если у него будет что добавить, он
            напишет об этом в своём канале.
          </p>
          <cite>— Пятерка</cite>
        </div>
        <div className={styles.links}>
          <a
            href="https://t.me/mellsher"
            target="_blank"
            className={styles.linkBtn}
          >
            Канал Меллшера →
          </a>
          <Link to="/magnum" className={styles.linkBtnPrimary}>
            ← Назад к альбому
          </Link>
        </div>
      </div>
    </div>
  );
}
