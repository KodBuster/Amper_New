import { loadEnv, defineConfig } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

module.exports = defineConfig({
  // Admin Vite ломается на пути с скобками вроде C:\(C)BONUS\...
  // Включите снова после переноса проекта в путь без спецсимволов.
  admin: {
    disable: process.env.MEDUSA_ADMIN_ON !== "1",
  },
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  modules: [
    {
      resolve: "./src/modules/moysklad",
      options: {
        apiUrl: process.env.MOYSKLAD_API_URL || "https://api.moysklad.ru/api/remap/1.2",
        apiToken: process.env.MOYSKLAD_API_TOKEN,
        organizationId: process.env.MOYSKLAD_ORGANIZATION_ID,
        storeId: process.env.MOYSKLAD_STORE_ID,
        priceTypeId: process.env.MOYSKLAD_PRICE_TYPE_ID,
        webhookSecret: process.env.MOYSKLAD_WEBHOOK_SECRET,
      },
    },
  ],
})