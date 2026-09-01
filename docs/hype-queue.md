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

> Источник: `docs/hype-features.md` §1-4 + §7.12-7.14. Следующее пополнение — 2026-09-01 14:15.
