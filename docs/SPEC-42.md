# MAGNUM — SPEC 42 · Единый источниковый документ

> **Статус:** `source of truth` · **Версия:** `42.0` · **Дата:** `2026-09-01`  
> **Покрытие:** 100% фич из кода имеют раздел здесь · Фича без раздела = не существует  
> **Связанные доки:** `docs/hype-features.md` (спек хайп-фич, теперь §12), `src/pages/GalleryPage.tsx` (детали галереи, теперь §8), `README.md` (быстрый старт), `server.ts` (контракт API — §4)

---

## Оглавление

1. [Архитектура](#1-архитектура)
2. [Роуты `/magnum/*`](#2-роуты-magnum)
3. [API контракт `/magnum/api/*`](#3-api-контракт-magnumapi)
4. [Модели данных Neon (Drizzle)](#4-модели-данных-neon)
5. [GSAP / Motion требования](#5-gsap--motion-требования)
6. [Галерея 42 — реальные файлы vs мок](#6-галерея-42--реальные-файлы-vs-мок)
7. [Игры — 16 штук](#7-игры--16-штук)
8. [Страницы / Компоненты](#8-страницы--компоненты)
9. [Кошелёк `magnum-coins` + экономика](#9-кошелёк-magnum-coins--экономика)
10. [Auth / Sessions](#10-auth--sessions)
11. [AI БРАТ-БОТ 42](#11-ai-брат-бот-42)
12. [Хайп-фичи (из hype-features.md)](#12-хайп-фичи)
13. [Infra / Build / Deploy / Cron](#13-infra--build--deploy--cron)
14. [Критерии готовности (DoD)](#14-критерии-готовности-dod)
15. [Чек-лист ревьюера](#15-чек-лист-ревьюера)
16. [Негативные сценарии / Инварианты](#16-негативные-сценарии--инварианты)
17. [Приложение: пресеты, коды ошибок, env](#17-приложение)

---

## 1. Архитектура

```
magnum-album/
├── src/
│   ├── App.tsx              # BrowserRouter + lazy(16 игр) + Suspense
│   ├── components/          # Layout, Hero, AiBot, Gallery, Timeline, VerifiedFrame...
│   ├── pages/               # Home, Gallery, Mining, Shop, Eco, Ideas, Recaps, Discography...
│   ├── pages/games/         # 16 игр (см. §7) + dodge42Logic.ts
│   └── lib/                 # coins.ts, economy.ts, presaveTracker.ts, perf-analytics.ts
├── drizzle/schema.ts        # 8 таблиц + presave_clicks (runtime, вне schema)
├── server.ts                # Bun.serve: SPA fallback + /magnum/api/* + WebSocket /ws
├── build.ts                 # Bun.build: splitting, vendor chunk, sitemap sync
├── neon.ts                  # infra-as-code (Neon)
├── public/images/gallery-42/# реальные ассеты галереи
└── dist/                    # артефакты сборки (main-*.js, chunk-*.js, vendor-*.js)
```

| Слой | Технология | Версия / Примечание |
|------|------------|---------------------|
| Frontend | React 19 + TypeScript `strict` + CSS Modules | `react-router-dom@7` |
| Анимация | GSAP 3 + ScrollTrigger | `gsap/registerPlugin`, см. §5 |
| Bundler | `Bun.build` (ESM, splitting, minify, target browser) | `build.ts` — vendor isolation `chunk-9s3rb6k3.js 143KB` |
| Runtime | `Bun.serve` | SPA `try_files` + API + WS, `PORT env` (30646 http / 30645 tls) |
| DB | Neon Postgres + `drizzle-orm` + `@neondatabase/serverless` | `DATABASE_URL` / `DATABASE_URL_UNPOOLED` (direct для `drizzle-kit push`) |
| Infra | Caddy `omniroute-caddy:latest` + Cloudflare DNS | `:30645` TLS, `bun:30646` для Obscura |
| CI | GitHub Actions SSH deploy | `.github/workflows/deploy.yml` : `tsc → vitest → build → scp /srv/magnum` |

**Принципы:**
- Базовый путь — `/magnum/` (SPA fallback в `server.ts`: `Bun.file(dist/index.html)`).
- Все победы/рамки/рейтинги ведут на `PRESAVE = https://music.thefence.me/psmagnum`.
- Тон: «братуха», «легенда», RGB/neon, `conic-gradient`, без мата.
- Факты для пропаганды: `ТУСА МЕДУЗА 14.08 — 8K клипов / 200K просмотров · CLAY 03.04 РЗТ73 · SUPER PUPER NOVA РЗТ80/XXL86 · VPN 28.04 в чартах`.

---

## 2. Роуты `/magnum/*`

### 2.1 Frontend (React Router) — `src/App.tsx`

Все вложены в `<Route path="/magnum" element={<Layout />}>`.

| Путь | Компонент | Lazy | Описание |
|------|-----------|------|----------|
| `/magnum` | `HomePage` | — | Лендинг альбома |
| `/magnum/last-fit` | `LastFitPage` | — | Последний образ |
| `/magnum/track/:slug` | `TrackPage` | — | Детали трека (`tusa-meduza`, `vpn`, `42`...) |
| `/magnum/discography` | `DiscographyPage` | — | Дискография |
| `/magnum/42` | `About42Page` | — | Движение 42 |
| `/magnum/artists` | `ArtistsPage` | — | 5opka / MellSher |
| `/magnum/game` | `GamePage` | — | Квиз 5 вопросов (legacy GamePage) |
| `/magnum/games` | `GamesHub` | — | Хаб 16 игр |
| `/magnum/games/runner` | `RunnerGame` | ✅ | Раннер |
| `/magnum/games/match3` | `Match3Game` | ✅ | Матч-3 |
| `/magnum/games/knife` | `KnifeHitGame` | ✅ | Ножи |
| `/magnum/games/memory` | `MemoryGame` | ✅ | Память |
| `/magnum/games/clicker` | `ClickerGame` | ✅ | Кликер |
| `/magnum/games/quiz` | `QuizGame` | ✅ | Квиз 8Q |
| `/magnum/games/rhythm` | `RhythmGame` | ✅ | Ритм D F J K |
| `/magnum/games/stack` | `Stack42Game` | ✅ | Стопка 15 этажей |
| `/magnum/games/blackjack` | `BlackjackGame` | ✅ | Блэкджек |
| `/magnum/games/roulette` | `RouletteGame` | ✅ | Рулетка |
| `/magnum/games/2042` | `Game2042` | ✅ | Пазл 2042 |
| `/magnum/games/flappy` | `Flappy42Game` | ✅ | Flappy |
| `/magnum/games/typing` | `TypingGame` | ✅ | Скоропечать |
| `/magnum/games/snake` | `Snake42Game` | ✅ | Змейка |
| `/magnum/games/dodge` | `Dodge42Game` | ✅ | 5 ПУЛЬ |
| `/magnum/games/timeline` | `Timeline2026Game` | ✅ | Хронология 2026 |
| `/magnum/shop` | `ShopPage` | — | Магазин 12 скинов |
| `/magnum/eco` | `EcoPage` | — | Эко-квиз 8Q |
| `/magnum/gallery` | `GalleryPage` | — | Галерея 42 |
| `/magnum/mining` | `MiningPage` | — | Майнинг Кузбасса |
| `/magnum/presave-rating` | `PresaveRatingPage` | — | Рейтинг пресейва |
| `/magnum/ideas` | `IdeasPage` | — | Идеи 42 |
| `/magnum/recaps` | `RecapsPage` | — | Пересказы Freakland/СП |

> **Sitemap:** все публичные пути — в `build.ts: ROUTES` → `public/sitemap.xml → dist/sitemap.xml` с `lastmod` + приоритетами (см. §13).

### 2.2 Backend fallback — `server.ts`

```ts
if (url.pathname === "/magnum" || url.pathname.startsWith("/magnum/")) {
  const rel = url.pathname.replace(/^\/magnum\/?/, "");
  const clean = rel.replace(/\/$/, "");
  if (clean && !clean.includes("..")) {
    const f = Bun.file(dist + "/" + clean);
    if (await f.exists()) return new Response(f, { headers: { "Content-Type": guessContentType(clean) } });
  }
  return new Response(Bun.file(dist + "/index.html"), { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
```

---

## 3. API контракт `/magnum/api/*`

Базовый URL: `https://<host>/magnum/api/*`. `Content-Type: application/json` где не указано иное. Токен — `Authorization: Bearer <token>` или `?token=` или `Cookie: magnum_token=`.

| # | Метод | Путь | Auth | Тело / Query | 2xx | Ошибки |
|---|-------|------|------|--------------|-----|--------|
| 1 | `POST` | `/magnum/api/auth/register` | — | `{username: string(3..32), password: string(3..)}` | `201 {token, user:{id,username}}` + `Set-Cookie: magnum_token` | `400 JSON/validation`, `409 username taken`, `500 db` |
| 2 | `POST` | `/magnum/api/auth/login` | — | `{username, password}` | `200 {token, user}` + `Set-Cookie` | `400`, `401 invalid credentials` |
| 3 | `GET` | `/magnum/api/auth/me` | ✅ | — | `200 {user:{id, username}}` | `401` |
| 4 | `POST` | `/magnum/api/auth/logout` | opt | — | `200 {ok:true}` + `Set-Cookie: clear` | — |
| 5 | `GET` | `/magnum/api/coins` | ✅ | — | `200 {balance:number}` (создаёт 1000 если нет строки) | `401` |
| 6 | `POST` | `/magnum/api/coins/add` | ✅ | `{amount:number int !=0}` (принимает также `delta/coins`) | `200 {balance}` | `400 amount must be integer/!=0`, `401` |
| 7 | `POST` | `/magnum/api/coins/set` | ✅ | `{coins|balance|amount}` | `200 {balance}` | fallback на `/add` дельтой |
| 8 | `GET` | `/magnum/api/ideas` | — | — | `200 {ideas: MagnumIdea[]}` `ORDER BY votes DESC, id ASC` | `500` |
| 9 | `POST` | `/magnum/api/ideas` | ✅ | `{title: 4..80, description: 0..300}` | `201 {idea}` | `400 title min 4`, `401` |
| 10 | `POST` | `/magnum/api/ideas/:id/vote` | — | `id int>0` | `200 {idea}` (votes+1) | `400 invalid id`, `404 not found` |
| 11 | `GET` | `/magnum/api/shop/inventory` | ✅ | — | `200 {inventory: {id,skinId,skin_id,equipped,purchased_at}[], items: same}` | `401` |
| 12 | `POST` | `/magnum/api/shop/buy` | ✅ | `{skinId|skin_id|id}` | `200 {ok:true, skinId, price, balance}` | `400 skinId required`, `402 not enough coins`, `409 already owned` |
| 13 | `POST` | `/magnum/api/shop/equip` | ✅ | `{skinId|skin_id|id}` | `200 {ok:true, equipped, inventory[]}` | `400`, `404 not owned`, `401` |
| 14 | `GET` | `/magnum/api/frame/status` | opt | — | `200 {frames:{id,username,verified,status,created_at}[], total, verified, pending, user?}` | `500` |
| 15 | `POST` | `/magnum/api/frame/verify` | ✅ | `{verified:boolean}` | `200 {ok:true, frame, verified}` | `400`, `401` |
| 16 | `GET` | `/magnum/api/eco/leaderboard` | — | — | `200 {leaderboard: {player,username,score,rank,status,created_at}[], entries:same}` `ORDER BY score DESC LIMIT 50` | `500` |
| 17 | `POST` | `/magnum/api/eco/submit` | opt | `{score:number, rank?:string, player|name|username?:string(2..32)}` | `201 {ok:true, entry}` | `400 score/player required` |
| 18 | `GET` | `/magnum/api/mining` | ✅ | — | `200 {balance, upgrades:{id,count}[], perClick, perSec}` | `401` |
| 19 | `POST` | `/magnum/api/mining/click` | ✅ | — | `200 {balance, upgrades, added: perClick}` | `401` |
| 20 | `POST` | `/magnum/api/mining/upgrade` | ✅ | `{id: shovel|pick|drill|truck|shaft}` | `200 {balance, upgrades, price}` | `400 unknown id`, `402 not enough coins` |
| 21 | `POST` | `/magnum/api/ai` | — | `{text?:string(≤2000), image?: "data:image/...;base64,...", history?: {role,content}[]}` | `200 {text:string}` | `400 text or image required`, `500 XIAOMI_API_KEY missing`, `502 upstream` |
| 22 | `POST` | `/magnum/api/presave/click` | opt | `{url?:string, ts?:number}` | `200 {ok:true}` (fire-and-forget, INSERT) | — |
| 23 | `WS` | `/magnum/api/ws` | opt (`?username=&token`/`Cookie`) | WS upgrade | см. §3.1 | `426 Upgrade failed` |

**Цены магазина (server):** `SHOP_PRICES` + эвристика `getSkinPrice(skinId)`: `42 → 142 → 420 → 1420` по подстроке (`1420/legendary`, `420/epic`, `142/rare`, `42/common/basic`) → fallback `42`. Клиент не хранит цену, только `id`.

**Mining формула:** `cost = floor(baseCost * 1.42^count)`; `perClick = 1 + Σ(power*count)`; `perSec = Σ(auto*count)`.

| id | baseCost | power | auto |
|----|----------|-------|------|
| `shovel` | 42 | 1 | 0 |
| `pick` | 142 | 3 | 0 |
| `drill` | 420 | 0 | 1 |
| `truck` | 1042 | 0 | 5 |
| `shaft` | 2042 | 5 | 12 |

### 3.1 WebSocket `/magnum/api/ws`

- **Upgrade:** `GET /magnum/api/ws?username=...&token=...` → `server.upgrade(req, {data:{id,username,roomId}})`
- **Комнаты:** `findOrCreateRoom()` — переиспользует `waiting && size<4`, иначе `room-${Date.now36}-${rand}`.
- **Сообщения клиент→сервер (`JSON`):**

| type | payload | эффект |
|------|---------|--------|
| `click` | — | `if playing: scores[ws]++` → `broadcast {type:"scores", room}` |
| `start` | — | `if waiting && size>=2: startDuel()` |
| `join` | `{username:string(≤24)}` | `names.set(ws, name)` → `broadcast {type:"room"}` |
| `reset` | — | `scores=0, state=waiting, clear timer` → `broadcast` |

- **Сообщения сервер→клиенты:**

| type | поле | когда |
|------|------|-------|
| `room` | `{room:{id,state,players:[{name,score}],durationSec}, you, yourId}` | join/open/close/reset/finished→waiting |
| `start` | `{room, duration}` | `startDuel()` — сбрасывает scores, `timer=setTimeout(durationSec*1000)` |
| `scores` | `{room}` | каждый `click` |
| `finish` | `{room}` | по таймауту / при выходе игроков `<2` → `persistDuelResults()` + через 5с(3с) → `waiting` |

- **Персист:** `magnum_leaderboard(player=name, score, game='duel', created_at=now)` по всем игрокам комнаты.
- **Edge:** если `playing && size<2` — форс `finish` + персист + через 3с `waiting`.

### 3.2 Примеры

```ts
// register
POST /magnum/api/auth/register
{"username":"bratukha42","password":"qwerty42"}
→ 201 {"token":"...","user":{"id":1,"username":"bratukha42"}}

// coins
GET /magnum/api/coins  Authorization: Bearer ...
→ {"balance": 1420}

// shop buy → equip
POST /magnum/api/shop/buy  {"skinId":"skin_42"}
→ {"ok":true,"skinId":"skin_42","price":42,"balance":1378}
POST /magnum/api/shop/equip {"skinId":"skin_42"}
→ {"ok":true,"equipped":"skin_42","inventory":[...]}

// eco submit
POST /magnum/api/eco/submit {"score":7,"rank":"Легенда 42"}
→ 201 {"ok":true,"entry":{"id":1,"player":"bratukha42","score":7,"rank":"Легенда 42"}}

// mining
GET /magnum/api/mining → {"balance":420,"upgrades":[{"id":"shovel","count":2}],"perClick":3,"perSec":0}
POST /magnum/api/mining/click → {"balance":423,"upgrades":[...],"added":3}
POST /magnum/api/mining/upgrade {"id":"drill"} → {"balance":3,"upgrades":[...],"price":420}

// ai
POST /magnum/api/ai {"text":"поставил пресейв?","image":"data:image/jpeg;base64,...","history":[]}
→ {"text":"Братуха, легенда! Скрин засчитан..."}

// ws
new WebSocket("wss://host/magnum/api/ws?username=Братуха42&token=...")
ws.send(JSON.stringify({type:"click"}))
```

---

## 4. Модели данных Neon

**Drizzle:** `drizzle/schema.ts` · **Infra-as-code:** `neon.ts` (`defineConfig {auth:false, dataApi:false}`)

| Таблица | Колонки | Примечание |
|---------|---------|------------|
| `magnum_users` | `id serial PK, username text unique, password_hash text, created_at timestamp` | |
| `magnum_sessions` | `token text PK, user_id int→users.id, expires_at timestamp` | `expires_at = now()+30d` |
| `magnum_coins` | `user_id int PK→users.id, balance int default 1000` | Стартовый баланс 1000 |
| `magnum_mining` | `user_id PK, balance int default 0, upgrades jsonb default [], updated_at timestamp` | `upgrades: {id,count}[]` |
| `magnum_ideas` | `id serial PK, title text, description text, votes int default 0, status text default pending, user_id int→users.id, created_at timestamp` | `ORDER BY votes DESC` |
| `magnum_leaderboard` | `id serial PK, player text, score int, game text, created_at timestamp` | `game='duel'` для WS; открыто для расширения |
| `magnum_shop_inventory` | `id serial PK, user_id int→users.id, skin_id text, purchased_at timestamp, equipped bool default false` | `equipped` — один на user (сброс `equipped=false` для остальных) |
| `magnum_eco_results` | `id serial PK, user_id int→users.id, player text, score int, rank text, created_at timestamp` | `rank` — «Нормис/Братуха/Легенда 42» |
| `magnum_frames` | `id serial PK, user_id int→users.id, verified bool, created_at timestamp` | Рамка за пресейв |
| `magnum_presave_clicks`* | `user_id int nullable, url text, created_at timestamp` | Создаётся рантаймом; не в `schema.ts`, используется в `server.ts: handle /presave/click` |

> *`magnum_presave_clicks` отсутствует в `drizzle/schema.ts` — **требует миграции** (`drizzle-kit generate/push` с `DATABASE_URL_UNPOOLED`).

**Команды Neon:**

```bash
NEON_API_KEY=napi_... neon link --project-id proud-bar-62331523
neon env pull  # → .env.local
bunx drizzle-kit generate && bunx drizzle-kit push  # DIRECT URL
```

---

## 5. GSAP / Motion требования

### 5.1 Глобальные инварианты

| Правило | Значение | Где |
|---------|----------|-----|
| `gsap.registerPlugin(ScrollTrigger)` | 1 раз на страницу, до использования | `GalleryPage`, `RecapsPage` |
| Контекст + cleanup | `const ctx = gsap.context(()=>{…}, ref); return ()=>ctx.revert()` | Все страницы |
| `prefers-reduced-motion` | `if (matchMedia("(prefers-reduced-motion: reduce)").matches) { gsap.set(..., {clearProps:"all"/"transform", opacity:1, y:0}); return; }` | В каждом анимационном хелпере |
| `overwrite: true` | на всех `to/fromTo` чтобы не конфликтовали | `GalleryPage` хелперы |
| `will-change` | только во время анимации, снимать через `clearProps` | — |

### 5.2 Галерея — `GalleryPage.tsx` (эталон)

```ts
// helper
function animateEntrance(root: HTMLElement, selector: string, opts?: {y?:number; stagger?:number; duration?:number; delay?:number}) {
  if (prefersReducedMotion()) { gsap.set(selector, {clearProps:"all", opacity:1, y:0}); return; }
  const y = opts?.y ?? 24, stagger = opts?.stagger ?? 0.12, duration = opts?.duration ?? 0.55, delay = opts?.delay ?? 0;
  gsap.set(selector, { y, opacity: 0 });
  gsap.to(selector, { y:0, opacity:1, stagger, duration, ease:"power2.out", delay, overwrite:true });
}
function animateCards(cards: HTMLElement[], fromY=24) {
  if (!cards.length) return;
  if (prefersReducedMotion()) { gsap.set(cards, {y:0, opacity:1, scale:1, clearProps:"transform"}); return; }
  gsap.fromTo(cards, {y:fromY, opacity:0, scale:0.96}, {y:0, opacity:1, scale:1, duration:0.5, stagger:0.12, ease:"back.out(1.2)", overwrite:true});
}
```

| Параметр | Значение | Примечание |
|----------|----------|------------|
| `y` | `24` (дефолт) | `animateEntrance`, `animateCards` |
| `stagger` | `0.12` | `animateEntrance` + `animateCards` (`back.out(1.2)`) |
| `duration` | `0.55` entrance / `0.5` cards / `0.35` tilt | — |
| `ease` | `power2.out`, `back.out(1.2)`, `sine.inOut`, `elastic.out(1,0.5)` | По сценарию |
| `scale` | `0.96 → 1` (cards), `1 → 1.02` (pulse) | — |

### 5.3 Остальные страницы (эталонные значения)

| Страница | Эффект | Параметры |
|----------|--------|-----------|
| `GamesHub` | cards stagger + badge float+glow | `gsap.set card {y:40, opacity:0, scale:0.95}` → `to {y:0, opacity:1, scale:1, stagger:0.1, duration:0.6, ease: back.out(1.7)}`; badge `y:-3, boxShadow glow, duration:1.6, repeat:-1, yoyo:true, sine.inOut` |
| `GamesHub` | magnetic 3D tilt | `onMouseMove: rotateX = (y-center)/center*-8, rotateY = (x-center)/center*8, duration:0.35 power2.out`; `onMouseLeave: rotateX/Y 0, y:0, duration:0.5 elastic.out` |

**Нарушения GSAP = DoD fail.** Проверка: `gsap.context` cleanup, `prefers-reduced-motion` gate, `stagger 0.12 ±0.02`, `y24`, `overwrite:true`.

---

## 6. Галерея 42 — реальные файлы vs мок

### 6.1 Источник правды — `src/pages/GalleryPage.tsx`

```ts
type Style42 = "СССР" | "Y2K" | "киберпанк" | "мемфис";
type FilterStyle = "все" | Style42;
const FILTERS: FilterStyle[] = ["все", "СССР", "Y2K", "киберпанк", "мемфис"];

interface Art42 { id:string; title:string; style:Style42; emoji:string; gradient:string; src:string; desc:string; tag:string; }

const REAL_BY_STYLE: Record<Style42, string> = {
  "СССР": "/magnum/images/gallery-42/42-agit-01-800.webp",
  "Y2K": "/magnum/images/gallery-42/42-memphis-01-800.webp",
  "киберпанк": "/magnum/images/gallery-42/42-cyber-01-800.webp",
  "мемфис": "/magnum/images/gallery-42/42-memphis-01-800.webp",
};
const REAL_FALLBACK: Record<string,string> = {
  "ussr-01": "/magnum/images/gallery-42/42-agit-01-800.webp",
  "ussr-02": "/magnum/images/gallery-42/42-agit-01.jpg",
  "y2k-01": "/magnum/images/gallery-42/42-memphis-01-800.webp",
  "y2k-02": "/magnum/images/gallery-42/42-memphis-01.jpg",
  "cyber-01": "/magnum/images/gallery-42/42-cyber-01-800.webp",
  "memphis-01": "/magnum/images/gallery-42/42-memphis-01-800.webp",
  "y2k-03": "/magnum/images/gallery-42/42-cyber-01.jpg",
};

const BASE_ARTS: Art42[] = [7шт: ussr-01/02, y2k-01/02/03, cyber-01, memphis-01] // все src → REAL_FALLBACK
const MOCK_POOL: Omit<Art42,"id">[] = [6шт: Ковёр, Тетрисуй, Шахта, Геометрия, Автомат, Тамагочи] // все src → реальные файлы
const ARCHIVE_42: Art42[] = [210шт: arch-СССР/Y2K/киберпанк/мемфис-001..210] // src: /magnum/images/gallery-42/archive-{style}-{001..210}.jpg

// Хелперы:
function prefersReducedMotion(): boolean
function getStyleMeta(s:Style42): StyleMeta
function getAccent(s:Style42): string
function formatArtId(id:string): string // `#${id.toUpperCase()}`
function countByStyle(list:Art42[], style:FilterStyle): number
function shuffleArts<T>(arr:T[]): T[]
function pickRandomArts(n:number): Art42[] // slice ARCHIVE_42 shuffle
function animateEntrance(...), animateCards(...), animateHoverEnter(...)
```

### 6.2 Файлы на диске

| Что есть | Путь |
|----------|------|
| Реальные | `public/images/gallery-42/42-agit-01.{jpg,800.webp}` |
|  | `public/images/gallery-42/42-cyber-01.{jpg,800.webp}` |
|  | `public/images/gallery-42/42-memphis-01.{jpg,800.webp}` |
|  | `public/images/gallery-42/42-memphis-01.jpg` / `42-cyber-01.jpg` |
|  | `public/images/postcard-4200.png` (242KB) / `ai-bot-avatar.png` (92KB) |
| Мок (архив 210) | `archive-{СССР,Y2K,киберпанк,мемфис}-{001..210}.jpg` — **сгенерированы**, требуют реальных файлов или остаются заглушками |

**Инварианты:**
- Все `src` в `BASE_ARTS` / `MOCK_POOL` маппятся на 3 существующих сета → нет 404/эмодзи-заглушек в проде.
- `ARCHIVE_42` — 210 артов с путями `archive-*.jpg`: файлы отсутствуют → `onError` fallback на `REAL_BY_STYLE[style]` + градиент.
- Опционально: `public/images/gallery-42/*.jpg` лениво (`loading="lazy" decoding="async"`).

### 6.3 STYLE_META

| Стиль | era | palette | vibe | accent | refs |
|-------|-----|---------|------|--------|------|
| СССР | 1922–1991 → 2142 | `#ff2d55 #8a162c #c9c9c9 #1a1a1a` | молот, бетон, плакат, космос | `#ff2d55` | Родченко, Дейнека, космоплакаты 60-х |
| Y2K | 1999–2007 → хром | `#ffcc00 #ff2d55 #a855f7 #22d3ee` | хром, глянец, блинг | `#ffcc00` | Paris Hilton era, WinAMP, MySpace |
| киберпанк | 2142 → Неон-Кузбасс | `#00ff88 #0a2e1a #ff2d55 #0a0a0a` | дождь, неон, шахта, дрон | `#00ff88` | Blade Runner, Ghost in Shell, Кемерово |
| мемфис | 1981 → постмодерн-поп | `#ffcc00 #ff9ad5 #00ff88 #7c3aed` | геометрия, точки, зигзаги | `#ff9ad5` | Sottsass, Memphis Group |

`GRADIENT_PRESETS` — 24 пресета (`ussr-fire`, `cyber-neon`, `memphis-pop` ...).

---

## 7. Игры — 16 штук

> **Факт:** в `GamesHub` — 16 игр (не 14). Код-сплит всех 16 через `React.lazy + Suspense` (`GameFallback: "Загрузка игры… 🎮"`).

| # | id / route | Название | Иконка | Описание | Ключевая механика | Пресейв CTA |
|---|------------|----------|--------|----------|-------------------|-------------|
| 1 | `runner` `/magnum/games/runner` | Беги, братуха! | 🏃 | Раннер — перепрыгивай мухоморы | 2D canvas, прыжок | `PRESAVE` |
| 2 | `match3` | Матч 42 | 🧩 | Комбинации 42-символов | Match-3 поле | ✅ |
| 3 | `knife` | Ножи 42 | 🔪 | Кидай ножи в мишень | Knife Hit | ✅ |
| 4 | `memory` | Память | 🃏 | Найди пары | Memory flip | ✅ |
| 5 | `clicker` | Кликер | ⚡ | 42 клика за 10с | Clicker + burst | ✅ |
| 6 | `quiz` | Квиз | 🧠 | 8Q про 42/MAGNUM | QuizGame (отдельно от Eco/Recaps) | ✅ |
| 7 | `rhythm` | Ритм MAGNUM | 🎵 | Лови ноты D F J K | Rhythm | ✅ |
| 8 | `stack` | Стопка 42 | 🧱 | Башня 15 этажей | Stack | ✅ |
| 9 | `blackjack` | БЛЭКДЖЕК 42 | ♠️ | Собери 21 | Blackjack (миграция `blackjack42-balance` → `magnum-coins`) | 4200 → открытка |
| 10 | `roulette` | РУЛЕТКА 42 | 🎰 | Европейская 0-36 | Roulette (миграция `roulette42-balance`) | 4200 → открытка |
| 11 | `2042` | ПАЗЛ 2042 | 🧩 | 2048 — собери 42 | 2042 | ✅ |
| 12 | `flappy` | FLAPPY 42 | 🐦 | 42 трубы | Flappy | ✅ |
| 13 | `typing` | Скоропечатание | ⌨️ | Фразы MAGNUM 42 WPM | Typing | ✅ |
| 14 | `snake` | Змейка 42 | 🐍 | Стрелки/свайп до 42 | Snake | ✅ |
| 15 | `dodge` | 5 ПУЛЬ | 💥 | Уклоняйся 42с | Dodge (`dodge42Logic.ts`) | ✅ |
| 16 | `timeline` | ХРОНОЛОГИЯ 2026 | 📅 | События MAGNUM по порядку | Timeline2026 | ✅ |
| — | `game` `/magnum/game` | Квиз (legacy) | — | 5Q `GamePage` | `QUESTIONS` + GSAP | `PRESAVE_URL` |

**Общие инварианты игр:**
- Каждая победа → `PRESAVE` (https://music.thefence.me/psmagnum) CTA + `addCoins()` где применимо.
- `presaveTracker.ts` — делегат `click` на `a[href*="music.thefence.me/psmagnum"]` → `POST /magnum/api/presave/click`.
- `Blackjack/Roulette` — открытка `postcard-4200.png` при 4200 монет; баланс мигрирован в `magnum-coins`.

---

## 8. Страницы / Компоненты

| Страница | Файл | Ключевое |
|----------|------|----------|
| Home | `HomePage` | Пресейв CTA, GSAP hero |
| Discography | `DiscographyPage` | Треки MAGNUM, hover RGB |
| Artists | `ArtistsPage` | 5opka/MellSher, `artists/5opka.jpg` 385×385 |
| About 42 | `About42Page` | Манифест движения |
| LastFit | `LastFitPage` | Фит |
| Track | `TrackPage` | `/track/:slug` |
| Gallery | `GalleryPage` | см. §6 |
| Shop | `ShopPage` | 12 скинов 42/142/420/1420 |
| Eco | `EcoPage` | 8Q Кемерово, ранги, `EcoQuizPage` |
| Mining | `MiningPage` | Клик+апгрейды, `magnum_mining` |
| PresaveRating | `PresaveRatingPage` | Топ-20, `magnum_frames` |
| Ideas | `IdeasPage` | `GET/POST /ideas`, vote |
| Recaps | `RecapsPage` | 6 карточек, 3 транскрипта + 3 «скоро», YouTube `tAi6gI-bw1Q` etc, Tag фильтр, ScrollTrigger |
| GamesHub | `GamesHub` | 16 игр, GSAP stagger/tilt |
| GamePage | `GamePage` | legacy квиз 5Q |

**Компоненты:** `Layout` (14 nav), `Hero`, `AiBot`, `Gallery`, `Timeline`, `PressWall`, `News2026`, `ErrorBoundary`, `VerifiedFrame` (conic-gradient рамка), `EquippedFrame`, etc.

---

## 9. Кошелёк `magnum-coins` + экономика

### 9.1 `src/lib/coins.ts` (серверный)

| Константа | Значение |
|-----------|----------|
| `START_COINS` | 1000 |
| `MAX_COINS` | 9_999_999 |
| `MIN_COINS` | 0 |
| `DAILY_BONUS` | 42 |
| `STREAK_BONUS` | `[42,84,126,200,420]` |

| Функция | Сигнатура | Описание |
|---------|-----------|----------|
| `getCoins()` | `():number` sync cache | Кэш, синхронно |
| `fetchCoins()` | `():Promise<number>` | `GET /coins`, `notify` если изменился |
| `addCoins(n)` | `(n:number):Promise<number>` | `POST /coins/add {amount:delta}` |
| `setCoins(n)` | `(n:number):Promise<number>` | `POST /coins/set` → fallback дельтой |
| `subscribe(cb)` | `(cb:(n)=>void):()=>void` | `cb(cache)` сразу + polling 2с, `clearInterval` когда `size==0` |

Polling: `window.setInterval(fetchBalance, 2000)` только если `listeners.size>=1`. `inFlight` guard.

Расширение: `Transaction`, `DailyState`, `Achievement(7)`, `EconomySnapshot`, `COIN_BUDGET_1..50` (1042..3100), `validateTx1..50`, `createTx1..50`, `progressAchievement1..50`, `coinMetric1..50` — до 2500+ строк (см. файл).

### 9.2 `src/lib/economy.ts` — единый каталог (P1 почищен)

| Экспорт | Значение |
|---------|----------|
| `RARITY_PRICE` | `common 42, rare 142, epic 420, legendary 1420` (синхрон с `ShopPage RARITY_META`) |
| `SHOP_ITEMS 4` | `skin_common_01 42/common`, `skin_rare_01 142/rare`, `skin_epic_01 420/epic`, `skin_legend_01 1420/legendary` |
| `SHOP_CATALOG 12` | `mops/rhino/monkey/frog 42` + `panda/fox/owl 142` + `shark/flamingo/wolf 420` + `tiger/dragon 1420` (синхрон с `ShopPage SKINS`) |
| `getItemPrice/isValidShopId` | цена только из кода, LS хранит `id` |
| `inventory/equipped` | `getInventory/getEquipped/buyItem/equipItem/unequipItem` (LS-совместимо, основной — сервер) |
| `Quest` | единый `createQuest/progressQuest/questProgressPct` — без дублей 69× |
| Удалено | `QUEST_1..69` заглушки (2500 строк) — `git log -- economy.ts`  |

### 9.3 `src/lib/presaveTracker.ts`

```ts
usePresaveTracker() // useEffect document click → closest('a[href*="music.thefence.me/psmagnum"]') → fetch POST /presave/click
```

---

## 10. Auth / Sessions

- **Хеш:** `Bun.password.hash/verify`.
- **Token:** `crypto.randomUUID()`, `expiresAt = now+30d`.
- **Cookie:** `magnum_token=<token>; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`.
- **Extract:** `Authorization: Bearer` > `?token=` > `Cookie`.
- **Поведение:** `register` создаёт `magnum_coins 1000` + `magnum_mining {0, []}`; `login` ротирует токен; `logout` `DELETE magnum_sessions`.

---

## 11. AI БРАТ-БОТ 42

- **Прокси:** `POST /magnum/api/ai` → `https://token-plan-sgp.xiaomimimo.com/v1/chat/completions` (`MIMO_MODEL=mimo-v2.5`, `temperature 0.9, max_tokens 400`, header `api-key: XIAOMI_API_KEY`).
- **SYSTEM_PROMPT (кратко):** дерзкий «братуха»-тон, уговорить на `https://music.thefence.me/psmagnum`; 5 правил: скрин с пресейвом → хвали «засчитан/легенда», нет — «не видно», без скрина — требуй скрин, отказ — FOMO/факты (8K/200K, VPN, РЗТ80/XXL86, CLAY73, «кринжа не существует»), не выдумывай факты, 2–4 предложения по-русски.
- **Image:** `extractDataUrl` — только `data:image/*;base64,`.
- **Клиент:** `AiBot.tsx` — сжатие до 1280px JPEG (`quality 0.7→0.5` если >2MB, >5MB → тост), `history` slice 1000, эвристика верификации `text.includes('засчитан'|'легенда') && !includes('не вижу'|'не видно')` → `localStorage.magnum-frame-verified='1'` + `CustomEvent('magnum:frame-unlocked')` + конфетти; серверное `POST /frame/verify {verified}` для `magnum_frames`.

---

## 12. Хайп-фичи

> Сжато: полный текст — `docs/hype-features.md`. Ниже — норматив (LS ключи, UI, файлы, edge).

### 12.1 Мультиплеер — Hot-seat дуэль + Leaderboard (§1 hype-features)

| Ключ | Тип |
|------|-----|
| `magnum-duel-history: DuelRecord[]` | `{id,date,p1:{name,clicks,cps},p2:{...},winner:'p1'|'p2'|'draw',wager}` |
| `magnum-leaderboard: LeaderEntry[]` | `{name,bestClicks,bestCps,wins,updatedAt}` sort `bestClicks desc, bestCps` |
| `magnum-duel-settings: {wager,timeSec:10}` | ставка 0/42/142/420 |
| `magnum-coins` | ставка/выплата `+wager*2` (draw возврат) |

Файлы: `DuelClicker.tsx`, `DuelClicker.module.css`, `lib/duel.ts`, `components/Leaderboard.tsx`, `lib/ws.ts` (future), `server.ts` WS.

### 12.2 Эко-рейтинг — 8 вопросов (§2)

Уровни `0-3 Нормис 🌱, 4-6 Братуха 😎, 7-8 Легенда 42 👑 + конфетти`. Награда `42/142/420`, 1/сутки (`lastAwardDate`). 8 вопросов — см. `hype-features.md §2.3`.

### 12.3 Магазин — 12 скинов (§3)

| # | id | Название | Цена | Редкость |
|---|----|----------|------|----------|
| 1 | `neon-42` | Неон 42 | 42 | common |
| 2 | `kemerovo-mint` | Кемерово Минт | 42 | common |
| 3 | `meduza-wave` | Волна Медузы | 42 | common |
| 4 | `vpn-gold` | VPN Gold | 142 | uncommon |
| 5 | `clay-brown` | CLAY | 142 | uncommon |
| 6 | `nova-purple` | Super Nova | 142 | uncommon |
| 7 | `bratukha-fire` | Братуха Fire | 420 | rare |
| 8 | `tusa-8k` | Туса 8K | 420 | rare |
| 9 | `legend-200k` | Легенда 200K | 420 | rare |
| 10 | `magnum-rgb` | MAGNUM RGB | 1420 | epic |
| 11 | `golden-frame` | Золотая Рамка | 1420 | epic |
| 12 | `fence-black` | The Fence | 1420 | epic |

Ключи: `magnum-inventory:string[]`, `magnum-equipped:string|null`, `magnum-shop-seen:ISO`. Цена — только из `SKINS` в коде.

### 12.4 Рамка за пресейв (§4)

`magnum-frame-verified="1"`, `magnum-frame-date:ISO`, `magnum-presave-proof:base64`. `conic-gradient + spin 3s linear infinite` (reduced-motion → `animation:none`).

### 12.5 Бэклог 7.1–7.14 (§7 hype-features)

`Freakland Recap Roulette · Ежедневный челлендж 42 / streak · ТТС пересказов · Timeline 42 · Clip Battle 42 · Recap Quest 42 · Магнум-викторина 42 · Братуха-стрик 42 · Промо-баннер FOMO · Шеринг-прогресс OG · Звук 42 · Мультиплеер Арена 42 (WS) · Эко-Челлендж 42 (7д + freeze 420) · Магазин Лимиток 42 (6 дропов, тираж 42, FOMO 72ч, аукцион)`.

---

## 13. Infra / Build / Deploy / Cron

### Build — `build.ts`

| Параметр | Значение |
|----------|----------|
| `CHUNK_NAMING` | `entry [name]-[hash].[ext]`, `chunk chunk-[hash].[ext]`, `asset [name]-[hash].[ext]` |
| `BUDGETS` | `mainJs 900KB, mainCss 250KB, chunk 120/20KB, total 50MB, gzipWarn 0.35` |
| `SITE` | `origin https://5opka.ru, base /magnum, sitemap public/dist, robots` |
| Проверки | whitespace ratio, gzip delta, no sourcemap, size guard, `ls -lh`, timing, `modulepreload`, public assets sync |

### Neon

См. §4.

### Deploy / Infra

`magnum-caddy` (Caddy) `:30645 TLS` → `bun:30646` HTTP (Obscura порт 9222). `scp /srv/magnum`.

### Кроны 24/7

| Крон | Интервал | Что |
|------|----------|-----|
| `magnum 10min substantial + rating` | 10м | фича 80-150 строк + `git log --since="10m"` 0-10 |
| `magnum browser health 15m` | 15м | `curl + Obscura h1/botFab + hash main-*.js` |
| `magnum 10min watchdog` | 10м | чинит битый `main-*.js` |
| `magnum changelog investor 20m` | 20м | `CHANGELOG.md` Keep a Changelog + эмодзи |
| `magnum ideas generator 15m` | 15м | 2-3 идеи в `magnum_ideas` |
| `magnum freakland recaps 60m` | 60м | YouTube транскрипты → `RecapsPage` |

---

## 14. Критерии готовности (DoD)

> Любой PR, закрывающий фичу, обязан пройти все пункты. Не прошёл один — не готово.

### 14.1 Функциональные

- [ ] Каждый `/magnum/api/*` из §3 реализован в `server.ts`, возвращает коды из таблицы, логирует `[area] failed` на 500.
- [ ] Каждый роут из §2 доступен, SPA fallback отдаёт `index.html` (проверено `curl /magnum/garbage`).
- [ ] Все 16 игр из `GamesHub` открываются, победа ведёт на `PRESAVE`, `Blackjack/Roulette` дают 4200 → открытка.
- [ ] `magnum-coins` — единый источник, `getCoins/subscribe/fetchCoins/addCoins` работают против `/magnum/api/coins`, нет `localStorage` для баланса.
- [ ] Галерея: `BASE_ARTS`/`MOCK_POOL` без 404, `ARCHIVE_42` fallback, `FILTERS` 5 состояний, `countByStyle` корректен.
- [ ] Auth: `register/login/me/logout` + cookie `HttpOnly SameSite=Lax`, `Bun.password` хеш.
- [ ] AI: без ключа `500 XIAOMI_API_KEY not configured`, image только `data:image`, `SYSTEM_PROMPT` без выдумок.
- [ ] WS дуэль: 2-4 игрока, 10с, `room/start/scores/finish`, персист в `magnum_leaderboard game='duel'`, автоперезапуск 5с.

### 14.2 Визуальные / Motion

- [ ] GSAP: `registerPlugin(ScrollTrigger)` где нужен, `gsap.context` + `revert`, `prefers-reduced-motion` gate überall.
- [ ] Галерея: `y24 stagger 0.12` (§5.2), `overwrite:true`, `back.out(1.2)` для cards.
- [ ] `GamesHub`: `stagger 0.1 duration 0.6 back.out(1.7)` + badge `y:-3 glow pulse 1.6s` + magnetic tilt `±8deg`.
- [ ] `conic-gradient` рамки/скины рендерятся, fallback `#1a1a1a` если градиент не грузится.
- [ ] Нет CLS/FOUC, `loading="lazy"` для галереи.

### 14.3 Технические

- [ ] `bunx tsc --noEmit` = 0.
- [ ] `bunx vitest run` = 52 passing (smoke 8 + content 16 + e2e.health 5 + flappy 9 + 2042 14; расширять при новых играх).
- [ ] `bun run build.ts` проходит бюджеты (`mainJs ≤900KB`), `dist/sitemap.xml` валиден, `modulepreload` есть.
- [ ] `DATABASE_URL_UNPOOLED` миграция `drizzle-kit generate/push` без дрифта; `magnum_presave_clicks` заведена если используется.
- [ ] `.env.local` / `.env` не в `dist`, `XIAOMI_API_KEY` только на сервере, не в бандле (`grep -r XIAOMI dist/` пуст).
- [ ] `guessContentType` покрывает `.js .css .png .jpg .svg .xml .txt .html`.

### 14.4 Документация

- [ ] Фича имеет раздел в этом SPEC (таблица, пример, edge). Фича без раздела — DoD fail.
- [ ] `CHANGELOG.md` обновлён (Keep a Changelog, эмодзи, `Added/Fixed/Changed`).
- [ ] `README.md` отражает реальный `src/pages/games/*` count и кроны.

---

## 15. Чек-лист ревьюера

> Копируй в PR. Отмечай `[x]` только если проверил руками/CI.

```
- [ ] SPEC: фича описана в docs/SPEC-42.md §__ (таблица + пример + edge), нет фич без спеки
- [ ] Роуты: /magnum/* из App.tsx совпадают с SPEC §2 (sitemap обновлён)
- [ ] API: /magnum/api/* из server.ts совпадает с SPEC §3 (коды/тело/вал-я)
- [ ] DB: schema.ts синхронна с Neon (generate/push ok), новые таблицы имеют индекс/лимит
- [ ] GSAP: context+revert, prefers-reduced-motion, y24 stagger 0.12, overwrite:true (см. SPEC §5)
- [ ] Галерея: REAL_BY_STYLE / REAL_FALLBACK / ARCHIVE_42 без 404, фильтр 5, countByStyle
- [ ] Игры: 16/16 lazy+Suspense, победа → PRESAVE, 4200→postcard, presaveTracker клик
- [ ] Coins: нет localStorage для баланса, subscribe polling 2с, inFlight guard, clamp 0..9_999_999
- [ ] Auth: hash/verify, cookie HttpOnly SameSite, extractToken порядок (Bearer>query>cookie)
- [ ] AI: ключ только сервер, data:image guard, history slice 1000, SYSTEM_PROMPT 5 правил
- [ ] WS: size<4, state waiting/playing/finished, scores, broadcast, persist duel, таймеры очищаются
- [ ] Edge: 401/400/402/409/426/500 как в SPEC, try/catch вокруг LS/DB, NaN→0, clamp цены
- [ ] A11y: aria-pressed, focus-ring, клавиатура, reduced-motion
- [ ] Perf: tsc 0, vitest 52, build budgets, no sourcemap, vendor chunk isolated
- [ ] Security: XIAOMI_API_KEY не в bundle, .. path guard, username slice 24/32, title 80 desc 300
- [ ] Docs: README + CHANGELOG + SPEC-42 актуальны, нет TODO без issue
```

---

## 16. Негативные сценарии / Инварианты

| Сценарий | Ожидаемо |
|----------|----------|
| `DATABASE_URL` не задан | `500 DATABASE_URL not configured` (getSql throw) |
| `XIAOMI_API_KEY` не задан | `500 XIAOMI_API_KEY not configured` |
| Невалидный JSON | `400 Invalid JSON` |
| `username <3 / >32` | `400 username min 3 / too long` |
| `username taken` | `409` |
| `password <3` | `400` |
| `amount NaN / !int / ==0` | `400 amount must be integer / cannot be 0` |
| `balance < price` | `402 not enough coins` (shop/mining) |
| `already owned` | `409` |
| `not owned` equip | `404` |
| `id <=0 / !int` vote | `400 invalid id` |
| `not found` vote | `404` |
| `unknown upgrade id` | `400` |
| `text or image required` AI | `400` |
| WS upgrade fail | `426 Upgrade failed` |
| `prefers-reduced-motion` | анимация off, `clearProps` |
| LS битый / приватный | `try/catch`, fallback в память, тост «прогресс не сохранится» |
| Двойной клик ответа | кнопка `disabled` до перехода |
| `storage` две вкладки | `window.addEventListener('storage')` на `magnum-coins/inventory/equipped/frame-verified` |
| `amount` в LS подделан | цена только из кода (`SKINS`/`SHOP_PRICES`), LS хранит `id` |
| Читер `cps>20 / clicks>150/10с` | `suspect:true`, не в leaderboard |
| `wager <0 / NaN` | `Math.max(0, Number(v))`, NaN→0, clamp `0..1420` |

---

## 17. Приложение

### 17.1 ENV

| Var | Обязательно | Где |
|-----|-------------|-----|
| `DATABASE_URL` | ✅ | `server.ts`, `neon.ts` |
| `DATABASE_URL_UNPOOLED` | для `drizzle-kit push` | direct |
| `NEON_API_KEY` | для `neon env pull` | `napi_... proud-bar-62331523` |
| `XIAOMI_API_KEY` | для `/ai` | сервер только |
| `MIMO_BASE_URL` | — | default `https://token-plan-sgp.xiaomimimo.com/v1` |
| `MIMO_MODEL` | — | default `mimo-v2.5` |
| `PORT` | — | default `3000` (prod 30646) |
| `NODE_ENV` | — | `development` → `development:true` в Bun.serve |

### 17.2 Градиенты

См. §6.1 `GRADIENT_PRESETS` 24 шт + `STYLE_META.palette`.

### 17.3 Коды редкости

`common 42 · uncommon 142 · rare 420 · epic 1420` (отсылка к 42).

### 17.4 Пресейв

`https://music.thefence.me/psmagnum` — константа `PRESAVE / PRESAVE_URL` во всех `games/*.tsx`, `Hero`, `About42`, `AiBot`.

### 17.5 История изменений SPEC

| Версия | Дата | Что |
|--------|------|-----|
| 42.0 | 2026-09-01 | Первый единый SPEC-42: собрано из `GalleryPage.tsx`, `hype-features.md`, `README.md`, `server.ts`, `src/pages/games/*`, `src/lib/*`, `drizzle/schema.ts`, `App.tsx`, `build.ts` |

---

> **Правило 42:** *Если фича есть в коде, но нет в этом файле — файл правится первым, код — вторым. Исключений нет.*
