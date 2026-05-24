#!/usr/bin/env bash
# ⚠️  Полный сброс БД: удаляет все данные и накатывает миграции заново.
# Используется только в разработке.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
BACKEND="$ROOT/apps/backend"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo -e "${RED}"
echo "╔══════════════════════════════════════════╗"
echo "║  ВНИМАНИЕ: Сброс базы данных             ║"
echo "║  Все данные будут удалены.               ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"
echo -n "Введите 'yes' чтобы продолжить: "
read -r CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Отменено."
  exit 0
fi

cd "$BACKEND"

echo ""
echo -e "${YELLOW}[•]${NC} Сбрасываю и пересоздаю схему..."
npx prisma migrate reset --force 2>&1 | tail -5

echo -e "${YELLOW}[•]${NC} Запускаю сеед..."
npx ts-node prisma/seed.ts 2>&1 | tail -10

echo ""
echo -e "${GREEN}[✓]${NC} БД сброшена и засеяна заново."
