FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV MEDUSA_ADMIN_ON=1 MEDUSA_DISABLE_TELEMETRY=1 NODE_PATH=/app/apps/backend/node_modules
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/backend/package.json apps/backend/package.json
RUN npm ci --no-audit --no-fund
COPY apps/backend apps/backend
RUN npm run build --workspace=apps/backend

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production MEDUSA_ADMIN_ON=1 MEDUSA_DISABLE_TELEMETRY=1 NODE_PATH=/app/apps/backend/node_modules PORT=9000 HOST=0.0.0.0 MOYSKLAD_DATA_DIR=/data/moysklad MEDUSA_UPLOAD_DIR=/data/static
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=build /app/apps/backend/.medusa/server ./apps/backend/.medusa/server
COPY deploy/amvera/start-backend.mjs ./start-backend.mjs
WORKDIR /app/apps/backend/.medusa/server
EXPOSE 9000
CMD ["node", "/app/start-backend.mjs"]
