# Backend — Сириус 27 API

FastAPI + Pydantic v2, Python 3.12, пакетный менеджер **uv**.

## Назначение

REST API и единственная HTTP-граница системы (браузер → FastAPI). Создаёт задачи
в таблице `core.jobs`, публикует их в Redis Stream и отдаёт статус по поллингу.
Прямого взаимодействия с Go-воркером нет — только через Redis Stream + Postgres.

## Структура

```
app/
  main.py            # FastAPI app, lifespan (consumer group + bootstrap admin), GET /health
  core/              # config, database (async SQLAlchemy), redis, security (JWT + bcrypt)
  api/deps.py        # get_current_user, require_roles/require_admin (RBAC)
  api/v1/            # роутеры: auth.py, users.py, jobs.py
  schemas/           # Pydantic v2 DTO: job.py (Redis Stream contract), auth.py
  models/            # ORM-модели: job, user (users/roles/user_roles), student,
                     #   learning (courses/groups/enrollments/activities), consent, pseudonym
  services/          # бизнес-логика: job_service, auth_service
  queue/             # publisher.py — XADD в Redis Stream
migrations/          # Alembic (async-шаблон, asyncpg)
```

## Аутентификация и роли

- JWT (HS256, `SECRET_KEY`), пароли — bcrypt (`pwdlib`). Токен передаётся как
  `Authorization: Bearer <token>`; в Swagger работает кнопка **Authorize**.
- Роли: `child` / `parent` / `teacher` / `admin` (M:N через `core.user_roles`).
  Саморегистрация разрешает только `child`/`parent`; `teacher`/`admin` назначает
  админ через `PUT /api/v1/users/{id}/roles`.
- Чувствительные операции с массивами ПДн (создание задач import/anonymize) —
  только `admin`.
- Bootstrap-админ создаётся на старте, если заданы `BOOTSTRAP_ADMIN_EMAIL` и
  `BOOTSTRAP_ADMIN_PASSWORD` (идемпотентно).

## Шифрование ПДн (pgcrypto)

ПДн (`last_name`, `first_name`, `middle_name`, `email`, `phone`) в
`core.students`/`core.guardians` хранятся как зашифрованный `bytea`. Ключ лежит
в `vault.encryption_keys` (генерируется в миграции, в репозиторий не попадает).
Доступ — через SQL-функции `vault.encrypt_pii(text) → bytea` и
`vault.decrypt_pii(bytea) → text` (SECURITY DEFINER, ключ наружу не отдаётся).

> **Email — два разных понятия.** `core.users.email` — это учётная запись для
> входа: хранится в открытом виде (хэшируется только пароль), иначе сломается
> поиск пользователя при логине. `students.email`/`guardians.email` — это ПДн и
> шифруются. Шифрование ПДн не затрагивает путь аутентификации.

## Запуск

В составе стека — из корня репозитория:

```bash
docker compose up --build
```

Локально (вне Docker):

```bash
cd backend
uv sync
uv run alembic upgrade head          # применить миграции
uv run uvicorn app.main:app --reload # http://localhost:8000
```

Контейнер при старте выполняет `alembic upgrade head && uvicorn ...` —
миграции накатываются автоматически до подъёма сервера.

## Эндпоинты

| Метод | Путь | Доступ | Назначение |
|---|---|---|---|
| GET | `/health` | публичный | состояние Postgres + Redis |
| POST | `/api/v1/auth/register` | публичный | регистрация (роли child/parent) |
| POST | `/api/v1/auth/login` | публичный | email+пароль → bearer-токен |
| GET | `/api/v1/auth/me` | авторизованный | текущий пользователь |
| GET | `/api/v1/users` | admin | список аккаунтов |
| PUT | `/api/v1/users/{id}/roles` | admin | назначить роли пользователю |
| POST | `/api/v1/jobs` | admin | создать задачу и опубликовать в Stream |
| GET | `/api/v1/jobs/{id}` | авторизованный | статус задачи |
| GET | `/docs` | публичный | Swagger UI |

## Миграции (Alembic)

```bash
uv run alembic revision --autogenerate -m "описание"
uv run alembic upgrade head
uv run alembic downgrade -1
```

Схемы (`core`, `vault`), расширения и роль `vault_role` создаются заранее в
`db/init/01-init.sh`; Alembic управляет только таблицами.

## Линтинг

```bash
ruff check . && ruff format --check . && mypy .
```

`ruff` — line-length 99; `mypy` — strict + pydantic plugin.
