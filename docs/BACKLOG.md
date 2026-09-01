# BACKLOG 42 — 2026-09-01 16:00 UTC · 10м тик

> Собрано кроном backlog-keeper · P0 auth/404/деньги выше хайпа · 10 топ-задач · `git log --since="10 minutes ago"` + `reports/*` + `docs/*`

| # | приоритет | задача | откуда | файл:строка | монетизация / пресейв |
|---|-----------|--------|--------|-------------|------------------------|
| 1 | **P0** | Галерея REAL_FALLBACK Y2K → мемфис/кибер коллизия + ARCHIVE_42 210 `archive-*.jpg` soft-200 HTML (рендер через `getRealSrc` маскирует, но fallback врёт и кириллица в src) — исправить маппинг + `loading=lazy`/`onError` градиент + Caddy `handle /magnum/images/*` без `try_files` | review | `src/pages/GalleryPage.tsx:36-43` / `src/pages/GalleryPage.tsx:179-200` / `src/lib/galleryTokens.ts:32` | нет прямой монетизации, но бьёт доверие к пресейву/магазину (битые арты = дроп конверсии) · `reports/review-2026-09-01-1559.md:Замечание #1-2` |
| 2 | **P0** | `POST /magnum/api/ai` открыт без auth и без rate-limit — аноним жжёт `XIAOMI_API_KEY` (mimo-v2-flash max 400) | auth | `server.ts:2156` `handleAi` | прямые потери биллинга MIMO + DDoS перед промо · фикс `ai:${ip} 8/мин` + `image requires auth` · `reports/auth-2026-09-01-1554.md:Баг #1` |
| 3 | **P0** | `handleIdeasVote` anon-фарм: `votes+1` без `magnum_idea_votes` dedup, только `rateLimit 12/мин по IP` — ротация IP накручивает бесконечно | watchdog | `server.ts:295-318` `handleIdeasVote` | обесценивает голосование → пресейв-рейтинг/идеи → магазин (топ-идеи → скины) · `reports/watchdog-2026-09-01-1556.md:Баг #2` |
| 4 | **P0** | DDL в hot path чата/фолловов `CREATE TABLE IF NOT EXISTS` внутри каждого запроса + нет индекса `magnum_chat_messages(created_at DESC)` + рассинхрон `isValidBundleId` | review | `server.ts:1720` `handleChatHistory` / `server.ts:1752` `handleChatSend` / `server.ts:1799` `handleFollowToggle` / `server.ts:1820` `handleFollowsList` / `src/pages/ShopPage.tsx:93` | задержка 30-80мс к Neon per req, гонка DDL при burst 10 req → 429/500 на покупку bundle/chat · `reports/review-2026-09-01-1559.md:Замечание #3` |
| 5 | **P0** | `follow` без `limit max 100` + `anon_id` не привязан к экономике (нет списания coins за голос/чат) — абуз без затрат | watchdog/auth | `server.ts:1720-1825` / `drizzle/migrations/0016_chat_follows.sql:25` | абуз голосов/чата обходит `magnum-coins` экономику (wager/покупки) · `reports/watchdog-2026-09-01-1556.md:Идея починки #3` |
| 6 | **P1** | DUEL TURBO 42 — WS 2-4 + turbo x8 + ghost replay | hype-queue | `docs/hype-queue.md:34` `queued 15:55` | **wager 0/42/142/420, win +wager*2 +42 ELO, топ-3 +1420 + crown** · `Bun.serve ws /magnum/api/ws` ABCD 10с turbo <0.2с +10% капа x8 |
| 7 | **P1** | ECO ZAVOD 42 — 8Q Заводы/Уголь/Томь/Кузбасс + смена 7дн | hype-queue | `docs/hype-queue.md:35` `queued 15:55` | **42 Нормис / 142 Братуха / 420 Легенда 1×/сутки +1420 босс 8/8 freeze 420** · `magnum-eco-challenge:{weekId,streak}` OG 1080×1080 |
| 8 | **P0** | NEON PRISM 42 — 12 скинов neon prism + aurora epic 1420 + dust/крафт | hype-queue | `docs/hype-queue.md:36` `queued 15:55` | **common 42 / uncommon 142 / rare 420 / epic 1420**, крафт 42 разбор +100 dust · `magnum_cosmetics` + `magnum_shop_inventory` |
| 9 | **P0** | FRAME TURBO GOLD — mimo-v2.5 vision + conic-aurora + turbo glow + cross -42 prism | hype-queue | `docs/hype-queue.md:37` `queued 15:55` | **бесплатно verified**, cross **-42** в prism/duel · `POST /magnum/api/ai` → `magnum_frames` + LS `magnum-frame-verified=1` → пресейв |
| 10 | **P1** | TURBO SEASON 42 — ELO 7дн + ghost-crown топ-3 + pulse | hype-queue | `docs/hype-queue.md:38` `queued 15:55` | **+42 win / +142 streak 3 / +1420 crown топ-3** · `magnum_leaderboard(game=duel42)` + `magnum-arena-season` |

> Источники: `reports/review-2026-09-01-1559.md`, `reports/watchdog-2026-09-01-1556.md`, `reports/auth-2026-09-01-1554.md`, `reports/hype-2026-09-01-1555.md`, `docs/spec-audit-2026-09-01.md`, `docs/hype-queue.md:34-38`, `docs/SPEC-42.md:§3/§6/§10` · `reports/director-*.md` — нет файлов (пропуск) · `reports/review-2026-09-01-1544.md` + `reports/watchdog-2026-09-01-1548.md` — дублируют P0 галерею/голоса (учтены) · `tsc 0` `tests 3130 PASS` `gallery 8 файлов` `health 200/200/200` `magnum-bun active`

### Примечания сортировки

- P0: auth/404/деньги (№1-5) выше хайпа, даже если хайп помечен P0 в очереди — экономика и 404 бьют пресейв сильнее фич.
- Галерея P0 №1: `getRealSrc` на `src/pages/GalleryPage.tsx:785-789` уже маскирует 404 в рендере `2503/2618`, но `REAL_FALLBACK:36-43` всё ещё `y2k-01→memphis`, `y2k-03→cyber` — фильтр Y2K показывает чужой стиль; `ARCHIVE_42:179` хранит `archive-*.jpg` (кириллица) — без `loading=lazy`/`onError` и Caddy `handle /magnum/images/*` без `try_files` остаётся soft-200 HTML.
- Auth P0 №2 и Watchdog P0 №3 — единственные открытые POST без затрат монет (остальные `coins/shop` требуют auth + `checkRateLimit`).
- После закрытия P0 №1-5 — брать P1 хайп №6-10 по очереди (RUSH→TURBO ротация), каждый апгрейд 80-200 строк, меню + баннер + рейтинг.

### Сверка с SPEC-42 и spec-audit

- `docs/spec-audit-2026-09-01.md:P0-1/P0-2` (`shop/state`, `coins/set` 404) — **закрыты** в `server.ts:2442-2443` `handleShopState/handleShopEquipped` и `server.ts:2341` `handleCoinsSet` (есть алиасы), не в топ-10.
- `spec-audit:P0-4` GSAP a11y — **закрыт**: все `src/pages/games/*.tsx:9` теперь `prefers-reduced-motion` gate + `gsap.context` (проверено `grep -L` 0).
- `spec-audit:P0-3` CI 404 — покрывается задачей №1 (добавить `gallery-404.test.ts` `fs.existsSync(public+realSrcOf)`).
- `spec-audit:P0-5` Brat-Bot → Frame — покрывается задачей №9 (mimo-v2.5 → `magnum_frames`).
