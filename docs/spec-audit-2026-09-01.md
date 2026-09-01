# MAGNUM — аудит спецификаций 2026-09-01

> Код в `/root/magnum-album` (366b0fe). Проверены: `src/pages/*.tsx`, `src/pages/games/*.tsx`, `src/components/*.tsx`, `src/lib/*.ts`, `server.ts`, `docs/*.md`, `research.md`, `README.md`, `public/images/gallery-42/*`. Без код-изменений — только аудит.

---

## 1) Сводная таблица: фича → есть ли спека → где → несостыковки

| # | Фича (код) | Есть спека? | Где спека | Несостыковки (конкретика `файл:строка`) |
|---|---|---|---|---|
| 1 | **Галерея 42** `src/pages/GalleryPage.tsx:1-2570` | ⚠️ частично | `README.md:24` (1 строка), `docs/hype-features.md` — нет отдельной секции, внутри `GalleryPage.tsx:791-853` inline-TOKENS/I18N/GALLERY_CHANGELOG имитируют спеку | Было 350 фейковых `src` (`archive-СССР-001.jpg` и т.п. `GalleryPage.tsx:182-350+` 210 + `638-780` 140). Исправлено переписыванием `for (const a of ARCHIVE_42) a.src = REAL_BY_STYLE[a.style]` `785-787` → 404 устранён. Но: в исходниках всё ещё 350 объявлений фейковых путей, которые переписываются runtime-мутацией (мутирует константный массив, неочевидно ревьюеру). Визуально 350 карточек → только 3 уникальных картинки (дубли). `REAL_BY_STYLE` маппит 4 стиля на 3 файла: `СССР→42-agit-01-800.webp`, `киберпанк→42-cyber-01-800.webp`, `Y2K/мемфис→42-memphis-01-800.webp` — Y2K и мемфис неразличимы. `public/images/gallery-42/` всего 6 файлов: `42-agit-01.{jpg,800.webp}`, `42-cyber-01.{jpg,800.webp}`, `42-memphis-01.{jpg,800.webp}`. Нет 404-check в CI (test не ловил). Файл раздут до 2570 строк inline-докой (TOKENS 180стр, I18N 220стр, CHANGELOG 120стр, FIXTURES 200стр) — не является спекой, но маскируется под неё. |
| 2 | **Игры — хаб** `src/pages/GamesHub.tsx`, `src/App.tsx:22-38` | ❌ нет | `README.md:19` таблица, `CHANGELOG.md:14-19` | Спеки нет ни на одну игру. `App.tsx` lazy 16 игр, `GamesHub.tsx:6-23` хардкод 16 карточек, `README` пишет «15 игровых роутов» → расхождение 15 vs 16 (добавлена `timeline` без обновления README). Нет секции `docs/games-spec.md`. Нет описания правил, побед, наград 4200 монет, связи с `magnum-coins`. |
| 3 | **Runner** `src/pages/games/RunnerGame.tsx:1-23311b` | ❌ | — | Нет спеки. Нет `prefers-reduced-motion` gate (grep 0 совпадений). GSAP длительности не документированы. |
| 4 | **Match-3** `Match3Game.tsx` | ❌ | — | Нет спеки. |
| 5 | **Knife Hit** `KnifeHitGame.tsx` | ❌ | — | Нет спеки. |
| 6 | **Memory** `MemoryGame.tsx` | ❌ | `CHANGELOG` упомянуто | Нет спеки. GSAP без `gsap.context` cleanup в части веток (проверить `MemoryGame.tsx:210,249,320` — есть прямые `gsap.to` без контекста). Нет reduced-motion. |
| 7 | **Clicker** `ClickerGame.tsx` | ❌ | `docs/hype-features.md:1` duel упоминает Clicker как базу, но не эту игру | Нет спеки. `src/pages/games/ClickerGame.tsx:218,290,338` — нет `gsap.context`, нет reduced-motion, прямые `gsap.to` по `pageRef`. Отдельная спека DuelClicker в hype-features не реализована, а ClickerGame — другой файл. |
| 8 | **Quiz** `QuizGame.tsx` + `src/pages/GamePage.tsx:1-339` (8q квиз) | ⚠️ дубли | `hype-features.md:2` (Эко-квиз 8Q) — но GamePage/QuizGame — другой квиз | Дублирование: `GamePage.tsx:14-88` старый 8-вопросный квиз про 42/CLAY/XXL + `QuizGame.tsx:1-...` новый QuizGame с другими вопросами → два несвязанных квиза, спека описывает только `EcoQuizPage` которого нет (файл ожидался `EcoQuizPage.tsx` по hype-spec `140`, а реализован `EcoPage.tsx` + `QuizGame`). Спека и вопросы расходятся (в спеке Томь/Кемерово, в GamePage — про Дмитриев Маликова и т.п.). |
| 9 | **Blackjack 42** `BlackjackGame.tsx:1-23272` | ❌ | `README:19` `4200 монет → открытка` | Нет спеки правил (когда 4200, как открытка). Нет GSAP совсем (0 строк) — нарушает единый GSAP-стиль если требовался. Нет связи `addCoins` (grep 0 `addCoins` в games) — монеты начисляются локально? |
| 10 | **Roulette 42** `RouletteGame.tsx` | ❌ | `README:19` | Нет спеки. GSAP есть `RouletteGame.tsx:77,182,195` но без reduced-motion, без context cleanup. |
| 11 | **Rhythm** `RhythmGame.tsx:1-24624` | ❌ | — | Нет спеки. |
| 12 | **Stack 42** `Stack42Game.tsx` | ❌ | — | Нет спеки. |
| 13 | **2042 (Game2042)** `Game2042.tsx:1-11939` | ❌ | — | Нет спеки. Тесты `tests/game2042.test.ts` есть, но спеки нет. |
| 14 | **Flappy 42** `Flappy42Game.tsx:1-22320` | ❌ | — | Нет спеки. |
| 15 | **Typing** `TypingGame.tsx:1-14248` | ❌ | — | Нет спеки. |
| 16 | **Snake 42** `Snake42Game.tsx:1-26293` | ❌ | — | Нет спеки. |
| 17 | **Dodge 42 (5 ПУЛЬ)** `Dodge42Game.tsx:1-16958` | ❌ | `README:19` `Dodge 42` | Нет спеки. |
| 18 | **Timeline 2026** `Timeline2026Game.tsx:1-12762` | ⚠️ | `docs/hype-features.md:7.4 Freakland Timeline` (задумка) | Игра есть, но hype-spec описывает её как секцию `RecapsPage`, а реализовано как отдельная игра `/magnum/games/timeline`. Нет спеки правил (перетаскивание дат). |
| 19 | **Магазин** `src/pages/ShopPage.tsx:1-...` + `src/lib/coins.ts` + `src/lib/economy.ts` | ⚠️ частично | `docs/hype-features.md:3` (Магазин 12 скинов LS-only), `README.md:21` | Спека в hype описывает **LS-only** каталог 12 скинов с ключами `magnum-inventory`/`magnum-equipped`/`magnum-coins`. Код **уехал на сервер**: `ShopPage.tsx:79` `GET /magnum/api/shop/state` (нет на сервере), `:91` `GET /shop/inventory` (есть), `:92` `GET /shop/equipped` (нет), `:210` `POST /shop/purchase` (нет), `:263` `POST /shop/unequip` (нет) — 4 из 6 ручек 404. Сервер имеет только `shop/buy` `shop/equip` `shop/inventory` `server.ts:821-823`. Клиент шлёт `purchase`/`unequip`/`state`/`equipped` → вечный fallback. `src/lib/economy.ts:6-20` дублирует магазин с другими id `skin_common_01` vs `neon-42` и ценами (100/420/1420 vs 42/142/420/1420) — две экономики параллельно. `ShopPage.tsx:202` основная покупка `shop/buy` ок, но `alt` фолбэк `shop/purchase` никогда не успеет. Нет спеки на 12 реальных id из ShopPage (геро-нейминг `kemerovo-mint` и т.д. не совпадает ни с hype-таблицей, ни с economy.ts). |
| 20 | **Эко-рейтинг** `src/pages/EcoPage.tsx:1-...` | ⚠️ частично | `hype-features.md:2` (Эко-квиз 8Q, уровни Нормис→Легенда, `magnum-eco-quiz` LS) + `README:22` | Спека описывает **8 вопросов Кемерово + лор 42**, уровни Нормис/Братуха/Легенда, `magnum-eco-quiz/history` LS, награды +42/142/420. Код: `EcoPage.tsx:16-118` свои 8 вопросов (⚒️/🥤/🌲 и т.д.) — тематика совпадает, но вопросы другие (не Томь/42/VPN/CLAY 73/200K из спеки). Ранг в коде `getRank: >=200 Легенда / >=100 Братуха` `122-125`, а в спеке `0-3 Нормис / 4-6 Братуха / 7-8 Легенда` — шкала баллов vs количество верно (несостыковка единиц). Хранение: спека LS, код — сервер `POST /magnum/api/eco/submit` + `GET /eco/leaderboard` (`EcoPage.tsx:132,146`) — migration без обновления спеки. Нет спеки на серверную таблицу `magnum_eco_results` (`drizzle/schema.ts:58-65`). |
| 21 | **Майнинг** `src/pages/MiningPage.tsx:1-...` + `server.ts:826-828` + `drizzle/schema.ts:23-30` | ❌ нет спеки | `README:23` 1 строка | Отдельной спеки нет вообще. Клиент `MiningPage.tsx:77` `GET /magnum/api/mining`, `:181` `POST /mining/click`, `:204` `POST /mining/upgrade` — сервер реализует `handleMiningGet/Click/Upgrade` (server.ts:826-828) — соответствие ок. Но: апгрейды `лопата 42 → шахта 2042` из README не задокументированы (цены, авто-майнинг, ws). Файл `src/lib/coins.ts:6-13` расширения `MAX_COINS/STREAK_BONUS` относятся к майнингу? не связано. Нет спеки на WebSocket дуэль 2-4 игрока упомянутую в `server.ts:1-6` комменте. |
| 22 | **Ideas 42** `src/pages/IdeasPage.tsx` + `server.ts:805-813` + `drizzle/schema.ts:32-40` + `neon.ts` | ✅ есть, но неполно | `README:26`, `server.ts`, `drizzle/schema.ts` | Спека размазана: README говорит `magnum_ideas` + `POST /magnum/api/ideas` + голосование `▲`. Код: `IdeasPage.tsx:21` `GET /ideas`, `:96` `POST /ideas/:id/vote`, `:106` `POST /ideas` — сервер `handleIdeasGet/Post/Vote` `805-813` совпадают (ок). Но нет спеки на модерацию `status pending`, лимиты `title 4-80 / desc 0-300` (`server.ts:229-231`), пагинацию, анти-спам (любой залогиненный может голосовать бесконечно — нет `UNIQUE voter`). `docs/hype-features.md:6` роадмап упоминает Ideas, но без спеки. `research.md` не упоминает. |
| 23 | **БРАТ-БОТ 42** `src/components/AiBot.tsx:1-14044` + `server.ts:787` + `server.ts:770-Ai` | ⚠️ частично | `README:20` (прокси, сжатие 1280 JPEG), `hype-features.md:4` (рамка verified LS) | Спека hype: рамка `magnum-frame-verified="1"` LS, эвристика `засчитан/легенда`. Код: `AiBot.tsx:190-214` сжатие до 1280 JPEG (ок), `POST /magnum/api/ai` прокси `server.ts:787` (ок, ключ `XIAOMI_API_KEY` только на сервере). Но рамка теперь **серверная**: `server.ts:814-815` `POST /frame/verify` + `GET /frame/status` + таблица `magnum_frames` `drizzle/schema.ts:67-72`. Клиент `PresaveRatingPage.tsx:50` уже читает `frame/status`, а `AiBot.tsx` не вызывает `frame/verify` (grep `api/frame` 0 в AiBot) → верификация не связана с ботом. Эвристика «засчитан» осталась в LS, а сервер ждёт `verified:boolean` из тела → две параллельные системы. Нет спеки на `POST /frame/verify` (когда вызывается, кто решает verified). |
| 24 | **Пресейв-рейтинг** `src/pages/PresaveRatingPage.tsx` + `server.ts:794,814,817` | ❌ нет спеки | `README:25` (Топ-20, 8K/200K мок) | Страница `PresaveRatingPage.tsx:50-52` агрегирует 3 источника `frame/status + eco/leaderboard + ideas` — нигде не описано. `server.ts:794` `POST /magnum/api/presave/click` — нет спеки и нет клиента (grep 0 `presave/click` в src). Мок-данные `8K клипов / 200K просмотров` из README не имеют источника. |
| 25 | **Recaps** `src/pages/RecapsPage.tsx:1-3378` | ❌ нет спеки | `README:27` (YouTube транскрипты, крон 60м), `hype-features.md:7.1-7.6` бэклог | Огромная страница 3378 строк (самая большая) без спеки. README/CRON обещает транскрипты → в коде статика (grep `fetch` 0 в RecapsPage). Hype-бэклог 7.1-7.6 (Roulette, Daily, TTS, Timeline, ClipBattle, Quest) описан как идеи, но часть уже в коде (Timeline игра). Нет `docs/recaps-spec.md`. Крон `magnum freakland recaps 60m` из README не реализован в `server.ts` (0 строк). |
| 26 | **Дискография / Трек / Артисты / About42 / About / LastFit** `DiscographyPage.tsx:603`, `TrackPage.tsx:370`, `ArtistsPage.tsx:256`, `About42Page.tsx:374`, `AboutPage.tsx:376`, `LastFitPage.tsx:195` | ❌ | `README:28-32` по 1 строке, `research.md:4` дискография | Нет спек. Роуты есть `App.tsx:51-55` `/discography /track/:slug /artists /42`. Дубли `About42Page` vs `AboutPage` — два файла по 374/376 строк с идентичной GSAP-логикой (копипаста) без объяснения. `LastFit` нет в hype/README кроме 1 строки. |
| 27 | **Home / Layout / NavGrid (14 nav)** `src/pages/HomePage.tsx:469`, `src/components/Layout.tsx:7000` | ⚠️ | `README:52-55` структура, `Layout` 14 nav | Spec только в README структуре. Нет спеки на 14 пунктов навигации, бейджи, пресейв CTA. |
| 28 | **Auth / Coins** `server.ts:62-180` + `src/lib/coins.ts:1-2500+` + `drizzle/schema.ts:3-21` | ⚠️ | `server.ts:1-6` коммент, `README:58-71` таблицы | `src/lib/coins.ts` заявлено `2500+ строк: экономика, транзакции, daily rewards` (`coins.ts:6-7`), фактически файл — серверный кошелёк с polling 2с, но раздут до 2500 строк комментариями. Клиент `coins.ts:97` `POST /magnum/api/coins/set` — ручки нет на сервере (только `GET /coins` и `POST /coins/add` `server.ts:792-793`) → `setCoins()` всегда fallback. `economy.ts` 2500 строк — 50+ квестов-заглушек `QUEST_1..QUEST_N` с `reward 49+id` (сгенерены), не используются нигде (grep 0 `QUEST_` в pages). Две экономики параллельно. |
| 29 | **Neon / Drizzle** `drizzle/schema.ts:73`, `neon.ts`, `.neon` | ✅ частично | `README:63-71` | 9 таблиц `magnum_users/sessions/coins/mining/ideas/leaderboard/shop_inventory/eco_results/frames` — в README перечислены 8 + mining, но `magnum_leaderboard` не используется (нет ручек). Нет спеки на миграции. |
| 30 | **Деплой / Кроны / Build** `server.ts`, `build.ts:124525`, `.github/workflows/deploy.yml` | ⚠️ | `README:39,83-91` | README кроны 6 штук (10m substantial, 15m health, 10m watchdog, 20m changelog, 15m ideas, 60m recaps). В репо нет `cron/` или `scripts/` спек (есть `scripts/` но не проверен). `build.ts` 124KB без спеки. |

> Итого: из ~30 фич-групп полная спека есть только у Ideas (и то неполно) и Neon-схемы частично. Hype-spec покрывает 4 из 30. Остальное — код без спеки.

---

## 2) Галерея 42 — детально (350 фейков → REAL_BY_STYLE)

### Что было
- `GalleryPage.tsx:180-780` два массива `ARCHIVE_42` (210) + `ARCHIVE_WAVE_2` (140) = 350 артов, каждый с `src: "/magnum/images/gallery-42/archive-***.jpg"` и `wave2-***.jpg`. Физически в `public/images/gallery-42/` существует только 6 файлов: `42-agit-01.{jpg,800.webp}`, `42-cyber-01.{jpg,800.webp}`, `42-memphis-01.{jpg,800.webp}` (проверено `ls -la public/images/gallery-42` 1 Sep). → 344 пути вели в 404. Фолбэк в `GalleryPage.module.css:350` — градиент+эмодзи, поэтому визуально выглядело как «эмодзи вместо картинок», ревьюер не ловил 404 потому что `<img onError>` показывал эмодзи.

### Что исправлено
- Добавлен маппинг `GalleryPage.tsx:31-36` `REAL_BY_STYLE: Record<Style42,string>` — 4 стиля → 3 реальных webp:
  ```ts
  СССР: "/magnum/images/gallery-42/42-agit-01-800.webp"
  Y2K: "/magnum/images/gallery-42/42-memphis-01-800.webp"
  киберпанк: "/magnum/images/gallery-42/42-cyber-01-800.webp"
  мемфис: "/magnum/images/gallery-42/42-memphis-01-800.webp"
  ```
  + `REAL_FALLBACK` `37-45` для 7 базовых артов `BASE_ARTS:46-117` и `MOCK_POOL:120-174` уже указывают на реальные файлы.
- Runtime-фикс `785-787`:
  ```ts
  for (const a of ARCHIVE_42) a.src = REAL_BY_STYLE[a.style] ?? a.src;
  for (const a of ARCHIVE_WAVE_2) a.src = REAL_BY_STYLE[a.style] ?? a.src;
  for (const a of FULL_ARCHIVE) a.src = REAL_BY_STYLE[a.style] ?? a.src;
  ```
  Переписывает фейковые src на реальные по стилю. 404 устранён (проверка: `grep -c "archive-" GalleryPage.tsx` 350 объявлений, но `REAL_BY_STYLE` гарантирует что `a.src` после цикла указывает на существующий файл).

### Что сейчас ок
- Нет 404: все `src` резолвятся в 3 существующих webp (проверено существованием файлов). `onError` фолбэк всё ещё есть (`GalleryPage.tsx:1000+` `img onError → gradient+emoji`), на случай отсутствия файла.
- `FIXTURE_EXPECTED_COUNTS` `851` и `validateArchive()` `593-594` `console.assert(ARCHIVE_42.length===210)` — тесты фильтра не падают (фильтр «все» 350, по стилям 88/88/87/87).
- GSAP спека соблюдена: `TOKENS.motion: entranceY 24 stagger 0.12` `791-812`, `GSAP_PRESETS:857-864`, `ScrollTrigger.batch` `937-940` `start top 92% once:true`, `hover y:-4` `859-861`, `lightbox scale 0.82→1` `862`, `prefers-reduced-motion gate` `475,528`, `gsap.context cleanup` `529,613,626`.

### Что всё ещё не ок (остаточный риск)
| Проблема | Локация | Приоритет |
|---|---|---|
| Дубли картинок: 350 карточек визуально одинаковы (3 картинки × стили). Пользователь видит повторы, хотя `title/tag/gradient/emoji` разные. Нужны 350 уникальных файлов или честный мок-генератор с `picsum/gradient` и пометкой «заглушка». | `GalleryPage.tsx:182-780` + `public/images/gallery-42/` | P1 |
| Мутация константы: `const ARCHIVE_42` мутируется циклом `for..of` `785` — обходит `readonly`, затрудняет аудит, ломает HMR. Лучше `getRealSrc(style)` getter или `map` при рендере. | `785-787` | P1 |
| Y2K и мемфис коллизия: оба → `42-memphis-01-800.webp`, нет визуального различия стилей. | `33-35` | P1 |
| Раздутость файла: 2570 строк, из них ~600 строк inline-спеки (TOKENS/I18N/CHANGELOG/FIXTURES/GSAP_PRESETS) + 15 строк док-комментов `1478-1495` дублирующих спеку. Это не спека, но маскируется. Spec должна жить в `docs/gallery-spec.md`. | `791-1228` | P2 |
| Нет CI-проверки на 404: тесты `massive42.test.ts:292235` lines не проверяют существование файлов из `src`. Нужен `vitest` на `fs.existsSync(public + src)`. | `tests/` | P0 |

---

## 3) Игры (14+ игр) — где спека, что без доки

**Факт:** в `App.tsx:22-37` lazy 16 игр, в `GamesHub.tsx:6-23` 16 карточек. README заявляет «15 игровых роутов» → уже расхождение.

| Игра | Роут | Файл | Строк | Есть спека? | Что без доки (критичное) |
|---|---|---|---|---|---|
| Беги, братуха! | `/games/runner` | `RunnerGame.tsx` | ~600 | ❌ | Правила, управление, победа/поражение, награда coins, GSAP без reduced-motion |
| Матч 42 | `/games/match3` | `Match3Game.tsx` | 20464b | ❌ | Комбо-логика, Grid 8x8, эмодзи-сет ITEMS, нет спеки начислений |
| Ножи 42 | `/games/knife` | `KnifeHitGame.tsx` | 22248b | ❌ | — |
| Память | `/games/memory` | `MemoryGame.tsx` | 18160b | ❌ | GSAP flip без context/reduced-motion (`MemoryGame.tsx:210,249`) |
| Кликер | `/games/clicker` | `ClickerGame.tsx` | 25368b | ❌ | Дублирует hype DuelClicker, но без спеки; `addCoins` не используется |
| Квиз | `/games/quiz` | `QuizGame.tsx` | 23089b | ❌ | Дублирует `GamePage.tsx` 8Q, вопросы не совпадают с hype Eco-квизом |
| Ритм MAGNUM | `/games/rhythm` | `RhythmGame.tsx` | 24624b | ❌ | Клавиши D F J K, тайминг, нет спеки |
| Стопка 42 | `/games/stack` | `Stack42Game.tsx` | 24451b | ❌ | — |
| БЛЭКДЖЕК 42 | `/games/blackjack` | `BlackjackGame.tsx` | 23272b | ❌ | 4200 монет → открытка `postcard-4200.png` — нет спеки условий выдачи, нет GSAP, нет `addCoins` |
| РУЛЕТКА 42 | `/games/roulette` | `RouletteGame.tsx` | 19282b | ❌ | GSAP без gates (`RouletteGame.tsx:77,182`) |
| ПАЗЛ 2042 | `/games/2042` | `Game2042.tsx` | 11939b | ❌ | — |
| FLAPPY 42 | `/games/flappy` | `Flappy42Game.tsx` | 22320b | ❌ | — |
| Скоропечатание | `/games/typing` | `TypingGame.tsx` | 14248b | ❌ | 12 фраз MAGNUM, WPM-цель 42 — нет спеки |
| Змейка 42 | `/games/snake` | `Snake42Game.tsx` | 26293b | ❌ | Победа при длине 42 — нет спеки |
| 5 ПУЛЬ | `/games/dodge` | `Dodge42Game.tsx` | 16958b | ❌ | Уклоняйся 42с, 5 пуль — нет спеки |
| ХРОНОЛОГИЯ 2026 | `/games/timeline` | `Timeline2026Game.tsx` | 12762b | ⚠️ | Hype 7.4 описывает как секцию Recaps, а не игру; спека правил сортировки дат нет |

**Вывод:** 0/16 игр имеют отдельную спеку `docs/games/*.md` или секцию в `hype-features.md`. Тесты есть на 4 игры (`game2042/flappy42/snake42/dodge42/typing` + `timeline2026`) — тесты не заменяют спеку. Награды `4200` за Blackjack/Roulette упомянуты в README, но не специфицированы (когда выдать postcard, где хранить).

---

## 4) Магазин / Эко / Майнинг / Ideas / Brat-Bot — соответствие серверным ручкам

### Сервер: `server.ts:772-828` — 15 ручек
```
POST /magnum/api/ai
POST /auth/register, POST /auth/login, GET /auth/me, POST /auth/logout
GET  /coins, POST /coins/add
POST /presave/click
GET  /ideas, POST /ideas, POST /ideas/:id/vote
GET  /frame/status, POST /frame/verify
GET  /eco/leaderboard, POST /eco/submit
POST /shop/buy, POST /shop/equip, GET /shop/inventory
GET  /mining, POST /mining/click, POST /mining/upgrade
WS   /magnum/api/ws
```

### Таблица клиент ↔ сервер

| Модуль | Клиентский вызов (`src/...`) | Серверная ручка | Совпадает? | Несостыковка `файл:строка` |
|---|---|---|---|---|
| **Shop** | `ShopPage.tsx:79` `GET /shop/state` | — | ❌ 404 | Ручки нет. Сервер не имеет `shop/state`. Фолбэк без эффекта. |
| | `91` `GET /shop/inventory` | `GET /shop/inventory` `823` | ✅ | Ок, но ответ `server.ts:356-361` `{inventory, items}` а клиент `ShopPage.tsx:81,91` ждёт `{inventory, equipped, coins}` — поле `coins` отсутствует. |
| | `92` `GET /shop/equipped` | — | ❌ 404 | Нет ручки. Есть `GET /shop/inventory` с `equipped` внутри каждого item. |
| | `202` `POST /shop/buy` | `POST /shop/buy` `821` | ✅ | Ок. Цены `server.ts:258-275` `42/142/420/1420` совпадают с UI `ShopPage.tsx:197` `price`. Логика `getSkinPrice` тянет fallback 42 для любого id — нет валидации каталога. |
| | `210` `POST /shop/purchase` | — | ❌ 404 | Дублирует `/shop/buy`. `ShopPage.tsx:210` alt-фетч никогда не успешен. |
| | `243` `POST /shop/equip` | `POST /shop/equip` `822` | ✅ | Ок. |
| | `263` `POST /shop/unequip` | — | ❌ 404 | Нет ручки. Клиент `263` и `271` alt снова `equip`. |
| **Eco** | `EcoPage.tsx:132` `GET /eco/leaderboard` | `GET /eco/leaderboard` `817` | ✅ | Ок. |
| | `146` `POST /eco/submit` | `POST /eco/submit` `818` | ✅ | Ок. Но hype-спека LS → сервер миграция без обновления спеки. |
| **Mining** | `MiningPage.tsx:77` `GET /mining` | `GET /mining` `826` | ✅ | Ок. |
| | `181` `POST /mining/click` | `POST /mining/click` `827` | ✅ | Ок. |
| | `204` `POST /mining/upgrade` `JSON {id}` | `POST /mining/upgrade` `828` | ✅ | Ок. |
| | WS `230` `ws://.../magnum/api/ws?username=` | `server.ts:772` `if pathname===/api/ws` upgrade | ✅ | Клиент подключается, сервер upgrade есть, но нет спеки протокола (сообщения duel/lobby). |
| **Ideas** | `IdeasPage.tsx:21` `GET /ideas` | `GET /ideas` `805` | ✅ | Ок. |
| | `106` `POST /ideas` | `POST /ideas` `806` | ✅ | Ок. Лимиты `title 4-80 / desc 0-300` `server.ts:229-231` не отражены в UI подсказках. |
| | `96` `POST /ideas/:id/vote` | `POST /ideas/:id/vote` `807-813` | ✅ | Ок. Но нет защиты от накрутки (1 юзер = ∞ голосов). |
| **Brat-Bot** | `AiBot.tsx:214` `POST /magnum/api/ai` `{text,image,history}` | `POST /magnum/api/ai` `787` | ✅ | Ок. Прокси `XIAOMI_API_KEY` только на сервере `server.ts:10`. Сжатие 1280 JPEG `AiBot.tsx:190` ок. |
| | `AiBot` `POST /frame/verify` | `POST /frame/verify` `815` | ❌ не вызывается | `AiBot.tsx` grep 0 `frame/verify`. Верификация оторвана: бот отвечает текстом, а рамка требует отдельный POST с `{verified:boolean}`. PresaveRating читает `GET /frame/status` `50`, но бот туда не пишет. |
| **Coins** | `coins.ts:36` `GET /coins` | `GET /coins` `792` | ✅ | Ок. |
| | `71` `POST /coins/add` `JSON {amount, delta, coins}` | `POST /coins/add` `793` `amount` | ✅ | Сервер читает только `amount` (`server.ts:194`), клиент шлёт 3 алиаса — ок, но избыточно. |
| | `97` `POST /coins/set` | — | ❌ 404 | Ручки нет. `setCoins()` всегда `return cached` fallback. |
| **Presave** | — | `POST /presave/click` `794` | ❌ не используется | Сервер имеет, клиент нигде не вызывает (grep 0). Мёртвая ручка. |
| **Leaderboard** | `PresaveRatingPage.tsx:50-52` `frame/status+eco/leaderboard+ideas` | три ручки есть | ✅ | Но нет единой спеки агрегации. |

**Итого несостыковок:** 7 клиентских ручек 404 (`shop/state`, `shop/equipped`, `shop/purchase`, `shop/unequip`, `coins/set`, `presave/click` неиспользуемая, `frame/verify` не вызывается), 1 поле `coins` в `shop/inventory` ответе отсутствует, 1 поле `amount` алиасы избыточны.

---

## 5) GSAP-спека — где нарушена

**Эталон спеки (из `GalleryPage.tsx:791-864`, `hype-features.md` и повторяющегося паттерна):**
- `y 24 → 0, stagger 0.12, duration 0.55, ease power2.out` entrance
- `ScrollTrigger batch` для гридов `start top 85-92% once:true`
- `hover y:-4` RGB glow (`boxShadow 0 0 28 rgba(255,45,85,0.22)`)
- `lightbox scale 0.82→1 y18 / close 0.86`
- `prefers-reduced-motion: reduce` → `gsap.set clearProps`, не создавать ScrollTrigger
- `gsap.context(() => {...}, rootRef)` + `return ctx.revert()` cleanup

**Аудит по файлам:**

| Файл | Нарушение | `файл:строка` | Тяжесть |
|---|---|---|---|
| `GalleryPage.tsx` | ✅ эталон соблюдён | `475,528,613,626,857-864,937` | — |
| `About42Page.tsx:16-101` | ✅ соблюдён (есть reduced gate, context) | `16,18,25-31` | — |
| `AboutPage.tsx:16-101` | ✅ дублирует About42 — ок, но копипаста 376 строк | `16` | P2 |
| `DiscographyPage.tsx:244,272-321` | ⚠️ частицы: `typewriter` `254` `gsap.to(obj)` без context, нет `ctx.revert` для этой анимации | `254` | P1 |
| `ArtistsPage.tsx:16-74` | ✅ с gates | `16,46,69` | — |
| `HomePage.tsx:65-176` | ⚠️ `gsap.to` вне context: `HomePage.tsx:65,72,78,107` вспышки кошелька `addCoins` без `gsap.context`, без reduced gate для `flash` | `65-108` | P1 |
| `ShopPage.tsx:122-177` | ⚠️ `gsap.to` монеты `132` внутри `useEffect` без `gsap.context` для `coinsRef`; `149` prefersReduced есть, но `122` `coinsRef` анимация не gated | `122,149-166` | P1 |
| `EcoPage.tsx:192-220` | ✅ context есть, но `gsap.fromTo progressFill` `203` infinite `repeat:-1` без проверки reduced-motion (батарея/доступность) | `203-207` | P1 |
| `MiningPage.tsx:108-277` | ⚠️ `MiningPage.tsx:177` `gsap.fromTo coinsRef` вне context, без reduced gate | `177` | P1 |
| `GamesHub.tsx:55-81` | ⚠️ нет `prefers-reduced-motion` gate для `handleMouseMove/Enter/Leave` (y:-6, rotateX/Y), нет `gsap.context` — прямые `gsap.to(card)` на hover | `55-89` | P1 |
| `GamePage.tsx:102-170` | ⚠️ `GamePage.tsx:102` `gsap.from hero` вне context? есть context но `ScrollTrigger` не используется, `gsap.from cardRef` `212` внутри handler без cleanup | `102,212` | P2 |
| `RecapsPage.tsx:3194-3250` | ✅ gate есть `3197` `prefersReduced`, context есть | `3197` | — |
| `PresaveRatingPage.tsx:176-209` | ✅ | — | — |
| `LastFitPage.tsx:16-61` | ✅ | `16` | — |
| `TrackPage.tsx:131-241` | ⚠️ `TrackPage.tsx:156` `gsap.to .coverImg` scale/rotate без reduced gate, `207,217` hover card `gsap.to` без gate | `156,207` | P1 |
| `src/pages/games/*` — **системные нарушения:** ||||
| `ClickerGame.tsx:218,290,338,344,365` | ❌ 0 `prefers-reduced-motion`, 0 `gsap.context`, прямые `gsap.fromTo` по клику/шейку | `3,218` | P0 |
| `MemoryGame.tsx:210,249,267,282,291` | ❌ то же — 0 gates, 0 context, `gsap.from .card` stagger без cleanup | `3,210` | P0 |
| `RouletteGame.tsx:77,182,195` | ❌ context есть `77` но `gsap.to(obj)` `182` вне context, нет reduced gate для вращения рулетки | `77,182` | P0 |
| `Match3Game.tsx` | ❌ grep 0 `prefers-reduced` в файле — нет gate | — | P0 |
| `Stack42Game.tsx` etc | ❌ проверить — общий паттерн: игры без reduced-motion | — | P0 |
| `BlackjackGame.tsx` | ❌ 0 `gsap` вообще — если спека требует GSAP, то отсутствие тоже нарушение (консистентность) | — | P2 |
| `src/components/*` ||||
| `ScrollToTop.tsx:40` | ✅ gate есть `40` | — | — |
| `Hero.tsx`, `PressWall.tsx:57-58,105,137`, `News2026.tsx:157`, `CTA.tsx:32,87,103`, `Marquee.tsx:40`, `Singles.tsx:73,93` | ✅ все имеют `prefers-reduced-motion` gates и `gsap.context` | — | — |
| `AiBot.tsx` | ❌ нет GSAP вообще (хотя hype spec требовал GSAP вспышка `AiBotVerifiedState`) — `hype: AiBot.tsx onVerified → GSAP вспышка` не реализован | — | P2 |

**Итого GSAP-нарушений:** 9 файлов игр без reduced-motion/context, 5 страниц с частичными gates (Mining/Shop/Home/Track/GamesHub). Критично для a11y (WCAG 2.3.3).

---

## 6) План исправлений по приоритетам

### P0 — блокеры (404, a11y, потеря денег)

| # | Что | Файл:строка → действие |
|---|---|---|
| P0-1 | Починить 404 `ShopPage` → сервер | `src/pages/ShopPage.tsx:79,92,210,263` — убрать `fetch /shop/state`, `/shop/equipped`, `/shop/purchase`, `/shop/unequip`; оставить только `GET /shop/inventory` `POST /shop/buy` `POST /shop/equip` (реальные `server.ts:821-823`). Добавить TODO: `GET /shop/inventory` должен возвращать `coins` или клиент должен брать `GET /coins` отдельно. Либо добавить ручки `shop/state`/`shop/equipped` на сервере как алиасы к `shop/inventory`. |
| P0-2 | Починить `coins/set` 404 | `src/lib/coins.ts:97` `POST /coins/set` — ручка отсутствует. Либо реализовать `handleCoinsSet` в `server.ts` (атомарный `UPDATE ... SET balance = $target`), либо удалить `setCoins()` и заменить вызовы на `addCoins(delta)`. Сейчас `setCoins` молча падает. |
| P0-3 | Добавить CI-проверку галереи на 404 | `tests/massive42.test.ts` или новый `tests/gallery-404.test.ts`: `for (const a of FULL_ARCHIVE) expect(fs.existsSync(path.join('public', a.src.replace('/magnum','')))).toBe(true)` + проверка `fetch /magnum/images/gallery-42/...` 200. Закрывает кейс «350 эмодзи вместо картинок». |
| P0-4 | GSAP a11y games — добавить reduced-motion + context | `src/pages/games/ClickerGame.tsx:3`, `MemoryGame.tsx:3`, `Match3Game.tsx`, `RouletteGame.tsx:77`, `Flappy42Game.tsx` и т.д. — обернуть все `gsap.*` в `gsap.context`, добавить `if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return` перед `gsap.to` с тряской/шейком. Иначе WCAG fail. |
| P0-5 | Связать Brat-Bot → Frame verify | `src/components/AiBot.tsx:214` после `POST /ai` если `verified` логика — добавить `fetch('/magnum/api/frame/verify',{method:'POST',credentials:'include',body:JSON.stringify({verified:true})})`. Сейчас рамка никогда не разблокируется через бота. Или обновить сервер `handleAi` чтобы сам писал в `magnum_frames` при `verified:true` в ответе. |

### P1 — важные (спека vs код, дубли, платежи)

| # | Что | Действие |
|---|---|---|
| P1-1 | Галерея дубли: 350 карточек → 3 картинки | `public/images/gallery-42/` — догенерить 350 уникальных или заменить на `picsum.photos/seed/42-agit-01/800` + пометку «мок», или честно сократить до 12 уникальных + пагинация. Обновить `GalleryPage.tsx:785-787` на `getRealSrc()` getter вместо мутации. Разделить Y2K/мемфис картинки. |
| P1-2 | Написать `docs/gallery-spec.md` и `docs/shop-spec.md`/`docs/eco-spec.md`/`docs/mining-spec.md` | Вынести TOKENS/I18N/CHANGELOG из `GalleryPage.tsx:791-853` в доку. Зафиксировать: каталог 12 скинов (id, цены 42/142/420/1420, редкости), серверные ручки, LS-ключи (если остаются). Для Eco: зафиксировать шкалу `score` vs `count` (`EcoPage.tsx:122` 200/100 vs hype 7/8). |
| P1-3 | Устранить двойную экономику | `src/lib/economy.ts:6-20` `SHOP_ITEMS` (100/420/1420/4200) vs `ShopPage.tsx` цены (42/142/420/1420) vs `hype:SHOP_PRICES` — выбрать один источник `src/lib/shopCatalog.ts` и удалить `economy.ts` заглушки `QUEST_1..QUEST_50` (2500 строк мусора) или пометить `// NOT SPEC — mock`. |
| P1-4 | Разрешить дубли квизов | `GamePage.tsx:14-88` vs `QuizGame.tsx` vs `EcoPage.tsx` vs hype `EcoQuizPage` — выбрать один: удалить `GamePage` старый квиз или вынести в `/games/quiz` единый, обновить `hype-features.md:2` вопросы (Томь/42/VPN/CLAY). |
| P1-5 | Документировать игры (16) | Создать `docs/games-spec.md` с таблицей: роут, цель, победа, награда coins, управление, GSAP-эффекты. Обновить `README.md:19` 15→16. |
| P1-6 | GSAP частичные gates (Shop, Mining, Home, Track, GamesHub) | `ShopPage.tsx:122,132` `MiningPage.tsx:177` `HomePage.tsx:65` `TrackPage.tsx:156` `GamesHub.tsx:55-89` — добавить `prefers-reduced-motion` перед `gsap.to` и обернуть в `gsap.context`. |
| P1-7 | Идеи анти-накрутка | `server.ts:243-255` `handleIdeasVote` — добавить `magnum_idea_votes(user_id,idea_id)` UNIQUE или rate-limit 1/час, иначе `POST /ideas/:id/vote` спамится. Задокументировать в `docs/ideas-spec.md`. |
| P1-8 | Presave мёртвая ручка | `server.ts:794` `POST /presave/click` — либо реализовать клиент в `PresaveRatingPage.tsx`/`CTA.tsx` (учет кликов в `magnum_leaderboard`), либо удалить ручку и `magnum_leaderboard` таблицу если не нужна. |

### P2 — полировка (долги, копипаста, раздутость)

| # | Что | Действие |
|---|---|---|
| P2-1 | `About42Page.tsx` vs `AboutPage.tsx` дубли 374 строк GSAP | Удалить один, оставить `About42Page`, настроить редирект `/about → /42` в `App.tsx:53`. |
| P2-2 | `GalleryPage.tsx` раздутость 2570 строк | Вынести `TOKENS/I18N/GALLERY_CHANGELOG/FIXTURE/GSA_PRESETS/buildScrollTriggerBatch` в `src/lib/galleryTokens.ts` и `docs/gallery-spec.md`. Оставить в компоненте только рендер. |
| P2-3 | `coins.ts`/`economy.ts`/`perf-analytics.ts`/`RecapsPage.tsx` раздуты до 2500+/3378 строк | Вынести мок-футеры (2000 строк транскриптов/квестов) в `public/mocks/*.json` или удалить. `CHANGELOG.md:32-36` уже жалуется на massive. |
| P2-4 | `AiBot` GSAP вспышка по hype | `src/components/AiBot.tsx` добавить `gsap.fromTo` verified-плашки с `prefers-reduced-motion` gate (как в hype 4.4). |
| P2-5 | `Blackjack` без GSAP | Добавить лёгкий `gsap.to` на победу (shake) консистентно с другими играми или задокументировать «без анимации». |
| P2-6 | `Recaps` без спеки 3378 строк | Создать `docs/recaps-spec.md`: откуда транскрипты, крон 60м `scripts/recaps-cron.ts`, схема `RecapsPage` фильтров, связь с `hype 7.1-7.6`. Реализовать `GET /magnum/api/recaps` если транскрипты серверные, или честно пометить как статику. |
| P2-7 | Документировать кроны/деплой | `README:83-91` кроны — вынести в `docs/ops.md` + проверить `.github/workflows/deploy.yml` SSH `scp /srv/magnum` и `server.ts` SPA fallback `830-831` `/magnum/` → `index.html`. |

---

## Приложение A — проверочные команды (для ревьюера)

```bash
# Галерея: нет 404
grep -c 'archive-' src/pages/GalleryPage.tsx # 350 объявлений
ls public/images/gallery-42/ # 6 файлов
grep -n REAL_BY_STYLE src/pages/GalleryPage.tsx # 31,785-787

# Shop ручки 404
grep -rn 'api/shop' src --include='*.tsx' # 4 хита на несуществующие
grep -n 'api/shop' server.ts # только buy/equip/inventory

# Coins set 404
grep -rn 'api/coins/set' src # coins.ts:97
grep -n 'coins/set' server.ts # 0

# GSAP gates
grep -rn 'prefers-reduced-motion' src --include='*.tsx' | wc -l # ~25, 0 в 5 играх
grep -L 'prefers-reduced-motion' src/pages/games/*.tsx # список нарушителей

# Игры count
grep -c 'lazy(' src/App.tsx # 16
grep -c 'to: "/magnum/games' src/pages/GamesHub.tsx # 16
```

## Приложение B — файлы без спеки (полный список)

`src/pages/GalleryPage.tsx`, `ShopPage.tsx` (частично), `EcoPage.tsx` (частично), `MiningPage.tsx`, `RecapsPage.tsx`, `PresaveRatingPage.tsx`, `DiscographyPage.tsx`, `ArtistsPage.tsx`, `About42Page.tsx`, `AboutPage.tsx`, `LastFitPage.tsx`, `TrackPage.tsx`, `HomePage.tsx`, `src/pages/games/*` (16), `src/components/AiBot.tsx` (частично), `src/lib/coins.ts`, `src/lib/economy.ts`, `src/lib/perf-analytics.ts` (массив), `build.ts`, `neon.ts`.

> Следующий шаг: покрыть P0 (404 + a11y + frame→bot) до деплоя, затем написать `docs/*-spec.md` для P1 и почистить 2500-строчные мок-файлы для P2.

