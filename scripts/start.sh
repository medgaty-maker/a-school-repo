#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# start.sh — запустить дашборд ЛОКАЛЬНО (сайт на :3100, API на :4100)
#
# Локальный контур разработки: фронт и бэк общаются через localhost.
# Адрес API для фронта берётся из apps/frontend/.env.local.
# Боевой конфиг — в .env.production (домен aschool.heycontent.online),
# деплоится отдельно на боевой сервер.
#
# Что делает по шагам:
#   1. Проверяет .env
#   2. Стартует PostgreSQL если не запущен
#   3. Стартует Redis если не запущен
#   4. Ставит npm зависимости если node_modules нет
#   5. Применяет новые миграции БД
#   6. Создаёт начальные данные если БД пустая
#   7. Убивает старые backend/frontend процессы
#   8. Запускает backend (NestJS REST API) на порту 4100
#   9. Запускает frontend (Next.js) на порту 3100
#  10. Ждёт пока оба поднимутся и выводит ссылки
# ─────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
BACKEND="$ROOT/apps/backend"
FRONTEND="$ROOT/apps/frontend"
LOG_DIR="$ROOT/.logs"

# Порты локального контура (совпадают с .env BACKEND_PORT и frontend dev-скриптом)
BACKEND_PORT=$(grep -E '^BACKEND_PORT=' "$ROOT/.env" 2>/dev/null | cut -d= -f2 | tr -d ' ')
BACKEND_PORT=${BACKEND_PORT:-4100}
FRONTEND_PORT=3100

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
ok ".env найден (локальный контур, API :$BACKEND_PORT)"

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
pkill -f "nest start" 2>/dev/null || true
pkill -f "next-server\|next dev" 2>/dev/null || true
# на случай если от старой схемы остались туннели
pkill -f "ngrok" 2>/dev/null || true
pkill -f "cloudflared" 2>/dev/null || true
sleep 1

# Проверяем что фронт настроен на локальный бэк (а не на боевой домен)
if ! grep -q "localhost:${BACKEND_PORT}" "$FRONTEND/.env.local" 2>/dev/null; then
  warn "apps/frontend/.env.local не указывает на localhost:${BACKEND_PORT} — фронт может ходить в боевой бэк"
fi

# 8. Backend — NestJS REST API, слушает порт $BACKEND_PORT
info "Запускаю backend (NestJS :$BACKEND_PORT)..."
cd "$BACKEND"
nohup npx ts-node -r tsconfig-paths/register src/main.ts > "$LOG_DIR/backend.log" 2>&1 &
echo $! > "$LOG_DIR/backend.pid"
for i in $(seq 1 15); do
  curl -s "http://localhost:${BACKEND_PORT}/api/auth/login" -o /dev/null 2>/dev/null && break
  sleep 1
done
curl -s "http://localhost:${BACKEND_PORT}/api/auth/login" -o /dev/null 2>/dev/null \
  && ok "Backend запущен (PID $(cat "$LOG_DIR/backend.pid"))" \
  || warn "Backend не ответил за 15 сек → tail -f .logs/backend.log"

# 9. Frontend — Next.js, слушает порт $FRONTEND_PORT (то что открываете в браузере)
info "Запускаю frontend (Next.js :$FRONTEND_PORT)..."
cd "$FRONTEND"
nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
echo $! > "$LOG_DIR/frontend.pid"
for i in $(seq 1 20); do
  curl -s -o /dev/null "http://localhost:${FRONTEND_PORT}" 2>/dev/null && break
  sleep 1
done
curl -s -o /dev/null "http://localhost:${FRONTEND_PORT}" 2>/dev/null \
  && ok "Frontend запущен (PID $(cat "$LOG_DIR/frontend.pid"))" \
  || warn "Frontend не ответил за 20 сек → tail -f .logs/frontend.log"

# 10. Итог
ADMIN_EMAIL=$(grep ADMIN_EMAIL "$ROOT/.env" | cut -d= -f2 | tr -d ' ')
ADMIN_PASS=$(grep ADMIN_PASSWORD "$ROOT/.env" | cut -d= -f2 | tr -d ' ')
echo ""
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo -e "${GREEN}  Готово!${NC}"
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BLUE}Сайт:${NC}   http://localhost:${FRONTEND_PORT}"
echo -e "  ${BLUE}API:${NC}    http://localhost:${BACKEND_PORT}/api"
echo -e "  ${BLUE}Логин:${NC}  $ADMIN_EMAIL"
echo -e "  ${BLUE}Пароль:${NC} $ADMIN_PASS"
echo ""
echo -e "  Логи:   tail -f .logs/backend.log"
echo -e "  Стоп:   npm run stop"
echo ""
