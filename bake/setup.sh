#!/usr/bin/env bash
# setup.sh — подготовка окружения запекания 42-завров (один раз)
set -euo pipefail
cd "$(dirname "$0")"

# Системные зависимости (Debian/Ubuntu), если ещё не стоят:
#   apt-get install -y --no-install-recommends build-essential python-is-python3 pkg-config \
#     libxi-dev libglu1-mesa-dev libglew-dev mesa-common-dev libosmesa6-dev xvfb
npm install --no-audit --no-fund

# npm v11+ блокирует install-скрипты по умолчанию — нативные биндинги headless-gl собираем явно
if [ ! -f node_modules/gl/build/Release/webgl.node ]; then
  echo "[setup] сборка нативных биндингов gl (node-gyp)…"
  (cd node_modules/gl && npx node-gyp rebuild)
fi

echo "[setup] окружение готово. Запекание: xvfb-run -a bun run bake.ts"
