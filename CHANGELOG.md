# 🎤 MAGNUM — ЧЕЙНДЖЛОГ

> 🌐 **Сайт:** [oooyuki.zomb.top:30645/magnum](https://oooyuki.zomb.top:30645/magnum/) · 🎧 **Пресейв альбома MAGNUM:** [жми сюда, братуха](https://oooyuki.zomb.top:30645/magnum/)
>
> Промо-сайт альбома **MAGNUM Пятерки** (5opka × 42 братухи). React + TypeScript + GSAP + Bun.
> Формат: [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/).

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

[0.1.0]: https://github.com/ooo-yuki/magnum-album/releases/tag/v0.1.0
