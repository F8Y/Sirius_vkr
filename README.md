# Сириус 27

Веб-приложение для управления персональными данными в региональном образовательном центре «Сириус 27».
Дипломная работа (ВКР).

> **Все данные полностью синтетические.** Реальные персональные данные не используются.

## Стек

| Слой | Технология |
|---|---|
| Frontend | Next.js (App Router, TypeScript, FSD) |
| Backend | FastAPI (Python 3.12, Pydantic v2) |
| Worker | Go 1.22+ (Redis Streams consumer) |
| БД | PostgreSQL 16 (pgcrypto, RLS) |
| Очередь | Redis 7 (Streams, at-least-once) |
| Инфраструктура | Docker + docker-compose |

## Быстрый старт

```bash
# 1. Клонировать репозиторий
git clone <repo-url> && cd sirius27

# 2. Создать .env из шаблона
cp .env.example .env

# 3. Запустить все сервисы
docker compose up --build
```

После запуска:

| Сервис | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Backend docs (Swagger) | http://localhost:8000/docs |
| Backend health | http://localhost:8000/health |

## Структура монорепозитория

```
sirius27/
├── docker-compose.yml       # оркестрация 5 сервисов
├── .env.example             # шаблон переменных окружения
├── db/init/                 # SQL-скрипты инициализации PostgreSQL
├── backend/                 # FastAPI (Python 3.12, uv)
├── worker/                  # Go worker (Redis Streams consumer)
├── frontend/                # Next.js (App Router, TS, FSD)
└── tools/                   # утилиты (генератор синтетических данных)
```

## Генерация синтетических данных

```bash
cd tools
python gen_synthetic_data.py --count 100 --output ./output
```

## Линтеры

```bash
# Backend
cd backend && ruff check . && mypy .

# Frontend
cd frontend && pnpm lint

# Worker
cd worker && go vet ./...
```

## Лицензия

Учебный проект. Все права защищены.