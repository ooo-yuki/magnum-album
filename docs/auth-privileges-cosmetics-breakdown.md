# MAGNUM — Разбор системы аккаунтов, привилегий и косметики

> Актуально для сборки от `2026-09-01`.  
> Источники: `server.ts`, `src/lib/authMe.ts`, `src/lib/cosmetics.ts`, `src/lib/coins.ts`, `src/lib/pass42.ts`, `src/components/AuthStatus.tsx`, `drizzle/schema.ts`.

---

## 1. Краткая сводка

Проект использует **собственную (custom) auth-систему**, не связанную с Neon Auth / OAuth. Пользователь регистрируется по `username + password`, получает HTTP-only cookie `magnum_token`, и далее этот токен используется во всех защищённых ручках.

Поверх аккаунтов построены три экономических/игровых слоя:

| Слой | Где живёт | Назначение |
|------|-----------|------------|
| **Аккаунт** | `magnum_users`, `magnum_sessions` | Идентификация, сессии |
| **Валюта** | `magnum_coins`, `magnum_dust` | Основная и премиальная валюты |
| **Косметика** | `magnum_cosmetics`, `magnum_shop_inventory` | Рамки, баннеры, титулы, аватары-скины |
| **Привилегии** | `magnum_subscriptions`, `magnum_frames` | VIP/Pro-статус и verified-статус |
| **Battle Pass** | `magnum_pass_xp` (логика в `pass42.ts`) | 42 уровня, free + premium награды |

---

## 2. Модель аккаунта

### 2.1 Таблицы

```ts
// drizzle/schema.ts
magnumUsers: id, username, password_hash, created_at
magnumSessions: token (PK), user_id, expires_at
```

- Пароль хешируется `Bun.password.hash(password)` и проверяется `Bun.password.verify(password, hash)`.
- Сессионный токен — UUID, живёт **30 дней**.
- Cookie: `magnum_token=<uuid>; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`.
- Токен передаётся либо через cookie, либо через `Authorization: Bearer <token>`, либо через query `?token=`.

### 2.2 Валидация имени

- Приводится к нижнему регистру.
- Разрешены только `[a-z0-9_]`.
- Длина 3–32 символа.
- Зарезервированные имена: `admin`, `support`, `magnum`, `system`, `moderator`, `bot`.
- Пароль минимум **8 символов** (в UI написано «3+», но сервер режет < 8).

---

## 3. Поток аутентификации

### 3.1 Регистрация

`POST /magnum/api/auth/register`

```ts
body = { username, password, referralCode? }
```

Что происходит на сервере:
1. Rate-limit: 5 регистраций/мин с IP.
2. Проверка username/password.
3. `INSERT INTO magnum_users (username, password_hash)`.
4. Создаётся кошелёк с **1000** монет (`magnum_coins`).
5. Создаётся mining-аккаунт (`magnum_mining`).
6. Автоматически создаётся первая daily-claim запись (+42 монеты, streak = 1).
7. Генерируется токен и сессия.
8. Если передан `referralCode`, оба участника получают +42.

### 3.2 Логин

`POST /magnum/api/auth/login`

- Rate-limit: 8 попыток/мин с IP и 5 попыток/15 мин для конкретного username.
- При успехе создаётся новая сессия и cookie.

### 3.3 Me / Logout

- `GET /magnum/api/auth/me` → `{ user: { id, username } }` или 401.
- `POST /magnum/api/auth/logout` → удаляет сессию и сбрасывает cookie.

---

## 4. Клиентская часть аутентификации

### 4.1 `src/lib/authMe.ts`

Единый кэш текущего пользователя:

```ts
export type MeUser = { id: number; username: string } | null;

export function fetchMe(force = false): Promise<MeUser>
export function invalidateMe(): void
export function peekMe(): MeUser | undefined
export function subscribeMe(onChange: (u: MeUser) => void): () => void
```

Особенности:
- **Дедупликация**: параллельные вызовы `fetchMe` разделяют один in-flight Promise.
- **401 ≠ сетевая ошибка**: 401 означает «точно гость», сетевая ошибка бросает исключение, чтобы UI не разлогинивал пользователя на ровном месте.
- Событие `magnum:auth` заставляет всех подписчиков перезапросить `me`.

### 4.2 `src/components/AuthStatus.tsx`

- Отображает либо кнопки **Войти / Регистрация / ⚡ 1 клик**, либо `@username` с тиром.
- Модалка логина/регистрации с полями username, password, bratCode (при регистрации).
- **Quick-register**: генерирует `brat-xxxx` + случайный пароль, регистрирует и логинит автоматически.
- После входа дёргает `refreshTier()` — запрос `GET /magnum/api/shop/subscriptions`.
- При наличии `tier` добавляет glow-эффект: `vip` → золотой, `vip+` → ещё более золотой, `pro` → свой стиль.
- Показывает daily-стрик попап, если `canClaim`.

---

## 5. Валютная система

### 5.1 Основная валюта — монеты

```ts
// src/lib/coins.ts
export const START_COINS = 1000;
export const MAX_COINS  = 9_999_999;
export const MIN_COINS  = 0;
export const DAILY_BONUS = 42;
```

Клиентский слой:
- `getCoins()` — синхронное чтение из кэша.
- `fetchCoins()` — запрос на сервер.
- `addCoins(n)` — POST `/magnum/api/coins/add`.
- `setCoins(n)` — POST `/magnum/api/coins/set` (fallback на delta).
- `subscribe(cb)` — подписка на изменения + polling каждые **2 секунды**.

### 5.2 Серверные ручки монет

- `GET /magnum/api/coins` — баланс.
- `POST /magnum/api/coins/add` — начислить/списать целое число (ограничение ±10 000 за раз).
- `GET /magnum/api/coins/top` — топ-20 по балансу.

### 5.3 Премиальная валюта — dust

- Хранится в `magnum_dust(balance)`.
- Используется в гаче/крафте (см. `src/lib/gacha.ts`, `src/lib/spinRewards.ts`).

### 5.4 Транзакции

Все операции с монетами пишутся в `magnum_transactions(user_id, amount, reason, meta)`.

---

## 6. Система косметики

### 6.1 Слоты

Косметика разделена на три слота:

| Слот | Описание | Пример |
|------|----------|--------|
| `frame` | Рамка аватара | `frame-neon42`, `frame-gold` |
| `banner` | Фоновый баннер | `banner-magnum`, `banner-glitch` |
| `title` | Титул под ником | `title-bra`, `title-vip` |

### 6.2 Каталог

Источник правды — `src/lib/cosmetics.ts` (используется и на клиенте, и в `server.ts` через импорт).

Редкости и базовые цены:

| Редкость | Цена |
|----------|------|
| common   | 42   |
| rare     | 142  |
| epic     | 420  |
| legendary| 1420 |

### 6.3 Наборы (vaults)

В каталоге заложены тематические сеты по 12 предметов каждый:

| Набор | Префикс id | Особенность |
|-------|------------|-------------|
| **PRISM** | `frame-prism-*`, `banner-prism-*`, `title-prism-*` | Конические градиенты |
| **GLACIER** | `frame-glacier-*`, `banner-snow-*`, `title-ice-*` | Ледяная тема |
| **CRYSTAL** | `frame-crystal-*`, `banner-*quartz`, `title-*crystal` | Кристаллы |
| **VOLCANO GOLD** | `frame-volcano-*`, `banner-volcano-*` | Огонь, `#ff5722` |
| **OBSIDIAN FORGE** | `frame-obsidian-*`, `banner-obsidian-*` | Тёмная кузня |
| **SKIN FORGE** | `frame-forge-*`, `banner-forge-*` | Холо-эффекты |
| **MAGMA** | `frame-magma-*` | Аналог вулкана |

Каждый набор экспортирует константы `*_CATALOG`, `*_IDS`, `*_IDS_SET` и guard-функцию `is*Cosmetic(id)`.

### 6.4 «Скины» vs «Косметика»

В проекте есть два параллельных понятия, которые часто путаются:

| Термин | Где | Что это |
|--------|-----|---------|
| **Skins** (`magnum_shop_inventory.skin_id`) | Эмодзи-аватары из `src/lib/economy.ts` | `mops`, `rhino`, `tiger`, `dragon` и т.д. |
| **Cosmetics** (`magnum_cosmetics.cosmetic_id`) | Рамки/баннеры/титулы из `src/lib/cosmetics.ts` | `frame-*`, `banner-*`, `title-*` |

Некоторые старые компоненты используют `skin_id` как equipped-avatar, а новые — косметические слоты.

### 6.5 API косметики

| Метод | Ручка | Описание |
|-------|-------|----------|
| GET   | `/magnum/api/shop/cosmetics/catalog`   | Полный каталог |
| GET   | `/magnum/api/shop/cosmetics/inventory` | Инвентарь пользователя |
| POST  | `/magnum/api/shop/cosmetics/buy`       | Покупка |
| POST  | `/magnum/api/shop/cosmetics/equip`     | Надеть/снять |

### 6.6 Покупка косметики

Логика `handleCosmeticBuy`:
1. Валидация id (`^[a-z0-9-]{2,64}$`).
2. Определение цены и слота из `COSMETICS_CATALOG`.
3. **TOCTOU-защита**: используется транзакция с `FOR UPDATE` строки `magnum_coins`.
4. Скидка **−42** для **verified** пользователей раз в 7 дней (проверка по `magnum_transactions.reason='cosmetic_discount'`).
5. Списание баланса + запись в `magnum_cosmetics`.
6. Fallback-ветка без транзакции, если нет `DATABASE_URL_UNPOOLED`.

### 6.7 Экипировка

- Можно надеть только купленный предмет.
- При экипировке автоматически снимается предыдущий предмет того же слота (`UPDATE ... SET equipped=false WHERE user_id=$1 AND slot=$2`).

### 6.8 Бандлы

`SHOP_BUNDLES` в `server.ts` — 8 наборов из скинов + косметики со скидкой.

Пример:

```ts
{
  id: "bundle-dragon",
  items: ["dragon", "frame-dragon", "title-god"],
  slots: ["skin", "frame", "title"],
  price: 5200,
  origPrice: 6082
}
```

- `POST /magnum/api/shop/bundles/buy` списывает цену и добавляет каждый item.
- Уже купленные предметы пропускаются (`skipped`), цена не пересчитывается.

---

## 7. Привилегии и подписки

### 7.1 Таблица

```ts
magnumSubscriptions: id, user_id, tier, started_at, ends_at
```

### 7.2 Тиры

В UI (`AuthStatus.tsx`) отображаются три тира:

| Тир | Источник | Визуальный эффект |
|-----|----------|-------------------|
| `vip`  | `magnum_subscriptions.tier = 'vip'` | Золотой glow |
| `vip+` | `magnum_subscriptions.tier = 'vip+'` | Более яркий glow |
| `pro`  | `magnum_subscriptions.tier = 'pro'` | Отдельный стиль |

Проверка: `GET /magnum/api/shop/subscriptions` возвращает последнюю активную подписку, где `ends_at IS NULL OR ends_at > now()`.

### 7.3 Battle Pass как источник «премиум»

`src/lib/pass42.ts` определяет 42 уровня пропуска:

- `XP_PER_LEVEL = 42`, `MAX_LEVEL = 42`.
- Каждый уровень имеет **free** и **premium** награду.
- Premium-награды включают скины (`skinId`), кейсы (`keyId`), dust и монеты.
- В коде есть комментарий: *«premium track opens VIP»*, но фактически покупка premium-pass не создаёт запись в `magnum_subscriptions` напрямую.

### 7.4 Backfill tier из косметики

В `server.ts` есть служебная функция `backfillSubscriptionsFromCosmetics()`:

- `title-god` → `pro`
- любой `*prism*` cosmetic → `vip+`
- `title-vip` → `vip`

Это означает, что тир может быть **derived** не только из таблицы подписок, но и из владения определёнными титулами.

### 7.5 Verified-статус (`magnum_frames`)

Таблица `magnum_frames` используется для «верификации» пользователя (free verified-рамка и скидка −42 на косметику).

- `POST /magnum/api/frame/verify` — ставит `verified=true` и дату.
- `GET /magnum/api/frame/status` — возвращает историю и `tier: verified > 0 ? 'neon-gold' : 'none'`.
- Verified-статус проверяется при покупке косметики для скидки.

---

## 8. Экономический цикл (от регистрации до траты)

```
Регистрация
    │
    ▼
magnum_users + magnum_sessions
    │
    ▼
magnum_coins.balance = 1000
    │
    ├── Daily claim ─────► +42 … +294 (streak 7)
    ├── Игры / eco / mining ─────► +coins
    ├── Реферальный код ─────► +42 обоим
    │
    ▼
Покупка в магазине
    │
    ├── magnum_shop_inventory (скины-аватары)
    ├── magnum_cosmetics    (рамки/баннеры/титулы)
    ├── magnum_subscriptions (VIP/Pro)
    └── magnum_transactions  (audit-log)
```

---

## 9. Потенциальные проблемы и несоответствия

### 9.1 Дублирование источников правды

- `COSMETICS_CATALOG` определён и в `src/lib/cosmetics.ts`, и полностью скопирован в `server.ts`.
- `SHOP_CATALOG`/`SHOP_ITEMS` в `src/lib/economy.ts` частично дублируют `cosmetics.ts`.
- `RARITY_PRICE` в `economy.ts` и цены в `cosmetics.ts` синхронизированы вручную.

**Риск**: изменение цены в одном месте приведёт к рассинхрону между UI и сервером.

### 9.2 Пароли: UI vs сервер

- UI пишет «пароль минимум 3 символа», сервер требует **8**.
- При длинном пароле пользователь получит `400` без понятного объяснения.

### 9.3 Race conditions

- `handleShopBuy` не использует `FOR UPDATE` транзакцию (в отличие от `handleCosmeticBuy`).
- При быстром двойном клике можно потратить монеты дважды или купить дубликат.

### 9.4 `@ts-nocheck` в `coins.ts`

Файл `src/lib/coins.ts` содержит `@ts-nocheck` и много сгенерированных helper-функций (`validateTx1…validateTxN`, `coinMetric1…coinMetricN`). Это снижает типобезопасность кошелька.

### 9.5 Tier derived from cosmetics ≠ подписка

- `AuthStatus.tsx` запрашивает tier через `/magnum/api/shop/subscriptions`, который смотрит только `magnum_subscriptions`.
- `backfillSubscriptionsFromCosmetics` может добавить запись, но это не основной поток.
- Покупка `bundle-void` с `title-vip` не даёт записи в `magnum_subscriptions` автоматически — только косметический предмет.

### 9.6 Отсутствие реальных платежей

Вся экономика работает на внутриигровых монетах. Подписки (`magnum_subscriptions`) в текущем коде создаются, по-видимому, вручную или через админ-ручки, а не через платёжный шлюз.

### 9.7 Скидка verified

Скидка −42 применяется **раз в 7 дней** и записывается как `cosmetic_discount`. Это не привязано к tier, только к `magnum_frames.verified`.

---

## 10. Отображение косметики в публичных рейтингах

### 10.1 Текущая картина

В публичных leaderboard’ах пользователи **не отображаются с косметикой** (`frame` / `banner` / `title`). С сервера отдаётся только:

- `username`
- `avatar` — equipped скин-аватар из `magnum_shop_inventory.skin_id` (эмодзи)
- `verified` — флаг из `magnum_frames`

Косметика используется только в персональном UI (`AuthStatus`, `ShopPage`, `VipActivatedPopup`, `AiBot`, `ShareCard`).

### 10.2 SQL всех leaderboard’ов

| Рейтинг | Ручка | Что join’ится | Есть `magnum_cosmetics`? |
|---------|-------|---------------|--------------------------|
| Топ по монетам | `GET /magnum/api/coins/top` | `magnum_shop_inventory` (avatar) + `magnum_frames` (verified) | ❌ Нет |
| Эко-лидерборд | `GET /magnum/api/eco/leaderboard` | `magnum_shop_inventory` + `magnum_frames` | ❌ Нет |
| Эко-рейтинг топ | `GET /magnum/api/eco/rating/top` | `magnum_shop_inventory` (avatar) | ❌ Нет |
| Топ по играм | `GET /magnum/api/games/:game/top` | `magnum_shop_inventory` (avatar) | ❌ Нет |
| Майнинг топ | `GET /magnum/api/mining/top` | `magnum_shop_inventory` (avatar) | ❌ Нет |
| Чат / подписки | `GET /magnum/api/chat/*`, `follows` | `magnum_shop_inventory` (avatar) | ❌ Нет |
| Пресейв-рейтинг | `PresaveRatingPage.tsx` | `frame/status` → `verified` + `skinId` | ❌ Нет |

Примеры запросов из `server.ts`:

```sql
-- coins top
SELECT u.username, c.balance, s.skin_id as avatar, COALESCE(f.verified,false) as verified
FROM magnum_coins c
JOIN magnum_users u ON u.id=c.user_id
LEFT JOIN magnum_shop_inventory s ON s.user_id=c.user_id AND s.equipped=true
LEFT JOIN magnum_frames f ON f.user_id=c.user_id
ORDER BY c.balance DESC LIMIT 20;

-- eco leaderboard
SELECT COALESCE(u.username, r.player, 'Братуха') as player, r.score, r.rank, r.created_at,
       s.skin_id as avatar, COALESCE(f.verified,false) as verified
FROM magnum_eco_results r
LEFT JOIN magnum_users u ON u.id = r.user_id
LEFT JOIN magnum_shop_inventory s ON s.user_id = r.user_id AND s.equipped = true
LEFT JOIN magnum_frames f ON f.user_id = r.user_id
ORDER BY r.score DESC, r.created_at ASC LIMIT 50;

-- game scores top
SELECT g.game, g.score, g.created_at, u.username, s.skin_id as avatar
FROM magnum_game_scores g
JOIN magnum_users u ON u.id=g.user_id
LEFT JOIN magnum_shop_inventory s ON s.user_id=g.user_id AND s.equipped=true
ORDER BY g.score DESC, g.created_at ASC LIMIT ${limit};

-- mining top
SELECT u.username, m.balance, m.upgrades, s.skin_id as avatar
FROM magnum_mining m
JOIN magnum_users u ON u.id=m.user_id
LEFT JOIN magnum_shop_inventory s ON s.user_id=m.user_id AND s.equipped=true
ORDER BY m.balance DESC LIMIT 20;
```

### 10.3 Почему это важно

Пользователи покупают косметику (особенно легендарные рамки и титулы), но в публичных топах она **не видна**. Единственный способ «показать статус" — `verified`-рамка, но она не связана с косметическим каталогом.

### 10.4 Как включить косметику в рейтинги

Нужно:

1. Добавить `LEFT JOIN` equipped-косметики в leaderboard-запросы.
2. Сгруппировать косметику по слотам на сервере.
3. Передать `frame`, `banner`, `title` в клиент.
4. Отрендерить их в строках/карточках рейтинга.

Пример SQL для топа по монетам:

```sql
SELECT
  u.username,
  c.balance,
  s.skin_id as avatar,
  COALESCE(f.verified, false) as verified,
  MAX(CASE WHEN mc.slot = 'frame' AND mc.equipped = true THEN mc.cosmetic_id END) as frame,
  MAX(CASE WHEN mc.slot = 'banner' AND mc.equipped = true THEN mc.cosmetic_id END) as banner,
  MAX(CASE WHEN mc.slot = 'title' AND mc.equipped = true THEN mc.cosmetic_id END) as title
FROM magnum_coins c
JOIN magnum_users u ON u.id = c.user_id
LEFT JOIN magnum_shop_inventory s ON s.user_id = c.user_id AND s.equipped = true
LEFT JOIN magnum_frames f ON f.user_id = c.user_id
LEFT JOIN magnum_cosmetics mc ON mc.user_id = c.user_id AND mc.equipped = true
GROUP BY u.username, c.balance, s.skin_id, f.verified
ORDER BY c.balance DESC
LIMIT 20;
```

> **Примечание**: если у пользователя может быть несколько equipped-предметов в одном слоте, логика `MAX(...)` выберет один произвольно. На практике в `handleCosmeticEquip` снимается предыдущий предмет того же слота, поэтому equipped в слоте максимум один.

### 10.5 Затронутые клиентские компоненты

Для отображения косметики в топах потребуется обновить:

- `src/pages/EcoPage.tsx` — топ-10 ЭкоЛегенд
- `src/components/DuelCTA.tsx` — дуэльный лидерборд
- `src/components/SocialHook.tsx` — аватарки пресейверов
- `src/pages/PresaveRatingPage.tsx` — рейтинг пресейва
- `src/pages/ArenaPage.tsx` — лидерборд арены
- Компоненты игровых топов (games)

---

## 11. Места, где многопользовательское взаимодействие не использует систему аккаунтов

В приложении есть несколько зон, которые выглядят как PvP, рейтинги или командные фичи, но по факту либо позволяют анонимное участие, либо работают в локальном (hot-seat) режиме, либо не связывают действие с аккаунтом.

### 11.1 Duel Volcano / Magma — hot-seat fallback вместо PvP

Файлы: `src/pages/games/DuelVolcano.tsx`, `src/pages/games/DuelMagma.tsx`, `src/lib/ws.ts`.

- Клиент **не проверяет** наличие `me` перед созданием WebSocket.
- Сервер `/magnum/api/ws` требует авторизацию, поэтому незалогиненный пользователь не проходит upgrade.
- В `DuelSocket.connect()` при ошибке WebSocket устанавливается `this.hotSeat = true`.
- В hot-seat режиме `send()` просто эхом возвращает сообщение через `onMsg`:

```ts
// src/lib/ws.ts
send(m: WSMsg) {
  if (this.hotSeat) { this.onMsg?.(m); return; }
  if (this.ws?.readyState === WebSocket.OPEN) {
    try { this.ws.send(JSON.stringify(m)); } catch {}
  }
}
```

**Итог**: незалогиненный пользователь нажимает «Создать лобби», видит комнату и счёт, но играет **сам с собой**. UI создаёт иллюзию PvP.

### 11.2 Duel Lobby — нет защиты от двух окон одного игрока

Файл: `src/pages/games/DuelLobbyPage.tsx`.

- Здесь `me` проверяется, и без auth не пускает.
- Однако серверный WebSocket-обработчик (`server.ts`, `websocket.message`) не проверяет, что один `user_id` уже есть в комнате.
- Пользователь может открыть два окна/вкладки, подключиться к одной комнате и играть сам с собя, накручивая `wins`.

### 11.3 Eco Rating — анонимные записи в общем рейтинге

Файлы: `server.ts` (`handleEcoRatingSubmit`), `src/pages/EcoPage.tsx`.

`handleEcoRatingSubmit` не требует auth:

```ts
const token = extractToken(req);
let user: { id: number; username: string } | null = null;
if (token) try { user = await getUserByToken(token); } catch {}
// ...
const player = user?.username ?? (typeof body.player === "string" ? body.player.trim().slice(0, 32) : null);
if (!user && (!player || player.length < 2)) return Response.json({ error: "player 2..32 or auth" }, { status: 400 });
```

Аноним может отправить любой `score` с именем и попасть в `magnum_eco_ratings`, которая показывается в `GET /magnum/api/eco/rating`.

| Параметр | Авторизованный | Аноним |
|----------|----------------|--------|
| Запись в топ | Да | Да |
| Бонус монет | Да (`rating >= 7`) | Нет |
| Связь с `user_id` | Да | `NULL` |
| Уникальность имени | По `username` | Никакой |

### 11.4 Eco leaderboard submit — локальный fallback при 401

Файл: `src/pages/EcoPage.tsx` (`handleSaveToBoard`).

- `submitEcoResult()` шлёт `POST /magnum/api/eco/submit`, который требует auth.
- При `401` клиент показывает toast «войди, братуха», но **всё равно добавляет результат в локальный `leaderboard` state**:

```tsx
const ok = await submitEcoResult(entry);
if (!ok) { setToast("Не удалось сохранить — войди, братуха (401)"); }
// ...
const list = await fetchLeaderboard();
if (list.length > 0) setLeaderboard(list);
else setLeaderboard([entry, ...leaderboard].sort((a, b) => b.score - a.score).slice(0, 10));
```

**Итог**: незалогиненный пользователь видит себя в таблице, но на сервере его записи нет.

### 11.5 Presave clicks — анонимный вклад в статистику

Файл: `server.ts` (`handlePresaveClick`).

- `POST /magnum/api/presave/click` **не требует auth**.
- `user_id` может быть `NULL`.
- Все клики участвуют в `handlePresaveLeaderboard`.

```ts
const token = extractToken(req);
let userId: number | null = null;
if (token) { try { const u = await getUserByToken(token); if (u) userId = u.id; } catch {} }
// INSERT INTO magnum_presave_clicks (user_id, url, ip, ...) VALUES (${userId}, ...)
```

Это не обязательно баг, но важно понимать: общая статистика пресейва смешивает анонимов и аккаунты.

### 11.6 Game quiz — прохождение без сохранения

Файл: `src/pages/GamePage.tsx`.

- Квиз можно пройти полностью без авторизации.
- `handleGameSubmit` требует auth, поэтому результат **не сохраняется** и не попадает в топ.
- Это single-player опыт, но он находится в разделе «Игры», рядом с авторизованными играми.

### 11.7 Arena — локальная накрутка стрика

Файл: `src/pages/ArenaPage.tsx`.

- Кнопка `+1 win (стрик)` вызывает `bumpStreak()`, который только локально инкрементит `wins` и `streak`.
- При попытке `claim()` сервер проверяет реальные данные (`magnum_leaderboard`), поэтому накрутка не даст награду.
- Но UI позволяет пользователю видеть фейковый прогресс.

```tsx
const bumpStreak = () => {
  const ns = Math.min(7, streak + 1);
  setStreak(ns);
  setWins(v => v + 1);
  setMsg(`Стрик ${ns}/7 • +1 win — нажми «Забрать +142» на 3-м`);
};
```

### 11.8 Radio 42 / Clip Battle — публичные WebSocket с анонимами

Файл: `server.ts` (upgrade-обработчики).

| Endpoint | Auth? | Поведение |
|----------|-------|-----------|
| `/magnum/api/radio/ws` | Опционально | Аноним получает `anon-${random}` id/username |
| `/magnum/api/clip-battle/ws` | Не требуется | Всегда `clip-anon-${random}` |

Это настоящие публичные каналы, где аккаунт не обязателен. С точки зрения дизайна это нормально, но стоит зафиксировать, что в «социальных» фичах MAGNUM есть и anon-first каналы.

### 11.9 Сводная таблица

| Место | Выглядит как | Auth на сервере | Проблема |
|-------|--------------|-----------------|----------|
| Duel Volcano/Magma | PvP дуэль | WS требует, клиент не блокирует | Hot-seat fallback = single-player |
| Duel lobby | PvP 2–4 | Да | Нет защиты от двух окон одного юзера |
| Eco rating | Общий рейтинг | Нет | Анонимы смешиваются с аккаунтами |
| Eco leaderboard submit | Рейтинг | Да | Локальный fallback при 401 |
| Presave clicks | Статистика/топ | Нет | Анонимные клики участвуют |
| Game quiz | Игра в разделе Games | Для сохранения | Результат без auth теряется |
| Arena | Лидерборд + награды | Для claim | Локальная кнопка `+1 win` обманывает UI |
| Radio 42 | Публичный эфир | Не требуется | Ожидаемо anon-friendly |
| Clip Battle | Публичная лента | Не требуется | Ожидаемо anon-friendly |

### 11.10 Рекомендации

- Для дуэлей: единый gate — не пускать в UI без auth, либо явно показывать «демо-режим».
- Добавить на сервере проверку уникальности `user_id` в комнате (запретить два WS от одного пользователя).
- Для Eco rating: либо требовать auth, либо разделить «анонимный рейтинг» и «рейтинг аккаунтов».
- Для Arena: убрать локальную кнопку `+1 win` или сделать её только визуальной демонстрацией с пометкой «локально».

---

## 12. Чек-лист для дальнейшего аудита

- [ ] Сделать `COSMETICS_CATALOG` и `RARITY_PRICE` единым модулем, импортируемым и на клиент, и на сервер.
- [ ] Добавить транзакции `FOR UPDATE` в `handleShopBuy` и `handleShopBundleBuy`.
- [ ] Унифицировать валидацию пароля (сделать 8 символов и в UI).
- [ ] Убрать `@ts-nocheck` из `coins.ts` и сократить дублирующие helper-функции.
- [ ] Определить, как premium-pass устанавливает `magnum_subscriptions.tier`.
- [ ] Добавить индексы: `magnum_sessions(user_id)`, `magnum_cosmetics(user_id, equipped)`.
- [ ] Рассмотреть разделение «аватар-скинов» и «косметики» в UI, чтобы не путать пользователя.
- [ ] Унифицировать gate для дуэлей: либо требовать auth в UI, либо явно маркировать hot-seat режим.
- [ ] Добавить на сервере проверку уникальности `user_id` в WebSocket-комнате (нет двух окон одного игрока).
- [ ] Пересмотреть `handleEcoRatingSubmit`: либо сделать auth-only, либо отделить анонимный топ от авторизованного.
- [ ] Убрать локальный fallback `leaderboard` в `EcoPage.tsx` при 401 или показывать clear error state.
- [ ] Сделать `GamePage.tsx` quiz либо read-only для гостей, либо явно предлагать логин перед сохранением результата.

---

*Файл подготовлен для команды MAGNUM. Для уточнений смотри исходники по ссылкам в заголовке.*
