# Eco 42 — spec (P1-2)
Source: src/pages/EcoPage.tsx:1-566, server.ts:817-818, hype-features.md:2

## Quiz
- 8 вопросов QUESTIONS — EcoPage.tsx:29 (батилки 42, курево, шуба, шашлыки Красное озеро, Wildberries, уголь Кузбасса, бутылки, субботник Сосновый бор)
- Points: +42 / -42 / -142 — EcoPage.tsx:29
- Rank >=200 ЭкоЛегенда, >=100 Братуха — EcoPage.tsx:122
- vs hype 0-3/4-6/7-8 count — fixed to score-based

## Server
- GET /magnum/api/eco/leaderboard — server.ts:817
- POST /magnum/api/eco/submit — server.ts:818
- Table magnum_eco_results — drizzle/schema.ts:58

## GSAP
- cards y28 stagger 0.07 back.out(1.5) — EcoPage.tsx:193
- progress width 0.6s power3.out — EcoPage.tsx:215
