import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./About42Page.module.css";

gsap.registerPlugin(ScrollTrigger);

export function About42Page() {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const bigNumberRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      const heroEls = heroRef.current ? Array.from(heroRef.current.children) as Element[] : [];
      const sections = gsap.utils.toArray<HTMLElement>(`.${styles.section}`);
      const bigNum = bigNumberRef.current;

      // — reduced-motion gate: instant visible, no animation
      if (reducedMotion) {
        if (heroEls.length) gsap.set(heroEls, { y: 0, opacity: 1, clearProps: "transform" });
        if (sections.length) gsap.set(sections, { y: 0, opacity: 1, clearProps: "transform" });
        if (bigNum) gsap.set(bigNum, { scale: 1, opacity: 1, clearProps: "transform" });
        const allCards = gsap.utils.toArray<HTMLElement>(
          `.${styles.styleCard}, .${styles.squadCard}, .${styles.personCard}, .${styles.memeCard}, .${styles.timelineCard}, .${styles.conflict}, .${styles.geoCard}, .${styles.bioCard}`
        );
        if (allCards.length) gsap.set(allCards, { y: 0, opacity: 1, scale: 1, clearProps: "transform" });
        return;
      }

      // — entrance y24 stagger 0.12 для hero (spec)
      if (heroEls.length) {
        gsap.set(heroEls, { y: 24, opacity: 0 });
        gsap.to(heroEls, {
          y: 0,
          opacity: 1,
          duration: 0.7,
          stagger: 0.12,
          ease: "power3.out",
          overwrite: "auto",
        });
      }

      // — entrance y24 stagger 0.12 для секций (spec)
      if (sections.length) {
        gsap.set(sections, { y: 24, opacity: 0 });
        gsap.to(sections, {
          y: 0,
          opacity: 1,
          duration: 0.7,
          stagger: 0.12,
          ease: "power3.out",
          scrollTrigger: {
            trigger: `.${styles.sections}`,
            start: "top 82%",
          },
        });
      }

      // — bigNumber pop + parallax
      if (bigNum) {
        gsap.from(bigNum, {
          scale: 0.5,
          opacity: 0,
          duration: 1.2,
          ease: "back.out(1.7)",
          scrollTrigger: {
            trigger: bigNum,
            start: "top 85%",
          },
        });
        gsap.to(bigNum, {
          yPercent: -12,
          ease: "none",
          scrollTrigger: {
            trigger: heroRef.current,
            start: "top top",
            end: "bottom top",
            scrub: 0.6,
          },
        });
      }

      // — staggered scroll-reveal на карточках (y24)
      const cardGroups: Array<{ selector: string; trigger: string }> = [
        { selector: `.${styles.bioCard}`, trigger: `.${styles.bioGrid}` },
        { selector: `.${styles.geoCard}`, trigger: `.${styles.geoGrid}` },
        { selector: `.${styles.styleCard}`, trigger: `.${styles.styleGrid}` },
        { selector: `.${styles.squadCard}`, trigger: `.${styles.squadsGrid}` },
        { selector: `.${styles.personCard}`, trigger: `.${styles.peopleGrid}` },
        { selector: `.${styles.memeCard}`, trigger: `.${styles.memeGrid}` },
        { selector: `.${styles.timelineCard}`, trigger: `.${styles.timeline}` },
        { selector: `.${styles.conflict}`, trigger: `.${styles.conflicts}` },
      ];
      for (const { selector, trigger } of cardGroups) {
        const els = gsap.utils.toArray<HTMLElement>(selector);
        if (!els.length) continue;
        gsap.set(els, { y: 24, opacity: 0, scale: 0.97 });
        gsap.to(els, {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.55,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: {
            trigger,
            start: "top 88%",
          },
        });
      }

      // — hover RGB на карточках (spec): textShadow + boxShadow split
      const hoverCards = gsap.utils.toArray<HTMLElement>(
        `.${styles.styleCard}, .${styles.squadCard}, .${styles.personCard}, .${styles.memeCard}, .${styles.timelineCard}, .${styles.conflict}, .${styles.storyCard}, .${styles.geoCard}, .${styles.bioCard}`
      );
      const cleanups: Array<() => void> = [];
      hoverCards.forEach((el) => {
        const onEnter = () => {
          gsap.to(el, {
            duration: 0.22,
            ease: "power2.out",
            y: -3,
            boxShadow: "0 8px 32px rgba(255,45,85,0.22), 0 0 18px rgba(88,101,242,0.22)",
            borderColor: "rgba(255,45,85,0.35)",
            overwrite: "auto",
          });
          // RGB split on inner strong
          const strong = el.querySelector("strong");
          if (strong) {
            gsap.to(strong, {
              duration: 0.22,
              textShadow: "1.5px 0 0 rgba(255,0,80,0.85), -1.5px 0 0 rgba(0,255,255,0.85)",
              overwrite: "auto",
            });
          }
        };
        const onLeave = () => {
          gsap.to(el, {
            duration: 0.3,
            ease: "power3.out",
            y: 0,
            boxShadow: "0 0 0 transparent",
            borderColor: "rgba(255,255,255,0.06)",
            overwrite: "auto",
          });
          const strong = el.querySelector("strong");
          if (strong) {
            gsap.to(strong, {
              duration: 0.3,
              textShadow: "0 0 0 transparent",
              overwrite: "auto",
            });
          }
        };
        el.addEventListener("mouseenter", onEnter);
        el.addEventListener("mouseleave", onLeave);
        cleanups.push(() => {
          el.removeEventListener("mouseenter", onEnter);
          el.removeEventListener("mouseleave", onLeave);
        });
      });
      // stash cleanup for ctx revert
      (containerRef.current as unknown as { _cardHoverCleanup?: () => void })._cardHoverCleanup = () =>
        cleanups.forEach((fn) => fn());

      // — subtle parallax на секциях (depth)
      sections.forEach((sec, i) => {
        gsap.to(sec, {
          yPercent: (i % 2 === 0 ? -4 : -6),
          ease: "none",
          scrollTrigger: {
            trigger: sec,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.5,
          },
        });
      });
    }, containerRef);

    return () => {
      (containerRef.current as unknown as { _cardHoverCleanup?: () => void })?._cardHoverCleanup?.();
      ctx.revert();
    };
  }, []);

  return (
    <div className={styles.page} ref={containerRef}>
      <div className={styles.hero} ref={heroRef}>
        <div className={styles.bigNumber} ref={bigNumberRef}>42</div>
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
        {/* §2 data 18:23 — Био-паспорт 42: Кирилл Александрович Баранов 05.04.1996 Ростов школа №65 2014 ДГТУ антикриз не окончил 4 курс YouTube 27.01.2011 Боб хавальник Twitch 2016 5opka мем 42 братуха — источники: ru.wikipedia.org/wiki/Баранов_Кирилл_Александрович + twitch-news.ru/streamers/5opka + aboutan.ru/blogery/kirill-baranov.html */}
        <div className={styles.section} id="bio42">
          <h2>Био-паспорт 42 — Кирилл Баранов</h2>
          <div className={styles.bioGrid}>
            <div className={styles.bioCard}><span className={styles.bioIcon}>🪪</span><strong>Кирилл Александрович Баранов</strong><p>Полное имя<br />гражданство РФ</p></div>
            <div className={styles.bioCard}><span className={styles.bioIcon}>📅</span><strong>05.04.1996</strong><p>Ростов-на-Дону<br />Овен / Крыса · 30 лет в 2026</p></div>
            <div className={styles.bioCard}><span className={styles.bioIcon}>🏫</span><strong>Школа №65 • 2014</strong><p>Ростов-на-Дону<br />окончил в 2014</p></div>
            <div className={styles.bioCard}><span className={styles.bioIcon}>🎓</span><strong>ДГТУ — антикризис</strong><p>Антикризисный менеджмент<br />не окончил · отчислен 4 курс</p></div>
            <div className={styles.bioCard}><span className={styles.bioIcon}>▶️</span><strong>YouTube 27.01.2011</strong><p>Minecraft «Боб хавальник»<br />первые летсплеи</p></div>
            <div className={styles.bioCard}><span className={styles.bioIcon}>💜</span><strong>Twitch с 2016 — 5opka</strong><p>Канал создан 15.07.2012<br />стримы с 2016 · мем «42 братуха!»</p></div>
          </div>
          <div className={styles.bioSources}>
            <span style={{ color: "rgba(240,240,240,0.5)", fontSize: "0.78rem" }}>Био-паспорт — проверено data 18:23. Источники:</span>
            <a href="https://ru.wikipedia.org/wiki/%D0%91%D0%B0%D1%80%D0%B0%D0%BD%D0%BE%D0%B2,_%D0%9A%D0%B8%D1%80%D0%B8%D0%BB%D0%BB_%D0%90%D0%BB%D0%B5%D0%BA%D1%81%D0%B0%D0%BD%D0%B4%D1%80%D0%BE%D0%B2%D0%B8%D1%87" target="_blank" rel="noreferrer">Wikipedia: Баранов К.А. →</a>
            <a href="https://twitch-news.ru/streamers/5opka/" target="_blank" rel="noreferrer">twitch-news.ru/5opka →</a>
            <a href="https://aboutan.ru/blogery/kirill-baranov.html" target="_blank" rel="noreferrer">aboutan.ru →</a>
            <a href="https://www.cybersport.ru/tags/strimery/5opka-kirill-baranov-biografiya-karera-mem-42-bratukha-i-skandaly" target="_blank" rel="noreferrer">cybersport.ru био →</a>
          </div>
        </div>

        {}
        <div className={styles.section} id="spotify-bio42">
          <h2>Spotify-био 5opka — от Minecraft к «1000 жизней»</h2>
          <div className={styles.storyCard} style={{ borderLeft: "3px solid #1DB954" }}>
            <p><strong>Minecraft 2011 → сервер «СП»:</strong> Кирилл Баранов (5opka) начал в 2011 с летсплеев Minecraft — основатель легендарного сервера <strong>«СП»</strong>. Дебютный альбом — <strong>«1000 жизней»</strong>, далее гастроли и клипы. Био закреплено в Spotify-профиле артиста.</p>
            <p><strong>42 как субкультура / комьюнити:</strong> в Spotify-био <em>«42 братухи»</em> описаны как <strong>субкультура и комьюнити</strong> — «эпатаж, сплочённость на концертах, премиях и в TikTok». Отзыв: «от детского сада до фанаток Анны Асти — плейлист на всех».</p>
            <div className={styles.statsRow} style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "14px 0" }}>
              <span style={{ padding: "6px 12px", borderRadius: 999, background: "rgba(29,185,84,0.12)", border: "1px solid rgba(29,185,84,0.25)", fontSize: "0.85rem" }}>🎧 400K+ Яндекс Музыка</span>
              <span style={{ padding: "6px 12px", borderRadius: 999, background: "rgba(145,71,255,0.12)", border: "1px solid rgba(145,71,255,0.28)", fontSize: "0.85rem" }}>💜 923K Twitch</span>
              <span style={{ padding: "6px 12px", borderRadius: 999, background: "rgba(255,0,0,0.10)", border: "1px solid rgba(255,0,0,0.22)", fontSize: "0.85rem" }}>▶️ ~1M YouTube</span>
              <span style={{ padding: "6px 12px", borderRadius: 999, background: "rgba(29,185,84,0.08)", border: "1px solid rgba(29,185,84,0.18)", fontSize: "0.85rem" }}>🎵 209K Spotify / мес</span>
            </div>
            <div className={styles.trackLinks} style={{ flexWrap: "wrap" }}>
              <a href="https://open.spotify.com/artist/6hSwHa5Se498WfUj6zf4WN" target="_blank" rel="noreferrer">Spotify 5opka — био и «СП» / «1000 жизней» →</a>
              <a href="https://afishadaily.ru/relationship/28893-skvady-haypa-shuby-i-malikov-chto-za-42-bratuhi-novaya-subkultura-pokoleniya-alfa/" target="_blank" rel="noreferrer">Афиша Daily: сквады Шуба/НАХ/Хай/Урод — эпатаж и сплочённость →</a>
            </div>
            <p style={{ marginTop: 10, opacity: 0.6, fontSize: "0.78rem" }}>Факт P2 t_c21320ec — проверено по Spotify-био + Афиша Daily 28893. Куда: About42 био-блок + PressWall. Цифры: 400K+ Яндекс Музыка, 923K Twitch, YouTube ~1M — без выдумок.</p>
          </div>
        </div>

        {/* §5 data 18:23 — Лор 42 братуха: субкультура 5opka Spotify-био трек 42 feat 6055 02.2025 рефрен Везде сорок два братуха код 42 Кузбасс эстер-эпиг MAGNUM — sources open.spotify/artist + ru.wikipedia/Баранов + cybersport + ru.wikipedia/Коды субъектов */}
        <div className={styles.section} id="geografia42">
          <h2>География 42 — Кузбасс код 42</h2>
          <div className={styles.geoGrid}>
            <div className={styles.geoCard}><span className={styles.geoIcon}>🗺️</span><strong>Код 42</strong><p>RU-KEM • ОКАТО 32<br/>Субъект РФ 42</p></div>
            <div className={styles.geoCard}><span className={styles.geoIcon}>📐</span><strong>95 725 км²</strong><p>34-е место в РФ<br/>0,6% России</p></div>
            <div className={styles.geoCard}><span className={styles.geoIcon}>👥</span><strong>2 527 219 чел.</strong><p>01.01.2025 • 17-е место<br/>плотность 26,4 чел/км²</p></div>
            <div className={styles.geoCard}><span className={styles.geoIcon}>🏛️</span><strong>Кемерово • СФО</strong><p>Адм. центр — Кемерово<br/>Сибирский фед. округ</p></div>
            <div className={styles.geoCard}><span className={styles.geoIcon}>📅</span><strong>26.01.1943</strong><p>Образована Указом ПВС<br/>ордена Ленина 1967 / 1970</p></div>
            <div className={styles.geoCard}><span className={styles.geoIcon}>💰</span><strong>ВРП 1883,8 млрд ₽</strong><p>2023 • 21-е место в РФ</p></div>
          </div>
          <div className={styles.geoSources}>
            <span style={{ color: "rgba(240,240,240,0.5)", fontSize: "0.78rem" }}>Кузбасс — не просто «42 братуха», а регион на карте. Источники:</span>
            <a href="https://ru.wikipedia.org/wiki/%D0%9A%D0%B5%D0%BC%D0%B5%D1%80%D0%BE%D0%B2%D1%81%D0%BA%D0%B0%D1%8F_%D0%BE%D0%B1%D0%BB%D0%B0%D1%81%D1%82%D1%8C" target="_blank" rel="noreferrer">Wikipedia: Кемеровская область →</a>
            <a href="https://www.consultant.ru/document/cons_doc_LAW_174188/e86450c622ff078214b604d61f45251f34addf47b" target="_blank" rel="noreferrer">consultant.ru код 42 →</a>
            <a href="https://ru.wikipedia.org/wiki/%D0%9A%D0%BE%D0%B4%D1%8B_%D1%81%D1%83%D0%B1%D1%8A%D0%B5%D0%BA%D1%82%D0%BE%D0%B2_%D0%A0%D0%BE%D1%81%D1%81%D0%B8%D0%B9%D1%81%D0%BA%D0%BE%D0%B9_%D0%A4%D0%B5%D0%B4%D0%B5%D1%80%D0%B0%D1%86%D0%B8%D0%B8" target="_blank" rel="noreferrer">Коды субъектов 42 • RU-KEM 32 →</a>
            <a href="/magnum/map">→ Карта 42</a>
          </div>
        </div>

        {}
        <div className={styles.section} id="kuzbass-today-01092026">
          <h2>Кузбасс сегодня — 01.09.2026 · ЧП: ДТП КамАЗ × автобус + эвакуации</h2>
          <div className={styles.storyCard} style={{ borderLeft: "3px solid #ff3b30" }}>
            <p><strong>ДТП Ленинск-Кузнецкий · 01.09.2026 · 14:35 (10:35 мск) · ул. Суворова:</strong> 57-летний водитель КамАЗа выехал на встречную полосу и столкнулся с рейсовым автобусом (в салоне 18 пассажиров) — автобус съехал в кювет. Госпитализированы водитель КамАЗа и 1 пассажир автобуса. Прокуратура Кемеровской области организовала проверку (контроль соблюдения безопасности перевозок).</p>
            <p><strong>Эвакуации 31.08–01.09 — ложные угрозы:</strong> 31.08 — кардиодиспансер (Кузбасский клинический кардиологический диспансер), 01.09 — больница им. Подгорбунского (ул. Островского, Кемерово) — эвакуация пациентов и персонала из-за анонимных писем об угрозах на электронную почту. Взрывных устройств не обнаружено, угрозы не подтвердились — медучреждения вернулись к штатному режиму. ГУ МВД по Кузбассу напоминает об уголовной ответственности за заведомо ложные сообщения о минировании.</p>
            <div className={styles.trackLinks} style={{ marginTop: 12, flexWrap: "wrap" }}>
              <a href="https://ria.ru/20260901/dtp-2114622142.html" target="_blank" rel="noreferrer">РИА Новости 01.09.2026 14:13 — ДТП Ленинск-Кузнецкий →</a>
              <a href="https://kuzbass.aif.ru/incidents/ugrozy-minirovaniya-v-kuzbasse-1-sentyabrya-2026-poslednie-novosti" target="_blank" rel="noreferrer">АиФ Кузбасс — угрозы минирований 01.09 →</a>
              <a href="https://www.mk-kuzbass.ru/social/2026/09/01/pacientov-i-personal-evakuirovali-iz-bolnicy-v-kemerove-utrom-1-sentyabrya.html" target="_blank" rel="noreferrer">МК Кузбасс 01.09 — эвакуация Подгорбунского →</a>
              <a href="/magnum/recaps">→ Лента Recaps</a>
            </div>
            <p style={{ marginTop: 10, opacity: 0.6, fontSize: "0.78rem" }}>Факт P2 t_7ed55896 — проверено по первоисточникам РИА/АиФ/МК. ДТП: Ленинск-Кузнецкий, 14:35 местн. (10:35 мск), ул. Суворова, КамАЗ встречка → автобус 18 пасс., кювет, 2 госпитализированы, проверка прокуратуры. Эвакуации: 31.08 кардио + 01.09 Подгорбунского, письма на почту, не подтвердились, штатный режим, ГУ МВД — уголовная ответственность за ложные минирования. Без выдумок.</p>
          </div>
          <div className={styles.timeline} style={{ marginTop: 14 }}>
            <div className={styles.timelineItem}>
              <div className={styles.timelineDate}>01.09 14:35</div>
              <div className={styles.timelineCard}>
                <strong>КамАЗ × автобус — Ленинск-Кузнецкий, ул. Суворова</strong>
                <p>Водитель КамАЗа 57 лет на встречке → рейсовый автобус (18 пасс.) в кювете. 2 госпитализированы (водитель + 1 пасс.). Прокуратура — проверка.</p>
              </div>
            </div>
            <div className={styles.timelineItem}>
              <div className={styles.timelineDate}>31.08–01.09</div>
              <div className={styles.timelineCard}>
                <strong>Эвакуации — ложные анонимные угрозы</strong>
                <p>Кардиодиспансер 31.08 + больница Подгорбунского (ул. Островского) 01.09 — письма на почту, эвакуация, не подтвердилось, штатный режим. ГУ МВД: уголовная ответственность за ложные минирования.</p>
              </div>
            </div>
          </div>
        </div>

        {/* §5 Лор MAGNUM 42: мем 42 братуха как субкультура 5opka — Spotify-био + трек 42 feat 6055 02.2025 2.2M+ рефрен Везде сорок два братуха коррелирует с кодом 42 Кузбасса — эстер-эпиг MAGNUM */}
        <div className={styles.section} id="lor42">
          <h2>Лор MAGNUM 42 — «Везде сорок два, братуха!»</h2>
          <div className={styles.storyCard} style={{ borderLeft: "3px solid #ff2d55" }}>
            <p><strong>Мем → субкультура:</strong> «42 братуха!» — фирменный мем 5opka, закреплён в Spotify-био артиста как субкультура поколения Альфа. Из шутки на стриме он вырос в движение со сквадами, шубами и гимном.</p>
            <p><strong>Трек «42 feat 6055» — 02.2025 · 2.2M+:</strong> совместный трек 5opka × 6055, выпущен в феврале 2025, рефрен <em>«Везде сорок два, братуха!»</em> — закрепил лор в музыке. Клип: Пятерка в окружении 42-братух в шубах/цепях/мухоморах.</p>
            <p><strong>Код 42 Кузбасса = эстер-эпиг MAGNUM:</strong> №42 — официальный код Кемеровской области (RU-KEM, ОКАТО 32). В лоре MAGNUM это пасхалка: 42 — не просто мем, а «код региона» на карте России, отсылка к корням мема «Кемеровская область, сорок два, братуха!».</p>
            <div className={styles.trackLinks} style={{ marginTop: 12, flexWrap: "wrap" }}>
              <a href="https://open.spotify.com/artist/6hSwHa5Se498WfUj6zf4WN" target="_blank" rel="noreferrer">Spotify 5opka (био «42 братуха») →</a>
              <a href="https://ru.wikipedia.org/wiki/%D0%91%D0%B0%D1%80%D0%B0%D0%BD%D0%BE%D0%B2,_%D0%9A%D0%B8%D1%80%D0%B8%D0%BB%D0%BB_%D0%90%D0%BB%D0%B5%D0%BA%D1%81%D0%B0%D0%BD%D0%B4%D1%80%D0%BE%D0%B2%D0%B8%D1%87" target="_blank" rel="noreferrer">Wikipedia Баранов →</a>
              <a href="https://www.cybersport.ru/tags/strimery/5opka-kirill-baranov-biografiya-karera-mem-42-bratukha-i-skandaly" target="_blank" rel="noreferrer">cybersport.ru мем 42 →</a>
              <a href="https://ru.wikipedia.org/wiki/%D0%9A%D0%BE%D0%B4%D1%8B_%D1%81%D1%83%D0%B1%D1%8A%D0%B5%D0%BA%D1%82%D0%BE%D0%B2_%D0%A0%D0%BE%D1%81%D1%81%D0%B8%D0%B9%D1%81%D0%BA%D0%BE%D0%B9_%D0%A4%D0%B5%D0%B4%D0%B5%D1%80%D0%B0%D1%86%D0%B8%D0%B8" target="_blank" rel="noreferrer">Коды субъектов 42 →</a>
              <a href="https://risazatvorchestvo.com/track/42" target="_blank" rel="noreferrer">Трек «42» РЗТ →</a>
            </div>
            <p style={{ marginTop: 10, opacity: 0.6, fontSize: "0.78rem" }}>data 18:23 §5 · куда вставить: прессвол / Recaps SLAY 2025 / Викторина42 / Ритм42 / Галерея 42 — проверено data-seeker 5 запросов только первоисточники</p>
          </div>
        </div>

        {}
        <div className={styles.section} id="kemerovo42-01092026">
          <h2>Кемерово42 — День знаний 01.09.2026 · 66,8 тыс за партами</h2>
          <div className={styles.storyCard} style={{ borderLeft: "3px solid #00d4ff" }}>
            <p><strong>01.09.2026 — 66,8 тыс школьников в Кемерове</strong> сели за парты, из них <strong>5 300 первоклассников</strong> — данные KP.RU 01.09.2026 08:26 («В Кемерове за парты сели более 66 тысяч учеников»). По сводке горадминистрации в онлайн-трансляции NGS42 — ещё <strong>&gt;2 000 первоклашек</strong> по муниципальной разбивке. Код региона — <strong>42 (Кемеровская область, RU-KEM)</strong> — снова в новостях не как мем, а как город.</p>
            <p><strong>Мэр Дмитрий Анисимов</strong> открыл линейку в <strong>школе №10 после капремонта</strong> — вместе с лицеем №89 обе школы отремонтированы на <strong>750 млн руб.</strong> В школе №10 появились <strong>скалодром и верёвочный парк</strong> (новые спортзоны). Это один из самых дорогих школьных ремонтов Кузбасса в 2026.</p>
            <p><strong>Школа №36 — 281 первоклассник, 10 первых классов</strong> (рекорд района, NGS42-лента). По городу — волнение, пробки у школ к 8:00, линейки под гимн. Власти уточнили: <strong>без дневников от администрации</strong> — подарков-дневников не выдавали. Сборы в школу — ~15 тыс ₽ на ребёнка (из комментариев родителей в трансляции).</p>
            <div className={styles.trackLinks} style={{ marginTop: 10, flexWrap: "wrap" }}>
              <a href="https://www.kem.kp.ru/online/news/7150485/" target="_blank" rel="noreferrer">KP.RU 01.09.2026 08:26 — 66,8k/5 300 →</a>
              <a href="https://ngs42.ru/text/education/2026/09/01/76616542/" target="_blank" rel="noreferrer">NGS42 онлайн-трансляция 01.09.2026 →</a>
              <a href="/magnum/recaps">→ Recaps 01.09.2026</a>
              <a href="/magnum/map">→ Карта 42</a>
            </div>
            <p style={{ marginTop: 10, opacity: 0.6, fontSize: "0.78rem" }}>Факт t_fcc28280 — проверено по KP.RU 7150485 + NGS42 76616542. Куда: About42 Кемерово42 + Timeline 01.09 + RecapsPage. Без выдумок.</p>
          </div>
          <div className={styles.geoGrid} style={{ marginTop: 14 }}>
            <div className={styles.geoCard}><span className={styles.geoIcon}>🎒</span><strong>66,8 тыс</strong><p>Школьников Кемерово<br/>01.09.2026</p></div>
            <div className={styles.geoCard}><span className={styles.geoIcon}>🔔</span><strong>5 300</strong><p>Первоклассников<br/>&gt;2 000 по горадм.</p></div>
            <div className={styles.geoCard}><span className={styles.geoIcon}>🏫</span><strong>Школа №10</strong><p>Мэр Анисимов<br/>линейка после капремонта</p></div>
            <div className={styles.geoCard}><span className={styles.geoIcon}>🏗️</span><strong>750 млн ₽</strong><p>Школы №10 + лицей №89<br/>скалодром/верёвочный парк</p></div>
            <div className={styles.geoCard}><span className={styles.geoIcon}>👶</span><strong>Школа №36</strong><p>281 первоклассник<br/>10 первых классов</p></div>
            <div className={styles.geoCard}><span className={styles.geoIcon}>📓</span><strong>Без дневников</strong><p>От властей — не выдавали<br/>пробки/волнение</p></div>
          </div>
        </div>

        {/* манифест СЛАВА БОССУ 11.12.2025 — yt-2026-09-01-2320 карточка 13 — ZeIFBdoOZXo VTT 1765 симв. frag 2-9 transcript:true — «Я никогда не был хорошим примером… Со мной моё племя» + «Шрек из Ростова будет коронован» — куда: About42 Био-манифест + RecapsPage + прессвол + игра Угадай трек + Ритм42 — без выдумок */}
        <div className={styles.section} id="manifest-slava-bossu">
          <h2>Манифест — СЛАВА БОССУ «Я никогда не был хорошим примером» (11.12.2025)</h2>
          <div className={styles.storyCard} style={{ borderLeft: "3px solid #ff4500" }}>
            <blockquote style={{ borderLeft: "3px solid #ff2d55", paddingLeft: 14, margin: "8px 0", fontStyle: "italic" }}>
              «Я никогда не был хорошим примером, да и просто хорошим я не был. Я просто стремился быть первым. Этот выбор единственно верный. Не зарекайся от парадайса и до инферно. Мой путь от майнкрафтовой эры. До признания всех ваших премий. Пришло моё время. Со мной моё племя.»
              <cite style={{ display: "block", marginTop: 8, opacity: 0.7, fontSize: "0.85rem" }}>— 5opka, СЛАВА БОССУ (SLAY DISS), 11.12.2025 — VTT ZeIFBdoOZXo.ru.vtt frag 2-9, 1765 симв., transcript:true</cite>
            </blockquote>
            <p><strong>Рефрен:</strong> «Слава боссу» (≈14 повторов «бос, бос, бос… 42» на интро) + «Не возьму я Слейкинга, не рекламлю я буков. На вашу вечеринку влетаю с двух ног я без стука. Слава боссу.» — рефрен-дисс на SLAY.</p>
            <p><strong>Финал манифеста:</strong> «На счетах полно нулей, пятёрку испугались. Со мной мои люди на свете, на Ютубе, на концерте, на студии, в Ростове… Мы пришли чтобы забрать всё. Король вне номинации. Это моя трансляция. Шрек из Ростова будет коронован.» — «Шрек из Ростова» — самоирония 5opka (Ростов-на-Дону, 05.04.1996) как короля вне номинации.</p>
            <p style={{ opacity: 0.6, fontSize: "0.78rem", marginTop: 10 }}>Источник: https://www.youtube.com/watch?v=ZeIFBdoOZXo (ФУГА TV, 11.12.2025, 3:07, 370k/23k, реж. outsideinclub, 3 нейрогения komaclinical/zxseeczs/tenzedit) — VTT /tmp/yt42/ZeIFBdoOZXo.ru.vtt (19K, 53 фрагм.) — transcript:true, без выдумок. Смотри также Recaps → «СЛАВА БОССУ — манифест» и прессвол «СЛАВА БОССУ».</p>
            <div className={styles.trackLinks} style={{ marginTop: 10 }}>
              <a href="https://www.youtube.com/watch?v=ZeIFBdoOZXo" target="_blank" rel="noreferrer">YouTube СЛАВА БОССУ →</a>
              <a href="https://music.thefence.me/slavabo55u" target="_blank" rel="noreferrer">Слушать slavabo55u →</a>
              <a href="/magnum/recaps">→ Recaps манифест</a>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h2>Таймлайн</h2>
          <div className={styles.timeline}>
            <div className={styles.timelineItem}>
              <div className={styles.timelineDate}>Дек 2023</div>
              <div className={styles.timelineCard}>
                <strong>Рождение 42 — дек.2023 vs 52</strong>
                <p>На стриме 5opka пересматривал «Автостопом по Галактике» (2005): суперкомпьютер назвал 42 ответом на главный вопрос жизни, Вселенной и всего такого. Кирилл: «А-а-а, сорок два, братуха! Кемеровская область, сорок два, братуха!» — пародия-ответ на «52, братуха» стримера Guacamolemolly / Alblak 52 (петербургское объединение «52»). Жест 4 пальца + 2 пальца = 42, лозунг «Кринжа не существует».</p>
                <p style={{ marginTop: 8, fontSize: "0.78rem", opacity: 0.7 }}>Источники: <a href="https://trends.rbc.ru/trends/social/67d9d9a09a7947c6be91168f" target="_blank" rel="noreferrer">РБК Тренды 19.03.2025 →</a> <a href="https://www.cybersport.ru/tags/strimery/5opka-kirill-baranov-biografiya-karera-mem-42-bratukha-i-skandaly" target="_blank" rel="noreferrer">Cybersport →</a> <a href="https://postium.ru/42-bratuxa-chto-znachit-mem/" target="_blank" rel="noreferrer">Postium →</a></p>
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
                <strong>Трек «42 feat 6055» • 02.2025 • 2.2M+</strong>
                <p>5opka & 6055 — клип: Пятерка в окружении 42-братух в фирменном стиле (шубы, цепи, мухоморы). Рефрен <em>«Везде сорок два, братуха!»</em> — субкультура закреплена в Spotify-био 5opka, код 42 Кузбасса как эстер-эпиг MAGNUM.</p>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
                  <a href="https://risazatvorchestvo.com/track/42" target="_blank" rel="noreferrer">РЗТ →</a>
                  <a href="https://open.spotify.com/artist/6hSwHa5Se498WfUj6zf4WN" target="_blank" rel="noreferrer">Spotify био →</a>
                </div>
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
              <div className={styles.timelineDate}>01.09.2026</div>
              <div className={styles.timelineCard}>
                <strong>День знаний Кемерово42 — 66,8k/5,3k · мэр Анисимов · школа №10 + лицей №89 750 млн</strong>
                <p>01.09.2026 в Кемерове 66,8 тыс школьников за партами (5 300 первоклассников, &gt;2 000 по горадм.). Мэр Дмитрий Анисимов открыл линейку школы №10 после капремонта (школы №10 + лицей №89 — 750 млн руб., скалодром/верёвочный парк). Школа №36 — 281 первоклассник, 10 первых классов, волнение/пробки, без дневников от властей. Код 42 — снова в новостях как реальный город, не только мем.</p>
                <p style={{ marginTop: 8, fontSize: "0.78rem", opacity: 0.7 }}>Источники: <a href="https://www.kem.kp.ru/online/news/7150485/" target="_blank" rel="noreferrer">KP.RU 01.09.2026 08:26 →</a> <a href="https://ngs42.ru/text/education/2026/09/01/76616542/" target="_blank" rel="noreferrer">NGS42 онлайн 76616542 →</a> <a href="/magnum/recaps">→ Recaps 01.09</a></p>
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

        <div className={styles.section} id="origin42-vs52">
          <h2>Происхождение — дословно: 42 vs 52 (дек. 2023)</h2>
          <div className={styles.storyCard} style={{ borderLeft: "3px solid #ff2d55" }}>
            <p>
              <strong>Декабрь 2023.</strong> На стриме 5opka пересматривал фильм «Автостопом по Галактике» (2005), где суперкомпьютер назвал число <strong>42</strong> как «ответ на главный вопрос жизни, Вселенной и всего такого».
            </p>
            <blockquote>
              «А-а-а, сорок два, братуха! Кемеровская область, сорок два, братуха!»
              <cite>— Пятерка, декабрь 2023 — пародия на «52, братуха»</cite>
            </blockquote>
            <p><strong>Что пародирует:</strong> фразу «52, братуха» стримера <strong>Guacamolemolly / Alblak 52</strong> — отсылка к петербургскому рэп-объединению <strong>«52»</strong> (Alblak 52). 42 — ответ-парирование, закреплённое жестом <strong>4 пальца + 2 пальца = 42</strong> и лозунгом <strong>«Кринжа не существует»</strong> — свобода самовыражения (РБК, Афиша Daily).</p>
            <p className={styles.storyNote} style={{ marginTop: 10 }}>Источники — проверено: <a href="https://trends.rbc.ru/trends/social/67d9d9a09a7947c6be91168f" target="_blank" rel="noreferrer">РБК Тренды 19.03.2025 →</a> <a href="https://www.cybersport.ru/tags/strimery/5opka-kirill-baranov-biografiya-karera-mem-42-bratukha-i-skandaly" target="_blank" rel="noreferrer">Cybersport биография →</a> <a href="https://postium.ru/42-bratuxa-chto-znachit-mem/" target="_blank" rel="noreferrer">Postium что значит →</a> · также: Афиша Daily / Secretmag / Циклопедия. Смотри также Викторина42 (вопрос 52 vs 42) и Галерея 42 (арт «Рождение 42»).</p>
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
            <div className={styles.personCard}><div className={styles.personAvatar}>👑</div><strong>5opka</strong><p>Кирилл Александрович Баранов</p><small>05.04.1996 Ростов-на-Дону · школа №65 (2014) · ДГТУ антикризис (не окончил 4к) · YT 27.01.2011 «Боб хавальник» · Twitch с 2016 · «42 братуха!»</small></div>
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
          <h2>Трек «42 feat 6055» — 02.2025 · 2.2M+ · «Везде сорок два, братуха!»</h2>
          <div className={styles.trackHighlight}>
            <p>5opka & 6055 — трек «42» (февраль 2025) набрал <strong>2.2M+ просмотров</strong>. Рефрен — <em>«Везде сорок два, братуха!»</em>. Клип — Пятерка в окружении 42-братух в фирменном стиле. Мем закреплён в Spotify-био 5opka как субкультура, а код 42 Кемеровской области (RU-KEM) — эстер-эпиг лора MAGNUM.</p>
            <div className={styles.trackLinks}>
              <a href="https://risazatvorchestvo.com/track/42" target="_blank" rel="noreferrer">РЗТ трека →</a>
              <a href="https://open.spotify.com/artist/6hSwHa5Se498WfUj6zf4WN" target="_blank" rel="noreferrer">Spotify-био →</a>
              <a href="https://ru.wikipedia.org/wiki/%D0%9A%D0%BE%D0%B4%D1%8B_%D1%81%D1%83%D0%B1%D1%8A%D0%B5%D0%BA%D1%82%D0%BE%D0%B2_%D0%A0%D0%BE%D1%81%D1%81%D0%B8%D0%B9%D1%81%D0%BA%D0%BE%D0%B9_%D0%A4%D0%B5%D0%B4%D0%B5%D1%80%D0%B0%D1%86%D0%B8%D0%B8" target="_blank" rel="noreferrer">Код 42 →</a>
              <a href="https://risazatvorchestvo.com/artist/5opka" target="_blank" rel="noreferrer">Все рецензии →</a>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h2>Конфликты • Пресса</h2>
          <div className={styles.conflicts}>
            <div className={styles.conflict}><strong>vs Guacamolemolly («52»)</strong><p>Пародийный ответ 42 на его «52, братуха» (рэп-объединение 52, Петербург)</p></div>
            <div className={styles.conflict}><strong>vs Вова Солодков</strong><p>Братухи сорвали концерт (14 лет) яйцами на сцену — вмешалась Екатерина Мизулина, СМИ</p></div>
            <div className={styles.conflict}><strong>Бан Twitch 06.04.2026 — «сексуальный контент»</strong><p>Временный бан 06.04.2026 за «сексуальный контент» (Taverna.gg 06.04.26). Реакция: «Хорошо, что забанили, потому что завтра мы клип снимаем. Этот вечер не мог закончиться эпичнее.» — совпало с планом съёмки клипа на следующий день. Накануне — женитьба на Sonasheka 05.04.2026. Пара с баном 19.04.2026 «Безопасность несовершеннолетних» 7д — тема модерации Twitch в прессволе и игре Идеи42.</p></div>
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
