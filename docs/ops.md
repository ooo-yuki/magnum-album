# Ops — crons & deploy (P2-7)
Source: README.md:83-91, .github/workflows/deploy.yml, server.ts:830

## Crons (README 83-91)
- 10m substantial — reports/content + review
- 15m health — GET /magnum/ + /magnum/api/ideas local+ext — reports/health-*.md
- 10m watchdog — all 200 + gallery 6 files — reports/watchdog-*.md
- 20m changelog — CHANGELOG.md
- 15m ideas — POST /magnum/api/ideas vote limit
- 60m recaps — scripts/recaps-cron.ts (planned) -> public/mocks/recaps.json

## Deploy
- .github/workflows/deploy.yml SSH scp /srv/magnum (check host Oooyuki)
- server.ts SPA fallback 830-831: /magnum/* try_files /index.html, but /magnum/images/* should be file_server without fallback to return 404 for missing gallery images (see review 14:09 P0-1)
- Caddy: :30646 http :30645 https -> 172.18.0.1:3000

## Health checks
- curl http://127.0.0.1:3000/magnum/ 200
- curl http://127.0.0.1:3000/magnum/api/ideas 200
- curl http://127.0.0.1:3000/magnum/images/gallery-42/42-agit-01-800.webp 200 image/*
- curl missing -> should be 404 not 200 html (fix in server.ts/Caddy)
