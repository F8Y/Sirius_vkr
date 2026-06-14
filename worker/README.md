# Worker — Сириус 27

Go 1.22+, go-redis, Redis Streams.

## Назначение

Асинхронный обработчик тяжёлых задач (`import`, `anonymize`). Читает сообщения из
Redis Stream через `XREADGROUP` (consumer group, at-least-once), прогоняет задачу
и пишет статус напрямую в Postgres `core.jobs`: `pending → processing → done/failed`,
затем `XACK`. HTTP к backend отсутствует — интеграция только через Redis + Postgres.

## Структура

```
cmd/worker/main.go        # точка входа, graceful shutdown, retry-подключения
internal/
  config/                 # чтение env
  consumer/               # XREADGROUP loop, dispatch по типу задачи, XACK
  job/                    # struct, зеркалирующий Pydantic JobStreamMessage
  importer/               # пайплайн import: чтение CSV/XLSX, валидация, запись
  store/                  # запись статусов + батч-вставка students/guardians/links
```

## Контракт сообщения

Зеркалирует Pydantic-модель backend (`app/schemas/job.py`):

```json
{
  "job_id": "uuid",
  "type": "import | anonymize",
  "payload": { "file_path": "string|null", "dataset_id": "string|null" },
  "created_at": "iso8601"
}
```

Сообщение публикуется в поле `data` Stream-записи. Consumer group создаётся с
`id="0"` — согласовано с backend, гарантирует доставку с первого сообщения.

## Запуск

В составе стека — из корня репозитория:

```bash
docker compose up --build
```

Локально (вне Docker, нужны запущенные Postgres и Redis):

```bash
cd worker
go run ./cmd/worker
```

## Конфигурация (env)

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | DSN Postgres (`postgres://...?sslmode=disable`) |
| `REDIS_URL` | адрес Redis |
| `STREAM_NAME` | имя Redis Stream |
| `CONSUMER_GROUP` | имя consumer group |
| `CONSUMER_NAME` | имя консьюмера в группе |

## Линтинг

```bash
gofmt -l . && go vet ./...
```

## Пайплайн import (Батч 2)

`payload.file_path` указывает на **директорию датасета** (в стеке —
`/data/imports/<dataset>`, общий bind-mount с backend). Воркер ищет в ней файлы
генератора и обрабатывает их в порядке FK-зависимостей:

1. `students.csv` / `.xlsx` — обязателен;
2. `guardians.csv` / `.xlsx` — опционален;
3. `student_guardian.csv` / `.xlsx` — опционален.

Каждая строка валидируется (обязательные поля, формат email/телефона, дата
`YYYY-MM-DD`, UUID, `relation_type ∈ {mother,father,guardian}`). Валидные строки
пишутся батчами; **ПДн шифруются на вставке** через `vault.encrypt_pii(...)`,
запись **идемпотентна** (`ON CONFLICT DO NOTHING`) — повторный прогон того же
датасета безопасен. Прогресс обновляется по этапам; построчные ошибки и счётчики
(`total/inserted/skipped/failed` + до 100 ошибок на сущность) пишутся в
`jobs.result`. Фатальные сбои (нет директории, нет `students`, недоступна БД) →
статус `failed`; ошибки данных в строках → статус `done` с детализацией.

Демонстрация:

```bash
cd tools && python gen_synthetic_data.py --count 100 --output ../data/imports/demo
# затем (admin-токен): POST /api/v1/jobs {"type":"import","payload":{"file_path":"/data/imports/demo"}}
```

## Текущее состояние

`import` — реальная обработка (см. выше). `anonymize` — заглушка до Батча 3.
