import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Создаёт для склада РФ зону и бесплатные опции «Самовывоз» / «Доставка»,
 * чтобы оформление заказа на витрине не падало без shipping method.
 */
export default async function ensureFulfillment({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
  const stockLocationModule = container.resolve(Modules.STOCK_LOCATION)
  const regionModule = container.resolve(Modules.REGION)

  const [location] = await stockLocationModule.listStockLocations({}, { take: 1 })
  if (!location) {
    throw new Error("Нет склада. Сначала выполните seed.")
  }

  const [region] = await regionModule.listRegions({}, { take: 1 })
  if (!region) {
    throw new Error("Нет региона. Сначала выполните seed.")
  }

  // Провайдер ручной доставки (встроенный)
  try {
    await link.create({
      [Modules.STOCK_LOCATION]: {
        stock_location_id: location.id,
      },
      [Modules.FULFILLMENT]: {
        fulfillment_provider_id: "manual_manual",
      },
    })
    logger.info("Склад связан с fulfillment-провайдером manual_manual")
  } catch {
    logger.info("Связь склада с manual_manual уже есть или не требуется повторно")
  }

  let [shippingProfile] = await fulfillmentModule.listShippingProfiles(
    { type: "default" },
    { take: 1 }
  )
  if (!shippingProfile) {
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: {
        data: [{ name: "Стандартный профиль доставки", type: "default" }],
      },
    })
    shippingProfile = result[0]
    logger.info("Создан shipping profile")
  }

  const existingSets = await fulfillmentModule.listFulfillmentSets(
    {},
    { take: 20, relations: ["service_zones"] }
  )
  let fulfillmentSet = existingSets.find(
    (s) => s.name === "АМПЕР доставка" || s.type === "shipping"
  )

  if (!fulfillmentSet) {
    fulfillmentSet = await fulfillmentModule.createFulfillmentSets({
      name: "АМПЕР доставка",
      type: "shipping",
      service_zones: [
        {
          name: "Россия",
          geo_zones: [{ type: "country", country_code: "ru" }],
        },
      ],
    })
    logger.info("Создан fulfillment set с зоной Россия")
  }

  try {
    await link.create({
      [Modules.STOCK_LOCATION]: {
        stock_location_id: location.id,
      },
      [Modules.FULFILLMENT]: {
        fulfillment_set_id: fulfillmentSet.id,
      },
    })
    logger.info("Склад связан с fulfillment set")
  } catch {
    logger.info("Связь склада с fulfillment set уже есть")
  }

  // Перечитываем, чтобы взять service_zones
  const sets = await fulfillmentModule.listFulfillmentSets(
    { id: fulfillmentSet.id },
    { take: 1, relations: ["service_zones"] }
  )
  const serviceZoneId = sets[0]?.service_zones?.[0]?.id
  if (!serviceZoneId) {
    throw new Error("У fulfillment set нет service zone")
  }

  const existingOptions = await fulfillmentModule.listShippingOptions(
    { service_zone_id: serviceZoneId },
    { take: 20 }
  )
  const names = new Set(existingOptions.map((o) => o.name))

  const toCreate = (
    [
      { name: "Самовывоз", code: "pickup", description: "Самовывоз со склада" },
      { name: "Доставка", code: "delivery", description: "Доставка по адресу" },
    ] as const
  ).filter((o) => !names.has(o.name))

  if (!toCreate.length) {
    logger.info("Опции Самовывоз/Доставка уже есть")
    return
  }

  await createShippingOptionsWorkflow(container).run({
    input: toCreate.map((o) => ({
      name: o.name,
      price_type: "flat" as const,
      provider_id: "manual_manual",
      service_zone_id: serviceZoneId,
      shipping_profile_id: shippingProfile.id,
      type: {
        label: o.name,
        description: o.description,
        code: o.code,
      },
      prices: [
        { currency_code: "rub", amount: 0 },
        { region_id: region.id, amount: 0 },
      ],
      rules: [
        { attribute: "enabled_in_store", value: "true", operator: "eq" as const },
        { attribute: "is_return", value: "false", operator: "eq" as const },
      ],
    })),
  })

  logger.info(
    `Созданы опции доставки: ${toCreate.map((o) => o.name).join(", ")}`
  )
}
