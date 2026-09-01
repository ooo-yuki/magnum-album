#!/usr/bin/env bash
set -euo pipefail

# health-check.sh — проверка здоровья деплоя MAGNUM
# Использование:
#   ./scripts/health-check.sh
#   BASE_URL=http://localhost:30646/magnum ./scripts/health-check.sh
#   BASE_URL=https://5opka.ru/magnum ./scripts/health-check.sh
#
# Проверки:
#  1) HTTP 200 на index.html
#  2) index.html содержит <div id="root"> и <script src="/magnum/main-*.js">
#  3) main-*.js доступен (200) и не пустой
#  4) Проверка «белого экрана» — #root не пустая заглушка, title присутствует
#  5) (опционально) Obscura / localhost:9222 доступность

BASE_URL="${BASE_URL:-http://localhost:30646/magnum}"
OBSCURA_URL="${OBSCURA_URL:-http://localhost:9222}"
CURL_OPTS=(--silent --show-error --fail --max-time 10 --location)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓ $*${NC}"; }
fail() { echo -e "${RED}✗ $*${NC}"; HAS_FAIL=1; }
warn() { echo -e "${YELLOW}⚠ $*${NC}"; }

HAS_FAIL=0

echo "=== MAGNUM health-check ==="
echo "BASE_URL: $BASE_URL"
echo "OBSCURA_URL: $OBSCURA_URL"
echo ""

# 1. GET index.html
echo "[1/5] GET $BASE_URL/"
TMP_HTML="$(mktemp)"
HTTP_CODE="$(curl "${CURL_OPTS[@]}" --output "$TMP_HTML" --write-out "%{http_code}" "$BASE_URL/" 2>&1)" || HTTP_CODE="000"
if [[ "$HTTP_CODE" == "200" ]]; then
  pass "HTTP 200 на $BASE_URL/"
else
  # fallback: пробуем без trailing slash
  HTTP_CODE2="$(curl "${CURL_OPTS[@]}" --output "$TMP_HTML" --write-out "%{http_code}" "$BASE_URL" 2>&1)" || HTTP_CODE2="000"
  if [[ "$HTTP_CODE2" == "200" ]]; then
    pass "HTTP 200 на $BASE_URL (без /)"
    HTTP_CODE="$HTTP_CODE2"
  else
    fail "HTTP $HTTP_CODE на $BASE_URL/ (ожидалось 200)"
    cat "$TMP_HTML" 2>/dev/null | head -c 500; echo
  fi
fi

if [[ ! -s "$TMP_HTML" ]]; then
  fail "index.html пустой"
else
  pass "index.html не пустой ($(wc -c < "$TMP_HTML") bytes)"
fi

# 2. Проверка содержимого index.html
if grep -q '<div id="root">' "$TMP_HTML" 2>/dev/null; then
  pass "index.html содержит <div id=\"root\">"
else
  fail "index.html не содержит <div id=\"root\"> — белый экран!"
fi

if grep -q '<title>' "$TMP_HTML" 2>/dev/null; then
  pass "index.html содержит <title>"
else
  fail "index.html без <title>"
fi

# Ищем main-*.js
MAIN_JS="$(grep -oE 'src="/magnum/main-[^"]+\.js"' "$TMP_HTML" 2>/dev/null | head -1 | cut -d'"' -f2 || true)"
if [[ -z "$MAIN_JS" ]]; then
  # пробуем относительный или другой паттерн
  MAIN_JS="$(grep -oE '/magnum/main-[^"]+\.js' "$TMP_HTML" 2>/dev/null | head -1 || true)"
fi

if [[ -n "$MAIN_JS" ]]; then
  pass "index.html ссылается на $MAIN_JS"
else
  fail "index.html не ссылается на /magnum/main-*.js (остался /src/main.tsx ?)"
  grep -oE 'src="[^"]+\.js"' "$TMP_HTML" 2>/dev/null | head -5 || true
fi

# Проверяем что не остался дев-путь
if grep -q 'src="/src/main.tsx"' "$TMP_HTML" 2>/dev/null; then
  fail "index.html всё ещё содержит src=\"/src/main.tsx\" — билд не подменил путь"
else
  pass "index.html не содержит дев-путь /src/main.tsx"
fi

# 3. Проверка main-*.js доступен
if [[ -n "$MAIN_JS" ]]; then
  # MAIN_JS может быть /magnum/main-xxx.js — делаем абсолютный URL
  if [[ "$MAIN_JS" == /magnum/* ]]; then
    # BASE_URL = http://host/magnum -> origin = http://host
    ORIGIN="$(echo "$BASE_URL" | sed -E 's|/magnum/?$||')"
    JS_URL="${ORIGIN}${MAIN_JS}"
  else
    JS_URL="${BASE_URL%/}/${MAIN_JS#/}"
  fi
  echo ""
  echo "[3/5] GET $JS_URL"
  TMP_JS="$(mktemp)"
  JS_CODE="$(curl "${CURL_OPTS[@]}" --output "$TMP_JS" --write-out "%{http_code}" "$JS_URL" 2>&1)" || JS_CODE="000"
  if [[ "$JS_CODE" == "200" ]]; then
    JS_SIZE="$(wc -c < "$TMP_JS")"
    if [[ "$JS_SIZE" -gt 1000 ]]; then
      pass "main-*.js доступен, $JS_SIZE bytes"
    else
      fail "main-*.js слишком маленький ($JS_SIZE bytes) — возможно битый билд"
    fi
  else
    fail "main-*.js HTTP $JS_CODE на $JS_URL"
  fi
  rm -f "$TMP_JS"
fi

# 4. Проверка «белого экрана» — эвристики
echo ""
echo "[4/5] Проверка белого экрана"
# Если html < 1KB и без скриптов — белый экран
HTML_SIZE="$(wc -c < "$TMP_HTML")"
if [[ "$HTML_SIZE" -lt 500 ]]; then
  fail "HTML подозрительно маленький ($HTML_SIZE bytes) — белый экран?"
else
  pass "HTML размер ок ($HTML_SIZE bytes)"
fi

# Нет ли ошибки типа "Cannot GET" или "404"
if grep -qi "cannot get\|404\|not found" "$TMP_HTML" 2>/dev/null; then
  fail "HTML содержит 404/Cannot GET — роут не настроен"
else
  pass "Нет признаков 404 в HTML"
fi

# Проверка что нет пустой заглушки без контента
if grep -q "MAGNUM" "$TMP_HTML" 2>/dev/null; then
  pass "HTML содержит MAGNUM"
else
  warn "HTML не содержит слово MAGNUM (проверьте title/meta)"
fi

# 5. Obscura / CDP проверка (опционально, не фейлит деплой если недоступна)
echo ""
echo "[5/5] Obscura CDP $OBSCURA_URL/json/version"
if curl --silent --max-time 5 "$OBSCURA_URL/json/version" 2>/dev/null | grep -q "Browser"; then
  pass "Obscura CDP доступна"
else
  warn "Obscura CDP недоступна на $OBSCURA_URL (локальная проверка, не критично для деплоя)"
fi

# Также пробуем второй порт из контекста: 30646 уже проверен как BASE_URL, дополнительно проверяем 9222
if [[ "$OBSCURA_URL" != "http://localhost:9222" ]]; then
  if curl --silent --max-time 5 "http://localhost:9222/json/version" 2>/dev/null | grep -q "Browser"; then
    pass "CDP на :9222 доступна"
  else
    warn "CDP на :9222 недоступна"
  fi
fi

rm -f "$TMP_HTML"

echo ""
if [[ "$HAS_FAIL" -eq 0 ]]; then
  echo -e "${GREEN}=== HEALTH OK ===${NC}"
  exit 0
else
  echo -e "${RED}=== HEALTH FAILED ===${NC}"
  exit 1
fi
