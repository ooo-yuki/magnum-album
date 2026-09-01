# Shop 42 — spec (P2, P1-3)
Source: src/pages/ShopPage.tsx:1-557, src/lib/coins.ts, server.ts:821-823, docs/SPEC-42.md

## Catalog
- 12 skins SKINS — ShopPage.tsx:36 (mops/rhino/monkey/frog/panda/fox/owl/shark/flamingo/wolf/tiger/dragon)
- Rarity prices: common 42 rare 142 epic 420 legendary 1420 — ShopPage.tsx:18
- 32 cosmetics COSMETICS — ShopPage.tsx:53 (frame 12 / banner 10 / title 10)
- Server prices match: server.ts:258 getSkinPrice 42/142/420/1420

## Client↔Server
- GET /magnum/api/shop/inventory — server.ts:823, client ShopPage.tsx:91 — OK
- POST /magnum/api/shop/buy — server.ts:821, client ShopPage.tsx:263 — OK
- POST /magnum/api/shop/equip — server.ts:822, client ShopPage.tsx:301 — OK
- Deprecated 404s removed: GET /shop/state, /shop/equipped, POST /shop/purchase, /shop/unequip — spec-audit P0-1 (client now only uses inventory/buy/equip, see ShopPage.tsx:119)

## Coins
- GET /magnum/api/coins, POST /coins/add — server.ts:792
- coins.ts polling 2s subscribe — src/lib/coins.ts:1
- LS keys legacy: magnum-coins, magnum-inventory, magnum-equipped (now server authoritative)

## GSAP
- coins count-up 0.7s power2.out + flash scale 1.35 — ShopPage.tsx:185
- cards stagger 0.12 y24 — ShopPage.tsx:218
- hover y:-4 tri-shadow — ShopPage.tsx:228

## Economy dupe
- src/lib/economy.ts SHOP_ITEMS 100/420/1420 vs ShopPage 42/142/420/1420 — single source is ShopPage + server.ts, economy.ts marked deprecated mock (see docs/shop-spec.md)
