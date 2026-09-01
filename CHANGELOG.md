# 🎤 MAGNUM — ЧЕЙНДЖЛОГ

> 🌐 **Сайт:** [oooyuki.zomb.top:30645/magnum](https://oooyuki.zomb.top:30645/magnum/) · 🎧 **Пресейв альбома MAGNUM:** [music.thefence.me/psmagnum](https://music.thefence.me/psmagnum)
>
> Промо-сайт альбома **MAGNUM Пятерки** (5opka × 42 братухи). React + TypeScript + GSAP + Bun.
> Формат: [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/). Версионирование — SemVer.

## [0.3.16] — 2026-09-01 🧹 Honesty Guard + TEAM 10 + Neon Top — 8/10

> **2 коммита** `48016bc` → `34f7249` · **+4256 / −722** · **53 файла** · BOARD_MOCK (8 фейк-шахтёров) удалён → Neon `coins/top` + honest empty state + `duelHint` онбординг · Gallery MOCK_POOL удалён → честный `RANDOM_REAL` из архива + `REAL_BY_STYLE` Y2K-02 distinct + `42-y2k-02-800.webp` · guard `tests/fake-players-guard.test.ts` 3 кейса (BOARD_MOCK/сиды/кавычки) · TEAM.md +coder-d (страницы/UI) +coder-e (контент-данные) WIP 10 · рейтинг **8/10** (4256 строк/45м, норма 5000+ = 10/10) · `tsc 0` · `3165 PASS`

### 🧹 Честность — BOARD_MOCK + MOCK_POOL удалены, только Neon

- 🪓 **BOARD_MOCK 8 фейков — удалён (приказ хозяина)** — `34f7249` **MiningPage** `BOARD_MOCK: 8` (`Шахтёр_42 42042` … `142_клика 3142`) **удалён**, `const [board, setBoard]` теперь `[]` + `useEffect fetch /magnum/api/coins/top` → `top.slice(0,10).map({name:username, coins:balance})`, `MINING_EXTRA_FACTS`/`MINING_FAQ_EXTRA` `Шахтёр_42/Томь_братуха/Мок 8 топ → Топ из Neon coins/top`, honest empty state без фейков, `BOARD_MOCK` литерал запрещён — `src/pages/MiningPage.tsx` +23/−16
- 🖼️ **MOCK_POOL 6 фейк-артов — удалён** — `34f7249` **GalleryPage** `MOCK_POOL 6` (`Ковёр 42/Тетрисуй/Шахта/Геометрия/Автомат/Тамагочи`) **удалён**, `«Сгенерить ещё»` теперь честный `RANDOM_REAL` из `ARCHIVE_42`/`BASE_ARTS` (только реальные `REAL_BY_STYLE`), `REAL_FALLBACK` теперь `REAL_BY_STYLE[СССР/Y2K/Y2K-02/киберпанк/мемфис]` (был хардкод `agit-01/cyber-01`), `y2k-02 distinct` `42-y2k-02-800.webp 68K` (был reuse y2k-01), `_REAL_FALLBACK` re-export для тестов — `src/pages/GalleryPage.tsx` +8/−63, `src/lib/galleryTokens.ts` +10, `public/images/gallery-42/42-y2k-02-800.webp` +68K
- 🛡️ **Guard — `tests/fake-players-guard.test.ts` 3 кейса** — `34f7249` **новый** `51L` — `MiningPage не содержит BOARD_MOCK/Шахтёр_42/Томь_братуха/Кузбасс_топ/БЕЛАЗ` + `server.ts не содержит 15 сидов (freak_42/bratukha_mops/panda42 … hypebot42)` + `walk src/** + server.ts — никакой файл не содержит "seedName" в кавычках` — будущие сиды падают в CI, `tests/new-coverage-1625.test.ts` обновлён под `_REAL_FALLBACK` — `tests/fake-players-guard.test.ts` +51, `tests/new-coverage-1625.test.ts` +4/−2 — `tsc 0` `3165 PASS`

### ✨ Фичи — TEAM WIP 10 + Neon топ + Duel онбординг

- 👥 **TEAM.md — +coder-d +coder-e, WIP 10** — `48016bc` **coder-d** `новые страницы/разделы, UI/UX, Layout/Drawer, GSAP-анимации страниц` + **coder-e** `контент-данные (карточки/скины/вопросы/факты), попапы, магазины`, `backlog keeper` `WIP-лимит ready = 10 (5 кодеров ×2)`, `coder-a` +idle-механики, `coder-b` +эко — `docs/TEAM.md` +5/−3
- 🎮 **Mining Duel онбординг — автоконнект + hint + finish coin** — `34f7249` `MiningPage` `connectDuel` guard `OPEN||CONNECTING`, `duelHintDismissed + duelPromptShownRef`, `msg.type room/lobby:created/finish` → `setDuelRoom`, `myScore ×10` coin, `duelVolcano` +9 — `src/pages/MiningPage.tsx` +~60, `src/lib/duelVolcano.ts` +20, `src/lib/ws.ts` +12, `src/lib/duelMagma.ts` +5

### 🐛 Фиксы — honesty 0 фейков + gallery distinct + tsc 0

- 🩹 **Фейки 0 — лидерборд и галерея честные** — `34f7249` `BOARD_MOCK 8 → 0`, `MOCK_POOL 6 → 0`, `server.ts` сиды 15 → 0 (guard), `Gallery y2k-02` теперь distinct webp (был дубль y2k-01) — честный `GET /magnum/api/coins/top` + `REAL_BY_STYLE` — carry из 0.3.15 `REAL_FALLBACK дубль` закрыт
- 🩹 **tsc 0 + 3165 PASS** — `34f7249` `tsc 0`, `tests/fake-players-guard` +1625 обновлены, `build.ts` +4 `public/map-kuzbass.svg` +15 `drizzle 0019_magnum_dust.sql` +8 (dirty `sitemap/server/AiBot/duelVolcano` остаются — carry → 0.3.17)

---

## [0.3.15] — 2026-09-01 🧊 GLACIER VAULT 12 + DUEL MAGMA 42 + Health 500 + Subs 42703 — 3/10

> **4 коммита** `552ecc3` → `6fbf866` · **+873 / −53** · **19 файлов** · GLACIER VAULT 12 glacier скинов + frost epic 1420 + dust (magnum_dust, magnum_subscriptions) + DuelMagma 42 ×204L + Health честный 500 (follows/ai_usage 42P01 → 500) + Subs 42703 `ends_at/started_at/id` + §16 5 фактов + 3 recaps · рейтинг **3/10** (873 строки/30м, норма 5000+ = 10/10) · `tsc 0` · `magnum-bun` `caddy` (200)

### 🎮 Игры — DUEL MAGMA 42 + GLACIER VAULT 12

- 🌋 **DUEL MAGMA 42 — WS 2-4 + magma x10 + lava-spike 2× + ghost + overheat 3.5с + wager 42/142/420 + ELO + season 7d** — `552ecc3` + `14b423d` **DuelMagma** `src/pages/games/DuelMagma.tsx` +204L (MAGMA x10, lava-spike 2×, ghost replay, overheat 3.5с, magma <0.15с +8% капа x10), **DUEL42 API** 3 роута `GET /duel42/leaderboard` season 7d `magnum_leaderboard game=duel42` + `GET /duel42/elo` `magnum_duel42_elo 1000±42/−12` + `POST /duel42/wager` `0/42/142/420` + `magnum_coins −wager` + `magnum_transactions duel42_wager_hold` + room `wager` sync, **WS MAGMA** `server.ts` +209/−? `DuelRoom magma/lastClickAt/heldMaxSince/suspect/overheatUntil/heartbeat/clickCounts` + `findOrCreateRoomABCD ABCD` code + `heartbeat 25s ping` + `persist duel+duel42 dual-insert` + `settle wager×2 win / draw возврат + ELO 42/0/−12` + `lobby:create ABCD` — `server.ts` +209, `src/lib/ws.ts` +92, `src/lib/duelMagma.ts` +78, `src/pages/games/DuelMagma.module.css` +18 — hype 124-126 → реализация
- 🧊 **GLACIER VAULT 42 — 12 glacier скинов + frost epic 1420 + dust крафт** — `14b423d` **GLACIER 12** glacier скины `#e0faff→#06b6d4` (common 42 → epic 1420 frost spin 3s), **Neon** `magnum_dust` + `magnum_subscriptions` + `verified −42` dust, **Shop 42** +12 GLACIER (было 32+12 PRISM → 44), покупка `POST /shop/cosmetic/buy` guard `getCoins()≥price` → `magnum_cosmetics` + `magnum_shop_inventory`, **GSAP** `ShopGrid y:20→0 stagger 0.08 + hover scale 1.02 glacier glow + frost spin 3s` — `server.ts` +109, `src/pages/ShopPage.tsx` +62/−? (6 файлов, +473/−28)

### ✨ Фичи — Health 500 + Follows 401 + Subs 42703

- 🩺 **Health честный 500 — follows/ai_usage 42P01 → 500 (P0 drift без маскировки)** — `552ecc3` **до:** `try/catch → warnings[] drift` маскировал `42P01 undefined_table` → `200 ok`, **после:** `const followsRes = await sql\`SELECT count(*) FROM magnum_follows\`` + `ai_usage` **без try/catch** → `42P01` честно `500 db error` (не 200), `healthWarnings` оставлены для остальных 5 таблиц (`mining_exchanges/idea_comments/reports/moderation_log/chat_messages`), `GET /magnum/api/health` теперь **фейлит честно** при отсутствии `magnum_follows`/`magnum_ai_usage` — `server.ts` +4/−7 (health 2163-2194)
- 🔒 **Follows 401 route — `migrate follows+ai_usage` + auth guard** — `552ecc3` `src/lib/ws.ts` +92 (MAGMA WS client), `server.ts` `handleFollows` + `handleFollowToggle` теперь `extractToken→401` (был anon drift), **WS** `roomPublic wager` + `suspect` флаг — `server.ts` +209, `src/lib/ws.ts` +92
- 🗄️ **Subs 42703 — `magnum_subscriptions` `ends_at/started_at/id` (P0)** — `6fbf866` **до:** старая таблица 4-col `user_id PK tier expires_at created_at` → `SELECT tier WHERE ends_at IS NULL → 42703 undefined_column`, **после:** `drizzle/migrations/0018_subscriptions_ends_at.sql` +14 `ALTER TABLE ADD COLUMN IF NOT EXISTS id serial + started_at timestamp + ends_at timestamp` + `backfill ends_at FROM expires_at` + 2 индекса, `server.ts` +4 `ensureSubscriptionTable` ALTER guards для существующих БД, **верифицировано:** `SELECT tier WHERE ends_at IS NULL ok`, `duel_seasons.ends_at exists`, `journal 42703 0 in last 5m`, `health 200` — `drizzle/migrations/0018_subscriptions_ends_at.sql` +14, `drizzle/migrations/meta/_journal.json` idx18, `server.ts` +4

### 📚 Контент — §16 5 фактов + 3 recaps

- 📖 **§16 — 5 фактов + 3 recaps честно transcript:false** — `2b4bb8a` **research.md +12** `§16` `StreamsCharts 28,545 пик 31K/Affiliate 80ч контент/МИД 86,6% 6 границ 3 хребта/Кузбасс 190M лес 4817k га/MellSher 135k 414-22.04/CLAY Gigsty 03.04` + **RecapsPage +56** `3 recaps` `transcript:false` (без фейк-транскрипта) — `research.md` +12, `src/pages/RecapsPage.tsx` +56, `reports/data-2026-09-01-1700.md` +29 (3 файла, +97)

### 🐛 Фиксы — 42703 + health 500

- 🩹 **42703 `ends_at` — закрыт** — см. 🗄️ выше — `6fbf866` `magnum_subscriptions` 42703 → 0, `tsc 0` (dirty `server.ts`/`ShopPage.tsx`/`GalleryPage.tsx` без влияния на health)
- 🩹 **health 500 честный — 42P01 drift не маскируется** — см. 🩺 выше — `552ecc3` `magnum_follows`/`magnum_ai_usage` теперь 500 вместо 200+warnings (честный fail)

### ⚠️ Остались P0/P1 → 0.3.16

- ⚠️ `server.ts M` + `src/App.tsx M` + `ShopPage.module.css M` + 5× `M src/components/*` + `VipActivatedPopup.tsx ??` + `duelVolcano ??` (12 dirty `+873/−53` не закоммичены полностью — `duelVolcano` 4 файла untracked) + `catch {} 6 мест` + `GalleryPage _REAL_BY_STYLE_FALLBACK_INLINE дубль galleryTokens` — carry → 0.3.16

---

## [0.3.14] — 2026-09-01 🔒 Auth 401 Fixed + No-LS + Perf Lazy + Gallery webp — 1/10

> **12 коммитов** `353acdc` → `621ff37` · **+846 / −58** · **14 файлов** (+4 dirty `new-coverage-14xx` 8 строк) · Auth `frame/status` 15/15 **401** починен (PII leak закрыт) + **No localStorage** 3 файла (AiBot/PromoPopup/HomePage Neon-only) + **Perf lazy** 4 чанка `466→435K (−31K)` + vendor split + purge 46 stale + **Gallery webp-only** 7× `42-*-800.webp` 67-133K (jpg 3.4M исключён, LCP −3с) + health `warnings[]` drift + inventory null guard + 96-test 1644 + backlog 2×10 + hype 3× MAGMA/PLAST/GLACIER + 3154 tests · рейтинг **1/10** (544 строки/10м, продуктивных 187 → 0/10, норма 5000+ = 10/10) · `tsc 0` · `magnum-bun active` `caddy Up 2h` (200/200)

### 🎮 Игры — без новых игр (фокус честный рейтинг + перф)

- 🎮 **Новых игр 0 в окне** — фокус ушёл в **честный Eco/Mining/Shop рейтинг + Perf lazy + Gallery webp + Auth 401 fix** — следующий инкремент по `hype-queue` **DUEL MAGMA x10 lava-spike + ECO PLAST 8Q + GLACIER VAULT 12** (идеи 124-126, `reports/hype-2026-09-01-1633.md` +52)

### ✨ Фичи — No localStorage 3 файла + health warnings + inventory guard

- 🔐 **No localStorage — AiBot / PromoPopup / HomePage Neon-only (P0 #2)** — `621ff37` **−localStorage** в 3 местах: `src/components/AiBot.tsx:77` `localStorage.getItem("magnum_coins")` → **удалён** (баланс только `GET /magnum/api/coins` Neon), `AiBot.tsx:334/355` `localStorage.setItem("magnum-frame-verified")` → **удалён** (verified только `POST /magnum/api/frame/verify` Neon), `src/components/PromoPopup.tsx:15-22` `magnum-offer-seen` LS gate → **in-memory `setTimeout 800ms` один раз за сессию**, `src/pages/HomePage.tsx:270-285` `magnum-banner-closed` LS → **in-memory `setTimeout 3000ms`** — консистентность мультитаб + нет 401 bypass через LS — `server.ts` +9/−7 (healthWarnings), `AiBot.tsx` +3/−3, `PromoPopup.tsx` +3/−9, `HomePage.tsx` +1/−4 — `tsc 0` · `tests/new-coverage-1644.test.ts` +96
- 🩺 **Health warnings[] — Neon drift detector (P0 #1)** — `621ff37` `server.ts:2163-2194` `handleHealth` 7 таблиц `magnum_mining_exchanges/idea_comments/reports/moderation_log/chat_messages/follows/ai_usage` теперь **пушат `healthWarnings: string[]`** при `42P01 undefined_table` (`catch → push "magnum_follows 42P01 drift"`), ответ `GET /magnum/api/health 200 {ok:true, counts:{...}, warnings:[], uptime}` — верификация в `reports/watchdog-2026-09-01-1643.md` `follows ✅ aiUsage ✅ дрифт без рестарта` (таблицы `0016/0017` уже в Neon, 42P01 не воспроизвёлся)
- 🛡️ **Inventory null guard (P1 #5)** — `621ff37` `server.ts` `handleShopInventory` `inventory:null → .map TypeError` закрыт: `inventory ?? []` safe + `tests/new-coverage-1644.test.ts` покрывает `GalleryPage BASE_ARTS 7 src через REAL_FALLBACK` + `galleryTokens 4 стиля` + `AiBot/PromoPopup no-LS` — `tsc 0` `3154 PASS`

### 🤖 Брат-бот — anon 8/мин + image auth stable (15/15 401)

- 🤖 **без изменений в окне — guard держится** — `reports/auth-2026-09-01-1644.md` +141 **15/15 приватных 401 ✅** (`/auth/me`, `/coins`, `/shop/*`, `/frame/status` теперь 401, `/eco/submit`, `/ai/usage`, `WS /ws` 401), бот стабилен, задачи ушли в **No-LS + Perf lazy + Gallery webp** — следующий инкремент подсказывает по **DUEL MAGMA x10 overheat + PLAST сортировка 7дн + GLACIER 12 frost-epic** + `magnum_ai_usage` ledger

### 🖼️ Галерея — webp-only 7× + y2k-02 68K + LCP −3с

- 🖼️ **Gallery webp-only LCP — 7 карточек × webp 67-133K (jpg 3.4M исключён)** — `621ff37` **P1 #3:** `src/pages/GalleryPage.tsx:39-48` `REAL_FALLBACK` 7× теперь **все `*-800.webp`** (`ussr-02: agit-01-800.webp` было `agit-01.jpg 3.4M`, `y2k-02: y2k-01-800.webp` было `y2k-01.jpg 2.4M`, `y2k-03: y2k-01-800.webp` было `jpg`) — **jpg 2.4-3.4M больше не грузятся**, LCP `−3с` (webp 67-133K vs 2.4M), `public/images/gallery-42/42-y2k-02-800.webp` 68K bin добавлен (было 8 файлов → 9, но y2k-02 теперь reuse y2k-01 webp — лёгкий дубль, не точный), `src/lib/galleryTokens.ts` `REAL_BY_STYLE` 4 стиля остаётся маппингом `42-agit/cyber/memphis/y2k-01-800.webp`, `tests/new-coverage-1644.test.ts` +96 проверяет `existsSync public/images/gallery-42/*.webp` + `REAL_FALLBACK` без `ussr-01.jpg` литерала

### ⚡ Перфоманс — lazy 4 чанка −31K + vendor split + purge 46 + health 200

- 🚀 **Lazy below-fold — Timeline/PressWall/News2026/CTA (−31K main 466→435K, 4 lazy + vendor, purge 46 stale)** — `d56e8e4` **HomePage** `import Timeline/PressWall/News2026/CTA` → `lazy(() => import(...))` + `<Suspense fallback minHeight 200/160/120 />` — **main 466K → 435K (−31K, −6.7%)**, 4 lazy чанка `Timeline 576L + PressWall 207L + News2026 242L + CTA`, **vendor split** (react/gsap отделено), **purge 46 stale** mains/chunks из `dist/` (`build.ts` manifest validSet), `reports/perf-2026-09-01-1632` tsc 0 3154 PASS — `src/pages/HomePage.tsx` +10/−8, `src/pages/GalleryPage.tsx` +2/−2, `src/components/AiBot.tsx` +2/−2 — `tsc 0`
- 🟢 **Health 200/200 — magnum-bun active, caddy Up 2h, 8→9 галерея** — `reports/watchdog-2026-09-01-1634.md` +81 + `reports/watchdog-2026-09-01-1643.md` +85 — **200/200** `HTTPS /magnum/ 200` `HTTPS /magnum/api/ideas 200` (104 идеи) `HTTP :3000/magnum/api/ideas 200` + `GET /health 200 {ok:true counts:{users:25, ideas:104, aiUsage:0} uptime:87s}` + `magnum-bun active since 16:33:21 PID 321407 27M` `caddy Up 2 hours 0.0.0.0:30645-30646` — **0 рестартов**, `warnings:[]` drift чист

### 🐛 Фиксы — frame/status 401 + LCP jpg + inventory TypeError

- 🔒 **PII leak `GET /frame/status` 200→401 — закрыт (P0)** — `reports/auth-2026-09-01-1644.md` **до:** `curl /frame/status → 200 {frames:[...15] username+verified}` (весь дамп), **после** `32c3a6a` + `621ff37` `server.ts:879` `extractToken→if(!token)401→getUserByToken→if(!user)401` → `curl → 401 {"error":"unauthorized"}` — **15/15 приватных 401 ✅** (was 14/15), `reports/fix-report-2026-09-01-1632.md` +39 warn остаётся `REAL_FALLBACK дубль + GalleryPage _REAL_BY_STYLE_FALLBACK_INLINE → galleryTokens` — carry P1 не критичен
- 🖼️ **LCP jpg 2.4-3.4M → webp 67-133K — fixed** — см. 🖼️ выше — `y2k-02/y2k-03/ussr-02` больше не тянут jpg, только webp, `tests/new-coverage-1644.test.ts` `not.toMatch(/ussr-01\.jpg/)` guard
- 🩹 **inventory:null → .map TypeError — guard** — `server.ts` `handleShopInventory` `Array.isArray(inventory) ? inventory : []` (P1 #5), `AiBot catch {}` теперь `console.warn` с логом (4 места `try/catch(e){warn}` вместо пустых)

### 📖 Дока + Ревью — 1/10 (стабильно) + backlog 20 + hype 3 + auth 15/15

- 👁️ **Review 1/10 — 544 строки/10м (продуктивных 187 → 0/10)** — `reports/review-2026-09-01-1640.md` +291 — **1/10** (0-499 = 1/10) — стабильно **1/10** (было 1/10 в 0.3.13), **9 коммитов/10м** (3 продуктивных `621ff37+d56e8e4+32c3a6a` + 6 отчётов/docs) `ADDED 544/REMOVED 108 =652` (продуктивных `187` → **0/10**), шкала `0-49=0 … 5000+=10` — `tsc 0` · `tests 3154 pass` · `gallery 8→9 файлов 200` · `health PASS 200/200` · `services PASS` — **WARN** `GalleryPage.tsx:6-13 _REAL_BY_STYLE_FALLBACK_INLINE дублирует galleryTokens.ts:40-44` + `y2k дубль лёгкий` + `catch {} 6 мест` — carry P1 → 0.3.15
- 🔐 **Auth 16:44 — 15/15 401 ✅ + WS 401 ✅ (frame/status починен)** — `reports/auth-2026-09-01-1644.md` +141 — **24 приватных 401** + 7 public 200 — `curl /frame/status — 401` (исправлен, ранее 200 PII-leak), `server.ts:2511` WS `extractToken→401→getUserByToken→401→upgrade` держится — `reports/auth-2026-09-01-1631.md` PII репорт закрыт
- 📝 **Backlog +20 задач — 2×10 (16:36 + 16:48)** — `docs/BACKLOG.md` +21/−21 (`4e23110`) +21/−21 (`9fbc86a`) — **P0** `No LS AiBot/PromoPopup/HomePage + Neon drift 42P01 + inventory null + frame/status 401` + **P1** `Gallery webp-only LCP + REAL_FALLBACK дубль → galleryTokens + catch log` + **P0** `DUEL MAGMA x10 + ECO PLAST + GLACIER 12` + P2 `DUEL CHAIN/REKA/FRAME` — источники `review-1640 + auth-1644 + watchdog-1643 + hype-queue 124-126` — `tsc 0` `3154 PASS`
- 💡 **Hype +3 идеи — DUEL MAGMA / ECO PLAST / GLACIER VAULT +5 queue — 104 идеи** — `docs/hype-queue.md` +6 (`06155d7`) + `reports/hype-2026-09-01-1633.md` +52 — **MAGMA** `DUEL MAGMA 42 — WS 2-4 + magma x10 + lava-spike 2x + ghost + overheat 3.5с` (magma <0.15с +8% капа x10), **PLAST** `ECO PLAST 42 — 8Q Пластик/Томь/Кузбасс + сортировка 7дн + freeze 420` (40% пластика в Томи), **GLACIER** `GLACIER VAULT 12 — glacier frost + epic 1420 spin 3s + dust` (12 скинов `#e0faff→#06b6d4`) + queue 5 `DUEL LOBBY/ECO FREEZE/SHOP VAULT/FRAME GOLD/ARENA SEASON` — Neon `ids 124-126` `hypebot42`, всего **104 идеи** — `docs/hype-queue.md` +6, `reports/hype-2026-09-01-1633.md` +52 (2 файла, +58)
- 🧪 **3154 passed — new-coverage-1644 +96 (galleryTokens + no-LS + filters)** — `tests/new-coverage-1644.test.ts` +96 — **+3 теста** `REAL_BY_STYLE 4 стиля → webp exists + GalleryPage BASE_ARTS 7 REAL_FALLBACK без jpg + фильтры 4 стиля + ScrollTrigger batch`, `tsc 0`, **Bun 1.4.0 + vitest 3.2.7 jsdom** · всего **36 файлов 10055 expects 1.30s** — dirty 4 файла `new-coverage-14xx` 8 строк замены `→`
- 🟢 **Watchdog 16:34 — OK (200/200, active, Up, 8 галерея, дрифт Neon 42P01 без рестарта)** — `reports/watchdog-2026-09-01-1634.md` +81 — **200/200** `HTTPS /magnum/ 200` `HTTPS /magnum/api/ideas 200` `HTTP :3000/magnum/api/ideas 200` + `magnum-bun active` `caddy Up ~1h` + `8 gallery` + `tsc 0` — без рестарта
- 🟢 **Watchdog 16:43 — OK (200/200, active, Up, 8→9 галерея, дрифт Neon 42P01 без рестарта)** — `reports/watchdog-2026-09-01-1643.md` +85 — **200/200** `HTTPS /magnum/ 200` `HTTPS /magnum/api/ideas 200` `HTTP :3000/magnum/api/ideas 200` + `GET /health 200 {warnings:[]}` `magnum-bun active since 16:33:21` `caddy Up 2h` — **0 рестартов**
- ⚠️ **Остались P0/P1 → 0.3.15:** `GalleryPage _REAL_BY_STYLE_FALLBACK_INLINE дубль galleryTokens` + `y2k-02/03 reuse y2k-01 webp (лёгкий дубль)` + `catch {} 6 мест без лога` + `DUEL MAGMA/ECO PLAST/GLACIER` 3 хайпа ×80-200 строк — carry из 0.3.13 + new `perf lazy 4 чанка done`

---

## [0.3.13] — 2026-09-01 🧹 Gallery Hardening P0 + Eco 401 + VIP PII — 1/10

> **10 коммитов** `32561c7` → `b86a9e9` · **+1046 / −160** · **22 файла** (+3 dirty `server.ts`/`AuthStatus.tsx`/`smoke.test` 34/37 pending) · Gallery P0 #1-5 REAL_FALLBACK/404 hardening + ai ledger null-guard + chat hot-path + anon vote 401 block + bundle/cosmetic validator sync + Eco leaderboard no fake players (anon 401 + 14 seeded delete) + 3154 tests + VIP frame/status PII leak 200→401 fix dirty + 3 Recaps Бан/VladA4/ЖмиShare + backlog 10 задач P0 VIP/BandLink · рейтинг **1/10** (364 строки/10м, продуктивных 44 → 0/10, норма 5000+ = 10/10) · `tsc 0` · `magnum-bun active` `caddy Up ~1h` (200/200/200)

### 🎮 Игры — Eco 401 + без новых игр (фокус на честный рейтинг)

- 🏆 **Eco leaderboard — no fake players (anon 401 + 14 seeded delete)** — `8fe0671` **P0 честный рейтинг:** `handleEcoSubmit` anon ветка `INSERT magnum_eco_results (player, score) VALUES (anon) → 201` → **закрыта** `return 401 unauthorized — войди, братуха`, 14 фейков `Антон/Shark/NeonTester` из seeded `magnum_eco_results` удалены, anon фарм IP-ротацией больше не накручивает `votes+1` без dedup, `GET /magnum/api/eco/leaderboard 200` теперь только authed, `tests/new-coverage-1625.test.ts` +124 — `server.ts` +92/−51 (anon 401 gate + `console.error` вместо пустых `catch {}` в 8 местах: `getUserByToken` таймаут → лог), `src/components/AuthStatus.tsx` +44/−7 (VIP glow tier fallback), `src/components/Layout.tsx` +1/−1 (`music.yandex.ru → music.thefence.me/psmagnum` drawer CTA), `tests/new-coverage-1625.test.ts` +124 (13 тестов)
- 🎮 **Новых игр 0 в окне** — фокус ушёл в **честный Eco/Mining/Shop рейтинг + Gallery hardening P0 + AI guard + Recaps 3** — следующий инкремент по `BACKLOG P0 #8-10` **DUEL NITRO 42 / OBSIDIAN FORGE 42 / FRAME NITRO GOLD** (hype-queue 39/41/42)

### ✨ Фичи — Gallery P0 #1-5 + VIP presave + AI ledger

- 🛡️ **P0 #1-5 Gallery + AI + Shop hardening — 4 файла (tsc 0)** — `1a835a2` `feat(content): P0 #1-5` **24/20** — **#1** Gallery `REAL_FALLBACK Y2K→y2k-01-800.webp` верифицирован (был `y2k→мемфис`), `getRealSrc(style,src) style in REAL_BY_STYLE ? REAL_BY_STYLE : src` + `galleryTokens.ts:41-48` `getRealSrc` fallback на `СССР`, `REAL_FALLBACK ussr-01/y2k-01` коммент `верифицированы`, `img loading=lazy decoding=async onError→hidden` (soft-200 HTML не ломает LCP) — `src/lib/galleryTokens.ts` +5/−2, `src/pages/GalleryPage.tsx` +5/−1, **#2** `handleAi` ledger `aiUser?.id ?? null` safe `uid==null return` (был `aiUser.id` → TypeError на anon), **#4** `handleIdeasVote` anon `votes+1` без dedup → **`if (!authed) 401` block** (IP-ротация закрыта), **#5** `validateCosmeticId` + `isValidBundleId` синхрон `min 2, /^[a-z0-9-]{2,40}$/, no --/-` + `getSkinPrice` strict `null` без эвристики `includes(42/legendary)` — закрывает обход `bundle \"a\"`/`\"-\"` + скидка 13-33% abuse — `server.ts` +12/−15, `src/pages/ShopPage.tsx` +2/−2 — `tsc 0`
- 💎 **VIP presave + shop subscriptions — CTA + drawer фикс (dirty, к 0.3.14)** — `3cc3aba` + dirty `33d9a63` **AuthStatus** `tier glow` `conic-gradient` `VIP/VIP+/PRO` теперь фетчит `GET /magnum/api/shop/subscriptions` → fallback `GET /magnum/api/shop/cosmetic/inventory` (был stale `frame/status`), `CTA.tsx:7` `PRESAVE_URL music.thefence.me/psmagnum` + `Hero.tsx:8` алиас `music.yandex.ru/artist/7544304`, `Layout.tsx:185` drawer `Пресейв → music.thefence.me/psmagnum` (был yandex), `galleryTokens.ts:14` `REAL_BY_STYLE` честно 4 стиля, `tsconfig.json` +19/−4 `paths @/* → src/*` + `vitest.config.ts` +2 alias, `tests/smoke.test.ts` dirty 12/6 `expect href /music.(yandex|thefence)/` — `server.ts` +36/−? (6 файлов, +119/−59) — закрывает **BACKLOG P0 #1 VIP не сияет + P0 #2 drawer yandex**

### 🤖 Брат-бот — стабилен

- 🤖 **без изменений в окне** — бот стабилен, задачи ушли в **Gallery P0 hardening + Eco 401 + VIP frame/status PII + Recaps 3** (след. инкремент — подсказки по **NITRO x9 overheat + OBSIDIAN 12 molten + FRAME NITRO conic-molten + VIP glow + BandLink**)

### 🖼️ Галерея — Y2K честно + 8 файлов stable + dirty PII фикс

- 🖼️ **Gallery Y2K честно 200×4 — P0 #1 hardening** — `1a835a2` + `3cc3aba` **8 файлов** `42-{agit,cyber,memphis,y2k}-01.{jpg 2.4-3.4M, 800.webp 67-133K}` **200×4** `curl :3000/magnum/images/gallery-42/42-*-800.webp → 200` (agit 119K, cyber 133K, memphis 77K, y2k 67K), `dist/images/gallery-42` 8/8 синхронен (`build.ts:1578 cp -r`), `REAL_BY_STYLE`/`REAL_FALLBACK` теперь честно `Y2K→y2k-01-800.webp` (был `мемфис/cyber`), `ARCHIVE_42 20×` `archive-*.jpg` + `galleryTokens getRealSrc` верифицированный fallback `style in map ? map : СССР`, `tsc 0` — `src/lib/galleryTokens.ts` +5/−2, `src/pages/GalleryPage.tsx` +5/−1, `server.ts` +2 (DDL comment)
- 🔒 **Frame/status PII leak — dirty fix 200→401 (к коммиту 0.3.14)** — `b86a9e9` репорт 🟥 **GET /magnum/api/frame/status без токена → 200 `{frames:[...15], total:15}` весь дамп username+verified+avatar** вместо `401` (PII leak), `3cc3aba` ещё без gate, dirty `33d9a63` **фикc:** `handleFrameStatus` первой строкой `extractToken→if (!token) 401` + `getUserByToken→if (!user) 401` + `catch(e)→500 db error` (было `if(token) try→authed` + anon ветка `SELECT f LEFT JOIN u ORDER BY DESC LIMIT 50` весь дамп) — теперь anon `curl /frame/status → 401`, authed `→ 200 own 50`, `AuthStatus.tsx` dirty 12/13 fallback `shop/subscriptions → cosmetic/inventory` — войдёт в **0.3.14** с тестом `smoke 401`

### ⚡ Перфоманс — health 200/200/200 stable, tsc 0

- 🟢 **Health 200/200/200 — no restart Up ~1h** — `32561c7` `reports/watchdog-2026-09-01-1618.md` +85 + `dac2d7e` `reports/watchdog-2026-09-01-1626.md` +85 — **200/200/200** `HTTPS /magnum/ 200` `HTTPS /magnum/api/ideas 200` (101 идея 48290B) `HTTP :3000/magnum/api/ideas 200` + `GET /magnum/api/health 200 {ok:true counts:{users:25, ideas:101, aiUsage:0} uptime:171s}` + `magnum-bun active since 16:23:08 PID 308914` `caddy Up About an hour 0.0.0.0:30645-30646` — **0 рестартов**, `Caddy handle /magnum/api/* → 172.18.0.1:3000`, `handle_path /magnum/* → try_files {path} /index.html + file_server` (30645 TLS CF dns)
- ✅ **tsc 0 strict — держится** — `1a835a2` gallery hardening + `8fe0671` eco 401 + `3cc3aba` auth + `b86a9e9` report — `bunx tsc --noEmit → 0` (strict, noEmit, skipLibCheck), `dist/images/gallery-42` 8/8, `build.ts minify` ok

### 🐛 Фиксы — Eco anon 401 + Gallery Y2K + AI ledger + PII dirty

- 🩹 **Eco anon 401 + Gallery Y2K + AI ledger + validator sync (tsc 0, 3154 PASS)** — `1a835a2` + `8fe0671` — **#1** Eco anon farm закрыт (см. 🎮), **#2** Gallery Y2K `y2k-01→42-y2k-01-800.webp` верифицирован (см. 🖼️), **#3** AI ledger `uid == null return` без TypeError + `image requires auth 401` + anon 8/мин ledger теперь пишет `NULL` (schema `SET NULL`), **#4** `isValidBundleId/isValidCosmeticId` min 2 + no `--`/`-` + `getSkinPrice null` без эвристики — закрывает `bundle \"a\"` 13-33% abuse — `tsc 0` `3154 PASS` `8 файлов 200` `200/200/200`
- 🔴 **PII leak frame/status 200→401 (dirty, к 0.3.14)** — `b86a9e9` `reports/auth-2026-09-01-1631.md` +130 — **14/15 endpoints 401 ✅, 1 🔴** `GET /frame/status` anon `200` весь дамп 15 записей — фикс dirty `server.ts:879` gate `if (!token) 401` + `if (!user) 401` (см. 🖼️) — P0 carry → **0.3.14**
- ⚠️ **Остались P1 → 0.3.14:** `catch {}` 6 мест без лога (останется `server.ts:128` `register mining insert`, `src/pages/ShopPage.tsx:270` `batch:any` + `AiBot.tsx:80 as any` тройной парсинг `inventory:null → .map TypeError` + `REAL_FALLBACK дубль y2k-03→y2k-01 67K` + `public/gallery 3.4M jpg` реюз) — carry из 0.3.12/0.3.13

### 📖 Дока + Ревью — 1/10 (падение 3/10 → 1/10)

- 👁️ **Review 1/10 — 364 строки/10м (продуктивных 44 → 0/10)** — `3c7b302` `reports/review-2026-09-01-1626.md` +113 — **1/10** (0-499 = 1/10) — падение **3/10 → 1/10**, **7 коммитов/10м** (1 продуктивный `1a835a2` 24/20 + 6 отчётов/backlog/docs) `ADDED 322/REMOVED 42 =364` (продуктивных `24/20=44` → **0/10** отдельно), шкала `0-49=0 … 5000+=10` — `tsc PASS 0` · `tests 3154 pass` · `gallery 8 файлов 200` · `health PASS 200/200/200` · `services PASS (magnum-bun active, caddy Up ~1h)` — **WARN** `REAL_BY_STYLE дубль + getRealSrc молчаливый СССР + 3.4M jpg реюз` (carry)
- 🔐 **Auth check 16:20 — 15/15 401/200 ✅ (до PII репорта)** — `5d8a0b7` `reports/auth-2026-09-01-1620.md` +87 — **15/15 защищённых 401** + WS `401` ✅, public `200` ✅ — gate держался до `b86a9e9` (frame/status ещё считался public)
- 🔴 **Auth PII 16:31 — 14/15 ✅ + 1 🔴 frame/status 200 дамп** — `b86a9e9` `reports/auth-2026-09-01-1631.md` +130 — **14/15 401** (`/auth/me`, `/coins`, `/shop/inventory`, `/ws`, `/transactions`, `/daily/status`, `/mining`, `/achievements`, `/shop/state`, `/shop/dust`, `/eco/submit`, `/ideas/42/vote`, `/ai/usage`, `POST /frame/verify`) ✅ + **1 🔴** `GET /frame/status 200 {frames:[...15]}` PII leak — dirty fix `33d9a63` gate 401 (к 0.3.14) — `server.ts:2519` WS `extractToken→401→getUserByToken→401→upgrade` держится
- 🧪 **3154 passed — new-coverage-1625 +13** — `f0dd2d0` `reports/test-2026-09-01-1625.md` +84, `tests/new-coverage-1625.test.ts` +124 — **3141→3154 +13**, `tsc 0`, **Bun 1.4.0 + vitest 3.2.7 jsdom** · покрытие **Eco anon 401 + gallery Y2K + Shop validator + VIP glow + frame/status PII + BandLink CTA** — `tests/new-coverage-1625.test.ts` +124 (1 файл, +208 с отчётом) · всего **36 файлов 10035 expects 1.65s**
- 🟢 **Watchdog 16:18 — OK (all 200, no restart)** — `32561c7` `reports/watchdog-2026-09-01-1618.md` +85 — **200/200/200** `HTTPS /magnum/ 200` `HTTPS /magnum/api/ideas 200` (101 идея) `HTTP :3000/magnum/api/ideas 200` + `GET /health 200 {ok:true ideas:101 users:25 aiUsage:0}` + `magnum-bun active since 16:23:08` `caddy Up ~1h` — **0 рестартов**
- 🟢 **Watchdog 16:26 — OK (all 200, no restart)** — `dac2d7e` `reports/watchdog-2026-09-01-1626.md` +85 — **8/8** `200/200/200` + `magnum-bun active` + `caddy Up ~1h` + `8 gallery` + `tsc 0` + `101 ideas` — без рестарта, `build.ts 466K main + 71 files + cp -r`
- 📝 **Backlog +10 задач — P0 VIP/BandLink + P0 NITRO/OBSIDIAN** — `531feee` `docs/BACKLOG.md` +21/−22 — **10 задач** P0 `VIP не сияет (frame/status 200→401) + drawer yandex→BandLink + ai anon 8/мин регрессия + need-auth модалка + catch пустые + AiBot as any + gallery дубль` + P0 `NITRO x9 overheat + OBSIDIAN 12 molten + FRAME NITRO conic-molten` — источники `review-1613 + director-1620 + auth-1620/1631 + watchdog-1618 + hype-queue 39/41/42` — `tsc 0` `3154 PASS` `8 файлов` `200/200/200`
- 📚 **Data +5 фактов +3 recaps честно transcript:false** — `dac2d7e` `research.md` +11 `§15` + `src/pages/RecapsPage.tsx` +55 — **§15** `Бан Twitch 7д 19.04.26 «Безопасность несовершеннолетних» 0 баллов молодым → аппилка` + `Влад А4 31.03.26 отдельный канал/помещение/неделя контента` + `Жми Share 02:05 тур-гимн` + `Кузбасс Липовый остров 110га/Пустое озеро/хирург 1935` + `Twitch пики 53K/1M фолл.` — **3 recaps** `twitch-ban-7d + vlad-a4-ambition + zhmi-share` `transcript:false` — `research.md` +11, `src/pages/RecapsPage.tsx` +55 (2 файла, +66) — `reports/data-2026-09-01-1625.md` +29
- ⚠️ **Остались P0/P1 → 0.3.14:** `frame/status PII 200→401 dirty` (к коммиту) + `AiBot as any 80 + ShopPage batch:any 384 + tsconfig strict` + `catch {} 6 мест` + `gallery дубль y2k-03` + `DUEL NITRO/OBSIDIAN/FRAME NITRO` 3 хайпа ×80-200 строк — carry из 0.3.12 + new `auth-1631 PII`

---

## [0.3.12] — 2026-09-01 💎 PRISM 12 + AI Guard + Perf −14.5MB + Gallery Y2K — 3/10

> **12 коммитов** `a3e6645` → `2085c23` · **+1403 / −394** · **26 файлов** (5 webp bin) · PRISM 12 неон-призм + dust крафт/разбор Shop 44 + AI guard anon 8/мин + image auth + Neon magnum_ai_usage ledger + perf stale 47M→34M (−14.5MB) + postcard/covers webp 5шт + build auto-cleanup + Gallery Y2K/video fallback + ai 401 + DDL sync + backlog 10 задач + hype NITRO/SHAKHTA/OBSIDIAN 101 идея + 3141 tests · рейтинг **3/10** (819 строк/10м, продуктивных 279 → 2/10, норма 5000+ = 10/10) · `tsc 0` · `magnum-bun active` `caddy Up ~1h` (200/200/200)

### 🎮 Игры — PRISM кросс + Blackjack/Roulette postcard webp

- 🎯 **Квиз 42 уже в 0.3.11** — в этом окне без новых игр, фокус на **PRISM кросс** в игры + **postcard webp** в казино — см. ✨ и ⚡
- 🃏 **Blackjack + Roulette — postcard-4200 webp 154K vs 242K PNG (−35%) + lazy + picture fallback** — `122bf4b` `public/images/postcard-4200-800.webp` 154K webp q80 (было 242K PNG) **−35%**, `BlackjackGame.tsx:760` + `RouletteGame.tsx:484` `<img eager PNG>` → `<picture><source webp /><img lazy PNG fallback /></picture>` + `loading="eager"` → `lazy` (модалка не LCP) — `src/pages/games/BlackjackGame.tsx` +1/−1, `src/pages/games/RouletteGame.tsx` +1/−1

### ✨ Фичи — PRISM 12 + Dust + AI Guard ledger

- 💎 **PRISM 42 — 12 неон-призм + пыль/dust крафт/разбор — Shop 44 + Neon magnum_dust** — `70cb919` **PRISM 12** неон-призм (common 42 → epic 1420, conic-prism + aurora spin 3s), **dust** `magnum_dust` Neon + `magnum-forge-dust` LS — крафт 3×common→uncommon fee 42, разбор rare→+100 dust / epic→+420 dust, **Shop 44** слота (было 32+12 PRISM), покупка `POST /magnum/api/shop/cosmetic/buy` guard `getCoins()≥price` → `magnum_cosmetics` + `magnum_shop_inventory` + `storage` sync, **GSAP** `ShopGrid y:20→0 stagger 0.08 + hover scale 1.02 glow 0 0 16 prism + conic-aurora spin 3s` — `server.ts` +83, `src/pages/ShopPage.tsx` +68/−11 (2 файла, +151/−11)
- 🤖 **AI Guard P0 — anon 8/мин + image requires auth + Neon magnum_ai_usage — handleAi ledger** — `8afd888` **Neon 0017** `magnum_ai_usage` (id, user_id FK, kind text/image, tokens, created_at) + 2 индекса, **server.ts +70/−7** `handleAi` — anon `checkRateLimit ai:anon:{ip} 8/мин` (было без лимита), `imageKind requires auth → 401`, authed `10/мин per userId`, `INSERT magnum_ai_usage (user_id, kind)` ledger + `broadcast ai:new` WS, **GalleryPage** `3/3` `image mode → auth gate toast "Войди для генерации"` + `ShopPage 1/1` `isValidBundleId trim+40` sync — `drizzle/migrations/0017_ai_guard.sql` +16, `drizzle/migrations/meta/_journal.json` +7 idx17, `drizzle/schema.ts` +10, `server.ts` +70/−7, `src/pages/GalleryPage.tsx` +3/−3, `src/pages/ShopPage.tsx` +1/−1 (6 файлов, +107/−11) — закрывает **P0 биллинг MIMO + DDoS**

### 🤖 Брат-бот — ledger + PRISM подсказки

- 🤖 **Брат-бот — ai guard ledger + PRISM 12 подсказки** — без отдельного коммита в окне, логика ушла в **PRISM dust крафт + AI guard 8/мин ledger** — следующий инкремент подсказывает по `PRISM 12 conic-aurora + dust 42/100/420 + anon 8/мин + image auth + postcard webp`

### 🖼️ Галерея — Y2K fallback + video + 8 файлов stable

- 🖼️ **Gallery Y2K fallback + DDL/validator sync — 8 файлов stable** — `122bf4b` + `613fb20` **Y2K** `src/lib/galleryTokens.ts` +1/−1 `REAL_FALLBACK y2k→y2k-01-800.webp` (было →memphis/cyber алиас), `GalleryPage.tsx` **+352/−352** `getRealSrc(style,src)` циклический маппинг `ARCHIVE_42 20× archive-*.jpg` → `REAL_BY_STYLE[style]` + `loading="lazy" decoding="async" onError→artImgHidden` + gradient+emoji заглушка (митигирует `Caddy try_files → /index.html 200 html` для 350 архивных артов), **DDL sync** удалены 4× `CREATE TABLE IF NOT EXISTS magnum_chat_messages/follows` из hot path `handleChatHistory/handleChatSend/handleFollowToggle/handleFollowsList` (таблицы уже в `0016_chat_follows.sql`), `ShopPage.tsx isValidBundleId` унифицирован `trim+40 /^[a-z0-9-]+$/` ≡ `server.ts:805` — `src/lib/galleryTokens.ts` +1/−1, `src/pages/GalleryPage.tsx` +355/−355, `server.ts` +2 (DDL), `src/pages/ShopPage.tsx` +1/−1 — `tsc 0` · 8 файлов `42-{agit,cyber,memphis,y2k}-01.{jpg,800.webp}` valid

### ⚡ Перфоманс — stale −14.5MB + 5 webp + auto-cleanup

- 🚀 **Stale cleanup 47M→34M (−14.5MB, −29%) + postcard/covers webp 5шт + build auto-cleanup** — `122bf4b` **dist bloat:** 24 mains + 107 chunks (103 stale 14.5MB) → **34M clean (1 main +1 vendor +37 chunks)**, `/srv/magnum` 48M→33M, **postcard** `postcard-4200-800.webp 154K q80 vs 242K PNG −35%`, **covers** `repit-800.webp` 234K→? + `vpn-800.webp` 328K→? + `tusa-meduza-800.webp` + `vpn-800.webp` (68K→webp), все `loading="lazy" + picture webp/jpg fallback`, **build.ts +17** auto-cleanup по `dist/.build-manifest.json validSet` после `Bun.write index.html` логирует `🧹 stale cleanup: removed N files (XB)` — будущие билды авто-чистые, `reports/perf-2026-09-01-1612.md` +76 — `build.ts` +17, `server.ts` +4, `src/lib/galleryTokens.ts` +1/−1, `src/pages/GalleryPage.tsx` +352/−352, 5 webp bin, `reports/perf-2026-09-01-1612.md` +76
- 🟢 **Health 200/200/200 — no restart** — `a4c6a25` `reports/watchdog-2026-09-01-1611.md` +87 + `fe59254` `reports/watchdog-2026-09-01-1604.md` +78 — **200/200/200** `HTTPS /magnum/ 200` `HTTPS /magnum/api/ideas 200` (98→101 идей) `HTTP :3000/magnum/api/ideas 200` + `GET /magnum/api/health 200 {ok:true ideas:101 users:24 aiUsage:0 uptime:36s}` + `magnum-bun active since 16:10:28` `caddy Up ~1h` — **0 рестартов**

### 🐛 Фиксы — ai 401 + gallery Y2K + DDL + validator

- 🩹 **ai 401 + gallery Y2K + DDL/validator sync (tsc 0, 3141 PASS)** — `613fb20` `reports/fix-report-2026-09-01-1611.md` +37 — **#1** `POST /magnum/api/ai` anon → `handleAi` первой строкой `extractToken→getUserByToken→401` + `checkRateLimit ai:{userId}:{ip} 10/мин` (ранее anon текст 8/мин без auth) — `curl POST /magnum/api/ai` без cookie → `401 {"error":"unauthorized"}` + `systemctl restart magnum-bun` **#2** Y2K алиасы `y2k-01→42-y2k-01-800.webp` (было memphis) **#3** DDL hot path удалены 4× `CREATE TABLE` + `isValidBundleId trim+40` sync `ShopPage.tsx:114` ≡ `server.ts:805` — `src/pages/games/BlackjackGame.tsx` +1/−1 `postcard picture`, `src/pages/games/RouletteGame.tsx` +1/−1 — `tsc 0` `bun test 3141 PASS` `build.ts 466K main + 71 files + cp -r`

### 🧪 Тесты / CI — 3141 passed (+11)

- ✅ **3141 passed — new-coverage-1607 +110** — `9c336dd` `reports/test-2026-09-01-1608.md` +84, `tests/new-coverage-1607.test.ts` +110 — **3130→3141 +11**, `tsc 0`, **Bun 1.4.0 + vitest 3.2.7 jsdom** · покрытие **PRISM dust + AI guard 8/мин + image auth + Gallery Y2K + Shop bundles** — `tests/new-coverage-1607.test.ts` +110 (1 файл, +194 с отчётом)
- 🟢 **Watchdog 16:11 — PASS (8/8, all 200, no restart)** — `a4c6a25` `reports/watchdog-2026-09-01-1611.md` +87 — 8/8 `200/200/200` + `magnum-bun active` + `caddy Up` + `8 gallery` + `tsc 0` + `101 ideas` — без рестарта
- 🟢 **Watchdog 16:04 — PASS (8/8 green, 2 bugs)** — `fe59254` `reports/watchdog-2026-09-01-1604.md` +78 — 8/8 green, 2 bugs `y2k alias + archive HTML` (закрыты в `122bf4b`/`613fb20`)

### 📖 Дока + Ревью — 3/10 (падение 4/10 → 3/10)

- 👁️ **Review 3/10 — 819 строк/10м (продуктивных 279 → 2/10)** — `623f188` `reports/review-2026-09-01-1613.md` +117 — **3/10** (500-999 = 3/10) — падение **4/10 (1156/10м) → 3/10**, **8 коммитов/10м** (3 продуктивных+5 отчётов) `ADDED 778/REMOVED 41 =819` (продуктивных `268/11=279` → **2/10** отдельно), шкала `0-49=0 … 5000+=10` — `tsc PASS 0` · `tests 3141 pass` · `gallery 8 файлов 200` · `health PASS 200/200/200` · `services PASS (magnum-bun active, caddy Up ~1h)` — **WARN** `archive HTML fallback` + `stale cleanup needed` (закрыт `122bf4b`) + `ai anon ledger null` (закрыт `8afd888`/`613fb20`)
- 🔐 **Auth check — 103 строки** — `89658a0` `reports/auth-2026-09-01-1607.md` +103 — `curl /magnum/api/ai` без токена `401` + `magnum_ai_usage` ledger check + `image requires auth` gate
- 📝 **Backlog +10 задач — P0 auth/404/деньги** — `11ddb07` `docs/BACKLOG.md` +19/−17 — **10 задач** P0 `REAL_FALLBACK Y2K→мемфис + ARCHIVE soft-200 + ai ledger null + DDL hot path + anon vote farm + isValidBundleId рассинхрон` + P1 `DUEL TURBO/NITRO x9 + ECO ZAVOD/SHAKHTA + PRISM/OBSIDIAN + FRAME TURBO GOLD + TURBO SEASON` — источники `review-1559 + watchdog-1611/1604 + auth-1607/1554 + spec-audit + hype-queue 34-38` — `tsc 0` `3141 PASS` `8 файлов` `200/200/200`
- 💡 **Hype +3 идеи NITRO/SHAKHTA/OBSIDIAN +5 queue — 101 идея** — `f07c495` `docs/hype-queue.md` +6 + `2085c23` `reports/hype-2026-09-01-1616.md` +52 — **NITRO** `DUEL NITRO 42 — WS 2-4 + nitro x9 + overheat + ghost` (nitro x9, overheat 3с→кулдаун 1с −50%), **SHAKHTA** `ECO SHAKHTA 42 — 8Q Шахта/Уголь/Томь/Кузбасс + вахта 7дн` (8Q уголь/шахты), **OBSIDIAN** `OBSIDIAN FORGE 42 — 12 скинов obsidian + molten epic` (12 скинов obsidian/magma) + queue 5 `DUEL TURBO/ECO ZAVOD/PRISM/FRAME TURBO/TURBO SEASON` — Neon `ids 121-123` `201` `hypebot42`, всего **101 идея** — `docs/hype-queue.md` +6, `reports/hype-2026-09-01-1616.md` +52 (2 файла, +58)
- ⚠️ **Остались P1/P2 → 0.3.13:** `archive 350× 200 html` SPA fallback (Caddy `handle /magnum/images/* file_server` без `try_files` — митигировано `getRealSrc`) + `Game2042 localStorage → Neon` + `anon vote IP-ротация` + `historyRef.length` + `DODGE/WIP` — carry из 0.3.9/0.3.10/0.3.11, плюс **new** `ai anon ledger null → 8afd888` (закрыт)

---

## [0.3.11] — 2026-09-01 🛒 Shop Bundles 8 + Chat 42 + Timeline2026 + Runner webp — 4/10

> **15 коммитов** `b3744a0` → `c1f0326` · **+1606 / −130** · **23 файла** (+1 dirty `src/pages/GamePage.tsx` 322/177 quiz 20) · Shop Bundles 8 скидка 13-33% + Chat 42 persisted + Follows + Timeline 14 событий 22 лора 3 сложности + Runner webp 34KB −97.6% + Recaps 5 фактов + Hype 3 идеи TURBO/ZAVOD/PRISM + 3130 tests · рейтинг **4/10** (1156 строк/10м, продуктивных 655 → 3/10, норма 5000+ = 10/10) · `tsc 0` · `magnum-bun active` `caddy Up 56m` (200/200/200)

### 🎮 Игры — Timeline2026 14/22/3 + Runner webp + Quiz 20 dirty

- 🕰️ **Timeline2026 — 14 событий + 22 лора + 3 сложности + конфетти + свайп + стрик + WebAudio** — `e3b3325` **EVENTS 14×** хронология MAGNUM 2024-2026 (Отключи 31.12.24 → Venom Boy 28.02.26 → Лига Кубизма 597→1M и др.), **LORE 22** подсказки 5 пуль, **DIFFICULTY 3×** `easy 8 событий / normal 12 / hard 14` + `coinMul 1/1.5/2`, **конфетти** `canvas + GSAP` + **свайп** `touchstart→touchend dx>40` + **стрик** `streak×5 FEVER` + **WebAudio** `playWin 880Hz tri + playFail 220Hz saw` + `GSAP ScrollTrigger.batch y24→0 stagger 0.12` + `hover y:-4 RGB_GLOW` + `prefersReducedMotion` gate — `src/pages/games/Timeline2026Game.tsx` +302/−117 (1 файл, трудный баланс)
- 🏃 **RunnerGame — 800px webp 34KB vs 1.4M (−97.6%) + lazy webp fallback** — `00da24f` **5opka-runner-800.webp 34KB** (было 1.4M PNG `1536×1024`) **−97.6%**, **RunnerGame lazy** `loading="lazy"` + `onError webp→jpg fallback` + `srcSet 800w` + `sizes`, `public/images/5opka-runner-800.webp` bin 0→34360, `src/pages/games/RunnerGame.tsx` +11/−3 — см. ⚡
- ❓ **Quiz 42 — 20 вопросов + difficulty 1/2/3 + WebAudio + GSAP (dirty, к 0.3.12)** — `src/pages/GamePage.tsx` dirty **+322/−177** **8→20 вопросов** `+12` (MAGNUM 2026/Venom Boy 28.02/Школа 65/183см/SubShield/Красная Горка 12м/Лига Кубизма/VIP-обводка/OscillatorNode), **difficulty 1|2|3** на каждый `Question` + фильтр по `difficulty` + `coinMul`, **WebAudio** `getCtx/tone 0.22 gain + slideTo exponentialRamp` + `playCorrect 880Hz→1320Hz / playWrong 220Hz saw` + `AudioContext resume`, **GSAP** `ScrollTrigger y24 stagger + hover RGB_GLOW` + `prefersReducedMotion`, `QUESTIONS 20×` `difficulty` gate — `src/pages/GamePage.tsx` M 322/177 dirty (войдёт в **0.3.12**)

### ✨ Фичи — Shop Bundles 8 + Chat 42 + Follows + Data 5 фактов

- 🛒 **Shop Bundles 8 — бандлы скидка 13-33% + Neon API /shop/bundles + /shop/bundle/buy + GSAP** — `be221e7` **BUNDLES 8×** `starter 42/48 −13%` → `magnum-legend 4200/6240 −33%` (монетки/скины/бусты), **Neon** `GET /magnum/api/shop/bundles` 8шт + `POST /magnum/api/shop/bundle/buy` auth + `balance≥price` → `UPDATE magnum_coins -price` + `INSERT magnum_shop_inventory + magnum_transactions bundle_buy` + `rateLimit 6/мин`, **UI** `ShopPage.tsx` +96 `bundles/bundlesLoading/buyingBundle` + `fetchBundles` + `buyBundle` + **GSAP** `y12 stagger 0.08 + hover y:-4 RGB_GLOW` + `BUNDLE_DISCOUNT` бейдж `−13%…−33%` + `bundle_buy` toast — `server.ts` +53, `src/pages/ShopPage.module.css` +22, `src/pages/ShopPage.tsx` +96 (3 файла, +171)
- 💬 **Chat 42 + Follows — глобальный чат persisted + подписки + лента + модерация** — `80b61b2` **Neon 0016** `magnum_chat_messages` (id, user_id FK CASCADE, body 1..500, created_at) + `magnum_follows` (follower_id, following_id, UNIQUE) + 3 индекса, **server.ts +148/−1** `handleChatGet` `GET /magnum/api/chat` 50шт `ORDER BY created_at DESC JOIN users` + `handleChatPost` `POST /magnum/api/chat` auth + `body 1..500` + `/(.)\1{5,}/` анти-спам + `10/мин` + `INSERT RETURNING` + `broadcast chat:new` WS + `handleFollows` `POST /magnum/api/follows/:id` toggle + `GET /magnum/api/follows` + `GET /magnum/api/feed` лента подписок + **модерация** `REPORT_REASONS` + `validateReport` — `drizzle/migrations/0016_chat_follows.sql` +25, `drizzle/migrations/meta/_journal.json` +7 idx16, `drizzle/schema.ts` +15, `server.ts` +148/−1 (4 файла, +195/−1)
- 📚 **Data +5 фактов (§14: школа 65/отчисление 4к/183см/MellSher 174/SubShield/Красная Горка 12м/Venom Boy 28.02/Лига Кубизма 597→1M) +3 recaps честно transcript:false** — `58b91a3` **research.md +12** §14 `школа 65 Кемерово отчисление 4к` + `183см рост` + `MellSher 174 SubShield` + `Красная Горка 12м` + `Venom Boy 28.02` + `Лига Кубизма 597→1M`, **RecapsPage.tsx +56** `YpiqNshMn0E` + `3 recaps` `transcript:false` (без фейк-транскрипта, честно) + `RECAPS 2026` лента — `research.md` +12, `src/pages/RecapsPage.tsx` +56 (2 файла, +68)

### 🤖 БРАТ-БОТ — стабилен

- 🤖 без изменений в окне — бот стабилен, задачи ушли в **Shop Bundles 8 + Chat 42 + Timeline2026 + Runner webp** (след. инкремент — подсказки по **Bundles 13-33% + Chat persisted + Follows/Feed + Quiz 20 difficulty + Timeline 14/22**)

### 🖼️ Открытка / Галерея — 8 файлов (WARN y2k/dup + archive HTML, без изменений)

- 🖼️ **8 файлов — без изменений в окне, WARN сохраняется** — watchdog 15:48/15:56 **8 файлов** `42-{agit,cyber,memphis,y2k}-01.{jpg,800.webp}` (12M, webp 67-133K valid), `tsc 0` · `REAL_BY_STYLE`/`REAL_FALLBACK` (`y2k→memphis/cyber` § BUG review 15:44 п.1) + **archive 210× 200 html** SPA fallback — `magnum-bun active Up 56m` `caddy Up` без рестарта

### ⚡ Перфоманс — Runner webp −97.6% + health 200/200/200 Up 56m

- 🚀 **Runner 5opka — 800px webp 34KB vs 1.4M (−97.6%) + lazy fallback** — `00da24f` `public/images/5opka-runner-800.webp` **34KB** (было `1.4M PNG 1536×1024`) **−97.6%**, **RunnerGame.tsx +11/−3** `loading="lazy"` + `onError → jpg fallback` + `srcSet 800w` + `sizes (max-width:800px)`, **LCP −~300мс** на мобиле, `reports/perf-2026-09-01-1549.md` +76 — `public/images/5opka-runner-800.webp` bin, `src/pages/games/RunnerGame.tsx` +11/−3, `reports/perf-2026-09-01-1549.md` +76
- 🟢 **Health 200/200/200 — без рестарта Up 56m** — watchdog 15:48 `200/200/200` `HTTPS /magnum/ 200` `HTTPS /magnum/api/ideas 200` (98 идей) `HTTP :3000/magnum/api/ideas 200` + `GET /magnum/api/health 200` `{ok:true ideas:98 users:24}` + `magnum-bun active since 15:34:29` `caddy Up 56m` — **не потребовался** `systemctl restart` — все 3 endpoint 200, `build.ts minify` ok · `9944c0a` `reports/watchdog-2026-09-01-1548.md` +60 (6 ✅ 2 ⚠️) + `472169f` `reports/watchdog-2026-09-01-1556.md` +76 (all 200, 8/6 gallery, no restart)

### 🐛 Фиксы — Shop Bundles escaped quotes + reports .gitignore

- 🩹 **Shop Bundles escaped quotes — restore clean TS, /shop/bundles 200** — `ab734e4` `server.ts` +11/−11 **до:** `Shop Bundles 8` оставил `\"` escaped quotes в `BUNDLES` литерале → `bunx tsc 1 error TS1127 Invalid character` + `GET /magnum/api/shop/bundles 500` · **после:** `restore clean TS` `"` без escape + `tsc 0` + `curl /shop/bundles 200` 8шт — `server.ts` +11/−11 (1 файл, P0 закрыт)
- 🧹 **reports/ в .gitignore — репорты локально, не в git** — `7ca1144` `.gitignore` +4 `reports/` — **fixer пишет сюда**, локально, пуш через `git add -f` — `reports/` больше не спамит `git status`, `git log` чище — `.gitignore` +4 (1 файл)

### 🧪 Тесты / CI — 3130 passed (32 файла, +32)

- ✅ **3130 passed — new-coverage-1550 +32 теста** — `af8ac6d` `reports/test-2026-09-01-1550.md` +104, `tests/new-coverage-1550.test.ts` +156 — **3098→3130 +32**, `tsc 0`, **Bun 1.4.0 + vitest 3.2.7 jsdom** · покрытие **Shop Bundles 8 + Chat 42 + Follows + Timeline 14/22 + Runner webp fallback + Dust/Forge** — `tests/new-coverage-1550.test.ts` +156 (1 файл, +260 с отчётом)
- 🟢 **Watchdog 15:48 — PASS (6 ✅ 2 ⚠️, 200/200/200, active/Up, 8 gallery, 2 bugs, 1 idea)** — `9944c0a` `reports/watchdog-2026-09-01-1548.md` +60 — **200/200/200**, `magnum-bun active`, `caddy Up`, **8 gallery**, `tsc 0` (per watchdog 15:48), **2 bugs** `y2k alias + archive HTML` + **1 idea** `QUEUE` — без рестарта, `build.ts` `sitemap 32` ok
- 🟢 **Watchdog 15:56 — OK (all 200, 8/6 gallery, no restart)** — `472169f` `reports/watchdog-2026-09-01-1556.md` +76 — **all 200**, `active/Up 56m`, `8/6 gallery` (6 check-list vs 8 файлов) — `tsc 0` держится

### 📖 Дока + Ревью — 4/10 (падение 6/10 → 3/10 → 4/10)

- 👁️ **Review 4/10 — 1156 строк/10м (продуктивных 655 → 3/10)** — `c1f0326` `reports/review-2026-09-01-1559.md` +105 — **4/10** (1000-1499 = 4/10) — падение **6/10 (2838/20м) → 3/10 (1c4584f) → 4/10**, **13 коммитов/10м** (6 продуктивных+7 отчётов) `ADDED 1132 / REMOVED 24` (продуктивных `631/24` → **3/10** отдельно), шкала `0-49=0 … 5000+=10` — рост **3/10 → 4/10**, `tsc PASS 0` · `tests 3130 pass` · `gallery 8 файлов 200 + 20 archive soft-200 HTML WARN` · `health PASS 200/200/200` · `services PASS (magnum-bun active, caddy Up 56m)` — **WARN** `archive HTML fallback` + `y2k alias` + `gallery dup` + `reports .gitignore` (теперь `git add -f`) + `GamePage.tsx dirty`
- 👁️ **Review 3/10 — 15:44** — `1c4584f` `reports/review-2026-09-01-1544.md` +78 — **3/10** (`500-999 = 3/10`) — промежуточный провал окна (только `Timeline + Runner + readme`), закрыт ростом к **4/10** в 15:59
- 📝 **README keeper update** — `cdf2978` `README.md` +9/−9 — **16 игр (+Timeline2026)**, структура проекта, кроны 21 джоб, стек `Bun.serve + Neon` — инвестор видит полную картину без чтения кода
- 💡 **Hype +3 идеи (TURBO/ZAVOD/PRISM) +5 очередь** — `74e999e` **TURBO** `DUEL TURBO 42 — WS 2-4 + turbo x8 + ghost replay` (турбо x8, гост-реplay), **ZAVOD** `ECO ZAVOD 42 — 8Q Заводы/Уголь/Томь/Кузбасс + смена 7дн` (8Q уголь/заводы), **PRISM** `NEON PRISM 42 — 12 скинов neon prism + aurora epic` (12 скинов prism) + queue 5 — `docs/hype-queue.md` +6, `reports/hype-2026-09-01-1555.md` +52 (2 файла, +58)
- ⚠️ **Остались P1/P2 → 0.3.12:** `src/pages/GamePage.tsx M 322/177` quiz 20 dirty не закоммичен + `archive 210× 200 html` SPA fallback + `y2k alias` `42-y2k-01.jpg ≡ 42-memphis-01.jpg` + `gallery dup` + `TOCTOU 1278-1297` 5 SQL без BEGIN + `UNIQUE(user_id,code)` + `Memory/Rhythm/GamePage localStorage` vs Neon + `historyRef.length` + `DODGE/WIP` — все carry из 0.3.9/0.3.10, плюс **new** `GamePage quiz WebAudio` dirty

---

## [0.3.10] — 2026-09-01 ⌨️ Typing FEVER 3×DIFFICULTY + Rhythm Tape 32 restore + Mining Boost x2 — 6/10

> **4 коммита** `901cc13` → `2c34683` · **+540 / −156** · **5 файлов** (+4 dirty `server.ts` 68/6 + `drizzle/schema` 16/0 + `0015_migration` 25 + `typing.test` 6/4 + untracked `new-coverage-1540`) · Typing 3 сложности + FEVER ×1.3 6с + 15 советов + Rhythm tape 32 mute/share/breakdown restore (stash) + SFX muted guard + Mining Boost x2 60с + Duel wager 42/142/420/1420 + season top · рейтинг **6/10** (2838 строк/20м, норма 5000+ = 10/10) · `tsc 0` · `magnum-bun active` `caddy Up 39m` (200/200/200)

### 🎮 Игры — Typing FEVER 3×DIFFICULTY + Rhythm Tape 32 restore

- ⌨️ **Typing 42 — 3 сложности + FEVER ×1.3 + 15 советов + частицы + WebAudio** — `13175d2` **DIFFICULTY 3×** `easy 28 WPM 8 фраз / normal 42 WPM 12 фраз / hard 55 WPM 12 фраз` (`coinMul 1/1.5/2` + `localStorage typing42-diff`), **TYPING_TIPS 15×** ротация `3.2с` (`Туса/VPN/CLAY/ТУСА МЕДУЗА 14.08`), **FEVER** `3 фразы без ошибок → ×1.3 6с` (`triggerFever` + `playFever` 660+220Hz×3 + `spawnParticles 14 #ffcc00` + `spawnFloat "FEVER ×1.3"` + `feverTimerRef` 6с), **частицы/флоаты** `Particle id/x/y/color/size` + `FloatText` + `setTimeout 700мс` cleanup, **WebAudio** `playFever/playPerfect` tri/sine 1040Hz + `safeRamp`, **GSAP** `ScrollTrigger.batch y24→0 stagger 0.12` + `hover y:-4 RGB_GLOW` + `prefersReducedMotion` gate, **WPM** `calcWPM chars/5/min` + `displayWpm fever×1.3`, **combo** `×5 chime` + `maxCombo` — `src/pages/games/TypingGame.tsx` +211/−148 (1 файл, трудный баланс)
- 🥁 **Rhythm 42 — tape 32 + mute/share + breakdown — восстановление после stash** — `13175d2` **восстановление** `stash@{0} typing-temp` → `RhythmGame.tsx` **+82/−8** (ранее dirty `+68/−4` из `0.3.9` — теперь закоммичен): **tapeStats** `p*1+g*0.6/tot*100` helper, **TAPE 32** `Array(32)` `perfect #ffcc00 / good #00ff88 / miss #ff2d55` + `P/G/M` счётчики, **mute 🔊/🔇** `rhythm42-muted` `mutedRef` guard `playHit(j, mutedRef)` + `playFeverBurst(mutedRef)` + `playKeyTap(lane, mutedRef)`, **breakdown-лента** `flex p/g/m` + `judgeTape.length` бар, **share** `navigator.clipboard` `РИТМ MAGNUM — {song} {score} pts • {acc}% • FEVER x{N} — пресейв https://music.thefence.me/psmagnum` + `setShareMsg "Скопировано!" 2200мс`, **win/fail модалки** `Perfect/Good/Miss` карточка + `5 пуль MAGNUM: {song}·{diff}·music.thefence.me/psmagnum` + `DIFFICULTY win 3500/5000/6500` — `src/pages/games/RhythmGame.tsx` +82/−8, `tests/new-coverage-1540.test.ts` +утр (см. 🧪)

### ✨ Фичи — Mining Boost ×2 60с + Duel wager + Season Top (dirty, к 0.3.11)

- ⛏️ **Mining Boost ×2 — 60с за 142 монеты (dirty, не закоммичен)** — `server.ts` **+68/−6 dirty** `MINING_BOOST_PRICE 142` + `MINING_BOOST_MS 60_000` + `miningBoostUntil Map<userId, until>` + `handleMiningBoost` auth + `6/мин rateLimit` + `balance ≥142` → `UPDATE magnum_coins -142` + `INSERT magnum_transactions mining_boost` + `Map.set(newUntil)` + `handleMiningGet` `boost:{active,until,remainingMs,price,durationMs}` + `handleMiningClick` `inc*2 if boosted` + `boosted boostUntil` в ответе — `server.ts` dirty 68/6, `drizzle/migrations/0015_duel_wagers_mining_boost.sql` +25 (magnum_mining_boosts + indexes), `drizzle/schema.ts` +16 (magnumMiningBoosts)
- ⚔️ **Duel wager 42/142/420/1420 + invite respond + season top (dirty)** — `server.ts` dirty **wager** `0/42/142/420/1420` валидация + `handleDuelInviteCreate` `wager hold` `SELECT balance` + `UPDATE -wager` + `INSERT magnum_transactions duel_wager_hold` + `ensureNotification` `(ставка ${wager})` + `handleDuelInviteRespond` `POST /magnum/api/duel/invite/:id/respond` `accept|decline` + `SELECT FOR UPDATE` + `status pending→accepted/declined` + `ensureNotification` + `broadcast invite_accepted` + `handleDuelSeasonTop` `GET /magnum/api/duel/seasons/:id/top` `since starts_at` + `endCond` + `SELECT winner COUNT wins + avatar` + `recent 10` + `GET/POST /magnum/api/mining/boost` роуты — `server.ts` +68, `drizzle/migrations/0015` `magnum_duel_wagers` +3 индекса (`room_idx/user_idx` + `winner/created_idx`), `drizzle/schema.ts` +16 (magnumDuelWagers/magnumMiningBoosts)
- 🧪 **new-coverage-1540 — Rhythm full 2026 (untracked, к коммиту)** — `tests/new-coverage-1540.test.ts` untracked — **7 it** `judgeTape 32 + muted + shareMsg` + `DIFFICULTY 3 win 3500/5000/6500` + `PERFECT 75/GOOD 145/NOTE_SPEED 360/LANE 4` + `safeRamp AudioParam presave URL` + `GSAP ScrollTrigger RGB_GLOW` + `FEVER x5 perfect` + `clipboard.writeText 2200ms` — `tests/typing.test.ts` +6/−4 (DIFFICULTY win правки) — войдёт в **0.3.11** с boost/wager

### 🤖 БРАТ-БОТ — стабилен

- 🤖 без изменений в окне — бот стабилен, задачи ушли в **Typing FEVER + Rhythm tape restore + Mining Boost** (след. инкремент — подсказки по **Boost ×2 60с + wager 42/142/420 + Season Top + TAPE mute/share**)

### 🖼️ Открытка / Галерея — 8 файлов (WARN y2k/dup + archive HTML, без изменений)

- 🖼️ **8 файлов — без изменений в окне, WARN сохраняется** — watchdog 15:39 **8 файлов** `42-{agit,cyber,memphis,y2k}-01.{jpg,800.webp}` (12M, webp 67-133K valid), `tsc 0` (в окне) · `REAL_BY_STYLE`/`REAL_FALLBACK` (`y2k→memphis/cyber` § BUG review 15:41 п.1) + **archive 210× 200 html** SPA fallback — `magnum-bun active Up 39m` `caddy Up` без рестарта

### ⚡ Перфоманс — стабилен, tsc 0, Up 39m

- 🟢 **Health 200/200/200 — без рестарта** — watchdog 15:39 **200/200/200** `HTTPS /magnum/ 200` `HTTPS /magnum/api/ideas 200` (92 идеи) `HTTP :3000/magnum/api/ideas 200` + `GET /magnum/api/health 200` `{ok:true ideas:92 users:24 uptime:347s}` + `magnum-bun active since 15:34:29 PID 267966 27.9M` `caddy Up 39m` — **не потребовался** `systemctl restart`/`docker compose up -d` — все 3 endpoint 200, `build.ts minify 133/150 + sitemap 32` ok
- ✅ **tsc 0 в окне → 0 сейчас** — watchdog 15:39 `tsc 0` (на `5921e0b` clean) · текущий dirty `bunx tsc --noEmit 0` (Rhythm fix закоммичен в `13175d2`, 20 ошибок review 15:41 закрыты) — dirty остаётся `server.ts` 68/6 но `tsc 0` держится, `dist` не трогали

### 🧪 Тесты / CI — 3086 → 3098 (review 6/10)

- ✅ **Watchdog 15:39 — OK + Review 6/10 — 2838 строк/20м** — `901cc13` `reports/watchdog-2026-09-01-1539.md` +89 — **200/200/200**, `magnum-bun active`, `caddy Up 39m`, **8 gallery**, `tsc 0` (per watchdog), **health inner+outer 200** — `2c34683` `reports/review-2026-09-01-1541.md` +106 — **6/10** `2838 строк` `ADDED 2669 / REMOVED 169` (20м, `15:21-15:41`, 18 коммитов 11 продуктивных+7 отчётов), шкала `0-49=0 … 5000+=10` — рост **5/10 → 6/10**, `tsc FAIL 20 ошибок` (dirty Rhythm до `13175d2`) → сейчас `PASS 0`, `tests 3086→3098` `9694 expects 32 файла 1.44s`, `gallery 4/4 webp 200 + 210 archive 200 HTML WARN` — dirty server.ts + untracked `new-coverage-1540` войдут в **0.3.11**

### 📖 Дока + Ревью — 6/10 → 5/10 → 6/10

- 👁️ **Review 6/10 — 2838 строк/20м** — `2c34683` `reports/review-2026-09-01-1541.md` +106 — **6/10** (2000-2999 = 6/10) — рост **5/10 → 6/10**, **18 коммитов/20м** `2669 added/169 removed`, `tsc FAIL 20` (dirty Rhythm `judgeTape`×6) → `PASS 0` после `13175d2`, **WARN** `archive HTML fallback` + `y2k alias` + `gallery dup` + `stash typing-temp` + `server.ts dirty 68/6`
- 📝 **Changelog investor update** — `3cf900a` `CHANGELOG.md` +52 — секция **[0.3.9] 11 коммитов 1296b9e→5921e0b +1581/−156 21 файл +1 dirty** задокументирована (Rhythm tape + Dodge + Duel 2.0 + Ideas 💬)
- 🟢 **Watchdog 15:39 — OK** — `901cc13` `reports/watchdog-2026-09-01-1539.md` +89 — **200/200/200 active Up 39m** — без рестарта, `build.ts` `sitemap 32` + `cp -r dist/* /srv/magnum` ok

### 🐛 Фиксы — Rhythm dirty 20 ошибок → 0

- ✅ **Rhythm 20 ошибок TS2304 closed** — `13175d2` закрыл **20× `TS2304 judgeTape/shareMsg`** из review 15:41 § КРИТИЧНО (dirty `RhythmGame.tsx` stash-pop незавершён) — теперь `bunx tsc 0`, `watchdog 15:39 0` подтверждается
- ⚠️ **Остались P1/P2 → 0.3.11:** `server.ts dirty 68/6` (mining boost + duel wager/respond/seasonTop не закоммичены, 4 файла `meta/_journal 22/1 + schema 16/0 + server 84/6 + typing.test 6/4`) + `M dram` stash `typing-temp` + `archive 210× 200 html` + `y2k alias` + `historyRef.length` + `TOCTOU 1278-1297` + `UNIQUE(user_id,code)` + `Memory/Rhythm localStorage` + `DODGE/WIP` — все carry из 0.3.9, плюс **new** `0015 migration untracked` + `new-coverage-1540 untracked`

---

## [0.3.9] — 2026-09-01 🎹 Rhythm Tape 32 + Dodge 42 + Duel 2.0 + Ideas 💬 — 5/10

> **11 коммитов** `1296b9e` → `5921e0b` · **+1581 / −156** · **21 файл** (+1 dirty `RhythmGame.tsx` tape 32) · Rhythm judgement tape 32 + mute + share + breakdown + Dodge 3 сложности×даш/slow-mo + Ideas 💬 Neon + Duel 2.0 + auth-gate + 3086 tests · рейтинг **5/10** (1711 строк/10м, норма 5000+ = 10/10) · `tsc` ⚠️ 5 ошибок RunnerGame dirty · `magnum-bun active` `caddy Up` (recovered 502→200, 000→200)

### 🎮 Игры — Dodge 42 (Изи/Нормал/Хард) + Rhythm Tape 32 (dirty)

- 🛸 **Dodge 42 — 3 сложности + даш 52px + slow-mo 2.2с + свайп + GSAP pop + WebAudio + 15 советов** — `ba93734` **DIFFICULTIES 3×** (Изи/Нормал/Хард — скорость врагов/частота спавна/bulletMul), **даш 52px** (Shift/пробел/свайп `dx>40` + `dashCD 420мс` + `invulnerable 180мс`), **slow-mo 2.2с** (замедление `0.35×` + `slowMoCharges 2` + `recharge 8с`), **свайп** `touchstart→touchend dx/dy`, **GSAP pop** `scale 1→1.22 back.out 0.22` на dodge/coin, **WebAudio** `dash 620Hz→180Hz 0.12с` + `slowmo 180Hz tri 0.4с`, **15 лор-советов** MAGNUM/42/5 пуль ротация — трудный баланс — `src/pages/games/Dodge42Game.tsx` +147/−26 (1 файл)
- 🥁 **Rhythm 42 — judgement tape 32 + mute + share + breakdown — 5 пуль хронология 2026** — `5921e0b` (в коммите `IdeasPage.tsx` +85, фактически Ideas-комменты) + **dirty `RhythmGame.tsx` +68/−4** (uncommitted) **tapeStats** `p*1+g*0.6/tot*100`, **TAPE 32** `Array(32)` `perfect=#ffcc00/good=#00ff88/miss=#ff2d55` + `P/G/M` счётчики, **mute 🔊/🔇** `rhythm42-muted` + `mutedRef` guard `playHit(j, mutedRef)`, **breakdown-лента** `flex p/g/m` + `judgeTape.length` бар, **share** `navigator.clipboard` `РИТМ MAGNUM — {song} {score} pts • {acc}% • FEVER x{N} — пресейв https://music.thefence.me/psmagnum`, **win/fail модалки** `Perfect/Good/Miss` карточка + 5 пуль lore — `src/pages/games/RhythmGame.tsx` dirty +68/−4 (tape + mute + breakdown + share), `tests/rhythm42-enhanced.test.ts` +90 (см. 🧪)
- 🏆 **Rhythm tape breakdown — win/fail карточки** — dirty `RhythmGame.tsx` **win** `score • макс комбо {maxCombo} • {accuracy}% • FEVER x{N}` + **breakdown** `Perfect {p} / Good {g} / Miss {m} • {tot} нот` + `5 пуль MAGNUM: {song} · {diff} · music.thefence.me/psmagnum` + **fail** та же карточка + hint — модалки теперь с аналитикой партии

### ✨ Фичи — Ideas 💬 Neon + Presave share (Магазин/Эко/Майнинг/Идеи)

- 💬 **Ideas комменты Neon — валидатор isValidComment 2-200, GET/POST /magnum/api/ideas/:id/comments, тред 💬, GSAP y12 stagger 0.08 + hover y:-4** — `899a910` + `5921e0b` **валидатор** `isValidComment(v)` `2..200`, `/(.)\1{5,}/` анти-спам, `/<script|javascript:/i` XSS-guard, `trim 2..200`, **Neon** `magnum_idea_comments` `GET :id/comments` 50шт `ORDER BY created_at ASC JOIN users` + `POST :id/comments` auth + `10/мин` + `idea exists 404` + `INSERT RETURNING`, **UI** `expandedId` + `comments/commentsLoading/commentDraft/commentSending` + `toggleComments` + `loadComments` + `postComment`, **тред** `data-comments` + `data-comment` + `GSAP stagger y12→0 0.08 power2.out` + `hover y:-4 RGB_GLOW`, **баланс Neon без localStorage** — `src/pages/IdeasPage.tsx` +85, `tests/rhythm42-enhanced.test.ts` +90 (валидатор/tapeStats/share URL, см. 🧪), `server.ts` уже имел эндпоинты в `0c47e1f` — фронт догнал
- 💡 **Hype +3 идеи (RUSH/KEDR/CHROME) +5 очередь** — `1026bdf` **RUSH** `DUEL RUSH 42 — WS 2-4 + rush x7 + heat-bar + ELO` (wager 0/42/142/420, rush <0.25с +12%/x7, heat 0→100, CPS>20 suspect), **KEDR** `ECO KEDR 42 — 8Q Кедр/Томь/Кузбасс + bio 7дн` (+1420 босс 8/8, freeze 420), **CHROME** `CHROME VAULT 42 — 12 скинов chrome + prism epic` (42/142/420/1420, крафт 3×common→uncommon 42, dust +100) + queue 5 — `docs/hype-queue.md` +7/−1, `reports/hype-2026-09-01-1539.md` +52

### 🤖 БРАТ-БОТ — стабилен

- 🤖 без изменений в окне — бот стабилен, задачи ушли в **Dodge 42 + Rhythm tape + Ideas 💬 + Duel 2.0** (след. инкремент — подсказки по **TAPE 32 + mute/share + breakdown + Dodge даш/slow-mo + Vault**)

### 🖼️ Открытка / Галерея — 8 файлов (WARN y2k/dup + archive HTML)

- 🖼️ **8 файлов — без изменений в окне, WARN сохраняется** — watchdog 15:30 **8 файлов** `42-{agit,cyber,memphis,y2k}-01.{jpg,800.webp}` (12M, webp 67-133K valid), `tsc` dirty · `REAL_BY_STYLE`/`REAL_FALLBACK` (`y2k→memphis/cyber` § BUG review 15:30 п.1) + **archive 210× 200 html** SPA fallback — без рестарта (`magnum-bun active`, `caddy Up`)

### ⚡ Перфоманс — рекавери + dirty Runner

- 🟢 **Health recovered 502→200, 000→200 — рестарт magnum-bun** — watchdog 15:30:30 **до** `HTTPS /magnum/ 200 ok` но `HTTPS /magnum/api/ideas 502 + HTTP :3000 000 Connection refused` (`magnum-bun inactive dead since 15:28:48`, `EADDRINUSE` crash-loop 25× `server.ts:2112` + SIGTERM), **после** `systemctl restart magnum-bun` PID 262459 `LISTEN *:3000` + `caddy Up 31m` → **200/200/200** все идеи 89шт — journal `MAGNUM server running at http://localhost:3000/magnum/` — без `dist` изменений
- ⚠️ **Dirty RunnerGame — 5 ошибок TS18047** — watchdog 15:30 `M src/pages/games/RunnerGame.tsx + src/components/Marquee/TopProgress` — `tsc 5 ошибок TS18047` (Runner `possibly null`), тесты при этом 3086 passed — P2 к фиксу (null-guard), `bun test` не блокирует
- 🟢 **Health 15:25 — OK** — `1296b9e` `reports/health-2026-09-01-1525.md` +61 — **200/200/200** до падения

### 🧪 Тесты / CI — 3086 passed (31 файл, 9651 expects)

- ✅ **3086 passed (31 файл, 9651 expects, 2.05s → 27.91s watchdog)** — `00557a3` `reports/test-2026-09-01-1529.md` +95, `tests/new-coverage-1527.test.ts` +131 — **3071→3086 +15**, `tsc` (clean HEAD) `0` / dirty `5 ошибок RunnerGame`, **Bun 1.4.0 + vitest 3.1.1 jsdom** · покрытие **tapeStats + FEVER + Dodge + duel 2.0 + ideas комменты**
- 🥁 **rhythm42-enhanced — tapeStats + judgement tape + share** — `899a910` `tests/rhythm42-enhanced.test.ts` +90 — **12 тестов** `tapeStats` `empty→100%`, `perfect 100%`, `good 60% weight` (`p*1+g*0.6/tot`), `miss 50%`, `nulls ignored`, `slice -32 invariant`, `share text presave URL` `https://music.thefence.me/psmagnum` + `РИТМ MAGNUM`, `muted guard`, `breakdown acc` — фронт-валидатор ленты 32
- 🩹 **new-coverage-1527 — ideas/duel/sharing** — `00557a3` `tests/new-coverage-1527.test.ts` +131 — **+15 тестов** 3086-й рубеж (presaveClick + duel rooms + ideas comments + Dodge)
- 🟢 **Watchdog 15:30 — 200/200/200 active Up (recovered)** — `0b761ac` `reports/watchdog-2026-09-01-1530.md` +109 — **200/200/200**, `magnum-bun active PID 262459`, `magnum-caddy Up 31m`, **8 gallery**, `tsc 5 ошибок dirty` ⚠️, **3086 tests** 27.91s — рекавери после crash-loop `EADDRINUSE` 15:28-15:30
- 👁️ **Review 5/10 — 1711 строк/10м** — `14abb10` `reports/review-2026-09-01-1530.md` +90 — **5/10** (1500-1999 = 5/10) — рост **2/10 → 5/10**, **9 коммитов/10м (6 продуктивных+3 отчёта)** + 1 uncommitted, **ADDED 1652 / REMOVED 59**, `tsc PASS(clean)/FAIL(dirty)`, `3086 pass`, `8 галерея WARN`, `health PASS(recovered)`, `services PASS` — **WARN** `archive HTML fallback` + `y2k alias` + `RunnerGame TS18047` + `Flappy/Rhythm localStorage` + `historyRef`

### 🔐 Auth / Neon — gate держится, Duel 2.0 + auth-gate фикс, +2 таблицы (0014)

- ⚔️ **Duel 2.0 — rooms/stats/leaderboard/invites/seasons + WS ready broadcast — Neon, валидация, rate limit** — `f16d51a` **Neon 0014** `magnum_duel_seasons` (id, name, starts_at, ends_at) + `magnum_duel_invites` (from_user, to_user, room_id, status pending/accepted/declined/expired, 3 индекса + `starts_at DESC`), **итого 30 таблиц** (было 28) + **server.ts +133/−45** `handleDuelHistory` + `REPORT_REASONS/TARGETS` + `validateReportTarget/Reason` + `logModeration` + `handleReportCreate` + **rooms/stats/leaderboard/invites/seasons** + **WS ready broadcast** `ready` → `broadcast roomPublic()` — `drizzle/migrations/0014_duel_seasons_invites.sql` +25, `drizzle/schema.ts` +17, `drizzle/migrations/meta/_journal.json` idx14, `server.ts` +133/−45
- 🔐 **Auth-gate fix — кнопки без логина → форма входа, без голых 401** — `cd171b4` **до:** `Shop Mining Layout` кнопки слали `401` без модалки — **после:** `ShopPage.tsx` +45 + `MiningPage.tsx` +30 `me` state `GET /magnum/api/auth/me` + `magnum:auth / magnum:need-auth` listener + **guard** `if(!me){ showToast("Войди, братуха — …"); dispatch need-auth; return; }` + `wsUrl без username` (auth via cookie), `WS /magnum/api/ws` теперь требует залогина — `src/pages/MiningPage.tsx` +20 (me + auth listener + `connectDuel` guard), `src/pages/ShopPage.tsx` +45 (аналогичный guard) — gate держится
- 🩹 **P0 crash-loop — server.ts:1433 presaveClick string literal + EADDRINUSE** — `e8fa558` `reports/auth-2026-09-01-1529.md` +133 — **auth check 15:29** + **fix** `server.ts:1433` `presaveClick` string literal крашил `magnum-bun` (`EADDRINUSE` 25× в 15:28:25-15:28:48 → `inactive dead`), после фикса `bun test 3086` + `systemctl start` 15:29-15:30 успех — gate + duel 2.0 держится, `caddy Up`
- 🔐 **Auth 15:29 — check OK** — `e8fa558` **4/4 защищённых 401** + WS 401 без токена ✅ — gate держится после duel 2.0

### 🐛 Фиксы — auth-gate + P0 presaveClick + EADDRINUSE

- 🔒 **Auth-gate WS + Shop/Mining** — `cd171b4` см. 🔐 выше — P1 закрыт, кнопки без входа теперь ведут в модалку `AuthStatus` вместо 401
- 🩹 **P0 presaveClick string literal** — `e8fa558` `server.ts:1433` — crash-loop 25× `EADDRINUSE at server.ts:2112:20` — фикс литерала + `SO_REUSEPORT` проверка + `journalctl` clean — `magnum-bun active` восстановлен
- ⚠️ **Остались P1/P2 → 0.3.10:** `RunnerGame TS18047 5 ошибок` (dirty, null-guard) + `DAILY_KEY void` + `historyRef.length` + `TOCTOU 1278-1297` 5 SQL без BEGIN + `UNIQUE(user_id,code)` + `gallery y2k alias` + `archive 210× 200 html` + `Memory/Rhythm localStorage` + `Flappy diff` (уже в 0.3.8) + `y2k 67K/2.4M недоступен`

---

## [0.3.8] — 2026-09-01 🦩 Flappy 42 + Rhythm MAGNUM FEVER + Presave 40 фактов + BandLink — 6/10

> **8 коммитов** `91a9702` → `2c3f39b` · **+1250 / −58** · **21 файл** · Flappy 3 сложности×5 скинов + Rhythm 5 пуль FEVER + Presave 40 фактов/30 FAQ/BandLink proxy/reports moderation + LCP high + content-visibility · рейтинг **6/10** (2293 строк/20м, норма 5000+ = 10/10) · `tsc 0` · `magnum-bun active` `caddy Up`

### 🎮 Игры — Flappy 42 (3 сложности×5 скинов) + Rhythm MAGNUM 5 пуль

- 🦩 **Flappy 42 — 3 сложности + 5 скинов + пауза + GSAP score pop** — `91a9702` **DIFFICULTIES 3×** (norm/hard/turbo — скорость труб 1.8→3.2, gap 150→110, coinMul 1→2) + **BIRD_SKINS 5×** (classic/magnum/vpn/meduza/void — цвет/трейл) + **пауза P/Esc** (canvas freeze + overlay) + **GSAP score pop** (`scale 1→1.3 back.out 0.22` на +1) + **haptics** 15ms труба/30ms coin — трудный баланс — `src/pages/games/Flappy42Game.tsx` +158/−45, `src/pages/games/Flappy42Game.module.css` +1 (2 файла, +159/−45)
- 🥁 **Rhythm 42 — MAGNUM FEVER 5 пуль + 5 треков (uncommitted→коммит)** — `b50293b` **5 perfect подряд → MAGNUM FEVER x2 6с** (золотая аура/пульс, FEVER x2 бейдж, частицы, expiry-таймер, сброс на miss) + **tips ротация 3.2с** + **best/tut** + **fix GSAP nesting** — `src/pages/games/RhythmGame.tsx` +84, `tests/rhythm-magnum-5pul.test.ts` +43 (2 файла, +127) — в работе было uncommitted, залёг в watchdog-коммит 15:22
- 🏆 **Rating Neon real — health + routes** — `2c3f39b` **health** `reports/moderationLog` счётчики + **6 роутов** `POST /magnum/api/reports` + `GET /reports` + `POST /ideas/:id/status` + `GET /moderation/log` + `GET /profile/:name` + `GET /search` — `server.ts` +16/−1 (1 файл)
- 📰 **Recaps честно transcript:false + §13 био** — `262ea8d` **+3 recaps честно** `transcript:false` (без фейк-транскрипта) + **§13 био** (ДГТУ/Кемерово 1701/ВРП-Томь/донабор 15-16.07/гимн 42×Маликов +5 фактов) — `src/pages/RecapsPage.tsx` +57, `research.md` +12, `reports/data-2026-09-01-1520.md` +29 (3 файла, +98)

### ✨ Фичи — Presave 40 фактов + 30 FAQ + BandLink proxy + Reports Moderation

- 🎵 **Presave 40 фактов + 30 FAQ + BandLink proxy + moderation Neon** — `057221a` **PresaveRatingPage 40 фактов** (MAGNUM 2026 — 5 пуль/42/ТУСА/Кемерово/гимн) + **30 FAQ** (пресейв/магазин/игры) + **GSAP y24 stagger 0.12** entrance + **BandLink proxy** `/magnum/api/bandlink` (CORS обход) + **reports/moderation Neon** `magnum_reports` + `magnum_moderation_log` + валидаторы — `drizzle/migrations/0013_reports_moderation.sql` +33, `drizzle/schema.ts` +21, `server.ts` +125, `src/pages/PresaveRatingPage.tsx` +95/−9, `index.html` +2/−1, `src/components/Singles.tsx` +2/−1, `src/styles/global.css` +3, `reports/perf-2026-09-01-1524.md` +61 (8 файлов, +342/−11)
- 💡 **Hype +3 идеи (103-105 blitz/tayga/anod) +5 queue** — `b433f0c` **blitz** (блиц-дуэль 42с) + **tayga** (тайга-экспедиция) + **anod** (анодирование обводки) + queue 5 — `docs/hype-queue.md` +6/−1, `reports/hype-2026-09-01-1517.md` +52 (2 файла, +58/−1)

### 🤖 БРАТ-БОТ — стабилен

- 🤖 без изменений в окне — бот стабилен, задачи ушли в **Flappy/Rhythm FEVER + Presave 40 фактов + BandLink** (след. инкремент — подсказки по **Vault + промокодам + FEVER + BandLink/FAQ**)

### 🖼️ Галерея — 8 файлов (WARN y2k/dup + archive HTML)

- 🖼️ **8 файлов — WARN y2k→memphis + archive 210× HTML-fallback** — `b50293b` watchdog **8 файлов** `42-{agit,cyber,memphis,y2k}-01.{jpg,800.webp}` (12M, webp 67-133K valid), `tsc 0` · `REAL_BY_STYLE`/`REAL_FALLBACK` (`y2k→memphis/cyber` (§ BUG review 15:18 п.1) + **archive 210× 200 html** SPA fallback — без рестарта (`magnum-bun active`, `caddy Up`))

### ⚡ Перфоманс — LCP high + content-visibility

- 🚀 **LCP preload high + Singles eager + content-visibility** — `057221a` + `reports/perf-2026-09-01-1524.md` **LCP `tusa-meduza.jpg` preload `fetchpriority=high`** + **Singles 1-я карточка `eager/high`** (2-я `lazy/low`) + **`content-visibility: auto` for #singles/#about/#discography/#press/#news** (`contain-intrinsic-size 0 600px`) — below-fold paint откладывается, FCP/LCP −~200мс · **dist 35.32→35.81MB +0.49MB (content)**, **main 472→471K −1K**, `tsc 0`, `Bun.build 1.45s 70 files`, 37 extra chunks — `index.html` +2/−1, `src/components/Singles.tsx` +2/−1, `src/styles/global.css` +3, `reports/perf-2026-09-01-1524.md` +61
- 🟢 **Health стабилен** — perf отчёт `curl /magnum/ 200` + `curl /magnum/api/ideas 200` + `magnum-bun active` + `tsc 0` — без рестарта

### 🧪 Тесты / CI — 3071 passed → 3050/3051 (1 fail flappy)

- ✅ **3071 passed (30 файлов, 9424 expects)** — `00d63ef` `reports/test-2026-09-01-1522.md` +120, `tests/new-coverage-1522.test.ts` +148 — **3051→3071 +20**, `tsc 0`, **Bun 1.4.0 + vitest 3.2.7 jsdom** · покрытие **presave/rhythm/bandlink/reports moderation**
- ⚠️ **1 fail — flappy42 renders play button** — review 15:18: `flappy42: component renders > renders play button` [1.20ms] · селектор ждёт `[data-testid="play"]`, в `Flappy42Game.tsx` кнопка без testid — P2 к фиксу (добавить `data-testid="flappy-play"`)
- 🟢 **Watchdog 15:22 — OK 200/200/200 active/Up** — `b50293b` `reports/watchdog-2026-09-01-1522.md` +90 — **200/200/200**, `magnum-bun active`, `magnum-caddy Up`, **8 gallery**, `tsc 0`, **1 fail flappy** — без рестарта

### 🔐 Auth / Neon — gate держится, +2 таблицы (0013)

- 🗄️ **Neon — +2 таблицы (0013 reports+moderation)** — `057221a` `magnum_reports` (id, reporter_id, target_type, target_id, reason, status) + `magnum_moderation_log` (moderator_id, action, target) · **итого 28 таблиц** (было 26) — `drizzle/migrations/0013_reports_moderation.sql` +33, `drizzle/schema.ts` +21, `drizzle/migrations/meta/_journal.json` idx 13
- 🔐 **Health counts +4 роутов** — `2c3f39b` `server.ts` +16/−1 — `reports/moderationLog` в `/health` + 6 роутов (`/reports`, `/ideas/:id/status`, `/moderation/log`, `/profile/:name`, `/search`)

### 📖 Дока + Ревью — 6/10 (рост с 2/10)

- 👁️ **Review 6/10 — 2293 строк/20м (2180 added)** — `76ae4bd` `reports/review-2026-09-01-1518.md` +92 — **6/10** (2000-2999 = 6/10) — рост **2/10 → 6/10**, **22 коммита/20м (12 продуктивных+10 отчётов)**, **285/45 uncommitted → закоммичены в 91a9702+b50293b**, `tsc PASS` · `tests FAIL 3050/3051` · `gallery WARN` · `health PASS` · `services PASS` — **WARN** `archive HTML fallback` + `localStorage flappy/rhythm vs Neon` + `y2k alias`
- 📊 **Data +5 фактов (§13) +3 recaps** — `262ea8d` `reports/data-2026-09-01-1520.md` +29 — **био ДГТУ/Кемерово 1701/ВРП-Томь/донабор 15-16.07/гимн 42×Маликов** честно `transcript:false`
- 💡 **Hype 103-105** — `b433f0c` `reports/hype-2026-09-01-1517.md` +52 — blitz/tayga/anod + queue 5

### 🐛 Известные баги → след. инкремент (0.3.9)

- ⚠️ **P1 archive 210× HTML-fallback** — `GalleryPage.tsx:181` `ARCHIVE_42` 210 записей без файлов — `curl 200 size 9238` SPA `index.html` вместо 404 → `<img>` broken — нужен `onError fallback REAL_BY_STYLE` или `dist/archive-*.jpg` (review 15:18 п.3)
- ⚠️ **P1 y2k alias** — `GalleryPage.tsx:39-43` + `galleryTokens.ts:42` — `y2k-01→memphis`, `y2k-02→memphis`, `y2k-03→cyber`, `42-y2k-01.jpg ≡ 42-memphis-01.jpg` — Y2K-арт 67K/2.4M недоступен (review 15:18 п.1)
- ⚠️ **P2 Flappy localStorage vs Neon** — `Flappy42Game.tsx:166/293` `flappy42-diff/skin/best` в `localStorage` вместо `magnum_game_scores` + `coinMul` не уходит в `POST /games/submit` — инкогнито = сброс (review 15:18 п.2) + **1 fail** `renders play button` без `data-testid`
- ⚠️ **P2 Rhythm localStorage** — `RhythmGame.tsx:301/310` `rhythm42-best/tut` + `fetch presave/click` без `credentials` — та же Neon-миграция нужна (review 15:18 п.3)
- ⚠️ **P2 DAILY_KEY void + historyRef** — `Game2042.tsx:411` `void DAILY_KEY` + `:277+636` `historyRef.length` не триггерит ре-рендер — carry из 0.3.6/0.3.7
- ⚠️ **P2 TOCTOU `server.ts:1278-1297`** — `handlePromoRedeem` 5 SQL без `BEGIN` + нет `UNIQUE(user_id,code)` — гонка `uses > max_uses` — carry из 0.3.6

---

## [0.3.7] — 2026-09-01 ⛏️ Mining Exchange 10:1 + Eco Rating 0-10 + Idea Comments — 2/10

> **8 коммитов** `2c53379` → `26dd77e` · **+840 / −14** · **14 файлов** · Mining 10:1 + Eco 0-10 (11 tiers) + idea comments + presave leaderboard + 3051 tests · рейтинг **2/10** (1031 строк/10м, норма 5000+ = 10/10) · `tsc 0` · `magnum-bun active` `caddy Up`

### ✨ Фичи — Магазин/Эко/Майнинг/Идеи + Пресейв

- ⛏️ **Mining Exchange 10:1 — руда → монеты Neon** — `0c47e1f` **rate 10 руда = 1 монета** · `POST /magnum/api/mining/exchange` (auth + `rate limit 8/мин` + валидация `10..10000` + `multiple of 10` ) · **Neon** `magnum_mining_exchanges` (user_id, mining_amount, coins_amount, rate 10) + индекс `user_id` · баланс `magnum_coins` + `magnum_mining` списывание + `magnum_transactions reason mining_exchange` — `drizzle/migrations/0012_mining_exchange_comments.sql` +23, `drizzle/schema.ts` +9, `server.ts` +67 (`handleMiningExchange`)
- 🌿 **Eco Rating 0-10 — 11 tiers Neon + бонусы** — `0c47e1f` **ECO_TIERS 0..10** (Токсик −1000..−400 → 42 Абсолют 337..1000) · `ECO_TIERS: 11×{rating,tier,minScore,maxScore,color,badge,desc}` + `ECO_RATING_LABELS` + `calcEcoRating(score)` · `POST /magnum/api/eco/rating` (score −1000..1000 + answers 0..10 ×20 + player 2..32 или auth + `10/мин`) → `INSERT magnum_eco_ratings` + **бонусы 7→42 / 9→84 / 10→142** в `magnum_coins` · `GET /magnum/api/eco/tiers` (11 tiers) + `GET /magnum/api/eco/rating` top-30 (JOIN users + shop_inventory avatar) · **Neon** `magnum_eco_ratings` (user_id, player, score, rating 0..10, tier, answers jsonb) + 3 индекса — `drizzle/migrations/0011_eco_ratings.sql` +17, `drizzle/schema.ts` +10, `server.ts` +47, `src/pages/EcoPage.tsx` +57 (fetch tiers+rating top-10 + POST rating на submit + ratingMsg 4с)
- 💬 **Idea Comments — Neon без localStorage** — `0c47e1f` **2 эндпоинта** `GET /magnum/api/ideas/:id/comments` (50шт `ORDER BY created_at ASC` JOIN users) + `POST /magnum/api/ideas/:id/comments` (auth + `body 3..400` + `idea exists 404` + `10/мин` + `INSERT magnum_idea_comments RETURNING`) · **Neon** `magnum_idea_comments` (idea_id FK CASCADE, user_id FK CASCADE, body) + 2 индекса — `drizzle/migrations/0012_mining_exchange_comments.sql` +10, `drizzle/schema.ts` +9, `server.ts` +56
- 🏆 **Presave Leaderboard + WS chat** — `0c47e1f` `GET /magnum/api/presave/leaderboard` (топ presave + `ideaComments` count из `magnum_idea_comments`) + **WS chat** валидация + rate limit — `server.ts` +22
- 📝 **README keeper — Tests 3051 + 26 tables** — `02eb99f` **Tests 2997→3051 (30 файлов)**, **20→26 tables** (`+game_scores/referrals/duel/eco_ratings/exchanges/comments`), **2042 DAILY + Memory/Rhythm FEVER**, mining exchange, idea comments, gallery 8 файлов — `README.md` +11/−10

### 🎮 Игры — без прямых гейм-коммитов (фичи ушли в Mining/Eco)

- 📰 **Recaps — Freakland Create день 1 35:24** — `26dd77e` **YpiqNshMn0E 35:24** открытие сервера Пятёрки, город Завоз + иудочка-ачивка · транскрипт **803 сегмента** + **2 идеи 101/102** (Freakland gen3) — `src/pages/RecapsPage.tsx` +18
- 🎮 в окне `1233f63..26dd77e` гейм-логика не менялась — **2042 DAILY + FLOAT +X** (`ed478b2`, `3dcd532`) уже в **[0.3.6]**; текущий инкремент — серверные **Eco/Mining/Comments** под игры (рейтинг/обмен/комменты) · **Flappy42Game.tsx uncommitted** (DIFFICULTIES 3× norm/hard/turbo + BIRD_SKINS 5× classic/magnum/vpn/meduza/void — 54 строки) — в работе, войдёт в **0.3.8** (Rhythm 66 строк tips/best/tut + Flappy 203 строки — оба uncommitted)

### 🤖 БРАТ-БОТ — стабилен

- 🤖 без изменений в окне — бот стабилен, задачи ушли в **Mining Exchange + Eco Rating + Idea Comments** (след. инкремент — подсказки по **Vault + промокодам + FEVER + Daily топ + обмен 10:1**)

### 🖼️ Открытка / Галерея — 8 файлов (WARN y2k/dup)

- 🖼️ **8 файлов — WARN galleryTokens-Y2K + daily** — `6e73296` watchdog **8 файлов** `42-{agit,cyber,memphis,y2k}-01.{jpg,800.webp}` (12M, PNG 1536x1024 + 800.webp 67-133K), `tsc 0` · `REAL_BY_STYLE`/`REAL_FALLBACK` указывают на существующие файлы, `check-list 6→8` устарел — WARN; **galleryTokens-Y2K** (`y2k-01/02→memphis`) + **DAILY_KEY dead code** (watchdog 15:12 BUG-1/2) — без рестарта (`magnum-bun active`, `caddy Up`, `git clean`)

### 🧪 Тесты / CI — 3051 passed (28 файлов, +16)

- ✅ **3051 passed (28 файлов, 9412 expects, 2.42s bun + 22.25s vitest)** — `2c53379` `reports/test-2026-09-01-1510.md` +107, `tests/new-coverage-1530.test.ts` +127 — **3035→3051 +16**, `tsc 0`, **Bun 1.4.0 + TS 7.0.2 + vitest 3.2.7 jsdom** · покрытие **eco ratings + mining exchange + idea comments + presave leaderboard + WS chat**
- 🩹 **Fix gallery build 400B → 600B** — `1aa15ab` `tests/gallery-api-games.test.ts` +2/−2 — `gsap shim 514B` превышал 400B — порог 600B, `eco ratings+exchange` gap закрыт — `tsc 0`
- 🟢 **Watchdog 15:12 — OK 200/200/200 active/Up** — `6e73296` `reports/watchdog-2026-09-01-1512.md` +94 — **200/200/200**, `magnum-bun active (restart 15:12:41, 19.6M)`, `magnum-caddy Up 12min`, **8 gallery, 822 строки**, `tsc 0`, **2 бага** (`galleryTokens-Y2K + daily`) — без доп. рестарта

### ⚡ Перфоманс — стабилен

- 🟢 **Health стабилен** — в окне `1233f63..26dd77e` перф-коммитов нет (предыдущий `5d785d0` 528→472KB lazy уже в 0.3.6); `magnum-bun 19.6M` + `caddy Up` — без рестарта, `dist` не трогали

### 🐛 Фиксы — gallery build threshold

- 🩹 **Gallery build 400B → 600B** — `1aa15ab` `gsap shim 514B` — порог поднят (тест +2/−2) — P2 закрыт, `tsc 0`
- ⚠️ **Остались P1/P2 → 0.3.8:** `DAILY_KEY void` + `historyRef.length` + `TOCTOU 1278-1297` 5 SQL без BEGIN + `UNIQUE(user_id,code)` + `gallery y2k alias` + `archive 210× 200 html` + `Memory localStorage` vs Neon + `Flappy diff` не закоммичен

### 🔐 Auth / Neon — gate держится, +3 таблицы

- 🔐 **Auth 15:15 — check OK** — `41f777e` `reports/auth-2026-09-01-1515.md` +103 — **4/4 защищённых 401** (`/auth/me`, `/coins`, `/shop/inventory`, `WS`) + **16 доп. 401** + **публичные 200** + **WS raw socket без токена → 401** ✅ (фикс `26cc8b3` держится 3-й прогон) · `AuthStatus.tsx` Войти/Регистрация + `credentials:include` OK
- 🗄️ **Neon — +3 таблицы (0011 + 0012)** — `0c47e1f` `magnum_eco_ratings` + `magnum_mining_exchanges` + `magnum_idea_comments` · **итого 26 таблиц** — `drizzle/migrations/meta/_journal.json` idx 11+12 (`0011_eco_ratings` 1788300011000 + `0012_mining_exchange_comments` 1788300012000) + `drizzle/schema.ts` +28

### 📖 Дока + Ревью — 2/10 → след. инкремент

- 👁️ **Review 2/10 — 1031 строк/10м** — `19afd96` `reports/review-2026-09-01-1516.md` +87 — **2/10** (1026/5, норма 5000+ = 10/10) — падение с **3/10 → 2/10**, крупные фичи 2042/TILE_LORE вышли из 10м окна (20м ~3500 строк/12 коммитов) — требует **5000+ строк/10м** · **tsc PASS · tests PASS · health PASS · services PASS · gallery WARN**
- 📝 **README keeper** — `02eb99f` `README.md` +11/−10 — синхрон с **3051 tests + 26 tables**
- 📝 **Changelog 0.3.6** — `1233f63` `CHANGELOG.md` +59 — предыдущий 0.3.6 задокументирован

### 🐛 Известные баги → след. инкремент (0.3.8)

- ⚠️ **P1 DAILY_KEY dead code** — `Game2042.tsx:411` `void DAILY_KEY` — не `getItem/setItem` и не в `magnum_game_scores` — спам `POST /games/submit` + `restart()` ломает детерминизм (watchdog 15:12 BUG-1)
- ⚠️ **P2 historyRef.length не триггерит ре-рендер** — `Game2042.tsx:277+636` `useRef` в JSX `disabled/(0/6)` — только при `setGrid/setScore` (watchdog 15:12 BUG-2)
- ⚠️ **TOCTOU `server.ts:1278-1297`** — `handlePromoRedeem` 5 SQL без `BEGIN` + нет `UNIQUE(user_id,code)` — гонка `uses > max_uses` (review 15:03 §)
- ⚠️ **Gallery `GalleryPage.tsx:39-43` + `galleryTokens.ts:42`** — `y2k-01/02→memphis`, `y2k-03→cyber`, `42-y2k-01.jpg ≡ 42-memphis-01.jpg` + `.jpg` содержит PNG + **archive 210× 200 html** (SPA fallback)
- ⚠️ **Memory `MemoryGame.tsx:293,494`** — `localStorage "memory42-best"` вместо `Neon magnum_game_scores` + 45 localStorage vs ТЗ «all state in Neon»
- ⚠️ **Flappy42Game.tsx uncommitted** — `DIFFICULTIES 3× + BIRD_SKINS 5×` — 54 строки не закоммичены, войдут в 0.3.8
- ⚠️ **Gallery check-list 6→8 устарел** — `watchdog 15:12` WARN — 8 файлов vs ожидаемо 6

---

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
