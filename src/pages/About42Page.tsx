import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./About42Page.module.css";

gsap.registerPlugin(ScrollTrigger);

export function About42Page() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      gsap.set(`.${styles.hero} > *`, { y: 30, opacity: 0 });
      gsap.to(`.${styles.hero} > *`, {
        y: 0,
        opacity: 1,
        stagger: 0.12,
        duration: 0.8,
      });

      gsap.set(`.${styles.section}`, { y: 50, opacity: 0 });
      gsap.to(`.${styles.section}`, {
        y: 0,
        opacity: 1,
        stagger: 0.2,
        duration: 0.8,
        scrollTrigger: {
          trigger: `.${styles.sections}`,
          start: "top 80%",
        },
      });

      // Big number animation
      gsap.from(`.${styles.bigNumber}`, {
        scale: 0.5,
        opacity: 0,
        duration: 1.2,
        ease: "back.out(1.7)",
        scrollTrigger: {
          trigger: `.${styles.bigNumber}`,
          start: "top 80%",
        },
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className={styles.page} ref={containerRef}>
      <div className={styles.hero}>
        <div className={styles.bigNumber}>42</div>
        <h1>Братухи</h1>
        <p className={styles.subtitle}>
          Молодёжное движение поколения Альфа. «Кринжа не существует» —
          абсолютная свобода самовыражения.
        </p>
      </div>

      <div className={styles.sections}>
        <div className={styles.section}>
          <h2>Происхождение</h2>
          <div className={styles.storyCard}>
            <p>
              <strong>Декабрь 2023.</strong> На стриме 5opka пересматривал фильм
              «Автостопом по Галактике» (2005), где суперкомпьютер назвал число{" "}
              <strong>42</strong> как «ответ на главный вопрос жизни, Вселенной и
              всего такого».
            </p>
            <blockquote>
              «А-а-а, сорок два, братуха! Кемеровская область, сорок два,
              братуха!»
              <cite>— Пятерка, декабрь 2023</cite>
            </blockquote>
            <p>
              В это время 5opka конфликтовал со стримером Guacamolemolly,
              который использовал фразу «52, братуха». Число 42 стало
              пародийным ответом на «52» — и родилось движение.
            </p>
          </div>
        </div>

        <div className={styles.section}>
          <h2>Визуальная идентичность</h2>
          <div className={styles.styleGrid}>
            <div className={styles.styleCard}>
              <span className={styles.styleIcon}>🧥</span>
              <strong>Шубы</strong>
              <p>Массивные шубы — визитная карточка</p>
            </div>
            <div className={styles.styleCard}>
              <span className={styles.styleIcon}>⛓️</span>
              <strong>Цепи</strong>
              <p>Массивные цепи и блёстки</p>
            </div>
            <div className={styles.styleCard}>
              <span className={styles.styleIcon}>🕶️</span>
              <strong>Очки</strong>
              <p>С шипами и необычными формами</p>
            </div>
            <div className={styles.styleCard}>
              <span className={styles.styleIcon}>🍄</span>
              <strong>Мухоморы</strong>
              <p>Головные уборы в виде мухоморов</p>
            </div>
            <div className={styles.styleCard}>
              <span className={styles.styleIcon}>🎨</span>
              <strong>Волосы</strong>
              <p>Яркие цвета, причудливые причёски</p>
            </div>
            <div className={styles.styleCard}>
              <span className={styles.styleIcon}>🤚</span>
              <strong>Жест 42</strong>
              <p>4 пальца + 2 пальца = 42</p>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h2>Ключевые фигуры</h2>
          <div className={styles.peopleGrid}>
            <div className={styles.personCard}>
              <div className={styles.personAvatar}>👑</div>
              <strong>5opka (Пятерка)</strong>
              <p>Основатель, «босс», лидер движения</p>
            </div>
            <div className={styles.personCard}>
              <div className={styles.personAvatar}>🎵</div>
              <strong>Яйцефонк (Ярик)</strong>
              <p>Тиктокер, один из самых известных представителей</p>
            </div>
            <div className={styles.personCard}>
              <div className={styles.personAvatar}>🔥</div>
              <strong>Грибданил</strong>
              <p>Тиктокер, соратник</p>
            </div>
            <div className={styles.personCard}>
              <div className={styles.personAvatar}>💅</div>
              <strong>Стейси Крыса</strong>
              <p>Сеструха, участница</p>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h2>Сквады</h2>
          <div className={styles.squadsGrid}>
            <div className={styles.squadCard}>
              <strong>«Шуба-сквад»</strong>
              <p>Петербург, первый сквад (2024)</p>
            </div>
            <div className={styles.squadCard}>
              <strong>«НАХ-сквад»</strong>
              <p>Москва</p>
            </div>
            <div className={styles.squadCard}>
              <strong>«Хай-сквад»</strong>
              <p>Воронеж</p>
            </div>
            <div className={styles.squadCard}>
              <strong>«Урод-сквад»</strong>
              <p>Ростов</p>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h2>Поддержали движение</h2>
          <div className={styles.supporters}>
            <span>Дмитрий Маликов</span>
            <span>Эльдар Джарахов</span>
            <span>Стинт</span>
          </div>
        </div>

        <div className={styles.section}>
          <h2>Трек «42»</h2>
          <div className={styles.trackHighlight}>
            <p>
              5opka & 6055 — трек «42» набрал <strong>2.2M+ просмотров</strong>{" "}
              на YouTube. Клип: 5opka в окружении «42 братух» в фирменном стиле.
            </p>
          </div>
        </div>

        <div className={styles.section}>
          <h2>Источники</h2>
          <div className={styles.sources}>
            <a href="https://trends.rbc.ru/trends/social/67d9d9a09a7947c6be91168f" target="_blank">РБК Тренды</a>
            <a href="https://afishadaily.ru/relationship/28893-skvady-haypa-shuby-i-malikov-chto-za-42-bratuhi-novaya-subkultura-pokoleniya-alfa/" target="_blank">Афиша Daily</a>
            <a href="https://secretmag.ru/enciklopediya/42-bratukhi.htm" target="_blank">Secretmag</a>
            <a href="https://cyclowiki.org/wiki/42,_%D0%B1%D1%80%D0%B0%D1%82%D1%83%D1%85%D0%B0" target="_blank">Циклопедия</a>
          </div>
        </div>
      </div>
    </div>
  );
}
