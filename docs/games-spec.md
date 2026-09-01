# 🎮 MAGNUM — Games Spec: Blackjack & Roulette — Открытка 4200

> **Статус:** P1 closed · **Дата:** 2026-09-01 · **Файлы:** `BlackjackGame.tsx`, `RouletteGame.tsx`, `postcard-4200.png`, `presaveTracker.ts`

## 🃏 Blackjack 42 — правила + 4200 открытка

- **Старт:** `START_BALANCE 1000` (`LS blackjack42-balance`), цель `GOAL 4200`.
- **Ставка:** фишки `10/25/50/100/250`, `MIN_BET 10`, кнопки `−10/+10/½/MAX`.
- **Раздача:** `P D P D(hidden)`, `makeDeck 52 + shuffle`, `needReshuffle <12`.
- **Логика:** `handValue` туз 11→1, `isBlackjack 21 на 2`, `isSoft17` хит, `isBust >21`.
- **BJ:** оба BJ → `push`, игрок BJ → `+floor(bet*1.5)` + `playBlackjack`, дилер BJ → `-bet`.
- **Ход:** `hit / stand / doubleDown` (только на 2 картах, `bet*2`, одна карта + дилер).
- **Дилер:** берёт до `>17` или `17 не soft`, иначе сгорает.
- **Победа 4200:** `balance>=4200` → `winCheckedRef true` → `showWin modal` → `postcard-4200.png 242KB` + `PRESAVE https://music.thefence.me/psmagnum` + `best max`.
- **Сброс:** `<=0 → 200`, `resetAll → 1000`, если `<4200` сбрасывает `winCheckedRef`.
- **Звуки:** `playDeal/Hit/Bust/Blackjack/Win/Lose/Push` via WebAudio + `safeRamp`.
- **Тест-инварианты:** `balance 1000→4200 + postcard src /magnum/images/postcard-4200.png + presave href`.

## 🎰 Roulette 42 — правила + 4200 открытка

- **Старт:** `START_BALANCE 1000`, `WIN 4200`, `LS roulette42-balance + history[20]`.
- **Колесо:** European `0-36`, `WHEEL_ORDER[37]`, `RED_NUMS 18`, `getColor`, `WHEEL_COLORS`, canvas `R+6` неон.
- **Фишки:** `1/5/25/100`, `totalBet`, `bets: Bet[]`.
- **Пресеты 10:** Красные🔴, Чёрные⚫, Чёт2️⃣, Нечёт1️⃣, 1-12/13-24/25-36, Осирис👁️(7,17,27+red), 42💎(4,2,0,32), Соседи0🟢(0,32,15,26,3).
- **Выплаты:** straight `35:1`, dozen `2:1`, outside `1:1`, zero забирает outside.
- **Крут:** `spin → targetRot`, `spins 4-6`, `gsap power3.inOut 4.2s`, `ballDelta`, `playSpinRumble`.
- **Победа:** `net>0 → balance+=net`, `>=4200 → burstConfetti 36 + playBigWin + modal postcard`.
- **Управление:** `swipe >50px = spin`, `×2 doubleBets`, `↻ repeatLast`, `autoSpin 700ms`.
- **Статистика:** `hot 4/cnt`, `cold 4`, `red/black/green` counters.
- **GSAP:** `context y30 stagger 0.08`, `confetti canvas loop`, `shake x4×5` при `net< -chip*3`.
- **Тест-инварианты:** `presets 10 + payout + 4200 modal + hot/cold + swipe`.

## 🖼️ Открытка 4200 — общий инвариант

- **Ассет:** `public/images/postcard-4200.png 242KB` — в обеих модалках `width 560 height 373 loading eager`.
- **CTA:** `a href https://music.thefence.me/psmagnum target _blank` + `presaveTracker POST /presave/click`.
- **Условие:** строго `>=4200`, `once:true` через `winCheckedRef / won state`.
- **Негатив:** `balance NaN → START_BALANCE`, `<=0 → reset`, `chip>balance → disabled`.
