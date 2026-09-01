# HYPE QUEUE — MAGNUM 42

> Очередь хайп-идей · пополняется каждые 15м · 5+ за тик

| # | идея | приоритет | монетки | спека | статус |
|---|------|-----------|---------|-------|--------|
| 1 | DUEL LOBBY 2-4 — WebSocket арена 2-4 игрока + код комнаты | P0 | wager 0/42/142/420, win +wager*2 +42 ELO | `Bun.serve /magnum/api/ws` lobby:create→ABCD→join→ready→10с duel, CPS>20 suspect, heartbeat 25с, confetti 160 canvas, GSAP y24 stagger 0.12 shake x±6 | queued 14:00 |
| 2 | ЭКО-РЕЙТИНГ 42 v2 — босс Кузбасса 7дн + босс-квиз 8Q | P1 | 42/142/420 (уровни) 1×/сутки, 1420 за 8/8 босс | 8Q Томь/Кузбасс/42 + MAGNUM факты 8K/200K VPN 28.04 CLAY 73 NOVA 80/86, `magnum-eco-challenge:{weekId,streak}` + freeze 420, GSAP stagger y18 0.1 + conic badge | queued 14:00 |
| 3 | LIMITED DROP 42 — 6 скинов/72ч тираж 42 + аукцион | P1 | 142/420/1420 | 6 лимиток meduza-gold epic 1420 … fence-42-black epic 1420, LEFT 42 бар + FomoTimer 72:00:00 pulse scale 1.04, sold-out → +42 bid, `magnum-limited:{dropId,endsAt}` | queued 14:00 |
| 4 | FRAME VERIFIED GOLD — рамка за пресейв через БРАТ-БОТ vision | P0 | бесплатно (требует verified) | `POST /magnum/api/ai` mimo-v2.5 vision → эвристика «засчитан»/«легенда» без «не вижу», LS `magnum-frame-verified=1` + `frame-date` ISO, `conic-gradient gold spin 3s` + `box-shadow 0 0 16 gold` | queued 14:00 |
| 5 | ARENA SEASON 42 — 7дн ELO + crown-лимитка топ-3 | P1 | +42 win / 420 streak5 / 1420 + crown топ-3 | `magnum-arena-season:{rating,wins,season}` LS + `magnum_leaderboard(game=arena)` сервер, `conic-gold` crown + `pulse 1.2s`, `/magnum/arena` sitemap, кросс `StreakCalendar` | queued 14:00 |
| 6 | ECO FREEZE 42 — заморозка стрика за 420 + шаринг 1080×1080 | P2 | 420 freeze, +42 шаринг | `magnum-eco-freeze-used` 1/неделю guard weekId YYYY-Www, `OG canvas 1080×1080` градиент + стата + Web Share API, `magnum-share-claimed` 1× | queued 14:00 |
| 7 | SHOP PREVIEW 42 — модалка 200px + InventoryBar скролл | P2 | 42/142/420/1420 catalog 12 | 12 скинов common 42 → epic 1420 CSS-градиенты + эмодзи 48px, бейдж rare фиолет/epic золото, `SkinCard` + `EquippedFrame` glow, `storage` sync вкладок | queued 14:00 |
| 8 | PRESAVE FOMO BANNER — липкий таймер до релиза | P2 | +42 за клик PRESAVE | `release.ts` дата + `23:59:59` countdown `y:-20→0` GSAP, LS `magnum-presave-banner:{dismissed}` , после релиза → «Слушать MAGNUM» | queued 14:00 |

| 9 | SHOP VAULT 42 — 12 скинов каталог | P0 | 42/142/420/1420 (common/uncommon/rare/epic) | `COSMETICS_CATALOG` 12: clay-73-brown 142, meduza-holo rare 420, gold-42-conic epic 1420 `conic-gold spin 3s`, `magnum_cosmetics(slot frame/banner/title)` + `magnum_shop_inventory`, GSAP stagger y20 0.08 + shimmer epic + confetti 80 | queued 14:21 |
| 10 | FRAME VERIFIED GOLD — рамка через БРАТ-БОТ vision | P0 | бесплатно verified | `POST /magnum/api/ai` mimo-v2.5 → «засчитан»/«легенда» без «не вижу» → `magnum_frames`, LS `magnum-frame-verified=1`, `conic-gold spin 3s` + `shadow 0 0 16 gold`, GSAP scale spring + glow pulse 2s | queued 14:21 |
| 11 | DUEL ROYALE 42 — WS лобби 2-4 + сезон 7дн | P1 | wager 0/42/142/420 win +wager*2 +42 ELO | `Bun.serve ws /magnum/api/ws` ABCD join→ready→10с, CPS>20 suspect, heartbeat 25с, `magnum_leaderboard(game=duel42)` season crown топ-3, GSAP y24 stagger 0.12 shake x±6 confetti 160 | queued 14:21 |
| 12 | ECO CHALLENGE 8Q — Томь/Кузбасс + MAGNUM 8K/200K | P1 | 42/142/420 +1420 босс 8/8 | 8Q Томь/42/Кузбасс/эко + VPN 28.04 CLAY 73 NOVA 80/86, `magnum-eco-challenge:{weekId,streak}` streak 7дн, freeze 420, GSAP y18 stagger 0.1 + conic badge spring | queued 14:21 |
| 13 | VAULT ROTATION 42 — недельный дроп + аукцион | P2 | 142/420/1420 | 3 скина/неделю тираж 42 `LEFT 12/42` + `FomoTimer 7д` pulse 1.04, sold-out → аукцион +42 bid, `magnum-limited:{dropId,endsAt}` LS + сервер `magnum_limited_drops` | queued 14:21 |

> Источник: `docs/hype-features.md` §1-4 + §7.12-7.14. Следующее пополнение — 2026-09-01 14:36.
