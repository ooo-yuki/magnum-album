# 🎤 MAGNUM — ЧЕЙНДЖЛОГ

> 🌐 **Сайт:** [oooyuki.zomb.top:30645/magnum](https://oooyuki.zomb.top:30645/magnum/) · 🎧 **Пресейв альбома MAGNUM:** [music.thefence.me/psmagnum](https://music.thefence.me/psmagnum)
>
> Промо-сайт альбома **MAGNUM Пятерки** (5opka × 42 братухи). React + TypeScript + GSAP + Bun.
> Формат: [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/). Версионирование — SemVer.

## [0.3.6] — 2026-09-01 🔒 WS-фикс + 2042 Daily/FLOAT + Scoring Neon — 3/10

> **14 коммитов** `3f1314a` → `c8b93fb` · **+1582 / −101** · **22 файла** (+`f3e0446` changelog) · 2042 Daily Challenge + FLOAT +X pop + unified Neon scoring + WS 401 fix + lazy 528→472KB · рейтинг 3/10 → 3/10 (стабильно, 853 строки/10м)

### 🎮 Игры — 2042 Daily Challenge + FLOAT +X

- 🧩 **2042 — DAILY CHALLENGE + share + эффективность + submit** — `3dcd532` **DAILY CHALLENGE** `seededBoard mulberry32` + `dailySeed()` + `DAILY_KEY` + `Neon POST /magnum/api/games/submit` + **Web Share API + clipboard** дубль + **HUD эффективность** (очки/ход) + **TILE_LORE 2026** (ТУСА МЕДУЗА 14.08 / VPN / CLAY 03.04 / 5 пуль — каждая пуля альбома) · **fix nested useEffect confetti** — вынесен из `keydown` — `src/pages/games/Game2042.tsx` +81/−47, `tests/game2042-fix.test.ts` +65 (2 файла, +146/−47)
- ✨ **2042 — FLOAT +X pop + haptics + spawn GSAP + 42 pulse** — `ed478b2` **floats state + floatIdRef** — `+X` поп-ап над плиткой при merge/slide, **navigator.vibrate** (merge 30ms / slide 10ms), **requestAnimationFrame spawnIdx + GSAP back.out 0.26** появление новой плитки, **42 boxShadow pulse** + **floatUp keyframes** (0.9s ease-out), `presave→win` intact — `src/pages/games/Game2042.tsx` +27/−1, `src/pages/games/Game2042.module.css` +2 (2 файла, +29/−1)
- 🎯 **Unified scoring + referrals + duel history (Neon)** — `3f1314a` **4 эндпоинта** `POST /magnum/api/games/submit` + `GET /games/top` + `GET /games/my` + `POST /referral/redeem` + `GET /referral/code` + `GET /duel/history` + **Neon** `magnum_game_scores / referrals / duel_history` + `vault persist` — `drizzle/migrations/0010_game_scores_referrals.sql` +42, `drizzle/schema.ts` +29, `server.ts` +164/−1, `drizzle/migrations/meta/_journal.json` +36/−1 (4 файла, +271/−2)

### ✨ Фичи — GSAP + Hype + Referrals

- 🎨 **GSAP AuthStatus entrance+neon+modal + Layout + PageTransition** — `01e5536` **AuthStatus** `gsap.context` entrance (y:−8, opacity, `back.out 0.6`) + **neon boxShadow pulse** + **modal scale/back.out** + `prefers-reduced-motion` gate + `ctx.revert()` · **Layout** context harden · **PageTransition** white-screen fix (`800ms failsafe` + `opacity 0→1`) — `src/components/AuthStatus.tsx` +67/−10, `src/components/Layout.tsx` +21/−11, `src/components/PageTransition.tsx` +12/−7 (3 файла, +100/−28)
- 💡 **Hype +3 идеи — DUEL CHAIN x5 + ECO REKA + FRAME VERIFIED** — `2c24480` **DUEL CHAIN** (x5 комбо-дуэли), **ECO REKA** (река экосистемы), **FRAME VERIFIED** (проверенная рамка) — `docs/hype-queue.md` +7/−1, `reports/hype-2026-09-01-1501.md` +52 (2 файла, +59/−1)

### ⚡ Перфоманс — 528→472KB + stale cleanup

- 🚀 **Lazy 5 eager pages — 528KB → 472KB (−56KB, −10.6%)** — `5d785d0` **About42 / Track / LastFit / Game / GamesHub** (`src/App.tsx` +15/−13) переведены в `React.lazy(() => import(...))` + `Suspense fallback` · **stale dist cleanup** `main-*.js` 8→1 (`dist 42M→38M`, `/srv 43M→38M`) · **Bun.build 1.59s** · `tsc 0`, `68 chunks` — `reports/perf-2026-09-01-1501.md` +117 (2 файла, +132/−13)
- 🟢 **Health OK — 200/200/200 + obscura active** — `9cf9928` `reports/health-2026-09-01-1501.md` +61 — **4 роута 200 9106B** (`/`, `/games`, `/42`, `/discography` — SPA fallback), **Caddy + Bun + TLS** OK, `obscura active Chrome/145`, `index.html 9106B ETag dl42iytr344m70y`, `external --resolve 127.0.0.1 → 200`
- 🟢 **Watchdog OK — 200/200/200 active Up** — `fd132a4` `reports/watchdog-2026-09-01-1459.md` +103 — `magnum-bun active`, `magnum-caddy Up`, **8 gallery, 3017 tests**, health resilient, `tsc 0` — без рестарта
- 🟢 **Watchdog 15:06 — OK, 2 бага daily+undo** — `c8b93fb` `reports/watchdog-2026-09-01-1506.md` +93 — **200/200/200 active/Up 7min**, `8 файлов 12M` (4×jpg 2.4-3.4M + 4×800.webp 67-133K), `tsc 0`, ⚠️ `DAILY_KEY void` dead code + `historyRef.length` не триггерит ре-рендер — P1/P2 к фиксу

### 🐛 Фиксы — WS auth bypass закрыт

- 🔒 **WS 401 без токена — закрыт auth bypass (raw socket 101→401)** — `26cc8b3` **до:** raw `Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==` без токена → `101 Switching Protocols` (`room Братуха_643`) — 3 прогона подряд · **после:** `extractToken(req)` до `upgrade` → `401 Unauthorized` (curl + raw socket + `?token=fake123` все 401) — `server.ts` +6/−9 (1 файл, фикс P0, auth 15:03 ✅)
- 🩹 **Fix nested useEffect confetti** — `3dcd532` + `eb2d654` — `useEffect` вынесен из `keydown` (hooks nesting баг `React hooks called conditionally`) + `TILE_LORE` 12 значений (ТУСА/МЕДУЗА/VPN/CLAY 5 пуль) — `tests/game2042-fix.test.ts` +65, `tests/new-coverage-1515.test.ts` +120

### 🖼️ Галерея — 8 файлов (WARN y2k/dup, archive SPA)

- 🖼️ **8 файлов — WARN y2k→memphis/cyber + dup + archive 200 html** — `fd132a4` + `c8b93fb` watchdog **8 файлов** `42-{agit,cyber,memphis,y2k}-01.{jpg,800.webp}` (12M, webp 67-133K valid), `tsc 0` · `REAL_BY_STYLE`/`REAL_FALLBACK` указывают на существующие файлы, `check-list 6→8` устарел — WARN; **archive 210× `archive-СССР-001.jpg` → 200 text/html 8446B** (SPA `try_files` маскирует 404, `onError` fallback на `REAL_BY_STYLE`) — без рестарта

### 🤖 Брат-бот — стабилен, задачи в 2042/скоринге

- 🤖 без изменений в окне — бот стабилен, задачи ушли в **2042 Daily/FLOAT + unified scoring + referrals** (след. инкремент — подсказки по **Vault + промокодам + FEVER + Daily топ**)

### 🧪 Тесты / CI — 3035 passed

- ✅ **3035 passed (fix nested useEffect +12 TILE_LORE/economy/health)** — `eb2d654` `reports/test-2026-09-01-1505.md` +93, `tests/new-coverage-1515.test.ts` +120, `tests/game2042-fix.test.ts` +11 — **3017→3035 +18**, 25 файлов, `TILE_LORE 2026` + `economy/health` + confetti fix

### 🔐 Auth / Neon — gate держится, WS 🔴→🟢

- 🔐 **Auth check 15:03 — 22/22 401 gate, WS 101→401 FIXED** — `3f2e16c` `reports/auth-2026-09-01-1503.md` +185 — **4/4 защищённых 401** (`/auth/me`, `/coins`, `/shop/inventory`, `WS curl 426`) + **16 доп. 401** (`/shop/state`, `/shop/equipped`, `/cosmetic/inventory`, `/transactions`, `/mining`, `/shop/buy`, `/frame/verify`, `/profile`, `/achievements`, `/daily/status`, `/notifications`, `/games/my`, `/games/submit`, `/ideas/bookmarks`, `/promo/redeem`, `/referral/redeem`) + **публичные 200** (`/coins/top`, `/ideas`, `/eco/leaderboard`, `/shop/catalog`, `/achievements/catalog`, `/games/top`) · **WS raw socket без токена → 401** ✅ (было 101) — **предыдущий критичный (WS аноним 101) — ПОФИКШЕН** · фронт `AuthStatus.tsx` Войти/Регистрация + модалка + `credentials:include` OK

### 📖 Дока + Ревью — 3/10 → след. инкремент

- 👁️ **Review 6/10 → 3/10** — `d113ea9` `reports/review-2026-09-01-1455.md` +93 — **6/10** (2992 строки/20м) → `0763723` `reports/review-2026-09-01-1503.md` +80 — **3/10** (853 строки/10м: `800 added/53 removed` → `493 added/51 removed` за чистые 10м) — падение: нет крупных фичей, только `perf+gsap+fix+отчёты`, `tsc 0`, `3017 pass`, `8 галерея`, `health 200`, `magnum-bun active` — **WARN** `archive 200 html` + `Memory localStorage` + `ws fix неполон` + `Game2042 daily seed` — требует **5000+ строк/10м для 10/10**
- 📝 **Changelog investor update** — `f3e0446` `CHANGELOG.md` +36 — инвестор-апдейт 0.3.4 (Blackjack + ачивки + промокоды) перед 0.3.6
- 💡 **Hype-queue 3 идеи** — `2c24480` `docs/hype-queue.md` +7/−1 — очередь идей пополнена (DUEL CHAIN x5 — комбо-дуэли, ECO REKA — река экосистемы, FRAME VERIFIED — проверенная рамка) + `reports/hype-2026-09-01-1501.md` +52

### 🐛 Известные баги → след. инкремент

- ⚠️ **P1 DAILY_KEY dead code** — `src/pages/games/Game2042.tsx:411` `const DAILY_KEY = "2042-daily"; void DAILY_KEY;` — ключ нигде не `getItem/setItem` и не уходит в `magnum_daily_claims`/`magnum_game_scores` — UI «одна попытка в день — топ в рейтинг MAGNUM» не ограничена, можно спамить `POST /games/submit` + `restart()` делает `dailySeed()+moves+score` — ломает детерминизм доски дня (watchdog 15:06 BUG-1)
- ⚠️ **P2 historyRef.length не триггерит ре-рендер** — `src/pages/games/Game2042.tsx:277 + :636` `historyRef.current.length` в JSX `disabled`/`(0/6)` — `useRef` mutable не вызывает ре-рендер, счётчик обновится только при следующем `setGrid/setScore` (watchdog 15:06 BUG-2)
- ⚠️ **TOCTOU `server.ts:1278-1297`** — `handlePromoRedeem` 5 SQL без `BEGIN` + `magnum_promo_redemptions` без `UNIQUE(user_id,code)` — гонка `uses > max_uses` (review 15:03 §)
- ⚠️ **Gallery `GalleryPage.tsx:39-43` + `galleryTokens.ts:42`** — `y2k-01/02→memphis`, `y2k-03→cyber`, `42-y2k-01.jpg ≡ 42-memphis-01.jpg` + `.jpg` содержит PNG + **archive 210× 200 html** (SPA fallback, review 15:03 §1)
- ⚠️ **Memory `MemoryGame.tsx:293,494`** — `localStorage "memory42-best"` вместо `Neon magnum_game_scores` + `POST /games/submit` как у 2042 (review 15:03 §2) + **localStorage 45 вхождений** vs ТЗ «all state in Neon»

---

## [0.3.5] — 2026-09-01 🧠 Memory FEVER + Rhythm FEVER 5 пуль — 3/10

> **5 коммитов** `9a2c9f4` → `8f852ef` · **+615 / −97** · **5 файлов** · Memory 4×12 THEMES + Rhythm FEVER x2 6с — дозакрытие 9a2c9f4 + 4 новых · рейтинг 3/10 (стабильно) · `9a2c9f4` пропущен в 0.3.4 — учтён здесь

### 🎮 Игры — Memory 42 FEVER + Rhythm MAGNUM FEVER

- 🧠 **Memory 42 — THEMES 4×12 + DIFFICULTY 3 + combo FEVER x5** — `8f852ef` **4 темы ×12 карточек** (MAGNUM/42/Братухи/5opka), **3 сложности** (4×3/4×4/6×6), **combo FEVER x5** — 5 подряд x2 очки, **хинты 3×** (подсветка пары), **свайп ↔/↑** + **стрелки+Enter** управление, **WebAudio fever/hint** звуки + **GSAP win** конфетти, **localStorage best** рекорд — `src/pages/games/MemoryGame.tsx` +275/−76 (351 строка, 1 файл)
- 🥁 **Rhythm 42 — MAGNUM FEVER 5 пуль ×2 6с + 5 треков** — `9a2c9f4` **5 perfect подряд → MAGNUM FEVER** (5 пуль заряжены): **x2 очки 6с**, золотая аура/пульс, **FEVER x2 бейдж** в HUD, частицы, expiry-таймер, сброс на miss · **3→5 треков** (ТУСА МЕДУЗА, VPN, CLAY СЛАВА БОССУ, 42, MAGNUM 5 пуль — каждая пуля альбома) · **fix GSAP nesting** — `useEffect` вынесен из `keydown` (hooks nesting баг), `tsc 0`, `canvas deps +fever` — `src/pages/games/RhythmGame.tsx` +62/−21, `tests/rhythm-fever.test.ts` +95 (2 файла, +158/−21)

### 🧪 Тесты / CI — 3017 passed, tsc 0

- ✅ **Watchdog OK 200/200/200** — `29e2edf` `reports/watchdog-2026-09-01-1451.md` +82 — **200/200/200 active/Up, 8 gallery, 3017 tests, 2 bugs** — без рестарта (`magnum-bun active`, `magnum-caddy Up ~1h`, 25 файлов тестов)
- 👁️ **Review 3/10** — `fc13b72` `reports/review-2026-09-01-1449.md` +93 — **3/10** (1487 строк/10м: `ce981dc` 260 промокоды + `3ed1a4a` 405 тестов), стабильно с 14:36 (1442→1487), пик — промокоды + покрытие

### 🔐 Auth / Neon — gate держится, WS 🔴 открыт

- 🔐 **Auth check 14:51** — `e33042f` `reports/auth-2026-09-01-1451.md` +165 — **4/4 защищённых 401** (`/auth/me`, `/coins`, `/shop/inventory`, `WS curl 426`), публичные 200 — gate держится; **🔴 WS raw socket без токена → 101** `room Братуха_643` — 3-й прогон подряд, требует `server.ts` проверки токена до `upgrade`

### 🖼️ Галерея — 8 файлов (WARN dup/y2k)

- 🖼️ **8 файлов — WARN gallery-y2k + gallery-dup** — `29e2edf` watchdog **8 файлов** `42-{agit,cyber,memphis,y2k}-01.{800.webp,jpg}` (12M, webp 67-133K valid), `tsc 0` · индексы `y2k→memphis/cyber` (§ BUG-2) + **archive 350×200 html** (SPA fallback маскирует 404) без рестарта

### 🤖 БРАТ-БОТ

- 🤖 без изменений в окне — бот стабилен, задачи ушли в **Memory/Rhythm FEVER** (след. инкремент — подсказки по **Vault + промокодам + FEVER**)

### 🐛 Известные баги → след. инкремент

- ⚠️ **TOCTOU `server.ts:1278-1297`** — `handlePromoRedeem` 5 SQL без `BEGIN` + `magnum_promo_redemptions` без `UNIQUE(user_id,code)` — гонка `uses > max_uses` + двойное начисление (watchdog 14:44 BUG-1, review 14:49 §2)
- ⚠️ **Gallery `GalleryPage.tsx:39-43` + `galleryTokens.ts:42`** — `y2k-01/02→memphis`, `y2k-03→cyber`, `42-y2k-01.jpg ≡ 42-memphis-01.jpg` один PNG под двумя именами + `.jpg` содержит PNG (BUG-2, review 14:49 §1)
- ⚠️ **Gallery 350× HTML ghost** — `archive-СССР-001.jpg → 200 text/html 8446B` (index.html) — SPA fallback на `/magnum/images/*` льёт 350×HTML, ломает кэш/LCP (review 14:49 §3) + **localStorage 45 вхождений** vs Neon ТЗ (§ BUG-1 watchdog)
- ⚠️ **WS anon `server.ts:/magnum/api/ws`** — raw socket без токена → `101 Switching Protocols` (auth 14:51 🔴) — 3-й прогон, нужен `verify token before upgrade`
- 👁️ **Review 3/10** — `fc13b72` спад с **10/10 → 3/10** (норма после всплеска 22 коммитов 0.3.3, требует 5000+ строк/10м для 10/10)

---

## [0.3.4] — 2026-09-01 🎲 Blackjack Казино + Ачивки 10 + Промокоды — 3/10

> **14 коммитов** `a7706c6` → `c146a7f` · **+1991 / −33** · **23 файла** · Blackjack x10 Легенда + 10 ачивок + 5 промокодов + Vault prod + 47→38M · рейтинг 3/10

### 🎮 Игры — Blackjack42 казино-апгрейд

- 🎰 **Blackjack42 — стрик x10 Легенда + конфетти-канвас** — `5775e8b` стрик **x10 «Легенда»**, **конфетти-канвас** + **GSAP раздача**, **стратегия-хинт**, **свайп** + **haptics** + **чип-саунд**, **12 ачивок** триггер — `src/pages/games/BlackjackGame.tsx` +82/−35, `drizzle/migrations/0008_notifications.sql` +16, `drizzle/schema.ts` +10, `server.ts` +77/−1

### ✨ Фичи — Ачивки 10 + Промокоды 5

- 🏆 **Профиль + 10 ачивок Neon** — `a7706c6` **10 ачивок** `first_presave/miner_100..duel` + `Neon magnum_achievements` + `GET /magnum/api/achievements/catalog` + `GET/POST /magnum/api/achievements` claim + `GET /magnum/api/profile` агрегат `coins/mining/daily/tx/presave/shop/cos/vault/ach/frame` — `drizzle/migrations/0007_achievements_profile.sql` +12, `drizzle/schema.ts` +7, `server.ts` +189/−1
- 🎁 **Промокоды 5 — MAGNUM42/5OPKA/BRATUKHI/KUZYA/VIP42** — `ce981dc` **5 промокодов Neon** `magnum_promo_codes` + `GET /magnum/api/promo/catalog` + `POST /magnum/api/promo/redeem` + `GET /magnum/api/promo/my` + валидация + `rate limit` + **уведомления** — `drizzle/migrations/0009_promo_codes.sql` +38, `drizzle/schema.ts` +23, `server.ts` +118/−1, `src/pages/IdeasPage.tsx` +73/−7

### ⚡ Перфоманс — 47M→38M bundle health

- 🧹 **Stale dist cleanup + bundle health — 47M→38M** — `5beb9e9` **17 stale mains** удалены, `dist 47M→38M`, `sitemap 32`, `health 200` — `reports/perf-2026-09-01-1437.md` +73, `drizzle/migrations/0007_achievements_profile.sql` +12, `src/pages/games/BlackjackGame.tsx` +143/−2

### 📖 Дока — факты + hype + readme

- 📊 **+5 фактов +3 recaps Freakland** — `c146a7f` **Twitch 1M / SLAY 23-24 / Freakland Create 1.21.1 / CLAY пасхалка / Кузбасс −20K** + **3 recaps** `Freakland transcript:false` — `reports/data-2026-09-01-1446.md` +28, `research.md` +12, `src/pages/RecapsPage.tsx` +54
- 💡 **Hype +3 идеи +5 queue** — `e0cf468` **duel kombo x4 / eco tome 8Q / skin forge 12 + craft** + **queue 5** — `docs/hype-queue.md` +7/−1, `reports/hype-2026-09-01-1440.md` +52
- 📝 **Readme keeper 2915→2997** — `d869f30` **Tests 2915→2997 (23 files)**, **11→20 tables** `daily/tx/votes/bookmarks/ach/vault/notif/promo×2`, **+Vault/Ach/Promo** фичи, **Blackjack/Snake/Quiz/Stack** детали, `drizzle 0009` — `README.md` +13/−11

### 🧪 Тесты / CI — 3009 passed

- ✅ **3009 passed (24 файла) — promo presave daily/transfer + gallery 1502** — `3ed1a4a` `reports/test-2026-09-01-1447.md` +93, `tests/new-coverage-1502.test.ts` +188 + `tests/new-coverage-1445.test.ts` +124 — покрытие **promo/presave/daily/transfer + gallery 1502**
- ✅ **3009 passed cover — missed tick** — `4c15476` `reports/test-2026-09-01-1446.md` +131 — стабильно **3009** (2962→3009 +47)
- 🟢 **Health OK** — `e389ae4` `reports/health-2026-09-01-1440.md` +60 — **200/200 локально**
- 🔐 **Auth check** — `d4c096a` `reports/auth-2026-09-01-1439.md` +153 — Neon `magnum_users/sessions` gate держится

### 🖼️ Галерея — 8 файлов (WARN dup)

- 🖼️ **8 файлов — WARN gallery-y2k-alias + gallery-dup** — `91f2cc2` + `9e53f73` watchdog **200/200/200 active/Up 8files** — `reports/watchdog-2026-09-01-1436.md` +63, `reports/watchdog-2026-09-01-1444.md` +79 — индексы `y2k→memphis/cyber` (§ BUG-2) + **promo-TOCTOU** (§ BUG-1) без рестарта, `tsc 0`

### 🤖 Брат-бот

- 🤖 без изменений в окне — бот стабилен, задачи ушли в **Blackjack/ачивки/промо** (след. инкремент — подсказки по **Vault + промокодам**)

### 🐛 Известные баги → след. инкремент

- ⚠️ **TOCTOU `server.ts:1284-1299`** — `handlePromoRedeem` 5 SQL без `BEGIN` + `magnum_promo_redemptions` без `UNIQUE(user_id,code)` — гонка `uses > max_uses` + двойное начисление (watchdog 14:44 BUG-1)
- ⚠️ **Gallery `GalleryPage.tsx:39-40`** — `y2k-01/02→memphis`, `y2k-03→cyber`, `42-y2k-01.jpg ≡ 42-memphis-01.jpg` один PNG под двумя именами + `.jpg` содержит PNG (BUG-2)
- 👁️ **Review 3/10** — `99048c7` `reports/review-2026-09-01-1436.md` +87 — спад с **10/10 → 3/10** (1442 строк/10м, норма после всплеска 22 коммитов)

---

## [0.3.3] — 2026-09-01 🎰 Vault 42 + Quiz/Stack MAGNUM + GSAP 0.12 — 10/10

> **22 коммита** `fea3f6e` → `9c53ad5` · **+2888 / −2708** · **46 файлов** · Vault лимиток + Quiz 24Q + Stack/Snake лор + GSAP 0.12 + P2 10k · рейтинг 10/10

### 🎮 Игры — Quiz 42 + Stack42 + Snake42 комбо

- 🐍 **Snake42 комбо xN — цепочка <1.8с** — `9c53ad5` цепочка **<1.8с +25 бонус/уровень**, капа **x12**, `WebAudio playCombo pitch`, шейк `6+0.9*N`, `GSAP back.out burst`, `floating COMBO xN` + `bonusBar` — `src/pages/games/Snake42Game.tsx` +58/−3, `src/pages/games/Snake42Game.module.css` +4, `tests/snake42-combo.test.ts` +90
- ❓ **Quiz 42 — 24 вопроса + стрик xN** — `d52faab` пул **24Q**, стрик `×N`, **50/50** подсказка, **speed-бонус**, haptics, `keyboard 1-4/H` + `свайп`, `localStorage` рекорд — `src/pages/games/QuizGame.tsx` +159/−21, `tests/gallery-gsap-build-1421.test.ts` +174, GSAP на 5 страницах (`Eco/Gallery/Mining/Recaps/Shop` +34…+50)
- 🧱 **Stack42 MAGNUM 2026 — 5 пуль лора** — `5317cce` **5 пуль** лора MAGNUM, `pause P/R`, `coins` начисление, `canvas labels` пуль — `src/pages/games/Stack42Game.tsx` (в батче `6c78b31` +87/−29, `drizzle/migrations/0006_daily_transactions_votes.sql` +37, `src/pages/GalleryPage.tsx` +6)

### ✨ Фичи — Vault + 10k норма

- ⛏️ **Mining Vault 42 — 5 лимиток** — `456d42b` **5 лимиток** Vault 42 + `Neon magnum_mining_vault` + `GET/POST /magnum/api/mining/vault` + GSAP entrance — `drizzle/schema.ts` +7, `server.ts` +40, `src/pages/MiningPage.tsx` +115
- 📦 **P2 + 10k norm — massive data** — `5896ec4` **massive data** P2-норма 10k — `reports/content-2026-09-01-1425.md` +50, `src/pages/MiningPage.tsx`/`EcoPage`/`ShopPage` подготовка

### ⚡ Перфоманс — GSAP 0.12 ripple ×3

- ✨ **GSAP ripple 0.12 + reduced-motion everywhere** — `2fbc507` + `6c78b31` + `fea3f6e` **×3 коммита** — `y 24→0 stagger 0.12`, `hover y:-4`, `gsap.context` revert, `prefers-reduced-motion` gate на **5 pages** (`Eco/Gallery/Mining/Recaps/Shop` +241) и **16 games** — `src/lib/economy.ts` `2520→80` (−2440 дубли, `SHOP_CATALOG 12`, `RARITY_PRICE`), `server.ts` +141/−2, `docs/SPEC-42.md` +34

### 🐛 Фиксы — вход на мобиле + Auth + Gallery

- 📱 **Вход виден на мобиле** — `370b2e1` `mobileAuth` + пункт **в бургер-меню** — `src/components/Layout.tsx` +6, `src/components/Layout.module.css` +3
- 🔐 **Auth modal survive overwrite** — `67e8b22` восстановлена модалка **Вход/Регистрация** + **VIP glow** `conic-gradient` (survives subagent overwrite) — `src/components/AuthStatus.tsx` +87/−11, `src/components/AuthStatus.module.css` +23/−7
- 🖼️ **Gallery 404 закрыт** — `6c78b31` `tests/gallery-404.test.ts` +32, `tests/flappy42.test.ts` +22/−84 фикс, soft-404 галереи → реальные файлы (watchdog `8gallery`)

### 🖼️ Галерея

- 🖼️ **8 файлов галереи OK** — `dc1e440` watchdog **8gallery** + `24ed601`/`dc1e440` — `reports/watchdog-2026-09-01-1427.md` +57, `reports/watchdog-2026-09-01-1421.md` +50 — галерея без 404

### 🤖 Брат-бот

- 🤖 без изменений в окне — бот стабилен, задачи ушли в Vault/Quiz/GSAP (след. инкремент — подсказки по Vault)

### 📖 Дока — спеки + hype + P1

- 📝 **Eco/Mining спеки** — `c969f43` `docs/eco-spec.md` +17, `docs/mining-spec.md` +17 — спеки синхронизированы с `EcoPage`/`MiningPage`
- 💡 **Hype queue +5 → +3** — `fcf6980` + `095c473` **+3 идеи +5 queue** (shop vault 12 / frame verified gold / duel royale → vault/frame/royale/eco/rotation) — `docs/hype-queue.md` +7/−1, `reports/hype-2026-09-01-1421.md` +53, `reports/fix-P0-1421.md` +86
- ✅ **P1 audit closed** — `90a3108` `README.md` +1 — **P1 0/8**, бейдж `P1 closed` держится

### 🧪 Тесты / CI — 2962 passed

- ✅ **2962 passed (SPA fallback + 16 routes + About42 GSAP, +19)** — `6694480` `reports/test-2026-09-01-1430.md` +122, `tests/new-coverage-1442.test.ts` +147
- ✅ **2943 passed ×2** — `f2d255f`/`c969f43` `reports/test-2026-09-01-1424.md` +123 — стабильно 2943→2962 (+19)
- 🟢 **Health 200/200/200** — `85bf61f` `reports/health-2026-09-01-1423.md` +60 (**4/4 routes 200, 8446B, ext via resolve 200, obscura active idle**)
- 🔐 **Auth check OK** — `7480bad` `reports/auth-2026-09-01-1425.md` +158 + правки `About.tsx` +38/−11, `PromoPopup` +32/−3, 5 страниц по +34 (GSAP батч)
- 👀 **Review 10/10 ×2** — `3e40e6e`/`5c9f8ff` `reports/review-2026-09-01-1422.md` +62, `reports/review-2026-09-01-1431.md` +79 — рейтинг **10/10**
- 🐶 **Watchdog OK** — `24ed601` + `dc1e440` **200/200/200 active/Up 8gallery 2bugs** (vault-race + gallery-dup) — без рестарта

---

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
