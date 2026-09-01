# MAGNUM — 5opka × 42 братухи

> **5 треков — 5 пуль.** Последний совместный альбом 5opka и MellSher. Мультижанровый захват — от сада до фанаток Анны Асти.

[![Live](https://img.shields.io/badge/Live-oooyuki.zomb.top%3A30645%2Fmagnum-ff2d55?style=for-the-badge)](https://oooyuki.zomb.top:30645/magnum/) [![Presave](https://img.shields.io/badge/Presave-Bandlink-00ff88?style=for-the-badge)](https://music.thefence.me/psmagnum) [![Bun](https://img.shields.io/badge/Bun-1.4-black?style=flat-square)](https://bun.sh) [![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square)](https://react.dev) [![Neon](https://img.shields.io/badge/Lakebase-Neon-00E699?style=flat-square)](https://neon.tech) [![Tests](https://img.shields.io/badge/Tests-2997%20passing-brightgreen?style=flat-square)](#тесты) [![P1](https://img.shields.io/badge/P1-audit%20closed-8A2BE2?style=flat-square)](#что-это)

**Демо:** https://oooyuki.zomb.top:30645/magnum/ · **HTTP (Obscura):** http://localhost:30646/magnum/ · **Пресейв:** https://music.thefence.me/psmagnum

---

## Что это

> ✨ **P1 аудита закрыт** — `App 16/16 lazy`, `economy.ts 2520→80 строк` (дубли QUEST удалены), `drizzle 0009 magnum_promo_codes`, `docs/games-spec.md` + `SPEC-42 §7.1/7.2` для Blackjack/Roulette открытки 4200, `sitemap 32 urls` валиден.

Промо-сайт альбома **MAGNUM** уровня $5000 — не лендинг, а платформа 42-движения. 16 игровых роутов, AI-бот, магазин косметики, эко-рейтинг, майнинг, галерея 42-артов, рейтинг пресейва и генератор идей.

## Фичи

| Блок | Что внутри |
|---|---|
| 🎮 **Игры 42** | Runner / Match-3 / Knife Hit / Memory / Clicker / Quiz (24 вопроса, стрик xN, 50/50, speed-бонус) / Blackjack 42 — казино-апгрейд (стрик x10 Легенда, конфетти-канвас, GSAP раздача, хинт-стратегия, 12 ачивок) / Roulette 42 ×10 пресетов + hot/cold + ×2/↻ / Rhythm (пауза P/Space) / Stack 2026 — 5 пуль lore + pause + canvas labels / Flappy 42 / 2042 (undo+H/CtrlZ, hint, WASD, GSAP merge/confetti, TILE_LORE×12) / Typing / Snake 42 (комбо x12, цепочка 1.8с, WebAudio pitch, шейк) / Dodge 42 / Timeline 2026 — победа → пресейв (16 роутов: `/magnum/games/*`) |
| 🤖 **БРАТ-БОТ 42** | AI-бот с проверкой скрина пресейва через прокси (ключ не в бандле), кидаешь скрин — хвалит, нет — уговаривает, сжатие до 1280 JPEG |
| 🛒 **Магазин** | 12 скинов (CSS-градиенты+эмодзи) редкости 42/142/420/1420, единый `magnum-coins` (миграция из blackjack/roulette) |
| 🌿 **Эко-рейтинг** | 8 вопросов Кемерово/Кузбасса, ранги Нормис→Легенда, `magnum-eco-leaderboard` |
| ⛏️ **Майнинг** | Кликер + апгрейды лопата 42 → шахта 2042, авто-майнинг, `/magnum/api/mining/*` (collect/top/upgrade/click) |
| 💎 **Vault 42** | 5 лимиток + Neon `magnum_mining_vault` + `/mining/vault` + `/mining/vault/claim` + GSAP |
| 🏅 **Ачивки + Профиль** | 10 ачивок Neon (`first_presave`/`miner_100`..`duel`) + `/achievements/catalog` + `/achievements` + `/achievements/claim` + `/profile` агрегат (coins/mining/daily/tx/presave/shop/cos/vault/ach/frame) |
| 🎁 **Промокоды** | 5 кодов Neon MAGNUM42/5OPKA/BRATUKHI/KUZYA/VIP42 + `/promo/catalog` + `/promo/redeem` + `/promo/my` + rate limit + уведомления |
| 🖼️ **Галерея 42** | СССР/Y2K/киберпанк/мемфис, лайтбокс GSAP, фильтр — 6 реальных `archive-*.jpg` |
| 🏆 **Рейтинг пресейва** | Топ-20 братух (8K клипов / 200K просмотров мок), проверка через бота, `/magnum/api/presave/*` |
| 💡 **Идеи 42** | `magnum_ideas` в Neon, голосование `▲` + закладки + `/magnum/api/ideas/*` + `/bookmarks` |
| 📰 **Recaps** | Пересказы нарезок Freakland/СП с YouTube-транскриптов (крон 60м) |
| 🎵 **Дискография** | Треки альбома MAGNUM с GSAP-анимацией, hover RGB, reduced-motion |
| 🎤 **Артисты** | Профили артистов 5opka / MellSher, stagger-entrance |
| ℹ️ **О 42** | Движение 42 — история, философия, манифест (`/magnum/42`) |
| 👗 **Last Fit** | Последний образ / фит |
| 🎵 **Трек-страница** | `/track/:slug` — детали отдельного трека |

## Стек

**Frontend:** React 19 + TS strict + GSAP ScrollTrigger + CSS Modules + React Router 7  
**Build/Runtime:** `Bun.build` (code-split: `main ~510KB` + 20+ `chunk-*.js` lazy, 16 игр + 9 heavy pages via `React.lazy` + `modulepreload`), `Bun.serve` (SPA `try_files` + `/magnum/api/*` + `/magnum/api/ws` WebSocket)  
**Backend:** Postgres (`drizzle-orm` + `neon.ts` infra-as-code), `@neondatabase/serverless` — 20 таблиц  
**Infra:** `magnum-caddy` (Caddy `omniroute-caddy:latest` + Cloudflare DNS) `:30645` TLS, `bun:30646` HTTP для Obscura (30MB, порт 9222), GitHub Actions SSH deploy

## Быстрый старт

```bash
bun install
cp .env.local.example .env.local  # DATABASE_URL, XIAOMI_API_KEY, MIMO_BASE_URL
bun run build.ts          # → dist/ (main-*.js + chunk-*.js + vendor-*.js + main-*.css)
PORT=30646 bun run server.ts  # http://localhost:30646/magnum/
```

## Структура

```
src/
  components/ Hero, Layout, AiBot, AuthStatus, Gallery, Timeline, PressWall, News2026, NavGrid, ErrorBoundary, PageLoader…
  pages/ HomePage, ShopPage, EcoPage, GalleryPage, MiningPage, PresaveRatingPage, IdeasPage, RecapsPage, DiscographyPage (lazy), ArtistsPage (lazy), About42Page, AboutPage, LastFitPage, TrackPage, GamesHub, GamePage
  pages/games/ Runner, Match3, KnifeHit, Memory, Clicker, Blackjack, Roulette, Rhythm, Stack, Flappy42, Game2042, Typing, Snake42, Dodge42, Quiz, Timeline2026 (+16 роутов, все lazy в App.tsx)
  lib/ coins.ts (→ /magnum/api/coins), economy.ts, perf-analytics.ts, presaveTracker.ts
  App.tsx  # BrowserRouter + /magnum layout: index + last-fit + track/:slug + discography + 42 + artists + game + games + games/*×16 + shop + eco + gallery + mining + presave-rating + ideas + recaps
drizzle/ schema.ts (magnum_users, magnum_sessions, magnum_coins, magnum_mining, magnum_ideas, magnum_leaderboard, magnum_shop_inventory, magnum_eco_results, magnum_frames, magnum_cosmetics, magnum_presave_clicks, magnum_daily_claims, magnum_transactions, magnum_idea_votes, magnum_idea_bookmarks, magnum_user_achievements, magnum_mining_vault, magnum_notifications, magnum_promo_codes, magnum_promo_redemptions)
neon.ts  # infra-as-code
server.ts  # Bun.serve: /magnum/api/ai, /auth/*, /health, /coins/*, /presave/*, /ideas/*, /frame/*, /eco/*, /shop/*, /mining/*, /daily/*, /achievements/*, /profile, /promo/*, /notifications/*, /transactions, /ws
public/images/ postcard-4200.png (242KB), ai-bot-avatar.png (92KB), gallery-42/*
```

## Neon

```bash
NEON_API_KEY=napi_... neon link --project-id proud-bar-62331523
neon env pull  # → .env.local (DATABASE_URL, DATABASE_URL_UNPOOLED)
bunx drizzle-kit generate && bunx drizzle-kit push  # DATABASE_URL_UNPOOLED (direct)
```

Таблицы: `magnum_users`, `magnum_sessions`, `magnum_coins`, `magnum_mining`, `magnum_ideas`, `magnum_leaderboard`, `magnum_shop_inventory`, `magnum_eco_results`, `magnum_frames`, `magnum_cosmetics`, `magnum_presave_clicks`, `magnum_daily_claims`, `magnum_transactions`, `magnum_idea_votes`, `magnum_idea_bookmarks`, `magnum_user_achievements`, `magnum_mining_vault`, `magnum_notifications`, `magnum_promo_codes`, `magnum_promo_redemptions`.

## Тесты

```bash
bunx tsc --noEmit
bunx vitest run  # 2997 тестов (23 файла): smoke + content + blackjack-roulette-spec + e2e.health + flappy + 2042 + snake + gallery-real + api + massive42…
```

CI: `.github/workflows/deploy.yml` → `tsc → bun test → build → scp /srv/magnum`.

## Кроны 24/7

| Крон | Интервал |
|---|---|
| `magnum 10min substantial + rating` | 10м — фича 80-150 строк + оценка 0-10 по `git log --since="10 minutes ago"` |
| `magnum browser health 15m` | 15м — curl + Obscura h1/botFab + хеш `main-*.js` |
| `magnum 10min watchdog` | 10м — чинит битый `main-*.js` |
| `magnum changelog investor 20m` | 20м — `CHANGELOG.md` Keep a Changelog с эмодзи |
| `magnum ideas generator 15m` | 15м — 2-3 идеи в `magnum_ideas` |
| `magnum freakland recaps 60m` | 60м — YouTube транскрипты → `RecapsPage` |
| `magnum readme keeper 30m` | 30м — сверка README vs `src/` (этот джоб) |
| `magnum GSAP lead 30m` | 30м — GSAP-полировка страниц |
| `magnum rating backend 20m` | 20м — бэкенд рейтинга |
| `magnum games lead 30m` | 30м — игры 42 |
| `magnum reviewer 20m` | 20м — ревью кода |
| `magnum tester 15m` | 15м — `bunx vitest run` |
| `magnum health report 15m file` | 15м — файловый health-репорт |
| `magnum agent 1-8` | 5-15м — 8 автономных агентов (watchdog/tester/hype/games/content/api/reviewer/changelog) |

## Пресейв

Все победы/рамки/рейтинги ведут на **https://music.thefence.me/psmagnum** · Открытка 4200 монет — `public/images/postcard-4200.png` в модалках Blackjack/Roulette.

---
© 2026 5opka / 42 братухи · Сделано на Bun + Neon
