import type { ExecArgs } from "@medusajs/framework/types"
import { linkSalesChannelsToStockLocationWorkflow } from "@medusajs/medusa/core-flows"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

/**
 * Минимальный seed: регион RUB, канал продаж, склад и их связка.
 */
export default async function seed({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const regionModule = container.resolve(Modules.REGION)
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL)
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
  const stockLocationModule = container.resolve(Modules.STOCK_LOCATION)
  const storeModule = container.resolve(Modules.STORE)

  const regions = await regionModule.listRegions({}, { take: 1 })
  if (!regions.length) {
    await regionModule.createRegions({
      name: "Россия",
      currency_code: "rub",
      countries: ["ru"],
    })
    logger.info("Создан регион Россия / RUB")
  }

  const channels = await salesChannelModule.listSalesChannels({}, { take: 1 })
  let channel = channels[0]
  if (!channel) {
    channel = await salesChannelModule.createSalesChannels({
      name: "АМПЕР интернет-магазин",
      description: "Витрина Next.js",
    })
    logger.info("Создан sales channel")
  }

  const stores = await storeModule.listStores({}, { take: 1 })
  if (stores[0]) {
    await storeModule.updateStores(stores[0].id, {
      supported_currencies: [{ currency_code: "rub", is_default: true }],
      default_sales_channel_id: channel.id,
    })
  }

  const locations = await stockLocationModule.listStockLocations({}, { take: 1 })
  let location = locations[0]
  if (!location) {
    location = await stockLocationModule.createStockLocations({
      name: "Основной склад",
    })
    logger.info("Создан stock location")
  }

  // Без связки SC↔склад корзина падает на inventory check
  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: location.id,
      add: [channel.id],
      remove: [],
    },
  })
  logger.info("Sales channel связан со складом")

  try {
    const shippingProfiles = await fulfillmentModule.listShippingProfiles(
      { type: "default" },
      { take: 1 }
    )
    void shippingProfiles
  } catch {
    // опционально
  }

  logger.info("Seed завершён. Дальше: npm run sync:moysklad")
}
