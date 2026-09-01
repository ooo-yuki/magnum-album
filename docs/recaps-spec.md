# Recaps 42 — spec (P2-6)
Source: src/pages/RecapsPage.tsx:1-3378, README:27, hype 7.1-7.6

## Model
- Recap {id,title,date,tag,tag2,youtubeId,youtubeUrl,transcript,paragraphs,duration,channel,note} — RecapsPage.tsx:12
- Tags СП/Нарезка/Ивент/Freakland/Музыка + Все — RecapsPage.tsx:9
- RECAPS 6+ карточек, 3 с transcript true + 3 скоро — RecapsPage.tsx:28

## Content source
- Static arrays in RecapsPage.tsx:28 — no fetch (grep 0 fetch)
- Roadmap: GET /magnum/api/recaps or cron 60m scripts/recaps-cron.ts (README:27) — not yet server, documented as static
- Filter via useMemo by tag — RecapsPage.tsx:3190

## Cron (planned)
- scripts/recaps-cron.ts every 60m — fetch YouTube transcripts -> update public/mocks/recaps.json
- Relation hype 7.1-7.6: Roulette, Daily, TTS, Timeline, ClipBattle, Quest — Timeline2026Game already implements 7.4 as game

## GSAP
- entrance y24 stagger 0.12 — RecapsPage.tsx:3194
- reduced-motion gate — RecapsPage.tsx:3197
