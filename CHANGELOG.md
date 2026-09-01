# 🎤 MAGNUM — ЧЕЙНДЖЛОГ

> 🌐 **Сайт:** [oooyuki.zomb.top:30645/magnum](https://oooyuki.zomb.top:30645/magnum/) · 🎧 **Пресейв альбома MAGNUM:** [music.thefence.me/psmagnum](https://music.thefence.me/psmagnum)
>
> Промо-сайт альбома **MAGNUM Пятерки** (5opka × 42 братухи). React + TypeScript + GSAP + Bun.
> Формат: [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/).

## [0.2.0] — 2026-09-01

### 🎮 Игры

- 🐍 **Snake 42** — 14-я мини-игра: canvas-змейка с WASD/тач/свайп, WebAudio, победа при длине 42, 12 новых тестов
- 🧱 **Stack42** — комбо ×2 множитель (3 perfect → ×2 очков/частиц/звука), MEGA 5× + хил ширины, баланс: мягкий старт 1.85 / рост 0.14 + потолок 6.2, окно perfect 7px
- ⌨️ **Скоропечатание 42** (TypingGame) — 12 фраз MAGNUM 2026, WPM-трекинг, кнопка пресейва в конце

### 🤖 БРАТ-БОТ

- 📺 **RecapsPage** — лента пересказов Freakland/СП/нарезки (6 карточек, фильтры, транскрипты) + `/magnum/recaps` роут + 5 идей в Neon

### 🖼️ Открытка / Галерея

- 🖼️ **Галерея** — реальная 42-agit-01 (3.4MB) заменяет моковый ковёр

### ✨ Фичи

- 🛒 **Магазин / Эко / Рамка** — Neon-эндпоинты shop/eco/frame
- 📊 **Рейтинг пресейва** — реальный Neon-рейтинг, трекер кликов `magnum_presave_clicks`
- 🔐 **AuthStatus в шапке** — Neon `me`-эндпоинт, без localStorage, 826KB
- 💡 **Ideas 42** — голосование за идеи через Neon (`magnum_ideas`), форма отправки, навигация расширена до 10 пунктов
- ⛏️ **Майнинг 42-коинов** — ироничный GSAP-кликер: лопата 42 / кирка 142, авто-майнинг, лидерборд в localStorage
- 📊 **Рейтинг пресейва** — топ-20 братух (8K клипов / 200K просмотров), эмодзи-аватары, проверка через БРАТ-БОТ
- 🛒 **Магазин / Эко / Майнинг** — все эндпоинты перенесены на `/magnum/api/*`, баланс теперь серверный (убран localStorage)
- 🏠 **Главная + навигация** — 14 пунктов меню, 4 RGB промо-баннера + popup (закрытие через `magnum-banner-closed`), GamesHub очищен до мини-игр
- ⛏️💡🎮 **Mining + Ideas + WebSocket** — `magnum_mining` (user_id, balance, upgrades jsonb), `/magnum/api/ideas` GET/POST/vote, `/magnum/api/mining` GET/click/upgrade, WS `/magnum/api/ws` 2-4 duel realtime broadcast, `magnum_leaderboard`, без localStorage

### ⚡ Перфоманс

- ✨ **GSAP entrance** — stagger 0.12, y 24→0, hover RGB glow, reduced-motion fallback, context cleanup — HomePage PromoBanners, GalleryPage header/cards, IdeasPage header/form/cards
- 🔄 Рефакторинг фронта: coins/shop/eco/mining → серверные API-маршруты, отказ от клиентского localStorage для баланса

### 🐛 Фиксы

- 🚫 **Ideas/Рейтинг** — убраны фейки, только реальные зарегистрированные (Neon 0/0/0 пусто → «стань первым»)

### 📖 Документация

- 📝 **README** — продакшн уровень 000 (Live/Presave бейджи, стек, Neon, кроны 24/7, структура)

---

## [0.1.0] — 2026-09-01

### 🎮 Игры

- 🃏 **Blackjack 42** — блэкджек с GSAP-анимациями, ставка/удар/стоп, выигрыш 4200 монет открывает открытку
- 🎡 **Roulette 42** — европейская рулетка 0–36 на canvas: ставки на число/цвет/чёт/дюжины, фишки 1/5/25/100, баланс 1000→4200, шарик, localStorage
- 🥁 **Rhythm** — ритм-игра на canvas: попадания в такт, комбо и очки
- 🧱 **Stack** — башня из блоков: точность решает, промах срезает ширину
- 💎 **Match-3** — три-в-ряд с обменом соседних кристаллов и каскадами
- 🔪 **Knife Hit** — ножи в яблоко: тайминг бросков, не попади в другой нож
- 🏃 **Runner** — раннер с прыжками через препятствия и нарастающей скоростью
- 🧠 **Memory** — парные карты на память с таймером и счётом ходов
- 🖱️ **Clicker** — кликер с апгрейдами и авто-кликом
- ❓ **Quiz** — квиз про MAGNUM и 5opka: варианты ответов, фидбек и результат
- 🏙️ **GamesHub** — хаб всех игр с карточками, 3D magnetic-tilt и glow-эффектами
- 💾 Общий прогресс игр сохраняется в **localStorage**

### 🤖 БРАТ-БОТ 42

- 🧠 AI-чат на модели **mimo-v2.5** через собственный прокси на Bun.serve
- 👁️ **Vision-проверка скринов пресейва** — бот видит картинку и проверяет, сделал ли братуха пресейв
- 🗜️ Сжатие скринов до 1280px JPEG на клиенте перед отправкой в MiMo vision
- 🛣️ AI-прокси в `Bun.serve` fetch: API-роут + SPA fallback для static/dist
- 🔒 API-ключ хранится на сервере, в браузер не утекает

### 🖼️ Открытка 4200

- 🎁 Приз казино 42 — уникальная **открытка за 4200 монет**
- 🖼️ postcard-4200 asset + картинка в модалках выигрыша Blackjack/Roulette
- 📲 В модалке — прямая кнопка **пресейва альбома**

### ✨ Фичи

- 🕰️ **Timeline** — 8 вех 2011→2026 с GSAP-параллаксом (200+ строк)
- 📰 **News2026** — 6 карточек инфоповодов MAGNUM/VPN/CLAY/тур/пресейв (GSAP stagger, RGB hover)
- 📰 **PressWall** — стена прессы и цитат о MAGNUM
- 🌈 **RGB-пасхалки** — RGB-неон и спецэффекты по всему сайту
- 🕹️ **Konami-код** — секретная комбинация, счётчик срабатываний ×N в футере
- 🎊 **Конфетти** — конфетти в футере и на главной
- 🗂️ **Discography** — фильтры год/альбом/жанр, поиск, сортировка, анимированные счётчики
- 🚀 **CTA** — 3 карточки ЯМ/Spotify/YT + proof line
- 📊 **Stats** — блок статистики «+42 братухи»
- 🧩 Мультистраничник: 7+ страниц (React Router), About42, Artists, Track, LastFit

### 🧪 Тесты и CI

- ⚗️ **vitest** — 13+ тестов: smoke, e2e health, game2042, flappy42 — все зелёные
- 🤖 **GitHub Actions** — автодеплой workflow (deploy.yml)
- 🧯 Health-check: e2e-тест живости + `health-check.sh` + bun-тест деплоя (150+ строк, tsc 0 ошибок)
- 🛠️ Сборка на **Bun.build + Bun.serve** вместо Vite

### ⚡ Производительность

- 📦 **Vendor split** — отдельные чанки vendor-библиотек для кэша
- 🦥 **Lazy loading** — ленивые изображения и `prefers-reduced-motion` для частиц/конфетти
- 🔍 **SEO** — OG/Twitter-мета, json-ld, canonical, sitemap+robots, lazy img
- 📱 Мобильный responsive + burger-меню

### 🐛 Фиксы

- 🔧 Vite base path для `/magnum/` субдиректории
- 📐 Мобильный responsive + NavGrid навигация на главной
- 🎯 Focus-visible кольца на NavGrid/CTA (a11y, WCAG 2.4.1)
- ♿ Skip-to-content ссылка и `prefers-reduced-motion` везде

[0.2.0]: https://github.com/ooo-yuki/magnum-album/releases/tag/v0.2.0
[0.1.0]: https://github.com/ooo-yuki/magnum-album/releases/tag/v0.1.0
