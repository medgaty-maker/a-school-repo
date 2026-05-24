#!/usr/bin/env bash
# Проверка состояния всех компонентов дашборда

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
LOG_DIR="$ROOT/.logs"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}●${NC} $1"; }
fail() { echo -e "  ${RED}○${NC} $1"; }
warn() { echo -e "  ${YELLOW}~${NC} $1"; }

echo ""
echo -e "${BLUE}Состояние сервисов${NC}"
echo "──────────────────────────────"

# PostgreSQL
if pg_isready -q 2>/dev/null; then
  ok "PostgreSQL   :5432  (running)"
else
  fail "PostgreSQL   :5432  (stopped)"
fi

# Redis
if redis-cli ping &>/dev/null; then
  ok "Redis        :6379  (running)"
else
  fail "Redis        :6379  (stopped)"
fi

# Backend
if curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/auth/login 2>/dev/null | grep -qE "^[24]"; then
  ok "Backend API  :4000  (running)"
else
  fail "Backend API  :4000  (stopped)"
fi

# Frontend
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "307" ]; then
  ok "Frontend     :3000  (running)"
else
  fail "Frontend     :3000  (stopped)"
fi

echo ""
echo -e "${BLUE}Лог-файлы${NC}"
echo "──────────────────────────────"
for f in backend frontend; do
  LOG="$LOG_DIR/$f.log"
  if [ -f "$LOG" ]; then
    SIZE=$(du -sh "$LOG" 2>/dev/null | cut -f1)
    LINES=$(wc -l < "$LOG" 2>/dev/null)
    warn "$f.log  ($SIZE, $LINES строк)"
  fi
done

echo ""
echo -e "${BLUE}Последние ошибки (backend)${NC}"
echo "──────────────────────────────"
if [ -f "$LOG_DIR/backend.log" ]; then
  grep -i "error\|warn\|ERR" "$LOG_DIR/backend.log" | tail -5 | sed 's/^/  /' || echo "  (нет)"
fi

echo ""
echo -e "${BLUE}БД — статистика${NC}"
echo "──────────────────────────────"
DB_URL=$(grep DATABASE_URL "$ROOT/.env" 2>/dev/null | cut -d= -f2- | sed 's/?schema=public//')
if [ -n "$DB_URL" ]; then
  psql "$DB_URL" -tA -c "
    SELECT 'Проектов: ' || COUNT(*) FROM \"Project\"
    UNION ALL
    SELECT 'Снапшотов: ' || COUNT(*) FROM \"Snapshot\"
    UNION ALL
    SELECT 'Сделок Bitrix24: ' || COUNT(*) FROM \"BitrixDeal\"
    UNION ALL
    SELECT 'Пользователей: ' || COUNT(*) FROM \"User\"
  " 2>/dev/null | sed 's/^/  /' || warn "Не удалось подключиться к БД"
fi
echo ""
