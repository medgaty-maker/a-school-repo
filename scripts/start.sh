#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# start.sh — запустить дашборд (сайт на :3000, API на :4000)
#
# Что делает по шагам:
#   1. Проверяет .env
#   2. Стартует PostgreSQL если не запущен
#   3. Стартует Redis если не запущен
#   4. Ставит npm зависимости если node_modules нет
#   5. Применяет новые миграции БД
#   6. Создаёт начальные данные если БД пустая
#   7. Убивает старые backend/frontend процессы
#   8. Запускает backend (NestJS REST API) на порту 4000
#   9. Запускает frontend (Next.js) на порту 3000
#  10. Ждёт пока оба поднимутся и выводит ссылки
# ─────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
BACKEND="$ROOT/apps/backend"
FRONTEND="$ROOT/apps/frontend"
LOG_DIR="$ROOT/.logs"

mkdir -p "$LOG_DIR"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
info() { echo -e "${BLUE}[•]${NC} $1"; }
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
die()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗"
echo -e "║   Маркетинговый дашборд — dev запуск    ║"
echo -e "╚══════════════════════════════════════════╝${NC}"
echo ""

# 1. Проверяем .env — без него ничего не заработает
[ -f "$ROOT/.env" ] || die ".env не найден. Скопируйте: cp .env.example .env"
ok ".env найден"

# 2. PostgreSQL — основная база данных
if pg_isready -q 2>/dev/null; then
  ok "PostgreSQL уже запущен"
else
  info "Запускаю PostgreSQL..."
  brew services start postgresql@16 2>/dev/null || \
  brew services start postgresql 2>/dev/null || \
  die "Не удалось запустить PostgreSQL (brew install postgresql@16)"
  sleep 2
  pg_isready -q || die "PostgreSQL не поднялся"
  ok "PostgreSQL запущен"
fi

# 3. Redis — кэш для API-ответов (YouTube analytics и др.)
if redis-cli ping &>/dev/null; then
  ok "Redis уже запущен"
else
  info "Запускаю Redis..."
  brew services start redis 2>/dev/null || die "Не удалось запустить Redis (brew install redis)"
  sleep 1
  redis-cli ping &>/dev/null || die "Redis не поднялся"
  ok "Redis запущен"
fi

# 4. npm зависимости — только если папки node_modules нет вообще
if [ ! -d "$ROOT/node_modules" ]; then
  info "Устанавливаю зависимости..."
  cd "$ROOT" && npm install --silent
  ok "Зависимости установлены"
fi

# 5. Миграции БД — применяет новые изменения схемы, если они есть
info "Проверяю миграции БД..."
cd "$BACKEND" && npx prisma migrate deploy 2>&1 | tail -2
ok "Миграции актуальны"

# 6. Seed — создаёт 6 проектов и admin-пользователя, только если БД пустая
DB_URL=$(grep DATABASE_URL "$ROOT/.env" | cut -d= -f2- | sed 's/?schema=public//')
PROJ_COUNT=$(psql "$DB_URL" -tAc 'SELECT COUNT(*) FROM "Project"' 2>/dev/null || echo "0")
if [ "$PROJ_COUNT" = "0" ]; then
  info "Создаю начальные данные (6 проектов + admin)..."
  cd "$BACKEND" && npx ts-node prisma/seed.ts 2>&1 | tail -5
  ok "Данные созданы"
else
  ok "Данные уже есть ($PROJ_COUNT проектов)"
fi

# 7. Убиваем старые процессы, чтобы не было конфликта портов
info "Останавливаю предыдущие процессы..."
pkill -f "ts-node.*backend/src/main" 2>/dev/null || true
pkill -f "next-server\|next dev" 2>/dev/null || true
pkill -f "ngrok" 2>/dev/null || true
pkill -f "cloudflared" 2>/dev/null || true
sleep 1

# Гарантируем что NEXT_PUBLIC_API_URL указывает на ngrok (для внешнего доступа)
NGROK_DOMAIN="pseudoindependently-skittish-hilton.ngrok-free.dev"
echo "NEXT_PUBLIC_API_URL=https://${NGROK_DOMAIN}" > "$FRONTEND/.env.local"

# 8. Backend — NestJS REST API, слушает порт 4000
info "Запускаю backend (NestJS :4000)..."
cd "$BACKEND"
nohup npx ts-node -r tsconfig-paths/register src/main.ts > "$LOG_DIR/backend.log" 2>&1 &
echo $! > "$LOG_DIR/backend.pid"
for i in $(seq 1 15); do
  curl -s http://localhost:4000/api/auth/login -o /dev/null 2>/dev/null && break
  sleep 1
done
curl -s http://localhost:4000/api/auth/login -o /dev/null 2>/dev/null \
  && ok "Backend запущен (PID $(cat "$LOG_DIR/backend.pid"))" \
  || warn "Backend не ответил за 15 сек → tail -f .logs/backend.log"

# 9. Frontend — Next.js, слушает порт 3000 (то что открываете в браузере)
info "Запускаю frontend (Next.js :3000)..."
cd "$FRONTEND"
nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
echo $! > "$LOG_DIR/frontend.pid"
for i in $(seq 1 20); do
  curl -s -o /dev/null http://localhost:3000 2>/dev/null && break
  sleep 1
done
curl -s -o /dev/null http://localhost:3000 2>/dev/null \
  && ok "Frontend запущен (PID $(cat "$LOG_DIR/frontend.pid"))" \
  || warn "Frontend не ответил за 20 сек → tail -f .logs/frontend.log"

# 10. ngrok — HTTPS тоннель для бэкенда (нужен для Instagram OAuth)
info "Запускаю ngrok (HTTPS тоннель :4000)..."
nohup ngrok http 3000 --domain="${NGROK_DOMAIN}" > "$LOG_DIR/ngrok.log" 2>&1 &
echo $! > "$LOG_DIR/ngrok.pid"
sleep 3
if curl -s http://127.0.0.1:4040/api/tunnels &>/dev/null; then
  ok "ngrok запущен → https://${NGROK_DOMAIN}"
else
  warn "ngrok не запустился → Instagram OAuth не будет работать"
fi

# 11. cloudflared — публичный URL для фронтенда (для других пользователей)
info "Запускаю cloudflared (публичный доступ к :3000)..."
nohup cloudflared tunnel --url http://localhost:3000 > "$LOG_DIR/cloudflared.log" 2>&1 &
echo $! > "$LOG_DIR/cloudflared.pid"
CLOUDFLARE_URL=""
for i in $(seq 1 15); do
  CLOUDFLARE_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG_DIR/cloudflared.log" 2>/dev/null | head -1)
  [ -n "$CLOUDFLARE_URL" ] && break
  sleep 1
done
[ -n "$CLOUDFLARE_URL" ] && ok "cloudflared запущен → $CLOUDFLARE_URL" || warn "cloudflared не дал URL"

# 12. Итог
ADMIN_EMAIL=$(grep ADMIN_EMAIL "$ROOT/.env" | cut -d= -f2 | tr -d ' ')
ADMIN_PASS=$(grep ADMIN_PASSWORD "$ROOT/.env" | cut -d= -f2 | tr -d ' ')
echo ""
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo -e "${GREEN}  Готово!${NC}"
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BLUE}Локально:${NC}   http://localhost:3000"
echo -e "  ${BLUE}Публично:${NC}   ${CLOUDFLARE_URL:-недоступно}"
echo -e "  ${BLUE}API (ngrok):${NC} https://${NGROK_DOMAIN}"
echo -e "  ${BLUE}Логин:${NC}      $ADMIN_EMAIL"
echo -e "  ${BLUE}Пароль:${NC}     $ADMIN_PASS"
echo ""
echo -e "  Логи:      tail -f .logs/backend.log"
echo -e "  Стоп:      npm run stop"
echo ""
