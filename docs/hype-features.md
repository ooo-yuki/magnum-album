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

---

> 42 — кринжа не существует. Делай, братуха. 🔥

<!-- 42: братуха, не забудь пресейв https://music.thefence.me/psmagnum -->
