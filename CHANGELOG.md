# 🎤 MAGNUM — ЧЕЙНДЖЛОГ

> 🌐 **Сайт:** [oooyuki.zomb.top:30645/magnum](https://oooyuki.zomb.top:30645/magnum/) · 🎧 **Пресейв альбома MAGNUM:** [music.thefence.me/psmagnum](https://music.thefence.me/psmagnum)
>
> Промо-сайт альбома **MAGNUM Пятерки** (5opka × 42 братухи). React + TypeScript + GSAP + Bun.
> Формат: [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/). Версионирование — SemVer.

## [0.2.0] — 2026-09-01

> **23 коммита** с `9733759` (12:35 UTC) → `8c241b3` (13:44 UTC) · **+28 366 / −588** · **30 файлов** · инкремент +266/−25 за последние 20 мин

### 🔥 Инкремент 13:41–13:44 — 4 коммита (с `0b82f04` → `8c241b3`)

#### 🎮 Игры — 2042 + Rhythm
- **Game2042** — `8c241b3` undo стек 6 ходов, счётчик moves, hint-подсветка лучшего хода (glow), фикс `gsap` импорта, +55/−6 `Game2042.tsx` + 4 строки CSS — UX 2048 как в оригинале
- **Rhythm 42** — `8c241b3` уровни сложности easy/normal/hard: окна попаданий / скорость нот / условие победы, UI-селектор, `draw` теперь использует `curD.speed` — баланс под новичков и хардкор

#### ✨ Фичи — документация
- **README keeper** — `133bcc6` +14/−6: **16 игр (+Timeline2026)**, структура проекта, кроны 21 джоб, стек Bun.serve + Neon — инвестор видит полную картину без чтения кода

#### ⚡ Перфоманс
- **PageLoader failsafe** — `8c241b3` fallback timeout **2200 мс** для Obscura/headless: фиксит белый экран когда `load` не файрит из-за TLS/iframe — критично для `oooyuki.zomb.top:30645`

#### 🧪 Тесты / CI
- **game2042-enhanced** — `8c241b3` +15 строк: тесты undo, moves, hint, difficulty windows (easy/normal/hard)
- **health 13:42** — `28583d9` OK (local 200, ext FAIL hairpin) — мониторинг 200/200 локально, внешний hairpin ожидаемо FAIL
- **review 13:43** — `f7a0d37` rating **2/10** 🔴 — галерея soft-404 (350 archive-*.jpg → 200 text/html), 1 failed suite `massive42.test.ts:703 Unexpected "}"` — CI красный, требует фикса

### 📦 Батч 12:35–13:06 — 19 коммитов (база `9733759` → `9281b1a`)

#### 🎮 Игры — 6 полировок
- 🎲 **Game2042** — `622c9a5` win/lose звуки + screen-shake, Timeline2026Game + CSS (293+303 строк), GamesHub фикс, sitemap обновлён
- 🐦 **Flappy 42** — `dbb42c1` полировка #2: +273/−103, плавность труб, баланс скорости, GSAP-тряска
- 🐍 **Snake / 2048** — `f497b39` полировка #2: +314/−98, Snake42Game — улучшен рендер canvas, свайпы и звуки
- ❓ **Quiz** — `b3274ec` полировка #2 + `885d364` QuizGame.module.css (44 строки) и 435 строк логики квиза в About-ветке
- 🖱️ **Clicker** — `481b176` полировка #2 + `5837eca` 629 строк: GSAP-апгрейды, RGB-неон, баланс кликов (ClickerGame.tsx)
- 🧱 **Stack42 / Memory / Knife Hit** — база из прошлого батча сохранена, новые шейки и тайминги

#### 🤖 БРАТ-БОТ
- 🧠 **AiBot polish** — `dedcb06` +222/−80 `src/components/AiBot.tsx`: улучшена обработка vision-пресейва, стриминг ответов MiMo, UX лоадера и ошибок

#### 🖼️ Открытка / Галерея
- 🖼️ **Gallery 2** — `d56f60f` GalleryPage.tsx +808/−1: stagger 0.12, y 24→0 entrance, hover RGB glow, reduced-motion gate, реальный арт 42-agit-01
- 🔗 **Gallery infra** — `622c9a5` GalleryPage +1090 строк (параллельно с Game2042), perf-analytics + coins/economy прокинуты под галерею

#### ✨ Фичи — контент / GSAP / страницы
- 📺 **Recaps + Hype** — `9281b1a` **massive 2**: RecapsPage +380 строк, hype-features.md +1350, massive42_2.test.ts +1056
- 📺 **Recaps + Hype 3** — `801be8d` perf-analytics рефактор +119/−119 под Recaps/hype пайплайн
- 🔥 **Hype 2** — `763ae16` hype-features.md +89 (идеи для пресейва)
- 💡 **Recaps + Ideas 2** — `841274f` RecapsPage +38, BlackjackGame +100 (открытка 4200 путь)
- 🔥 **Hype + Ideas** — `bc0bac8` hype-features.md +137
- 🏛️ **About / Hero 2** — `885d364` About42Page +225/−54, AboutPage +376 (новый роут), QuizGame 435 строк, App.tsx роут
- 📰 **PressWall / CTA 2** — `b9ff496` PressWall +124/−23: GSAP entrance карточек прессы, RGB hover
- 🎵 **TrackPage** — `5837eca` reduced-motion gate + hover RGB neon на stat/listen cards (+59), ClickerGame RGB polish
- 🛒 **Shop polish 2** — `811c12f` ShopPage +1 (GSAP hover-фикс, подготовка к серверному балансу)

#### 🧪 Тесты / CI
- 🧪 **massive42_2** — `9281b1a` tests/massive42_2.test.ts +1056 строк (Recaps + hype сценарии)
- 🧪 **massive42** — `d56f60f` tests/massive42.test.ts +3153 строк + timeline2026.test.ts +101
- 📊 Покрытие игр и Recaps расширено

#### ⚡ Перфоманс
- 📈 **massive analytics** — `814b1b8` perf-analytics.ts ±99 рефактор аналитики (батч для massive)
- 🛡️ **ErrorBoundary polish** — `8fe9cab` +192/−38: улучшен fallback UI, логирование, retry
- 🦥 **PressWall lazy** — `a320a7d` +10 строк lazy-загрузка прессы (intersection observer)
- 🔗 Ранее: App lazy, preconnect Neon, sitemap, gallery lazy, avatar sitemap

#### 🐛 Фиксы
- 🐍 Snake42 import — сохранён фикс lazy-паттерна code-split (из базы 0.2.0)
- 🃏 Quiz/Clicker — точечные фиксы импортов и кликов (1-строчные патчи `b3274ec`, `481b176`, `811c12f`)

#### 🔐 Auth / Neon
- 🔐 AuthStatus в шапке (Neon `me`, без localStorage) — из базы 0.2.0, без изменений в этом батче
- 💾 Миграция на серверный баланс (`magnum_mining`, `magnum_ideas`, WebSocket `/magnum/api/ws`) — сохранена

---

## [0.2.0 — база] — 2026-09-01 (до 12:35 UTC)

### 🎮 Игры (база)
- 🐍 **Snake 42** — 14-я мини-игра: canvas-змейка с WASD/тач/свайп, WebAudio, победа при длине 42, 12 новых тестов
- 🧱 **Stack42** — комбо ×2 (3 perfect → ×2), MEGA 5× + хил ширины, баланс 1.85/0.14 потолок 6.2, окно perfect 7px
- ⌨️ **Скоропечатание 42** — 12 фраз MAGNUM 2026, WPM-трекинг, кнопка пресейва
- 🧠 **Memory** — GSAP flip карт, UX таймера
- 🔪 **Knife Hit** — эффекты попаданий, баланс скоростей
- 🥁 **Rhythm + Stack** — плавность, скоринг

### 🤖 БРАТ-БОТ (база)
- 📺 **RecapsPage** — лента пересказов Freakland/СП/нарезки (6 карточек, фильтры, транскрипты) + `/magnum/recaps` + 5 идей в Neon

### 🖼️ Открытка / Галерея (база)
- 🖼️ **Галерея** — реальная 42-agit-01 (3.4MB)

### ✨ Фичи (база)
- 🛒 Магазин/Эко/Рамка — Neon-эндпоинты shop/eco/frame
- 📊 Рейтинг пресейва — `magnum_presave_clicks`, топ-20
- 🔐 AuthStatus в шапке — Neon `me`, без localStorage
- 💡 Ideas 42 — Neon `magnum_ideas`, форма, 10 пунктов меню
- ⛏️ Майнинг 42-коинов — лопата 42/кирка 142, авто-майнинг
- 🏠 Главная + навигация — 14 пунктов, 4 RGB баннера + popup
- ⛏️💡🎮 Mining+Ideas+WebSocket — `magnum_mining`, `/magnum/api/*`, WS duel 2-4
- 🎬 GSAP Timeline scrub, Home/CTA, Shop/Mining анимации

### ⚡ Перфоманс (база)
- ✨ GSAP entrance stagger 0.12, hover RGB glow, reduced-motion, context cleanup
- 🔄 coins/shop/eco/mining → серверные API, без localStorage
- 🦥 App lazy, 🔗 preconnect + sitemap, 🖼️ gallery lazy

### 🐛 Фиксы (база)
- 🚫 Ideas/Рейтинг — убраны фейки, «стань первым»
- 🐍 Snake42 import — фикс lazy-паттерна

### 📖 Документация (база)
- 📝 README — продакшн 000 (Live/Presave бейджи, стек, Neon, кроны 24/7)
- 📝 README keeper — +5 страниц, +2 игры (snake/dodge), 14→15 роутов

---

## [0.1.0] — 2026-09-01

### 🎮 Игры
- 🃏 **Blackjack 42** — ставка/удар/стоп, 4200 монет → открытка
- 🎡 **Roulette 42** — 0–36 canvas, фишки 1/5/25/100, баланс 1000→4200
- 🥁 **Rhythm** — попадания в такт, комбо
- 🧱 **Stack** — башня, промах срезает ширину
- 💎 **Match-3** — каскады
- 🔪 **Knife Hit** — тайминг бросков
- 🏃 **Runner** — прыжки, нарастающая скорость
- 🧠 **Memory** — парные карты
- 🖱️ **Clicker** — апгрейды + авто-клик
- ❓ **Quiz** — про MAGNUM и 5opka
- 🏙️ **GamesHub** — 3D magnetic-tilt + glow
- 💾 Прогресс в localStorage

### 🤖 БРАТ-БОТ 42
- 🧠 mimo-v2.5 через прокси Bun.serve
- 👁️ Vision-проверка скринов пресейва
- 🗜️ Сжатие 1280px JPEG на клиенте
- 🛣️ API-роут + SPA fallback
- 🔒 Ключ на сервере

### 🖼️ Открытка 4200
- 🎁 Приз казино — открытка за 4200
- 🖼️ postcard-4200 asset + модалки Blackjack/Roulette
- 📲 Кнопка пресейва

### ✨ Фичи
- 🕰️ Timeline 2011→2026 GSAP-параллакс (200+ строк)
- 📰 News2026 6 карточек, PressWall, RGB-пасхалки, Konami-код, конфетти, Discography, CTA, Stats, 7+ страниц

### 🧪 Тесты и CI
- ⚗️ vitest 13+ тестов, 🤖 GitHub Actions deploy.yml, 🧯 health-check.sh + bun-тест (150+ строк), 🛠️ Bun.build + Bun.serve

### ⚡ Производительность
- 📦 Vendor split, 🦥 Lazy + prefers-reduced-motion, 🔍 SEO OG/json-ld/canonical/sitemap, 📱 responsive + burger

### 🐛 Фиксы
- 🔧 Vite base `/magnum/`, 📐 responsive + NavGrid, 🎯 focus-visible, ♿ skip-to-content

[0.2.0]: https://github.com/ooo-yuki/magnum-album/releases/tag/v0.2.0
[0.1.0]: https://github.com/ooo-yuki/magnum-album/releases/tag/v0.1.0
