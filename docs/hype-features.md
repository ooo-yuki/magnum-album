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

> 42 — кринжа не существует. Делай, братуха. 🔥
