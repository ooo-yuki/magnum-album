# 🎤 MAGNUM — ЧЕЙНДЖЛОГ

> 🌐 **Сайт:** [oooyuki.zomb.top:30645/magnum](https://oooyuki.zomb.top:30645/magnum/) · 🎧 **Пресейв альбома MAGNUM:** [music.thefence.me/psmagnum](https://music.thefence.me/psmagnum)
>
> Промо-сайт альбома **MAGNUM Пятерки** (5opka × 42 братухи). React + TypeScript + GSAP + Bun.
> Формат: [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/). Версионирование — SemVer.

## [0.3.2] — 2026-09-01 🚀 Donate + Ideas 2.0

> **3 коммита** `0945cec` → `9b736ca` · **+599 / −49** · **14 файлов** · VIP-подписки + AiBot-магазин + Ideas 2.0 (34 шаблона)

### ✨ Фичи — Donate / Магазин / Подписки
- 💎 **VIP tiers + glow** — `9b736ca` `POST /magnum/api/shop/subscribe` (vip 420 / vip+ 1420 / pro 4200) списывает `coins` + продлевает `expires`, `GET /magnum/api/shop/subscriptions`, `drizzle/schema.ts` `magnumSubscriptions`, `ShopPage.tsx` +48/−28 блок тарифов с покупкой и отображением активного tier — `src/pages/ShopPage.tsx`, `src/pages/ShopPage.module.css` +16, `server.ts` +82/−2
- ✨ **Сияющая обводка VIP** — `9b736ca` `conic-gradient` glow при активном tier — `src/components/AuthStatus.tsx` +19/−1, `src/components/AuthStatus.module.css` +5, `src/components/Layout.tsx` +2
- 🎁 **PromoPopup спецоффер** — `9b736ca` при входе без `magnum-offer-seen` — попап 42/142/420 −10% 30 сек — `src/components/PromoPopup.tsx` +106, `src/pages/HomePage.tsx` +4

### 🤖 Брат-бот
- 🧠 **AiBot — магазин-подсказки** — `9b736ca` interceptor `что купить` → 3 скина под баланс (`RARITY_PRICE`/`SHOP_CATALOG`) — `src/components/AiBot.tsx` +62

### 🎮 Игры
- 🖱️ **Clicker tier-бонус** — `9b736ca` учёт VIP-множителя в кликах — `src/pages/games/ClickerGame.tsx` +16/−2

### 📖 Дока — Ideas 2.0 + Data
- 💡 **Ideas 2.0** — `0945cec` категории ×6 + 34 шаблона + поиск/фильтры/сортировка + валидаторы + `votedIds` + GSAP entrance — `src/pages/IdeasPage.tsx` +170/−18
- 📊 **Data +5 фактов** — `a0f99bb` 5 фактов 2026-09-01: `research.md` +13, `src/pages/RecapsPage.tsx` +56, `reports/data-2026-09-01-1415.md` +28 — лента пересказов пополнена

### 🧹 Хоз
- 📝 `40b92a8` docs: changelog investor update — уже покрыт секцией [0.3.0] (22 коммита → `004e660`), дубль не создаём

---

## [0.3.1] — 2026-09-01 ✨ P1 аудит закрыт

> **P1 closed** — 8 пунктов аудита 2026-09-01 → 0 · **+~600 / −2440** · **App 16/16 + economy −2440 + drizzle 0005 + спеки Blackjack/Roulette + sitemap 32**

### 🔧 Fixed — P1 аудита

- 🩹 **App vs README** — `src/App.tsx` `14→16 games code-split` (комменты + lazy 16), `README` P1 бейдж + `✨ P1 закрыт` блок — `App 16/16` синхронизирован
- 🧹 **economy.ts дубли** — `src/lib/economy.ts` `2520→80 строк` (−2440): удалены `QUEST_1..69` заглушки, добавлен `RARITY_PRICE` + `SHOP_CATALOG 12` + `getItemPrice/isValidShopId` + единый `Quest` (синхрон с `ShopPage 42/142/420/1420`)

### ✨ Added — Спеки Blackjack/Roulette открытка

- 🃏 **Blackjack спека 4200** — `docs/SPEC-42.md §7.1` + `docs/games-spec.md`: `1000→4200 + postcard-4200.png + presave`, BJ 3:2, soft17, double, reshuffle<12, WebAudio `safeRamp`
- 🎰 **Roulette спека 4200** — `§7.2` + `games-spec.md`: `10 пресетов`, `35:1/2:1/1:1`, `hot/cold`, `swipe/confetti/×2/↻/autoSpin`, `0-36 European`
- 🧪 **Тесты 4200** — `tests/blackjack-roulette-spec.test.ts` +18: проверки `GOAL 4200`, LS, BJ логики, 10 пресетов, выплат, модалки открытки

### 🗄️ DB — drizzle миграция

- 💾 **magnum_presave_clicks** — `drizzle/migrations/0005_magnum_presave_clicks.sql` + `_journal.json idx5`, `schema.ts` уже имел таблицу — миграция идемпотентна `IF NOT EXISTS`

### 📖 Docs — README/CHANGELOG с эмодзи

- 📝 **README** — бейдж `P1 audit closed`, блок `✨ P1 закрыт`, тесты `2897→2915 (17 файлов)`, фичи Roulette пресеты hot/cold
- 📖 **SPEC-42** — §9.2 переписан под новый economy (таблица 12 скинов), §7 дополнен 7.1/7.2
- 🗺️ **Sitemap 32** — `build.ts ROUTES 32` + `public/sitemap.xml 32 urls` проверен (`grep -c <url>`), lastmod 2026-09-01

### ⚡ Perf / CI

- ✅ `tsc 0`, `bun test 2915 passed (17 файлов)`, `build → dist + sitemap sync`, `cp /srv/magnum`

## [0.3.0] — 2026-09-01

> **22 коммита** с `8c241b3` (13:44 UTC) → `004e660` (14:11 UTC) · **+3541 / −350** · **26+ файлов** · инкремент 2042 MAGNUM + Rhythm v3 + API пресеты + lazy −51% + 2897 тестов, рейтинг 6/10

### 🔥 Инкремент 14:01–14:12 — 14 коммитов (с `459c489` → `004e660`)

#### 🎮 Игры — 2042 MAGNUM + Rhythm v3
- **2042 MAGNUM upgrade** — `4e18115` **TILE_LORE×12** (мемы 42: «Кузбасс», «ТУСА», «CLAY»…), **WebAudio** slide/bump/chord, **GSAP** board/merge/confetti, streak + прогресс до 2042, управление **WASD/H/CtrlZ** (undo/history), `src/pages/games/Game2042.tsx` +273/−77, `src/App.tsx` +44 — 2048 теперь с лором MAGNUM
- **Rhythm v3 — пауза + хинты** — `4f93a34` `Space/P/Esc` пауза (`pausedTime` вычитается, canvas замирает), `missStreak≥3` хинт «бей раньше», `success` сбрасывает streak, `pausedTime` фикс, `src/pages/games/RhythmGame.tsx` +32/−9, `tests/rhythm-enhanced.test.ts` +14

#### ✨ Фичи — Пресейв/Mining/Coin + Идеи
- **API пресеты и топы** — `fcb3c92` `server.ts` +81: `GET /magnum/api/presave/stats` + `POST /magnum/api/mining/collect` + `GET /magnum/api/mining/top` + `GET /magnum/api/coins/top` + `GET /magnum/api/health`, rate-limit + валидация — экономика теперь с серверным топом
- **Hype +3 идеи** — `459c489` +66: `DUEL LOBBY 2-4` (WebSocket арена wager 0/42/142/420, код ABCD, heartbeat 25с), `ЭКО-РЕЙТИНГ v2 — босс Кузбасса 7дн` (8Q квиз Томь/42, conic-gradient бейдж), `LIMITED DROP 42` (6 скинов/72ч тираж 42, FOMO-таймер) — `docs/hype-queue.md` +16, `reports/hype-2026-09-01-1401.md` +50, очередь 8

#### ⚡ Перфоманс — lazy 9 heavy pages −51%
- **Lazy 9 страниц** — `4dde858` `src/App.tsx` 9 heavy pages → `React.lazy` + `Suspense`: **Gallery 441KB + Recaps 277KB** вынесены из main, **main 1037→509KB (−51%)**, gzip **206→143KB (−31%)**, stale `dist 53→29MB (−45%)`, chunks 55→69 (+9), `tsc 0`, `reports/perf-2026-09-01-1411.md` +105 — LCP теперь лёгкий

#### 🔐 Auth / Neon
- **Auth check** — `bb74e56` `reports/auth-2026-09-01-1411.md` +188: проверка Neon `magnum_users/sessions`, gate WS 401 без токена держится
- **API validation** — `fcb3c92` rate-limit + validation для presave/mining/coins, `drizzle/migrations/meta/_journal.json` +7 — анти-абуз на сервере

#### 🧪 Тесты / CI
- **2897 passed** — `ae93589` **2897 passed (16 файлов, +29 `new-coverage-1410`)**, `tsc 0`, vitest `reports/test-2026-09-01-1410.md` +118, `tests/new-coverage-1410.test.ts` +157 — покрытие 2897
- **2868 passed** — `2dee8ef` **2868 passed (15/15, tsc 0)** +12 `gallery/api/games`, `tests/gallery-api-games.test.ts` +120, `reports/test-2026-09-01-1403.md` +99, `drizzle/migrations/meta/_journal.json` +7
- **watchdog 14:11** — `cc3ec55` ✅ **OK all 200, 6 gallery**, no restart (WS anon + vote bypass) — `reports/watchdog-2026-09-01-1411.md` +85
- **watchdog 14:02** — `1ae5526` ✅ **OK all 200, 6 gallery, 2862 tests**, no restart — `reports/watchdog-2026-09-01-1402.md` +62
- **health 14:06** — `76bfdf8` **OK (local 200, ext FAIL hairpin / 200 via resolve)** — `reports/health-2026-09-01-1406.md` +58
- **review 6/10** — `3e8b412` rating **6/10** 🟡 `reports/review-2026-09-01-1409.md` +77 — скачок с 2/10, осталось добить архивные 42 картинки
- **review 2/10** — `edb467c` rating **2/10** 🔴 `reports/review-2026-09-01-1408.md` +84 — окно 10м, низкая активность

#### 📖 Дока
- **README keeper** — `004e660` +16/−14 `README.md`: **Tests 2897**, 2042/Roulette/Mining/Presave updates, **11 Neon tables**, lazy chunks **510KB** — инвестор видит актуальный стек без чтения кода

---

### 🔥 Инкремент 13:51–13:55 — 8 коммитов (с `8c241b3` → `2866803`)

#### 🎮 Игры — Roulette42 ×10 + эффекты
- 🎰 **Roulette42 пресеты** — `8ccb5b7` + `786084e` пресеты ставок ×10, hot/cold статистика, кнопки ×2/↻ (удвоить/повтор), конфетти-канвас + WebAudio выигрыша, свайп-ставка — `src/pages/games/RouletteGame.tsx` +154/−43, `drizzle/schema.ts` +8 — казино теперь как в Лас-Вегасе
- 🧪 **Roulette тесты** — `786084e` +72/−5 `tests/content.test.ts`, правки `massive42*.test.ts` — покрытие пресетов и hot/cold

#### ⚡ Перфоманс — GSAP polish
- ✨ **GamesHub + NavGrid polish** — `825c0a6` y24 → 0 stagger **0.12** ScrollTrigger, RGB-неон tri-shadow, `prefers-reduced-motion` gate, `gsap.context` cleanup — `src/pages/GamesHub.tsx` +35/−26, `src/components/NavGrid.tsx` +40/−14 — 60 fps без дёрга

#### 🔐 Фиксы — Auth gate + Gallery
- 🔒 **Auth gate multiplayer** — `55de093` WS **401 без токена**, `AuthStatus` модалка Вход/Регистрация, `auth-guardian` 12/11 — `drizzle/migrations/0004_presave_mining_collect.sql` +22 — мультиплеер теперь за замком
- 🖼️ **Gallery real images** — `2866803` фикс soft-404: реальные `archive-*.jpg` вместо `text/html`, + апгрейд ревьюера — `src/pages/GalleryPage.tsx` +1/−1, `src/pages/PresaveRatingPage.tsx` +88/−38 в батче `786084e`

#### 📖 Дока / CI / Тесты
- 🧪 **2850 passed** — `786084e` vitest **13/13**, `tsc` 0, **+16 new** — `tests/bun-setup.ts` +98, `tests/gallery-real.test.ts` +93, `bunfig.toml` +2, `docs/SPEC-42.md` +697, `docs/spec-audit-2026-09-01.md` +273 — спека 42 теперь канон
- 📊 **watchdog 13:51** — `4dd07eb` OK (**200/200/200**, Up, 6 файлов, 2850 тестов, 0 рестартов) — `reports/watchdog-2026-09-01-1351.md` +65
- 🔍 **review 13:54** — `b53bc0d` rating **4/10** 🟡 (было 2/10) — `reports/review-2026-09-01-1354.md` +78 — прогресс +2, остался Gallery/WS до 8/10
- 📝 **changelog investor update** — `7790c8e` +28/−31 `CHANGELOG.md` — предыдущий инкремент задокументирован

---

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

[0.3.0]: https://github.com/ooo-yuki/magnum-album/releases/tag/v0.3.0
[0.2.0]: https://github.com/ooo-yuki/magnum-album/releases/tag/v0.2.0
[0.1.0]: https://github.com/ooo-yuki/magnum-album/releases/tag/v0.1.0
