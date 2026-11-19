# АМПЕР — Next.js 15 + Medusa 2.22.2 + МойСклад

Интернет-магазин электротоваров: витрина по прототипу **AMPER A v14.2**, backend Medusa, двусторонняя синхронизация с [МойСклад](https://www.moysklad.ru/).

## Структура

- `apps/web` — Next.js 15 (витрина)
- `apps/backend` — Medusa 2.22.2 + модуль `moysklad`
- `first_entry_point/` — исходный HTML-прототип (reference)
- `docker-compose.yml` — Postgres 16 + Redis 7

## Быстрый старт

1. Установите **Docker Desktop** (или свой Postgres/Redis) и **Node.js ≥ 22.22**.
2. Из корня:

```bash
docker compose up -d
cp .env.example apps/backend/.env
cp apps/web/.env.example apps/web/.env.local
```

3. В `apps/backend/.env` укажите `MOYSKLAD_API_TOKEN` (и при желании ID организации/склада/типа цены).
4. Установка и миграции:

```bash
npm install
cd apps/backend
npx medusa db:migrate
npm run seed
npm run sync:moysklad
npm run dev
```

5. Витрина (другой терминал):

```bash
cd apps/web
npm run dev
```

- Витрина: http://localhost:3000  
- Medusa Admin: http://localhost:9000/app  
- Health МойСклад: http://localhost:9000/hooks/moysklad  

После первого запуска Admin создайте publishable API key и пропишите его в `apps/web/.env.local` как `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`.

## Синхронизация с МойСклад

| Данные | Направление |
|--------|-------------|
| Товары, артикулы, цены | МойСклад → Medusa |
| Остатки | МойСклад → Medusa |
| Заказы | Medusa → МойСклад (`order.placed`) |
| Статусы | МойСклад → Medusa (job / webhook) |

Токен **не коммитьте** в git.

Проверка токена без Medusa:

```bash
node scripts/verify-moysklad.mjs
```

## Рабочий путь проекта

Актуальная копия без скобок в пути:

`C:\Cursor_Projects\Amper_New`

В `apps/backend/.env` задано `MEDUSA_ADMIN_ON=1` (Admin включён). Старую папку `C:\(C)BONUS\Cursor.Projects\Amper_New` можно удалить после проверки.

## Важно окружения на этой машине

- Нужен **Docker Desktop** — `docker compose up -d` из корня проекта поднимает Postgres и Redis.
- Витрина Next.js **15.5.7**, backend Medusa **2.22.2**.

После Docker и токена в `apps/backend/.env`:

```bash
cd apps/backend
npx medusa db:migrate
npm run seed
npm run sync:moysklad
npm run dev
```
