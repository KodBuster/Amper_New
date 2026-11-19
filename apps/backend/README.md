# АМПЕР Backend (Medusa 2.22.2)

## Запуск

1. Поднимите Postgres и Redis: `docker compose up -d` из корня репозитория.
2. Скопируйте `.env.example` → `.env` и укажите `MOYSKLAD_API_TOKEN`.
3. `npm install` в корне или в этой папке.
4. `npx medusa db:migrate`
5. `npm run seed`
6. `npm run sync:moysklad` — первичная выгрузка из МойСклад.
7. `npm run dev` — http://localhost:9000 (Admin: `/app`)

## МойСклад

- Модуль: `src/modules/moysklad`
- Webhook/health: `GET|POST /hooks/moysklad`
- Job: каждые 15 минут
- Заказы: subscriber `order.placed` → `customerorder`
