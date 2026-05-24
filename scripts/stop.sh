#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# stop.sh — остановить всё (backend + frontend + PostgreSQL + Redis)
#
# Что делает:
#   1. Находит backend и frontend по сохранённым PID-файлам
#   2. Убивает процессы
#   3. На всякий случай убивает по имени процесса (страховка)
#   4. Останавливает PostgreSQL
#   5. Останавливает Redis
# ─────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/../.logs"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

echo ""
echo "Останавливаю дашборд..."
echo ""

# 1. Останавливаем по PID-файлам (созданы при npm start)
for svc in backend frontend; do
  PID_FILE="$LOG_DIR/$svc.pid"
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
      kill "$PID" 2>/dev/null
      ok "$svc (PID $PID) остановлен"
    else
      warn "$svc (PID $PID) уже не работал"
    fi
    rm -f "$PID_FILE"
  fi
done

# 2. Страховка — убиваем по имени процесса на случай если PID-файлов нет
pkill -f "ts-node.*backend/src/main" 2>/dev/null && ok "Backend процесс убит" || true
pkill -f "nest start" 2>/dev/null && ok "NestJS процесс убит" || true
pkill -f "next-server\|next dev\|next start" 2>/dev/null && ok "Frontend процесс убит" || true
pkill -f "ngrok" 2>/dev/null && ok "ngrok остановлен" || true
pkill -f "cloudflared" 2>/dev/null && ok "cloudflared остановлен" || true

# 3. Останавливаем PostgreSQL и Redis
brew services stop postgresql@16 2>/dev/null && ok "PostgreSQL остановлен" || true
brew services stop redis 2>/dev/null && ok "Redis остановлен" || true

echo ""
