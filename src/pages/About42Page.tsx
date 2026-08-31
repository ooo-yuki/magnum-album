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
        stagger: 0.15,
        duration: 0.8,
        scrollTrigger: {
          trigger: `.${styles.sections}`,
          start: "top 80%",
        },
      });
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
          Молодёжное движение поколения Альфа. «Кринжа не существует» — абсолютная свобода самовыражения (РБК, Афиша Daily).
          Средний возраст 15–17. Сами называют себя «комьюнити» (5opka — «мемное объединение»).
        </p>
        <div className={styles.heroBadges}>
          <span>«Везде 42, братуха!»</span>
          <span>«Кринжа не существует»</span>
          <span>4 пальца + 2 пальца = 42</span>
        </div>
      </div>

      <div className={styles.sections}>
        <div className={styles.section}>
          <h2>Таймлайн</h2>
          <div className={styles.timeline}>
            <div className={styles.timelineItem}>
              <div className={styles.timelineDate}>Дек 2023</div>
              <div className={styles.timelineCard}>
                <strong>Рождение 42</strong>
                <p>На стриме 5opka пересматривал «Автостопом по Галактике» (2005): суперкомпьютер назвал 42 ответом на главный вопрос жизни. Кирилл: «А-а-а, сорок два, братуха! Кемеровская область, сорок два, братуха!» Ответ-парирование на «52, братуха» стримера Guacamolemolly (отсылка к рэп-объединению «52» из Петербурга).</p>
              </div>
            </div>
            <div className={styles.timelineItem}>
              <div className={styles.timelineDate}>2024</div>
              <div className={styles.timelineCard}>
                <strong>Первый сквад</strong>
                <p>Петербург — «Шуба-сквад», первый сквад движения. Сходки по ТЦ, лимузины, строй, скандирование лозунгов. Движение расползается по России и СНГ.</p>
              </div>
            </div>
            <div className={styles.timelineItem}>
              <div className={styles.timelineDate}>2024–2025</div>
              <div className={styles.timelineCard}>
                <strong>Сквады по всей стране</strong>
                <p>Москва — «НАХ-сквад», Воронеж — «Хай-сквад», Ростов — «Урод-сквад». Фестивали абсурда, показы мод в центре Москвы, свои премии, TikTok/Telegram-чаты.</p>
              </div>
            </div>
            <div className={styles.timelineItem}>
              <div className={styles.timelineDate}>Фев 2025</div>
              <div className={styles.timelineCard}>
                <strong>Трек «42» • 2.2M+ просмотров</strong>
                <p>5opka & 6055 — клип: Пятерка в окружении 42-братух в фирменном стиле (шубы, цепи, мухоморы). РЗТ: risazatvorchestvo.com/track/42</p>
                <a href="https://risazatvorchestvo.com/track/42" target="_blank" rel="noreferrer">РЗТ →</a>
              </div>
            </div>
            <div className={styles.timelineItem}>
              <div className={styles.timelineDate}>24.02.2025</div>
              <div className={styles.timelineCard}>
                <strong>Дмитрий Маликов — посвящён в братухи</strong>
                <p>Поддержали движение: Маликов, Эльдар Джарахов, Стинт. Конфликт с Вовой Солодковым (14 лет): братухи сорвали концерт яйцами — привлекло Мизулину и СМИ.</p>
              </div>
            </div>
            <div className={styles.timelineItem}>
              <div className={styles.timelineDate}>2026</div>
              <div className={styles.timelineCard}>
                <strong>CLAY • MAGNUM</strong>
                <p>CLAY: «Слава Боссу» — марш 42 братух. MAGNUM: последний фит с MellSher, 5 треков — 5 пуль. Движение уже — поп-культура.</p>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h2>Происхождение — дословно</h2>
          <div className={styles.storyCard}>
            <p>
              <strong>Декабрь 2023.</strong> На стриме 5opka пересматривал фильм «Автостопом по Галактике» (2005), где суперкомпьютер назвал число <strong>42</strong> как «ответ на главный вопрос жизни, Вселенной и всего такого».
            </p>
            <blockquote>
              «А-а-а, сорок два, братуха! Кемеровская область, сорок два, братуха!»
              <cite>— Пятерка, декабрь 2023</cite>
            </blockquote>
            <p className={styles.storyNote}>Источник: research.md • РБК Тренды, Афиша Daily, Secretmag, Циклопедия.</p>
          </div>
        </div>

        <div className={styles.section}>
          <h2>Визуальная идентичность</h2>
          <div className={styles.styleGrid}>
            <div className={styles.styleCard}><span className={styles.styleIcon}>🧥</span><strong>Шубы</strong><p>Массивные — визитная карточка</p></div>
            <div className={styles.styleCard}><span className={styles.styleIcon}>⛓️</span><strong>Цепи</strong><p>Массивные цепи и блёстки</p></div>
            <div className={styles.styleCard}><span className={styles.styleIcon}>🕶️</span><strong>Очки</strong><p>С шипами и формами</p></div>
            <div className={styles.styleCard}><span className={styles.styleIcon}>🍄</span><strong>Мухоморы</strong><p>Головные уборы</p></div>
            <div className={styles.styleCard}><span className={styles.styleIcon}>🎨</span><strong>Волосы</strong><p>Яркие цвета и причёски</p></div>
            <div className={styles.styleCard}><span className={styles.styleIcon}>🤚</span><strong>Жест 42</strong><p>4 пальца + 2 пальца</p></div>
            <div className={styles.styleCard}><span className={styles.styleIcon}>🦯</span><strong>Трости</strong><p>и плащи</p></div>
            <div className={styles.styleCard}><span className={styles.styleIcon}>💄</span><strong>Макияж</strong><p>Яркий, необычный</p></div>
          </div>
          <div className={styles.motto}>
            <strong>Лозунги:</strong> «Везде 42, братуха!» • «Кринжа не существует» — идеология абсолютной свободы.
          </div>
        </div>

        <div className={styles.section}>
          <h2>Сквады — иерархия</h2>
          <div className={styles.squadsGrid}>
            <div className={styles.squadCard}><strong>«Шуба-сквад»</strong><p>Петербург • первый сквад (2024)</p><small>Тот самый стартовый</small></div>
            <div className={styles.squadCard}><strong>«НАХ-сквад»</strong><p>Москва</p><small>Столичный хайп</small></div>
            <div className={styles.squadCard}><strong>«Хай-сквад»</strong><p>Воронеж</p></div>
            <div className={styles.squadCard}><strong>«Урод-сквад»</strong><p>Ростов</p><small>Родина 5opka & MellSher</small></div>
          </div>
          <p className={styles.squadsNote}>Движение распространилось по всей России и СНГ. Сходки — фестивали абсурда: ТЦ строем, лимузины, скандирование.</p>
        </div>

        <div className={styles.section}>
          <h2>Ключевые фигуры</h2>
          <div className={styles.peopleGrid}>
            <div className={styles.personCard}><div className={styles.personAvatar}>👑</div><strong>5opka</strong><p>Основатель, «босс», лидер</p><small>Кирилл Баранов • 05.04.1996</small></div>
            <div className={styles.personCard}><div className={styles.personAvatar}>🎵</div><strong>Яйцефонк (Ярик)</strong><p>Тиктокер</p><small>Основал сквад после отчисления из 10-го класса</small></div>
            <div className={styles.personCard}><div className={styles.personAvatar}>🔥</div><strong>Грибданил</strong><p>Тиктокер, соратник</p></div>
            <div className={styles.personCard}><div className={styles.personAvatar}>💅</div><strong>Стейси Крыса</strong><p>Сеструха</p></div>
          </div>
          <div className={styles.supporters}>
            <span>Дмитрий Маликов <small>• посвящён 24.02.2025</small></span>
            <span>Эльдар Джарахов</span>
            <span>Стинт</span>
          </div>
        </div>

        <div className={styles.section}>
          <h2>Мемы и пасты — «Мы уже победили»</h2>
          <div className={styles.memeGrid}>
            <div className={styles.memeCard}>
              <strong>🚨 Военный рапорт</strong>
              <p>«Братуха, ВРИО главнокомандующего 42 докладывает: мы зачищаем мир от наваза... SLAY — наш. Мы уже победили. 🦅 42!»</p>
              <small>Шаблон: титул + рапорт + «Мы уже победили»</small>
            </div>
            <div className={styles.memeCard}>
              <strong>🍕 Абсурдная</strong>
              <p>«Если бы 42 был пиццей, то BROTOVODX — анчоусная, которую никто не заказывает. А Пятерка — та, которую все хотят. Мы уже победили. 🏆»</p>
              <small>Приём: рандом + гипербола</small>
            </div>
            <div className={styles.memeCard}>
              <strong>🤡 Троллинг</strong>
              <p>«BROTOVODX снова «анализирует»? Пятёрка с тремя костюмами летит на SLAY, а вы — с пустыми статьями. Мы уже победили.»</p>
              <small>Контраст: 42 крутые / враги — фон</small>
            </div>
            <div className={styles.memeCard}>
              <strong>💪 Мотивация</strong>
              <p>«БРАТУХИ, СОБИРАЕМСЯ! 42 — образ жизни. Ты уже победил, пока остальные думают, как начать. Мы уже победили. 💪🔥🦅»</p>
              <small>Призыв + капс + эмодзи</small>
            </div>
          </div>
          <div className={styles.pastaNote}>
            Пасты — хаотичные копипасты для чатов: капс на ключевых словах, 5–10 эмодзи, титулы «ВРИО главнокомандующего 42», цитаты «у него лазеры», мемы «Скибиди/ПАПУС», финал — «Мы уже победили» 🏆
          </div>
          <div className={styles.slogans}>
            <span>ЗА БОССА!</span><span>42 — ЭТО НАВСЕГДА!</span><span>ХАЙП БЕЗ ПРЕДЕЛА!</span><span>СЛАВА 42!</span><span>Кринжа не существует</span>
          </div>
        </div>

        <div className={styles.section}>
          <h2>Трек «42»</h2>
          <div className={styles.trackHighlight}>
            <p>5opka & 6055 — трек «42» набрал <strong>2.2M+ просмотров</strong> на YouTube. Клип — Пятерка в окружении 42-братух в фирменном стиле.</p>
            <div className={styles.trackLinks}>
              <a href="https://risazatvorchestvo.com/track/42" target="_blank" rel="noreferrer">РЗТ трека →</a>
              <a href="https://risazatvorchestvo.com/artist/5opka" target="_blank" rel="noreferrer">Все рецензии →</a>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h2>Конфликты • Пресса</h2>
          <div className={styles.conflicts}>
            <div className={styles.conflict}><strong>vs Guacamolemolly («52»)</strong><p>Пародийный ответ 42 на его «52, братуха» (рэп-объединение 52, Петербург)</p></div>
            <div className={styles.conflict}><strong>vs Вова Солодков</strong><p>Братухи сорвали концерт (14 лет) яйцами на сцену — вмешалась Екатерина Мизулина, СМИ</p></div>
          </div>
          <div className={styles.sources}>
            <a href="https://trends.rbc.ru/trends/social/67d9d9a09a7947c6be91168f" target="_blank" rel="noreferrer">РБК Тренды</a>
            <a href="https://161.ru/text/entertainment/2025/03/16/75220811/" target="_blank" rel="noreferrer">161.ru</a>
            <a href="https://afishadaily.ru/relationship/28893-skvady-haypa-shuby-i-malikov-chto-za-42-bratuhi-novaya-subkultura-pokoleniya-alfa/" target="_blank" rel="noreferrer">Афиша Daily</a>
            <a href="https://secretmag.ru/enciklopediya/42-bratukhi.htm" target="_blank" rel="noreferrer">Secretmag</a>
            <a href="https://cyclowiki.org/wiki/42,_%D0%B1%D1%80%D0%B0%D1%82%D1%83%D1%85%D0%B0" target="_blank" rel="noreferrer">Циклопедия</a>
          </div>
        </div>
      </div>
    </div>
  );
}
