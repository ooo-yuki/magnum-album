# Mining 42 — spec (P1)
Source: src/pages/MiningPage.tsx:1-484, server.ts:826-828, drizzle/schema.ts:23

## Upgrades
- UPGRADES_INIT 5 — MiningPage.tsx:23 shovel 42 +1, pick 142 +3, drill 420 +1/s, truck 1042 +5/s, shaft 2042 +12/s
- costOf base*1.42^count — MiningPage.tsx:42
- perClick/perSec reduce — MiningPage.tsx:69

## Server
- GET /magnum/api/mining — server.ts:826
- POST /mining/click — server.ts:827
- POST /mining/upgrade — server.ts:828
- WS /magnum/api/ws duel 2-4 — MiningPage.tsx:369 server.ts:772

## GSAP
- entrance y24 stagger 0.12 — MiningPage.tsx:118
- rock float y-4 1.6s — MiningPage.tsx:127
