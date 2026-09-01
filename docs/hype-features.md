# MAGNUM — HYPE FEATURES SPEC 42

> Промо-сайт альбома **MAGNUM** Пятерки (5opka × 42 братухи). Стиль: дерзкий мемный RGB-неон, братуха-сленг, градиенты, glow.
> Эта дока — **только спека, не код**. 4 фичи для хайпа и удержания. Реализация — после апрува.

---

## 0. Общие конвенции

| Параметр | Значение |
|---|---|
| Стек | React 19 + TS + GSAP 3 + React Router 7 + Bun.serve + Bun.build |
| Базовый путь | `/magnum/` (SPA fallback в `server.ts`) |
| Валюта | `magnum-coins` (единый кошелёк из `src/lib/coins.ts`, старт 1000, миграция из `blackjack42-balance`/`roulette42-balance`) |
| Тон | «братуха», «легенда», RGB, conic-gradient, без мата |
| Факты для пропаганды | ТУСА МЕДУЗА 14.08 — 8K клипов / 200K просмотров · VPN 28.04 в чартах · CLAY 03.04 РЗТ73 · SUPER PUPER NOVA РЗТ80 / XXL86 |
| БРАТ-БОТ | `POST /magnum/api/ai` → `mimo-v2.5` vision, ключ `XIAOMI_API_KEY` только на сервере |

---

## 1. МУЛЬТИПЛЕЕР — HOT-SEAT ДУЭЛЬ КЛИКЕРОВ + LEADERBOARD

### 1.1 Идея

Hot-seat дуэль на одном устройстве: два братухи по очереди жмут 10 сек, кто больше кликов — забирает банк. Лидерборд хранится локально, в будущем — синхронизация через WebSocket.

### 1.2 localStorage ключи

| Ключ | Тип | Описание |
|---|---|---|
| `magnum-duel-history` | `DuelRecord[]` JSON | История дуэлей: `{id, date, p1:{name,clicks,cps}, p2:{...}, winner:'p1'|'p2'|'draw', wager}` |
| `magnum-leaderboard` | `LeaderEntry[]` JSON | Топ-20: `{name, bestClicks, bestCps, wins, updatedAt}` — сортировка по `bestClicks desc`, затем `bestCps` |
| `magnum-duel-settings` | `{wager:number, timeSec:10}` JSON | Ставка из `magnum-coins` и длительность (фиксировано 10с в MVP) |
| `magnum-coins` | `number` string | Существующий кошелёк — списываем/начисляем ставку |

Схема `DuelRecord`:
```ts
type DuelRecord = {
  id: string; // crypto.randomUUID()
  date: string; // ISO
  p1: { name: string; clicks: number; cps: number };
  p2: { name: string; clicks: number; cps: number };
  winner: 'p1'|'p2'|'draw';
  wager: number; // 0 = френдли
}
```

### 1.3 UI блоки

1. **DuelSetup** — два инпута имён (дефолт «Братуха 1/2»), селект ставки (0/42/142/420), кнопка «Погнали!». Если `getCoins() < wager` — дизейбл + подсказка «не хватает монет, сходи в казино».
2. **DuelStage** — полноэкранный кликер: таймер 10с, счётчик, прогресс-бар `width: clicks/нужное%`, `+1` burst (как в `ClickerGame.tsx`), GSAP scale на клик. Между раундами — экран «Передай братухе!» 3-сек обратный отсчёт.
3. **DuelResult** — победитель с конфетти (canvas 160 частиц), `winner ? +wager*2 : 0` через `addCoins()`, кнопки «Реванш» / «В хаб». Draw → возврат ставок.
4. **Leaderboard** — таблица топ-20 из `magnum-leaderboard` + вкладка «История» (последние 20 дуэлей). Пустое состояние: «Пока пусто — стань первым, братуха!».
5. **Badge** в `GamesHub` — «🔥 DUEL» на карточке кликера, RGB-обводка.

### 1.4 Файлы

| Файл | Назначение |
|---|---|
| `src/pages/games/DuelClicker.tsx` | Логика дуэли (state machine: setup → p1 → transit → p2 → result) |
| `src/pages/games/DuelClicker.module.css` | RGB-неон, grid 2 колонки на десктопе, stack на мобилке |
| `src/lib/duel.ts` | Хелперы: `getLeaderboard()`, `pushDuel()`, `upsertLeader()` — чистые функции + try/catch вокруг LS |
| `src/components/Leaderboard.tsx` | Переиспользуемая таблица (проп `entries`) |
| `server.ts` | Будущее: `if (url.pathname === '/magnum/api/ws')` → upgrade to WebSocket (Bun.serve `websocket:{open,message,close}`) |
| `src/lib/ws.ts` (будущее) | Клиент WS: `new WebSocket(wss://.../magnum/api/ws)`, fallback на LS если оффлайн |

### 1.5 Будущий WebSocket в Bun.serve

```ts
// server.ts — заготовка
Bun.serve({
  fetch(req, server) {
    if (req.url.endsWith('/magnum/api/ws') && server.upgrade(req)) return;
    // ... existing /magnum/api/ai + SPA fallback
  },
  websocket: {
    open(ws) { ws.subscribe('lobby'); },
    message(ws, msg) { /* {type:'duel:challenge', wager} → broadcast */ },
    close(ws) { ws.unsubscribe('lobby'); }
  }
});
```
MVP — без сервера (hot-seat + LS). WS — вторым этапом: лобби, `duel:invite`, `duel:result`, валидация на сервере, анти-чит (CPS > 20 → флаг).

### 1.6 Edge cases

- **LS переполнен / приватный режим** — `try/catch`, пишем в память, показываем тост «прогресс не сохранится в этом браузере».
- **Читерский автокликер** — если `cps > 20` или `clicks > 150 за 10с`, помечаем `suspect:true`, не пишем в `magnum-leaderboard`, показываем «братуха, ты робот? 🤖».
- **Ставка > баланса** — блокируем старт, `addCoins(-wager)` только после проверки `getCoins() >= wager`.
- **Перезагрузка mid-duel** — сбрасываем в `setup`, ставки уже списаны → возвращаем через `addCoins(wager)` при `beforeunload` если дуэль не завершена.
- **Два одинаковых имени** — разрешаем, но в leaderboard ключ — `name.toLowerCase().trim()` + дискриминатор.
- **WS недоступен** — тихий fallback на hot-seat, бейдж «offline» в углу, без блокировки игры.
- **Отрицательный wager** — кламп `Math.max(0, Number(v))`, NaN → 0.

---

## 2. ЭКО-РЕЙТИНГ 42 — 8 ВОПРОСОВ, ПРОПАГАНДА КЕМЕРОВО

### 2.1 Идея

Квиз 8 вопросов про экологию Кемерово + лор 42, чтобы братуха узнал про родной Кузбасс и заодно влюбился в MAGNUM. 3 уровня: Нормис → Братуха → Легенда 42.

### 2.2 localStorage ключи

| Ключ | Тип | Описание |
|---|---|---|
| `magnum-eco-quiz` | `{score:number, level:string, answers:number[], date:string, coinsAwarded:number}` JSON | Последний результат |
| `magnum-eco-history` | `{score, level, date}[]` JSON | Последние 10 прохождений для графика прогресса |
| `magnum-coins` | number | Награда: +42 / +142 / +420 в зависимости от уровня (один раз в сутки — см. edge) |

Уровни:
- `0-3` → **Нормис** 🌱 — «братуха, пора прокачаться, читай про Кузбасс»
- `4-6` → **Братуха** 😎 — «уважаю, шаришь за экологию»
- `7-8` → **Легенда 42** 👑 — «ты — легенда Кемерово, MAGNUM гордится» + конфетти

### 2.3 8 вопросов (спека, пропаганда)

1. **Сколько клипов на ТУСУ МЕДУЗА (14.08) на старте?** — 8K (неверно: 200K просмотров — это просмотры, не клипы).
2. **Какая река — главная артерия Кемерово?** — Томь.
3. **Что означает «42» у братух?** — «кринжа не существует, будь собой» (отсылка к движению).
4. **Когда вышел трек VPN?** — 28.04.
5. **Какой РЗТ у CLAY (03.04)?** — 73.
6. **Сколько просмотров у ТУСЫ МЕДУЗА на момент релиза?** — 200K.
7. **Что будет если сортировать мусор в Кемерово?** — меньше свалок на Томи, чище воздух Кузбасса (пропаганда-ответ).
8. **SUPER PUPER NOVA — какой РЗТ и XXL?** — РЗТ80 / XXL86.

Каждый вопрос: 4 варианта, один верный, GSAP stagger появления карточек, подсветка верного зелёным `rgba(0,255,136,0.15)`, неверного — красным, + звук тик (опционально).

### 2.4 UI блоки

1. **EcoIntro** — хиро с градиентом `linear-gradient(135deg,#00ff88,#5865f2)`, счётчик «8 вопросов · 2 мин · до 420 монет», кнопка «Проверить себя».
2. **EcoQuestion** — прогресс `n/8`, карточка вопроса, 4 кнопки-ответа (hover RGB), после выбора — 1с показ верного + факт «А знаешь ли ты…» про Кемерово/MAGNUM.
3. **EcoResult** — бейдж уровня с conic-gradient рамкой, `score/8`, описание уровня, кнопка «Забрать монеты» (`addCoins(reward)`), «Пресейв MAGNUM →» (https://music.thefence.me/psmagnum), шаринг «Я — Легенда 42!».
4. **EcoHistory** — мини-график последних 10 попыток (div-бары, без canvas), в `About42Page` как секция.

### 2.5 Файлы

| Файл | Назначение |
|---|---|
| `src/pages/EcoQuizPage.tsx` | Страница квиза, state `idx/score/answers` |
| `src/pages/EcoQuizPage.module.css` | Карточки, прогресс, бейджи уровней |
| `src/lib/ecoQuiz.ts` | `QUESTIONS: Question[]`, `calcLevel(score)`, `getReward(level)`, `loadEco()`/`saveEco()` |
| `src/components/EcoBadge.tsx` | Бейдж уровня (проп `level`) |
| `public/eco-questions.json` (опционально) | JSON с вопросами для правки без деплоя |

### 2.6 Edge cases

- **Повторное прохождение в тот же день** — монеты даём только 1 раз/сутки: храним `lastAwardDate` в `magnum-eco-quiz`, если `new Date().toDateString() === last`, показываем «уже забрал сегодня, вернись завтра, братуха».
- **LS битый JSON** — `try { JSON.parse } catch → fallback {score:0,level:'Нормис'}` + `localStorage.removeItem` битого ключа.
- **Быстрый клик по ответам** — дизейбл кнопок после первого клика до перехода к следующему вопросу.
- **Награда NaN** — `Number.isFinite(reward) ? reward : 0`, кламп через `addCoins`.
- **Пользователь правит LS руками** — на клиенте не валидируем строго, но `score` клампим `0..8`, `level` пересчитываем из `score`, а не доверяем строке.
- **Нет вопросов** — если `QUESTIONS.length === 0`, показываем «квиз на техобслуживании» + ссылка на пресейв.
- **Доступность** — кнопки с `aria-pressed`, фокус-кольца, `prefers-reduced-motion` отключает GSAP.

---

## 3. МАГАЗИН КОСМЕТИКИ — 12 СКИНОВ, РЕДКОСТИ, ИНВЕНТАРЬ

### 3.1 Идея

Косметический магазин: 12 скинов для аватара/кликера/рамки — только CSS-градиенты + эмодзи, без картинок. Покупка за `magnum-coins`, инвентарь в LS. Редкости привязаны к ценам 42/142/420/1420.

### 3.2 Каталог 12 скинов

| # | id | Название | Эмодзи | Градиент (CSS) | Редкость | Цена |
|---|---|---|---|---|---|---|
| 1 | `neon-42` | Неон 42 | 🟣 | `linear-gradient(135deg,#ff2d55,#5865f2)` | common | 42 |
| 2 | `kemerovo-mint` | Кемерово Минт | 🌿 | `linear-gradient(135deg,#00ff88,#00ccff)` | common | 42 |
| 3 | `meduza-wave` | Волна Медузы | 🪼 | `linear-gradient(135deg,#5865f2,#00ff88)` | common | 42 |
| 4 | `vpn-gold` | VPN Gold | 📡 | `linear-gradient(135deg,#ffcc00,#ff6b00)` | uncommon | 142 |
| 5 | `clay-brown` | CLAY | 🧱 | `linear-gradient(135deg,#8b4513,#ffcc00)` | uncommon | 142 |
| 6 | `nova-purple` | Super Nova | 💜 | `linear-gradient(135deg,#9b59b6,#ff2d55)` | uncommon | 142 |
| 7 | `bratukha-fire` | Братуха Fire | 🔥 | `linear-gradient(135deg,#ff2d55,#ffcc00)` | rare | 420 |
| 8 | `tusa-8k` | Туса 8K | 🎬 | `linear-gradient(135deg,#00ccff,#ff2d55)` | rare | 420 |
| 9 | `legend-200k` | Легенда 200K | 👑 | `conic-gradient(from 0deg,#ffcc00,#ff2d55,#5865f2,#00ff88,#ffcc00)` | rare | 420 |
| 10 | `magnum-rgb` | MAGNUM RGB | 💿 | `conic-gradient(from 180deg,#ff2d55,#ffcc00,#00ff88,#5865f2,#ff2d55)` | epic | 1420 |
| 11 | `golden-frame` | Золотая Рамка | 🖼️ | `conic-gradient(from 0deg,#ffd700,#ff8c00,#ffd700)` | epic | 1420 |
| 12 | `fence-black` | The Fence | 🏴 | `linear-gradient(135deg,#111,#444)` | epic | 1420 |

Редкости: `common 42` · `uncommon 142` · `rare 420` · `epic 1420` — отсылка к 42.

### 3.3 localStorage ключи

| Ключ | Тип | Описание |
|---|---|---|
| `magnum-coins` | number string | Баланс (из `src/lib/coins.ts`) |
| `magnum-inventory` | `string[]` JSON | Массив `id` купленных скинов, например `["neon-42","vpn-gold"]` |
| `magnum-equipped` | `string \| null` JSON | Выбранный скин `id` или `null` (дефолт) |
| `magnum-shop-seen` | `string` ISO date | Когда юзер последний раз открывал шоп (для бейджа «NEW») |

Инварианты: `magnum-inventory` — уникальные `id` из каталога; `magnum-equipped` ∈ inventory или `null`.

### 3.4 UI блоки

1. **ShopGrid** — 12 карточек в `grid 3×4` (мобилка 2×6): превью-градиент + эмодзи 48px + название + бейдж редкости (цвет: common серый, uncommon зелёный, rare фиолет, epic золото) + цена + кнопка «Купить за N» / «Надето ✓» / «Надеть».
2. **ShopBalance** — липкий хедер с `getCoins()` + `subscribe()` live-обновление, кнопка «Как заработать?» → ссылка на `GamesHub`.
3. **ShopPreview** — модалка превью: большой градиент-блок 200px, эмодзи, описание «Братуха, этот скин видели 200K раз на ТУСЕ МЕДУЗА».
4. **InventoryBar** — горизонтальный скролл купленных скинов над гридом, клик → equip.
5. **EquippedEffect** — если `magnum-equipped` выбран, применяем класс к аватару в `NavGrid` / кликеру: `background: <градиент скина>`, `box-shadow: 0 0 20px <цвет>`.

### 3.5 Файлы

| Файл | Назначение |
|---|---|
| `src/pages/ShopPage.tsx` | Существующая страница — расширить гридом скинов |
| `src/pages/ShopPage.module.css` | Карточки, редкости, превью |
| `src/lib/shop.ts` | `SKINS: Skin[]`, `getInventory()`, `buySkin(id)`, `equipSkin(id)`, `canAfford(price)` |
| `src/lib/coins.ts` | Без изменений, используем `getCoins/addCoins/subscribe` |
| `src/components/SkinCard.tsx` | Карточка скина (проп `skin, owned, equipped, onBuy, onEquip`) |
| `src/components/EquippedFrame.tsx` | Обёртка, читает `magnum-equipped` и вешает градиент |

### 3.6 Edge cases

- **Недостаточно монет** — кнопка дизейбл, тултип «нужно ещё X монет», `buySkin` делает `if (getCoins() < price) return {ok:false, reason:'funds'}`.
- **Двойная покупка** — `if (inventory.includes(id)) return {ok:false, reason:'owned'}` + идемпотентность.
- **Подделка цены в LS** — цена берётся только из `SKINS` в коде, LS хранит лишь `id`, не цену.
- **Эквип несуществующего скина** — `if (!inventory.includes(id)) equip = null`, сброс в дефолт.
- **LS quota exceeded** — `try/catch` вокруг `setItem`, тост «не удалось сохранить инвентарь».
- **Градиент не грузится** — fallback `background:#1a1a1a` + эмодзи всё равно видно.
- **Одновременные вкладки** — `window.addEventListener('storage')` на `magnum-inventory`/`magnum-equipped`/`magnum-coins`, синхронизируем стейт.
- **Скин удалён из каталога** — купленные `id` без матча показываем как «[удалён]» серой карточкой, не ломаем грид.

---

## 4. РАМКА ЗА ПРЕСЕЙВ ЧЕРЕЗ БРАТ-БОТА — VERIFIED + CONIC-GRADIENT

### 4.1 Идея

Награда за пресейв: золотая RGB-рамка вокруг аватара/карточек, выдается только если БРАТ-БОТ (mimo-v2.5 vision) подтвердил скрин пресейва. Флаг в LS, рамка — `conic-gradient` + анимация вращения.

### 4.2 localStorage ключи

| Ключ | Тип | Описание |
|---|---|---|
| `magnum-frame-verified` | `"1" \| null` string | Флаг: `"1"` = пресейв подтверждён ботом, иначе `null`/`"0"` |
| `magnum-frame-date` | `string` ISO | Когда выдан — для «verified 01.09.2026» бейджа |
| `magnum-presave-proof` | `string` (base64 превью, опционально) | Сжатый JPEG 256px для показа «твой скрин» (не обязателен, можно не хранить) |

Флаг выставляет только `AiBot.tsx` после успешного ответа бота. Никаких ручных `localStorage.setItem('magnum-frame-verified','1')` в консоли — но если юзер так сделает, это его локальная косметика, сервер не валидирует (MVP).

### 4.3 Поток верификации

```
Юзер жмёт «Пресейв» (https://music.thefence.me/psmagnum) → делает скрин →
открывает БРАТ-БОТА (виджет AiBot) → загружает картинку (сжатие до 1280px JPEG на клиенте) →
POST /magnum/api/ai {text,image,history} → mimo-v2.5 с SYSTEM_PROMPT (правила 1-5) →
если бот ответил «скрин засчитан» (эвристика: текст содержит "засчитан"/"легенда" и не содержит "не вижу"/"не видно") →
frontend: localStorage.setItem('magnum-frame-verified','1'), setItem('magnum-frame-date', new Date().toISOString()) →
тост «🎉 Рамка разблокирована, братуха!» + конфетти
```

Эвристика подтверждения — временная; в будущем бот вернёт `{text, verified:boolean}` с сервера.

### 4.4 UI блоки

1. **FrameBadge** — золотая рамка: `border: 3px solid transparent; background: conic-gradient(from 0deg,#ffd700,#ff8c00,#ffd700,#ffcc00,#ffd700) border-box; animation: spin 3s linear infinite;` + `box-shadow: 0 0 16px rgba(255,215,0,0.6)`. Применяется к аватару в `Layout`/`NavGrid` если `localStorage.getItem('magnum-frame-verified')==='1'`.
2. **FrameLocked** — если не верифицирован: серый `dashed` бордер + замок 🔒 + кнопка «Получить рамку → БРАТ-БОТ».
3. **FrameUnlockModal** — после верификации: «Ты — легенда! Рамка твоя», превью аватара с рамкой, кнопка «Надеть» (по умолчанию надета если verified).
4. **AiBotVerifiedState** — в `AiBot.tsx`: после успеха — зелёная плашка «✓ Пресейв подтверждён», флаг в LS, GSAP вспышка.
5. **PresaveCTA** — везде где был `PRESAVE = "https://music.thefence.me/psmagnum"` добавляем мелкий текст «покажи скрин боту — получи рамку».

### 4.5 Файлы

| Файл | Назначение |
|---|---|
| `src/components/AiBot.tsx` | Добавить `onVerified()` → `localStorage.setItem('magnum-frame-verified','1')` + событие `dispatchEvent(new CustomEvent('magnum:frame-unlocked'))` |
| `src/components/AiBot.module.css` | Стили verified-плашки |
| `src/components/VerifiedFrame.tsx` | Новый: `export function useVerifiedFrame():boolean` + `Frame` обёртка с conic-gradient |
| `src/components/VerifiedFrame.module.css` | `conic-gradient`, `@keyframes spin`, `prefers-reduced-motion` → `animation:none` |
| `src/lib/frame.ts` | `isFrameVerified():boolean`, `setFrameVerified()`, `clearFrame()` |
| `server.ts` | Без изменений (использует существующий `/magnum/api/ai`), будущее: `verified:boolean` в JSON ответа |
| `src/styles/frame.css` (альтернатива) | Глобальные утилиты `.magnum-frame-gold { ... }` |

### 4.6 Edge cases

- **Юзер правит LS руками** — ок для MVP (косметика локальна). В будущем — серверный флаг по IP/фингерпринту, но не сейчас.
- **Бот ответил неоднозначно** — считаем verified только если `text.includes('засчитан') || text.includes('легенда')` AND `!text.includes('не вижу') && !text.includes('не видно')`. Иначе — «попробуй другой скрин».
- **Картинка >5MB** — клиент сжимает до 1280px JPEG (уже есть в `AiBot.tsx`), если всё ещё >2MB — режем качество 0.7→0.5, если fail — тост «скрин слишком тяжёлый».
- **API ключ не настроен** — `server.ts` вернёт 500, фронт показывает «бот спит, попробуй позже», не ставим флаг.
- **Сеть упала** — ретрай 1 раз, затем «оффлайн, рамка подождёт».
- **Сброс LS** — рамка пропадает, нужно заново показать скрин — это ок, прогресс не критичен.
- **prefers-reduced-motion** — отключаем `spin` анимацию, оставляем статичный `conic-gradient`.
- **Множественные вкладки** — `storage` event на `magnum-frame-verified`, синхронизируем `useVerifiedFrame` хук.
- **Скрин без пресейва** — бот по SYSTEM_PROMPT правилу 2/3 не засчитает, флаг не ставим, уговариваем дальше (FOMO: «услышишь последним»).

---

## 5. Общие edge cases и кросс-фича

- **SSR / приватный режим** — все `localStorage` обёрнуты в `try/catch`, fallback в память.
- **Миграция ключей** — префикс `magnum-` единый, не конфликтует с `blackjack42-`/`roulette42-`.
- **Очистка данных** — кнопка «Сбросить прогресс 42» в `Footer` чистит все `magnum-*` ключи с confirm модалкой.
- **Аналитика** — `console.log('[magnum] duel:', record)` / `[eco]` / `[shop]` — без внешних трекеров в MVP.
- **SEO** — новые страницы `/magnum/duel`, `/magnum/eco`, `/magnum/shop` добавить в `sitemap.xml` и `robots.txt` при реализации.

---

## 6. Роадмап

| Этап | Что |
|---|---|
| MVP (LS-only) | Hot-seat дуэль + leaderboard LS · Эко-квиз 8Q + уровни · Магазин 12 скинов LS · Рамка verified LS |
| v2 (server) | `Bun.serve` WebSocket `/magnum/api/ws` для дуэлей · `verified:boolean` от `/magnum/api/ai` · серверный инвентарь |
| v3 (социал) | Шаринг результатов (OG-картинки) · глобальный лидерборд · пресейв-топ братух |

## 7. Следующие идеи

> Бэклог хайп-фич для следующих итераций. Приоритет — по голосам в `magnum_ideas` / `IdeasPage`.

### 7.1 Freakland Recap Roulette — рандомный пересказ за 42 монеты
**Идея:** Кнопка «🎲 Рандомный пересказ» на `RecapsPage` — крутит рулетку из 7+ карточек, выпадает одна, юзер читает и получает +42 `magnum-coins` если дочитал до конца (скролл-трекинг `IntersectionObserver` на последнем параграфе). Анти-абуз: 1 прокрут/час (`magnum-roulette-last` в LS).
**Файлы:** `src/pages/RecapsPage.tsx` (кнопка + `gsap` конфетти), `src/lib/recapRoulette.ts` (LS-кулдаун), `src/lib/coins.ts` (награда).
**Edge:** `prefers-reduced-motion` — без конфетти; приватный режим — fallback в память без сохранения кулдауна.

### 7.2 Ежедневный челлендж 42 — streak + награда
**Идея:** На `HomePage` виджет «Челлендж дня»: 1 мини-задание в сутки (кликер 42 клика / квиз 1 вопрос / открыть 3 пересказа). Streak считается в `magnum-daily-streak:{count,lastDate}`, награда 42/142/420 за 1/3/7 дней подряд. Пропуск — сброс в 0, но с «заморозкой» за 420 монет.
**Файлы:** `src/components/Daily42.tsx`, `src/lib/daily.ts`, `src/pages/HomePage.tsx`.
**Edge:** смена часового пояса — сравниваем `toDateString()` по локальному времени; читерский инкремент LS — валидируем `lastDate` не в будущем.

### 7.3 Братуха-озвучка — TTS пересказов
**Идея:** Кнопка «🔊 Слушать пересказ» в каждой карточке `RecapsPage` — Web Speech API `speechSynthesis` читает `paragraphs.join(' ')` голосом `ru-RU`. Прогресс-бар чтения, пауза/стоп. Fallback — ссылка на YouTube если API недоступен.
**Файлы:** `src/hooks/useTts.ts`, `src/pages/RecapsPage.tsx`.
**Edge:** iOS не авто-плей — только по клику; длинный текст >5K — чанкуем по предложениям.

### 7.4 Freakland Timeline — интерактивная лента 42
**Идея:** На `RecapsPage` сверху — горизонтальный таймлайн Freakland Create (11.07 → 19.07.2026): точки-дни с превью, клик скроллит к карточке, активная точка подсвечена `conic-gradient`. Прогресс «7/9 дней просмотрено» в `magnum-timeline-seen:{ids[]}` LS, GSAP `scrollTo` + `ScrollTrigger` подсветка.
**Файлы:** `src/components/FreaklandTimeline.tsx`, `src/lib/timeline.ts`, `src/pages/RecapsPage.tsx` (якоря `id`), `RecapsPage.module.css` (лента, точки).
**Edge:** `prefers-reduced-motion` — без скролл-анимации; LS битый — fallback `[]`; мобилка — свайп `overflow-x:auto` + snap; если карточка отфильтрована — точка dimmed 0.4.

### 7.5 Clip Battle 42 — голосование за нарезки
**Идея:** Еженедельный баттл 2 нарезок: юзер голосует «🔥 Завоз» vs «💤 Скучно», голос стоит 42 `magnum-coins`, победитель получает бейдж `clip-battle-winner` на карточке. Итоги в `magnum-clip-battle:{week, aId, bId, votesA, votesB, voted}` LS, в будущем — серверный подсчёт.
**Файлы:** `src/components/ClipBattle.tsx`, `src/lib/clipBattle.ts`, `src/pages/RecapsPage.tsx` (виджет над гридом), `src/lib/coins.ts` (списание/начисление).
**Edge:** повторный голос — блок + тост «уже голосовал, братуха»; недостаточно монет — дизейбл + линк в казино; LS переполнен — `try/catch` + fallback в память; читерский накрут — `voted` флаг 1/неделя.

### 7.6 Recap Quest 42 — квест по пересказам
**Идея:** Квест-цепочка из 5 шагов: открыть 3 пересказа → проголосовать в Clip Battle → пройти EcoQuiz 4/8 → открыть Freakland таймлайн → забрать 420 `magnum-coins` + бейдж `quest-42`. Прогресс в `magnum-quest:{stepsDone:Record<string,boolean>, claimed}` LS, GSAP чек-анимация `scale 0→1`.
**Файлы:** `src/components/RecapQuest.tsx`, `src/lib/quest.ts`, `src/pages/HomePage.tsx` (виджет), `src/pages/RecapsPage.tsx` (триггеры `quest:open`).
**Edge:** `claimed` true — показываем «уже забрал»; сброс LS — квест с нуля; приватный режим — `try/catch`; `prefers-reduced-motion` — без GSAP scale; награда NaN — кламп 420.

### 7.7 Магнум-викторина 42 — быстрый квиз по трекам
**Идея:** Мини-викторина на `HomePage`: 5 рандомных вопросов про MAGNUM-треки (VPN дата, CLAY РЗТ, SUPER PUPER NOVA баллы, ТУСА МЕДУЗА клипы/просмотры, «что значит 42»). 30 сек на ответ, 3 жизни, награда 42/142 монет. Результаты в `magnum-magnum-quiz:{score,best,date}` LS, шаринг «Я набрал 5/5, братуха!».
**Файлы:** `src/components/MagnumQuiz.tsx`, `src/lib/magnumQuiz.ts` (вопросы + `calcScore`), `src/pages/HomePage.tsx` (виджет), `src/lib/coins.ts`.
**Edge:** таймер на `setInterval` + `visibilitychange` пауза; LS битый — fallback `{score:0}`; повтор в тот же день — награда 1/сутки; `prefers-reduced-motion` — без тряски на неверный ответ; звук опционален WebAudio.

### 7.8 Братуха-стрик 42 — календарь активности
**Идея:** Календарь-сетка 30 дней на `HomePage`/`IdeasPage`: каждый день захода — клетка закрашивается градиентом `common→epic` по streak, пропуск — серая. Streak в `magnum-streak:{count,lastDate,grid:number[]}` LS, награда 42 каждый день + 420 на 7-й день + рамка `streak-7` conic-gold.
**Файлы:** `src/components/StreakCalendar.tsx`, `src/lib/streak.ts`, `src/pages/HomePage.tsx`.
**Edge:** часовой пояс — `toDateString()` локально; читерский `lastDate` в будущем — сброс; LS quota — `try/catch`; `prefers-reduced-motion` — без пульсации клетки; сервер v2 — `magnum_streak` таблица.

### 7.9 Промо-баннер «Пресейв гонит» — FOMO-таймер
**Идея:** Липкий баннер над `Layout` с обратным отсчётом до релиза MAGNUM (дата из `src/config/release.ts`), текстом «Услышишь последним — пресейв сейчас →» + кнопка `PRESAVE`. При клике `magnum-presave-banner:{dismissed,clicked}` LS, GSAP `y:-20→0` появление, `prefers-reduced-motion` — без анимации. После релиза — автозамена на «Слушать MAGNUM →».
**Файлы:** `src/components/PresaveBanner.tsx`, `src/lib/presaveBanner.ts`, `src/components/Layout.tsx`, `src/config/release.ts`.
**Edge:** дата прошла — показываем «релиз вышел»; LS битый — fallback не dismissed; SSR — `typeof window` guard; баннер не мешает кликеру — `pointer-events` + `z-index` 42; мобилка — компакт 32px высота.

### 7.10 Шеринг-прогресс 42 — карточка достижений
**Идея:** OG-картинка достижений: юзер жмёт «Поделиться прогрессом» на `HomePage` — генерируем canvas 1080×1080 с градиентом, аватаркой, статой (клики, квиз, стрик, пресейв-рамка). Кнопка «Скачать PNG» + Web Share API, награда 42 `magnum-coins` за первый шаринг (`magnum-share-claimed` LS).
**Файлы:** `src/components/ShareCard.tsx`, `src/lib/shareCard.ts` (canvas), `src/pages/HomePage.tsx`, `src/lib/coins.ts`.
**Edge:** canvas CORS — только локальные градиенты; iOS Share недоступен — fallback download; LS битый — `try/catch`; `prefers-reduced-motion` — без confetti; генерация >2s — показываем спиннер.

### 7.11 Звук 42 — эмбиент плеер MAGNUM
**Идея:** Мини-плеер на `HomePage` с 3 лупами (медуза-вейв, вайб Кемерово, 42-дрон) на WebAudio, громкость в `magnum-audio:{vol,mute,track}` LS, GSAP пульсация обложки `scale 1→1.02`. Автоплей только по клику (iOS), пауза при `visibilitychange`.
**Файлы:** `src/components/AmbientPlayer.tsx`, `src/lib/audio.ts`, `src/pages/HomePage.tsx`.
**Edge:** AudioContext suspended — `resume()` по клику; LS битый — дефолт `vol:0.3`; несколько вкладок — `storage` sync; `prefers-reduced-motion` — без пульсации; файл не грузится — тост «звук отдыхает».

### 7.12 Мультиплеер Арена 42 — онлайн-арена 1v1 + сезоны

**Идея:**
Полноценная онлайн-арена на `Bun.serve WebSocket /magnum/api/ws` — лобби, матчмейкинг 1v1, сезоны 7 дней, рейтинг ELO 42.
Матч — 10с кликер-дуэль с анти-читом на сервере (CPS>20 → бан раунда, `suspect:true`).
Победитель забирает `wager` из `magnum-coins` + `+42` рейтинга, лузер −12, draw — возврат.
Топ-3 сезона получают лимитку `arena-crown-42` (conic-gold рамка + `box-shadow: 0 0 22px gold`).
Сезонный вайп — `magnum-arena-season:{id,rating,wins,season}` LS, сервер `magnum_leaderboard(game='arena')`.
**LS/Server ключи:**
- `magnum-arena-rating:number` — локальный кэш ELO (инициал 1000)
- `magnum-arena-season:{id,rating,wins,season:number}` — прогресс сезона
- `magnum-arena-last:ISO` — кулдаун 3с между поисками матча
- сервер: `magnum_leaderboard(game='arena', score=rating)` + `magnum_arena_matches{id,p1,p2,winner,wager,ts}`
- `magnum-coins` — единый кошелёк `src/lib/coins.ts` (списание/начисление ставки)
**UI блоки:**
- `ArenaLobby` — кнопка «Найти братуху ⚔️», счётчик онлайн `ws:online`, селект ставки 0/42/142/420
- `ArenaDuel` — два прогресс-бара, таймер 10с, `+1` burst + `navigator.vibrate(20)` на клик, GSAP shake на контесте
- `ArenaResult` — конфетти 160 частиц (canvas), `rating ±N`, кнопки «Реванш»/`ws:rematch` / «В лобби»
- `ArenaSeasonBoard` — топ-20 сезона + твой ранг, бейдж `TOP 42` с `conic-gradient` рамкой
- `ArenaBadge` в `GamesHub` — `⚔️ ARENA LIVE` с RGB пульсом `animation: pulse 1.2s infinite`
- `ArenaHistory` — последние 20 матчей из LS + сервер, фильтр по `wager` и `winner`
**Файлы:**
- `src/pages/games/Arena.tsx` — state-machine `lobby→search→duel→result` + `useGSAP` анимации
- `src/lib/arena.ts` — `findMatch()`, `calcElo(winner,loser)`, `canAfford(wager)`, `isSuspect(cps)`
- `src/lib/ws.ts` — `WebSocket wss://.../magnum/api/ws`, реконнект + heartbeat 25с + `subscribe('arena')`
- `server.ts` — `websocket:{open→subscribe('arena'), message→duel:challenge/broadcast, close→unsubscribe}`
- `src/components/ArenaBoard.tsx` — таблица топ-20 reuse `Leaderboard.tsx` + `EquippedFrame` для корон
**Edge:**
- WS отвал — fallback на `DuelClicker` hot-seat + тост «арена оффлайн, дерёмся локально»
- читер CPS>20 или `clicks>150/10с` — `suspect:true`, матч не в рейтинг, «братуха, ты робот? 🤖»
- ставка > баланса — `getCoins()<wager` блок, подсказка «не хватает, сходи в казино»
- две вкладки — `storage` sync рейтинга + `BroadcastChannel('arena')` для instant
- `prefers-reduced-motion` — без shake/confetti, `animation:none`
- `beforeunload` mid-duel — возврат ставки `addCoins(wager)` если дуэль не завершена
- отрицательный wager — `Math.max(0,Number(v))`, NaN→0, кламп 0..1420
**Награда:**
- `+42` за первую победу в день, `+420` за 5 побед подряд (streak в `magnum-arena-season`)
- `arena-crown-42` скин за топ-3 сезона + `+1420` монет бонус
- аналитика: `console.log('[magnum] arena:', {rating,wager,winner})` без внешних трекеров
**SEO/роадмап:**
- `/magnum/arena` в `sitemap.xml` + `robots.txt` allow, OG-теги `og:title=Арена 42`
- MVP — мок WS локально (hot-seat), v2 — реальный `Bun.serve` + `magnum_leaderboard` + ELO
- кросс-фича: победа триггерит `StreakCalendar` + `RecapQuest` шаг

### 7.13 Эко-Челлендж 42 — еженедельный челлендж Кузбасса + стрик

**Идея:**
Еженедельный эко-челлендж на 7 дней: каждый день 1 задание про Кузбасс/Томь/сортировку мусора.
Каждый таск с фактом MAGNUM: VPN 28.04 в чартах, CLAY РЗТ73 03.04, SUPER PUPER NOVA РЗТ80/XXL86, ТУСА МЕДУЗА 8K клипов/200K просмотров.
Пропуск дня — стрик сгорает, но «заморозка» за 420 монет (1/неделю, `magnum-eco-freeze-used`).
Финал недели (вс) — босс-квиз 8Q из `EcoQuizPage` с наградой до 1420 + бейдж `Эко-Легенда 42`.
Пропаганда: «Томь — артерия Кемерово, 42 братухи чистят берега — сортируй, братуха!».
**LS ключи:**
- `magnum-eco-challenge:{weekId,streak,lastDate,completed:number[],frozen:boolean}` LS
- `magnum-eco-history:{score,level,date}[]` reuse из §2.2 (последние 10 квизов)
- `magnum-coins:number` — награда 42/142/420 из `src/lib/coins.ts`
- `magnum-eco-freeze-used:boolean` — 1 заморозка в неделю, сброс по `weekId`
- `weekId=ISO week (YYYY-Www)` для авто-сброса челленджа в пн 00:00 локально
**UI блоки:**
- `EcoChallengeGrid` — 7 клеток пн-вс с иконками `🌿♻️🌊🏭🌲💧🔥`, выполненная `linear-gradient(135deg,#00ff88,#5865f2)`, пропуск серая `dashed`
- `EcoTaskCard` — задание дня + факт «А знаешь ли ты…» про Кемерово/MAGNUM, кнопка «Сделать» (чек `IntersectionObserver` или квиз-ответ)
- `EcoStreakBar` — «🔥 5/7 братуха, не сливай!» + таймер до сброса `23:59:59`, GSAP `scale 1→1.02` пульс
- `EcoBossQuiz` — в вс открывается босс-квиз 8Q, награда `streak*42 + bonus 420` если 7/7, иначе `streak*42`
- `EcoRewardModal` — конфетти + `addCoins(reward)` + шаринг «Я закрыл ЭКО-челлендж 7/7! 🌱» + `PRESAVE` CTA
- `EcoFreezeBtn` — «Заморозить стрик за 420 🧊» — `if(getCoins()<420) disabled` + тост
**Файлы:**
- `src/pages/EcoChallengePage.tsx` — grid + boss + freeze + GSAP stagger
- `src/lib/ecoChallenge.ts` — `TASKS_7:Task[]`, `calcStreak()`, `canFreeze()`, `getWeekId()`, `isBossUnlocked()`
- `src/lib/ecoQuiz.ts` — reuse `QUESTIONS:Question[]`, `calcLevel(score)`, `getReward(level)`
- `src/components/EcoChallengeGrid.module.css` — grid 7 (десктоп) / 4+3 (мобилка), `conic-gradient` бейджи
- `src/lib/coins.ts` — `getCoins/addCoins/subscribe` для наград, `window.addEventListener('storage')` sync
- `public/eco-challenge.json` (опционально) — JSON с 7 заданиями для правки без деплоя
**Edge:**
- часовой пояс — `toDateString()` локально, `lastDate` в будущем → сброс + тост «время шалят, стрик сброшен»
- LS битый JSON — `try{JSON.parse}catch→fallback {streak:0,completed:[]}` + `removeItem` битого
- повтор задания — идемпотентно `if(completed.includes(day)) return`, без двойной награды
- награда NaN — `Number.isFinite(reward)?reward:0`, кламп через `addCoins`
- приватный режим — `try/catch` вокруг LS + «прогресс не сохранится в этом браузере»
- `prefers-reduced-motion` — без GSAP scale/pulse, статичные карточки
- две вкладки — `storage` event на `magnum-eco-challenge`, синхронизируем grid
- `weekId` смена — авто-сброс `completed=[]`, но `freeze-used` тоже сброс
**Награда:**
- 42 за день, 142 за 3/7, 420 за 7/7, 1420 за босс-квиз 8/8 + бейдж `Эко-Легенда 42` conic-gold
- `+42` бонус за шаринг результата + `magnum-share-claimed` LS
- кросс-фича: прогресс триггерит `RecapQuest` шаг + `StreakCalendar` sync + пост в `magnum_ideas`

### 7.14 Магазин Лимиток 42 — дропы, аукционы, FOMO-таймер

**Идея:**
Лимитированный дроп-шоп: 6 скинов/рамок дропаются раз в 72ч, FOMO-таймер `72:00:00`, тираж 42 штуки каждый.
Цена 142/420/1420, покупка за `magnum-coins` + `magnum-inventory` LS, после солд-аута — аукцион за монеты (топ-ставка забирает).
Дроп `magnum-limited-042` — «Медуза Gold» `conic-gradient(from 0deg,#ffd700,#ff8c00,#ffd700)` epic 1420 с эмодзи 🪼.
FOMO-текст: «тираж 42 — кринжа не существует, делай, братуха! Успей до `endsAt`».
После дропа — автозамена на следующий `dropId+1` с новым каталогом (ротация 4 дропа/месяц).
**Каталог дропа #1 (6 лимиток, тираж 42 каждый):**
- `meduza-gold-42` 🪼 `conic-gradient(from 0deg,#ffd700,#ff8c00,#ffd700)` epic 1420 — «Медуза Gold»
- `tusa-8k-holo` 🎬 `linear-gradient(135deg,#00ccff,#ff2d55)` rare 420 — «Туса Holo 8K»
- `vpn-neon-42` 📡 `linear-gradient(135deg,#ff2d55,#5865f2)` rare 420 — «VPN Neon»
- `clay-73-brown` 🧱 `linear-gradient(135deg,#8b4513,#ffcc00)` uncommon 142 — «CLAY 73»
- `nova-80-purple` 💜 `conic-gradient(from 180deg,#9b59b6,#ff2d55)` rare 420 — «Nova 80»
- `fence-42-black` 🏴 `linear-gradient(135deg,#111,#444)` epic 1420 — «The Fence 42»
- редкости как в §3: `common 42` · `uncommon 142` · `rare 420` · `epic 1420` — отсылка к 42
**LS/Server ключи:**
- `magnum-limited:{dropId,items:{id,left,price}[],endsAt:ISO}` LS — кэш дропа
- `magnum-inventory:string[]` + `magnum-equipped:string|null` reuse §3.3 (инвариант `equipped∈inventory`)
- `magnum-limited-bids:{dropId,bid:number,leader:string}` LS — топ-ставка аукциона
- сервер v2: `magnum_shop_inventory(skin_id, equipped)` + `magnum_limited_drops{dropId, skinId, left, price}`
- `magnum-coins` — единый кошелёк, `getCoins()/addCoins()` с `subscribe()` live
**UI блоки:**
- `LimitedGrid` — 6 карточек `grid 3×2` (мобилка 2×3) с бейджем `LEFT 12/42` + прогресс-бар `width: left/42*100%`
- `FomoTimer` — липкий `72:00:00` над гридом, GSAP пульс `scale 1→1.04` каждую сек, `prefers-reduced-motion` — без пульса
- `BuyOrBid` — если `left>0` → «Купить за N» / «Надето ✓» / «Надеть», иначе аукцион «Ставка +42» + топ-ставка `bid`
- `LimitedPreview` — модалка 200px градиент-блок + эмодзи 48px + «тираж 42, братуха, успеешь?» + шаринг
- `InventoryBar` — горизонтальный скролл купленных лимиток над гридом, клик → `equipSkin(id)` + `EquippedFrame`
- `SoldOutBadge` — `SOLD OUT` с `conic-gradient` + `filter: grayscale(0.6)` + аукционная кнопка
**Файлы:**
- `src/pages/LimitedShopPage.tsx` — grid + timer + bid + GSAP confetti
- `src/lib/limitedShop.ts` — `DROPS:LimitedSkin[]`, `getLimited()`, `buyLimited(id)`, `placeBid(n)`, `timeLeft(endsAt)`
- `src/components/LimitedCard.tsx` — карточка лимитки (проп `skin, left, owned, equipped, onBuy, onBid`)
- `src/lib/shop.ts` — reuse `canAfford(price)`, `SKINS` каталог, `getInventory()` хелперы
- `src/lib/coins.ts` — без изменений, `getCoins/addCoins/subscribe` + `storage` sync
- `server.ts` — будущее `GET /magnum/api/limited` → `{dropId, items, endsAt}` + `POST /magnum/api/limited/bid`
**Edge:**
- недостаточно монет — дизейбл + тултип «нужно ещё X монет» + линк «Как заработать? → GamesHub»
- двойная покупка — `if(inventory.includes(id)) return {ok:false,reason:'owned'}` идемпотентно
- подделка цены в LS — цена только из `DROPS` в коде, LS хранит лишь `id`, не цену
- LS quota exceeded — `try/catch` вокруг `setItem` + тост «не удалось сохранить инвентарь»
- одновременные вкладки — `storage` sync на `magnum-limited`/`magnum-inventory`/`magnum-coins`
- градиент не грузится — fallback `background:#1a1a1a` + эмодзи видно
- солд-аут гонка — сервер v2 транзакция `SELECT FOR UPDATE`, MVP `left=Math.max(0,left-1)` + рефреш 2с
- `endsAt` прошёл — автопоказываем «дроп завершён, следующий через 42ч» + `FomoTimer` 00:00:00
**Награда/хайп:**
- первый покупатель дропа `left 42→41` получает `+142` бонус + бейдж `OG 42` в `Leaderboard`
- шаринг «Я урвал лимитку 42/42! 🏴» + OG-картинка canvas 1080×1080 + Web Share API
- FOMO: «тираж 42 — кринжа не существует, делай!» + `PRESAVE https://music.thefence.me/psmagnum` CTA
- аналитика: `console.log('[magnum] limited:', {dropId, id, left})` без внешних трекеров

### 7.15 Братуха-Стрик Календарь 42 — ежедневный огонёк активности

**Идея:**
Календарь-стрик на 42 дня: зашёл на `/magnum/` — клетка закрасилась, пропустил — серая трещина. Держа держит 42 дня → рамка `streak-42` conic-gold + 1420 монет.
Сетка 6×7 (42 клетки) как GitHub-контрибьют, цвет-интенсивность по стрик-лену: `1-6 серо-мятный`, `7-13 неон`, `14-29 fire`, `30-42 epic conic-gradient`.
Мотивация: «Братуха, 42 дня — кринжа не существует, делай каждый день!» + пуш FOMO в `PresaveBanner`.

**LS ключи:**
- `magnum-streak-calendar:{count:number,lastDate:string(ISO date),grid:boolean[42],best:number,freezeUsed:boolean}` LS — стрик и сетка
- `magnum-streak-freeze:1|0` — 1 заморозка в 7 дней за 420 монет (`magnum-eco-freeze-used` reuse паттерн, но отдельный ключ)
- `magnum-streak-claimed:{'7':bool,'14':bool,'30':bool,'42':bool}` — какие награды уже выданы, без повтора
- `magnum-coins:number` — единый кошелёк `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- сервер v2: `magnum_streak_calendar(user_id, count, last_date, best)` + `magnum_coins(balance)` — серверный анти-чит по `last_date`

**UI блоки:**
- `StreakCalendarGrid` — 42 клетки `grid 7×6` (мобилка `overflow-x:auto` + `snap`), каждая `12px` с `border-radius: 3px`, пустая `bg:#1a1a1a dashed`, активная — градиент уровня + `box-shadow` по редкости, сегодня пульс `scale 1→1.08`
- `StreakCounter` — «🔥 18/42 братуха, не сливай!» + `FomoTimer` до 00:00 «до сброса 05:42:11», GSAP `scale 1→1.02` каждый тик, `prefers-reduced-motion` — без пульса
- `StreakRewardTrack` — чекпоинты 7/14/30/42 с наградами `142/420/1000/1420` + иконки `🌿🔥👑💿`, пройденные — чек `✓` + `conic-gradient` рамка, будущие — `opacity:.4`
- `StreakFreezeBtn` — «🧊 Заморозить за 420» disabled если `getCoins()<420` или `freezeUsed`, тост «заморозка спасла стрик!»
- `StreakShareCard` — кнопка «Поделиться стриком → ShareCard 1080×1080» reuse §7.10 canvas, текст «У меня 🔥 42 дня, братуха!»
- `StreakBadge` в `NavGrid/HomePage` — мини-огонёк `🔥×count` с RGB-обводкой, клик → модалка календаря

**Файлы:**
- `src/components/StreakCalendar.tsx` — grid + counter + freeze + GSAP stagger `from .cell: y:8 opacity:0 stagger:0.02`
- `src/lib/streakCalendar.ts` — `getStreak():Streak`, `tickStreak():{count,reward}`, `canFreeze():bool`, `calcReward(day):42|142|420`, `getIntensity(count):'common'|'uncommon'|'rare'|'epic'`
- `src/components/StreakCalendar.module.css` — сетка, `cell-common/uncommon/rare/epic`, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — виджет над `RecapQuest`, `useEffect → tickStreak()` на маунте (1 раз/сутки)
- `src/lib/coins.ts` — без изменений, `addCoins(reward)` + `storage` sync, `BroadCastChannel('streak')` для многовкладок
- `server.ts` (будущее) — `GET /magnum/api/streak` → `{count,best}` + `POST /magnum/api/streak/tick` с валидацией `lastDate` на сервере

**Edge:**
- часовой пояс — `new Date().toDateString()` локально, `lastDate` в будущем → сброс + тост «время шалят, стрик сброшен, братуха»
- LS битый JSON — `try{JSON.parse}catch→fallback {count:0,grid:Array(42).fill(false),best:0}` + `removeItem` битого ключа
- пропуск дня без заморозки — `count→0`, `grid` сбрасываем только визуально? Нет, храним историю, но `count` 0, показываем «снова с 1, делай!»
- две вкладки — `window.addEventListener('storage')` на `magnum-streak-calendar` + `BroadcastChannel('streak')` instant sync
- `prefers-reduced-motion` — без `pulse`/`stagger`, статичный `conic-gradient` только бордер
- приватный режим — `try/catch` вокруг LS, fallback в память + тост «прогресс не сохранится в этом браузере»
- награда NaN — `Number.isFinite(reward)?reward:0`, кламп, `addCoins` идемпотентно через `claimed` флаг
- читерский инкремент — сервер v2 сравнивает `lastDate` и `count`, клиентский `count` не доверяем, пересчитываем из `grid` + дат

**Награда/хайп:**
- 7д → 142, 14д → 420, 30д → 1000, 42д → 1420 + скин `streak-42-fire` `conic-gradient(from 0deg,#ff2d55,#ffcc00,#00ff88)` epic
- шаринг «🔥 42/42 братуха-календарь, кринжа не существует!» + OG-картинка canvas 1080×1080 + `PRESAVE` CTA
- кросс-фича: `tickStreak()` триггерит `Daily42` + `EcoChallenge` freeze sync + `Leaderboard` бейдж `STREAK 42`

### 7.16 Шеринг-Карточка 42 — OG-картинка достижений + Web Share

**Идея:**
Кнопка «Поделиться прогрессом 📤» генерирует OG-картинку 1080×1080 на `<canvas>` без внешних ассетов — только CSS-градиенты + эмодзи.
Картинка собирает статы братухи: стрик, эко-уровень, купленные скины, дуэль `bestClicks`, пресейв-рамка `verified`. Виралка: «Я — Легенда 42 👑 8/8 ЭКО + 🔥18 стрик».
Шаринг — `navigator.share({files:[png]})` если доступен, иначе «Скачать PNG». Первый шаринг → +42 монет (`magnum-share-claimed`).

**LS ключи:**
- `magnum-share-claimed:'1'|null` — 1 награда за первый шаринг, анти-абуз, `magnum-coins` +42 через `addCoins`
- `magnum-share-prefs:{bg:'neon'|'gold'|'fence', showStreak:bool}` LS — выбор фона карточки, дефолт `neon`
- `magnum-share-cache:string|null` (опционально, base64 512px превью последней карточки для инстант-показа без перегенерации, TTL 1ч)
- `magnum-streak-calendar`, `magnum-eco-quiz`, `magnum-inventory`, `magnum-duel-history`, `magnum-frame-verified` — read-only источники статы (не пишем)
- сервер v2: `POST /magnum/api/share` → `{url, imageId}` для серверного OG (будущее), MVP — чисто клиентский canvas

**UI блоки:**
- `ShareCardBtn` — градиент `linear-gradient(135deg,#ff2d55,#5865f2)` + `box-shadow: 0 0 18px rgba(255,45,85,.5)`, иконка 📤, `GSAP scale 1→1.02 hover`
- `ShareCardPreview` — модалка 360×360 превью (scale 0.33 от 1080), спиннер `…генерируем 42…` пока `<canvas>.toBlob` <2с, затем `<img src=blobUrl>`
- `ShareCardCanvas` (скрытый `<canvas width=1080 height=1080>`) — слои: фон `conic-gradient` → аватар-эмодзи 120px → статы-плитки `streak/eco/duel/coins` → `PRESAVE` QR/текст `music.thefence.me/psmagnum` → вотермарка `42 — кринжа не существует`
- `ShareActions` — «📥 Скачать PNG» (a[download]) + «📤 Поделиться» (`navigator.canShare({files})`) + «Копировать текст» (`navigator.clipboard.writeText`)
- `ShareRewardToast` — после первого шаринга `addCoins(42)` + конфетти 120 частиц canvas + «+42 монеты, братуха, спасибо за хайп!»

**Файлы:**
- `src/components/ShareCard.tsx` — модалка + превью + share/download + GSAP `from .card: y:20 opacity:0`
- `src/lib/shareCard.ts` — `generateShareCard(stats:ShareStats):Promise<Blob>`, `buildStats():ShareStats` (читает все LS), `shareOrDownload(blob, text)`
- `src/lib/shareStats.ts` — `getShareStats():{streak, ecoLevel, bestClicks, coins, skins, verified, duelWins}` чистые селекторы LS
- `src/components/ShareCard.module.css` — модалка, `backdrop: blur(8px)`, `card: border conic-gradient`, `prefers-reduced-motion` → без GSAP
- `src/pages/HomePage.tsx` + `src/pages/EcoQuizPage.tsx` + `src/pages/games/DuelClicker.tsx` — кнопка «Поделиться прогрессом» в `Result`/`EcoResult`/`DuelResult`
- `public/share-qr.png` (опционально) — QR на `PRESAVE`, если нет — рисуем текстом `psmagnum` на canvas

**Edge:**
- canvas CORS — только `fillStyle` градиенты / `fillText` эмодзи, без `drawImage` с внешних URL → taint отсутствует
- iOS Share без файлов — `if(!navigator.canShare({files:[file]}))` → fallback «Скачать» + `clipboard.writeText` + тост «поделись вручную, братуха»
- `toBlob` >2с — показываем спиннер + `setTimeout 2с` → «почти готово…», не блокируем UI, `requestIdleCallback` для генерации
- LS битый — `try/catch` вокруг каждого `getItem`, fallback `0/'Нормис'/[]`, карточка всё равно рендерится с дефолтами
- приватный режим — `try/catch` + генерация без кеша, `magnum-share-claimed` в памяти (1 сессия)
- `prefers-reduced-motion` — без конфетти/GSAP, статичное превью
- длинный ник >16 — `ctx.fillText` кламп `slice(0,16)+'…'`, `measureText` → `fontSize 36→28`
- одновременные генерации — `AbortController` на предыдущий `generateShareCard`, только последний blob в `<img>`

**Награда/хайп:**
- первый шаринг +42, каждый шаринг — OG-картинка для твиттера/тг/вк, виралка «Туса Медуза 8K клипов — я в деле!»
- шаринг-текст: `«Я — {level} 42! 🔥{streak} стрик · 🧱CLAY РЗТ73 · 📡VPN 28.04 · presave → music.thefence.me/psmagnum #MAGNUM42»`
- аналитика: `console.log('[magnum] share:', {streak, ecoLevel, verified})` без внешних трекеров, кросс-фича → `StreakCalendar` + `Leaderboard`

### 7.17 Bratukha-Ficha 42.17 — khajp-modul 17 dlya MAGNUM

**Ideya:**
Modul 42.17: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 17, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 17, konvejer 17, vetryak 17).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.17!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-17:{count:number,lastDate:string,claimed:boolean,season:17}` LS — progress modulya 17
- `magnum-42-17-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-17-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_17(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_17Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🔥 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_17Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_17Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+126 monet, bratukha!»
- `Hype42_17History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_17Badge` v `NavGrid` — bejdzh «42.17 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_17Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.17!»

**Fajly:**
- `src/components/Hype42_17.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_17.ts` — `getHype42_17():Hype`, `claim42_17():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_17.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-17')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/17` → `{count,season}` + `POST /magnum/api/hype42/17/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-17')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 17 + skin `hype42-17-fire` epic conic-gold
- sharing «42.17 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.17`
- analitika: `console.log('[magnum] hype42-17:', {count,reward})` bez vneshnikh trekerov

### 7.18 Bratukha-Ficha 42.18 — khajp-modul 18 dlya MAGNUM

**Ideya:**
Modul 42.18: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 18, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 18, konvejer 18, vetryak 18).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.18!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-18:{count:number,lastDate:string,claimed:boolean,season:18}` LS — progress modulya 18
- `magnum-42-18-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-18-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_18(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_18Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🪼 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_18Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_18Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+42 monet, bratukha!»
- `Hype42_18History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_18Badge` v `NavGrid` — bejdzh «42.18 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_18Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.18!»

**Fajly:**
- `src/components/Hype42_18.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_18.ts` — `getHype42_18():Hype`, `claim42_18():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_18.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-18')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/18` → `{count,season}` + `POST /magnum/api/hype42/18/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-18')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 18 + skin `hype42-18-fire` epic conic-gold
- sharing «42.18 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.18`
- analitika: `console.log('[magnum] hype42-18:', {count,reward})` bez vneshnikh trekerov

### 7.19 Bratukha-Ficha 42.19 — khajp-modul 19 dlya MAGNUM

**Ideya:**
Modul 42.19: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 19, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 19, konvejer 19, vetryak 19).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.19!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-19:{count:number,lastDate:string,claimed:boolean,season:19}` LS — progress modulya 19
- `magnum-42-19-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-19-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_19(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_19Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🔥 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_19Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_19Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+84 monet, bratukha!»
- `Hype42_19History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_19Badge` v `NavGrid` — bejdzh «42.19 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_19Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.19!»

**Fajly:**
- `src/components/Hype42_19.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_19.ts` — `getHype42_19():Hype`, `claim42_19():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_19.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-19')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/19` → `{count,season}` + `POST /magnum/api/hype42/19/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-19')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 19 + skin `hype42-19-fire` epic conic-gold
- sharing «42.19 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.19`
- analitika: `console.log('[magnum] hype42-19:', {count,reward})` bez vneshnikh trekerov

### 7.20 Bratukha-Ficha 42.20 — khajp-modul 20 dlya MAGNUM

**Ideya:**
Modul 42.20: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 20, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 20, konvejer 20, vetryak 20).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.20!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-20:{count:number,lastDate:string,claimed:boolean,season:20}` LS — progress modulya 20
- `magnum-42-20-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-20-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_20(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_20Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🪼 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_20Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_20Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+126 monet, bratukha!»
- `Hype42_20History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_20Badge` v `NavGrid` — bejdzh «42.20 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_20Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.20!»

**Fajly:**
- `src/components/Hype42_20.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_20.ts` — `getHype42_20():Hype`, `claim42_20():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_20.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-20')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/20` → `{count,season}` + `POST /magnum/api/hype42/20/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-20')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 20 + skin `hype42-20-fire` epic conic-gold
- sharing «42.20 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.20`
- analitika: `console.log('[magnum] hype42-20:', {count,reward})` bez vneshnikh trekerov

### 7.21 Bratukha-Ficha 42.21 — khajp-modul 21 dlya MAGNUM

**Ideya:**
Modul 42.21: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 21, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 21, konvejer 21, vetryak 21).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.21!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-21:{count:number,lastDate:string,claimed:boolean,season:21}` LS — progress modulya 21
- `magnum-42-21-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-21-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_21(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_21Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🔥 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_21Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_21Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+42 monet, bratukha!»
- `Hype42_21History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_21Badge` v `NavGrid` — bejdzh «42.21 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_21Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.21!»

**Fajly:**
- `src/components/Hype42_21.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_21.ts` — `getHype42_21():Hype`, `claim42_21():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_21.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-21')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/21` → `{count,season}` + `POST /magnum/api/hype42/21/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-21')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 21 + skin `hype42-21-fire` epic conic-gold
- sharing «42.21 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.21`
- analitika: `console.log('[magnum] hype42-21:', {count,reward})` bez vneshnikh trekerov

### 7.22 Bratukha-Ficha 42.22 — khajp-modul 22 dlya MAGNUM

**Ideya:**
Modul 42.22: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 22, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 22, konvejer 22, vetryak 22).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.22!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-22:{count:number,lastDate:string,claimed:boolean,season:22}` LS — progress modulya 22
- `magnum-42-22-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-22-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_22(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_22Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🪼 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_22Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_22Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+84 monet, bratukha!»
- `Hype42_22History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_22Badge` v `NavGrid` — bejdzh «42.22 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_22Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.22!»

**Fajly:**
- `src/components/Hype42_22.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_22.ts` — `getHype42_22():Hype`, `claim42_22():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_22.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-22')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/22` → `{count,season}` + `POST /magnum/api/hype42/22/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-22')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 22 + skin `hype42-22-fire` epic conic-gold
- sharing «42.22 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.22`
- analitika: `console.log('[magnum] hype42-22:', {count,reward})` bez vneshnikh trekerov

### 7.23 Bratukha-Ficha 42.23 — khajp-modul 23 dlya MAGNUM

**Ideya:**
Modul 42.23: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 23, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 23, konvejer 23, vetryak 23).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.23!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-23:{count:number,lastDate:string,claimed:boolean,season:23}` LS — progress modulya 23
- `magnum-42-23-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-23-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_23(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_23Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🔥 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_23Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_23Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+126 monet, bratukha!»
- `Hype42_23History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_23Badge` v `NavGrid` — bejdzh «42.23 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_23Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.23!»

**Fajly:**
- `src/components/Hype42_23.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_23.ts` — `getHype42_23():Hype`, `claim42_23():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_23.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-23')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/23` → `{count,season}` + `POST /magnum/api/hype42/23/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-23')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 23 + skin `hype42-23-fire` epic conic-gold
- sharing «42.23 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.23`
- analitika: `console.log('[magnum] hype42-23:', {count,reward})` bez vneshnikh trekerov

### 7.24 Bratukha-Ficha 42.24 — khajp-modul 24 dlya MAGNUM

**Ideya:**
Modul 42.24: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 24, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 24, konvejer 24, vetryak 24).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.24!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-24:{count:number,lastDate:string,claimed:boolean,season:24}` LS — progress modulya 24
- `magnum-42-24-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-24-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_24(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_24Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🪼 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_24Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_24Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+42 monet, bratukha!»
- `Hype42_24History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_24Badge` v `NavGrid` — bejdzh «42.24 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_24Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.24!»

**Fajly:**
- `src/components/Hype42_24.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_24.ts` — `getHype42_24():Hype`, `claim42_24():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_24.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-24')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/24` → `{count,season}` + `POST /magnum/api/hype42/24/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-24')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 24 + skin `hype42-24-fire` epic conic-gold
- sharing «42.24 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.24`
- analitika: `console.log('[magnum] hype42-24:', {count,reward})` bez vneshnikh trekerov

### 7.25 Bratukha-Ficha 42.25 — khajp-modul 25 dlya MAGNUM

**Ideya:**
Modul 42.25: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 25, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 25, konvejer 25, vetryak 25).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.25!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-25:{count:number,lastDate:string,claimed:boolean,season:25}` LS — progress modulya 25
- `magnum-42-25-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-25-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_25(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_25Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🔥 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_25Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_25Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+84 monet, bratukha!»
- `Hype42_25History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_25Badge` v `NavGrid` — bejdzh «42.25 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_25Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.25!»

**Fajly:**
- `src/components/Hype42_25.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_25.ts` — `getHype42_25():Hype`, `claim42_25():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_25.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-25')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/25` → `{count,season}` + `POST /magnum/api/hype42/25/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-25')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 25 + skin `hype42-25-fire` epic conic-gold
- sharing «42.25 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.25`
- analitika: `console.log('[magnum] hype42-25:', {count,reward})` bez vneshnikh trekerov

### 7.26 Bratukha-Ficha 42.26 — khajp-modul 26 dlya MAGNUM

**Ideya:**
Modul 42.26: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 26, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 26, konvejer 26, vetryak 26).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.26!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-26:{count:number,lastDate:string,claimed:boolean,season:26}` LS — progress modulya 26
- `magnum-42-26-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-26-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_26(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_26Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🪼 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_26Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_26Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+126 monet, bratukha!»
- `Hype42_26History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_26Badge` v `NavGrid` — bejdzh «42.26 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_26Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.26!»

**Fajly:**
- `src/components/Hype42_26.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_26.ts` — `getHype42_26():Hype`, `claim42_26():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_26.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-26')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/26` → `{count,season}` + `POST /magnum/api/hype42/26/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-26')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 26 + skin `hype42-26-fire` epic conic-gold
- sharing «42.26 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.26`
- analitika: `console.log('[magnum] hype42-26:', {count,reward})` bez vneshnikh trekerov

### 7.27 Bratukha-Ficha 42.27 — khajp-modul 27 dlya MAGNUM

**Ideya:**
Modul 42.27: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 27, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 27, konvejer 27, vetryak 27).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.27!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-27:{count:number,lastDate:string,claimed:boolean,season:27}` LS — progress modulya 27
- `magnum-42-27-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-27-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_27(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_27Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🔥 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_27Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_27Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+42 monet, bratukha!»
- `Hype42_27History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_27Badge` v `NavGrid` — bejdzh «42.27 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_27Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.27!»

**Fajly:**
- `src/components/Hype42_27.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_27.ts` — `getHype42_27():Hype`, `claim42_27():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_27.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-27')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/27` → `{count,season}` + `POST /magnum/api/hype42/27/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-27')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 27 + skin `hype42-27-fire` epic conic-gold
- sharing «42.27 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.27`
- analitika: `console.log('[magnum] hype42-27:', {count,reward})` bez vneshnikh trekerov

### 7.28 Bratukha-Ficha 42.28 — khajp-modul 28 dlya MAGNUM

**Ideya:**
Modul 42.28: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 28, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 28, konvejer 28, vetryak 28).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.28!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-28:{count:number,lastDate:string,claimed:boolean,season:28}` LS — progress modulya 28
- `magnum-42-28-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-28-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_28(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_28Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🪼 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_28Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_28Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+84 monet, bratukha!»
- `Hype42_28History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_28Badge` v `NavGrid` — bejdzh «42.28 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_28Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.28!»

**Fajly:**
- `src/components/Hype42_28.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_28.ts` — `getHype42_28():Hype`, `claim42_28():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_28.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-28')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/28` → `{count,season}` + `POST /magnum/api/hype42/28/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-28')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 28 + skin `hype42-28-fire` epic conic-gold
- sharing «42.28 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.28`
- analitika: `console.log('[magnum] hype42-28:', {count,reward})` bez vneshnikh trekerov

### 7.29 Bratukha-Ficha 42.29 — khajp-modul 29 dlya MAGNUM

**Ideya:**
Modul 42.29: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 29, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 29, konvejer 29, vetryak 29).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.29!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-29:{count:number,lastDate:string,claimed:boolean,season:29}` LS — progress modulya 29
- `magnum-42-29-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-29-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_29(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_29Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🔥 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_29Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_29Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+126 monet, bratukha!»
- `Hype42_29History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_29Badge` v `NavGrid` — bejdzh «42.29 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_29Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.29!»

**Fajly:**
- `src/components/Hype42_29.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_29.ts` — `getHype42_29():Hype`, `claim42_29():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_29.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-29')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/29` → `{count,season}` + `POST /magnum/api/hype42/29/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-29')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 29 + skin `hype42-29-fire` epic conic-gold
- sharing «42.29 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.29`
- analitika: `console.log('[magnum] hype42-29:', {count,reward})` bez vneshnikh trekerov

### 7.30 Bratukha-Ficha 42.30 — khajp-modul 30 dlya MAGNUM

**Ideya:**
Modul 42.30: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 30, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 30, konvejer 30, vetryak 30).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.30!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-30:{count:number,lastDate:string,claimed:boolean,season:30}` LS — progress modulya 30
- `magnum-42-30-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-30-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_30(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_30Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🪼 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_30Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_30Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+42 monet, bratukha!»
- `Hype42_30History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_30Badge` v `NavGrid` — bejdzh «42.30 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_30Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.30!»

**Fajly:**
- `src/components/Hype42_30.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_30.ts` — `getHype42_30():Hype`, `claim42_30():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_30.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-30')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/30` → `{count,season}` + `POST /magnum/api/hype42/30/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-30')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 30 + skin `hype42-30-fire` epic conic-gold
- sharing «42.30 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.30`
- analitika: `console.log('[magnum] hype42-30:', {count,reward})` bez vneshnikh trekerov

### 7.31 Bratukha-Ficha 42.31 — khajp-modul 31 dlya MAGNUM

**Ideya:**
Modul 42.31: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 31, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 31, konvejer 31, vetryak 31).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.31!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-31:{count:number,lastDate:string,claimed:boolean,season:31}` LS — progress modulya 31
- `magnum-42-31-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-31-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_31(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_31Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🔥 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_31Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_31Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+84 monet, bratukha!»
- `Hype42_31History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_31Badge` v `NavGrid` — bejdzh «42.31 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_31Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.31!»

**Fajly:**
- `src/components/Hype42_31.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_31.ts` — `getHype42_31():Hype`, `claim42_31():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_31.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-31')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/31` → `{count,season}` + `POST /magnum/api/hype42/31/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-31')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 31 + skin `hype42-31-fire` epic conic-gold
- sharing «42.31 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.31`
- analitika: `console.log('[magnum] hype42-31:', {count,reward})` bez vneshnikh trekerov

### 7.32 Bratukha-Ficha 42.32 — khajp-modul 32 dlya MAGNUM

**Ideya:**
Modul 42.32: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 32, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 32, konvejer 32, vetryak 32).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.32!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-32:{count:number,lastDate:string,claimed:boolean,season:32}` LS — progress modulya 32
- `magnum-42-32-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-32-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_32(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_32Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🪼 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_32Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_32Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+126 monet, bratukha!»
- `Hype42_32History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_32Badge` v `NavGrid` — bejdzh «42.32 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_32Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.32!»

**Fajly:**
- `src/components/Hype42_32.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_32.ts` — `getHype42_32():Hype`, `claim42_32():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_32.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-32')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/32` → `{count,season}` + `POST /magnum/api/hype42/32/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-32')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 32 + skin `hype42-32-fire` epic conic-gold
- sharing «42.32 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.32`
- analitika: `console.log('[magnum] hype42-32:', {count,reward})` bez vneshnikh trekerov

### 7.33 Bratukha-Ficha 42.33 — khajp-modul 33 dlya MAGNUM

**Ideya:**
Modul 42.33: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 33, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 33, konvejer 33, vetryak 33).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.33!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-33:{count:number,lastDate:string,claimed:boolean,season:33}` LS — progress modulya 33
- `magnum-42-33-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-33-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_33(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_33Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🔥 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_33Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_33Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+42 monet, bratukha!»
- `Hype42_33History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_33Badge` v `NavGrid` — bejdzh «42.33 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_33Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.33!»

**Fajly:**
- `src/components/Hype42_33.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_33.ts` — `getHype42_33():Hype`, `claim42_33():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_33.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-33')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/33` → `{count,season}` + `POST /magnum/api/hype42/33/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-33')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 33 + skin `hype42-33-fire` epic conic-gold
- sharing «42.33 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.33`
- analitika: `console.log('[magnum] hype42-33:', {count,reward})` bez vneshnikh trekerov

### 7.34 Bratukha-Ficha 42.34 — khajp-modul 34 dlya MAGNUM

**Ideya:**
Modul 42.34: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 34, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 34, konvejer 34, vetryak 34).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.34!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-34:{count:number,lastDate:string,claimed:boolean,season:34}` LS — progress modulya 34
- `magnum-42-34-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-34-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_34(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_34Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🪼 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_34Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_34Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+84 monet, bratukha!»
- `Hype42_34History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_34Badge` v `NavGrid` — bejdzh «42.34 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_34Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.34!»

**Fajly:**
- `src/components/Hype42_34.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_34.ts` — `getHype42_34():Hype`, `claim42_34():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_34.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-34')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/34` → `{count,season}` + `POST /magnum/api/hype42/34/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-34')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 34 + skin `hype42-34-fire` epic conic-gold
- sharing «42.34 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.34`
- analitika: `console.log('[magnum] hype42-34:', {count,reward})` bez vneshnikh trekerov

### 7.35 Bratukha-Ficha 42.35 — khajp-modul 35 dlya MAGNUM

**Ideya:**
Modul 42.35: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 35, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 35, konvejer 35, vetryak 35).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.35!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-35:{count:number,lastDate:string,claimed:boolean,season:35}` LS — progress modulya 35
- `magnum-42-35-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-35-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_35(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_35Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🔥 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_35Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_35Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+126 monet, bratukha!»
- `Hype42_35History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_35Badge` v `NavGrid` — bejdzh «42.35 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_35Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.35!»

**Fajly:**
- `src/components/Hype42_35.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_35.ts` — `getHype42_35():Hype`, `claim42_35():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_35.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-35')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/35` → `{count,season}` + `POST /magnum/api/hype42/35/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-35')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 35 + skin `hype42-35-fire` epic conic-gold
- sharing «42.35 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.35`
- analitika: `console.log('[magnum] hype42-35:', {count,reward})` bez vneshnikh trekerov

### 7.36 Bratukha-Ficha 42.36 — khajp-modul 36 dlya MAGNUM

**Ideya:**
Modul 42.36: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 36, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 36, konvejer 36, vetryak 36).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.36!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-36:{count:number,lastDate:string,claimed:boolean,season:36}` LS — progress modulya 36
- `magnum-42-36-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-36-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_36(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_36Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🪼 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_36Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_36Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+42 monet, bratukha!»
- `Hype42_36History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_36Badge` v `NavGrid` — bejdzh «42.36 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_36Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.36!»

**Fajly:**
- `src/components/Hype42_36.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_36.ts` — `getHype42_36():Hype`, `claim42_36():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_36.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-36')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/36` → `{count,season}` + `POST /magnum/api/hype42/36/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-36')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 36 + skin `hype42-36-fire` epic conic-gold
- sharing «42.36 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.36`
- analitika: `console.log('[magnum] hype42-36:', {count,reward})` bez vneshnikh trekerov

### 7.37 Bratukha-Ficha 42.37 — khajp-modul 37 dlya MAGNUM

**Ideya:**
Modul 42.37: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 37, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 37, konvejer 37, vetryak 37).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.37!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-37:{count:number,lastDate:string,claimed:boolean,season:37}` LS — progress modulya 37
- `magnum-42-37-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-37-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_37(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_37Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🔥 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_37Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_37Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+84 monet, bratukha!»
- `Hype42_37History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_37Badge` v `NavGrid` — bejdzh «42.37 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_37Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.37!»

**Fajly:**
- `src/components/Hype42_37.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_37.ts` — `getHype42_37():Hype`, `claim42_37():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_37.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-37')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/37` → `{count,season}` + `POST /magnum/api/hype42/37/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-37')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 37 + skin `hype42-37-fire` epic conic-gold
- sharing «42.37 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.37`
- analitika: `console.log('[magnum] hype42-37:', {count,reward})` bez vneshnikh trekerov

### 7.38 Bratukha-Ficha 42.38 — khajp-modul 38 dlya MAGNUM

**Ideya:**
Modul 42.38: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 38, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 38, konvejer 38, vetryak 38).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.38!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-38:{count:number,lastDate:string,claimed:boolean,season:38}` LS — progress modulya 38
- `magnum-42-38-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-38-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_38(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_38Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🪼 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_38Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_38Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+126 monet, bratukha!»
- `Hype42_38History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_38Badge` v `NavGrid` — bejdzh «42.38 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_38Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.38!»

**Fajly:**
- `src/components/Hype42_38.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_38.ts` — `getHype42_38():Hype`, `claim42_38():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_38.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-38')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/38` → `{count,season}` + `POST /magnum/api/hype42/38/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-38')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 38 + skin `hype42-38-fire` epic conic-gold
- sharing «42.38 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.38`
- analitika: `console.log('[magnum] hype42-38:', {count,reward})` bez vneshnikh trekerov

### 7.39 Bratukha-Ficha 42.39 — khajp-modul 39 dlya MAGNUM

**Ideya:**
Modul 42.39: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 39, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 39, konvejer 39, vetryak 39).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.39!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-39:{count:number,lastDate:string,claimed:boolean,season:39}` LS — progress modulya 39
- `magnum-42-39-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-39-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_39(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_39Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🔥 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_39Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_39Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+42 monet, bratukha!»
- `Hype42_39History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_39Badge` v `NavGrid` — bejdzh «42.39 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_39Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.39!»

**Fajly:**
- `src/components/Hype42_39.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_39.ts` — `getHype42_39():Hype`, `claim42_39():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_39.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-39')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/39` → `{count,season}` + `POST /magnum/api/hype42/39/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-39')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 39 + skin `hype42-39-fire` epic conic-gold
- sharing «42.39 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.39`
- analitika: `console.log('[magnum] hype42-39:', {count,reward})` bez vneshnikh trekerov

### 7.40 Bratukha-Ficha 42.40 — khajp-modul 40 dlya MAGNUM

**Ideya:**
Modul 42.40: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 40, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 40, konvejer 40, vetryak 40).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.40!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-40:{count:number,lastDate:string,claimed:boolean,season:40}` LS — progress modulya 40
- `magnum-42-40-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-40-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_40(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_40Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🪼 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_40Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_40Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+84 monet, bratukha!»
- `Hype42_40History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_40Badge` v `NavGrid` — bejdzh «42.40 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_40Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.40!»

**Fajly:**
- `src/components/Hype42_40.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_40.ts` — `getHype42_40():Hype`, `claim42_40():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_40.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-40')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/40` → `{count,season}` + `POST /magnum/api/hype42/40/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-40')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 40 + skin `hype42-40-fire` epic conic-gold
- sharing «42.40 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.40`
- analitika: `console.log('[magnum] hype42-40:', {count,reward})` bez vneshnikh trekerov

### 7.41 Bratukha-Ficha 42.41 — khajp-modul 41 dlya MAGNUM

**Ideya:**
Modul 42.41: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 41, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 41, konvejer 41, vetryak 41).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.41!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-41:{count:number,lastDate:string,claimed:boolean,season:41}` LS — progress modulya 41
- `magnum-42-41-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-41-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_41(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_41Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🔥 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_41Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_41Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+126 monet, bratukha!»
- `Hype42_41History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_41Badge` v `NavGrid` — bejdzh «42.41 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_41Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.41!»

**Fajly:**
- `src/components/Hype42_41.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_41.ts` — `getHype42_41():Hype`, `claim42_41():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_41.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-41')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/41` → `{count,season}` + `POST /magnum/api/hype42/41/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-41')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 41 + skin `hype42-41-fire` epic conic-gold
- sharing «42.41 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.41`
- analitika: `console.log('[magnum] hype42-41:', {count,reward})` bez vneshnikh trekerov

### 7.42 Bratukha-Ficha 42.42 — khajp-modul 42 dlya MAGNUM

**Ideya:**
Modul 42.42: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 42, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 42, konvejer 42, vetryak 42).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.42!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-42:{count:number,lastDate:string,claimed:boolean,season:42}` LS — progress modulya 42
- `magnum-42-42-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-42-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_42(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_42Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🪼 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_42Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_42Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+42 monet, bratukha!»
- `Hype42_42History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_42Badge` v `NavGrid` — bejdzh «42.42 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_42Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.42!»

**Fajly:**
- `src/components/Hype42_42.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_42.ts` — `getHype42_42():Hype`, `claim42_42():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_42.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-42')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/42` → `{count,season}` + `POST /magnum/api/hype42/42/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-42')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 42 + skin `hype42-42-fire` epic conic-gold
- sharing «42.42 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.42`
- analitika: `console.log('[magnum] hype42-42:', {count,reward})` bez vneshnikh trekerov

### 7.43 Bratukha-Ficha 42.43 — khajp-modul 43 dlya MAGNUM

**Ideya:**
Modul 42.43: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 43, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 43, konvejer 43, vetryak 43).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.43!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-43:{count:number,lastDate:string,claimed:boolean,season:43}` LS — progress modulya 43
- `magnum-42-43-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-43-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_43(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_43Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🔥 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_43Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_43Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+84 monet, bratukha!»
- `Hype42_43History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_43Badge` v `NavGrid` — bejdzh «42.43 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_43Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.43!»

**Fajly:**
- `src/components/Hype42_43.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_43.ts` — `getHype42_43():Hype`, `claim42_43():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_43.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-43')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/43` → `{count,season}` + `POST /magnum/api/hype42/43/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-43')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 43 + skin `hype42-43-fire` epic conic-gold
- sharing «42.43 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.43`
- analitika: `console.log('[magnum] hype42-43:', {count,reward})` bez vneshnikh trekerov

### 7.44 Bratukha-Ficha 42.44 — khajp-modul 44 dlya MAGNUM

**Ideya:**
Modul 42.44: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 44, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 44, konvejer 44, vetryak 44).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.44!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-44:{count:number,lastDate:string,claimed:boolean,season:44}` LS — progress modulya 44
- `magnum-42-44-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-44-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_44(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_44Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🪼 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_44Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_44Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+126 monet, bratukha!»
- `Hype42_44History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_44Badge` v `NavGrid` — bejdzh «42.44 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_44Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.44!»

**Fajly:**
- `src/components/Hype42_44.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_44.ts` — `getHype42_44():Hype`, `claim42_44():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_44.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-44')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/44` → `{count,season}` + `POST /magnum/api/hype42/44/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-44')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 44 + skin `hype42-44-fire` epic conic-gold
- sharing «42.44 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.44`
- analitika: `console.log('[magnum] hype42-44:', {count,reward})` bez vneshnikh trekerov

### 7.45 Bratukha-Ficha 42.45 — khajp-modul 45 dlya MAGNUM

**Ideya:**
Modul 42.45: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 45, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 45, konvejer 45, vetryak 45).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.45!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-45:{count:number,lastDate:string,claimed:boolean,season:45}` LS — progress modulya 45
- `magnum-42-45-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-45-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_45(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_45Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🔥 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_45Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_45Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+42 monet, bratukha!»
- `Hype42_45History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_45Badge` v `NavGrid` — bejdzh «42.45 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_45Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.45!»

**Fajly:**
- `src/components/Hype42_45.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_45.ts` — `getHype42_45():Hype`, `claim42_45():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_45.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-45')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/45` → `{count,season}` + `POST /magnum/api/hype42/45/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-45')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 45 + skin `hype42-45-fire` epic conic-gold
- sharing «42.45 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.45`
- analitika: `console.log('[magnum] hype42-45:', {count,reward})` bez vneshnikh trekerov

### 7.46 Bratukha-Ficha 42.46 — khajp-modul 46 dlya MAGNUM

**Ideya:**
Modul 42.46: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 46, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 46, konvejer 46, vetryak 46).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.46!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-46:{count:number,lastDate:string,claimed:boolean,season:46}` LS — progress modulya 46
- `magnum-42-46-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-46-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_46(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_46Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🪼 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_46Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_46Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+84 monet, bratukha!»
- `Hype42_46History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_46Badge` v `NavGrid` — bejdzh «42.46 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_46Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.46!»

**Fajly:**
- `src/components/Hype42_46.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_46.ts` — `getHype42_46():Hype`, `claim42_46():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_46.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-46')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/46` → `{count,season}` + `POST /magnum/api/hype42/46/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-46')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 46 + skin `hype42-46-fire` epic conic-gold
- sharing «42.46 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.46`
- analitika: `console.log('[magnum] hype42-46:', {count,reward})` bez vneshnikh trekerov

### 7.47 Bratukha-Ficha 42.47 — khajp-modul 47 dlya MAGNUM

**Ideya:**
Modul 42.47: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 47, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 47, konvejer 47, vetryak 47).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.47!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-47:{count:number,lastDate:string,claimed:boolean,season:47}` LS — progress modulya 47
- `magnum-42-47-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-47-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_47(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_47Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🔥 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_47Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_47Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+126 monet, bratukha!»
- `Hype42_47History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_47Badge` v `NavGrid` — bejdzh «42.47 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_47Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.47!»

**Fajly:**
- `src/components/Hype42_47.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_47.ts` — `getHype42_47():Hype`, `claim42_47():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_47.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-47')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/47` → `{count,season}` + `POST /magnum/api/hype42/47/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-47')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 47 + skin `hype42-47-fire` epic conic-gold
- sharing «42.47 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.47`
- analitika: `console.log('[magnum] hype42-47:', {count,reward})` bez vneshnikh trekerov

### 7.48 Bratukha-Ficha 42.48 — khajp-modul 48 dlya MAGNUM

**Ideya:**
Modul 42.48: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 48, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 48, konvejer 48, vetryak 48).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.48!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-48:{count:number,lastDate:string,claimed:boolean,season:48}` LS — progress modulya 48
- `magnum-42-48-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-48-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_48(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_48Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🪼 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_48Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_48Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+42 monet, bratukha!»
- `Hype42_48History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_48Badge` v `NavGrid` — bejdzh «42.48 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_48Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.48!»

**Fajly:**
- `src/components/Hype42_48.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_48.ts` — `getHype42_48():Hype`, `claim42_48():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_48.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-48')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/48` → `{count,season}` + `POST /magnum/api/hype42/48/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-48')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 48 + skin `hype42-48-fire` epic conic-gold
- sharing «42.48 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.48`
- analitika: `console.log('[magnum] hype42-48:', {count,reward})` bez vneshnikh trekerov

### 7.49 Bratukha-Ficha 42.49 — khajp-modul 49 dlya MAGNUM

**Ideya:**
Modul 42.49: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 49, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 49, konvejer 49, vetryak 49).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.49!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-49:{count:number,lastDate:string,claimed:boolean,season:49}` LS — progress modulya 49
- `magnum-42-49-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-49-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_49(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_49Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🔥 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_49Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_49Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+84 monet, bratukha!»
- `Hype42_49History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_49Badge` v `NavGrid` — bejdzh «42.49 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_49Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.49!»

**Fajly:**
- `src/components/Hype42_49.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_49.ts` — `getHype42_49():Hype`, `claim42_49():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_49.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-49')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/49` → `{count,season}` + `POST /magnum/api/hype42/49/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-49')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 49 + skin `hype42-49-fire` epic conic-gold
- sharing «42.49 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.49`
- analitika: `console.log('[magnum] hype42-49:', {count,reward})` bez vneshnikh trekerov

### 7.50 Bratukha-Ficha 42.50 — khajp-modul 50 dlya MAGNUM

**Ideya:**
Modul 42.50: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 50, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 50, konvejer 50, vetryak 50).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.50!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-50:{count:number,lastDate:string,claimed:boolean,season:50}` LS — progress modulya 50
- `magnum-42-50-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-50-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_50(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_50Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🪼 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_50Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_50Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+126 monet, bratukha!»
- `Hype42_50History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_50Badge` v `NavGrid` — bejdzh «42.50 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_50Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.50!»

**Fajly:**
- `src/components/Hype42_50.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_50.ts` — `getHype42_50():Hype`, `claim42_50():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_50.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-50')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/50` → `{count,season}` + `POST /magnum/api/hype42/50/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-50')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 50 + skin `hype42-50-fire` epic conic-gold
- sharing «42.50 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.50`
- analitika: `console.log('[magnum] hype42-50:', {count,reward})` bez vneshnikh trekerov

### 7.51 Bratukha-Ficha 42.51 — khajp-modul 51 dlya MAGNUM

**Ideya:**
Modul 42.51: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 51, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 51, konvejer 51, vetryak 51).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.51!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-51:{count:number,lastDate:string,claimed:boolean,season:51}` LS — progress modulya 51
- `magnum-42-51-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-51-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_51(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_51Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🔥 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_51Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_51Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+42 monet, bratukha!»
- `Hype42_51History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_51Badge` v `NavGrid` — bejdzh «42.51 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_51Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.51!»

**Fajly:**
- `src/components/Hype42_51.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_51.ts` — `getHype42_51():Hype`, `claim42_51():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_51.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-51')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/51` → `{count,season}` + `POST /magnum/api/hype42/51/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-51')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 51 + skin `hype42-51-fire` epic conic-gold
- sharing «42.51 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.51`
- analitika: `console.log('[magnum] hype42-51:', {count,reward})` bez vneshnikh trekerov

### 7.52 Bratukha-Ficha 42.52 — khajp-modul 52 dlya MAGNUM

**Ideya:**
Modul 42.52: bratukha zakhodit na /magnum/, zhmet «Delaj 42» i poluchaet randomnyj ivent s nagradoj 42/142/420. Sezon 52, FOMO-tajmer 42ch, push «krinzha ne sushchestvuet, delaj!». Integratsiya s Freakland Create — kazhdyj ivent svyazan s mekhanizmom Create (shesternya 52, konvejer 52, vetryak 52).
Ezhednevnyj limit 3 prokruta, kuldaun 6ch v LS, anti-abuz po IP na servere v2. Sharing «Ya sdelal 42.52!» + OG-kartinka.

**LS klyuchi:**
- `magnum-42-52:{count:number,lastDate:string,claimed:boolean,season:52}` LS — progress modulya 52
- `magnum-42-52-cooldown:ISO` — kuldaun 6ch, `Date.now()+6*3600*1000`
- `magnum-coins:number` — edinyj koshelek `src/lib/coins.ts` (`getCoins/addCoins/subscribe`)
- `magnum-42-52-history:{date,reward}[]` — poslednie 20 prokrutov dlya grafika
- server v2: `magnum_hype42_52(user_id, count, last_date, season)` + `magnum_coins(balance)` — anti-chit po date

**UI bloki:**
- `Hype42_52Card` — kartochka 280px s gradientom `linear-gradient(135deg,#ff2d55,#5865f2)` + emoji 🪼 + knopka «Delaj 42» `GSAP scale 1→1.02 hover`
- `Hype42_52Timer` — FOMO-tajmer 42:00:00, puls `scale 1→1.04` kazhduyu sek, `prefers-reduced-motion` — bez pulsa
- `Hype42_52Reward` — konfetti 120 chastits canvas + `addCoins(reward)` + tost «+84 monet, bratukha!»
- `Hype42_52History` — mini-grafik 20 barov, pustoe «poka pusto — delaj pervym!»
- `Hype42_52Badge` v `NavGrid` — bejdzh «42.52 LIVE» RGB-puls `animation: pulse 1.2s infinite`
- `Hype42_52Share` — sharing OG 1080×1080 reuse `ShareCard` canvas + tekst «Ya zakryl 42.52!»

**Fajly:**
- `src/components/Hype42_52.tsx` — kartochka + tajmer + konfetti + `useGSAP stagger`
- `src/lib/hype42_52.ts` — `getHype42_52():Hype`, `claim42_52():{reward}`, `canClaim():bool`, `cooldownLeft():ms`
- `src/components/Hype42_52.module.css` — kartochka, tajmer, `@keyframes pulse`, `prefers-reduced-motion` guard
- `src/pages/HomePage.tsx` — vidzhet nad `RecapQuest`, `useEffect → tick()` na maunte
- `src/lib/coins.ts` — bez izmenenij, `addCoins` + `storage` sync + `BroadcastChannel('hype42-52')`
- `server.ts` (budushchee) — `GET /magnum/api/hype42/52` → `{count,season}` + `POST /magnum/api/hype42/52/claim`

**Edge:**
- chasovoj poyas — `toDateString()` lokalno, `lastDate` v budushchem → sbros + tost «vremya shalyat, sbroshen»
- LS bityj JSON — `try{JSON.parse}catch→fallback {count:0}` + `removeItem` bitogo
- povtor claim — idempotentno `if(claimed) return`, bez dvojnoj nagrady
- nagrada NaN — `Number.isFinite(reward)?reward:0`, klamp cherez `addCoins`
- privatnyj rezhim — `try/catch` vokrug LS + tost «progress ne sokhranitsya»
- `prefers-reduced-motion` — bez GSAP/confetti, statichno
- dve vkladki — `storage` event + `BroadcastChannel('hype42-52')` instant sync
- chip `claimed` — server v2 sravnivaet `lastDate` i `count`, klientsikij ne doveryaem

**Nagrada/khajp:**
- 42 za prokrut, 142 za 3/7, 420 za 7/7, 1420 za sezon 52 + skin `hype42-52-fire` epic conic-gold
- sharing «42.52 — krinzha ne sushchestvuet, delaj, bratukha! 🔥» + OG-kartinka + `PRESAVE https://music.thefence.me/psmagnum` CTA
- kross-ficha: triggerit `StreakCalendar` + `RecapQuest` + `Leaderboard` bejdzh `HYPE 42.52`
- analitika: `console.log('[magnum] hype42-52:', {count,reward})` bez vneshnikh trekerov

### 7.53 Bratukha-Ficha 42.53 — khajp-modul 53

**Ideya:**
Modul 42.53: bratukha delaj 53 cherez /magnum/ — random ivent 42/142/420, FOMO 42ch, Create shesternya 53. Limit 3/d, cooldown 6ch LS, anti-abuz IP v2. Sharing 42.53 OG.
Detal: kazhdyj den 1 quest 53 — otkryt 3 recaps + klik 42 + quiz 1Q. Progress LS `magnum-42-53`.

**LS klyuchi:**
- `magnum-42-53:{count,lastDate,claimed,season:53}`
- `magnum-42-53-cooldown:ISO`
- `magnum-coins:number` `src/lib/coins.ts`
- `magnum-42-53-history:[]`
- server v2: `magnum_hype42_53(user_id,count,last_date)`

**UI bloki:**
- `Hype42_53Card` gradient `linear-gradient(135deg,#ff2d55,#5865f2)` emoji 🔥
- `Hype42_53Timer` 42:00:00 puls scale 1→1.04
- `Hype42_53Reward` konfetti 120 + addCoins
- `Hype42_53History` 20 barov
- `Hype42_53Badge` NavGrid 42.53 LIVE
- `Hype42_53Share` OG 1080

**Fajly:**
- `src/components/Hype42_53.tsx`
- `src/lib/hype42_53.ts` get/claim/can/cooldown
- `src/components/Hype42_53.module.css` pulse
- `src/pages/HomePage.tsx` widget
- `src/lib/coins.ts`
- `server.ts` GET/POST /magnum/api/hype42/53

**Edge:**
- toDateString lokalno future sbros
- LS bityj fallback {count:0}
- povtor claim idempotent
- NaN klamp addCoins
- privatnyj try/catch
- prefers-reduced-motion statichno
- dve vkladki BroadcastChannel
- server sravnivaet lastDate

**Nagrada/khajp:**
- 42/142/420/1420 sezon 53 skin hype42-53-fire epic
- sharing 42.53 krinzha ne sushchestvuet + PRESAVE https://music.thefence.me/psmagnum
- kross StreakCalendar RecapQuest Leaderboard HYPE 42.53
- console.log('[magnum] hype42-53')

### 7.54 Bratukha-Ficha 42.54 — khajp-modul 54

**Ideya:**
Modul 42.54: bratukha delaj 54 cherez /magnum/ — random ivent 42/142/420, FOMO 42ch, Create shesternya 54. Limit 3/d, cooldown 6ch LS, anti-abuz IP v2. Sharing 42.54 OG.
Detal: kazhdyj den 1 quest 54 — otkryt 3 recaps + klik 42 + quiz 1Q. Progress LS `magnum-42-54`.

**LS klyuchi:**
- `magnum-42-54:{count,lastDate,claimed,season:54}`
- `magnum-42-54-cooldown:ISO`
- `magnum-coins:number` `src/lib/coins.ts`
- `magnum-42-54-history:[]`
- server v2: `magnum_hype42_54(user_id,count,last_date)`

**UI bloki:**
- `Hype42_54Card` gradient `linear-gradient(135deg,#ff2d55,#5865f2)` emoji 🪼
- `Hype42_54Timer` 42:00:00 puls scale 1→1.04
- `Hype42_54Reward` konfetti 120 + addCoins
- `Hype42_54History` 20 barov
- `Hype42_54Badge` NavGrid 42.54 LIVE
- `Hype42_54Share` OG 1080

**Fajly:**
- `src/components/Hype42_54.tsx`
- `src/lib/hype42_54.ts` get/claim/can/cooldown
- `src/components/Hype42_54.module.css` pulse
- `src/pages/HomePage.tsx` widget
- `src/lib/coins.ts`
- `server.ts` GET/POST /magnum/api/hype42/54

**Edge:**
- toDateString lokalno future sbros
- LS bityj fallback {count:0}
- povtor claim idempotent
- NaN klamp addCoins
- privatnyj try/catch
- prefers-reduced-motion statichno
- dve vkladki BroadcastChannel
- server sravnivaet lastDate

**Nagrada/khajp:**
- 42/142/420/1420 sezon 54 skin hype42-54-fire epic
- sharing 42.54 krinzha ne sushchestvuet + PRESAVE https://music.thefence.me/psmagnum
- kross StreakCalendar RecapQuest Leaderboard HYPE 42.54
- console.log('[magnum] hype42-54')

### 7.55 Bratukha-Ficha 42.55 — khajp-modul 55

**Ideya:**
Modul 42.55: bratukha delaj 55 cherez /magnum/ — random ivent 42/142/420, FOMO 42ch, Create shesternya 55. Limit 3/d, cooldown 6ch LS, anti-abuz IP v2. Sharing 42.55 OG.
Detal: kazhdyj den 1 quest 55 — otkryt 3 recaps + klik 42 + quiz 1Q. Progress LS `magnum-42-55`.

**LS klyuchi:**
- `magnum-42-55:{count,lastDate,claimed,season:55}`
- `magnum-42-55-cooldown:ISO`
- `magnum-coins:number` `src/lib/coins.ts`
- `magnum-42-55-history:[]`
- server v2: `magnum_hype42_55(user_id,count,last_date)`

**UI bloki:**
- `Hype42_55Card` gradient `linear-gradient(135deg,#ff2d55,#5865f2)` emoji 🔥
- `Hype42_55Timer` 42:00:00 puls scale 1→1.04
- `Hype42_55Reward` konfetti 120 + addCoins
- `Hype42_55History` 20 barov
- `Hype42_55Badge` NavGrid 42.55 LIVE
- `Hype42_55Share` OG 1080

**Fajly:**
- `src/components/Hype42_55.tsx`
- `src/lib/hype42_55.ts` get/claim/can/cooldown
- `src/components/Hype42_55.module.css` pulse
- `src/pages/HomePage.tsx` widget
- `src/lib/coins.ts`
- `server.ts` GET/POST /magnum/api/hype42/55

**Edge:**
- toDateString lokalno future sbros
- LS bityj fallback {count:0}
- povtor claim idempotent
- NaN klamp addCoins
- privatnyj try/catch
- prefers-reduced-motion statichno
- dve vkladki BroadcastChannel
- server sravnivaet lastDate

**Nagrada/khajp:**
- 42/142/420/1420 sezon 55 skin hype42-55-fire epic
- sharing 42.55 krinzha ne sushchestvuet + PRESAVE https://music.thefence.me/psmagnum
- kross StreakCalendar RecapQuest Leaderboard HYPE 42.55
- console.log('[magnum] hype42-55')

### 7.56 Bratukha-Ficha 42.56 — khajp-modul 56

**Ideya:**
Modul 42.56: bratukha delaj 56 cherez /magnum/ — random ivent 42/142/420, FOMO 42ch, Create shesternya 56. Limit 3/d, cooldown 6ch LS, anti-abuz IP v2. Sharing 42.56 OG.
Detal: kazhdyj den 1 quest 56 — otkryt 3 recaps + klik 42 + quiz 1Q. Progress LS `magnum-42-56`.

**LS klyuchi:**
- `magnum-42-56:{count,lastDate,claimed,season:56}`
- `magnum-42-56-cooldown:ISO`
- `magnum-coins:number` `src/lib/coins.ts`
- `magnum-42-56-history:[]`
- server v2: `magnum_hype42_56(user_id,count,last_date)`

**UI bloki:**
- `Hype42_56Card` gradient `linear-gradient(135deg,#ff2d55,#5865f2)` emoji 🪼
- `Hype42_56Timer` 42:00:00 puls scale 1→1.04
- `Hype42_56Reward` konfetti 120 + addCoins
- `Hype42_56History` 20 barov
- `Hype42_56Badge` NavGrid 42.56 LIVE
- `Hype42_56Share` OG 1080

**Fajly:**
- `src/components/Hype42_56.tsx`
- `src/lib/hype42_56.ts` get/claim/can/cooldown
- `src/components/Hype42_56.module.css` pulse
- `src/pages/HomePage.tsx` widget
- `src/lib/coins.ts`
- `server.ts` GET/POST /magnum/api/hype42/56

**Edge:**
- toDateString lokalno future sbros
- LS bityj fallback {count:0}
- povtor claim idempotent
- NaN klamp addCoins
- privatnyj try/catch
- prefers-reduced-motion statichno
- dve vkladki BroadcastChannel
- server sravnivaet lastDate

**Nagrada/khajp:**
- 42/142/420/1420 sezon 56 skin hype42-56-fire epic
- sharing 42.56 krinzha ne sushchestvuet + PRESAVE https://music.thefence.me/psmagnum
- kross StreakCalendar RecapQuest Leaderboard HYPE 42.56
- console.log('[magnum] hype42-56')

### 7.57 Bratukha-Ficha 42.57 — khajp-modul 57

**Ideya:**
Modul 42.57: bratukha delaj 57 cherez /magnum/ — random ivent 42/142/420, FOMO 42ch, Create shesternya 57. Limit 3/d, cooldown 6ch LS, anti-abuz IP v2. Sharing 42.57 OG.
Detal: kazhdyj den 1 quest 57 — otkryt 3 recaps + klik 42 + quiz 1Q. Progress LS `magnum-42-57`.

**LS klyuchi:**
- `magnum-42-57:{count,lastDate,claimed,season:57}`
- `magnum-42-57-cooldown:ISO`
- `magnum-coins:number` `src/lib/coins.ts`
- `magnum-42-57-history:[]`
- server v2: `magnum_hype42_57(user_id,count,last_date)`

**UI bloki:**
- `Hype42_57Card` gradient `linear-gradient(135deg,#ff2d55,#5865f2)` emoji 🔥
- `Hype42_57Timer` 42:00:00 puls scale 1→1.04
- `Hype42_57Reward` konfetti 120 + addCoins
- `Hype42_57History` 20 barov
- `Hype42_57Badge` NavGrid 42.57 LIVE
- `Hype42_57Share` OG 1080

**Fajly:**
- `src/components/Hype42_57.tsx`
- `src/lib/hype42_57.ts` get/claim/can/cooldown
- `src/components/Hype42_57.module.css` pulse
- `src/pages/HomePage.tsx` widget
- `src/lib/coins.ts`
- `server.ts` GET/POST /magnum/api/hype42/57

**Edge:**
- toDateString lokalno future sbros
- LS bityj fallback {count:0}
- povtor claim idempotent
- NaN klamp addCoins
- privatnyj try/catch
- prefers-reduced-motion statichno
- dve vkladki BroadcastChannel
- server sravnivaet lastDate

**Nagrada/khajp:**
- 42/142/420/1420 sezon 57 skin hype42-57-fire epic
- sharing 42.57 krinzha ne sushchestvuet + PRESAVE https://music.thefence.me/psmagnum
- kross StreakCalendar RecapQuest Leaderboard HYPE 42.57
- console.log('[magnum] hype42-57')

### 7.58 Bratukha-Ficha 42.58 — khajp-modul 58

**Ideya:**
Modul 42.58: bratukha delaj 58 cherez /magnum/ — random ivent 42/142/420, FOMO 42ch, Create shesternya 58. Limit 3/d, cooldown 6ch LS, anti-abuz IP v2. Sharing 42.58 OG.
Detal: kazhdyj den 1 quest 58 — otkryt 3 recaps + klik 42 + quiz 1Q. Progress LS `magnum-42-58`.

**LS klyuchi:**
- `magnum-42-58:{count,lastDate,claimed,season:58}`
- `magnum-42-58-cooldown:ISO`
- `magnum-coins:number` `src/lib/coins.ts`
- `magnum-42-58-history:[]`
- server v2: `magnum_hype42_58(user_id,count,last_date)`

**UI bloki:**
- `Hype42_58Card` gradient `linear-gradient(135deg,#ff2d55,#5865f2)` emoji 🪼
- `Hype42_58Timer` 42:00:00 puls scale 1→1.04
- `Hype42_58Reward` konfetti 120 + addCoins
- `Hype42_58History` 20 barov
- `Hype42_58Badge` NavGrid 42.58 LIVE
- `Hype42_58Share` OG 1080

**Fajly:**
- `src/components/Hype42_58.tsx`
- `src/lib/hype42_58.ts` get/claim/can/cooldown
- `src/components/Hype42_58.module.css` pulse
- `src/pages/HomePage.tsx` widget
- `src/lib/coins.ts`
- `server.ts` GET/POST /magnum/api/hype42/58

**Edge:**
- toDateString lokalno future sbros
- LS bityj fallback {count:0}
- povtor claim idempotent
- NaN klamp addCoins
- privatnyj try/catch
- prefers-reduced-motion statichno
- dve vkladki BroadcastChannel
- server sravnivaet lastDate

**Nagrada/khajp:**
- 42/142/420/1420 sezon 58 skin hype42-58-fire epic
- sharing 42.58 krinzha ne sushchestvuet + PRESAVE https://music.thefence.me/psmagnum
- kross StreakCalendar RecapQuest Leaderboard HYPE 42.58
- console.log('[magnum] hype42-58')

### 7.59 Bratukha-Ficha 42.59 — khajp-modul 59

**Ideya:**
Modul 42.59: bratukha delaj 59 cherez /magnum/ — random ivent 42/142/420, FOMO 42ch, Create shesternya 59. Limit 3/d, cooldown 6ch LS, anti-abuz IP v2. Sharing 42.59 OG.
Detal: kazhdyj den 1 quest 59 — otkryt 3 recaps + klik 42 + quiz 1Q. Progress LS `magnum-42-59`.

**LS klyuchi:**
- `magnum-42-59:{count,lastDate,claimed,season:59}`
- `magnum-42-59-cooldown:ISO`
- `magnum-coins:number` `src/lib/coins.ts`
- `magnum-42-59-history:[]`
- server v2: `magnum_hype42_59(user_id,count,last_date)`

**UI bloki:**
- `Hype42_59Card` gradient `linear-gradient(135deg,#ff2d55,#5865f2)` emoji 🔥
- `Hype42_59Timer` 42:00:00 puls scale 1→1.04
- `Hype42_59Reward` konfetti 120 + addCoins
- `Hype42_59History` 20 barov
- `Hype42_59Badge` NavGrid 42.59 LIVE
- `Hype42_59Share` OG 1080

**Fajly:**
- `src/components/Hype42_59.tsx`
- `src/lib/hype42_59.ts` get/claim/can/cooldown
- `src/components/Hype42_59.module.css` pulse
- `src/pages/HomePage.tsx` widget
- `src/lib/coins.ts`
- `server.ts` GET/POST /magnum/api/hype42/59

**Edge:**
- toDateString lokalno future sbros
- LS bityj fallback {count:0}
- povtor claim idempotent
- NaN klamp addCoins
- privatnyj try/catch
- prefers-reduced-motion statichno
- dve vkladki BroadcastChannel
- server sravnivaet lastDate

**Nagrada/khajp:**
- 42/142/420/1420 sezon 59 skin hype42-59-fire epic
- sharing 42.59 krinzha ne sushchestvuet + PRESAVE https://music.thefence.me/psmagnum
- kross StreakCalendar RecapQuest Leaderboard HYPE 42.59
- console.log('[magnum] hype42-59')

### 7.60 Bratukha-Ficha 42.60 — khajp-modul 60

**Ideya:**
Modul 42.60: bratukha delaj 60 cherez /magnum/ — random ivent 42/142/420, FOMO 42ch, Create shesternya 60. Limit 3/d, cooldown 6ch LS, anti-abuz IP v2. Sharing 42.60 OG.
Detal: kazhdyj den 1 quest 60 — otkryt 3 recaps + klik 42 + quiz 1Q. Progress LS `magnum-42-60`.

**LS klyuchi:**
- `magnum-42-60:{count,lastDate,claimed,season:60}`
- `magnum-42-60-cooldown:ISO`
- `magnum-coins:number` `src/lib/coins.ts`
- `magnum-42-60-history:[]`
- server v2: `magnum_hype42_60(user_id,count,last_date)`

**UI bloki:**
- `Hype42_60Card` gradient `linear-gradient(135deg,#ff2d55,#5865f2)` emoji 🪼
- `Hype42_60Timer` 42:00:00 puls scale 1→1.04
- `Hype42_60Reward` konfetti 120 + addCoins
- `Hype42_60History` 20 barov
- `Hype42_60Badge` NavGrid 42.60 LIVE
- `Hype42_60Share` OG 1080

**Fajly:**
- `src/components/Hype42_60.tsx`
- `src/lib/hype42_60.ts` get/claim/can/cooldown
- `src/components/Hype42_60.module.css` pulse
- `src/pages/HomePage.tsx` widget
- `src/lib/coins.ts`
- `server.ts` GET/POST /magnum/api/hype42/60

**Edge:**
- toDateString lokalno future sbros
- LS bityj fallback {count:0}
- povtor claim idempotent
- NaN klamp addCoins
- privatnyj try/catch
- prefers-reduced-motion statichno
- dve vkladki BroadcastChannel
- server sravnivaet lastDate

**Nagrada/khajp:**
- 42/142/420/1420 sezon 60 skin hype42-60-fire epic
- sharing 42.60 krinzha ne sushchestvuet + PRESAVE https://music.thefence.me/psmagnum
- kross StreakCalendar RecapQuest Leaderboard HYPE 42.60
- console.log('[magnum] hype42-60')

### 7.61 Bratukha-Ficha 42.61 — khajp-modul 61

**Ideya:**
Modul 42.61: bratukha delaj 61 cherez /magnum/ — random ivent 42/142/420, FOMO 42ch, Create shesternya 61. Limit 3/d, cooldown 6ch LS, anti-abuz IP v2. Sharing 42.61 OG.
Detal: kazhdyj den 1 quest 61 — otkryt 3 recaps + klik 42 + quiz 1Q. Progress LS `magnum-42-61`.

**LS klyuchi:**
- `magnum-42-61:{count,lastDate,claimed,season:61}`
- `magnum-42-61-cooldown:ISO`
- `magnum-coins:number` `src/lib/coins.ts`
- `magnum-42-61-history:[]`
- server v2: `magnum_hype42_61(user_id,count,last_date)`

**UI bloki:**
- `Hype42_61Card` gradient `linear-gradient(135deg,#ff2d55,#5865f2)` emoji 🔥
- `Hype42_61Timer` 42:00:00 puls scale 1→1.04
- `Hype42_61Reward` konfetti 120 + addCoins
- `Hype42_61History` 20 barov
- `Hype42_61Badge` NavGrid 42.61 LIVE
- `Hype42_61Share` OG 1080

**Fajly:**
- `src/components/Hype42_61.tsx`
- `src/lib/hype42_61.ts` get/claim/can/cooldown
- `src/components/Hype42_61.module.css` pulse
- `src/pages/HomePage.tsx` widget
- `src/lib/coins.ts`
- `server.ts` GET/POST /magnum/api/hype42/61

**Edge:**
- toDateString lokalno future sbros
- LS bityj fallback {count:0}
- povtor claim idempotent
- NaN klamp addCoins
- privatnyj try/catch
- prefers-reduced-motion statichno
- dve vkladki BroadcastChannel
- server sravnivaet lastDate

**Nagrada/khajp:**
- 42/142/420/1420 sezon 61 skin hype42-61-fire epic
- sharing 42.61 krinzha ne sushchestvuet + PRESAVE https://music.thefence.me/psmagnum
- kross StreakCalendar RecapQuest Leaderboard HYPE 42.61
- console.log('[magnum] hype42-61')

### 7.62 Bratukha-Ficha 42.62 — khajp-modul 62

**Ideya:**
Modul 42.62: bratukha delaj 62 cherez /magnum/ — random ivent 42/142/420, FOMO 42ch, Create shesternya 62. Limit 3/d, cooldown 6ch LS, anti-abuz IP v2. Sharing 42.62 OG.
Detal: kazhdyj den 1 quest 62 — otkryt 3 recaps + klik 42 + quiz 1Q. Progress LS `magnum-42-62`.

**LS klyuchi:**
- `magnum-42-62:{count,lastDate,claimed,season:62}`
- `magnum-42-62-cooldown:ISO`
- `magnum-coins:number` `src/lib/coins.ts`
- `magnum-42-62-history:[]`
- server v2: `magnum_hype42_62(user_id,count,last_date)`

**UI bloki:**
- `Hype42_62Card` gradient `linear-gradient(135deg,#ff2d55,#5865f2)` emoji 🪼
- `Hype42_62Timer` 42:00:00 puls scale 1→1.04
- `Hype42_62Reward` konfetti 120 + addCoins
- `Hype42_62History` 20 barov
- `Hype42_62Badge` NavGrid 42.62 LIVE
- `Hype42_62Share` OG 1080

**Fajly:**
- `src/components/Hype42_62.tsx`
- `src/lib/hype42_62.ts` get/claim/can/cooldown
- `src/components/Hype42_62.module.css` pulse
- `src/pages/HomePage.tsx` widget
- `src/lib/coins.ts`
- `server.ts` GET/POST /magnum/api/hype42/62

**Edge:**
- toDateString lokalno future sbros
- LS bityj fallback {count:0}
- povtor claim idempotent
- NaN klamp addCoins
- privatnyj try/catch
- prefers-reduced-motion statichno
- dve vkladki BroadcastChannel
- server sravnivaet lastDate

**Nagrada/khajp:**
- 42/142/420/1420 sezon 62 skin hype42-62-fire epic
- sharing 42.62 krinzha ne sushchestvuet + PRESAVE https://music.thefence.me/psmagnum
- kross StreakCalendar RecapQuest Leaderboard HYPE 42.62
- console.log('[magnum] hype42-62')

### 7.63 Bratukha-Ficha 42.63 — khajp-modul 63

**Ideya:**
Modul 42.63: bratukha delaj 63 cherez /magnum/ — random ivent 42/142/420, FOMO 42ch, Create shesternya 63. Limit 3/d, cooldown 6ch LS, anti-abuz IP v2. Sharing 42.63 OG.
Detal: kazhdyj den 1 quest 63 — otkryt 3 recaps + klik 42 + quiz 1Q. Progress LS `magnum-42-63`.

**LS klyuchi:**
- `magnum-42-63:{count,lastDate,claimed,season:63}`
- `magnum-42-63-cooldown:ISO`
- `magnum-coins:number` `src/lib/coins.ts`
- `magnum-42-63-history:[]`
- server v2: `magnum_hype42_63(user_id,count,last_date)`

**UI bloki:**
- `Hype42_63Card` gradient `linear-gradient(135deg,#ff2d55,#5865f2)` emoji 🔥
- `Hype42_63Timer` 42:00:00 puls scale 1→1.04
- `Hype42_63Reward` konfetti 120 + addCoins
- `Hype42_63History` 20 barov
- `Hype42_63Badge` NavGrid 42.63 LIVE
- `Hype42_63Share` OG 1080

**Fajly:**
- `src/components/Hype42_63.tsx`
- `src/lib/hype42_63.ts` get/claim/can/cooldown
- `src/components/Hype42_63.module.css` pulse
- `src/pages/HomePage.tsx` widget
- `src/lib/coins.ts`
- `server.ts` GET/POST /magnum/api/hype42/63

**Edge:**
- toDateString lokalno future sbros
- LS bityj fallback {count:0}
- povtor claim idempotent
- NaN klamp addCoins
- privatnyj try/catch
- prefers-reduced-motion statichno
- dve vkladki BroadcastChannel
- server sravnivaet lastDate

**Nagrada/khajp:**
- 42/142/420/1420 sezon 63 skin hype42-63-fire epic
- sharing 42.63 krinzha ne sushchestvuet + PRESAVE https://music.thefence.me/psmagnum
- kross StreakCalendar RecapQuest Leaderboard HYPE 42.63
- console.log('[magnum] hype42-63')

### 7.64 Bratukha-Ficha 42.64 — khajp-modul 64

**Ideya:**
Modul 42.64: bratukha delaj 64 cherez /magnum/ — random ivent 42/142/420, FOMO 42ch, Create shesternya 64. Limit 3/d, cooldown 6ch LS, anti-abuz IP v2. Sharing 42.64 OG.
Detal: kazhdyj den 1 quest 64 — otkryt 3 recaps + klik 42 + quiz 1Q. Progress LS `magnum-42-64`.

**LS klyuchi:**
- `magnum-42-64:{count,lastDate,claimed,season:64}`
- `magnum-42-64-cooldown:ISO`
- `magnum-coins:number` `src/lib/coins.ts`
- `magnum-42-64-history:[]`
- server v2: `magnum_hype42_64(user_id,count,last_date)`

**UI bloki:**
- `Hype42_64Card` gradient `linear-gradient(135deg,#ff2d55,#5865f2)` emoji 🪼
- `Hype42_64Timer` 42:00:00 puls scale 1→1.04
- `Hype42_64Reward` konfetti 120 + addCoins
- `Hype42_64History` 20 barov
- `Hype42_64Badge` NavGrid 42.64 LIVE
- `Hype42_64Share` OG 1080

**Fajly:**
- `src/components/Hype42_64.tsx`
- `src/lib/hype42_64.ts` get/claim/can/cooldown
- `src/components/Hype42_64.module.css` pulse
- `src/pages/HomePage.tsx` widget
- `src/lib/coins.ts`
- `server.ts` GET/POST /magnum/api/hype42/64

**Edge:**
- toDateString lokalno future sbros
- LS bityj fallback {count:0}
- povtor claim idempotent
- NaN klamp addCoins
- privatnyj try/catch
- prefers-reduced-motion statichno
- dve vkladki BroadcastChannel
- server sravnivaet lastDate

**Nagrada/khajp:**
- 42/142/420/1420 sezon 64 skin hype42-64-fire epic
- sharing 42.64 krinzha ne sushchestvuet + PRESAVE https://music.thefence.me/psmagnum
- kross StreakCalendar RecapQuest Leaderboard HYPE 42.64
- console.log('[magnum] hype42-64')

### 7.65 Bratukha-Ficha 42.65 — khajp-modul 65

**Ideya:**
Modul 42.65: bratukha delaj 65 cherez /magnum/ — random ivent 42/142/420, FOMO 42ch, Create shesternya 65. Limit 3/d, cooldown 6ch LS, anti-abuz IP v2. Sharing 42.65 OG.
Detal: kazhdyj den 1 quest 65 — otkryt 3 recaps + klik 42 + quiz 1Q. Progress LS `magnum-42-65`.

**LS klyuchi:**
- `magnum-42-65:{count,lastDate,claimed,season:65}`
- `magnum-42-65-cooldown:ISO`
- `magnum-coins:number` `src/lib/coins.ts`
- `magnum-42-65-history:[]`
- server v2: `magnum_hype42_65(user_id,count,last_date)`

**UI bloki:**
- `Hype42_65Card` gradient `linear-gradient(135deg,#ff2d55,#5865f2)` emoji 🔥
- `Hype42_65Timer` 42:00:00 puls scale 1→1.04
- `Hype42_65Reward` konfetti 120 + addCoins
- `Hype42_65History` 20 barov
- `Hype42_65Badge` NavGrid 42.65 LIVE
- `Hype42_65Share` OG 1080

**Fajly:**
- `src/components/Hype42_65.tsx`
- `src/lib/hype42_65.ts` get/claim/can/cooldown
- `src/components/Hype42_65.module.css` pulse
- `src/pages/HomePage.tsx` widget
- `src/lib/coins.ts`
- `server.ts` GET/POST /magnum/api/hype42/65

**Edge:**
- toDateString lokalno future sbros
- LS bityj fallback {count:0}
- povtor claim idempotent
- NaN klamp addCoins
- privatnyj try/catch
- prefers-reduced-motion statichno
- dve vkladki BroadcastChannel
- server sravnivaet lastDate

**Nagrada/khajp:**
- 42/142/420/1420 sezon 65 skin hype42-65-fire epic
- sharing 42.65 krinzha ne sushchestvuet + PRESAVE https://music.thefence.me/psmagnum
- kross StreakCalendar RecapQuest Leaderboard HYPE 42.65
- console.log('[magnum] hype42-65')

### 7.66 Bratukha-Ficha 42.66 — khajp-modul 66

**Ideya:**
Modul 42.66: bratukha delaj 66 cherez /magnum/ — random ivent 42/142/420, FOMO 42ch, Create shesternya 66. Limit 3/d, cooldown 6ch LS, anti-abuz IP v2. Sharing 42.66 OG.
Detal: kazhdyj den 1 quest 66 — otkryt 3 recaps + klik 42 + quiz 1Q. Progress LS `magnum-42-66`.

**LS klyuchi:**
- `magnum-42-66:{count,lastDate,claimed,season:66}`
- `magnum-42-66-cooldown:ISO`
- `magnum-coins:number` `src/lib/coins.ts`
- `magnum-42-66-history:[]`
- server v2: `magnum_hype42_66(user_id,count,last_date)`

**UI bloki:**
- `Hype42_66Card` gradient `linear-gradient(135deg,#ff2d55,#5865f2)` emoji 🪼
- `Hype42_66Timer` 42:00:00 puls scale 1→1.04
- `Hype42_66Reward` konfetti 120 + addCoins
- `Hype42_66History` 20 barov
- `Hype42_66Badge` NavGrid 42.66 LIVE
- `Hype42_66Share` OG 1080

**Fajly:**
- `src/components/Hype42_66.tsx`
- `src/lib/hype42_66.ts` get/claim/can/cooldown
- `src/components/Hype42_66.module.css` pulse
- `src/pages/HomePage.tsx` widget
- `src/lib/coins.ts`
- `server.ts` GET/POST /magnum/api/hype42/66

**Edge:**
- toDateString lokalno future sbros
- LS bityj fallback {count:0}
- povtor claim idempotent
- NaN klamp addCoins
- privatnyj try/catch
- prefers-reduced-motion statichno
- dve vkladki BroadcastChannel
- server sravnivaet lastDate

**Nagrada/khajp:**
- 42/142/420/1420 sezon 66 skin hype42-66-fire epic
- sharing 42.66 krinzha ne sushchestvuet + PRESAVE https://music.thefence.me/psmagnum
- kross StreakCalendar RecapQuest Leaderboard HYPE 42.66
- console.log('[magnum] hype42-66')

### 7.67 Bratukha-Ficha 42.67 — khajp-modul 67

**Ideya:**
Modul 42.67: bratukha delaj 67 cherez /magnum/ — random ivent 42/142/420, FOMO 42ch, Create shesternya 67. Limit 3/d, cooldown 6ch LS, anti-abuz IP v2. Sharing 42.67 OG.
Detal: kazhdyj den 1 quest 67 — otkryt 3 recaps + klik 42 + quiz 1Q. Progress LS `magnum-42-67`.

**LS klyuchi:**
- `magnum-42-67:{count,lastDate,claimed,season:67}`
- `magnum-42-67-cooldown:ISO`
- `magnum-coins:number` `src/lib/coins.ts`
- `magnum-42-67-history:[]`
- server v2: `magnum_hype42_67(user_id,count,last_date)`

**UI bloki:**
- `Hype42_67Card` gradient `linear-gradient(135deg,#ff2d55,#5865f2)` emoji 🔥
- `Hype42_67Timer` 42:00:00 puls scale 1→1.04
- `Hype42_67Reward` konfetti 120 + addCoins
- `Hype42_67History` 20 barov
- `Hype42_67Badge` NavGrid 42.67 LIVE
- `Hype42_67Share` OG 1080

**Fajly:**
- `src/components/Hype42_67.tsx`
- `src/lib/hype42_67.ts` get/claim/can/cooldown
- `src/components/Hype42_67.module.css` pulse
- `src/pages/HomePage.tsx` widget
- `src/lib/coins.ts`
- `server.ts` GET/POST /magnum/api/hype42/67

**Edge:**
- toDateString lokalno future sbros
- LS bityj fallback {count:0}
- povtor claim idempotent
- NaN klamp addCoins
- privatnyj try/catch
- prefers-reduced-motion statichno
- dve vkladki BroadcastChannel
- server sravnivaet lastDate

**Nagrada/khajp:**
- 42/142/420/1420 sezon 67 skin hype42-67-fire epic
- sharing 42.67 krinzha ne sushchestvuet + PRESAVE https://music.thefence.me/psmagnum
- kross StreakCalendar RecapQuest Leaderboard HYPE 42.67
- console.log('[magnum] hype42-67')

### 7.68 Bratukha-Ficha 42.68 — khajp-modul 68

**Ideya:**
Modul 42.68: bratukha delaj 68 cherez /magnum/ — random ivent 42/142/420, FOMO 42ch, Create shesternya 68. Limit 3/d, cooldown 6ch LS, anti-abuz IP v2. Sharing 42.68 OG.
Detal: kazhdyj den 1 quest 68 — otkryt 3 recaps + klik 42 + quiz 1Q. Progress LS `magnum-42-68`.

**LS klyuchi:**
- `magnum-42-68:{count,lastDate,claimed,season:68}`
- `magnum-42-68-cooldown:ISO`
- `magnum-coins:number` `src/lib/coins.ts`
- `magnum-42-68-history:[]`
- server v2: `magnum_hype42_68(user_id,count,last_date)`

**UI bloki:**
- `Hype42_68Card` gradient `linear-gradient(135deg,#ff2d55,#5865f2)` emoji 🪼
- `Hype42_68Timer` 42:00:00 puls scale 1→1.04
- `Hype42_68Reward` konfetti 120 + addCoins
- `Hype42_68History` 20 barov
- `Hype42_68Badge` NavGrid 42.68 LIVE
- `Hype42_68Share` OG 1080

**Fajly:**
- `src/components/Hype42_68.tsx`
- `src/lib/hype42_68.ts` get/claim/can/cooldown
- `src/components/Hype42_68.module.css` pulse
- `src/pages/HomePage.tsx` widget
- `src/lib/coins.ts`
- `server.ts` GET/POST /magnum/api/hype42/68

**Edge:**
- toDateString lokalno future sbros
- LS bityj fallback {count:0}
- povtor claim idempotent
- NaN klamp addCoins
- privatnyj try/catch
- prefers-reduced-motion statichno
- dve vkladki BroadcastChannel
- server sravnivaet lastDate

**Nagrada/khajp:**
- 42/142/420/1420 sezon 68 skin hype42-68-fire epic
- sharing 42.68 krinzha ne sushchestvuet + PRESAVE https://music.thefence.me/psmagnum
- kross StreakCalendar RecapQuest Leaderboard HYPE 42.68
- console.log('[magnum] hype42-68')

### 7.69 Bratukha-Ficha 42.69 — khajp-modul 69

**Ideya:**
Modul 42.69: bratukha delaj 69 cherez /magnum/ — random ivent 42/142/420, FOMO 42ch, Create shesternya 69. Limit 3/d, cooldown 6ch LS, anti-abuz IP v2. Sharing 42.69 OG.
Detal: kazhdyj den 1 quest 69 — otkryt 3 recaps + klik 42 + quiz 1Q. Progress LS `magnum-42-69`.

**LS klyuchi:**
- `magnum-42-69:{count,lastDate,claimed,season:69}`
- `magnum-42-69-cooldown:ISO`
- `magnum-coins:number` `src/lib/coins.ts`
- `magnum-42-69-history:[]`
- server v2: `magnum_hype42_69(user_id,count,last_date)`

**UI bloki:**
- `Hype42_69Card` gradient `linear-gradient(135deg,#ff2d55,#5865f2)` emoji 🔥
- `Hype42_69Timer` 42:00:00 puls scale 1→1.04
- `Hype42_69Reward` konfetti 120 + addCoins
- `Hype42_69History` 20 barov
- `Hype42_69Badge` NavGrid 42.69 LIVE
- `Hype42_69Share` OG 1080

**Fajly:**
- `src/components/Hype42_69.tsx`
- `src/lib/hype42_69.ts` get/claim/can/cooldown
- `src/components/Hype42_69.module.css` pulse
- `src/pages/HomePage.tsx` widget
- `src/lib/coins.ts`
- `server.ts` GET/POST /magnum/api/hype42/69

**Edge:**
- toDateString lokalno future sbros
- LS bityj fallback {count:0}
- povtor claim idempotent
- NaN klamp addCoins
- privatnyj try/catch
- prefers-reduced-motion statichno
- dve vkladki BroadcastChannel
- server sravnivaet lastDate

**Nagrada/khajp:**
- 42/142/420/1420 sezon 69 skin hype42-69-fire epic
- sharing 42.69 krinzha ne sushchestvuet + PRESAVE https://music.thefence.me/psmagnum
- kross StreakCalendar RecapQuest Leaderboard HYPE 42.69
- console.log('[magnum] hype42-69')

### 7.70 Bratukha-Ficha 42.70 — khajp-modul 70

**Ideya:**
Modul 42.70: bratukha delaj 70 cherez /magnum/ — random ivent 42/142/420, FOMO 42ch, Create shesternya 70. Limit 3/d, cooldown 6ch LS, anti-abuz IP v2. Sharing 42.70 OG.
Detal: kazhdyj den 1 quest 70 — otkryt 3 recaps + klik 42 + quiz 1Q. Progress LS `magnum-42-70`.

**LS klyuchi:**
- `magnum-42-70:{count,lastDate,claimed,season:70}`
- `magnum-42-70-cooldown:ISO`
- `magnum-coins:number` `src/lib/coins.ts`
- `magnum-42-70-history:[]`
- server v2: `magnum_hype42_70(user_id,count,last_date)`

**UI bloki:**
- `Hype42_70Card` gradient `linear-gradient(135deg,#ff2d55,#5865f2)` emoji 🪼
- `Hype42_70Timer` 42:00:00 puls scale 1→1.04
- `Hype42_70Reward` konfetti 120 + addCoins
- `Hype42_70History` 20 barov
- `Hype42_70Badge` NavGrid 42.70 LIVE
- `Hype42_70Share` OG 1080

**Fajly:**
- `src/components/Hype42_70.tsx`
- `src/lib/hype42_70.ts` get/claim/can/cooldown
- `src/components/Hype42_70.module.css` pulse
- `src/pages/HomePage.tsx` widget
- `src/lib/coins.ts`
- `server.ts` GET/POST /magnum/api/hype42/70

**Edge:**
- toDateString lokalno future sbros
- LS bityj fallback {count:0}
- povtor claim idempotent
- NaN klamp addCoins
- privatnyj try/catch
- prefers-reduced-motion statichno
- dve vkladki BroadcastChannel
- server sravnivaet lastDate

**Nagrada/khajp:**
- 42/142/420/1420 sezon 70 skin hype42-70-fire epic
- sharing 42.70 krinzha ne sushchestvuet + PRESAVE https://music.thefence.me/psmagnum
- kross StreakCalendar RecapQuest Leaderboard HYPE 42.70
- console.log('[magnum] hype42-70')

### 7.71 Bratukha-Ficha 42.71 — khajp-modul 71

**Ideya:**
Modul 42.71: bratukha delaj 71 cherez /magnum/ — random ivent 42/142/420, FOMO 42ch, Create shesternya 71. Limit 3/d, cooldown 6ch LS, anti-abuz IP v2. Sharing 42.71 OG.
Detal: kazhdyj den 1 quest 71 — otkryt 3 recaps + klik 42 + quiz 1Q. Progress LS `magnum-42-71`.

**LS klyuchi:**
- `magnum-42-71:{count,lastDate,claimed,season:71}`
- `magnum-42-71-cooldown:ISO`
- `magnum-coins:number` `src/lib/coins.ts`
- `magnum-42-71-history:[]`
- server v2: `magnum_hype42_71(user_id,count,last_date)`

**UI bloki:**
- `Hype42_71Card` gradient `linear-gradient(135deg,#ff2d55,#5865f2)` emoji 🔥
- `Hype42_71Timer` 42:00:00 puls scale 1→1.04
- `Hype42_71Reward` konfetti 120 + addCoins
- `Hype42_71History` 20 barov
- `Hype42_71Badge` NavGrid 42.71 LIVE
- `Hype42_71Share` OG 1080

**Fajly:**
- `src/components/Hype42_71.tsx`
- `src/lib/hype42_71.ts` get/claim/can/cooldown
- `src/components/Hype42_71.module.css` pulse
- `src/pages/HomePage.tsx` widget
- `src/lib/coins.ts`
- `server.ts` GET/POST /magnum/api/hype42/71

**Edge:**
- toDateString lokalno future sbros
- LS bityj fallback {count:0}
- povtor claim idempotent
- NaN klamp addCoins
- privatnyj try/catch
- prefers-reduced-motion statichno
- dve vkladki BroadcastChannel
- server sravnivaet lastDate

**Nagrada/khajp:**
- 42/142/420/1420 sezon 71 skin hype42-71-fire epic
- sharing 42.71 krinzha ne sushchestvuet + PRESAVE https://music.thefence.me/psmagnum
- kross StreakCalendar RecapQuest Leaderboard HYPE 42.71
- console.log('[magnum] hype42-71')

### 7.72 Bratukha-Ficha 42.72 — khajp-modul 72

**Ideya:**
Modul 42.72: bratukha delaj 72 cherez /magnum/ — random ivent 42/142/420, FOMO 42ch, Create shesternya 72. Limit 3/d, cooldown 6ch LS, anti-abuz IP v2. Sharing 42.72 OG.
Detal: kazhdyj den 1 quest 72 — otkryt 3 recaps + klik 42 + quiz 1Q. Progress LS `magnum-42-72`.

**LS klyuchi:**
- `magnum-42-72:{count,lastDate,claimed,season:72}`
- `magnum-42-72-cooldown:ISO`
- `magnum-coins:number` `src/lib/coins.ts`
- `magnum-42-72-history:[]`
- server v2: `magnum_hype42_72(user_id,count,last_date)`

**UI bloki:**
- `Hype42_72Card` gradient `linear-gradient(135deg,#ff2d55,#5865f2)` emoji 🪼
- `Hype42_72Timer` 42:00:00 puls scale 1→1.04
- `Hype42_72Reward` konfetti 120 + addCoins
- `Hype42_72History` 20 barov
- `Hype42_72Badge` NavGrid 42.72 LIVE
- `Hype42_72Share` OG 1080

**Fajly:**
- `src/components/Hype42_72.tsx`
- `src/lib/hype42_72.ts` get/claim/can/cooldown
- `src/components/Hype42_72.module.css` pulse
- `src/pages/HomePage.tsx` widget
- `src/lib/coins.ts`
- `server.ts` GET/POST /magnum/api/hype42/72

**Edge:**
- toDateString lokalno future sbros
- LS bityj fallback {count:0}
- povtor claim idempotent
- NaN klamp addCoins
- privatnyj try/catch
- prefers-reduced-motion statichno
- dve vkladki BroadcastChannel
- server sravnivaet lastDate

**Nagrada/khajp:**
- 42/142/420/1420 sezon 72 skin hype42-72-fire epic
- sharing 42.72 krinzha ne sushchestvuet + PRESAVE https://music.thefence.me/psmagnum
- kross StreakCalendar RecapQuest Leaderboard HYPE 42.72
- console.log('[magnum] hype42-72')

---

> 42 — кринжа не существует. Делай, братуха. 🔥

<!-- 42: братуха, не забудь пресейв https://music.thefence.me/psmagnum -->
