# Маркетинговый дашборд — Авторская школа Жании Аубакировой

Единая система мониторинга трафика, лидов и эффективности 6 контентных проектов.

---

## Что запускается на вашем компьютере

| Сервис | Порт | Что делает |
|--------|------|-----------|
| **PostgreSQL 16** | 5432 | Основная БД. Запускается через Homebrew как системный сервис. |
| **Redis 8** | 6379 | Кэш API-ответов (YouTube detail — 1 час). Запускается через Homebrew. |
| **Backend (NestJS)** | 4000 | REST API `/api/...`. Запускается скриптом через ts-node. |
| **Frontend (Next.js)** | 3000 | UI дашборда. Запускается скриптом через next dev. |

PostgreSQL и Redis — постоянные фоновые сервисы macOS (работают даже после перезагрузки).  
Backend и Frontend — процессы, которые надо запускать вручную при необходимости.

---

## Быстрый старт

```bash
cd /Users/eldarkoziyev/Projects/Guryk/dashboard

# Первый раз или после git pull:
npm install

# Запустить всё:
./scripts/start.sh
```

Откройте **http://localhost:3000** → логин `admin@a-school.kz` / пароль из `.env` (`ADMIN_PASSWORD`).

### Все скрипты

| Скрипт | Что делает |
|--------|-----------|
| `./scripts/start.sh` | Проверяет Postgres/Redis, применяет миграции, запускает backend и frontend |
| `./scripts/stop.sh` | Останавливает backend и frontend |
| `./scripts/status.sh` | Показывает состояние всех сервисов + статистику БД |
| `./scripts/reset-db.sh` | ⚠️ Полный сброс БД (только dev) |

---

## Стек

### Backend (`apps/backend/` → :4000)
- **NestJS 10** + TypeScript — фреймворк с модульной архитектурой
- **Prisma 5** — ORM, работает с PostgreSQL
- **@nestjs/schedule** — cron-задачи (синхронизация YouTube каждые 6 часов)
- **@nestjs/jwt + passport-jwt** — JWT-авторизация
- **bcrypt** — хеширование паролей
- **AES-256-GCM** — шифрование OAuth-токенов в БД (ключ `ENCRYPTION_KEY` в `.env`)
- **nestjs-pino** — структурированное логирование
- **ts-node** — запуск TypeScript напрямую без сборки

### Frontend (`apps/frontend/` → :3000)
- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** — стилизация
- **Recharts** — графики (линейные, donut, heatmap, воронка)
- **Radix UI** — базовые компоненты (Select, Dialog, Tabs, DropdownMenu)
- **Zustand** — состояние UI (sidebar open/close)
- **lucide-react** — иконки

### Инфраструктура
- **PostgreSQL 16** (Homebrew) — основная БД
- **Redis 8** (Homebrew) — кэш
- **npm workspaces** — монорепо (`apps/backend`, `apps/frontend`)

---

## Структура проекта

```
dashboard/
├── .env                        ← переменные окружения (не в git)
├── .env.example                ← шаблон
├── docker-compose.yml          ← альтернатива Homebrew (не используется сейчас)
├── package.json                ← npm workspaces
├── scripts/
│   ├── start.sh                ← запуск всего
│   ├── stop.sh                 ← остановка
│   ├── status.sh               ← проверка состояния
│   └── reset-db.sh             ← сброс БД
└── apps/
    ├── backend/
    │   ├── prisma/
    │   │   ├── schema.prisma   ← схема БД
    │   │   ├── seed.ts         ← 6 проектов + admin
    │   │   ├── import-youtube.ts  ← скрипт подключения YouTube-канала
    │   │   └── import-bitrix.ts   ← скрипт подключения Bitrix24
    │   └── src/
    │       ├── auth/           ← login, refresh, JWT, RBAC-guard
    │       ├── users/          ← CRUD (только ADMIN)
    │       ├── projects/       ← 6 проектов + метрики
    │       ├── integrations/
    │       │   ├── youtube/    ← YouTube Data API v3 + Analytics API v2
    │       │   ├── bitrix/     ← Bitrix24 REST API (сделки, воронка)
    │       │   └── meta/       ← заглушка (Instagram/Facebook — Этап 2)
    │       ├── snapshots/      ← cron каждые 6 часов + ручной запуск
    │       ├── insights/       ← автоматические инсайты (аномалии, тренды)
    │       ├── notes/          ← заметки к видео (§7.3)
    │       ├── utm/            ← UTM-конструктор (§14.5)
    │       └── audit/          ← лог действий (§16)
    └── frontend/
        └── src/
            ├── middleware.ts   ← редирект на /login без cookie
            ├── app/
            │   ├── (auth)/login/
            │   └── (dashboard)/
            │       ├── layout.tsx          ← sidebar + filter-bar
            │       ├── overview/           ← §6 Обзор: KPI + графики
            │       ├── projects/           ← §7 Список и детальные страницы
            │       ├── leads/              ← §9 Лиды из Bitrix24
            │       ├── ads/                ← §8 заглушка (Meta Ads — Этап 4)
            │       ├── traffic/            ← §10 заглушка (GA4 — Этап 5)
            │       ├── whatsapp/           ← §11 заглушка (Этап 5)
            │       ├── utm/                ← §14.5 UTM-конструктор
            │       ├── compare/            ← §12 заглушка (Этап 5)
            │       ├── reports/            ← §13 экспорт (MVP)
            │       └── settings/           ← §14 подключение платформ
            └── components/
                ├── kpi-card.tsx
                ├── sidebar.tsx
                ├── filter-bar.tsx          ← глобальный выбор периода
                └── widgets/
                    ├── daily-views-chart.tsx
                    ├── donut-chart.tsx
                    ├── demographics-pyramid.tsx
                    ├── weekday-heatmap.tsx
                    ├── countries-list.tsx
                    ├── platform-card.tsx
                    └── video-detail-sheet.tsx  ← заметки к видео
```

---

## Что реально работает сейчас

### ✅ Авторизация и RBAC
JWT (access 15 мин + refresh 7 дней). 6 ролей: `ADMIN`, `DIRECTOR`, `MARKETING_DIRECTOR`, `SMM`, `TARGETOLOG`, `SALES`.

### ✅ YouTube интеграция
Полная: Data API v3 + Analytics API v2.  
Данные: подписчики, просмотры, лайки, удержание, источники трафика, демография, страны, устройства, ОС, топ-видео.  
Синхронизация: автоматически каждые 6 часов + вручную.

Подключено: **Клуб Родителей** (`parent-club`) и **Ayaru Show** (`ayaru-show`).

### ✅ Bitrix24 интеграция
Сделки из CRM: воронка по этапам, источники лидов, UTM-атрибуция, конверсия.  
Синхронизация: вручную через кнопку на странице «Лиды».

### ✅ Страницы дашборда
- **Обзор** — 6 KPI-плиток, тренды YouTube
- **Проекты** — список + детальная страница каждого (графики, демография, видео, заметки)
- **Лиды** — воронка из Bitrix24
- **UTM-конструктор** — генерация ссылок с валидацией
- **Настройки** — подключение YouTube-каналов, управление пользователями

### 🔜 В разработке (следующие этапы)
- Instagram / Facebook / TikTok метрики
- Meta Ads (рекламные кампании)
- GA4 (трафик сайта)
- WhatsApp
- Конструктор отчётов с экспортом PDF

---

## База данных

### Таблицы

| Таблица | Что хранит |
|---------|-----------|
| `User` | Пользователи системы |
| `Project` | 6 проектов (a-school, parent-club, millimone, ayaru-show, teachers, miss-mari) |
| `ProjectPlatform` | Связка проект ↔ платформа + зашифрованные OAuth-токены |
| `Snapshot` | Исторические метрики по дням (views, subscribers, reach и др.) |
| `BitrixConfig` | Webhook URL Bitrix24 (зашифрован) |
| `BitrixDeal` | Сделки из Bitrix24 CRM |
| `VideoNote` | Заметки к видео-публикациям |
| `UtmLink` | История UTM-ссылок |
| `AuditLog` | Лог всех действий пользователей |
| `RefreshSession` | Сессии (refresh-токены) |
| `IntegrationLog` | Лог вызовов к внешним API |

### Миграции

```bash
# Применить миграции (автоматически при start.sh):
cd apps/backend && npx prisma migrate deploy

# Просмотр схемы в браузере:
cd apps/backend && npx prisma studio
# → открывает http://localhost:5555
```

---

## Подключение интеграций

### YouTube (новый канал)

1. Создать OAuth credentials в [Google Cloud Console](https://console.cloud.google.com/)
2. Тип: **Web application**. Redirect URI: `http://localhost:4000/api/integrations/youtube/oauth/callback`
3. Включить: **YouTube Data API v3** + **YouTube Analytics API**
4. Добавить в `.env`:
   ```
   YOUTUBE_CHANNEL_ID_FOR_MYPROJECT=UCxxxxxxxx
   YOUTUBE_REFRESH_TOKEN_FOR_MYPROJECT=1//0xxx...
   # Если отдельный OAuth client:
   YOUTUBE_CLIENT_ID_FOR_MYPROJECT=xxx.apps.googleusercontent.com
   YOUTUBE_CLIENT_SECRET_FOR_MYPROJECT=GOCSPX-xxx
   ```
5. Запустить импорт:
   ```bash
   cd apps/backend
   npx ts-node prisma/import-youtube.ts myproject
   ```

### Bitrix24

1. В Bitrix24: **Приложения → Вебхуки → Входящий вебхук**
2. Права: `CRM` (только чтение)
3. Скопировать URL (формат: `https://company.bitrix24.ru/rest/1/токен/`)
4. Сохранить в БД:
   ```bash
   cd apps/backend
   npx ts-node prisma/import-bitrix.ts https://company.bitrix24.ru/rest/1/токен/
   ```
5. Открыть `/leads` → нажать «Синхронизировать»

---

## API — основные эндпоинты

Все эндпоинты под `/api/`. Авторизация: заголовок `Authorization: Bearer <token>`.

```
POST /auth/login                              → { accessToken, refreshToken, user }
POST /auth/refresh                            → новые токены
POST /auth/logout

GET  /projects                                → список 6 проектов
GET  /projects/:slug/metrics?period=30d       → KPI + графики проекта

GET  /integrations/youtube/:ppId/channel      → инфо о канале
GET  /integrations/youtube/:ppId/videos       → последние видео
GET  /integrations/youtube/:ppId/detail       → детальная аналитика
GET  /integrations/youtube/oauth/start/:ppId  → старт Google OAuth
GET  /integrations/youtube/oauth/callback     → callback от Google

GET  /bitrix/status                           → настроен ли Bitrix24
POST /bitrix/sync                             → синхронизировать сделки [ADMIN/MD]
GET  /bitrix/funnel?days=30                   → воронка по этапам
GET  /bitrix/sources?days=30                  → лиды по источникам
GET  /bitrix/deals?days=30                    → список сделок

POST /snapshots/run                           → запустить ETL вручную [ADMIN/MD]
GET  /snapshots                               → история метрик

GET  /insights                                → автоматические инсайты

GET  /utm                                     → UTM-ссылки
POST /utm                                     → создать UTM-ссылку
POST /utm/preview                             → превью без сохранения

GET  /notes/:videoId/:ppId                    → заметки к видео
POST /notes                                   → добавить заметку
DELETE /notes/:id                             → удалить заметку

GET  /users/me                                → профиль
GET  /users                                   → список [ADMIN]
POST /users                                   → создать [ADMIN]
PATCH /users/:id                              → обновить [ADMIN]

GET  /audit-log                               → лог действий [ADMIN]
```

---

## Логи

```bash
# Живой лог backend:
tail -f .logs/backend.log

# Живой лог frontend:
tail -f .logs/frontend.log

# Только ошибки backend:
grep -i "error\|ERR" .logs/backend.log | tail -20
```

---

## Переменные окружения (`.env`)

| Переменная | Описание |
|-----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `BACKEND_PORT` | Порт backend (по умолчанию 4000) |
| `JWT_SECRET` | Секрет для access-токенов |
| `JWT_REFRESH_SECRET` | Секрет для refresh-токенов |
| `JWT_ACCESS_TTL` | Время жизни access-токена (default: `15m`) |
| `JWT_REFRESH_TTL` | Время жизни refresh-токена (default: `7d`) |
| `ENCRYPTION_KEY` | Ключ AES-256 для шифрования OAuth-токенов |
| `ADMIN_EMAIL` | Email admin-пользователя (для seed) |
| `ADMIN_PASSWORD` | Пароль admin (для seed) |
| `ADMIN_NAME` | Имя admin (для seed) |
| `NEXT_PUBLIC_API_URL` | URL backend для Next.js (default: `http://localhost:4000`) |
| `YOUTUBE_CLIENT_ID` | Google OAuth client ID (глобальный) |
| `YOUTUBE_CLIENT_SECRET` | Google OAuth client secret (глобальный) |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key |
| `YOUTUBE_OAUTH_REDIRECT` | OAuth redirect URI |
| `YOUTUBE_CHANNEL_ID_FOR_<SLUG>` | Channel ID для конкретного проекта |
| `YOUTUBE_REFRESH_TOKEN_FOR_<SLUG>` | Refresh token для конкретного проекта |
| `META_APP_ID` | Meta (Facebook) App ID — Этап 2 |
| `META_APP_SECRET` | Meta App Secret — Этап 2 |

---

## Статус реализации по ТЗ

| Этап | Содержание | Статус |
|------|-----------|--------|
| **1** | Базис: архитектура, БД, авторизация, YouTube | ✅ Готово |
| **2** | Интеграции: Bitrix24 ✅, Meta/Instagram 🔜, TikTok 🔜, GA4 🔜 | Частично |
| **3** | Страницы проектов с детализацией | ✅ Готово |
| **4** | Реклама (Meta Ads) + воронки | 🔜 |
| **5** | GA4, WhatsApp, UTM, сравнения | Частично (UTM ✅) |
| **6** | Отчёты, алерты, экспорт | Частично (печать ✅) |
| **7** | Тестирование и доработки | 🔜 |
