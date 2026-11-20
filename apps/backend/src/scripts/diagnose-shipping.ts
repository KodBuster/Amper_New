import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

/** Диагностика: почему у корзины нет shipping options */
export default async function diagnoseShipping({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
  const productModule = container.resolve(Modules.PRODUCT)

  const options = await fulfillmentModule.listShippingOptions(
    {},
    { take: 50, relations: ["service_zone", "shipping_profile", "type"] }
  )
  logger.info(`Shipping options в БД: ${options.length}`)
  for (const o of options) {
    logger.info(
      ` - ${o.name} id=${o.id} provider=${o.provider_id} profile=${o.shipping_profile_id} zone=${o.service_zone_id}`
    )
  }

  const profiles = await fulfillmentModule.listShippingProfiles({}, { take: 20 })
  logger.info(`Shipping profiles: ${profiles.map((p) => `${p.name}/${p.type}/${p.id}`).join(", ") || "нет"}`)

  const sets = await fulfillmentModule.listFulfillmentSets(
    {},
    { take: 20, relations: ["service_zones", "service_zones.geo_zones"] }
  )
  for (const s of sets) {
    logger.info(`Fulfillment set: ${s.name} type=${s.type} id=${s.id}`)
    for (const z of s.service_zones || []) {
      const geos = (z as { geo_zones?: Array<{ country_code?: string }> }).geo_zones
        ?.map((g) => g.country_code)
        .join(",")
      logger.info(`  zone ${z.name} id=${z.id} countries=${geos || "?"}`)
    }
  }

  const products = await productModule.listProducts({}, { take: 5 })
  for (const p of products) {
    logger.info(
      `Товар: ${p.title?.slice(0, 40)} shipping_profile_id=${(p as { shipping_profile_id?: string }).shipping_profile_id || "НЕТ"}`
    )
  }

  // Через Query — связь product ↔ shipping_profile
  try {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "title", "shipping_profile.id", "shipping_profile.name"],
      pagination: { take: 5 },
    })
    for (const row of data || []) {
      const sp = (row as { shipping_profile?: { id?: string; name?: string } })
        .shipping_profile
      logger.info(
        `Query product ${(row as { title?: string }).title?.slice(0, 30)} profile=${sp?.name || "НЕТ"} (${sp?.id || "-"})`
      )
    }
  } catch (e) {
    logger.warn(`Query product↔profile: ${(e as Error).message}`)
  }
}
