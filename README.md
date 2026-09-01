# MAGNUM — 5opka × 42 братухи

> **5 треков — 5 пуль.** Последний совместный альбом 5opka и MellSher. Мультижанровый захват — от сада до фанаток Анны Асти.

[![Live](https://img.shields.io/badge/Live-oooyuki.zomb.top%3A30645%2Fmagnum-ff2d55?style=for-the-badge)](https://oooyuki.zomb.top:30645/magnum/) [![Presave](https://img.shields.io/badge/Presave-Bandlink-00ff88?style=for-the-badge)](https://music.thefence.me/psmagnum) [![Bun](https://img.shields.io/badge/Bun-1.4-black?style=flat-square)](https://bun.sh) [![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square)](https://react.dev) [![Neon](https://img.shields.io/badge/Lakebase-Neon-00E699?style=flat-square)](https://neon.tech) [![Tests](https://img.shields.io/badge/Tests-52%20passing-brightgreen?style=flat-square)](#тесты)

**Демо:** https://oooyuki.zomb.top:30645/magnum/ · **HTTP (Obscura):** http://localhost:30646/magnum/ · **Пресейв:** https://music.thefence.me/psmagnum

---

## Что это

Промо-сайт альбома **MAGNUM** уровня $5000 — не лендинг, а платформа 42-движения. 14 игровых роутов, AI-бот, магазин косметики, эко-рейтинг, майнинг, галерея 42-артов, рейтинг пресейва и генератор идей.

## Фичи

| Блок | Что внутри |
|---|---|
| 🎮 **Игры 42** | Runner / Match-3 / Knife Hit / Memory / Clicker / Quiz / Blackjack 42 (4200 монет → открытка) / Roulette 42 / Rhythm / Stack / Flappy 42 / 2042 / Typing — победа → пресейв |
| 🤖 **БРАТ-БОТ 42** | AI-бот с проверкой скрина пресейва через прокси (ключ не в бандле), кидаешь скрин — хвалит, нет — уговаривает, сжатие до 1280 JPEG |
| 🛒 **Магазин** | 12 скинов (CSS-градиенты+эмодзи) редкости 42/142/420/1420, единый `magnum-coins` (миграция из blackjack/roulette) |
| 🌿 **Эко-рейтинг** | 8 вопросов Кемерово/Кузбасса, ранги Нормис→Легенда, `magnum-eco-leaderboard` |
| ⛏️ **Майнинг** | Кликер + апгрейды лопата 42 → шахта 2042, авто-майнинг |
| 🖼️ **Галерея 42** | СССР/Y2K/киберпанк/мемфис, лайтбокс GSAP, фильтр |
| 🏆 **Рейтинг пресейва** | Топ-20 братух (8K клипов / 200K просмотров мок), проверка через бота |
| 💡 **Идеи 42** | `magnum_ideas` в Neon, голосование `▲`, `POST /magnum/api/ideas` |
| 📰 **Recaps** | Пересказы нарезок Freakland/СП с YouTube-транскриптов (крон 60м) |

## Стек

**Frontend:** React 19 + TS strict + GSAP ScrollTrigger + CSS Modules + React Router 7  
**Build/Runtime:** `Bun.build` (splitting, vendor `chunk-9s3rb6k3.js 143KB` + `main ~788KB`, `modulepreload`), `Bun.serve` (SPA `try_files` + `/magnum/api/*`)  
**Backend:** Postgres (`drizzle-orm` + `neon.ts` infra-as-code), `@neondatabase/serverless`  
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
  components/ Hero, Layout (14 nav), AiBot, Gallery, Timeline, PressWall, News2026, ErrorBoundary…
  pages/ HomePage, ShopPage, EcoPage, GalleryPage, MiningPage, PresaveRatingPage, IdeasPage, RecapsPage, DiscographyPage…
  pages/games/ Runner, Match3, KnifeHit, Memory, Clicker, Blackjack, Roulette, Rhythm, Stack…
  lib/ coins.ts (→ /magnum/api/coins)
drizzle/ schema.ts (magnum_ideas, leaderboard, eco_results, shop_inventory, frames, users, sessions, coins)
neon.ts  # infra-as-code
public/images/ postcard-4200.png (242KB), ai-bot-avatar.png (92KB), gallery-42/*
```

## Neon

```bash
NEON_API_KEY=napi_... neon link --project-id proud-bar-62331523
neon env pull  # → .env.local (DATABASE_URL, DATABASE_URL_UNPOOLED)
bunx drizzle-kit generate && bunx drizzle-kit push  # DATABASE_URL_UNPOOLED (direct)
```

Таблицы: `magnum_ideas`, `magnum_leaderboard`, `magnum_eco_results`, `magnum_shop_inventory`, `magnum_frames`, `magnum_users`, `magnum_sessions`, `magnum_coins` + `magnum_mining`.

## Тесты

```bash
bunx tsc --noEmit
bunx vitest run  # 52 теста: smoke 8 + content 16 + e2e.health 5 + flappy 9 + 2042 14
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

## Пресейв

Все победы/рамки/рейтинги ведут на **https://music.thefence.me/psmagnum** · Открытка 4200 монет — `public/images/postcard-4200.png` в модалках Blackjack/Roulette.

---
© 2026 5opka / 42 братухи · Сделано на Bun + Neon
