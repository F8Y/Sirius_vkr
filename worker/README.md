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
  anonymizer/             # пайплайн anonymize: псевдонимизация / анонимизация / k-анонимность
  store/                  # запись статусов + батч-вставка + decrypt PII + vault.pseudonym_map
```

## Контракт сообщения

Зеркалирует Pydantic-модель backend (`app/schemas/job.py`):

```json
{
  "job_id": "uuid",
  "type": "import | anonymize",
  "payload": {
    "file_path": "string|null",   // import: директория датасета
    "dataset_id": "string|null",  // зарезервировано
    "mode": "pseudonymize|anonymize|null",  // anonymize: режим обезличивания
    "dataset": "students|guardians|null"    // anonymize: какая таблица (default students)
  },
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
| `OUTPUT_DIR` | базовый каталог для вывода (default `/data/imports`) |

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

## Пайплайн anonymize (Батч 3) — ядро ВКР

Задача `anonymize` читает ПДн из `core` через `vault.decrypt_pii(...)` (единственный
путь расшифровки), применяет технику обезличивания и пишет результат в **CSV** под
`OUTPUT_DIR/anonymized/<job_id>/<dataset>.csv` (общий bind-mount с backend). Сводка
и метрики — в `jobs.result`. Режим задаётся `payload.mode`, таблица — `payload.dataset`
(`students` по умолчанию, либо `guardians`).

> **Выбор вывода:** CSV в общий каталог, а не отдельная таблица. Причина — обезличенный
> набор предназначен для выгрузки/передачи третьим лицам, его удобно инспектировать и
> отдавать как есть; отдельная таблица в `core` смешала бы обезличенные данные с
> оперативными ПДн. Путь к файлу возвращается в `jobs.result.output_path`.

### Режим A — псевдонимизация (ОБРАТИМО)

Прямые идентификаторы (ФИО, email, телефон) заменяются на непрозрачные токены
(`nm_…`, `eml_…`, `phn_…`). Соответствие пишется в `vault.pseudonym_map`:
`(entity_type, entity_id, field_name)` → `pseudonym`, плюс `original_hash` (SHA-256
оригинала — **не сам оригинал**). Квазиидентификатор `birth_date` сохраняется без
изменений: псевдонимизированные данные юридически остаются персональными.

- **Обратимость.** Токен → строка `pseudonym_map` → `entity_id`+`field_name` →
  `vault.decrypt_pii(<поле>)` из `core.students`. Сама vault-таблица оригинал не
  хранит (хранит хеш), поэтому восстановление возможно только при доступе к `vault` и
  к зашифрованному `core`. После прогона выполняется self-check (один токен
  восстанавливается и сверяется с оригиналом) — результат в
  `result.pseudonymization.reversibility_check`.
- **Идемпотентность.** `INSERT … ON CONFLICT … DO UPDATE` сохраняет существующий
  токен (обновляется только `original_hash`), повторный прогон стабилен.

### Режим B — анонимизация (НЕОБРАТИМО)

- Прямые идентификаторы: `id` и ФИО **удаляются** (вместо `id` — сквозной суррогат
  `record`, не ссылающийся на `core`); email/телефон **маскируются**
  (`i***@***.ru`, `+7 9** *** ** NN`).
- Квазиидентификатор `birth_date` **обобщается** до 5-летнего диапазона
  (`2011-09-04 → 2010-2014`).
- В `vault.pseudonym_map` **ничего не пишется** (`result.anonymization.pseudonym_map_writes`
  всегда `0`) — в этом суть необратимости.

### k-анонимность

`k` = размер наименьшего класса эквивалентности по комбинации квазиидентификаторов.
Для `students` QI = обобщённая `birth_date`; для `guardians` (нет даты рождения) —
`relation_type`. В `result.k_anonymity`: `quasi_identifiers`, `k`, `threshold` (=5),
`compliant` (`k >= 5`), `equivalence_classes`, `total_records`. Для анонимизации
дополнительно `k_before_generalization` (k по точной дате) — наглядно показывает
эффект обобщения. ℓ-разнообразие — вне рамок фазы 2.

### Демонстрация

```bash
# admin-токен (OAuth2 form-login):
TOKEN=$(curl -s -X POST localhost:8000/api/v1/auth/login \
  -d "username=$BOOTSTRAP_ADMIN_EMAIL&password=$BOOTSTRAP_ADMIN_PASSWORD" | jq -r .access_token)

# импорт синтетики (Батч 2) → затем:
curl -X POST localhost:8000/api/v1/jobs -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"type":"anonymize","payload":{"mode":"pseudonymize","dataset":"students"}}'

curl -X POST localhost:8000/api/v1/jobs -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"type":"anonymize","payload":{"mode":"anonymize","dataset":"students"}}'
```

## Текущее состояние

`import` и `anonymize` (оба режима + k-анонимность) — реальная обработка.
